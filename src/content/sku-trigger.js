/**
 * sku-trigger.js
 * --------------------------
 * 监听错误弹窗，取 barcode，路由给 B。
 */

import {Logger} from '../common/logger.js';
import {MSG, ROLES, makeCorrId} from '../common/protocol.js';
import {ApiClient} from '../common/api-client.js';

const log = new Logger({scope: 'sku-trigger'});
const api = new ApiClient();

/** 配置 */
const CONFIG = {
    dialogSelector: '.ui-dialog',
    errorMessageSelector: '.tip-error-message',
    productBarcodeSelector: '#productBarcode',
    dedupeWindowMs: 1000, // 原来是 10000ms，过长会让你误以为“没任何提示”
    routeTimeoutMs: 1000 * 60 * 2
};

/* =========================
 * [ADD] 仅新增：拦截弹窗的工具函数
 * 说明：只在“指定错误文案”时调用，以便用户完全看不到该弹窗
 * ========================= */
function suppressDialog(dialogEl) {
    try {
        const dlg = dialogEl?.closest?.(CONFIG.dialogSelector) || dialogEl;
        if (dlg && dlg.style) dlg.style.display = 'none'; // 先隐藏，防止闪屏
        // 常见遮罩类名，按需补充
        document.querySelectorAll('.ui-widget-overlay, .ui-dialog-mask, .modal-backdrop')
            .forEach(ov => ov.remove());
        dlg?.remove?.();
        console.info('[A] 已拦截并移除指定错误弹窗');
    } catch (e) {
        console.warn('[A] 拦截弹窗失败：', e);
    }
}

/** 单次路由到 B（如果 B 不存在/已关闭/无响应，立即判定未就绪） */
function routeToBNoWait(data, timeout = CONFIG.routeTimeoutMs) {
    const corrId = makeCorrId();
    console.info('[A] routeToBNoWait -> send', {corrId, data});

    return new Promise((resolve, reject) => {
        let done = false;
        const fail = (why) => {
            if (done) return;
            done = true;
            console.info('[A] B 未启动 =>', why);
            reject(new Error('B 未启动'));
        };

        const timer = setTimeout(() => fail('timeout'), timeout);

        chrome.runtime.sendMessage({
            type: MSG.ROUTE_TO_ROLE, targetRole: ROLES.B, corrId, // 保持你旧版协议（发 BARCODE_REQUEST）
            payload: {type: MSG.BARCODE_REQUEST, data}
        }, (resp) => {
            if (done) return;
            clearTimeout(timer);
            const lastErr = chrome.runtime.lastError?.message;

            // 通道错误或后台未回
            if (lastErr || resp == null) {
                return fail(lastErr || 'empty resp');
            }

            // 后台显式告知“没有目标 frame”
            if (resp.ok !== true) {
                // 统一把“无目标/无响应”视为未启动（兼容旧后台的 no-response）
                if (resp.reason === 'no-target-frames' || resp.reason === 'no-response') {
                    return fail(resp.reason);
                }

                // 其它业务失败，原样抛给上层
                return reject(new Error(resp.reason || '二次分拣页面处理失败！'));
            }

            done = true;
            resolve({message: resp.message, data: resp.data});
        });
    });
}

/** 主拦截器：沿用你旧版的弹窗监听流程，仅增强可见性日志 */
class ErrorPromptEventInterceptor {
    constructor(config = {}) {
        this.cfg = {...CONFIG, ...config};
        this.observer = null;
        this.isProcessing = false;
        this.lastProcessedDialog = null;
        this.lastProcessedTime = 0;

        this.start();
    }

    start() {
        if (this.observer) return;
        const container = document.body;
        this.observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type !== 'childList') continue;
                for (const node of m.addedNodes) {
                    if (node && node.nodeType === Node.ELEMENT_NODE) {
                        this.onNodeAdded(node);
                    }
                }
            }
        });
        this.observer.observe(container, {childList: true, subtree: true});
        log.info('弹窗监听器已启动');
        window.xAI.PublicSidePanelManager.showInfo('已启动 SKU 错误弹窗监听');
    }

    onNodeAdded(node) {
        const dialog = node.matches?.(this.cfg.dialogSelector) ? node : node.closest?.(this.cfg.dialogSelector);
        if (!dialog) return;

        const errEl = dialog.querySelector(this.cfg.errorMessageSelector);
        if (!errEl) return;

        const errorText = (errEl.textContent || '').trim();
        if (!errorText) return;

        /* =========================
         * [ADD] 仅在“特定错误文案”时拦截并继续处理；
         *       其它任何错误弹窗：不拦截、也不进入 handle（直接 return）
         * ========================= */
        const input = document.querySelector(this.cfg.productBarcodeSelector);
        const barcode = input ? (input.value || '').trim() : '';
        const isTarget =
            barcode &&
            errorText.startsWith(`产品代码`) &&
            errorText.endsWith('未找到匹配未完成的订单');

        if (!isTarget) {
            // 非目标错误：不处理，保持页面原有行为（弹窗怎么显示继续怎么显示）
            console.info('------非目标弹窗------');
            return;
        }

        // 命中目标错误：先把弹窗干掉，避免用户看到；然后继续走原有流程
        suppressDialog(dialog); // [ADD]

        const now = Date.now();
        if (this.isProcessing) return;
        if (this.lastProcessedDialog === dialog && (now - this.lastProcessedTime) < this.cfg.dedupeWindowMs) return;

        this.lastProcessedDialog = dialog;
        this.lastProcessedTime = now;
        this.handle(barcode);
    }

    async handle(barcode) {
        try {
            console.info('开始处理错误弹窗逻辑......');
            this.isProcessing = true;

            //如果二次分拣页面没有打开
            if (!await isBRegistered()) {
                window.xAI.PublicSidePanelManager.showError('二次分拣页面没有打开.');
                return;
            }

            const latest = await api.findLatestOrderByProductBarcode(barcode, '1', '1');
            if (!latest?.pickingCode) {
                window.xAI.PublicSidePanelManager.showError(`条码：${barcode}， 没有一票一件多个订单,扫描下一个.`);
                return;
            }


            // 发消息到 B（这里仍用你旧的字段名示范；你也可以改回真实业务字段）
            const {message, data} = await routeToBNoWait({productBarcode: barcode, pickingCode: latest.pickingCode});
            console.info('---------------二次分拣打印页面数据:' + data);
            //显示二次分拣页面的业务处理数据
            window.xAI.PublicSidePanelManager.showProductRow(data);
        } catch (e) {

            //显示二次分拣页面处理这边发过去的数据有问题
            const msg = String(e?.message || e);
            window.xAI.PublicSidePanelManager.showError(msg);
        } finally {
            const input = document.querySelector(this.cfg.productBarcodeSelector);
            if (input) {
                input.focus();   // 获得焦点
                input.select();  // 全选内容
            }
            this.isProcessing = false;
        }
    }
}

async function isBRegistered() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { type: 'CHECK_B_REGISTERED' },
            (resp) => {
                if (chrome.runtime.lastError) {
                    console.warn('检查 B 注册状态失败:', chrome.runtime.lastError.message);
                    resolve(false);
                } else {
                    resolve(resp?.registered === true);
                }
            }
        );
    });
}

try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new ErrorPromptEventInterceptor());
    } else {
        new ErrorPromptEventInterceptor();
    }
} catch (e) {
    log.error('sku-trigger 初始化失败：', e);
    window.xAI.PublicSidePanelManager.showProductRow(`sku-trigger 初始化失败：${e?.message || e}`);
}
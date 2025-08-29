/**
 * sku-trigger.js
 * --------------------------
 * 监听错误弹窗，取 barcode，路由给 B。
 * UI 提示仍可用 PublicLabelManager，但所有关键路径都用 console.info 打印，避免静默。
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
    dedupeWindowMs: 1000,
    // 原来是 10000ms，过长会让你误以为“没任何提示”
    routeTimeoutMs: 1000 * 60 * 2
};

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

        chrome.runtime.sendMessage(
            {
                type: MSG.ROUTE_TO_ROLE,
                targetRole: ROLES.B,
                corrId,
                // 保持你旧版协议（发 BARCODE_REQUEST）
                payload: {type: MSG.BARCODE_REQUEST, data}
            },
            (resp) => {
                if (done) return;
                clearTimeout(timer);
                const lastErr = chrome.runtime.lastError?.message;
                console.info('[A] cb', {lastError: lastErr, resp});

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
                resolve({message:resp.message, data:resp.data});
            }
        );
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

        this.installResultListener();
        this.start();
    }

    installResultListener() {
        if (this._installed) return;
        this._installed = true;

        document.addEventListener('secondSortingResult', (event) => {
            const detail = event?.detail || {};
            if (detail.type === 'error') {
                console.info('[A] event:error', detail.message);
                window.xAI.PublicLabelManager.showError(detail.message || '二次分拣失败');
            } else {
                console.info('[A] event:info', detail.message);
                window.xAI.PublicLabelManager.showSuccess(detail.message || '二次分拣成功');
            }
        });

        log.info('二次分拣结果事件监听器已设置（A侧回显）。');
        window.xAI.PublicLabelManager.showInfo('已建立与二次分拣结果的联动');
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
        window.xAI.PublicLabelManager.showInfo('已启动 SKU 错误弹窗监听');
    }

    onNodeAdded(node) {
        const dialog = node.matches?.(this.cfg.dialogSelector) ? node : node.closest?.(this.cfg.dialogSelector);
        if (!dialog) return;

        const errEl = dialog.querySelector(this.cfg.errorMessageSelector);
        if (!errEl) return;

        const errorText = (errEl.textContent || '').trim();
        if (!errorText) return;

        const now = Date.now();
        if (this.isProcessing) return;
        if (this.lastProcessedDialog === dialog && (now - this.lastProcessedTime) < this.cfg.dedupeWindowMs) return;

        this.lastProcessedDialog = dialog;
        this.lastProcessedTime = now;
        this.handle(errorText);
    }

    async handle(errorText) {
        try {
            this.isProcessing = true;
            const input = document.querySelector(this.cfg.productBarcodeSelector);
            const barcode = input ? (input.value || '').trim() : '';
            if (barcode === '') {
                return;
            }
            if (!(errorText.startsWith(`产品代码${barcode}`) && errorText.endsWith('未找到匹配未完成的订单'))) {
                return;
            }

            console.info('[A] 当前条码：', barcode);

            const latest = await api.findLatestOrderByProductBarcode(barcode, '1', '1');
            if (!latest?.pickingCode) {
                window.xAI.PublicLabelManager.showSuccess(`条码：${barcode}， 没有一票一件多个订单,扫描下一个.`);
                return;
            }

            window.xAI.PublicLabelManager.showInfo(`条码：${barcode}， 有一票一件多个订单,正在打印.......`);

            // 发消息到 B（这里仍用你旧的字段名示范；你也可以改回真实业务字段）
            const {message, data} = await routeToBNoWait({productBarcode: barcode, pickingCode: latest.pickingCode});

            //显示二次分拣页面的业务处理数据
            window.xAI.PublicLabelManager.showSuccess(`${message} : ${data}`);
        } catch (e) {

            //显示二次分拣页面处理这边发过去的数据有问题
            const msg = String(e?.message || e);
            window.xAI.PublicLabelManager.showError(msg);
        } finally {
            this.isProcessing = false;
        }
    }
}

try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new ErrorPromptEventInterceptor());
    } else {
        new ErrorPromptEventInterceptor();
    }
} catch (e) {
    log.error('sku-trigger 初始化失败：', e);
    window.xAI.PublicLabelManager.showError(`sku-trigger 初始化失败：${e?.message || e}`);
}
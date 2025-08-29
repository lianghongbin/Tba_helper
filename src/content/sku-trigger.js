/**
 * sku-trigger.js
 * --------------------------
 * 监听错误弹窗，取 barcode，路由给 B。
 * UI 提示仍可用 PublicLabelManager，但所有关键路径都用 console.info 打印，避免静默。
 */

import { Logger } from '../common/logger.js';
import { MSG, ROLES, makeCorrId } from '../common/protocol.js';
import { ApiClient } from '../common/api-client.js';

const log = new Logger({ scope: 'sku-trigger' });
const api = new ApiClient();

/** 配置 */
const CONFIG = {
    dialogSelector: '.ui-dialog',
    errorMessageSelector: '.tip-error-message',
    productBarcodeSelector: '#productBarcode',
    dedupeWindowMs: 1000,
    // 原来是 10000ms，过长会让你误以为“没任何提示”
    routeTimeoutMs: 1000*60*2
};

/** 单次路由到 B（如果 B 不存在/已关闭/无响应，立即判定未就绪） */
function routeToBNoWait(data, timeout = CONFIG.routeTimeoutMs) {
    const corrId = makeCorrId();
    console.info('[A] routeToBNoWait -> send', { corrId, data });

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
                payload: { type: MSG.BARCODE_REQUEST, data }
            },
            (resp) => {
                if (done) return;
                clearTimeout(timer);
                const lastErr = chrome.runtime.lastError?.message;
                console.info('[A] cb', { lastError: lastErr, resp });

                // 通道错误或后台未回
                if (lastErr || resp == null) return fail(lastErr || 'empty resp');

                // 后台显式告知“没有目标 frame”
                if (resp.ok !== true) {
                    // 统一把“无目标/无响应”视为未启动（兼容旧后台的 no-response）
                    if (resp.reason === 'no-target-frames' || resp.reason === 'no-response') {
                        return fail(resp.reason);
                    }
                    // 其它业务失败，原样抛给上层
                    console.info('[A] B 业务失败 =>', resp.reason);
                    return reject(new Error(resp.reason || 'B 处理失败'));
                }

                console.info('[A] ok, data <- B', resp.data);
                done = true;
                resolve(resp.data);
            }
        );
    });
}

/** 主拦截器：沿用你旧版的弹窗监听流程，仅增强可见性日志 */
class ErrorPromptEventInterceptor {
    constructor(config = {}) {
        this.cfg = { ...CONFIG, ...config };
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
            } else {
                console.info('[A] event:info', detail.message);
            }
        });

        log.info('二次分拣结果事件监听器已设置（A侧回显）。');
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
        this.observer.observe(container, { childList: true, subtree: true });
        log.info('弹窗监听器已启动');
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

            // 同时打控制台，避免 PublicLabel 未注入导致看不到
            console.info('[A] 捕获错误弹窗：', errorText);

            const input = document.querySelector(this.cfg.productBarcodeSelector);
            const barcode = input ? (input.value || '').trim() : '';
            console.info('[A] 当前条码：', barcode);

            // 你的业务：查最新拣货单（如保留，这里不改）
            // const latest = await api.findLatestOrderByProductBarcode(barcode, '1', '1');
            // if (!latest?.pickingCode) {
            //   console.info('[A] 没有一票一件多个订单：', barcode);
            //   return;
            // }

            // 发消息到 B（这里仍用你旧的字段名示范；你也可以改回真实业务字段）
            const data = await routeToBNoWait({ productBarcode: barcode, pickingCode:'bb' });

            console.info('[A] 二次分拣处理完成');

        } catch (e) {
            const msg = String(e?.message || e);
            console.info('[A] 处理失败：', msg);

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
}
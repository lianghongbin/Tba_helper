/**
 * injector.js (最终版)
 * ----------------
 * 内容脚本入口，按路径识别角色并动态加载模块。
 * 只允许两个固定 iframe 参与通信：
 *   - A: iframe-container-103 （/shipment/orders-one-pack/list）
 *   - B: iframe-container-104 （/shipment/orders-pack/sorting）
 * 页面卸载时会发送 ROLE_BYE 主动注销。
 *
 * 新增：
 *   - 每 10 秒发 PING，刷新后台存活状态
 *   - 每 30 秒补发 ROLE_READY，确保 SW 重启后能恢复注册
 */

(function () {
    const isA = location.pathname.startsWith('/shipment/orders-one-pack/list');
    const isB = location.pathname.startsWith('/shipment/orders-pack/sorting');
    if (!isA && !isB) return;

    const A_IFRAME_ID = 'iframe-container-103';
    const B_IFRAME_ID = 'iframe-container-104';
    const fe = /** @type {HTMLIFrameElement|null} */ (window.frameElement || null);
    const iframeId = fe?.id || '';
    if ((isA && iframeId !== A_IFRAME_ID) || (isB && iframeId !== B_IFRAME_ID)) return;

    const protoURL = chrome.runtime.getURL('src/common/protocol.js');
    const loggerURL = chrome.runtime.getURL('src/common/logger.js');
    const publicSidePanel = chrome.runtime.getURL('src/common/public-side-panel.js');

    Promise.all([import(protoURL), import(loggerURL)])
        .then(async ([proto, commonLogger]) => {
            const MSG = proto.MSG;
            const ROLES = proto.ROLES;
            const Logger = commonLogger.Logger;
            const log = new Logger({ scope: 'injector' });

            const role = isA ? ROLES.A : ROLES.B;

            // === 首次注册 ===
            chrome.runtime.sendMessage({ type: MSG.ROLE_READY, role, iframeId }, async (res) => {
                log.info('[ROLE_READY:init]', role, iframeId, res);

                try {
                    if (role === ROLES.A) {
                        await import(publicSidePanel);
                        const url = chrome.runtime.getURL('src/content/sku-trigger.js');
                        await import(url);
                        log.info('sku-trigger module loaded');
                    } else if (role === ROLES.B) {
                        const url = chrome.runtime.getURL('src/content/second-sorting.js');
                        await import(url);
                        log.info('second-sorting module loaded');
                    }
                } catch (err) {
                    log.error('dynamic import failed:', err);
                }
            });

            // === 新增：每 10s PING ===
            setInterval(() => {
                try {
                    chrome.runtime.sendMessage({ type: 'PING' }, () => {});
                } catch (_) {}
            }, 10000);

            // === 新增：每 30s 补发 ROLE_READY ===
            setInterval(() => {
                try {
                    chrome.runtime.sendMessage({ type: MSG.ROLE_READY, role, iframeId }, (res) => {
                        log.info('[ROLE_READY:periodic]', role, iframeId, res);
                    });
                } catch (_) {}
            }, 60000);

            // === 卸载时注销 ===
            window.addEventListener('beforeunload', () => {
                try {
                    chrome.runtime.sendMessage({ type: 'ROLE_BYE', role, iframeId });
                } catch (_) {}
            });
        })
        .catch((err) => {
            console.error('injector bootstrap failed:', err);
        });
})();
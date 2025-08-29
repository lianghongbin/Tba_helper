/**
 * injector.js
 * ----------------
 * 内容脚本入口，按路径识别角色并动态加载模块。
 * 只允许两个固定 iframe 参与通信：
 *   - A: iframe-container-103（/shipment/orders-one-pack/list）
 *   - B: iframe-container-104（/shipment/orders-pack/sorting）
 * 页面卸载时会发送 ROLE_BYE 主动注销，避免后台残留僵尸条目。
 */

(function () {
    const isA = location.pathname.startsWith('/shipment/orders-one-pack/list');
    const isB = location.pathname.startsWith('/shipment/orders-pack/sorting');
    if (!isA && !isB) return;

    // 仅放行白名单 iframe
    const A_IFRAME_ID = 'iframe-container-103';
    const B_IFRAME_ID = 'iframe-container-104';
    const fe = /** @type {HTMLIFrameElement|null} */ (window.frameElement || null);
    const iframeId = fe?.id || '';
    if ((isA && iframeId !== A_IFRAME_ID) || (isB && iframeId !== B_IFRAME_ID)) return;

    const protoURL = chrome.runtime.getURL('src/common/protocol.js');
    const loggerURL = chrome.runtime.getURL('src/common/logger.js');
    const publicLabelURL = chrome.runtime.getURL('src/common/public-label.js');

    Promise.all([import(protoURL), import(loggerURL)])
        .then(async ([proto, commonLogger]) => {
            const MSG = proto.MSG;
            const ROLES = proto.ROLES;
            const Logger = commonLogger.Logger;
            const log = new Logger({ scope: 'injector' });

            const role = isA ? ROLES.A : ROLES.B;

            // 注册（带上 iframeId 做后台白名单校验）
            chrome.runtime.sendMessage({ type: MSG.ROLE_READY, role, iframeId }, async (res) => {
                log.info('[ROLE_READY]', role, iframeId, res);

                try {
                    if (role === ROLES.A) {
                        // A 需要先加载 PublicLabel
                        await import(publicLabelURL);
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

            // 卸载主动注销，避免后台残留
            window.addEventListener('beforeunload', () => {
                try {
                    chrome.runtime.sendMessage({ type: 'ROLE_BYE', role, iframeId });
                } catch (_) {}
            });
        })
        .catch((err) => {
            // 初始化失败不影响页面正常功能
            console.error('injector bootstrap failed:', err);
        });
})();
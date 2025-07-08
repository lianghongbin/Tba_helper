// iframe-content.js
(() => {
    // 1️⃣ 用 globalThis 兼容不同全局对象
    if (globalThis.__myIframeInjected) return;
    globalThis.__myIframeInjected = true;

    // 2️⃣ 也在 DOM 上打一个标记，双保险
    if (document.documentElement.hasAttribute('data-my-injected')) return;
    document.documentElement.setAttribute('data-my-injected', '');

    // 3️⃣ 业务逻辑……
    const badge = document.createElement('div');
    badge.textContent = '插件已注入 ✓';
    badge.style.cssText =
        'position:fixed;top:12px;right:16px;padding:4px 8px;' +
        'background:#ff5722;color:#fff;z-index:2147483647;';
    document.body.appendChild(badge);
})();
/**
 * sku-monitor.js
 * 功能：
 *   - 当 #productBarcode 输入框按下回车时，先清洗数据；
 *   - 当输入框失去焦点时（点击确认按钮或切换焦点），清洗数据；
 *   - 确认按钮的点击事件不再拦截，避免阻塞逻辑。
 */

/** 去除输入框内所有空白字符 */
function sanitizeInputValue(input) {
    if (!input || !input.value) return;
    const original = input.value.trim();
    const cleaned = original.replace(/\s+/g, '');
    if (original !== cleaned) {
        input.value = cleaned;
        console.info('[sku-monitor] cleaned:', { original, cleaned });
    }
}

/** 绑定监听：Enter + blur */
function setupSKUInputSanitizer(input) {
    if (!input) return;

    // 回车：输入框不会 blur，需要单独监听
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.isTrusted) {
            sanitizeInputValue(input); // 不要 await，保持同步
        }
    }, true); // 捕获阶段，确保在页面逻辑前执行

    // 失去焦点：点击按钮/切换焦点都会触发
    input.addEventListener('blur', () => {
        sanitizeInputValue(input); // 不要 await，避免阻塞 click
    });
}

/** 轮询查找元素并绑定（简洁稳定） */
function waitForElements() {
    const max = 5;
    let n = 0;
    const timer = setInterval(() => {
        const input = document.querySelector('#productBarcode');
        if (input) {
            clearInterval(timer);
            setupSKUInputSanitizer(input);
        } else if (n >= max) {
            clearInterval(timer);
        }
        n++;
    }, 100);
}

// DOM 就绪后启动；再立即尝试一次以防已就绪
window.addEventListener('DOMContentLoaded', waitForElements, { once: true });
waitForElements();
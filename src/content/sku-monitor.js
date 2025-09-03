/**
 * sku-monitor.js（原 barcode-monitor.js）
 * 简洁版：监听 #productBarcode 的 Enter 与确认按钮 click，
 * 在默认行为发生前先把条码里的所有空白清理掉，然后让页面原有流程继续执行。
 * 另外：在确认按钮旁新增一个“插件按钮”，点击时调用 handleExtraButtonClick()
 */

let _api = null;
async function getApi() {
    if (!_api) {
        const mod = await import(chrome.runtime.getURL('src/common/api-client.js'));
        _api = new mod.ApiClient();
    }
    return _api;
}

/** 去除输入框内所有空白字符 */
async function sanitizeInputValue(input) {
    if (!input || !input.value) return;
    const original = input.value.trim();

    const cleaned = original.replace(/\s+/g, '');
    if (original !== cleaned) {
        input.value = cleaned;
        console.info('[sku-monitor] cleaned:', { original, cleaned });
    }
}

/** 绑定监听：Enter（捕获阶段，先于页面逻辑执行），与确认按钮 click */
function setupSKUInputSanitizer(input, button) {
    if (!input) return;

    // Enter：先清理，再让默认回车/页面监听继续（不阻止默认）
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && e.isTrusted) {
            await sanitizeInputValue(input);
            // 不调用 preventDefault，让原流程继续
        }
    }); // 捕获阶段，确保清理发生在默认行为之前

    // Click：点击前清理输入值，再让页面原有点击逻辑继续
    if (button) {
        button.addEventListener('click', (e) => {
            sanitizeInputValue(input);
            // 不阻止点击，让原逻辑继续
        }); // 捕获阶段
    }
}

/** 轮询查找元素并绑定（简洁稳定） */
function waitForElements() {
    const max = 5;
    let n = 0;
    const timer = setInterval(() => {
        const input = document.querySelector('#productBarcode');
        const confirmBtn = document.querySelector('input.baseBtn.submitProduct');
        if (input) {
            clearInterval(timer);
            setupSKUInputSanitizer(input, confirmBtn);
        } else if (n >= max) {
            clearInterval(timer);
        }
        n++;
    }, 100);
}

// DOM 就绪后启动；再立即尝试一次以防已就绪
window.addEventListener('DOMContentLoaded', waitForElements, { once: true });
waitForElements();
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
function sanitizeInputValue(input) {
    if (!input || !input.value) return;

    console.info('监听到回车或确定按钮.');
    const pickingCodeEl = document.querySelector('#pickingCode');
    if (pickingCodeEl && pickingCodeEl.value.trim() ==='') {
        autoInputPickingCode(input, pickingCodeEl);
    }

    const original = input.value.trim();
    console.info(original);

    const cleaned = original.replace(/\s+/g, '');
    console.info(cleaned);
    if (original !== cleaned) {
        input.value = cleaned;
        console.info('[sku-monitor] cleaned:', { original, cleaned });
    }
}

/** 绑定监听：Enter（捕获阶段，先于页面逻辑执行），与确认按钮 click */
function setupSKUInputSanitizer(input, button) {
    if (!input) return;

    // Enter：先清理，再让默认回车/页面监听继续（不阻止默认）
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.isTrusted) {
            sanitizeInputValue(input);
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

/** [NEW] 额外按钮的点击处理（你可以在这里写任意业务逻辑） */
async function autoInputPickingCode(inputEl, pickingCodeEl) {
    // 示例：读取当前条码并展示
    const barcode = inputEl ? (inputEl.value || '').trim() : '';
    console.info('执行自动选择拣货单.');
    const api = await getApi();
    const latest = await api.findLatestOrderByProductBarcode(barcode, '1', '0');
    if (!latest?.pickingCode) {
        window.xAI.PublicSidePanelManager.showError(`没找到 ${barcode} 一票一件拣货单.`);
        pickingCodeEl.focus();
        return;
    }

    pickingCodeEl.value = latest?.pickingCode;
    inputEl.focus();
    inputEl.select();
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
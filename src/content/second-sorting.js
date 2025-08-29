/**
 * second-sorting.js (role-b)
 * ------------------------------
 * 接收 BARCODE_REQUEST 消息，自动化处理：
 * 1. 输入拣货码到表单。
 * 2. 点击提交按钮。
 * 3. 检查提交结果。
 * 4. 输入商品条码并触发回车。
 * 向发送方返回成功/失败状态。
 *
 * 说明：
 * - 使用简单的 DOM 操作直接设置输入框值，简化用户输入模拟。
 * - 从 second-sorting-old 迁移，适配当前文档 DOM 操作。
 * - 不依赖 ApiClient，减少模块依赖。
 */

import {Logger} from '../common/logger.js';
import {MSG} from '../common/protocol.js';

const log = new Logger({scope: 'second-sorting'});

// DOM 选择器
const SELECTORS = {
    INPUT: '#pickingCode',
    SUBMIT: '#submitPicking',
    PRODUCT_BARCODE: '#productBarcode',
    PRODUCT_BARCODE_HIDDEN: '#productBarcodeHidden',
    SUCCESS: '#submitPicking-message.success, #successToast',
    ERROR: '#submitPicking-message.error, #errorToast'
};

/**
 * 监听 BARCODE_REQUEST 消息，执行自动化流程并返回响应。
 * @param {Object} msg - 消息对象，包含 type, productBarcode, pickingCode。
 * @param {Object} sender - Chrome 运行时消息发送者。
 * @param {Function} sendResponse - 回调函数，用于发送响应。
 * @returns {boolean} - 返回 true 表示异步响应。
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type !== MSG.BARCODE_REQUEST) {
        return;
    }

    (async () => {
        try {
            const {productBarcode, pickingCode} = msg.payload || {};
            //设置 pickingCode
            await pickingCodeInput(pickingCode);

            //点击开始配货按钮
            await autoClickSubmitPicking();

            //检查开始配货有没有报错
            const result = await checkSubmitResult();
            if (!result) {
                //拣货单出错
                const message = document.querySelector('#submitPicking-message').textContent;
                console.log('拣货单配货出错:' + message);

                sendResponse({ok: false, reason: message, data: message});
                return;
            }

            //开始输入 barcode并确认打印
            await printProductBarcode(productBarcode);

            //这里要显示下面 SKU 的订单信息，要获取信息
            sendResponse({ok: true, message:'', data: ''});
        } catch (e) {
            log.error('处理失败:', e?.message || e);
            sendResponse({ok: false, reason: e?.message || String(e)});
        }
    })();

    return true; // 表示异步响应
});

/**
 * 直接设置输入框的值。
 * @param {string} selector - 输入框的 CSS 选择器。
 * @param {string} text - 要输入的文本。
 * @throws {Error} 如果未找到输入框。
 * @returns {void}
 */
function setInputValue(selector, text) {
    const el = document.querySelector(selector);
    if (!el) {
        throw new Error(`未找到输入框: ${selector}`);
    }
    el.value = text;
}

/**
 * 点击指定按钮。
 * @param {string} selector - 按钮的 CSS 选择器。
 * @throws {Error} 如果未找到按钮。
 * @returns {void}
 */
function clickButton(selector) {
    const btn = document.querySelector(selector);
    if (!btn) {
        throw new Error(`未找到按钮: ${selector}`);
    }
    btn.click();
}

/**
 * isVisible
 * ---------------------------------------------------------
 * 强制检查元素内容，不管它是否显示/隐藏：
 * 判断元素的文本是否以 "配货单{barcode}" 开头，并以 "不存在" 结尾。
 *
 * @param {HTMLElement} el - 要检查的元素
 * @param {string} barcode - 条码
 * @returns {boolean}
 */
function failShow() {
    const el = document.querySelector('#submitPicking-message');
    const text = (el.textContent || '').trim();

    return text !== '';
}

/**
 * 输入拣货码到表单。
 * @param {string} pickingCode - 拣货码。
 * @returns {Promise<void>}
 * @throws {Error} 如果输入失败。
 */
async function pickingCodeInput(pickingCode) {
    try {
        setInputValue(SELECTORS.INPUT, pickingCode);
        log.info('拣货码输入完成');
    } catch (e) {
        log.warn('设置拣货码失败', {error: e?.message || e});
        throw e;
    }
}

/**
 * 点击“开始配货”按钮。
 * @returns {Promise<void>}
 * @throws {Error} 如果点击失败。
 */
async function autoClickSubmitPicking() {
    try {
        clickButton(SELECTORS.SUBMIT);
        log.info('已点击开始配货按钮');
    } catch (e) {
        log.error('点击开始配货按钮失败', {error: e?.message || e});
        throw e;
    }
}

/**
 * 检查提交结果。
 * @returns {Promise<boolean>}
 */
async function checkSubmitResult() {
    return new Promise((resolve) => {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            console.log('failShow:' + failShow())
            // 如果 failShow() 条件满足，立即返回失败
            if (failShow()) {
                clearInterval(interval);
                resolve(false);
                return;
            }

            // 检查 2 次还没发现 failShow()，直接返回 not-found
            if (attempts >= 2) {
                clearInterval(interval);
                resolve(true);
            }
        }, 100);
    });
}

/**
 * 输入商品条码并触发回车。
 * @param {string} productBarcode - 商品条码。
 * @returns {Promise<void>}
 * @throws {Error} 如果条码输入或回车触发失败。
 */
async function printProductBarcode(productBarcode) {
    try {
        const input = document.querySelector(SELECTORS.PRODUCT_BARCODE);

        // 输入条码并触发回车
        setInputValue(SELECTORS.PRODUCT_BARCODE_HIDDEN, productBarcode);
        setInputValue(SELECTORS.PRODUCT_BARCODE, productBarcode);

        input.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'Enter',
            code: 'Enter',
            keyCode: 13
        }));

        log.info('商品条码输入并触发回车');
    } catch (e) {
        log.error('处理商品条码失败', {error: e?.message || e});
        throw e;
    }
}
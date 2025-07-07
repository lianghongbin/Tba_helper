/**
 * 状态标志
 */
let isInitialized = false;
let observer = null;
// ------- 顶部增加 --------
let menuCheckedToday = false;
let lastInitMenuLog   = 0;
/**
 * 设置 SKU 输入清理逻辑
 * @param {HTMLInputElement} input - SKU 输入框
 */
function setupSKUInputSanitizer(input) {
    // 防止重复添加监听器
    if (input.dataset.skuSanitizerAdded) return;
    input.dataset.skuSanitizerAdded = 'true';

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.isTrusted) {
            if (!input.value) return;

            const originalValue = input.value;
            const cleanedValue = originalValue.replace(/\s+/g, '');
            input.value = cleanedValue;

            e.preventDefault();

            const pickingInput = document.querySelector('#pickingCode');
            const pickingNo = pickingInput ? pickingInput.value.replace(/\s+/g, '') : '';

            if (!pickingNo) {
                console.log('picking_no 为空，跳过 IndexedDB 查询');
                triggerEnter(input);
                return;
            }

            chrome.runtime.sendMessage(
                { action: 'getSkuCodesByPickingNo', picking_no: pickingNo, sku_code: cleanedValue },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('getSkuCodesByPickingNo 消息发送错误:', chrome.runtime.lastError.message);
                        triggerEnter(input);
                        return;
                    }
                    if (response && response.sku_code) {
                        console.log(`找到匹配的 sku_code: ${response.sku_code} for picking_no: ${pickingNo}`);
                        input.value = response.sku_code;
                    } else {
                        console.log(`未找到匹配的 sku_code for picking_no: ${pickingNo}, sku_code: ${cleanedValue}`);
                    }
                    triggerEnter(input);
                }
            );
        }
    });
}

/**
 * 触发 Enter 事件
 * @param {HTMLInputElement} input - 输入框
 */
function triggerEnter(input) {
    const form = input.closest('form');
    if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true }));
    } else {
        const event = new KeyboardEvent('keypress', {
            key: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
        });
        input.dispatchEvent(event);
    }
}

/**
 * 初始化输入处理程序
 * @returns {boolean} 是否成功初始化
 */
function initializeInputHandlers() {
    const input = document.querySelector('#productBarcode');
    const pickingInput = document.querySelector('#pickingCode');

    if (input && pickingInput) {
        console.log('初始化输入处理程序');
        setupSKUInputSanitizer(input);
        return true;
    }
    return false;
}

/**
 * 初始化出货管理菜单处理
 * @returns {boolean} 是否找到出货管理菜单
 */
function initializeShipmentMenuHandler() {
    // --- 简单去抖：3 秒内不重复打日志 ---
    if (Date.now() - lastInitMenuLog < 6000) return false;
    lastInitMenuLog = Date.now();

    console.log('开始执行 initializeShipmentMenuHandler......');
    const menuItems = document.querySelectorAll('li a');
    const menuElement = Array.from(menuItems).find(a => a.textContent.trim() === '出货管理');
    if (menuElement) {
        console.log('检测到"出货管理"菜单');
        chrome.runtime.sendMessage({ action: 'checkFetchStatus' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('checkFetchStatus 消息发送错误:', chrome.runtime.lastError.message);
                return;
            }
            const today = getCurrentDate();
            console.log('checkFetchStatus 响应:', response);
            if (!response || !response.hasFetched || response.lastFetchDate !== today || !response.completed) {
                console.log('触发 fetchShipmentData');
                chrome.runtime.sendMessage({ action: 'fetchShipmentData' }, (fetchResponse) => {
                    if (chrome.runtime.lastError) {
                        console.error('fetchShipmentData 消息发送错误:', chrome.runtime.lastError.message);
                    } else {
                        console.log('fetchShipmentData 响应:', fetchResponse);
                    }
                });
            } else {
                console.log('当天 fetchShipmentData 已完成，跳过');
            }
        });
        return true;
    }
    return false;
}

/**
 * 获取当前日期
 * @returns {string} 格式化日期（YYYY-MM-DD）
 */
function getCurrentDate() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/**
 * 设置 DOM 观察器
 */
function setupObservers() {
    if (observer) {
        console.log('观察器已存在，跳过初始化');
        return;
    }

    observer = new MutationObserver(() => {
        console.log('DOM 变化检测');
        const inputsReady = initializeInputHandlers();
        const menuReady = initializeShipmentMenuHandler();

        if (inputsReady && menuReady) {
            console.log('所有目标元素已初始化，断开观察器');
            if (observer) {
                observer.disconnect();
                observer = null;
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    console.log('观察器已启动');
}

/**
 * 处理 SPA 路由变化
 */
function handleRouteChange() {
    console.log('检测到路由变化');
    isInitialized = false;
    setupObservers();
    initializeInputHandlers();
    initializeShipmentMenuHandler();
}

/**
 * 设置 SPA 路由监听
 */
function setupSPAListener() {
    window.addEventListener('popstate', handleRouteChange);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
        originalPushState.apply(this, args);
        handleRouteChange();
    };

    history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        handleRouteChange();
    };
}

/**
 * 初始化扩展
 */
function init() {
    if (isInitialized) {
        console.log('扩展已初始化，跳过');
        return;
    }
    isInitialized = true;

    console.log('扩展初始化');
    setupSPAListener();

    const inputsReady = initializeInputHandlers();
    const menuReady = initializeShipmentMenuHandler();

    if (!inputsReady || !menuReady) {
        setupObservers();
    }
}

// 启动扩展
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
} else {
    document.addEventListener('DOMContentLoaded', init);
}
// 状态标志
let isInitialized = false;
let inputObserver = null;
let menuObserver = null;

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

function initializeInputHandlers() {
    const input = document.querySelector('#productBarcode');
    const pickingInput = document.querySelector('#pickingCode');

    if (input && pickingInput) {
        console.log('初始化输入处理程序');
        setupSKUInputSanitizer(input);

        // 停止观察输入元素（如果已经找到）
        if (inputObserver) {
            inputObserver.disconnect();
            inputObserver = null;
        }
        return true;
    }
    return false;
}

function initializeShipmentMenuHandler() {
    const menuItems = document.querySelectorAll('li a');
    const menuElement = Array.from(menuItems).find(a => a.textContent.trim() === '出货管理');
    if (menuElement) {
        chrome.runtime.sendMessage({ action: 'checkFetchStatus' }, (response) => {
            const today = getCurrentDate();
            if (!response || !response.hasFetched || response.lastFetchDate !== today || !response.completed) {
                console.log('检测到"出货管理"菜单，触发 fetchShipmentData');
                chrome.runtime.sendMessage({ action: 'fetchShipmentData' });
            } else {
                console.log('当天 fetchShipmentData 已完成，跳过');
            }

            // 停止观察菜单元素（如果已经找到）
            if (menuObserver) {
                menuObserver.disconnect();
                menuObserver = null;
            }
        });
        return true;
    }
    return false;
}

function getCurrentDate() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function setupObservers() {
    // 设置输入元素观察器
    if (!inputObserver) {
        inputObserver = new MutationObserver((mutations) => {
            if (initializeInputHandlers()) {
                inputObserver.disconnect();
            }
        });
        inputObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 设置菜单观察器
    if (!menuObserver) {
        menuObserver = new MutationObserver((mutations) => {
            if (initializeShipmentMenuHandler()) {
                menuObserver.disconnect();
            }
        });
        menuObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

function handleRouteChange() {
    // 重置初始化状态
    isInitialized = false;

    // 重新设置观察器
    setupObservers();

    // 立即尝试初始化
    initializeInputHandlers();
    initializeShipmentMenuHandler();
}

// SPA路由变化检测（根据实际框架调整）
function setupSPAListener() {
    // 方法1: 监听popstate事件（适用于基于hash的路由）
    window.addEventListener('popstate', handleRouteChange);

    // 方法2: 监听pushState/replaceState（需要重写方法）
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function() {
        originalPushState.apply(this, arguments);
        handleRouteChange();
    };

    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        handleRouteChange();
    };

    // 方法3: 针对特定框架的检测（如Angular、React、Vue等）
    // 这里需要根据实际使用的框架进行调整
}

function init() {
    if (isInitialized) return;
    isInitialized = true;

    console.log('扩展初始化');

    // 设置SPA监听
    setupSPAListener();

    // 初始检查
    const inputsReady = initializeInputHandlers();
    const menuReady = initializeShipmentMenuHandler();

    // 如果元素不存在，设置观察器
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
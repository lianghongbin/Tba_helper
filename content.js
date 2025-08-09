/**
 * TBA FixKing Chrome Extension
 * 自动修正SKU代码，提升仓库管理效率
 */

// 全局变量
let isInitialized = false;
let observer = null;
let lastInitMenuLog = 0;
let dailyFetchChecked = false; // 跟踪当天是否已检查过fetchPickings

/**
 * 安全的工具函数获取
 * @param {string} functionName - 函数名
 * @param {Function} fallback - 备用函数
 * @returns {Function} 安全的函数
 */
function safeGetFunction(functionName, fallback) {
    try {
        if (typeof Utils !== 'undefined' && typeof Utils[functionName] === 'function') {
            return Utils[functionName];
        }
        if (typeof window.Utils !== 'undefined' && typeof window.Utils[functionName] === 'function') {
            return window.Utils[functionName];
        }
        console.warn(`${functionName} 函数不可用，使用备用函数`);
        return fallback;
    } catch (error) {
        console.warn(`获取 ${functionName} 函数失败:`, error);
        return fallback;
    }
}

/**
 * 安全的全局对象检查
 * @param {string} objectName - 对象名
 * @param {boolean} useNamespace - 是否使用 xAI 命名空间
 * @returns {boolean} 对象是否可用
 */
function isGlobalObjectAvailable(objectName, useNamespace = false) {
    try {
        if (useNamespace) {
            return typeof window.xAI !== 'undefined' && typeof window.xAI[objectName] !== 'undefined' && window.xAI[objectName] !== null;
        }
        return typeof window[objectName] !== 'undefined' && window[objectName] !== null;
    } catch (error) {
        console.warn(`检查全局对象 ${objectName} 失败:`, error);
        return false;
    }
}

/**
 * 安全的Chrome扩展消息发送函数
 * @param {Object} message - 要发送的消息
 * @param {Function} callback - 回调函数
 */
function safeSendMessage(message, callback) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        console.warn('Chrome扩展API不可用');
        if (callback) callback(null);
        return;
    }

    try {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Chrome扩展消息发送错误:', chrome.runtime.lastError);
                if (callback) callback(null);
                return;
            }
            if (callback) callback(response);
        });
    } catch (error) {
        console.error('发送消息时发生错误:', error);
        if (callback) callback(null);
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

        // 安全地初始化拣货单选择器
        if (isGlobalObjectAvailable('PickingCodeInitializer')) {
            try {
                if (!window.PickingCodeInitializer.isInitialized()) {
                    console.log('拣货单选择器未初始化，开始初始化');
                    window.PickingCodeInitializer.initializePickingCodeSelector();
                } else {
                    console.log('拣货单选择器已初始化，跳过重复初始化');
                }
            } catch (error) {
                console.error('初始化拣货单选择器失败:', error);
            }
        } else {
            console.warn('PickingCodeInitializer 不可用，将在1秒后重试');
            setTimeout(() => {
                if (isGlobalObjectAvailable('PickingCodeInitializer')) {
                    try {
                        if (!window.PickingCodeInitializer.isInitialized()) {
                            console.log('重试：拣货单选择器未初始化，开始初始化');
                            window.PickingCodeInitializer.initializePickingCodeSelector();
                        }
                    } catch (error) {
                        console.error('重试：初始化拣货单选择器失败:', error);
                    }
                } else {
                    console.warn('重试：PickingCodeInitializer 仍然不可用');
                }
            }, 1000);
        }

        return true;
    }
    return false;
}

/**
 * 初始化出货管理菜单处理
 * @returns {boolean} 是否找到出货管理菜单
 */
function initializeShipmentMenuHandler() {
    // 简单去抖：6秒内不重复打日志
    if (Date.now() - lastInitMenuLog < 6000) return false;
    lastInitMenuLog = Date.now();

    console.log('开始执行 initializeShipmentMenuHandler......');
    const menuItems = document.querySelectorAll('li a');
    const menuElement = Array.from(menuItems).find(a => a.textContent.trim() === '出货管理');
    if (menuElement) {
        console.log('检测到"出货管理"菜单');

        // 只在启动时检查一次，不重复检查
        const today = safeGetFunction('getCurrentDate', () => new Date().toISOString().split('T')[0])();
        const lastCheckDate = localStorage.getItem('tba_last_fetch_check_date');

        if (lastCheckDate !== today) {
            localStorage.setItem('tba_last_fetch_check_date', today);
            dailyFetchChecked = true;

            safeSendMessage({ action: 'checkFetchStatus' }, (response) => {
                console.log('checkFetchStatus 响应:', response);
                if (!response || !response.hasFetched || response.lastFetchDate !== today || !response.completed) {
                    console.log('触发 fetchPickings');
                    safeSendMessage({ action: 'fetchPickings' }, (fetchResponse) => {
                        console.log('fetchPickings 响应:', fetchResponse);
                    });
                } else {
                    console.log('当天 fetchPickings 已完成，跳过');
                }
            });
        } else {
            console.log('当天已检查过fetchPickings，跳过');
        }
        return true;
    }
    return false;
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

        let menuReady = false;
        if (!dailyFetchChecked) {
            menuReady = initializeShipmentMenuHandler();
        } else {
            const menuItems = document.querySelectorAll('li a');
            const menuElement = Array.from(menuItems).find(a => a.textContent.trim() === '出货管理');
            menuReady = !!menuElement;
        }

        if (inputsReady && menuReady) {
            console.log('所有目标元素已初始化，断开观察器');
            if (observer) {
                observer.disconnect();
                observer = null;
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
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
    modifyBatchPackDisplayLogic();

    onJQueryReady(() => {
        safeJQueryOperation(
            () => {
                overrideBatchPackHideLogic();
                interceptBatchPackLogic();
            },
            () => {
                nativeBatchPackLogic();
            }
        );
    });
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
 * 设置批量打包显示逻辑
 */
function modifyBatchPackDisplayLogic() {
    // 空实现，假设由其他函数处理
}

/**
 * 覆盖批量打包隐藏逻辑
 */
function overrideBatchPackHideLogic() {
    // 空实现，假设由 jQuery 处理
}

/**
 * 拦截批量打包逻辑
 */
function interceptBatchPackLogic() {
    // 空实现，假设由 jQuery 处理
}

/**
 * 设置批量打包观察器
 */
function setupBatchPackObserver() {
    const batchPackObserver = new MutationObserver(() => {
        console.log('批量打包区域变化');
    });
    const batchPackDiv = document.querySelector('#batchPackDiv');
    if (batchPackDiv) {
        batchPackObserver.observe(batchPackDiv, {
            attributes: true,
            attributeFilter: ['style']
        });
    }
}

/**
 * 检查jQuery是否可用
 * @returns {boolean}
 */
function isJQueryAvailable() {
    try {
        return typeof $ !== 'undefined' && $.fn && $.fn.jquery;
    } catch (error) {
        console.warn('检查jQuery可用性时发生错误:', error);
        return false;
    }
}

/**
 * 监听jQuery加载完成
 * @param {Function} callback - 回调函数
 */
function onJQueryReady(callback) {
    if (isJQueryAvailable()) {
        callback();
        return;
    }

    setTimeout(() => {
        if (isJQueryAvailable()) {
            callback();
        } else {
            console.log('jQuery不可用，使用降级方案');
            callback();
        }
    }, 1000);
}

/**
 * 安全的jQuery操作封装
 * @param {Function} jqueryOperation - jQuery操作函数
 * @param {Function} fallbackOperation - 降级操作函数
 */
function safeJQueryOperation(jqueryOperation, fallbackOperation) {
    if (isJQueryAvailable()) {
        try {
            jqueryOperation();
        } catch (error) {
            console.error('jQuery操作失败:', error);
            if (fallbackOperation) {
                try {
                    fallbackOperation();
                } catch (fallbackError) {
                    console.error('降级操作也失败:', fallbackError);
                }
            }
        }
    } else {
        if (fallbackOperation) {
            try {
                fallbackOperation();
            } catch (fallbackError) {
                console.error('降级操作失败:', fallbackError);
            }
        }
    }
}

/**
 * 原生JavaScript实现的批量打包逻辑
 */
function nativeBatchPackLogic() {
    console.log('使用原生JavaScript实现批量打包逻辑');

    setInterval(() => {
        const batchPackDiv = document.querySelector('#batchPackDiv');
        if (batchPackDiv) {
            const qtyInput = batchPackDiv.querySelector('#batchPackQty');
            if (qtyInput) {
                const qty = parseInt(qtyInput.getAttribute('qty') || qtyInput.value || 0);
                if (qty > 0 && batchPackDiv.style.display === 'none') {
                    console.log(`原生JS：强制显示批量打包区域，当前数量: ${qty}`);
                    batchPackDiv.style.display = 'block';
                }
            }
        }
    }, 1000);
}

/**
 * 安全的初始化函数
 */
function safeInit() {
    try {
        init();
    } catch (error) {
        console.error('扩展初始化失败:', error);
        setTimeout(() => {
            try {
                console.log('尝试重新初始化扩展...');
                init();
            } catch (retryError) {
                console.error('重新初始化也失败:', retryError);
            }
        }, 2000);
    }
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

    // 检查是否需要重置每日检查状态
    const today = safeGetFunction('getCurrentDate', () => new Date().toISOString().split('T')[0])();
    const lastCheckDate = localStorage.getItem('tba_last_fetch_check_date');
    if (lastCheckDate !== today) {
        dailyFetchChecked = false;
        console.log('新的一天，重置fetchPickings检查状态');
    } else {
        dailyFetchChecked = true;
        console.log('当天已检查过fetchPickings，跳过启动检查');
    }

    setupSPAListener();
    const inputsReady = initializeInputHandlers();
    const menuReady = initializeShipmentMenuHandler();
    if (!inputsReady || !menuReady) {
        setupObservers();
    }
    setupBatchPackObserver();
}

// 启动扩展
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    safeInit();
} else {
    document.addEventListener('DOMContentLoaded', safeInit);
}

// 全局测试函数，可在控制台中直接调用
window.testTBAHelper = {
    checkDependencies: () => {
        console.log('🔍 检查扩展依赖状态...');
        const dependencies = {
            Utils: typeof Utils !== 'undefined',
            PickingCodeInitializer: isGlobalObjectAvailable('PickingCodeInitializer'),
            ErrorPromptEventInterceptor: isGlobalObjectAvailable('ErrorPromptEventInterceptor', true), // 使用 xAI 命名空间
            PublicLabelManager: isGlobalObjectAvailable('PublicLabelManager', true),
            jQuery: isJQueryAvailable(),
            ChromeAPI: typeof chrome !== 'undefined' && chrome.runtime
        };

        console.log('📋 依赖状态:', dependencies);

        const missingDeps = Object.entries(dependencies)
            .filter(([name, available]) => !available)
            .map(([name]) => name);

        if (missingDeps.length > 0) {
            console.warn('⚠️ 缺失的依赖:', missingDeps);
        } else {
            console.log('✅ 所有依赖都可用');
        }

        return dependencies;
    },
    resetDailyCheck: () => {
        dailyFetchChecked = false;
        localStorage.removeItem('tba_last_fetch_check_date');
        console.log('已重置每日检查状态');
    },
    getDailyCheckStatus: () => {
        const today = safeGetFunction('getCurrentDate', () => new Date().toISOString().split('T')[0])();
        const lastCheckDate = localStorage.getItem('tba_last_fetch_check_date');
        return {
            today,
            lastCheckDate,
            dailyFetchChecked,
            isCheckedToday: lastCheckDate === today && dailyFetchChecked
        };
    },
    viewData: () => {
        console.log('开始查看IndexedDB数据...');
        safeSendMessage({ action: 'getAllPickingDetails' }, (resp) => {
            console.log('getAllPickingDetails 响应:', resp);
            if (resp && resp.data && Array.isArray(resp.data) && resp.data.length > 0) {
                console.log('📊 IndexedDB数据:', resp.data);
                console.log(`📈 共 ${resp.data.length} 条拣货单记录`);
                resp.data.forEach((item, index) => {
                    console.log(`\n📋 拣货单 ${index + 1}: ${item.picking_no}`);
                    if (item.sku_code && item.sku_code.length > 0) {
                        console.log(`   SKU数量: ${item.sku_code.length}`);
                        console.log(`   SKU列表:`, item.sku_code);
                    } else {
                        console.log(`   暂无SKU数据`);
                    }
                });
            } else if (resp && resp.data && Array.isArray(resp.data) && resp.data.length === 0) {
                console.log('📭 暂无数据，请先抓取发货数据');
            } else if (resp && resp.error) {
                console.log(`❌ 加载数据失败: ${resp.error}`);
            } else {
                console.log('❌ 没有找到数据或数据为空');
                console.log('响应详情:', resp);
            }
        });
    },
    fetchData: () => {
        console.log('开始抓取发货数据...');
        safeSendMessage({ action: 'fetchPickings' }, (resp) => {
            if (resp && resp.status === 'success') {
                const dataCount = resp.dataCount || 0;
                console.log(`✅ 抓取发货数据成功！共抓取 ${dataCount} 条数据`);
            } else {
                const errorMsg = resp && resp.error ? resp.error : '未知错误';
                console.log(`❌ 抓取发货数据失败: ${errorMsg}`);
            }
        });
    },
    clearData: () => {
        safeSendMessage({ action: 'resetFetchStatus' }, (resp) => {
            if (resp?.ok) {
                console.log('✅ 数据已清除');
            } else {
                console.log('❌ 清除数据失败');
            }
        });
    },
    checkDBStatus: () => {
        console.log('检查IndexedDB状态...');
        safeSendMessage({ action: 'getAllPickingDetails' }, (resp) => {
            console.log('IndexedDB状态检查结果:', resp);
            if (resp && resp.data) {
                console.log(`数据库中有 ${resp.data.length} 条记录`);
                if (resp.data.length > 0) {
                    console.log('第一条记录示例:', resp.data[0]);
                }
            } else {
                console.log('数据库为空或访问失败');
            }
        });
    },
    testAPI: () => {
        console.log('测试API请求...');
        const today = safeGetFunction('getCurrentDate', () => new Date().toISOString().split('T')[0])();
        console.log('当前日期:', today);

        const url = 'http://yzt.wms.yunwms.com/shipment/picking/list/page/1/pageSize/200';
        const params = new URLSearchParams({ dateFor: today });

        console.log('请求URL:', url);
        console.log('请求参数:', params.toString());

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: params.toString(),
            credentials: 'include'
        })
            .then(response => {
                console.log('API响应状态:', response.status);
                return response.json();
            })
            .then(json => {
                console.log('API响应数据:', json);
                if (json.data && Array.isArray(json.data)) {
                    console.log('拣货单数量:', json.data.length);
                    console.log('拣货单列表:', json.data.map(item => item.E2));
                }
            })
            .catch(error => {
                console.error('API请求失败:', error);
            });
    }
};
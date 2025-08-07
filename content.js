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
 * 安全的Chrome扩展消息发送函数
 * @param {Object} message - 要发送的消息
 * @param {Function} callback - 回调函数
 */
function safeSendMessage(message, callback) {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        if (callback) callback(null);
        return;
    }
    
    try {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                if (callback) callback(null);
                return;
            }
            if (callback) callback(response);
        });
    } catch (error) {
        if (callback) callback(null);
    }
}

/**
 * 检查扩展状态
 */
function checkExtensionStatus() {
    try {
        return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    } catch (error) {
        return false;
    }
}

/**
 * 状态标志
 */
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

            safeSendMessage(
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
        
        // 初始化拣货单选择器
        initializePickingCodeSelector();
        
        return true;
    }
    return false;
}

/**
 * 检测当前是否为按SKU打包页面
 * @returns {boolean} 是否为按SKU打包页面
 */
function isSkuPackPage() {
    // 检测URL中的quick参数
    const urlParams = new URLSearchParams(window.location.search);
    const quickParam = urlParams.get('quick');
    
    // 检测页面标题或菜单项
    const skuPackLink = document.querySelector('a[onclick*="按SKU打包"]');
    const isSkuPackPage = skuPackLink && skuPackLink.classList.contains('active');
    
    return quickParam === '103' || isSkuPackPage;
}

/**
 * 检测当前是否为二次分拣页面
 * @returns {boolean} 是否为二次分拣页面
 */
function isSortingPage() {
    // 检测URL中的quick参数
    const urlParams = new URLSearchParams(window.location.search);
    const quickParam = urlParams.get('quick');
    
    // 检测页面标题或菜单项
    const sortingLink = document.querySelector('a[onclick*="二次分拣"]');
    const isSortingPage = sortingLink && sortingLink.classList.contains('active');
    
    return quickParam === '104' || isSortingPage;
}

/**
 * 初始化拣货单选择器
 */
async function initializePickingCodeSelector() {
    console.log('初始化拣货单选择器...');
    
    // 检查是否已经初始化过
    if (window.pickingCodeSelectorInitialized) {
        console.log('拣货单选择器已经初始化过，跳过');
        return;
    }
    
    try {
        // 设置数据库对象
        PickingCodeSelector.setDatabase(Database);
        
        // 获取当前仓库ID和页面类型（使用带回退的方法）
        const warehouseId = await WarehouseManager.getWarehouseIdWithFallback();
        const isSkuPack = isSkuPackPage();
        const isSorting = isSortingPage(); // 新增：检测二次分拣页面
        console.log('当前仓库ID:', warehouseId, '是否按SKU打包页面:', isSkuPack, '是否二次分拣页面:', isSorting);
        
        // 初始化拣货单选择器，传递页面类型
        PickingCodeSelector.init(warehouseId, isSkuPack, isSorting);
        
        // 监听仓库变化
        WarehouseManager.onWarehouseChange(async (newWarehouseId) => {
            console.log('仓库发生变化，新仓库ID:', newWarehouseId);
            const currentIsSkuPack = isSkuPackPage();
            const currentIsSorting = isSortingPage();
            // 更新拣货单选择器
            PickingCodeSelector.init(newWarehouseId, currentIsSkuPack, currentIsSorting);
        });
        
        // 标记为已初始化
        window.pickingCodeSelectorInitialized = true;
        
        console.log('拣货单选择器初始化完成');
    } catch (error) {
        console.error('初始化拣货单选择器失败:', error);
    }
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
        
        // 只在启动时检查一次，不重复检查
        const today = getCurrentDate();
        const lastCheckDate = localStorage.getItem('tba_last_fetch_check_date');
        
        if (lastCheckDate !== today) {
            // 新的一天，检查一次
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

// 使用 utils.js 中的 getCurrentDate 函数
function getCurrentDate() {
    return Utils.getCurrentDate();
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
        
        // 只在未检查过的情况下调用菜单处理
        let menuReady = false;
        if (!dailyFetchChecked) {
            menuReady = initializeShipmentMenuHandler();
        } else {
            // 如果已经检查过，只检查菜单是否存在
            const menuItems = document.querySelectorAll('li a');
            const menuElement = Array.from(menuItems).find(a => a.textContent.trim() === '出货管理');
            menuReady = !!menuElement;
        }

        // 尝试创建错误提示Label
        createErrorLabel();

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
    createErrorLabel();
    setupDialogInterceptor();
    modifyBatchPackDisplayLogic();
    
    // 安全地执行jQuery相关操作
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
 * 创建错误提示Label
 */
function createErrorLabel() {
    const confirmBtn = document.querySelector('input[value="确认"].baseBtn.submitProduct');
    if (confirmBtn && !document.getElementById('custom-error-label')) {
        console.log('创建错误提示Label');
        const errorLabel = document.createElement('label');
        errorLabel.id = 'custom-error-label';
        errorLabel.className = 'custom-error-message';
        errorLabel.style.cssText = `
            color: #d32f2f;
            font-size: 18px;
            font-weight: bold;
            margin-left: 20px;
            display: none;
            vertical-align: middle;
            font-family: Arial, sans-serif;
        `;
        confirmBtn.parentNode.insertBefore(errorLabel, confirmBtn.nextSibling);
        console.log('错误提示Label创建完成');
    }
}

/**
 * 显示自定义错误信息
 */
function showCustomError(errorText) {
    const errorLabel = document.getElementById('custom-error-label');
    if (errorLabel) {
        errorLabel.textContent = errorText;
        errorLabel.style.display = 'inline';
        console.log('显示错误信息:', errorText);
    }
}

/**
 * 隐藏自定义错误信息
 */
function hideCustomError() {
    const errorLabel = document.getElementById('custom-error-label');
    if (errorLabel) {
        errorLabel.style.display = 'none';
        console.log('隐藏错误信息');
    }
}

/**
 * 测试错误提示Label（临时函数，用于调试）
 */
function testErrorLabel() {
    console.log('测试错误提示Label');
    createErrorLabel();
    setTimeout(() => {
        showCustomError('测试错误信息：产品代码:123456 未找到匹配未完成的订单');
    }, 1000);
}


/**
 * 设置弹框拦截器
 */
function setupDialogInterceptor() {
    console.log('设置弹框拦截器');
    // 使用定时器检查错误弹框，避免创建新的MutationObserver
    setInterval(() => {
        const errorDialog = document.querySelector('#dialog-auto-alert-tip');
        if (errorDialog) {
            const computedStyle = window.getComputedStyle(errorDialog);
            const isVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
            
            if (isVisible) {
                console.log('检测到错误弹框，开始拦截');
                handleErrorDialog(errorDialog);
            }
        }
    }, 500);
}

/**
 * 处理错误弹框
 */
function handleErrorDialog(dialog) {
    console.log('处理错误弹框');
    
    // 隐藏原弹框
    dialog.style.display = 'none';
    
    // 提取错误信息 - 尝试多种选择器
    let errorMessage = dialog.querySelector('.tip-error-message');
    if (!errorMessage) {
        errorMessage = dialog.querySelector('p span');
    }
    if (!errorMessage) {
        errorMessage = dialog.querySelector('p');
    }
    
    if (errorMessage) {
        const errorText = errorMessage.textContent.trim();
        console.log('提取的错误信息:', errorText);
        
        // 显示自定义错误信息
        showCustomError(errorText);
        
        // 保持输入框焦点和选中状态
        maintainInputFocus();
    } else {
        console.log('未找到错误信息元素，使用默认错误信息');
        showCustomError('产品代码未找到匹配未完成的订单');
        maintainInputFocus();
    }
}

/**
 * 保持输入框焦点和选中状态
 */
function maintainInputFocus() {
    const skuInput = document.querySelector('#productBarcode');
    if (skuInput) {
        // 确保输入框获得焦点
        skuInput.focus();
        
        // 选中输入框中的内容
        skuInput.select();
        
        console.log('保持SKU输入框焦点和选中状态');
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
    const today = getCurrentDate();
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

    // 创建错误提示Label
    createErrorLabel();

    // 设置弹框拦截器
    setupDialogInterceptor();



    // 修改批量打包按钮显示逻辑
    modifyBatchPackDisplayLogic();
    
    // 等待jQuery加载完成后执行相关操作
    onJQueryReady(() => {
        console.log('jQuery已就绪，开始执行批量打包逻辑');
        
        // 使用安全的jQuery操作
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



    if (!inputsReady || !menuReady) {
        setupObservers();
    }
}

/**
 * 修改批量打包按钮显示逻辑
 * 去掉 <=1 时隐藏批量打包按钮的功能
 */
function modifyBatchPackDisplayLogic() {
    console.log('修改批量打包按钮显示逻辑');
    
    // 检查当前页面是否已有批量打包区域
    const existingBatchPackDiv = document.querySelector('#batchPackDiv');
    if (existingBatchPackDiv) {
        console.log('页面已有批量打包区域，修改显示逻辑');
        modifyBatchPackVisibility(existingBatchPackDiv);
    }
    
    // 使用定时器定期检查批量打包区域
    setInterval(() => {
        const batchPackDiv = document.querySelector('#batchPackDiv');
        if (batchPackDiv) {
            modifyBatchPackVisibility(batchPackDiv);
        }
    }, 1000);
}

/**
 * 修改批量打包区域的可见性逻辑
 * @param {HTMLElement} batchPackDiv - 批量打包区域元素
 */
function modifyBatchPackVisibility(batchPackDiv) {
    // 获取数量输入框
    const qtyInput = batchPackDiv.querySelector('#batchPackQty');
    if (!qtyInput) return;

    // 监听数量变化
    const originalVal = qtyInput.value;
    const originalQty = qtyInput.getAttribute('qty');
    
    // 如果数量大于0，确保显示
    const currentQty = parseInt(originalQty || originalVal || 0);
    if (currentQty > 0) {
        batchPackDiv.style.display = 'block';
        console.log(`批量打包区域显示，当前数量: ${currentQty}`);
    }
}

/**
 * 重写原有的隐藏逻辑
 */
function overrideBatchPackHideLogic() {
    console.log('重写批量打包隐藏逻辑');
    
    // 使用可靠的jQuery检查
    if (!isJQueryAvailable()) {
        console.warn('jQuery不可用，跳过jQuery方法重写');
        return;
    }
    
    // 重写jQuery的hide方法，针对批量打包区域
    const originalHide = $.fn.hide;
    $.fn.hide = function() {
        // 检查是否是批量打包区域
        if (this.attr('id') === 'batchPackDiv') {
            const qtyInput = this.find('#batchPackQty');
            if (qtyInput.length > 0) {
                const qty = parseInt(qtyInput.attr('qty') || qtyInput.val() || 0);
                // 只有当数量为0时才隐藏
                if (qty > 0) {
                    console.log(`阻止隐藏批量打包区域，当前数量: ${qty}`);
                    return this; // 返回this以保持链式调用
                }
            }
        }
        // 其他元素正常隐藏
        return originalHide.apply(this, arguments);
    };
    
    console.log('批量打包隐藏逻辑重写完成');
}

/**
 * 拦截并修改原有的批量打包显示逻辑
 */
function interceptBatchPackLogic() {
    console.log('拦截批量打包显示逻辑');
    
    // 使用可靠的jQuery检查
    if (!isJQueryAvailable()) {
        console.warn('jQuery不可用，跳过jQuery方法重写');
        return;
    }
    
    // 重写原有的显示逻辑
    const originalShow = $.fn.show;
    $.fn.show = function() {
        // 检查是否是批量打包区域
        if (this.attr('id') === 'batchPackDiv') {
            console.log('显示批量打包区域');
        }
        return originalShow.apply(this, arguments);
    };
    
    // 监听批量打包区域的样式变化
    const batchPackObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const target = mutation.target;
                if (target.id === 'batchPackDiv') {
                    const qtyInput = target.querySelector('#batchPackQty');
                    if (qtyInput) {
                        const qty = parseInt(qtyInput.getAttribute('qty') || qtyInput.value || 0);
                        if (qty > 0 && target.style.display === 'none') {
                            console.log(`强制显示批量打包区域，当前数量: ${qty}`);
                            target.style.display = 'block';
                        }
                    }
                }
            }
        });
    });
    
    // 开始观察批量打包区域
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
    return typeof $ !== 'undefined' && $.fn && $.fn.jquery;
}

/**
 * 监听jQuery加载完成
 * @param {Function} callback - 回调函数
 */
function onJQueryReady(callback) {
    // 如果jQuery已经可用，直接执行
    if (isJQueryAvailable()) {
        callback();
        return;
    }
    
    // 延迟执行，给jQuery加载时间
    setTimeout(() => {
        if (isJQueryAvailable()) {
            callback();
        } else {
            // 如果jQuery仍然不可用，使用降级方案
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
            if (fallbackOperation) {
                fallbackOperation();
            }
        }
    } else {
        if (fallbackOperation) {
            fallbackOperation();
        }
    }
}

/**
 * 原生JavaScript实现的批量打包逻辑
 */
function nativeBatchPackLogic() {
    console.log('使用原生JavaScript实现批量打包逻辑');
    
    // 使用定时器定期检查批量打包区域
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

// 启动扩展
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
} else {
    document.addEventListener('DOMContentLoaded', init);
}

// 全局测试函数，可在控制台中直接调用
window.testTBAHelper = {
    testErrorLabel: testErrorLabel,
    showError: (text) => showCustomError(text || '测试错误信息'),
    hideError: hideCustomError,
    createLabel: createErrorLabel,
    resetDailyCheck: () => {
        dailyFetchChecked = false;
        localStorage.removeItem('tba_last_fetch_check_date');
        console.log('已重置每日检查状态');
    },
    getDailyCheckStatus: () => {
        const today = getCurrentDate();
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
        const today = new Date().toISOString().split('T')[0];
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
// Popup 页面工具函数

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
 * 计算数据统计信息
 * @param {Array} data - 拣货单数据数组
 * @returns {Object} 统计信息
 */
function calculateStats(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return {
            pickingCount: 0,
            totalSkuTypes: 0,
            totalSkuCount: 0,
            totalOrderCount: 0
        };
    }

    const pickingCount = data.length;
    const allSkus = new Set();
    let totalSkuCount = 0;
    let totalOrderCount = 0;

    data.forEach(item => {
        // 统计SKU编号（唯一的产品代码）
        if (item.order_details && Array.isArray(item.order_details)) {
            item.order_details.forEach(order => {
                if (order.product_code) {
                    allSkus.add(order.product_code);
                }
            });
        } else if (item.sku_code && Array.isArray(item.sku_code)) {
            // 备用方案：从sku_code数组统计
            item.sku_code.forEach(sku => {
                allSkus.add(sku);
            });
        }
        
        // 统计总SKU数量（所有订单的产品数量总和）
        if (item.product_total && item.product_total > 0) {
            const productTotal = parseInt(item.product_total) || 0;
            totalSkuCount += productTotal;
        } else if (item.order_details && Array.isArray(item.order_details)) {
            // 如果没有product_total，从订单详情中计算
            item.order_details.forEach(order => {
                const count = parseInt(order.count) || 1;
                totalSkuCount += count;
            });
        } else if (item.sku_details && Array.isArray(item.sku_details)) {
            // 备用方案：从sku_details中计算
            item.sku_details.forEach(sku => {
                const count = parseInt(sku.count) || 1;
                totalSkuCount += count;
            });
        }
        
        // 计算订单总数 - 优先使用拣货单列表中的order_total字段
        if (item.order_total && item.order_total > 0) {
            const orderTotal = parseInt(item.order_total) || 0;
            totalOrderCount += orderTotal;
        } else if (item.order_details && Array.isArray(item.order_details)) {
            // 备用方案：从订单详情中统计
            totalOrderCount += item.order_details.length;
        } else if (item.total_count) {
            const totalCount = parseInt(item.total_count) || 0;
            totalOrderCount += totalCount;
        } else if (item.sku_details && Array.isArray(item.sku_details)) {
            totalOrderCount += item.sku_details.reduce((sum, sku) => sum + (parseInt(sku.count) || 0), 0);
        }
    });

    const totalSkuTypes = allSkus.size;
    
    return {
        pickingCount,
        totalSkuTypes,
        totalSkuCount,
        totalOrderCount
    };
}

/**
 * 显示统计信息
 * @param {Object} stats - 统计信息对象
 */
function displayStats(stats) {
    const pickingCount = document.getElementById('pickingCount');
    const totalSkuTypes = document.getElementById('totalSkuTypes');
    const totalSkuCount = document.getElementById('totalSkuCount');
    const totalOrderCount = document.getElementById('totalOrderCount');
    const statsInfo = document.getElementById('statsInfo');

    if (pickingCount && totalSkuTypes && totalSkuCount && totalOrderCount && statsInfo) {
        pickingCount.textContent = stats.pickingCount;
        totalSkuTypes.textContent = stats.totalSkuTypes;
        totalSkuCount.textContent = stats.totalSkuCount;
        totalOrderCount.textContent = stats.totalOrderCount;
        statsInfo.style.display = 'block';
    }
}

/**
 * 隐藏统计信息
 */
function hideStats() {
    const statsInfo = document.getElementById('statsInfo');
    if (statsInfo) {
        statsInfo.style.display = 'none';
    }
}

/**
 * 判断捡货单类型
 * @param {Object} item - 捡货单数据
 * @returns {string} 捡货单类型
 */
function getPickingType(item) {
    // 优先使用保存的拣货类型名称
    if (item.picking_type_name) {
        return item.picking_type_name;
    }
    
    // 如果没有保存的拣货类型名称，则根据SKU数量和订单数量判断
    if (!item.sku_code || !Array.isArray(item.sku_code)) {
        return '未知';
    }
    
    const skuCount = item.sku_code.length;
    const orderCount = item.order_total || item.total_count || 0;
    
    if (skuCount === 1 && orderCount === 1) {
        return '一票一件';
    } else if (skuCount === 1 && orderCount > 1) {
        return '一票多件';
    } else if (skuCount > 1) {
        return '一票多件多个';
    } else {
        return '未知';
    }
} 
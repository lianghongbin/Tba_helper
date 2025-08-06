// Popup 页面事件处理模块

/**
 * 初始化事件监听器
 */
function initializeEventListeners() {
    const fetchBtn = document.getElementById('fetchBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const info = document.getElementById('msg');

    if (!fetchBtn || !clearAllBtn || !info) {
        console.error('无法找到必要的DOM元素');
        return;
    }

    // 抓取发货数据
    fetchBtn.addEventListener('click', () => {
        fetchBtn.disabled = true;
        fetchBtn.textContent = '⏳ 抓取中...';
        info.textContent = '正在抓取发货数据，请稍候...';
        info.className = 'loading';

        safeSendMessage({ action: 'fetchPackings' }, (resp) => {
            console.log('抓取数据响应:', resp);
            
            if (resp && resp.status === 'success') {
                const dataCount = resp.dataCount || 0;
                info.textContent = `✅ 抓取发货数据成功！共抓取 ${dataCount} 条数据`;
                info.className = '';
                
                // 抓取成功后自动显示统计信息
                safeSendMessage({ action: 'getAllPickingDetails' }, (dataResp) => {
                    if (dataResp && dataResp.data && Array.isArray(dataResp.data)) {
                        const stats = calculateStats(dataResp.data);
                        displayStats(stats);
                    }
                });
            } else {
                const errorMsg = resp && resp.error ? resp.error : '未知错误';
                console.error('抓取数据失败:', errorMsg);
                info.textContent = `❌ 抓取发货数据失败: ${errorMsg}`;
                info.className = 'error';
            }
            fetchBtn.disabled = false;
            fetchBtn.textContent = '📥 抓取发货数据';
        });
    });



    // 清除所有数据
    clearAllBtn.addEventListener('click', () => {
        if (confirm('确定要清除所有数据吗？这将删除所有拣货单和SKU数据。')) {
            clearAllBtn.disabled = true;
            clearAllBtn.textContent = '⏳ 清除中...';
            info.textContent = '正在清除所有数据...';
            info.className = 'loading';

            safeSendMessage({ action: 'clearAllData' }, (resp) => {
                if (resp?.ok) {
                    info.textContent = '✅ 所有数据已清除';
                    info.className = '';
                    hideDataContainer();
                    hideStats();
                } else {
                    const errorMsg = resp && resp.error ? resp.error : '未知错误';
                    info.textContent = `❌ 清除失败: ${errorMsg}`;
                    info.className = 'error';
                }
                clearAllBtn.disabled = false;
                clearAllBtn.textContent = '🗑️ 清除所有数据';
            });
        }
    });



    // 数据库查看器按钮
    const dbViewerBtn = document.createElement('button');
    dbViewerBtn.id = 'dbViewerBtn';
    dbViewerBtn.className = 'btn';
    dbViewerBtn.style.cssText = 'background: #9c27b0; margin-top: 10px; font-size: 12px;';
    dbViewerBtn.textContent = '🗄️ 数据库查看器';
    document.body.appendChild(dbViewerBtn);

    dbViewerBtn.addEventListener('click', () => {
        // 打开完整的数据库查看器
        try {
            chrome.tabs.create({
                url: chrome.runtime.getURL('db-viewer.html')
            });
        } catch (error) {
            console.error('打开数据库查看器失败:', error);
            // 如果打开失败，显示简单的数据信息
            info.textContent = '正在加载数据库信息...';
            info.className = 'loading';
            
            safeSendMessage({ action: 'getAllPickingDetails' }, (resp) => {
                if (resp && resp.data && Array.isArray(resp.data)) {
                    const dataCount = resp.data.length;
                    const uniquePickingNos = new Set(resp.data.map(item => item.picking_no)).size;
                    const totalProducts = resp.data.reduce((sum, item) => {
                        return sum + (item.product_total || 0);
                    }, 0);
                    
                    info.innerHTML = `
                        <div style="text-align: left; font-size: 12px;">
                            <strong>🗄️ 数据库信息:</strong><br>
                            • 总记录数: ${dataCount}<br>
                            • 拣货单数量: ${uniquePickingNos}<br>
                            • 产品总数: ${totalProducts}<br>
                            <br>
                            <small style="color: #666;">点击"查看数据"按钮查看详细信息</small>
                        </div>
                    `;
                    info.className = '';
                } else {
                    info.textContent = '❌ 无法加载数据库信息';
                    info.className = 'error';
                }
            });
        }
    });

    // 关闭数据容器按钮
    const closeDataBtn = document.getElementById('closeDataBtn');
    if (closeDataBtn) {
        closeDataBtn.addEventListener('click', () => {
            const dataContainer = document.getElementById('dataContainer');
            if (dataContainer) {
                dataContainer.style.display = 'none';
            }
        });
    }
}

/**
 * 显示数据
 * @param {Array} data - 拣货单数据数组
 */
function displayData(data) {
    const dataContainer = document.getElementById('dataContainer');
    const dataContent = document.getElementById('dataContent');
    
    if (!dataContainer || !dataContent) return;
    
    dataContainer.style.display = 'block';
    dataContent.innerHTML = '';
    
    if (!data || data.length === 0) {
        dataContent.innerHTML = '<div class="data-item"><div class="data-title">暂无数据</div></div>';
        return;
    }
    
    data.forEach((item, index) => {
        const dataItem = document.createElement('div');
        dataItem.className = 'data-item';
        
        const title = document.createElement('div');
        title.className = 'data-title';
        const pickingType = getPickingType(item);
        const orderCount = item.order_total || item.total_count || 0;
        const warehouse = item.warehouse_name || item.warehouse || '';
        title.textContent = `📋 发货单: ${item.picking_no} (${pickingType}) - 订单总数: ${orderCount}`;
        
        // 添加仓库信息
        if (warehouse) {
            const warehouseInfo = document.createElement('div');
            warehouseInfo.className = 'data-warehouse';
            warehouseInfo.style.cssText = 'font-size: 11px; color: #666; margin-bottom: 4px;';
            warehouseInfo.textContent = `🏢 仓库: ${warehouse}`;
            dataItem.appendChild(warehouseInfo);
        }
        
        const content = document.createElement('div');
        content.className = 'data-content';
        
        if (item.sku_code && item.sku_code.length > 0) {
            // 计算唯一的产品代码（SKU类型）
            const uniqueProductCodes = new Set();
            if (item.order_details) {
                item.order_details.forEach(order => {
                    if (order.product_code) {
                        uniqueProductCodes.add(order.product_code);
                    }
                });
            }
            
            let contentHtml = `
                <div style="margin-bottom: 8px;">
                    <strong>📦 SKU编号数量:</strong> <span style="color: #1976d2; font-weight: bold;">${uniqueProductCodes.size}</span>
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>📝 SKU编号列表:</strong><br>
                    ${Array.from(uniqueProductCodes).map(sku => `• ${sku}`).join('<br>')}
                </div>
            `;
            
            // 添加订单详情信息
            if (item.order_details && item.order_details.length > 0) {
                contentHtml += `
                    <div style="margin-top: 12px; border-top: 1px solid #eee; padding-top: 8px;">
                        <strong>📋 订单详情 (${item.order_details.length}个订单):</strong><br>
                        ${item.order_details.map((order, idx) => `
                            <div style="margin: 4px 0; padding: 4px; background: #f5f5f5; border-radius: 3px; font-size: 11px;">
                                <strong>订单 ${idx + 1}:</strong><br>
                                • 拣货篮子: ${order.basket_no || '无'}<br>
                                • 容器编号: ${order.container_no || '无'}<br>
                                • 订单号: ${order.order_no || '无'}<br>
                                • 跟踪号: ${order.tracking_no || '无'}<br>
                                • 产品代码: ${order.product_code || '无'}<br>
                                • 数量: ${order.count || 1}
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            content.innerHTML = contentHtml;
        } else {
            content.innerHTML = '<span style="color: #999;">暂无SKU数据</span>';
        }
        
        dataItem.appendChild(title);
        dataItem.appendChild(content);
        dataContent.appendChild(dataItem);
    });
}

/**
 * 隐藏数据容器
 */
function hideDataContainer() {
    const dataContainer = document.getElementById('dataContainer');
    if (dataContainer) {
        dataContainer.style.display = 'none';
    }
}

/**
 * 页面加载完成后初始化
 */
function initializePopup() {
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeEventListeners);
    } else {
        initializeEventListeners();
    }
} 
// 数据库查看器的JavaScript代码
let allData = [];
let filteredData = [];
let currentPage = 1;
const itemsPerPage = 10;

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
    console.log('🗄️ 数据库查看器页面加载完成');
    console.log('Chrome扩展API可用:', typeof chrome !== 'undefined' && chrome.runtime);
    loadData();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('searchBox').addEventListener('input', filterData);
    

}



function loadData() {
    showLoading();
    hideError();

    // 通过Chrome扩展消息传递获取数据
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'getAllPickingDetails' }, (response) => {
            if (chrome.runtime.lastError) {
                showError('无法连接到扩展: ' + chrome.runtime.lastError.message);
                hideLoading();
                return;
            }
            
            if (response && response.data) {
                allData = response.data;
                filteredData = [...allData];
                updateStats();
                displayData();
                hideLoading();
            } else if (response && response.error) {
                showError('加载数据失败: ' + response.error);
                hideLoading();
            } else {
                showError('加载数据失败: 未知错误');
                hideLoading();
            }
        });
    } else {
        // 直接使用Database对象（如果可用）
        if (typeof Database !== 'undefined') {
            Database.getAllPickingDetails((result) => {
                if (result.data) {
                    allData = result.data;
                    filteredData = [...allData];
                    updateStats();
                    displayData();
                    hideLoading();
                } else {
                    showError('加载数据失败: ' + result.error);
                    hideLoading();
                }
            });
        } else {
            showError('无法访问数据库：Database对象不可用');
            hideLoading();
        }
    }
}

function updateStats() {
    const totalRecords = allData.length;
    const uniquePickingNos = new Set(allData.map(item => item.picking_no)).size;
    const dbSize = new Blob([JSON.stringify(allData)]).size;

    // 计算每个仓库的拣货单数量
    const warehouseStats = {};
    allData.forEach(item => {
        const warehouseName = item.warehouse_name || item.warehouse || '未知仓库';
        warehouseStats[warehouseName] = (warehouseStats[warehouseName] || 0) + 1;
    });

    document.getElementById('totalRecords').textContent = totalRecords.toLocaleString();
    document.getElementById('uniquePickingNos').textContent = Object.entries(warehouseStats)
        .map(([warehouse, count]) => `${warehouse}: ${count}`)
        .join(', ');
    document.getElementById('dbSize').textContent = formatBytes(dbSize);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function filterData() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    filteredData = allData.filter(item => {
        return (
            item.picking_no?.toLowerCase().includes(searchTerm) ||
            item.warehouse?.toLowerCase().includes(searchTerm) ||
            item.warehouse_name?.toLowerCase().includes(searchTerm) ||
            item.picking_type_name?.toLowerCase().includes(searchTerm)
        );
    });
    currentPage = 1;
    displayData();
}

function displayData() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    if (pageData.length === 0) {
        document.getElementById('dataTable').innerHTML = '<div class="no-data">没有找到数据</div>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    const table = createDataTable(pageData);
    document.getElementById('dataTable').innerHTML = table;
    createPagination();
}

function createDataTable(data) {
    let table = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>拣货单号</th>
                    <th>仓库</th>
                    <th>订单总数</th>
                    <th>产品数量</th>
                    <th>拣货单类型</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(item => {
        const productTotal = item.product_total || 0;
        let pickingTypeName = item.picking_type_name;
        
        // 调试仓库信息
        console.log(`调试 - 拣货单 ${item.picking_no} 的仓库信息:`, {
            warehouse: item.warehouse,
            warehouse_code: item.warehouse_code,
            warehouse_name: item.warehouse_name
        });
        
        // 如果没有picking_type_name，根据picking_type生成
        if (!pickingTypeName && item.picking_type !== undefined) {
            if (item.picking_type === '0') {
                pickingTypeName = '一票一件';
            } else if (item.picking_type === '1') {
                pickingTypeName = '一票一件多个';
            } else if (item.picking_type === '2') {
                pickingTypeName = '一票多件';
            } else {
                pickingTypeName = '未知类型';
            }
        }
        
        // 如果还是没有，显示原始值或默认值
        if (!pickingTypeName) {
            pickingTypeName = item.picking_type || '-';
        }
        
        table += `
            <tr>
                <td><strong>${item.picking_no || '-'}</strong></td>
                <td>${item.warehouse_name || item.warehouse || '-'}</td>
                <td>${item.order_total || 0}</td>
                <td>${productTotal}</td>
                <td>${pickingTypeName}</td>
            </tr>
        `;
    });

    table += '</tbody></table>';
    return table;
}

function getStatusText(item) {
    const statuses = [];
    if (item.picking_status) statuses.push(`拣货:${item.picking_status}`);
    if (item.picking_status) statuses.push(`包装:${item.picking_status}`);
    if (item.pda_picking_status) statuses.push(`PDA:${item.pda_picking_status}`);
    return statuses.length > 0 ? statuses.join(', ') : '-';
}



function createPagination() {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (totalPages <= 1) {
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    let pagination = '';
    
    // 上一页
    pagination += `<button data-page="${currentPage - 1}" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>`;
    
    // 页码
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            pagination += `<button data-page="${i}" class="pagination-btn ${i === currentPage ? 'active' : ''}">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            pagination += '<span>...</span>';
        }
    }
    
    // 下一页
    pagination += `<button data-page="${currentPage + 1}" class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>`;
    
    document.getElementById('pagination').innerHTML = pagination;
    
    // 添加事件监听器
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.addEventListener('click', handlePaginationClick);
}

function handlePaginationClick(event) {
    if (event.target.classList.contains('pagination-btn') && !event.target.disabled) {
        const page = parseInt(event.target.getAttribute('data-page'));
        changePage(page);
    }
}

function changePage(page) {
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        displayData();
    }
}

function exportData() {
    const dataStr = JSON.stringify(allData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tba-fixking-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function clearDatabase() {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'clearAllData' }, (response) => {
                if (chrome.runtime.lastError) {
                    showError('清空数据库失败: ' + chrome.runtime.lastError.message);
                    return;
                }
                
                if (response && response.ok) {
                    alert('数据库已清空！');
                    loadData();
                } else {
                    const errorMsg = response && response.error ? response.error : '未知错误';
                    showError('清空数据库失败: ' + errorMsg);
                }
            });
        } else {
            showError('无法连接到扩展');
        }
    }
}

function deleteDatabase() {
    if (confirm('确定要删除整个数据库吗？此操作不可恢复！')) {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'deleteDatabase' }, (response) => {
                if (chrome.runtime.lastError) {
                    showError('删除数据库失败: ' + chrome.runtime.lastError.message);
                    return;
                }
                
                if (response && response.ok) {
                    alert('数据库已删除！');
                    loadData();
                } else {
                    const errorMsg = response && response.error ? response.error : '未知错误';
                    showError('删除数据库失败: ' + errorMsg);
                }
            });
        } else {
            showError('无法连接到扩展');
        }
    }
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('dataContent').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('dataContent').style.display = 'block';
}

function showError(message) {
    document.getElementById('error').textContent = message;
    document.getElementById('error').style.display = 'block';
}

function hideError() {
    document.getElementById('error').style.display = 'none';
} 
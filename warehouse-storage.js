// 仓库存储模块
const WarehouseStorage = {
    /**
     * 保存当前仓库信息
     * @param {string} warehouseId - 仓库ID
     * @param {string} warehouseName - 仓库名称
     */
    saveWarehouseInfo(warehouseId, warehouseName) {
        try {
            console.log(`开始保存仓库信息: ID=${warehouseId}, Name=${warehouseName}`);
            
            // 保存到 localStorage
            localStorage.setItem('tba_current_warehouse_id', warehouseId);
            localStorage.setItem('tba_current_warehouse_name', warehouseName);
            console.log('仓库信息已保存到 localStorage');
            
            // 保存到 chrome.storage.local（跨页面共享）
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({
                    'tba_current_warehouse_id': warehouseId,
                    'tba_current_warehouse_name': warehouseName
                }, () => {
                    console.log('仓库信息已保存到 chrome.storage.local');
                });
            } else {
                console.log('chrome.storage.local 不可用，只保存到 localStorage');
            }
            
            console.log(`仓库信息保存完成: ID=${warehouseId}, Name=${warehouseName}`);
        } catch (error) {
            console.error('保存仓库信息失败:', error);
        }
    },

    /**
     * 获取保存的仓库信息
     * @returns {Promise<Object>} 仓库信息 {id, name}
     */
    async getWarehouseInfo() {
        try {
            console.log('开始获取仓库信息...');
            
            // 优先从 chrome.storage.local 获取
            if (chrome.storage && chrome.storage.local) {
                console.log('使用 chrome.storage.local 获取仓库信息');
                return new Promise((resolve) => {
                    chrome.storage.local.get([
                        'tba_current_warehouse_id', 
                        'tba_current_warehouse_name'
                    ], (result) => {
                        console.log('chrome.storage.local 返回结果:', result);
                        if (result.tba_current_warehouse_id) {
                            console.log('从 chrome.storage.local 获取到仓库信息:', result);
                            resolve({
                                id: result.tba_current_warehouse_id,
                                name: result.tba_current_warehouse_name || ''
                            });
                        } else {
                            console.log('chrome.storage.local 中没有仓库信息，降级到 localStorage');
                            // 降级到 localStorage
                            const id = localStorage.getItem('tba_current_warehouse_id');
                            const name = localStorage.getItem('tba_current_warehouse_name');
                            console.log('localStorage 中的仓库信息:', { id, name });
                            resolve({
                                id: id || '1', // 默认1号仓
                                name: name || 'YZTUS [云泽通US仓]'
                            });
                        }
                    });
                });
            } else {
                console.log('chrome.storage.local 不可用，使用 localStorage');
                // 降级到 localStorage
                const id = localStorage.getItem('tba_current_warehouse_id');
                const name = localStorage.getItem('tba_current_warehouse_name');
                console.log('localStorage 中的仓库信息:', { id, name });
                return {
                    id: id || '1', // 默认1号仓
                    name: name || 'YZTUS [云泽通US仓]'
                };
            }
        } catch (error) {
            console.error('获取仓库信息失败:', error);
            return {
                id: '1', // 默认1号仓
                name: 'YZTUS [云泽通US仓]'
            };
        }
    },

    /**
     * 清除仓库信息
     */
    clearWarehouseInfo() {
        try {
            localStorage.removeItem('tba_current_warehouse_id');
            localStorage.removeItem('tba_current_warehouse_name');
            
            if (chrome.storage && chrome.storage.local) {
                chrome.storage.local.remove([
                    'tba_current_warehouse_id', 
                    'tba_current_warehouse_name'
                ]);
            }
            
            console.log('仓库信息已清除');
        } catch (error) {
            console.error('清除仓库信息失败:', error);
        }
    }
};

// 挂到全局，供其它脚本访问
if (typeof window !== 'undefined') {
    window.WarehouseStorage = WarehouseStorage;
}

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WarehouseStorage;
} 
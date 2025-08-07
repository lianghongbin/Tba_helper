// 仓库管理模块
const WarehouseManager = {
    /**
     * 获取当前仓库ID
     * @returns {string} 仓库ID：'1' 或 '2'
     */
    getWarehouseId() {
        console.log('开始检测仓库信息...');
        
        // 方法1: 查找 selectedWarehouse 元素
        const warehouseSpan = document.querySelector('#selectedWarehouse');
        console.log('查找仓库元素 #selectedWarehouse:', warehouseSpan);
        
        if (warehouseSpan) {
            const text = warehouseSpan.textContent;
            console.log('仓库元素文本内容:', text);
            
            if (text.includes('YZTUS02')) {
                console.log('检测到二号仓');
                return '2'; // 二号仓
            } else if (text.includes('YZTUS')) {
                console.log('检测到一号仓');
                return '1'; // 一号仓
            }
        }
        
        // 方法2: 查找所有包含仓库信息的元素
        console.log('尝试查找其他仓库元素...');
        const warehouseElements = document.querySelectorAll('*');
        for (let element of warehouseElements) {
            if (element.textContent && element.textContent.includes('YZTUS')) {
                console.log('找到包含YZTUS的元素:', element);
                console.log('元素文本:', element.textContent);
                
                if (element.textContent.includes('YZTUS02')) {
                    console.log('检测到二号仓');
                    return '2';
                } else if (element.textContent.includes('YZTUS')) {
                    console.log('检测到一号仓');
                    return '1';
                }
            }
        }
        
        console.log('未找到仓库元素，使用默认值');
        return null; // 返回null表示没有找到仓库信息
    },

    /**
     * 获取当前仓库名称
     * @returns {string} 仓库名称
     */
    getWarehouseName() {
        const warehouseSpan = document.querySelector('#selectedWarehouse');
        return warehouseSpan ? warehouseSpan.textContent.trim() : '未知仓库';
    },

    /**
     * 检测当前是否为二次分拣页面
     * @returns {boolean} 是否为二次分拣页面
     */
    isSortingPage() {
        // 检测URL中的quick参数
        const urlParams = new URLSearchParams(window.location.search);
        const quickParam = urlParams.get('quick');
        
        // 检测页面标题或菜单项
        const sortingLink = document.querySelector('a[onclick*="二次分拣"]');
        const isSortingPage = sortingLink && sortingLink.classList.contains('active');
        
        return quickParam === '104' || isSortingPage;
    },

    /**
     * 获取当前仓库ID（优先从页面获取，否则从存储获取）
     * @returns {Promise<string>} 仓库ID
     */
    async getWarehouseIdWithFallback() {
        console.log('开始获取仓库ID（带回退）...');
        
        // 检查当前页面类型
        const isSortingPage = this.isSortingPage();
        console.log('是否为二次分拣页面:', isSortingPage);
        
        if (isSortingPage) {
            // 二次分拣页面直接从存储获取
            console.log('二次分拣页面，直接从存储获取仓库信息...');
            const storedInfo = await WarehouseStorage.getWarehouseInfo();
            console.log('从存储获取仓库信息:', storedInfo);
            return storedInfo.id;
        }
        
        // 其他页面先尝试从页面获取
        const pageWarehouseId = this.getWarehouseId();
        const pageWarehouseName = this.getWarehouseName();
        console.log('从页面获取的仓库信息:', { id: pageWarehouseId, name: pageWarehouseName });
        
        // 检查页面是否有有效的仓库信息
        const hasValidPageInfo = pageWarehouseId && pageWarehouseName && pageWarehouseName !== '未知仓库';
        
        if (hasValidPageInfo) {
            // 保存到存储
            console.log('页面有有效仓库信息，保存到存储:', { id: pageWarehouseId, name: pageWarehouseName });
            WarehouseStorage.saveWarehouseInfo(pageWarehouseId, pageWarehouseName);
            return pageWarehouseId;
        }
        
        console.log('页面没有有效仓库信息，从存储获取...');
        // 从存储获取
        const storedInfo = await WarehouseStorage.getWarehouseInfo();
        console.log('从存储获取仓库信息:', storedInfo);
        return storedInfo.id;
    },

    /**
     * 获取当前仓库名称（优先从页面获取，否则从存储获取）
     * @returns {Promise<string>} 仓库名称
     */
    async getWarehouseNameWithFallback() {
        // 先尝试从页面获取
        const pageWarehouseName = this.getWarehouseName();
        if (pageWarehouseName && pageWarehouseName !== '未知仓库') {
            return pageWarehouseName;
        }
        
        // 从存储获取
        const storedInfo = await WarehouseStorage.getWarehouseInfo();
        return storedInfo.name;
    },

    /**
     * 监听仓库变化
     * @param {Function} callback 仓库变化时的回调函数
     */
    onWarehouseChange(callback) {
        // 监听仓库设置按钮的点击事件
        const setWarehouseBtn = document.querySelector('input[onclick*="setMainWarehouseDialog"]');
        if (setWarehouseBtn) {
            setWarehouseBtn.addEventListener('click', () => {
                // 延迟执行，等待仓库设置完成
                setTimeout(() => {
                    const newWarehouseId = this.getWarehouseId();
                    callback(newWarehouseId);
                }, 1000);
            });
        }

        // 监听仓库显示元素的变化
        const warehouseSpan = document.querySelector('#selectedWarehouse');
        if (warehouseSpan) {
            const observer = new MutationObserver(() => {
                const newWarehouseId = this.getWarehouseId();
                callback(newWarehouseId);
            });
            
            observer.observe(warehouseSpan, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }
    }
};

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WarehouseManager;
} 
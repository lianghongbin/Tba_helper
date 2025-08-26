// 仓库管理模块
const WarehouseManager = {
    isInitialized: false,

    /**
     * 初始化 WarehouseManager
     */
    init() {
        if (this.isInitialized) {
            console.log('[WarehouseManager] 已初始化，跳过重复初始化');
            return;
        }

        this.isInitialized = true;
        window.xAI = window.xAI || {};
        if (window.xAI.WarehouseManager && window.xAI.WarehouseManager !== this) {
            console.warn('[WarehouseManager] 全局命名空间中已存在其他实例，替换为当前实例');
        }
        window.xAI.WarehouseManager = this;
        console.log('[WarehouseManager] 初始化完成');
    },

    /**
     * 获取当前仓库ID
     * @returns {string|null} 仓库ID：'1' 或 '2'
     */
    getWarehouseId() {
        console.log('[WarehouseManager] 开始检测仓库信息...');

        // 方法1: 查找 selectedWarehouse 元素
        const warehouseSpan = document.querySelector('#selectedWarehouse');
        console.log('[WarehouseManager] 查找仓库元素 #selectedWarehouse:', warehouseSpan);

        if (warehouseSpan) {
            const text = warehouseSpan.textContent;
            console.log('[WarehouseManager] 仓库元素文本内容:', text);

            if (text.includes('YZTUS02')) {
                console.log('[WarehouseManager] 检测到二号仓');
                return '2'; // 二号仓
            } else if (text.includes('YZTUS')) {
                console.log('[WarehouseManager] 检测到一号仓');
                return '1'; // 一号仓
            }
        }

        // 方法2: 查找所有包含仓库信息的元素
        console.log('[WarehouseManager] 尝试查找其他仓库元素...');
        const warehouseElements = document.querySelectorAll('*');
        for (let element of warehouseElements) {
            if (element.textContent && element.textContent.includes('YZTUS')) {
                console.log('[WarehouseManager] 找到包含YZTUS的元素:', element);
                console.log('[WarehouseManager] 元素文本:', element.textContent);

                if (element.textContent.includes('YZTUS02')) {
                    console.log('[WarehouseManager] 检测到二号仓');
                    return '2';
                } else if (element.textContent.includes('YZTUS')) {
                    console.log('[WarehouseManager] 检测到一号仓');
                    return '1';
                }
            }
        }

        console.log('[WarehouseManager] 未找到仓库元素，使用默认值');
        return null;
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
        const urlParams = new URLSearchParams(window.location.search);
        const quickParam = urlParams.get('quick');

        const sortingLink = document.querySelector('a[onclick*="二次分拣"]');
        const isSortingPage = sortingLink && sortingLink.classList.contains('active');

        return quickParam === '104' || isSortingPage;
    },

    /**
     * 获取当前仓库ID（优先从页面获取，否则从存储获取）
     * @returns {Promise<string|null>} 仓库ID
     */
    async getWarehouseIdWithFallback() {
        console.log('[WarehouseManager] 开始获取仓库ID（带回退）...');

        const isSortingPage = this.isSortingPage();
        console.log('[WarehouseManager] 是否为二次分拣页面:', isSortingPage);

        if (isSortingPage) {
            console.log('[WarehouseManager] 二次分拣页面，直接从存储获取仓库信息...');
            const storedInfo = await WarehouseStorage.getWarehouseInfo();
            console.log('[WarehouseManager] 从存储获取仓库信息:', storedInfo);
            return storedInfo.id;
        }

        const pageWarehouseId = this.getWarehouseId();
        const pageWarehouseName = this.getWarehouseName();
        console.log('[WarehouseManager] 从页面获取的仓库信息:', { id: pageWarehouseId, name: pageWarehouseName });

        const hasValidPageInfo = pageWarehouseId && pageWarehouseName && pageWarehouseName !== '未知仓库';

        if (hasValidPageInfo) {
            console.log('[WarehouseManager] 页面有有效仓库信息，保存到存储:', { id: pageWarehouseId, name: pageWarehouseName });
            WarehouseStorage.saveWarehouseInfo(pageWarehouseId, pageWarehouseName);
            return pageWarehouseId;
        }

        console.log('[WarehouseManager] 页面没有有效仓库信息，从存储获取...');
        const storedInfo = await WarehouseStorage.getWarehouseInfo();
        console.log('[WarehouseManager] 从存储获取仓库信息:', storedInfo);
        return storedInfo.id;
    },

    /**
     * 获取当前仓库名称（优先从页面获取，否则从存储获取）
     * @returns {Promise<string>} 仓库名称
     */
    async getWarehouseNameWithFallback() {
        const pageWarehouseName = this.getWarehouseName();
        if (pageWarehouseName && pageWarehouseName !== '未知仓库') {
            return pageWarehouseName;
        }

        const storedInfo = await WarehouseStorage.getWarehouseInfo();
        return storedInfo.name;
    },

    /**
     * 监听仓库变化
     * @param {Function} callback 仓库变化时的回调函数
     */
    onWarehouseChange(callback) {
        const setWarehouseBtn = document.querySelector('input[onclick*="setMainWarehouseDialog"]');
        if (setWarehouseBtn) {
            setWarehouseBtn.addEventListener('click', () => {
                setTimeout(() => {
                    const newWarehouseId = this.getWarehouseId();
                    callback(newWarehouseId);
                }, 1000);
            });
        }

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

// 立即初始化
try {
    WarehouseManager.init();
} catch (error) {
    console.error('[WarehouseManager] 初始化失败:', error);
}

// 挂到全局，供其它脚本访问
if (typeof window !== 'undefined') {
    window.WarehouseManager = WarehouseManager;
}

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WarehouseManager;
}
/**
 * 拣货单选择器初始化模块
 * 
 * 功能说明：
 * 1. 初始化拣货单选择器
 * 2. 检测页面类型
 * 3. 监听仓库变化
 * 
 * 使用场景：
 * - 在易仓系统中初始化拣货单选择器
 * - 处理页面类型检测和仓库变化
 * 
 * 作者：TBA FixKing
 * 创建时间：2025年
 */

class PickingCodeInitializer {
    constructor() {
        this.debugMode = true; // 在浏览器环境中默认开启调试模式
        this.initialized = false;
        this.init();
    }

    init() {
        // 将实例挂载到全局，供其他模块调用
        window.PickingCodeInitializer = this;
        this.log('info', '拣货单选择器初始化模块已初始化');
    }

    /**
     * 初始化拣货单选择器
     * @returns {Promise<boolean>} 是否成功初始化
     */
    async initializePickingCodeSelector() {
        this.log('info', '开始初始化拣货单选择器...');
        
        // 检查是否已经初始化过
        if (this.initialized) {
            this.log('info', '拣货单选择器已经初始化过，跳过');
            return true;
        }
        
        try {
            // 设置数据库对象
            if (window.PickingCodeSelector && window.Database) {
                window.PickingCodeSelector.setDatabase(window.Database);
            } else {
                this.log('error', 'PickingCodeSelector 或 Database 未找到');
                return false;
            }
            
            // 获取当前仓库ID和页面类型
            const warehouseId = await this.getWarehouseId();
            const isSkuPack = this.isSkuPackPage();
            const isSorting = this.isSortingPage();
            
            this.log('info', `当前仓库ID: ${warehouseId}, 是否按SKU打包页面: ${isSkuPack}, 是否二次分拣页面: ${isSorting}`);
            
            // 初始化拣货单选择器
            window.PickingCodeSelector.init(warehouseId, isSkuPack, isSorting);
            
            // 监听仓库变化
            this.setupWarehouseChangeListener();
            
            // 标记为已初始化
            this.initialized = true;
            
            this.log('info', '拣货单选择器初始化完成');
            return true;
        } catch (error) {
            this.log('error', '初始化拣货单选择器失败:', error);
            return false;
        }
    }

    /**
     * 获取仓库ID
     * @returns {Promise<string>} 仓库ID
     */
    async getWarehouseId() {
        if (window.WarehouseManager) {
            return await window.WarehouseManager.getWarehouseIdWithFallback();
        }
        this.log('error', 'WarehouseManager 未找到');
        return '';
    }

    /**
     * 检测当前是否为按SKU打包页面
     * @returns {boolean} 是否为按SKU打包页面
     */
    isSkuPackPage() {
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
    isSortingPage() {
        // 检测URL中的quick参数
        const urlParams = new URLSearchParams(window.location.search);
        const quickParam = urlParams.get('quick');
        
        // 检测页面标题或菜单项
        const sortingLink = document.querySelector('a[onclick*="二次分拣"]');
        const isSortingPage = sortingLink && sortingLink.classList.contains('active');
        
        return quickParam === '104' || isSortingPage;
    }

    /**
     * 设置仓库变化监听器
     */
    setupWarehouseChangeListener() {
        if (window.WarehouseManager) {
            window.WarehouseManager.onWarehouseChange(async (newWarehouseId) => {
                this.log('info', '仓库发生变化，新仓库ID:', newWarehouseId);
                const currentIsSkuPack = this.isSkuPackPage();
                const currentIsSorting = this.isSortingPage();
                
                // 更新拣货单选择器
                if (window.PickingCodeSelector) {
                    window.PickingCodeSelector.init(newWarehouseId, currentIsSkuPack, currentIsSorting);
                }
            });
        }
    }

    /**
     * 检查是否已初始化
     * @returns {boolean}
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * 日志输出
     */
    log(level, message, ...args) {
        if (this.debugMode || level === 'error') {
            console[level](`[PickingCodeInitializer] ${message}`, ...args);
        }
    }

    /**
     * 销毁实例
     */
    destroy() {
        delete window.PickingCodeInitializer;
        this.log('info', '拣货单选择器初始化模块已销毁');
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PickingCodeInitializer();
    });
} else {
    new PickingCodeInitializer();
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PickingCodeInitializer;
}

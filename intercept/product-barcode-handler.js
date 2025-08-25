/**
 * 产品代码业务逻辑处理模块
 *
 * 功能说明：
 * 1. 处理产品代码提交的业务逻辑
 * 2. 验证产品代码格式
 * 3. 执行相关的业务操作
 *
 * 使用场景：
 * - 接收产品代码事件拦截器的调用
 * - 处理产品代码验证和业务逻辑
 * - 可以扩展为调用API、查询数据库等操作
 *
 * 作者：TBA FixKing
 * 创建时间：2025年
 */

class ProductBarcodeHandler {
    constructor(config = {}) {
        this.debugMode = config.debugMode ?? true;
        this.init();
    }

    init() {
        // 将实例挂载到全局命名空间
        window.xAI = window.xAI || {};
        window.xAI.ProductBarcodeHandler = this;
        this.log('info', '产品代码业务处理器已初始化');
    }

    /**
     * 拣货单为空，该业务逻辑是自动匹配拣货单
     * @return Promise<{string}> pickingCode
     */
    async handleProductBarcodeSubmit(productBarcode) {
        try {
            this.log('info', '开始处理按 SKU 打包，拣货单为空自动填充处理......');
            this.log('info', `产品代码: ${productBarcode}`);

            return await this.autoPickingCode(productBarcode);
        } catch (error) {
            this.log('error', '按 SKU 打包，拣货单为空自动填充处理错误:', error);
            throw error;
        }
    }

    /**
     *
     * @param productBarcode
     * @return Promise<{string}>
     */
    async autoPickingCode(productBarcode) {
        const result = await window.xAI.HandoverOrderFetcher.findLatestOrderByProductBarcode(productBarcode,'2', '0');
        if (result == null) {
            return null;
        }

        return result.pickingCode;
    }

    /**
     * 执行业务逻辑
     */
    async executeBusinessLogic(productBarcode, eventType) {
        this.log('info', '=== 执行业务逻辑 ===');
        this.log('info', `处理产品代码: ${productBarcode}`);
        this.log('info', `事件类型: ${eventType}`);

        // 同步显示到 Public Label
        try {
            if (window.xAI && window.xAI.PublicLabelManager) {
                window.xAI.PublicLabelManager.showInfo(productBarcode, { autoHide: false });
            } else {
                this.log('warn', 'PublicLabelManager 未加载，无法显示条码提示');
                alert('系统警告：无法显示条码信息，请联系管理员');
            }
        } catch (e) {
            this.log('error', '显示 Public Label 时发生异常:', e);
        }

        this.log('info', '=== 业务逻辑执行完成 ===');
        return {
            originalProductBarcode: productBarcode,
            eventType,
            timestamp: new Date().toISOString(),
            processed: true
        };
    }

    /**
     * 日志输出
     */
    log(level, message, ...args) {
        if (this.debugMode || level === 'error') {
            console[level](`[ProductBarcodeHandler] ${message}`, ...args);
        }
    }

    /**
     * 销毁实例
     */
    destroy() {
        if (window.xAI && window.xAI.ProductBarcodeHandler) {
            delete window.xAI.ProductBarcodeHandler;
        }
        this.log('info', '产品代码业务处理器已销毁');
    }
}

// 页面加载完成后初始化
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new ProductBarcodeHandler();
        });
    } else {
        new ProductBarcodeHandler();
    }
} catch (error) {
    console.error('[ProductBarcodeHandler] 初始化失败:', error);
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductBarcodeHandler;
}
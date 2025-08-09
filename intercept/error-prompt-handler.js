/**
 * 错误弹窗业务逻辑处理模块
 *
 * 功能说明：
 * 1. 处理错误弹窗的业务逻辑
 * 2. 管理公共标签的显示和更新
 * 3. 调用相关的业务方法
 *
 * 使用场景：
 * - 接收错误弹窗事件拦截器的调用
 * - 处理错误信息并显示在公共标签中
 * - 执行相关的业务逻辑（如查询交接班数据）
 *
 * 作者：TBA FixKing
 * 创建时间：2025年
 */

class ErrorPromptHandler {
    constructor(config = {}) {
        this.debugMode = config.debugMode ?? true;
        this.init();
    }

    init() {
        // 将实例挂载到全局命名空间
        window.xAI = window.xAI || {};
        window.xAI.ErrorPromptHandler = this;
        this.log('info', '错误弹窗业务处理器已初始化');
    }

    /**
     * 处理错误弹窗的主要业务逻辑
     */
    async handleErrorPrompt(errorText, productBarcode) {
        try {
            this.log('info', '开始处理错误弹窗业务逻辑');
            this.log('info', `错误信息: ${errorText}`);
            this.log('info', `产品条码: ${productBarcode}`);

            // 显示错误信息
            if (window.xAI && window.xAI.PublicLabelManager) {
                window.xAI.PublicLabelManager.showError(errorText);
            } else {
                this.log('error', 'PublicLabelManager 模块未找到');
                alert('系统错误：无法显示错误信息，请联系管理员');
            }

            // 如果有产品条码，执行相关业务逻辑
            if (productBarcode) {
                const result = await this.executeProductBarcodeLogic(productBarcode);
                this.log('info', '错误弹窗业务逻辑处理完成');
                return result;
            } else {
                this.log('info', '没有产品条码，跳过相关业务逻辑');
                return {
                    success: true,
                    message: '错误信息已显示',
                    type: 'info'
                };
            }
        } catch (error) {
            this.log('error', '处理错误弹窗业务逻辑时出错:', error);
            return {
                success: false,
                message: '处理错误弹窗时出错',
                type: 'error',
                error: error.message
            };
        }
    }

    /**
     * 执行产品条码相关的业务逻辑
     */
    async executeProductBarcodeLogic(productBarcode) {
        try {
            this.log('info', '开始执行产品条码相关业务逻辑');

            // 调用 HandoverOrderFetcher 查找最新订单
            if (window.xAI && window.xAI.HandoverOrderFetcher) {
                const result = await window.xAI.HandoverOrderFetcher.findLatestOrderByProductBarcode(productBarcode);
                this.log('info', 'findLatestOrderByProductBarcode 返回结果:', result);

                // 自定义业务逻辑：查询库存
                if (result && result.success) {
                    const inventoryResponse = await fetch('/api/check-inventory', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ barcode: productBarcode })
                    });
                    const inventory = await inventoryResponse.json();
                    this.log('info', '库存查询结果:', inventory);

                    return {
                        success: true,
                        message: `找到相关订单: ${result.data}, 库存: ${inventory.stock}`,
                        type: 'success',
                        data: { order: result.data, inventory: inventory.stock }
                    };
                } else {
                    return {
                        success: false,
                        message: '未找到相关订单',
                        type: 'warning'
                    };
                }
            } else {
                this.log('error', 'HandoverOrderFetcher 模块未找到');
                return {
                    success: false,
                    message: '系统模块未加载',
                    type: 'error'
                };
            }
        } catch (error) {
            this.log('error', '执行产品条码业务逻辑时出错:', error);
            return {
                success: false,
                message: '查询订单时出错',
                type: 'error',
                error: error.message
            };
        }
    }

    /**
     * 根据 barcode自动选择拣货单
     * @param {string} product_barcode - 商品 barcode
     */
    async autoSelectPicking(product_barcode) {
        const result = await window.xAI.HandoverOrderFetcher.findLatestOrderByProductBarcode(productBarcode,'2', '0');
        if (result == null) {
            return null;
        }

        return null;
    }

    /**
     * 日志输出
     */
    log(level, message, ...args) {
        if (this.debugMode || level === 'error') {
            console[level](`[ErrorPromptHandler] ${message}`, ...args);
        }
    }

    /**
     * 销毁实例
     */
    destroy() {
        if (window.xAI && window.xAI.ErrorPromptHandler) {
            delete window.xAI.ErrorPromptHandler;
        }
        this.log('info', '错误弹窗业务处理器已销毁');
    }
}

// 页面加载完成后初始化
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new ErrorPromptHandler();
        });
    } else {
        new ErrorPromptHandler();
    }
} catch (error) {
    console.error('[ErrorPromptHandler] 初始化失败:', error);
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorPromptHandler;
}
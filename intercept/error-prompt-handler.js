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

    /**
     * 处理二次分拣结果
     * @param {string} type - 结果类型 (error 或 info)
     * @param {string} message - 结果消息
     * @param {Object} data - 相关的数据
     */
    handleSecondSortingResult(type, message, data) {
        try {
            this.log('info', `收到二次分拣结果: ${type} - ${message}`);

            if (type === 'error') {
                // 处理错误情况
                this.log('error', '二次分拣处理出现错误:', message);

                // 可以在这里添加错误处理逻辑
                // 比如显示错误提示、记录日志等
                if (window.xAI && window.xAI.PublicLabelManager) {
                    window.xAI.PublicLabelManager.showError(`二次分拣错误: ${message}`);
                }

                return {
                    success: false,
                    message: message,
                    type: 'error',
                    data: data
                };
            } else {
                // 处理正常情况
                this.log('info', '二次分拣处理正常:', message);

                // 可以在这里添加成功处理逻辑
                // 比如显示成功提示、更新状态等
                if (window.xAI && window.xAI.PublicLabelManager) {
                    window.xAI.PublicLabelManager.showInfo(`二次分拣信息: ${message}`);
                }

                return {
                    success: true,
                    message: message,
                    type: 'info',
                    data: data
                };
            }
        } catch (error) {
            this.log('error', '处理二次分拣结果时出错:', error);
            return {
                success: false,
                message: '处理二次分拣结果时出错',
                type: 'error',
                error: error.message
            };
        }
    }

    /**
     * 初始化
     */
    init() {
        this.log('info', 'ErrorPromptHandler 初始化开始');

        // 将实例挂载到全局命名空间
        window.xAI = window.xAI || {};
        window.xAI.ErrorPromptHandler = this;

        this.log('info', 'ErrorPromptHandler 初始化完成');
    }

    /**
     * 处理错误弹窗的主要业务逻辑
     */
    async handleErrorPrompt(errorText, productBarcode) {
        try {
            this.log('info', '开始处理错误弹窗业务逻辑');
            this.log('info', `错误信息: ${errorText}`);
            this.log('info', `产品条码: ${productBarcode}`);

            //如果不是不匹配的错误，就不处理
            if (!(errorText.startsWith("产品代码:") && errorText.endsWith("未找到匹配未完成的订单"))) {
                return;
            }

            //自动查找 一票一件多个中是否有该 barcode
            const pickingCode = this.autoSelectPicking(productBarcode);

            if (pickingCode === null) {  //一票一件多个和一票多个里没有该 barcode
                window.xAI.PublicLabelManager.showError('没有包含 ' + productBarcode + ' 的订单.');
                return;
            }

            //找到了productBarcode所在的一票一件多个的拣货单，调用二次分拣页面，完成二次分拣的打单
            const result = window.xAI.SecondSortingHandler.handleSecondSorting({pickingCode, productBarcode});
            if (result.state !==0) {
                // 显示错误信息
                window.xAI.PublicLabelManager.showError(result.message);
                return;
            }

            // 显示错误信息
            window.xAI.PublicLabelManager.showInfo(result.data);

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
                const result = await window.xAI.HandoverOrderFetcher.findLatestOrderByProductBarcode(productBarcode, '2', '01');
                this.log('info', 'findLatestOrderByProductBarcode 返回结果:', result);


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
     * @param {string} productBarcode - 商品 barcode
     * @return {string} pickingCode|null;
     */
    async autoSelectPicking(productBarcode) {
        const result = await window.xAI.HandoverOrderFetcher.findLatestOrderByProductBarcode(productBarcode, '2', '1');
        if (result == null) {
            return null;
        }

        return result.pickingCode
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
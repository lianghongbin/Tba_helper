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
     * 监听二次分拣结果事件
     */
    setupSecondSortingResultListener() {
        if (this.resultEventListener) {
            document.removeEventListener('secondSortingResult', this.resultEventListener);
        }

        this.resultEventListener = (event) => {
            const {type, message, data} = event.detail;
            this.handleSecondSortingResult(type, message, data);
        };

        document.addEventListener('secondSortingResult', this.resultEventListener);
        this.log('info', '二次分拣结果事件监听器已设置');
    }

    /**
     * 初始化
     */
    init() {
        this.log('info', 'ErrorPromptHandler 初始化开始');

        // 设置二次分拣结果监听器
        this.setupSecondSortingResultListener();

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

            // 显示错误信息
            if (window.xAI && window.xAI.PublicLabelManager) {
                window.xAI.PublicLabelManager.showError(errorText);
            } else {
                this.log('error', 'PublicLabelManager 模块未找到');
                alert('系统错误：无法显示错误信息，请联系管理员');
            }

            //自动查找 一票一件多个中是否有该 barcode
            const result = await this.selectOrderByBarcode(productBarcode);
            if (result === null) {
                console.log('info', '根据 barcode 没有查找到一票一件多个订单信息，自动化处理到此结束.');
                //return;
            }

            this.log("info", '根据 barcode查找到的一票一件多个订单信息' + result)


            //接下来调用二次分拣页面的功能，将拣货单和 barcode填入到二次分拣的页面直接打印
            this.log('info', '准备调用二次分拣功能...');
            this.log('info', '检查 SecondSortingHandler 是否存在:', !!window.xAI?.SecondSortingHandler);

            if (window.xAI && window.xAI.SecondSortingHandler) {
                const secondSortingData = {
                    productBarcode: productBarcode,
                    pickingCode: 'aa'
                };

                this.log('info', '=== 开始调用二次分拣处理器 ===');
                this.log('info', '发送的数据:', secondSortingData);
                this.log('info', 'SecondSortingHandler 实例:', window.xAI.SecondSortingHandler);

                try {
                    const result = await window.xAI.SecondSortingHandler.handleSecondSorting(secondSortingData);
                    this.log('info', '二次分拣处理器返回结果:', result);
                } catch (error) {
                    this.log('error', '调用二次分拣处理器时出错:', error);
                }
            } else {
                this.log('error', 'SecondSortingHandler 模块未找到！');
                this.log('error', 'window.xAI 对象:', window.xAI);
                this.log('error', '可用的模块:', Object.keys(window.xAI || {}));
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
     * 根据 barcode 查找该 barcode 所在的一票一件多个订单
     * @param {string} productBarcode - 商品 barcode
     * @return Promise<{{id:{string},orderProduct:[{}],pickingCode:{string},pickingType:{string},pickingTypeName:{string}}>;
     */
    async selectOrderByBarcode(productBarcode) {
        let warehouseCode;
        if (window.xAI && window.xAI.WarehouseManager) {
            warehouseCode = window.xAI.WarehouseManager.getWarehouseId();
        }
        const result = await window.xAI.HandoverOrderFetcher.findLatestOrderByProductBarcode(productBarcode, warehouseCode, '1');
        if (result == null) {
            return null;
        }

        return result;
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
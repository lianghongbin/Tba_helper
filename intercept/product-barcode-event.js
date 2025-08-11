/**
 * 产品代码输入事件拦截模块
 *
 * 功能说明：
 * 1. 拦截产品代码输入框的回车事件
 * 2. 调度业务逻辑处理
 *
 * 使用场景：
 * - 在易仓系统的产品代码输入页面
 * - 当用户输入产品代码后按回车或点击确认按钮时触发
 *
 * 作者：TBA FixKing
 * 创建时间：2025年
 */

class ProductBarcodeEventInterceptor {
    /**
     * 构造函数，初始化配置和事件监听
     * @param {Object} config - 配置对象
     * @param {boolean} [config.debugMode=true] - 是否启用调试模式
     * @param {string} [config.productBarcodeSelector='#productBarcode'] - 产品代码输入框选择器
     * @param {string} [config.pickingCodeSelector='#pickingCode'] - 拣货代码输入框选择器
     * @param {boolean} [config.enableListening=true] - 是否启用监听
     * @param {Object} [barcodeHandler=window.xAI?.ProductBarcodeHandler] - 业务逻辑处理模块
     */
    constructor(config = {}) {
        this.debugMode = config.debugMode ?? true;
        this.productBarcodeSelector = '#productBarcode';
        this.pickingCodeSelector = '#pickingCode';
        this.productBarcodeInput = null;
        this.pickingCodeInput = null;
        this.submitButton = null;
        this._isBound = false;
        this._observer = null;
        this.keydownHandler = this.handleKeydown.bind(this);
        this.clickHandler = this.handleClick.bind(this);

        this.tryInitialize();
    }

    /**
     * 尝试初始化，查找输入框并绑定事件
     * @private
     */
    tryInitialize() {
        try {
            this.productBarcodeInput = document.querySelector(this.productBarcodeSelector);
            this.pickingCodeInput = document.querySelector(this.pickingCodeSelector);
            if (this.productBarcodeInput) {
                this.submitButton = document.querySelector('.submitProduct');
                if (!this._isBound) {
                    this.bindEvents();
                    this._isBound = true;
                }
                this.log('info', `产品代码输入监听已就绪 (${this.productBarcodeSelector})`);
                return;
            }

            // 未找到输入框，静默等待 DOM 变更
            if (window.MutationObserver) {
                this._observer = new MutationObserver(() => {
                    const el = document.querySelector(this.productBarcodeSelector);
                    if (el) {
                        this.productBarcodeInput = el;
                        this.pickingCodeInput = document.querySelector(this.pickingCodeSelector);
                        this.submitButton = document.querySelector('.submitProduct');
                        if (!this._isBound) {
                            this.bindEvents();
                            this._isBound = true;
                        }
                        this._observer.disconnect();
                        this._observer = null;
                        this.log('info', `产品代码输入监听已绑定 (${this.productBarcodeSelector})`);
                    }
                });
                const container = document.querySelector('#barcodeForm') || document.querySelector('form') || document.body;
                this._observer.observe(container, {childList: true, subtree: true});
            } else {
                this.log('error', 'MutationObserver 不支持，监听可能失败');
            }
        } catch (error) {
            this.log('error', '初始化产品代码监听失败:', error);
        }
    }

    /**
     * 事件绑定入口
     * @private
     */
    bindEvents() {
        this.setupEventListeners();
    }

    /**
     * 设置事件监听器，绑定键盘和点击事件
     * @private
     */
    setupEventListeners() {
        if (this.productBarcodeInput) {
            this.productBarcodeInput.addEventListener('keydown', this.keydownHandler);
            this.log('info', `已绑定 ${this.productBarcodeSelector} 回车监听`);
        }
        if (this.submitButton) {
            this.submitButton.addEventListener('click', this.clickHandler);
            this.log('info', '已绑定 .submitProduct 点击监听');
        }
    }

    /**
     * 处理 keydown 事件，捕获 Enter 键
     * @param {KeyboardEvent} event - 键盘事件
     * @private
     */
    handleKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // 阻止默认行为（如表单提交）
            const {pickingCode, productBarcode} = this.getInputValues();
            this.executeBusinessLogic(pickingCode, productBarcode, 'keydown').catch((error) => {
                this.log('error', '回车事件处理失败:', error);
            });
        }
    }

    /**
     * 处理点击事件
     * @private
     */
    handleClick(event) {
        const {pickingCode, productBarcode} = this.getInputValues();
        this.executeBusinessLogic(pickingCode, productBarcode, 'click').catch((error) => {
            this.log('error', '点击事件处理失败:', error);
        });
    }

    /**
     * 获取输入框的值
     * @returns {Object} - 包含 pickingCode 和 productBarcode 的对象
     * @private
     */
    getInputValues() {
        return {
            pickingCode: this.pickingCodeInput?.value.trim() || '',
            productBarcode: this.productBarcodeInput?.value.trim() || ''
        };
    }


    /**
     * 执行业务逻辑
     * @param {string} pickingCode - 拣货代码
     * @param {string} productBarcode - 产品代码
     * @param {string} eventType - 事件类型（keydown 或 click）
     */
    async executeBusinessLogic(pickingCode, productBarcode, eventType) {
        this.log('info', '调度器：开始执行业务逻辑');
        if (pickingCode || !productBarcode) {  //如果拣货单号有值不需要再往下处理
            this.log('info', '拣货单不为空，或者 barcode为空，不往下进行');
            return;
        }

        try {
            const pickingCode = await window.xAI.ProductBarcodeHandler.handleProductBarcodeSubmit(productBarcode, eventType);
            if (pickingCode !== null) {
                //查找到 barcode所在的拣货单，自动设置拣货单号
                const currentPickingCodeInput = document.querySelector(this.productBarcodeSelector);
                currentPickingCodeInput.value = pickingCode;
                this.log('info', '自动设置拣货单号完成');
            }
        } catch (error) {
            this.log('error', '业务逻辑执行失败:', error);
        }
    }

    /**
     * 日志输出
     * @param {string} level - 日志级别（info, warn, error）
     * @param {string} message - 日志消息
     * @param {...any} args - 附加参数
     * @private
     */
    log(level, message, ...args) {
        if (this.debugMode || level === 'error') {
            const timestamp = new Date().toISOString();
            console[level](`[ProductBarcodeEvent][${timestamp}] ${message}`, ...args);
        }
    }

    /**
     * 销毁实例
     */
    destroy() {
        this.disableListener();
        if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
        }
        this.productBarcodeInput = null;
        this.pickingCodeInput = null;
        this.submitButton = null;
        this.log('info', '产品代码事件拦截器已销毁');
    }
}

// 页面加载完成后初始化
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.xAI = window.xAI || {};
            window.xAI.ProductBarcodeEventInterceptor = new ProductBarcodeEventInterceptor();
        });
    } else {
        window.xAI = window.xAI || {};
        window.xAI.ProductBarcodeEventInterceptor = new ProductBarcodeEventInterceptor();
    }
} catch (error) {
    console.error('[ProductBarcodeEvent] 初始化失败:', error);
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductBarcodeEventInterceptor;
}
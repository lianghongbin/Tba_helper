/**
 * 产品代码输入事件拦截模块
 *
 * 功能说明：
 * 1. 拦截产品代码输入框的回车事件
 * 2. 调度业务逻辑处理
 *
 * 使用场景：
 * - 在易仓系统的产品代码输入页面
 * - 当用户输入产品代码后按回车时触发
 *
 * 作者：TBA FixKing
 * 创建时间：2025年
 */

class ProductBarcodeEventInterceptor {
    constructor(config = {}) {
        this.debugMode = config.debugMode ?? true;
        this.selector = config.selector || '#productBarcode';
        this.pickingCodeSeletcor = config.pickingCodeSelector || '#pickingCode';
        this.isListening = config.enableListening ?? true; // 监听开关，默认启用
        this.productBarcodeInput = null;
        this.pickingCodeInput = null;
        this.submitButton = null;
        this._isBound = false;
        this._observer = null;
        this.keydownHandler = null;
        this.clickHandler = null;

        this.tryInitialize();
    }

    tryInitialize() {
        try {
            this.productBarcodeInput = document.querySelector(this.selector);
            this.pickingCodeInput = document.querySelector(this.pickingCodeSeletcor)
            if (this.productBarcodeInput) {
                // 同时获取确认按钮（与输入框在同一块区域）
                this.submitButton = document.querySelector('.submitProduct');
                if (!this._isBound) {
                    this.bindEvents();
                    this._isBound = true;
                }
                this.log('info', `产品代码输入监听已就绪 (${this.selector})`);
                return;
            }

            // 未找到则静默等待 DOM 变更
            if (window.MutationObserver) {
                this._observer = new MutationObserver(() => {
                    const el = document.querySelector(this.selector);
                    if (el) {
                        this.productBarcodeInput = el;
                        this.submitButton = document.querySelector('.submitProduct');
                        if (!this._isBound) {
                            this.bindEvents();
                            this._isBound = true;
                        }
                        this._observer.disconnect();
                        this._observer = null;
                        this.log('info', `产品代码输入监听已绑定 (${this.selector})`);
                    }
                });
                // 限制观察范围，提升性能
                const container = document.querySelector('form, .container') || document.body;
                this._observer.observe(container, {childList: true, subtree: true});
            } else {
                this.log('error', 'MutationObserver 不支持，监听可能失败');
            }
        } catch (error) {
            this.log('error', '初始化产品代码监听失败:', error);
        }
    }

    bindEvents() {
        if (!this.isListening) {
            this.log('info', `监听开关已关闭，未绑定 ${this.selector} 回车监听`);
            return;
        }

        // 监听 keydown 事件，捕获 Enter 键
        this.keydownHandler = (event) => {
            if (event.key === 'Enter') {
                const pickingCode = this.pickingCodeInput.value.trim();
                const productBarcode = this.productBarcodeInput.value.trim();
                this.executeBusinessLogic(pickingCode, productBarcode, 'keydown').catch(() => {
                });
            }
        };
        this.productBarcodeInput.addEventListener('keydown', this.keydownHandler);
        this.log('info', `已绑定 ${this.selector} 回车监听`);

        // 监听“确认”按钮点击（同一 DOM 片段中的 .submitProduct）
        if (this.submitButton) {
            this.clickHandler = () => {
                const pickingCode = this.pickingCodeInput.value.trim();
                const productBarcode = this.productBarcodeInput.value.trim();
                this.executeBusinessLogic(pickingCode, productBarcode, 'click').catch(() => {
                });
            };
            this.submitButton.addEventListener('click', this.clickHandler);
            this.log('info', '已绑定 .submitProduct 点击监听');
        }
    }

    /**
     * 启用监听
     */
    enableListener() {
        if (this.isListening) {
            this.log('info', '监听已启用，无需重复启用');
            return;
        }
        this.isListening = true;
        if (this.productBarcodeInput && !this.keydownHandler) {
            this.bindEvents();
        }
        this.log('info', '产品代码监听已启用');
    }

    /**
     * 禁用监听
     */
    disableListener() {
        if (!this.isListening) {
            this.log('info', '监听已禁用，无需重复禁用');
            return;
        }
        this.isListening = false;
        if (this.productBarcodeInput && this.keydownHandler) {
            this.productBarcodeInput.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
            this.log('info', `已移除 ${this.selector} 回车监听`);
        }
        this.log('info', '产品代码监听已禁用');
    }

    /**
     * @param {string} pickingCode
     * @param {string} productBarcode
     * @param eventType
     * 执行业务逻辑
     */
    async executeBusinessLogic(pickingCode, productBarcode, eventType) {
        this.log('info', '调度器：开始执行业务逻辑');
        if (pickingCode !== null && pickingCode !== '') {
            this.log('info', '拣货单号: ' + pickingCode);
            return;
        }

        console.log('info', '拣货单号为空，走自动匹配拣货单逻辑.');
        const result = await window.xAI.ProductBarcodeHandler.handleProductBarcodeSubmit(productBarcode);
        if (result !== null) {
            this.pickingCodeInput.value = result;
            this.log('info', '设置拣货单号为：' + result);
        } else {
            this.log('info', '没有找到' + productBarcode + "对应的一票一件订单,自动拣货单结束.");
        }
    }

    /**
     * 日志输出
     */
    log(level, message, ...args) {
        if (this.debugMode || level === 'error') {
            console[level](`[ProductBarcodeEvent] ${message}`, ...args);
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
        if (this.submitButton && this.clickHandler) {
            this.submitButton.removeEventListener('click', this.clickHandler);
            this.clickHandler = null;
        }
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
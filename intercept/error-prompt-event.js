/**
 * 错误弹窗事件拦截模块
 *
 * 功能说明：
 * 1. 监听DOM变化，检测错误弹窗的出现
 * 2. 调度业务逻辑处理
 * 3. 管理处理状态
 *
 * 使用场景：
 * - 在易仓系统中自动检测错误弹窗
 * - 当检测到错误弹窗时，调度业务处理模块
 *
 * 作者：TBA FixKing
 * 创建时间：2025年
 */

class ErrorPromptEventInterceptor {
    constructor(config = {}) {
        this.debugMode = config.debugMode ?? true;
        this.dialogSelector = config.dialogSelector || '.ui-dialog';
        this.errorMessageSelector = config.errorMessageSelector || '.tip-error-message';
        this.observer = null;
        this.isProcessing = false;
        this.lastProcessedDialog = null;
        this.lastProcessedTime = 0;

        this.startDialogListener();
    }

    /**
     * 开始监听弹窗
     */
    startDialogListener() {
        try {
            // 防止重复启动监听器
            if (this.observer) {
                this.log('info', '弹窗监听器已存在，跳过重复启动');
                return;
            }

            // 重置所有状态
            this.isProcessing = false;
            this.lastProcessedDialog = null;
            this.lastProcessedTime = 0;

            // 使用 MutationObserver 监听 DOM 变化
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                this.handleAddedNode(node);
                            }
                        });
                    }
                });
            });

            // 限制观察范围，提升性能
            const container = document.querySelector('body, .container') || document.body;
            this.observer.observe(container, { childList: true, subtree: false });
            this.log('info', '弹窗监听器已启动');
        } catch (error) {
            this.log('error', '启动弹窗监听器失败:', error);
        }
    }

    /**
     * 处理新增的DOM节点
     */
    handleAddedNode(node) {
        // 检查是否是错误弹窗
        if (node instanceof HTMLElement && node.matches(this.dialogSelector)) {
            const errorMessage = node.querySelector(this.errorMessageSelector);
            if (errorMessage) {
                const errorText = errorMessage.textContent.trim();

                // 防重复处理
                if (this.isProcessing || (this.lastProcessedDialog === node && Date.now() - this.lastProcessedTime < 1000)) {
                    this.log('info', '正在处理中或重复弹窗，跳过处理:', errorText);
                    return;
                }

                this.lastProcessedDialog = node;
                this.lastProcessedTime = Date.now();
                this.log('info', '调度器：检测到错误弹窗:', errorText);

                // 调度业务逻辑处理
                this.scheduleErrorProcessing(errorText);
            }
        }
    }

    /**
     * 调度错误处理流程
     */
    async scheduleErrorProcessing(errorText) {
        try {
            this.isProcessing = true;
            const productBarcodeInput = document.querySelector('#productBarcode');
            const productBarcode = productBarcodeInput ? productBarcodeInput.value.trim() : '';
            this.log('info', '调度器：开始处理错误弹窗业务逻辑');

            await this.executeBusinessLogic(errorText, productBarcode);
            this.log('info', '调度器：错误弹窗业务逻辑处理完成');
        } catch (error) {
            this.log('error', '调度器：处理错误弹窗时出错:', error);
            alert('系统错误：无法处理错误弹窗，请联系管理员');
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 执行业务逻辑
     */
    async executeBusinessLogic(errorText, productBarcode) {
        this.log('info', '调度器：调用业务处理模块');
        if (window.xAI && window.xAI.ErrorPromptHandler) {
            await window.xAI.ErrorPromptHandler.handleErrorPrompt(errorText, productBarcode);
        } else {
            this.log('error', '调度器：ErrorPromptHandler 模块未找到');
            throw new Error('ErrorPromptHandler 未加载');
        }
    }

    /**
     * 停止监听
     */
    stopDialogListener() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
            this.log('info', '弹窗监听器已停止');
        }
    }

    /**
     * 日志输出
     */
    log(level, message, ...args) {
        if (this.debugMode || level === 'error') {
            console[level](`[ErrorPromptEvent] ${message}`, ...args);
        }
    }

    /**
     * 销毁实例
     */
    destroy() {
        this.stopDialogListener();
        this.log('info', '错误弹窗事件拦截器已销毁');
    }
}

// 页面加载完成后初始化
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.xAI = window.xAI || {};
            window.xAI.ErrorPromptEventInterceptor = new ErrorPromptEventInterceptor();
        });
    } else {
        window.xAI = window.xAI || {};
        window.xAI.ErrorPromptEventInterceptor = new ErrorPromptEventInterceptor();
    }
} catch (error) {
    console.error('[ErrorPromptEvent] 初始化失败:', error);
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorPromptEventInterceptor;
}
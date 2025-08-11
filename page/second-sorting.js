/**
 * 二次分拣处理器模块
 *
 * 功能说明：
 * 1. 直接在页面上渲染二次分拣表单
 * 2. 接收来自 error-prompt-handler 的 productBarcode 和 pickingCode
 * 3. 处理二次分拣的业务逻辑
 * 4. 管理页面状态和用户交互
 *
 * 使用场景：
 * - 当 error-prompt-handler 检测到需要二次分拣的情况时
 * - 自动显示二次分拣表单并填充相关数据
 * - 处理二次分拣的完整业务流程
 *
 * 作者：TBA FixKing
 * 创建时间：2025年
 */

class SecondSortingHandler {
    constructor(config = {}) {
        this.debugMode = config.debugMode ?? true;
        this.currentData = null;
        this.isPageLoaded = false;
        this.virtualPage = null; // 虚拟页面环境
        this.virtualDocument = null; // 虚拟页面的document对象
        this.init();
    }

    init() {
        // 将实例挂载到全局命名空间
        window.xAI = window.xAI || {};
        window.xAI.SecondSortingHandler = this;
        this.log('info', '二次分拣处理器已初始化');

        // 初始化时加载二次分拣页面
        this.loadVirtualPage();
    }

    result = {state:0, message:'', data:''}

    /**
     * 加载虚拟页面
     */
    async loadVirtualPage() {
        try {
            this.log('info', '开始加载二次分拣页面到虚拟环境...');

            // 1. 创建一个 iframe 来加载页面
            const iframe = document.createElement('iframe');
            // 设置样式以确保它不可见
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            iframe.src = 'https://yzt.wms.yunwms.com/shipment/orders-pack/sorting?quick=104';

            // 2. 监听 iframe 的加载完成事件
            await new Promise(resolve => iframe.onload = resolve);
            console.log('页面已加载到 iframe 中');
            // 3. 获取 iframe 的文档对象
            this.virtualDocument = iframe.contentDocument;

            this.log('info', '二次分拣页面已加载到虚拟环境');
            this.log('info', '虚拟页面标题:', this.virtualDocument.title);

        } catch (error) {
            this.log('error', '加载虚拟页面失败:', error);
        }
    }


    /**
     * 处理二次分拣的主要业务逻辑
     * @param {{pickingCode, productBarcode}} data
     * @return {state,message,data} - 返回数据
     */
    async handleSecondSorting(data) {
        try {
            await this.log('info', '开始处理二次分拣业务逻辑');
            await this.log('info', '接收到的数据:', data);

            // 保存当前数据
            this.currentData = data;

            //设置 pickingCode值
            await this.pickingCodeInput(data.pickingCode);
            // 自动点击"开始配货"按钮
            await this.autoClickSubmitPicking();

            //检查开始配货的状态，如果出错直接返回错误数据。
            const result = await this.checkSubmitResult();
            if (result.state!==0) {
                return result;
            }

            //拣货单正常的话就赋值 barcode
            await this.printProductBarcode(data.productBarcode);

            await this.log('info', '二次分拣业务逻辑处理完成');
            return {
                state:0,
                message: '二次分拣页面数据已更新',
                data: ''
            };

        } catch (error) {
            await this.log('error', '处理二次分拣业务逻辑时出错:', error);
            return {
                success: false,
                message: '处理二次分拣时出错',
                type: 'error',
                error: error.message
            };
        }
    }


    /**
     * 为 pickingCode 赋值
     * @param pickingCode
     * @return {Promise<void>}
     */
    async pickingCodeInput(pickingCode) {
        // 在虚拟页面上查找输入框
        const pickingCodeInput = this.virtualDocument.querySelector('#pickingCode');

        // 在虚拟页面上填充拣货单号
        pickingCodeInput.value = pickingCode;
        await this.log('info', 'pickingCode 赋值完成。');
    }

    /**
     * 为 productBarcode 赋值,打印
     * @param productBarcode
     * @return {Promise<void>}
     */
    async printProductBarcode(productBarcode) {
        // 在虚拟页面上查找输入框
        const productBarcodeInput = this.virtualDocument.querySelector('#productBarcode');

        // 在虚拟页面上填充拣货单号
        productBarcodeInput.value = productBarcode;
        await this.log('info', 'productBarcode 赋值完成。');

        //在输入框里回车
        if (productBarcodeInput) {
            const enterEvent = new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                key: 'Enter',
                code: 'Enter',
                keyCode: 13
            });
            productBarcodeInput.dispatchEvent(enterEvent);
        }
    }

    /**
     * 自动点击"开始配货"按钮
     */
    async autoClickSubmitPicking() {
        try {
            // 在虚拟页面上查找"开始配货"按钮
            const submitPickingBtn = this.virtualDocument.querySelector('#submitPicking');
            // 在虚拟页面上点击按钮
            submitPickingBtn.click();

            await this.log('info', '"开始配货"按钮已在虚拟页面上自动点击');
        } catch (error) {
            await this.log('error', '在虚拟页面上自动点击"开始配货"按钮时出错:', error);
        }
    }

    /**
     * 简单的提交结果检查方法
     * @return '{state:0,message:'',data:'' };
     */
    async checkSubmitResult() {
        try {
            // 在虚拟页面上检查是否有错误消息
            const errorMessage = this.virtualDocument.querySelector('#submitPicking-message');

            if (errorMessage && errorMessage.style.display !== 'none') {
                const messageText = errorMessage.textContent || errorMessage.innerText;

                await this.log('info', '在虚拟页面上检测到错误消息:', messageText);
                return {state:1, message:messageText, data:''};
            }

            return {
                state:0, message:'', data:''
            };
        } catch (error) {
            await this.log('error', '检查虚拟页面提交结果时出错:', error);
        }
    }

    /**
     * 发送结果到 error-prompt-handler
     * @param {string} level - 结果级别 (error 或 info)
     * @param {string} message - 结果消息
     * @param {string} data - 业务数据
     */
    async sendResultToErrorPromptHandler(level, message, data) {
        try {
            window.xAI.ErrorPromptHandler.handleSecondSortingResult(level, message, data);

            await this.log('info', `结果已发送到 error-prompt-handler: ${level} - ${message}`);

        } catch (error) {
            await this.log('error', '发送结果到 error-prompt-handler 时出错:', error);
        }
    }

    /**
     * 关闭二次分拣页面
     */
    async closeSecondSortingPage() {
        // 清理虚拟页面资源
        if (this.virtualPage) {
            this.virtualPage = null;
            this.virtualDocument = null;
            await this.log('info', '虚拟页面资源已清理');
        }

        // 移除所有临时消息
        const messages = document.querySelectorAll('.second-sorting-message');
        messages.forEach(msg => msg.remove());

        // 移除临时样式
        const style = document.querySelector('#second-sorting-message-style');
        if (style) {
            style.remove();
        }

        this.isPageLoaded = false;
        this.currentData = null;
        await this.log('info', '二次分拣页面已关闭');
    }

    /**
     * 日志输出
     */
    async log(level, message, ...args) {
        if (this.debugMode || level === 'error') {
            // 根据日志级别选择合适的 console 方法
            if (level === 'info') {
                console.info(`[SecondSortingHandler] ${message}`, ...args);
            } else if (level === 'error') {
                console.error(`[SecondSortingHandler] ${message}`, ...args);
            } else {
                console.log(`[SecondSortingHandler] ${message}`, ...args);
            }
        }
    }

    /**
     * 销毁实例
     */
    destroy() {
        this.closeSecondSortingPage();

        // 确保虚拟页面资源被清理
        if (this.virtualPage) {
            this.virtualPage = null;
            this.virtualDocument = null;
        }

        if (window.xAI && window.xAI.SecondSortingHandler) {
            delete window.xAI.SecondSortingHandler;
        }
        this.log('info', '二次分拣处理器已销毁');
    }
}

// 页面加载完成后初始化
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new SecondSortingHandler();
        });
    } else {
        new SecondSortingHandler();
    }
} catch (error) {
    console.error('[SecondSortingHandler] 初始化失败:', error);
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecondSortingHandler;
}

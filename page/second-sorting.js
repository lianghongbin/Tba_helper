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
    static instance = null;
    static STORAGE_KEY = 'SecondSortingHandler_Init';
    static STORAGE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时有效期
    static VERSION = '1.0.0';

    constructor(config = {}) {
        // 检查 localStorage 初始化状态
        const initState = localStorage.getItem(SecondSortingHandler.STORAGE_KEY);
        if (initState) {
            try {
                const { timestamp } = JSON.parse(initState);
                if (Date.now() - timestamp < SecondSortingHandler.STORAGE_EXPIRY) {
                    if (SecondSortingHandler.instance) {
                        console.log('[SecondSortingHandler] 返回现有实例，localStorage 已记录初始化', {
                            instanceId: SecondSortingHandler.instance.instanceId
                        });
                        return SecondSortingHandler.instance;
                    }
                } else {
                    localStorage.removeItem(SecondSortingHandler.STORAGE_KEY);
                }
            } catch (error) {
                console.warn('[SecondSortingHandler] localStorage 解析失败，清理状态:', error);
                localStorage.removeItem(SecondSortingHandler.STORAGE_KEY);
            }
        }

        if (SecondSortingHandler.instance) {
            console.log('[SecondSortingHandler] 返回现有实例', {
                instanceId: SecondSortingHandler.instance.instanceId
            });
            return SecondSortingHandler.instance;
        }
        SecondSortingHandler.instance = this;

        this.debugMode = config.debugMode ?? true;
        this.currentData = null;
        this.isPageLoaded = false;
        this.isLoadingVirtualPage = false;
        this.virtualPage = null;
        this.virtualDocument = null;
        this.instanceId = `SecondSortingHandler_${Date.now()}`;
        this.lastHandleSecondSorting = 0;
        this.log('info', '创建新实例', { instanceId: this.instanceId, stack: new Error().stack });

        // 心跳：定期刷新本地状态，便于健康检查与并发判断
        try {
            this._heartbeatTimer = setInterval(() => {
                try {
                    localStorage.setItem(SecondSortingHandler.STORAGE_KEY, JSON.stringify({
                        version: SecondSortingHandler.VERSION,
                        instanceId: this.instanceId,
                        lastHeartbeat: Date.now(),
                    }));
                } catch (e) {}
            }, 10000);
            // 初始写入一次
            localStorage.setItem(SecondSortingHandler.STORAGE_KEY, JSON.stringify({
                version: SecondSortingHandler.VERSION,
                instanceId: this.instanceId,
                lastHeartbeat: Date.now(),
            }));
        } catch (e) {}

        // 绑定快捷键事件
        this.onKeyDown = this.onKeyDown.bind(this);
        document.addEventListener('keydown', this.onKeyDown);

        // 窗口卸载时清理
        this.onBeforeUnload = this.onBeforeUnload.bind(this);
        window.addEventListener('beforeunload', this.onBeforeUnload, { once: true });

        // 将实例挂到全局对象，便于调试
        window.xAI = window.xAI || {};
        window.xAI.SecondSortingHandler = this;

        // 自动加载虚拟页面
        this.log('info', '准备初始化虚拟页面', { instanceId: this.instanceId });
        this.initVirtualPage();

        // 存储初始化状态
        try {
            localStorage.setItem(SecondSortingHandler.STORAGE_KEY, JSON.stringify({
                timestamp: Date.now(),
                instanceId: this.instanceId
            }));
        } catch (error) {
            this.log('error', '写入 localStorage 初始化状态失败:', error.message);
        }
    }

    /**
     * 初始化虚拟页面
     */
    async initVirtualPage() {
        this.log('info', 'initVirtualPage 调用栈:', new Error().stack, { instanceId: this.instanceId });
        try {
            await this.loadVirtualPage();
        } catch (error) {
            this.log('error', '初始化加载虚拟页面失败:', error.message);
        }
    }

    /**
     * 加载虚拟页面
     * @returns {Promise<boolean>}
     */
    async loadVirtualPage() {
        this.log('info', 'loadVirtualPage 调用栈:', new Error().stack, { instanceId: this.instanceId });
        if (this.isLoadingVirtualPage) {
            this.log('warn', '虚拟页面正在加载中，跳过重复调用', { instanceId: this.instanceId });
            return false;
        }
        if (this.isPageLoaded && this.virtualDocument) {
            this.log('info', '虚拟页面已加载，跳过重复加载', { instanceId: this.instanceId });
            return true;
        }

        let iframe = null;
        try {
            this.isLoadingVirtualPage = true;
            const startTime = Date.now();
            this.log('info', '开始加载二次分拣页面到虚拟环境...', { instanceId: this.instanceId });

            iframe = document.createElement('iframe');
            Object.assign(iframe.style, {
                display: 'none',
                position: 'absolute',
                width: '0',
                height: '0',
                border: '0'
            });

            const pageUrl = 'http://yzt.wms.yunwms.com/shipment/orders-pack/sorting?quick=104';
            try {
                new URL(pageUrl);
            } catch {
                throw new Error('Invalid URL provided');
            }

            iframe.setAttribute('data-active', 'true');
            iframe.setAttribute('data-owner', this.instanceId);
            iframe.src = pageUrl;
            document.body.appendChild(iframe);

            await Promise.race([
                new Promise((resolve, reject) => {
                    iframe.onload = () => resolve(true);
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('iframe 加载超时')), 30000))
            ]);

            this.virtualPage = iframe;
            this.virtualDocument = iframe.contentDocument;

            if (!this.virtualDocument) {
                this.log('warn', 'iframe.contentDocument 不可用（可能跨域），将以最小能力工作', {
                    instanceId: this.instanceId
                });
            } else {
                try {
                    const title = this.virtualDocument.title || '(no title)';
                    const readyState = this.virtualDocument.readyState;
                    this.log('info', '虚拟页面加载完成', { title, readyState, instanceId: this.instanceId });

                    const productInput = this.virtualDocument.querySelector('#productBarcode');
                    if (!productInput) {
                        this.log('warn', '未找到 #productBarcode，页面结构可能变化', { instanceId: this.instanceId });
                    }
                } catch (e) {
                    this.log('warn', '访问虚拟文档失败（可能跨域）', e?.message);
                }

                try {
                    const oldIframe = document.body.querySelector(`iframe[src="${pageUrl}"]:not([data-active])`);
                    if (oldIframe && oldIframe !== iframe) {
                        oldIframe.remove();
                    }
                } catch {}
            }

            const elapsed = Date.now() - startTime;
            this.isPageLoaded = true;
            this.log('info', `二次分拣页面加载成功，耗时 ${elapsed}ms`, { instanceId: this.instanceId });
            return true;
        } catch (error) {
            this.isPageLoaded = false;
            this.log('error', '加载虚拟页面失败:', error.message, { instanceId: this.instanceId });
            if (iframe && iframe.parentNode) {
                try { iframe.remove(); } catch {}
            }
            return false;
        } finally {
            this.isLoadingVirtualPage = false;
        }
    }

    /**
     * 监听键盘事件
     * @param {KeyboardEvent} e
     */
    onKeyDown(e) {
        try {
            const isCtrlSpace = (e.ctrlKey || e.metaKey) && (e.key === ' ' || e.code === 'Space');
            const isEscape = e.key === 'Escape';
            if (isCtrlSpace) {
                e.preventDefault();
                this.handleSecondSorting({ productBarcode: '', pickingCode: '' });
                return;
            }
            if (isEscape) {
                this.closeSecondSortingPage();
                return;
            }
        } catch (error) {
            this.log('error', '键盘事件处理异常:', error.message, { instanceId: this.instanceId });
        }
    }

    /**
     * 处理二次分拣业务
     * @param {{productBarcode:string, pickingCode:string}} data
     */
    async handleSecondSorting(data) {
        const now = Date.now();
        if (now - this.lastHandleSecondSorting < 300) {
            this.log('warn', '二次分拣触发过于频繁，已节流', { instanceId: this.instanceId });
            return;
        }
        this.lastHandleSecondSorting = now;

        try {
            this.currentData = data;
            if (!this.isPageLoaded) {
                const ok = await this.loadVirtualPage();
                if (!ok) {
                    this.log('error', '虚拟页面加载失败，无法继续处理分拣');
                    return;
                }
            }

            try {
                // 尝试在虚拟文档中填充并提交
                const doc = this.virtualDocument;
                if (doc) {
                    const productInput = doc.querySelector('#productBarcode');
                    const codeInput = doc.querySelector('#pickingCode');
                    if (productInput) productInput.value = data.productBarcode || '';
                    if (codeInput) codeInput.value = data.pickingCode || '';
                    const submitBtn = doc.querySelector('button[type="submit"], .submit, #submitSorting');
                    submitBtn?.click?.();
                } else {
                    // 跨域：降级处理（这里只做演示日志）
                    this.log('warn', '跨域环境：无法直接对虚拟文档操作，已跳过表单填充', { instanceId: this.instanceId });
                }
            } catch (error) {
                this.log('warn', '在虚拟页面中填充/提交时出现异常:', error.message);
            }

            this.showMessage('二次分拣请求已提交', 'info');
            this.log('info', '开始处理二次分拣业务逻辑', { instanceId: this.instanceId });
            this.log('info', '接收到的数据:', data, { instanceId: this.instanceId });

        } catch (error) {
            this.log('error', '处理二次分拣失败:', error.message, { instanceId: this.instanceId });
            this.showMessage('处理分拣失败：' + error.message, 'error');
        }
    }

    /**
     * 复用前的健康检查
     * @returns {{ok:boolean, reason?:string}}
     */
    healthCheck() {
        try {
            // 形状检查
            const needMethods = ['log'];
            for (const m of needMethods) {
                if (typeof this[m] !== 'function') return { ok: false, reason: 'missing:' + m };
            }

            // 本地存储版本与心跳
            const raw = localStorage.getItem(SecondSortingHandler.STORAGE_KEY);
            if (!raw) return { ok: false, reason: 'noLocal' };
            let parsed;
            try { parsed = JSON.parse(raw) || {}; } catch { return { ok: false, reason: 'localParse' }; }
            if (parsed.version && parsed.version !== SecondSortingHandler.VERSION) {
                return { ok: false, reason: 'version' };
            }
            if (!Number.isFinite(+parsed.lastHeartbeat)) {
                return { ok: false, reason: 'heartbeatInvalid' };
            }
            if (Date.now() - parsed.lastHeartbeat > SecondSortingHandler.STORAGE_EXPIRY / 2) {
                return { ok: false, reason: 'stale' };
            }
            if (parsed.instanceId && this.instanceId && parsed.instanceId !== this.instanceId) {
                return { ok: false, reason: 'instanceMismatch' };
            }

            // DOM 依赖
            if (this.virtualPage && !document.contains(this.virtualPage)) {
                return { ok: false, reason: 'virtualPageRemoved' };
            }
            if (this.iframe && !document.contains(this.iframe)) {
                return { ok: false, reason: 'iframeRemoved' };
            }
            if (this.virtualDocument && this.virtualDocument.defaultView == null) {
                return { ok: false, reason: 'docViewLost' };
            }

            // 处置状态
            if (this.disposed === true) return { ok: false, reason: 'disposed' };

            return { ok: true };
        } catch (e) {
            return { ok: false, reason: 'exception:' + (e && e.message || 'unknown') };
        }
    }

    /**
     * 展示消息（简单的页面提示）
     * @param {string} text
     * @param {'info'|'error'|'warn'} type
     */
    showMessage(text, type = 'info') {
        const id = 'second-sorting-message-style';
        if (!document.getElementById(id)) {
            const style = document.createElement('style');
            style.id = id;
            style.textContent = `
            .second-sorting-message {
                position: fixed;
                z-index: 999999;
                bottom: 20px;
                right: 20px;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                color: #fff;
                box-shadow: 0 6px 16px rgba(0,0,0,.2);
                opacity: .98;
            }
            .second-sorting-message.info { background: #1677ff; }
            .second-sorting-message.warn { background: #faad14; }
            .second-sorting-message.error { background: #ff4d4f; }
          `;
            document.head.appendChild(style);
        }
        const el = document.createElement('div');
        el.className = `second-sorting-message ${type}`;
        el.textContent = text;
        document.body.appendChild(el);
        setTimeout(() => {
            try { el.remove(); } catch {}
        }, 2600);
    }

    /**
     * 关闭二次分拣页面
     * @returns {Promise<void>}
     */
    async closeSecondSortingPage() {
        if (this.virtualPage) {
            this.virtualPage.remove();
            this.virtualPage = null;
            this.virtualDocument = null;
            this.isPageLoaded = false;
            this.log('info', '虚拟页面资源已清理', { instanceId: this.instanceId });
        }

        const messages = document.querySelectorAll('.second-sorting-message');
        messages.forEach(msg => msg.remove());

        const style = document.querySelector('#second-sorting-message-style');
        if (style) {
            style.remove();
        }

        this.currentData = null;
        this.log('info', '二次分拣页面已关闭', { instanceId: this.instanceId });
    }

    /**
     * 日志输出
     * @param {string} level - 日志级别 (info, error, warn)
     * @param {string} message - 日志消息
     * @param {...any} args - 额外参数
     */
    log(level, message, ...args) {
        if (!this.debugMode && level !== 'error') return;
        const logMethods = {
            info: console.info,
            error: console.error,
            warn: console.warn,
            log: console.log
        };
        const fn = logMethods[level] || console.log;
        try {
            fn(`[SecondSortingHandler][${level}] ${message}`, ...args);
        } catch (error) {
            console.log('[SecondSortingHandler] 日志输出失败', error);
        }
    }

    /**
     * 页面卸载时清理
     */
    onBeforeUnload() {
        try {
            document.removeEventListener('keydown', this.onKeyDown);
            window.removeEventListener('beforeunload', this.onBeforeUnload);
        } catch {}
        try {
            clearInterval(this._heartbeatTimer);
        } catch {}

        try {
            const initState = localStorage.getItem(SecondSortingHandler.STORAGE_KEY);
            if (initState) {
                const obj = JSON.parse(initState);
                if (obj && obj.instanceId === this.instanceId) {
                    localStorage.removeItem(SecondSortingHandler.STORAGE_KEY);
                }
            }
        } catch {}

        this.currentData = null;
        this.log('info', '清理完成', { instanceId: this.instanceId });
    }
}

// 页面加载完成后初始化（含健康检查与本地状态校验）
try {
    const boot = () => {
        const reuseIfHealthy = () => {
            const inst = SecondSortingHandler.instance;
            if (inst && typeof inst.healthCheck === 'function') {
                const { ok, reason } = inst.healthCheck();
                if (ok) {
                    window.xAI = window.xAI || {};
                    window.xAI.SecondSortingHandler = inst;
                    console.log('[SecondSortingHandler] 复用现有实例');
                    return true;
                } else {
                    console.warn('[SecondSortingHandler] 现有实例不健康，原因:', reason, '，将重建');
                    try { inst.closeSecondSortingPage?.(); } catch {}
                }
            }
            return false;
        };

        let reused = false;
        try { reused = reuseIfHealthy(); } catch {}

        if (!reused) {
            // 校验 localStorage 记录新鲜度
            try {
                const raw = localStorage.getItem(SecondSortingHandler.STORAGE_KEY);
                if (raw) {
                    try {
                        const { lastHeartbeat } = JSON.parse(raw) || {};
                        if (!Number.isFinite(+lastHeartbeat) || (Date.now() - lastHeartbeat) > SecondSortingHandler.STORAGE_EXPIRY) {
                            localStorage.removeItem(SecondSortingHandler.STORAGE_KEY);
                        }
                    } catch {
                        localStorage.removeItem(SecondSortingHandler.STORAGE_KEY);
                    }
                }
            } catch {}

            // 新建实例
            SecondSortingHandler.instance = new SecondSortingHandler();
            window.xAI = window.xAI || {};
            window.xAI.SecondSortingHandler = SecondSortingHandler.instance;
            console.log('[SecondSortingHandler] 已新建实例');
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
} catch (error) {
    console.error('[SecondSortingHandler] 初始化失败:', error);
    try { localStorage.removeItem(SecondSortingHandler.STORAGE_KEY); } catch {}
}
// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecondSortingHandler;
}
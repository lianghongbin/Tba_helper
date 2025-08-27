/**
 * second-sorting.js
 * 二次分拣处理器（硬占位 + 提前挂载 + 互斥锁 + 完整实现 + JSDoc + 日志 + 按钮监控）
 *
 * 目标：保证任意时刻 `window.xAI.SecondSortingHandler` 都存在，彻底消除“未找到模块”的报错；
 *      同时不改变原有业务流程，只做可靠性与可观测性增强。
 */

// ----------【硬占位：脚本一执行立刻可见】--------------------------------------
(function hardPlaceholderInstall() {
    try {
        window.xAI = window.xAI || {};
        if (!window.xAI.SecondSortingHandler || window.xAI.SecondSortingHandler.__isPlaceholder) {
            const queue = [];
            let _resolveReady;
            const readyPromise = new Promise(res => {
                _resolveReady = res;
            });
            // 暴露可 await 的就绪 Promise
            window.xAI.SecondSortingReadyPromise = readyPromise;
            // 记下 resolver，方便真实实例在任意时刻触发
            window.__SecondSorting_ready_resolver = _resolveReady;
            window.xAI.SecondSortingHandler = {
                __isPlaceholder: true,
                __queue: queue,
                ready: () => readyPromise,
                // 先把常用方法占位，调用记录进队列
                handleSecondSorting: (...args) => queue.push(['handleSecondSorting', args]),
                pickingCodeInput: (...args) => queue.push(['pickingCodeInput', args]),
                printProductBarcode: (...args) => queue.push(['printProductBarcode', args]),
                autoClickSubmitPicking: (...args) => queue.push(['autoClickSubmitPicking', args]),
                checkSubmitResult: (...args) => queue.push(['checkSubmitResult', args]),
                sendResultToErrorPromptHandler: (...args) => queue.push(['sendResultToErrorPromptHandler', args]),
                setLogLevel: (...args) => queue.push(['setLogLevel', args]),
                closeSecondSortingPage: (...args) => queue.push(['closeSecondSortingPage', args]),
            };
            // 立即可见：任何时刻检查都为 true
        }
    } catch (_) {
    }
})();

(function () {
    // 不再限制仅在顶层窗口执行——以防 ErrorPromptHandler 在子 frame 中运行
    //if (window.top !== window) return;

    /* -------------------------------------------------------------------------- */
    /*                               常量与全局标记                                */
    /* -------------------------------------------------------------------------- */
    const GLOBAL_BOOT_PROMISE = '__SecondSorting_boot_promise__';
    const LOCK_KEY = 'SecondSortingHandler:bootLock';
    const LOCK_TTL = 8000; // 8s 互斥锁有效期

    /* ---------------------------------- Logger --------------------------------- */
    class Logger {
        /**
         * @param {string} name 名称
         * @param {'silent'|'error'|'warn'|'info'|'debug'} level 等级
         */
        constructor(name, level = 'info') {
            this.name = name;
            this.setLevel(level);
        }

        static ranks = {silent: 0, error: 1, warn: 2, info: 3, debug: 4};

        /** @param {'silent'|'error'|'warn'|'info'|'debug'} level */
        setLevel(level) {
            this.level = (level || 'info').toLowerCase();
            this.rank = Logger.ranks[this.level] ?? Logger.ranks.info;
        }

        _ok(lvl) {
            return Logger.ranks[lvl] <= this.rank;
        }

        _ts() {
            try {
                return (new Date()).toISOString().split('T')[1].replace('Z', '');
            } catch {
                return '';
            }
        }

        _fmt(lvl, msg, ctx) {
            const ts = this._ts();
            const p = `[SecondSortingHandler][${lvl}]${ts ? `[${ts}]` : ''}`;
            return [p + ' ' + msg, ctx].filter(Boolean);
        }

        debug(msg, ctx) {
            if (this._ok('debug')) console.debug(...this._fmt('debug', msg, ctx));
        }

        info(msg, ctx) {
            if (this._ok('info')) console.info(...this._fmt('info', msg, ctx));
        }

        warn(msg, ctx) {
            if (this._ok('warn')) console.warn(...this._fmt('warn', msg, ctx));
        }

        error(msg, ctx) {
            if (this._ok('error')) console.error(...this._fmt('error', msg, ctx));
        }
    }

    const bootLogger = new Logger('SecondSortingHandler', (localStorage.getItem('SecondSortingHandler:logLevel') || 'info'));

    /* ------------------------------ 本地存储互斥锁 ------------------------------ */
    function now() {
        return Date.now();
    }

    function uuid() {
        try {
            return crypto.randomUUID();
        } catch {
            return String(now()) + Math.random().toString(16).slice(2);
        }
    }

    /**
     * 申请互斥锁：LOCK_TTL 内仅允许一个持锁者初始化
     * @returns {string|null} 成功返回 token；失败返回 null
     */
    function acquireLock() {
        try {
            const token = uuid();
            const cur = now();
            const raw = localStorage.getItem(LOCK_KEY);
            if (raw) {
                try {
                    const obj = JSON.parse(raw) || {};
                    const ts = Number(obj.ts) || 0;
                    if (cur - ts < LOCK_TTL) return null;
                } catch {
                }
            }
            localStorage.setItem(LOCK_KEY, JSON.stringify({token, ts: cur}));
            const chk = localStorage.getItem(LOCK_KEY);
            if (chk) {
                const obj2 = JSON.parse(chk) || {};
                if (obj2.token === token) return token;
            }
        } catch {
        }
        return null;
    }

    /** 释放互斥锁（仅持有者可释放） */
    function releaseLock(token) {
        try {
            const raw = localStorage.getItem(LOCK_KEY);
            if (!raw) return;
            const obj = JSON.parse(raw) || {};
            if (obj.token === token) localStorage.removeItem(LOCK_KEY);
        } catch {
        }
    }

    /**
     * @class SecondSortingHandler
     * @description 二次分拣处理器：保留既有业务流程；可控日志；按钮监控；互斥锁；占位/就绪。
     */
    class SecondSortingHandler {
        /**
         * @param {{debugMode?:boolean, logLevel?:'silent'|'error'|'warn'|'info'|'debug'}} [config]
         */
        constructor(config = {}) {
            // 日志
            this.debugMode = config.debugMode ?? true;
            const storedLevel = (localStorage.getItem('SecondSortingHandler:logLevel') || '').toLowerCase() || null;
            const level = config.logLevel || storedLevel || (this.debugMode ? 'info' : 'error');
            this._logger = new Logger('SecondSortingHandler', level);

            // 状态
            this.currentData = null;
            this.isPageLoaded = false;
            this.virtualPage = null;       // iframe 节点
            this.virtualDocument = null;   // iframe 的 document
            this._buttonsMonitored = false;// 是否已绑定按钮监听（避免重复）

            // 立即替换占位并接管队列（保证“马上可用”）
            this._earlyAttachAndAdoptQueue();

            // 延迟到 DOM 可用再加载虚拟页面（避免 document_start 阶段无 body）
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.loadVirtualPage(), {once: true});
            } else {
                this.loadVirtualPage();
            }
        }

        /** 提前挂载到 window.xAI，并承接占位队列 */
        _earlyAttachAndAdoptQueue() {
            try {
                window.xAI = window.xAI || {};
                const prev = window.xAI.SecondSortingHandler;
                window.xAI.SecondSortingHandler = this;
                if (prev && prev.__isPlaceholder && Array.isArray(prev.__queue)) {
                    // flush 占位期间积压的调用
                    while (prev.__queue.length) {
                        const [name, args] = prev.__queue.shift();
                        try {
                            this[name]?.apply(this, args);
                        } catch (e) {
                            this.log('warn', '占位调用转发异常', {name, err: e?.message});
                        }
                    }
                }
                this.log('info', '二次分拣处理器已挂载（真实实例）');
            } catch (e) {
                try {
                    console.error('[SecondSortingHandler] 真实实例挂载失败:', e);
                } catch {
                }
            }
        }

        /** @type {{state:number,message:string,data:string}} */
        result = {state: 0, message: '', data: ''};

        /**
         * 加载虚拟页面（隐藏 iframe）
         * - URL 保持业务不变
         * - 首次加载失败不会抛出到外层，按日志告警
         * @returns {Promise<void>}
         */
        async loadVirtualPage() {
            try {
                this.log('info', '开始加载二次分拣页面到虚拟环境...');
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
                iframe.src = 'http://yzt.wms.yunwms.com/shipment/orders-pack/sorting?quick=104';

                await new Promise((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error('iframe 加载超时')), 30000);
                    iframe.onload = () => {
                        clearTimeout(timer);
                        resolve();
                    };
                    iframe.onerror = () => {
                        clearTimeout(timer);
                        reject(new Error('iframe onerror'));
                    };
                });

                this.virtualPage = iframe;
                this.virtualDocument = iframe.contentDocument;
                this.isPageLoaded = true;

                this.log('info', '二次分拣页面已加载到虚拟环境', {
                    title: this.virtualDocument?.title,
                    readyState: this.virtualDocument?.readyState
                });

                this._attachButtonMonitors();

                // 触发就绪：通知外部 & 兑现早期 ready promise
                try {
                    window.dispatchEvent(new CustomEvent('SecondSortingHandler:ready', {detail: {ts: Date.now()}}));
                    // 兑现全局 ready promise（如果存在）
                    if (typeof window.__SecondSorting_ready_resolver === 'function') {
                        window.__SecondSorting_ready_resolver(this);
                        window.__SecondSorting_ready_resolver = null;
                    }
                } catch {
                }
            } catch (error) {
                this.isPageLoaded = false;
                this.log('error', '加载虚拟页面失败', {err: error?.message || error});
                try {
                    if (this.virtualPage && this.virtualPage.parentNode) this.virtualPage.remove();
                } catch {
                }
                this.virtualPage = null;
                this.virtualDocument = null;
            }
        }

        /**
         * 绑定按钮按下监控（click / keydown Enter）—— 仅绑定一次
         * @private
         */
        _attachButtonMonitors() {
            if (this._buttonsMonitored) return;
            const doc = this.virtualDocument;
            if (!doc) {
                this.log('warn', '虚拟文档不可用，无法绑定按钮监控（可能跨域）');
                return;
            }

            const submitBtn = doc.querySelector('#submitPicking');
            if (submitBtn) {
                submitBtn.addEventListener('click', (e) => {
                    const tgt = e.currentTarget;
                    this.log('info', '按钮点击：#submitPicking', {
                        id: tgt?.id, name: tgt?.name, text: (tgt?.textContent || '').trim()
                    });
                }, {capture: true});

                submitBtn.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.code === 'Enter' || e.keyCode === 13) {
                        const tgt = e.currentTarget;
                        this.log('info', '按钮按下回车：#submitPicking', {
                            id: tgt?.id, name: tgt?.name, text: (tgt?.textContent || '').trim()
                        });
                    }
                }, {capture: true});
            }

            doc.addEventListener('click', (e) => {
                const el = e.target;
                const isButton = el && (
                    el.tagName === 'BUTTON' ||
                    (el.getAttribute && el.getAttribute('role') === 'button') ||
                    el.type === 'button' || el.type === 'submit'
                );
                if (!isButton) return;
                this.log('debug', '按钮点击（全局捕获）', {
                    id: el.id, name: el.name, type: el.type, text: (el.textContent || '').trim()
                });
            }, true);

            this._buttonsMonitored = true;
            this.log('info', '按钮按下事件监控已绑定');
        }

        /**
         * 处理二次分拣业务（保留原流程）
         * @param {{pickingCode:string, productBarcode:string}} data
         * @return {Promise<{state:number,message:string,data:string}|{success:boolean,message:string,type:string,error:string}>}
         */
        async handleSecondSorting(data) {
            try {
                this.log('info', '开始处理二次分拣业务逻辑', {data});
                this.currentData = data;

                // 如果尚未加载虚拟页，这里兜底加载
                if (!this.isPageLoaded) {
                    const ok = await this.loadVirtualPage();
                    if (!this.isPageLoaded) {
                        this.log('error', '虚拟页面未就绪，无法继续处理');
                        return {state: 1, message: '虚拟页面未就绪', data: ''};
                    }
                }

                await this.pickingCodeInput(data.pickingCode);
                await this.autoClickSubmitPicking();
                const result = await this.checkSubmitResult();
                if (result.state !== 0) {
                    return result;
                }
                await this.printProductBarcode(data.productBarcode);

                this.log('info', '二次分拣业务逻辑处理完成');
                return {state: 0, message: '二次分拣页面数据已更新', data: ''};
            } catch (error) {
                this.log('error', '处理二次分拣业务逻辑时出错:', {err: error?.message || String(error)});
                return {
                    success: false,
                    message: '处理二次分拣时出错',
                    type: 'error',
                    error: error?.message || String(error)
                };
            }
        }

        /**
         * 为 pickingCode 赋值（保留原逻辑）
         * @param {string} pickingCode
         * @return {Promise<void>}
         */
        async pickingCodeInput(pickingCode) {
            const doc = this.virtualDocument;
            if (!doc) {
                this.log('warn', '虚拟文档不可用，无法设置 pickingCode');
                return;
            }
            const input = doc.querySelector('#pickingCode');
            if (!input) {
                this.log('warn', '未找到 #pickingCode 输入框');
                return;
            }
            input.value = pickingCode;
            this.log('info', 'pickingCode 赋值完成');
        }

        /**
         * 为 productBarcode 赋值并触发回车（保留原逻辑）
         * @param {string} productBarcode
         * @return {Promise<void>}
         */
        async printProductBarcode(productBarcode) {
            const doc = this.virtualDocument;
            if (!doc) {
                this.log('warn', '虚拟文档不可用，无法设置 productBarcode');
                return;
            }
            const input = doc.querySelector('#productBarcode');
            if (!input) {
                this.log('warn', '未找到 #productBarcode 输入框');
                return;
            }

            input.value = productBarcode;
            this.log('info', 'productBarcode 赋值完成');

            const enterEvent = new KeyboardEvent('keydown', {
                bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13
            });
            input.dispatchEvent(enterEvent);
            this.log('debug', '已在 #productBarcode 触发 Enter');
        }

        /**
         * 自动点击“开始配货”（保留原逻辑；增强判空与日志）
         * @return {Promise<void>}
         */
        async autoClickSubmitPicking() {
            try {
                const doc = this.virtualDocument;
                if (!doc) {
                    this.log('warn', '虚拟文档不可用，无法点击“开始配货”');
                    return;
                }
                const btn = doc.querySelector('#submitPicking');
                if (!btn) {
                    this.log('warn', '未找到 #submitPicking 按钮');
                    return;
                }
                btn.click();
                this.log('info', '“开始配货”按钮已在虚拟页面上自动点击');
            } catch (error) {
                this.log('error', '在虚拟页面上自动点击“开始配货”按钮时出错:', {err: error?.message});
            }
        }

        /**
         * 简单的提交结果检查（保留原逻辑）
         * @return {Promise<{state:number,message:string,data:string}>}
         */
        async checkSubmitResult() {
            try {
                const doc = this.virtualDocument;
                if (!doc) {
                    this.log('warn', '虚拟文档不可用，无法检查提交结果');
                    return {state: 1, message: '虚拟文档不可用', data: ''};
                }

                const errorMessage = doc.querySelector('#submitPicking-message');
                if (errorMessage && errorMessage.style.display !== 'none') {
                    const messageText = errorMessage.textContent || errorMessage.innerText || '';
                    this.log('info', '在虚拟页面上检测到错误消息', {messageText});
                    return {state: 1, message: messageText, data: messageText};
                }
                return {state: 0, message: '', data: ''};
            } catch (error) {
                this.log('error', '检查虚拟页面提交结果时出错:', {err: error?.message});
                return {state: 1, message: error?.message || String(error), data: ''};
            }
        }

        /**
         * 将结果发送到 error-prompt-handler（保留原逻辑）
         * @param {'error'|'info'} level
         * @param {string} message
         * @param {string} data
         * @return {Promise<void>}
         */
        async sendResultToErrorPromptHandler(level, message, data) {
            try {
                window.xAI.ErrorPromptHandler.handleSecondSortingResult(level, message, data);
                this.log('info', `结果已发送到 error-prompt-handler: ${level} - ${message}`);
            } catch (error) {
                this.log('error', '发送结果到 error-prompt-handler 时出错:', {err: error?.message});
            }
        }

        /**
         * 关闭二次分拣页面（保留原逻辑）
         * @return {Promise<void>}
         */
        async closeSecondSortingPage() {
            if (this.virtualPage) {
                try {
                    this.virtualPage.remove?.();
                } catch {
                }
                this.virtualPage = null;
                this.virtualDocument = null;
                this.isPageLoaded = false;
                this.log('info', '虚拟页面资源已清理');
            }
            document.querySelectorAll('.second-sorting-message').forEach(el => {
                try {
                    el.remove();
                } catch {
                }
            });
            const style = document.querySelector('#second-sorting-message-style');
            if (style) {
                try {
                    style.remove();
                } catch {
                }
            }
            this.currentData = null;
            this.log('info', '二次分拣页面已关闭');
        }

        /**
         * 日志输出（保留 this.log 接口；底层走 Logger）
         * @param {'debug'|'info'|'warn'|'error'} level
         * @param {string} message
         * @param {...any} args
         * @return {Promise<void>}
         */
        async log(level, message, ...args) {
            try {
                const effLevel = this._logger?.level || (this.debugMode ? 'info' : 'error');
                const rank = Logger.ranks[effLevel] ?? Logger.ranks.info;
                if (Logger.ranks[level] <= rank || level === 'error') {
                    this._logger[level]?.(message, ...args);
                }
            } catch {
            }
        }

        /**
         * 设置日志级别（新增能力）
         * @param {'silent'|'error'|'warn'|'info'|'debug'} level
         */
        setLogLevel(level) {
            try {
                this._logger.setLevel(level);
                localStorage.setItem('SecondSortingHandler:logLevel', level);
            } catch {
            }
            this.log('info', 'logLevel 已更新', {level});
        }

        /** 销毁实例（保留原逻辑） */
        destroy() {
            this.closeSecondSortingPage();
            if (window.xAI && window.xAI.SecondSortingHandler) {
                delete window.xAI.SecondSortingHandler;
            }
            this.log('info', '二次分拣处理器已销毁');
        }
    }

    /* ---------------------------------- boot --------------------------------- */
    try {
        if (!window[GLOBAL_BOOT_PROMISE]) {
            window[GLOBAL_BOOT_PROMISE] = (async () => {
                // 若已经是“真实实例”，直接返回
                if (window.xAI?.SecondSortingHandler && !window.xAI.SecondSortingHandler.__isPlaceholder) {
                    return window.xAI.SecondSortingHandler;
                }

                // 本地锁，防止多脚本并发创建
                const token = acquireLock();
                if (!token) {
                    // 没拿到锁：等待别人创建（最多 1.5s）
                    const deadline = now() + 1500;
                    while (now() < deadline) {
                        if (window.xAI?.SecondSortingHandler && !window.xAI.SecondSortingHandler.__isPlaceholder) {
                            return window.xAI.SecondSortingHandler;
                        }
                        await new Promise(r => setTimeout(r, 150));
                    }
                    // 仍未出现：最后尝试一次自己创建
                    const token2 = acquireLock();
                    if (token2) {
                        try {
                            return new SecondSortingHandler();
                        } finally {
                            releaseLock(token2);
                        }
                    } else {
                        // 甚至无法加锁：为避免长期占位，直接创建（可能少数场景会重复，但占位已被真实实例替换）
                        return new SecondSortingHandler();
                    }
                }

                try {
                    return new SecondSortingHandler();
                } finally {
                    releaseLock(token);
                }
            })();
        }
    } catch (error) {
        bootLogger.error('初始化失败', {err: error?.message || error});
    }

    // CommonJS 导出（保持原行为）
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SecondSortingHandler;
    }
})();

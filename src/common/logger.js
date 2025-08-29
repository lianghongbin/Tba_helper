/**
 * Logger，支持 chrome.storage.sync 动态调整等级
 * 等级：error < warn < info < debug
 * 输出格式：[时间戳] [scope] message 文件名:行:列
 */

const LEVELS = ['error', 'warn', 'info', 'debug'];

export class Logger {
    /**
     * @param {{scope?:string, level?:('error'|'warn'|'info'|'debug')}} [opts]
     */
    constructor(opts = {}) {
        this.scope = opts.scope || 'app';
        this._level = opts.level || 'info';
        this._levelIdx = LEVELS.indexOf(this._level);

        // 首次读取配置（沿用原行为）
        chrome.storage.sync.get({ ab_bridge_config: { logLevel: this._level } }, (res) => {
            const cfg = res?.ab_bridge_config;
            if (cfg && cfg.logLevel) {
                this.setLevel(cfg.logLevel);
            }
        });

        // 监听配置变化（沿用原行为）
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'sync' && area !== 'local') return;
            const cfg = changes?.ab_bridge_config?.newValue;
            if (cfg && cfg.logLevel) {
                this.setLevel(cfg.logLevel);
            }
        });
    }

    /** @param {'error'|'warn'|'info'|'debug'} level */
    setLevel(level) {
        if (!LEVELS.includes(level)) return;
        this._level = level;
        this._levelIdx = LEVELS.indexOf(level);
        this.info('logger level =>', level);
    }

    _should(level) {
        return LEVELS.indexOf(level) <= this._levelIdx;
    }

    _getTimestamp() {
        return new Date().toISOString();
    }

    _getCallerLocation() {
        const obj = {};
        // 抓取调用栈，忽略当前方法本身
        Error.captureStackTrace(obj, this._getCallerLocation);
        const stack = obj.stack ? String(obj.stack).split('\n') : [];
        // 经验位次：0 Error, 1 _getCallerLocation, 2 _fmt, 3 具体的 logger.xxx 调用点
        const caller = stack[3] || '';
        // 仅保留 "filename:line:col"（不含路径）
        const m = caller.match(/([^/\\]+:\d+:\d+)/);
        return m ? m[1] : 'unknown';
    }

    _fmt(args) {
        const t = this._getTimestamp();
        const loc = this._getCallerLocation();
        return [`[${t}] [${this.scope}]`, ...args, loc];
    }

    error(...a) { if (this._should('error')) console.error(...this._fmt(a)); }
    warn (...a) { if (this._should('warn' )) console.warn (...this._fmt(a)); }
    info (...a) { if (this._should('info' )) console.info (...this._fmt(a)); }
    debug(...a) { if (this._should('debug')) console.debug(...this._fmt(a)); }
}
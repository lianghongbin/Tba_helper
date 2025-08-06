// iframe 注入模块
const IframeInjector = {
    TARGET_IFRAME_PATTERN: /\/shipment\/orders-one-pack\/list\?quick=103/,
    injectedMap: new Set(),

    isAlreadyInjected(k) { 
        return Promise.resolve(this.injectedMap.has(k)); 
    },

    markInjected(k) { 
        this.injectedMap.add(k); 
    },

    async handleIframeLoad(details) {
        // 排除顶层 frame（frameId===0）
        if (details.frameId === 0) return;

        // 用正则判断这是我们要注入的 iframe
        if (this.TARGET_IFRAME_PATTERN.test(details.url)) {
            console.log('🎯 命中目标 iframe: ', details.url);

            // 幂等锁：防止同 iframe 重复注入
            const key = `${details.tabId}-${details.frameId}`;
            if (await this.isAlreadyInjected(key)) return;

            // 向该 frame 注入样式
            await chrome.scripting.insertCSS({
                target: { tabId: details.tabId, frameIds: [details.frameId] },
                files:  ['iframe-style.css']
            });

            this.markInjected(key);
        }
    }
}; 
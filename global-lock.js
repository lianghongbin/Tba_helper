/**
 * second-sorting-lock.js
 * 全局锁（同域所有 frame/脚本共享），供 second-sorting 读取使用。
 * - 仅用 localStorage 做分布式互斥（栅栏令牌 + 写后校验）
 * - 心跳续约，避免“锁悬挂”
 * - storage 事件感知他处变化（并发启动能立刻放弃）
 * - 顶层内存保存“活的实例对象”（不能往 localStorage 存实例）
 * - 提供 waitForInstance()，让后来者只复用，不再 new
 */

(function () {
    const TOP = window.top || window;

    // 在顶层挂一个命名空间
    TOP.SecondSortingLock = TOP.SecondSortingLock || (() => {
        const LOCK_KEY = 'SecondSortingHandler:LOCK';
        const HEARTBEAT_MS = 5000;     // 心跳间隔
        const EXPIRE_MS = 15000;       // 心跳超时视为锁失效
        const READY_EVENT = 'SecondSortingHandler:ready'; // 实例就绪事件（配合 second-sorting 触发）

        function now() { return Date.now(); }
        function uuid() { try { return crypto.randomUUID(); } catch { return now() + Math.random().toString(16).slice(2); } }

        // --- 内存中的“活实例”存放在顶层 ---
        function getInstance() { return TOP.__SECOND_SORTING_SINGLETON__ || null; }
        function setInstance(inst) {
            TOP.__SECOND_SORTING_SINGLETON__ = inst;
            try {
                TOP.dispatchEvent(new CustomEvent(READY_EVENT, { detail: { ts: now() } }));
            } catch {}
        }

        // --- 原子尝试抢锁（栅栏令牌 + 写后校验）---
        function tryAcquire() {
            const owner = uuid();
            const stamp = now();
            // 若已有心跳且未过期，视为被持有
            const cur = localStorage.getItem(LOCK_KEY);
            if (cur) {
                try {
                    const o = JSON.parse(cur);
                    if (o && typeof o === 'object' && o.owner && o.hb && stamp - o.hb < EXPIRE_MS) {
                        return null; // 别人还活着
                    }
                } catch {}
            }
            // 抢占
            localStorage.setItem(LOCK_KEY, JSON.stringify({ owner, hb: stamp }));
            // 校验
            try {
                const o2 = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
                return o2.owner === owner ? owner : null;
            } catch { return null; }
        }

        // --- 心跳续约 ---
        function renew(owner) {
            try {
                const cur = localStorage.getItem(LOCK_KEY);
                if (!cur) return false;
                const o = JSON.parse(cur) || {};
                if (o.owner !== owner) return false;
                o.hb = now();
                localStorage.setItem(LOCK_KEY, JSON.stringify(o));
                return true;
            } catch { return false; }
        }

        // --- 释放锁（仅持锁者可释放）---
        function release(owner) {
            try {
                const cur = localStorage.getItem(LOCK_KEY);
                if (!cur) return;
                const o = JSON.parse(cur) || {};
                if (o.owner === owner) localStorage.removeItem(LOCK_KEY);
            } catch {}
        }

        // --- 等待实例出现（复用，不再 new）---
        function waitForInstance(timeoutMs = 3000) {
            const start = now();
            return new Promise((resolve) => {
                // 如果已经有实例，直接返回
                const inst = getInstance();
                if (inst) return resolve(inst);

                let done = false;
                const tryFinish = () => {
                    if (done) return;
                    const i = getInstance();
                    if (i) { done = true; cleanup(); resolve(i); }
                };
                const onStorage = (e) => { if (e.key === LOCK_KEY) tryFinish(); };
                const onReady = () => tryFinish();

                function tick() {
                    if (done) return;
                    if (now() - start >= timeoutMs) { done = true; cleanup(); resolve(null); }
                    else setTimeout(tick, 120);
                }
                function cleanup() {
                    window.removeEventListener('storage', onStorage);
                    TOP.removeEventListener(READY_EVENT, onReady);
                }

                window.addEventListener('storage', onStorage);
                TOP.addEventListener(READY_EVENT, onReady);
                tick();
            });
        }

        // --- 对外 API ---
        return {
            /**
             * 抢锁。成功返回 { owner, stop }：
             *  - owner：令牌
             *  - stop()：停止心跳并自动 release
             * 失败返回 null。
             */
            acquire() {
                const owner = tryAcquire();
                if (!owner) return null;
                let alive = true;
                const timer = setInterval(() => {
                    if (!alive) return;
                    if (!renew(owner)) { alive = false; clearInterval(timer); }
                }, HEARTBEAT_MS);
                const stop = () => { if (!alive) return; alive = false; clearInterval(timer); release(owner); };
                return { owner, stop };
            },

            /** 等待实例出现（来自别处初始化），返回实例或 null */
            waitForInstance,

            /** 获取/设置 顶层“活实例” */
            getInstance,
            setInstance,
        };
    })();

})();
/**
 * background.js
 * ----------------
 * - 维护 role→frames 的注册表（tabId:frameId）
 * - 增强：支持心跳 PING/PONG，更新 lastSeen
 */

import { Logger } from './common/logger.js';
import { MSG, ROLES } from './common/protocol.js';

const log = new Logger({ scope: 'bg' });

const registry = {
    [ROLES.A]: new Set(),
    [ROLES.B]: new Set()
};
const frameMeta = new Map(); // key -> { tabId, frameId, url, lastSeen }

function removeKey(key) {
    for (const r of Object.keys(registry)) registry[r].delete(key);
    frameMeta.delete(key);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // === 新增：PING 处理（前端心跳用） ===
    if (msg?.type === 'PING') {
        const tabId = sender?.tab?.id;
        const frameId = sender?.frameId;
        if (tabId != null && frameId != null) {
            const key = `${tabId}:${frameId}`;
            const meta = frameMeta.get(key);
            if (meta) meta.lastSeen = Date.now(); // 刷新 lastSeen
        }
        sendResponse?.({ ok: true, type: 'PONG' });
        return;
    }

    if (msg?.type === 'CHECK_B_REGISTERED') {
        const allB = Array.from(registry[ROLES.B] || []);
        const isRegistered = allB.length > 0;
        sendResponse?.({ ok: true, registered: isRegistered });
        return;
    }

    // === 注册 ===
    if (msg?.type === MSG.ROLE_READY) {
        const role = msg.role;
        if (!role || !registry[role]) {
            sendResponse?.({ ok: false, reason: 'invalid role' });
            return;
        }
        const tabId = sender?.tab?.id;
        const frameId = sender?.frameId;
        const url = sender?.url;

        if (tabId == null || frameId == null) {
            sendResponse?.({ ok: false, reason: 'no tab/frame' });
            return;
        }

        const key = `${tabId}:${frameId}`;
        registry[role].add(key);
        // === 修改：注册时刷新 lastSeen ===
        const old = frameMeta.get(key) || {};
        frameMeta.set(key, { ...old, tabId, frameId, url, lastSeen: Date.now() });

        log.info('[ROLE_READY]', role, key);
        sendResponse?.({ ok: true });
        return;
    }

    // === 注销 ===
    if (msg?.type === MSG.ROLE_BYE) {
        const tabId = sender?.tab?.id;
        const frameId = sender?.frameId;
        if (tabId != null && frameId != null) {
            const key = `${tabId}:${frameId}`;
            removeKey(key);
            log.info('[ROLE_BYE]', key);
        }
        sendResponse?.({ ok: true });
        return;
    }

    // === 路由 ===
    if (msg?.type === MSG.ROUTE_TO_ROLE) {
        const { targetRole, payload, corrId } = msg;
        const fromTabId = sender?.tab?.id;

        const all = Array.from(registry[targetRole] || []);
        const sameTab = all.filter((k) => k.startsWith(`${fromTabId}:`));
        const key = sameTab[0] || all[0];

        log.info('[ROUTE_TO_ROLE]', {
            targetRole,
            countAll: all.length,
            countSameTab: sameTab.length,
            chosen: key
        });

        if (!key) {
            log.info('[route] no-target-frames');
            sendResponse?.({ ok: false, reason: 'no-target-frames' });
            return;
        }

        const [tabIdStr, frameIdStr] = key.split(':');
        const tabId = Number(tabIdStr);
        const frameId = Number(frameIdStr);

        chrome.tabs.sendMessage(
            tabId,
            { type: payload?.type, payload: payload?.data, corrId },
            { frameId },
            (resp) => {
                const lastErr = chrome.runtime.lastError;

                if (lastErr || resp == null) {
                    log.info('[route] tabs.sendMessage failed/empty', {
                        lastError: lastErr?.message,
                        respType: typeof resp
                    });
                    removeKey(`${tabId}:${frameId}`);
                    sendResponse?.({ ok: false, reason: 'no-target-frames' });
                    return;
                }

                // === 修改：路由成功时刷新 lastSeen ===
                const meta = frameMeta.get(`${tabId}:${frameId}`);
                if (meta) meta.lastSeen = Date.now();

                log.info('[route] ok -> pass through');
                sendResponse?.(resp);
            }
        );

        return true; // 异步 sendResponse
    }
});

// 清理器仍然保留（避免真僵尸）
setInterval(() => {
    const now = Date.now();
    for (const [key, meta] of frameMeta) {
        if (now - meta.lastSeen > 60 * 60 * 1000) {
            removeKey(key);
        }
    }
}, 10 * 60 * 1000);
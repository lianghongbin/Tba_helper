/**
 * Background（Service Worker, ES Module）
 * - 维护 role→frames 的注册表（tabId:frameId）
 * - 接收 ROUTE_TO_ROLE：若 B 未注册，或已关闭/无响应 → 一律返回 { ok:false, reason:'no-target-frames' }
 * - 加强日志，便于你在 SW 控制台确认每一步
 */

import { Logger } from './common/logger.js';
import { MSG, ROLES } from './common/protocol.js';

const log = new Logger({ scope: 'bg' });

/** 角色→已注册 frame key 的集合 */
const registry = {
    [ROLES.A]: new Set(),
    [ROLES.B]: new Set()
};

/** 保存一些元信息，便于清理（可选） */
const frameMeta = new Map(); // key -> { tabId, frameId, url, lastSeen }

/** 小工具：统一移除 */
function removeKey(key) {
    for (const r of Object.keys(registry)) registry[r].delete(key);
    frameMeta.delete(key);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // —— 注册 —— //
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
        frameMeta.set(key, { tabId, frameId, url, lastSeen: Date.now() });

        log.info('[ROLE_READY]', role, key);
        sendResponse?.({ ok: true });
        return;
    }

    // —— 注销（可选，但能减少僵尸条目）—— //
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

    // —— 路由 —— //
    if (msg?.type === MSG.ROUTE_TO_ROLE) {
        const { targetRole, payload, corrId } = msg;
        const fromTabId = sender?.tab?.id;

        const all = Array.from(registry[targetRole] || []);
        const sameTab = all.filter((k) => k.startsWith(`${fromTabId}:`));
        const key = sameTab[0] || all[0];

        log.info('[ROUTE_TO_ROLE]', { targetRole, countAll: all.length, countSameTab: sameTab.length, chosen: key });

        // 1) 没有任何目标（B 未启动）
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

                // 2) 发不出去/对方无响应（B 可能已被关闭）：移除并统一回“未就绪”
                if (lastErr || resp == null) {
                    log.info('[route] tabs.sendMessage failed/empty', { lastError: lastErr?.message, respType: typeof resp });
                    removeKey(`${tabId}:${frameId}`);
                    sendResponse?.({ ok: false, reason: 'no-target-frames' });
                    return;
                }

                // 3) 正常回包：直接转发
                log.info('[route] ok -> pass through');
                sendResponse?.(resp);
            }
        );

        return true; // 异步 sendResponse
    }
});

// 轻量清理（保持原有策略即可）
setInterval(() => {
    const now = Date.now();
    for (const [key, meta] of frameMeta) {
        if (now - meta.lastSeen > 60 * 60 * 1000) {
            removeKey(key);
        }
    }
}, 10 * 60 * 1000);
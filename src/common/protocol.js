/**
 * 协议常量与工具
 */

/** 消息类型常量 */
export const MSG = {
    ROLE_READY: 'ROLE_READY',           // content -> bg: { role: 'A'|'B' }
    ROUTE_TO_ROLE: 'ROUTE_TO_ROLE',     // A -> bg: { targetRole, payload, corrId }
    BARCODE_REQUEST: 'BARCODE_REQUEST', // A -> B: { barcode }
    BARCODE_RESULT: 'BARCODE_RESULT'    // B -> A: { ok, data|error }
};

/** 角色常量 */
export const ROLES = { A: 'Trigger', B: 'Sorting' };

/** 生成一次性关联 ID */
export function makeCorrId() {
    return 'c_' + Math.random().toString(36).slice(2);
}
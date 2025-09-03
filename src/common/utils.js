// 工具函数模块
const Utils = {
    getFromDate() {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 设置为本地时间的 00:00:00

        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        return `2025-06-03 00:00:00`;
    }
};

// 导出 Utils 对象
export { Utils };

// 兼容 CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Utils };
}
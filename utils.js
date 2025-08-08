// 工具函数模块
const Utils = {
    getCurrentDate() {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 设置为本地时间的 00:00:00

        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        return `${year}-${month}-${day} 00:00:00`;
    }
}; 
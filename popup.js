const btn  = document.getElementById('resetBtn');
const info = document.getElementById('msg');

btn.addEventListener('click', () => {
    btn.disabled = true;            // 防抖：避免连点
    info.textContent = '正在清除…';

    chrome.runtime.sendMessage({ action: 'resetFetchStatus' }, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) {
            console.error('reset error', err);
            info.textContent = '⚠️ 清除失败：' + err.message;
        } else if (resp?.ok) {
            info.textContent = '✅ 已清除，可重新触发任务';
        } else {
            info.textContent = '❌ 未知响应';
        }
        btn.disabled = false;
    });
});
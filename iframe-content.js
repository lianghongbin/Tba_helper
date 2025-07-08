(function addRemainingLabel() {
    // 1️⃣ 精确锁定目标按钮
    const btn = document.querySelector('input.baseBtn.submitProduct[value="确认"]');
    if (!btn) return;                                // 没找到按钮就结束

    // 2️⃣ 避免重复插入
    if (btn.nextElementSibling?.classList?.contains('remaining-info')) return;

    // 3️⃣ 创建提示文本
    const span = document.createElement('span');
    span.textContent = '还剩一个';
    span.className   = 'remaining-info';
    span.style.cssText = 'margin-left:8px; color:#d32f2f; font-size:12px;';

    // 4️⃣ 插到按钮右边
    btn.insertAdjacentElement('afterend', span);
})();
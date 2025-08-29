// public-side-panel.js  — 右上角悬浮层版本（固定 + 可拖拽）
// 仅暴露：showInfo / showError / setContent / hide / showProductRow
(function () {
    const NS = (window.xAI = window.xAI || {});
    if (NS.PublicSidePanelManager) return;

    let panel = null;

    const css = `
    /* ===== 外层面板：固定宽度，永不被内部撑破 ===== */
    .xai-float {
      position: fixed;
      top: 16px;
      right: 16px;
      width: 500px;          /* 固定宽度 */
      max-width: 50vw;       /* 窄屏降级 */
      max-height: 80vh;      /* 竖向限制，内部滚动 */
      z-index: 2147483647;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      box-shadow: 0 4px 16px rgba(0,0,0,.12);
      overflow: hidden;      /* 关键：外层不被内部溢出撑开 */
      font: 14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial;
      color:#111827;
      user-select: none;     /* 便于拖拽 */
    }
    .xai-float[hidden]{ display:none !important; }

    /* 头部（可拖拽） */
    .xai-float__header{
      display:flex;align-items:center;justify-content:space-between;
      padding:8px 10px;
      background:#f9fafb;
      border-bottom:1px solid #e5e7eb;
      cursor: move;
    }
    .xai-float__title{font-weight:600;}
    .xai-float__close{
      border:0;background:transparent;cursor:pointer;padding:4px 6px;border-radius:6px;
      color:#6b7280;
    }
    .xai-float__close:hover{ background:#eef2ff; color:#111827; }

    /* ===== 内容区域：宽度 100%，内部自适应但不撑破外层 ===== */
    .xai-float__body{
      padding:10px;
      overflow:auto;                         /* 内容区滚动 */
      max-height: calc(80vh - 44px);         /* 扣掉 header 高度 */
      pointer-events: auto;
      user-select: text;
      white-space: normal;
      word-break: break-word;                /* 关键：长词可断行 */
    }
    .xai-float__body * {
      max-width: 100%;                       /* 任何内部元素都不超过外层宽度 */
      box-sizing: border-box;
    }
    .xai-float__body img, .xai-float__body table {
      max-width: 100%;                       /* 图片/表格不撑破外层 */
    }
    .xai-float__body pre, .xai-float__body code {
      white-space: pre-wrap;                 /* 代码也可折行 */
      word-wrap: break-word;
    }
    
    .xai-variant--error .xai-float__body {
        color: #dc2626;
    }

    .xai-variant--info  { border-left: 3px solid #2563eb; }
    .xai-variant--error { border-left: 3px solid #dc2626; }

    /* ===== 迷你表格：内部宽度 100%，固定布局，不撑外层 ===== */
    .xai-mini-title { font-weight: 400; margin-bottom: 6px; }
    .xai-mini-table {
      display: table;
      width: 100%;               /* 填满 body 宽度 */
      border-collapse: collapse;
      font-size: 14px;
      table-layout: fixed;       /* 关键：固定布局，不随内容扩张 */
    }
    .xai-mini-tr    { display: table-row; }
    .xai-mini-th,
    .xai-mini-td    {
      display: table-cell;
      padding: 6px 10px;
      border: 1px solid #e5e7eb;
      word-break: break-all;     /* 单元格内强制断行 */
      white-space: normal;       /* 允许换行 */
    }
    .xai-mini-head  { background: #f3f4f6; font-weight: 600; }

    /* 可选：设置列相对宽度（避免编码过长挤压）
       使用百分比总和 <= 100%，不会撑破外层 */
    .xai-mini-col-idx   { width: 15%; }
    .xai-mini-col-code  { width: 55%; }
    .xai-mini-col-qty   { width: 15%; }
    .xai-mini-col-sqty  { width: 15%; }
  `;

    function injectCSS() {
        if (document.querySelector('style[data-xai-float]')) return;
        const s = document.createElement('style');
        s.setAttribute('data-xai-float', '1');
        s.textContent = css;
        document.head.appendChild(s);
    }

    function ensurePanel() {
        if (panel) return panel;
        injectCSS();

        panel = document.createElement('div');
        panel.className = 'xai-float xai-variant--info';
        panel.hidden = false; // 默认就显示
        panel.innerHTML = `
      <div class="xai-float__header" data-drag="1">
        <div class="xai-float__title">插件信息</div>
        <button class="xai-float__close" title="关闭">×</button>
      </div>
      <div class="xai-float__body"></div>
    `;
        document.body.appendChild(panel);

        panel.querySelector('.xai-float__close')?.addEventListener('click', () => hide());

        // 拖拽（仅 header 可拖）
        enableDrag(panel, panel.querySelector('[data-drag="1"]'));
        return panel;
    }

    function enableDrag(box, handle) {
        let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;

        const onDown = (e) => {
            dragging = true;
            const evt = ('touches' in e) ? e.touches[0] : e;
            startX = evt.clientX;
            startY = evt.clientY;
            const rect = box.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, {passive: false});
            document.addEventListener('touchend', onUp);
            e.preventDefault();
        };

        const onMove = (e) => {
            if (!dragging) return;
            const evt = ('touches' in e) ? e.touches[0] : e;
            const dx = evt.clientX - startX;
            const dy = evt.clientY - startY;
            const left = Math.max(8, Math.min(window.innerWidth - box.offsetWidth - 8, startLeft + dx));
            const top = Math.max(8, Math.min(window.innerHeight - box.offsetHeight - 8, startTop + dy));
            box.style.left = left + 'px';
            box.style.top = top + 'px';
            box.style.right = 'auto';
            box.style.bottom = 'auto';
            box.style.position = 'fixed';
            e.preventDefault();
        };

        const onUp = () => {
            dragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
        };

        handle.addEventListener('mousedown', onDown);
        handle.addEventListener('touchstart', onDown, {passive: false});
    }

    function setVariant(v) {
        const el = ensurePanel();
        el.classList.remove('xai-variant--info', 'xai-variant--error');
        el.classList.add(v === 'error' ? 'xai-variant--error' : 'xai-variant--info');
        const title = el.querySelector('.xai-float__title');
        if (title) title.textContent = v === 'error' ? '插件信息' : '插件信息';
    }

    function setContent(content) {
        const el = ensurePanel();
        const body = el.querySelector('.xai-float__body');
        if (!body) return;
        if (typeof content === 'string') body.innerHTML = content;
        else if (content instanceof Node) body.replaceChildren(content);
        else body.textContent = String(content ?? '');
        el.hidden = false;
    }

    function show(content, variant = 'info') {
        setVariant(variant);
        setContent(content);
    }

    function showInfo(html) {
        show(html, 'info');
    }

    function showError(html) {
        show(html, 'error');
    }

    function hide() {
        ensurePanel().hidden = true;
    }

    /* ===== 内部私有：渲染“订单产品信息”表格，一行数据 ===== */
    function renderProductTableRow(data) {
        const safe = (v) => (v == null ? '' : String(v));
        return `
      <div class="xai-mini-table">
        <div class="xai-mini-tr xai-mini-head">
          <div class="xai-mini-th xai-mini-col-idx">编号</div>
          <div class="xai-mini-th xai-mini-col-code">产品编码</div>
          <div class="xai-mini-th xai-mini-col-qty">产品数</div>
          <div class="xai-mini-th xai-mini-col-sqty">扫码数</div>
        </div>
        <div class="xai-mini-tr">
          <div class="xai-mini-td xai-mini-col-idx">${safe(data.index)}</div>
          <div class="xai-mini-td xai-mini-col-code">${safe(data.productCode)}</div>
          <div class="xai-mini-td xai-mini-col-qty">${safe(data.quantity)}</div>
          <div class="xai-mini-td xai-mini-col-sqty">${safe(data.scanQuantity)}</div>
        </div>
      </div>
    `;
    }

    /** 对外：直接显示产品信息（表头 + 单行数据） */
    function showProductRow(data) {
        show(renderProductTableRow(data), 'info');
    }

    // 暴露 API
    NS.PublicSidePanelManager = {showInfo, showError, setContent, hide, showProductRow};

    // ===== 自启动：默认就创建并显示面板 =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            try {
                ensurePanel();
                console.info('[SidePanel] auto-mounted');
            } catch (e) {
                console.error(e);
            }
        }, {once: true});
    } else {
        try {
            ensurePanel();
            console.info('[SidePanel] auto-mounted');
        } catch (e) {
            console.error(e);
        }
    }

    setContent('<div style="color:#6b7280;">插件面板已加载</div>');
})();
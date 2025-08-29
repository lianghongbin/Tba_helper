const $ = (s) => document.querySelector(s);

function load() {
    chrome.storage.sync.get(
        { ab_bridge_config: { logLevel: 'info', apiBase: '', apiToken: '', timeoutMs: 10000 } },
        (res) => {
            const c = res.ab_bridge_config || {};
            $('#logLevel').value = c.logLevel || 'info';
            $('#apiBase').value = c.apiBase || '';
            $('#apiToken').value = c.apiToken || '';
            $('#timeoutMs').value = c.timeoutMs ?? 10000;
        }
    );
}

function save() {
    const cfg = {
        logLevel: $('#logLevel').value,
        apiBase: $('#apiBase').value.trim(),
        apiToken: $('#apiToken').value.trim(),
        timeoutMs: parseInt($('#timeoutMs').value, 10) || 10000
    };

    chrome.storage.sync.set({ ab_bridge_config: cfg }, () => {
        const s = $('#status');
        s.textContent = 'Saved';
        s.className = 'ok';
        setTimeout(() => { s.textContent = ''; s.className = ''; }, 1200);
    });
}

document.addEventListener('DOMContentLoaded', load);
$('#save').addEventListener('click', save);
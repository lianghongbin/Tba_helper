// 导入所有模块文件
importScripts(
    'utils.js',
    'database.js',
    'picking-fetcher.js',
    'message-handler.js',
    'iframe-injector.js'
);

// ==================== 主程序入口 ====================

// 测试IndexedDB是否可用
console.log('Service Worker启动，测试IndexedDB...');
if (typeof indexedDB !== 'undefined') {
    console.log('IndexedDB在Service Worker中可用');
} else {
    console.error('IndexedDB在Service Worker中不可用');
}

// 测试fetch是否可用
console.log('测试fetch是否可用...');
if (typeof fetch !== 'undefined') {
    console.log('fetch在Service Worker中可用');
    
    // 测试一个简单的fetch请求
    const testUrl = 'http://yzt.wms.yunwms.com/shipment/picking/list/page/1/pageSize/1';
    const testParams = new URLSearchParams({dateFor: '2024-01-01' });
    
    console.log('测试fetch请求到:', testUrl);
    
    fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: testParams.toString(),
        credentials: 'include'
    })
    .then(response => {
        console.log('Service Worker fetch测试成功:', response.status);
        return response.json();
    })
    .then(json => {
        console.log('Service Worker fetch测试数据:', json);
    })
    .catch(error => {
        console.error('Service Worker fetch测试失败:', error);
    });
} else {
    console.error('fetch在Service Worker中不可用');
}

// 注册消息监听器
chrome.runtime.onMessage.addListener(MessageHandler.handleMessage.bind(MessageHandler));

// 创建定时任务
chrome.alarms.create('updateShipmentData', { periodInMinutes: 240 }); // 每 4 小时触发

// 监听定时任务
chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'updateShipmentData') {
        console.log('定时更新 fetchPickings');
        PickingFetcher.fetchPickings();
    }
});

// 监听 iframe 加载
chrome.webNavigation.onCompleted.addListener(IframeInjector.handleIframeLoad.bind(IframeInjector));
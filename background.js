function getCurrentDate() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('PickingDetailsDB', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('pickingDetails')) {
                db.createObjectStore('pickingDetails', { keyPath: 'picking_no' });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(new Error('IndexedDB 打开失败：' + event.target.errorCode));
    });
}

function clearIndexedDB() {
    console.log('开始执行 clearIndexedDB......');
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction(['pickingDetails'], 'readwrite');
            const store = transaction.objectStore('pickingDetails');
            const clearRequest = store.clear();

            clearRequest.onsuccess = () => {
                console.log('IndexedDB 数据已清空');
                resolve();
            };
            clearRequest.onerror = () => reject(new Error('清空 IndexedDB 失败'));
            transaction.oncomplete = () => db.close();
        }).catch(error => reject(error));
    });
}

function saveToIndexedDB(extractedData) {
    console.log('开始执行 saveToIndexedDB......');
    return new Promise((resolve, reject) => {
        openDB().then(db => {
            const transaction = db.transaction(['pickingDetails'], 'readwrite');
            const store = transaction.objectStore('pickingDetails');

            extractedData.forEach(item => {
                const getRequest = store.get(item.picking_no);

                getRequest.onsuccess = () => {
                    const existingRecord = getRequest.result || { picking_no: item.picking_no, sku_code: [] };
                    if (!existingRecord.sku_code.includes(item.sku_code)) {
                        existingRecord.sku_code.push(item.sku_code);
                    }
                    const putRequest = store.put(existingRecord);

                    putRequest.onsuccess = () => console.log(`数据 picking_no: ${item.picking_no}, sku_code: ${item.sku_code} 已保存`);
                    putRequest.onerror = () => console.error(`保存 picking_no: ${item.picking_no} 失败`);
                };
                getRequest.onerror = () => console.error(`读取 picking_no: ${item.picking_no} 失败`);
            });

            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
            transaction.onerror = () => reject(new Error('IndexedDB 事务失败'));
        }).catch(error => reject(error));
    });
}

function getAllPickingDetails(callback) {
    console.log('开始执行 getAllPickingDetails......');
    openDB().then(db => {
        const transaction = db.transaction(['pickingDetails'], 'readonly');
        const store = transaction.objectStore('pickingDetails');
        const getAll = store.getAll();

        getAll.onsuccess = () => callback({ data: getAll.result });
        getAll.onerror = () => callback({ error: '读取 IndexedDB 数据失败' });
        transaction.oncomplete = () => db.close();
    }).catch(error => callback({ error: '打开 IndexedDB 失败: ' + error.message }));
}

function getSkuCodesByPickingNo(picking_no, sku_code, callback) {
    console.log('开始执行 getSkuCodesByPickingNo......');
    openDB().then(db => {
        const transaction = db.transaction(['pickingDetails'], 'readonly');
        const store = transaction.objectStore('pickingDetails');
        const getRequest = store.get(picking_no);

        getRequest.onsuccess = () => {
            const record = getRequest.result;
            if (record && record.sku_code) {
                const matchedSku = record.sku_code.find(item => item.endsWith(`-${sku_code}`));
                callback({ sku_code: matchedSku || null });
            } else {
                callback({ sku_code: null });
            }
        };
        getRequest.onerror = () => callback({ error: `读取 picking_no: ${picking_no} 失败` });
        transaction.oncomplete = () => db.close();
    }).catch(error => callback({ error: '打开 IndexedDB 失败: ' + error.message }));
}

function fetchPickingDetails(pickingNumbers) {
    const url = 'http://yzt.wms.yunwms.com/shipment/picking-detail/list/page/1/pageSize/2000';
    console.log('开始执行 fetchPickingDetails......')
    return Promise.all(pickingNumbers.map(pickingNumber => {
        const params = new URLSearchParams({ E01: pickingNumber, status_tag_type: '1' });

        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: params.toString(),
            credentials: 'include'
        })
            .then(response => {
                console.log('------------', response.status, '---------------')
                if (!response.ok) throw new Error(`请求拣货单号 ${pickingNumber} 详情失败: ${response.status}`);
                return response.json();
            })
            .then(json => {
                if (json.data && Array.isArray(json.data)) {
                    return json.data.map(item => ({ picking_no: item.E01, sku_code: item.E11, count: item.E6 }));
                } else {
                    console.log(`拣货单号 ${pickingNumber} 的数据格式不正确`);
                    return [];
                }
            })
            .catch(error => {
                console.error(`请求拣货单号 ${pickingNumber} 详情失败:`, error);
                return [];
            });
    }))
        .then(results => results.flat())
        .then(extractedData => {
            if (extractedData.length) {
                return saveToIndexedDB(extractedData);
            }
        });
}

function fetchShipmentData() {
    console.log('开始执行 fetchShipmentData......');

    const now = Date.now();
    const today = getCurrentDate();

    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['fetchStatus'], (result) => {
            const fetchStatus = result.fetchStatus || { lastFetchDate: '', completed: false, lastFetchTime: 0 };
            if (fetchStatus.lastFetchTime && now - fetchStatus.lastFetchTime < 5 * 60 * 1000) {
                console.log('fetchShipmentData 最近已执行，跳过');
                resolve();
                return;
            }

            chrome.storage.local.set({
                fetchStatus: { lastFetchDate: today, completed: false, lastFetchTime: now }
            }, () => {
                clearIndexedDB()
                    .then(() => {
                        const url = 'http://yzt.wms.yunwms.com/shipment/picking/list/page/1/pageSize/200';
                        const params = new URLSearchParams({ E1: '2', dateFor: today });

                        fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                            body: params.toString(),
                            credentials: 'include'
                        })
                            .then(response => {
                                if (!response.ok) throw new Error(`请求拣货单号列表失败: ${response.status}`);
                                return response.json();
                            })
                            .then(json => {
                                if (json.data && Array.isArray(json.data)) {
                                    const pickingNumbers = json.data.map(item => item.E2);
                                    console.log('拣货单号:', pickingNumbers);
                                    return fetchPickingDetails(pickingNumbers);
                                } else {
                                    console.log('未找到 data 数组或数据格式不正确');
                                    return Promise.resolve();
                                }
                            })
                            .then(() => {
                                chrome.storage.local.set({
                                    fetchStatus: { lastFetchDate: today, completed: true, lastFetchTime: now }
                                }, () => {
                                    console.log('fetchShipmentData 完成');
                                    resolve();
                                });
                            })
                            .catch(error => {
                                console.error('❌ fetch 请求失败:',error, error.stack);
                                console.log('🔎 请求的 URL:', url);
                                reject(error);
                            });
                    })
                    .catch(error => {
                        console.error('清空 IndexedDB 失败:', error);
                        reject(error);
                    });
            });
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('收到消息:', request);

    if (request.action === 'getPickingDetails') {
        getAllPickingDetails(response => sendResponse(response));
        return true;
    } else if (request.action === 'getSkuCodesByPickingNo') {
        getSkuCodesByPickingNo(request.picking_no, request.sku_code, response => sendResponse(response));
        return true;
    } else if (request.action === 'fetchShipmentData') {
        console.log('准备调用 fetchShipmentData');
        fetchShipmentData().then(() => sendResponse({ status: 'fetchShipmentData triggered', hasFetched: true }));
        return true;
    } else if (request.action === 'checkFetchStatus') {
        chrome.storage.local.get(['fetchStatus'], (result) => {
            const fetchStatus = result.fetchStatus || { lastFetchDate: '', completed: false, lastFetchTime: 0 };
            const today = getCurrentDate();
            const hasFetched = fetchStatus.lastFetchDate === today && fetchStatus.completed &&
                (Date.now() - fetchStatus.lastFetchTime < 5 * 60 * 1000);
            sendResponse({ hasFetched, lastFetchDate: fetchStatus.lastFetchDate, completed: fetchStatus.completed });
        });
        return true;
    } else if (request.action === 'resetFetchStatus') {
        chrome.storage.local.remove('fetchStatus', () => {
            console.log('🔄 fetchStatus 手动重置完成');
            sendResponse({ ok: true });
        });
        return true; // keep the port open
    }
});

chrome.alarms.create('updateShipmentData', { periodInMinutes: 240 }); // 每 4 小时触发

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'updateShipmentData') {
        console.log('定时更新 fetchShipmentData');
        fetchShipmentData();
    }
});

//监听 iframe加载
// ❶ 约定 iframe URL 中必须包含 key 字串，比如 "/report.html"
const TARGET_IFRAME_PATTERN = /\/shipment\/orders-one-pack\/list\?quick=103/;


// ❷ 监听页面上任何 frame 完成加载
chrome.webNavigation.onCompleted.addListener(async (details) => {
    // 排除顶层 frame（frameId===0）
    if (details.frameId === 0) return;

    // 用正则判断这是我们要注入的 iframe
    if (TARGET_IFRAME_PATTERN.test(details.url)) {
        console.log('🎯 命中目标 iframe: ', details.url);

        // 幂等锁：防止同 iframe 重复注入
        const key = `${details.tabId}-${details.frameId}`;
        if (await isAlreadyInjected(key)) return;

        // ❸ 向该 frame 注入脚本 & 样式
        await chrome.scripting.insertCSS({
            target: { tabId: details.tabId, frameIds: [details.frameId] },
            files:  ['iframe-style.css']
        });

        await chrome.scripting.executeScript({
            target: { tabId: details.tabId, frameIds: [details.frameId] },
            files:  ['iframe-content.js']
        });

        markInjected(key);
    }
});

/* --- 简单的本地 injected 缓存 --- */
const injectedMap = new Set();
function isAlreadyInjected(k) { return Promise.resolve(injectedMap.has(k)); }
function markInjected(k)     { injectedMap.add(k); }
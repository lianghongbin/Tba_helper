// 消息处理模块
const MessageHandler = {
    handleMessage(request, sender, sendResponse) {
        console.log('收到消息:', request);

        if (request.action === 'getAllPickingDetails') {
            Database.getAllPickingDetails(response => sendResponse(response));
            return true;
        } else if (request.action === 'getSkuCodesByPickingNo') {
            Database.getSkuCodesByPickingNo(request.picking_no, request.sku_code, response => sendResponse(response));
            return true;
        } else if (request.action === 'fetchPickings') {
            console.log('准备调用 fetchPickings');
            
            // 直接调用PickingFetcher
            PickingFetcher.fetchPickings()
                .then((dataCount) => {
                    console.log('fetchPickings 执行成功');
                    sendResponse({ status: 'success', hasFetched: true, dataCount: dataCount });
                })
                .catch((error) => {
                    console.error('fetchPickings 执行失败:', error);
                    
                    // 如果是版本冲突错误，自动删除数据库并重试
                    if (error.message && error.message.includes('version')) {
                        console.log('检测到版本冲突，自动删除数据库并重试...');
                        Database.deleteDB()
                            .then(() => {
                                console.log('数据库删除成功，重新尝试抓取...');
                                return PickingFetcher.fetchPickings();
                            })
                            .then((dataCount) => {
                                console.log('重试成功，fetchPickings 执行成功');
                                sendResponse({ status: 'success', hasFetched: true, dataCount: dataCount });
                            })
                            .catch((retryError) => {
                                console.error('重试失败:', retryError);
                                sendResponse({ status: 'error', error: retryError.message });
                            });
                    } else {
                        sendResponse({ status: 'error', error: error.message });
                    }
                });
            return true;
        } else if (request.action === 'clearAllData') {
            // 清除所有数据：IndexedDB + 存储状态
            Database.clearIndexedDB()
                .then(() => {
                    chrome.storage.local.remove('fetchStatus', () => {
                        console.log('🔄 所有数据清除完成');
                        sendResponse({ ok: true });
                    });
                })
                .catch(error => {
                    console.error('清除数据失败:', error);
                    sendResponse({ ok: false, error: error.message });
                });
            return true;
        } else if (request.action === 'testDatabase') {
            // 测试数据库数据
            Database.getAllPickingDetails((result) => {
                if (result.data) {
                    console.log('✅ 数据库测试成功，共有', result.data.length, '条记录');
                    sendResponse({ 
                        ok: true, 
                        count: result.data.length,
                        sample: result.data.slice(0, 2)
                    });
                } else {
                    console.error('❌ 数据库测试失败:', result.error);
                    sendResponse({ ok: false, error: result.error });
                }
            });
            return true;
        } else if (request.action === 'deleteDatabase') {
            // 删除数据库
            Database.deleteDB()
                .then(() => {
                    console.log('✅ 数据库删除成功');
                    sendResponse({ ok: true });
                })
                .catch(error => {
                    console.error('❌ 数据库删除失败:', error);
                    sendResponse({ ok: false, error: error.message });
                });
            return true;
        }
    }
}; 
// 捡货单抓取模块
const PickingFetcher = {
    fetchPickings() {
        console.log('开始执行 fetchPickings......');

        const now = Date.now();
        const today = Utils.getCurrentDate();

        return new Promise((resolve, reject) => {
            // 添加超时处理
            const timeout = setTimeout(() => {
                reject(new Error('请求超时，请检查网络连接'));
            }, 30000); // 30秒超时

            chrome.storage.local.get(['fetchStatus'], (result) => {
                const fetchStatus = result.fetchStatus || { lastFetchDate: '', completed: false, lastFetchTime: 0 };
     
                chrome.storage.local.set({
                    fetchStatus: { lastFetchDate: today, completed: false, lastFetchTime: now }
                }, () => {
                    Database.clearIndexedDB()
                        .then(() => {
                            const url = 'http://yzt.wms.yunwms.com/shipment/picking/list/page/1/pageSize/200';
                            const params = new URLSearchParams({ dateFor: today });

                            console.log('=== 开始抓取拣货单列表 ===');
                            console.log('列表API地址:', url);
                            console.log('请求参数:', params.toString());

                            fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                                body: params.toString(),
                                credentials: 'include'
                            })
                                .then(response => {
                                    console.log('收到响应:', response.status, response.statusText);
                                    if (!response.ok) {
                                        throw new Error(`请求拣货单号列表失败: ${response.status} ${response.statusText}`);
                                    }
                                    return response.json();
                                })
                                .then(json => {
                                    console.log('拣货单列表响应:', json);

                                    // 检查响应格式
                                    if (!json) {
                                        throw new Error('服务器返回空响应');
                                    }

                                    if (json.data && Array.isArray(json.data)) {
                                        console.log('找到数据数组，长度:', json.data.length);

                                        if (json.data.length === 0) {
                                            console.log('⚠️ 数据数组为空');
                                            clearTimeout(timeout);
                                            resolve(0);
                                            return;
                                        }

                                        // 保存捡货单列表的完整信息
                                        const pickingListData = json.data.map(item => {
                                            let warehouse_name = '';
                                            const warehouseCode = String(item.E1 || '');
                                            if (warehouseCode === '1') {
                                                warehouse_name = 'YZTUS [云泽通US仓]';
                                            } else if (warehouseCode === '2') {
                                                warehouse_name = 'YZTUS02 [云泽通US2号仓]';
                                            } else {
                                                console.log(`⚠️ 未知的仓库编码: ${warehouseCode}`);
                                                warehouse_name = `未知仓库 [${warehouseCode}]`;
                                            }

                                            // 根据picking_type确定picking_type_name
                                            let picking_type_name = '';
                                            if (item.E10 === '0') {
                                                picking_type_name = '一票一件';
                                            } else if (item.E10 === '1') {
                                                picking_type_name = '一票一件多个';
                                            } else if (item.E10 === '2') {
                                                picking_type_name = '一票多件';
                                            }

                                            return {
                                                picking_no: item.E2,
                                                warehouse_code: item.E1 || '',
                                                warehouse_name: warehouse_name,
                                                order_total: item.E5 || 0,
                                                product_total: item.E7 || 0,
                                                picking_type: item.E10 || '',
                                                picking_type_name: picking_type_name,
                                            };
                                        });
                                        
                                        console.log('捡货单列表数据:', pickingListData);
                                        
                                        // 保存捡货单列表信息
                                        return Database.savePickingListData(pickingListData)
                                            .then(() => {
                                                const pickingNumbers = pickingListData.map(item => item.picking_no);
                                                console.log('拣货单号:', pickingNumbers);
                                                console.log('拣货单数量:', pickingNumbers.length);
                                                
                                                console.log(`=== 拣货单列表抓取完成 ===`);
                                                console.log(`共抓取到 ${pickingNumbers.length} 条拣货单`);
                                                console.log(`拣货单号列表:`, pickingNumbers);
                                                return pickingNumbers.length;
                                            });
                                    } else {
                                        console.log('未找到 data 数组或数据格式不正确');
                                        console.log('响应内容:', json);
                                        clearTimeout(timeout);
                                        resolve(0);
                                        return;
                                    }
                                })
                                .then((dataCount) => {
                                    chrome.storage.local.set({
                                        fetchStatus: { lastFetchDate: today, completed: true, lastFetchTime: now }
                                    }, () => {
                                        console.log(`fetchPackings 完成，抓取了 ${dataCount} 条数据`);
                                        clearTimeout(timeout);
                                        resolve(dataCount);
                                    });
                                })
                                .catch(error => {
                                    console.error('❌ fetch 请求失败:', error);
                                    console.log('🔎 请求的 URL:', url);
                                    clearTimeout(timeout);
                                    reject(error);
                                });
                        })
                        .catch(error => {
                            console.error('清空 IndexedDB 失败:', error);
                            clearTimeout(timeout);
                            reject(error);
                        });
                });
            });
        });
    }
}; 
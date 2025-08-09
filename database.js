// 数据库操作模块
const Database = {
    openDB() {
        return new Promise((resolve, reject) => {
            console.log('尝试打开IndexedDB...');
            
            // 检查IndexedDB是否可用
            if (typeof indexedDB === 'undefined') {
                reject(new Error('IndexedDB不可用'));
                return;
            }
            
            try {
                // 先尝试打开数据库，不指定版本，让浏览器自动处理版本
                const request = indexedDB.open('PickingDetailsDB');
                console.log('IndexedDB打开请求已发送（自动版本）');

                request.onupgradeneeded = (event) => {
                    console.log('IndexedDB升级中...');
                    const db = event.target.result;
                    console.log('当前数据库版本:', db.version);
                    
                    if (!db.objectStoreNames.contains('pickingDetails')) {
                        const store = db.createObjectStore('pickingDetails', { keyPath: 'picking_no' });
                        console.log('创建对象存储: pickingDetails');
                    }
                };

                request.onsuccess = (event) => {
                    const db = event.target.result;
                    console.log('IndexedDB打开成功，版本:', db.version);
                    resolve(db);
                };
                
                request.onerror = (event) => {
                    console.error('IndexedDB打开失败:', event.target.error);
                    const errorMessage = event.target.error ? event.target.error.message : '未知错误';
                    reject(new Error('IndexedDB 打开失败：' + errorMessage));
                };
                
                request.onblocked = (event) => {
                    console.error('IndexedDB被阻塞:', event);
                    reject(new Error('IndexedDB被阻塞'));
                };
            } catch (error) {
                console.error('IndexedDB操作异常:', error);
                reject(new Error('IndexedDB操作异常: ' + error.message));
            }
        });
    },

    clearIndexedDB() {
        console.log('开始执行 clearIndexedDB......');
        return new Promise((resolve, reject) => {
            this.openDB().then(db => {
                console.log('✅ 数据库打开成功，开始清空数据...');
                const transaction = db.transaction(['pickingDetails'], 'readwrite');
                const store = transaction.objectStore('pickingDetails');
                const clearRequest = store.clear();

                clearRequest.onsuccess = () => {
                    console.log('✅ IndexedDB 数据已清空');
                    resolve();
                };
                clearRequest.onerror = (event) => {
                    console.error('❌ 清空IndexedDB失败:', event.target.error);
                    reject(new Error('清空 IndexedDB 失败: ' + (event.target.error ? event.target.error.message : '未知错误')));
                };
                transaction.oncomplete = () => {
                    console.log('✅ 数据库事务完成，关闭连接');
                    db.close();
                };
                transaction.onerror = (event) => {
                    console.error('❌ 数据库事务失败:', event.target.error);
                    reject(new Error('数据库事务失败: ' + (event.target.error ? event.target.error.message : '未知错误')));
                };
            }).catch(error => {
                console.error('❌ 打开数据库失败:', error);
                reject(error);
            });
        });
    },

    // 删除数据库（用于重置版本）
    deleteDB() {
        return new Promise((resolve, reject) => {
            console.log('开始删除IndexedDB...');
            
            if (typeof indexedDB === 'undefined') {
                reject(new Error('IndexedDB不可用'));
                return;
            }
            
            const request = indexedDB.deleteDatabase('PickingDetailsDB');
            
            request.onsuccess = () => {
                console.log('IndexedDB删除成功');
                resolve();
            };
            
            request.onerror = (event) => {
                console.error('IndexedDB删除失败:', event.target.error);
                reject(new Error('IndexedDB删除失败: ' + (event.target.error ? event.target.error.message : '未知错误')));
            };
        });
    },

    saveToIndexedDB(extractedData) {
        console.log('开始执行 saveToIndexedDB......');
        console.log('要保存的数据:', extractedData);
        console.log('数据条数:', extractedData.length);
        
        return new Promise((resolve, reject) => {
            this.openDB().then(db => {
                console.log('✅ 数据库打开成功，开始保存数据');
                const transaction = db.transaction(['pickingDetails'], 'readwrite');
                const store = transaction.objectStore('pickingDetails');
                let savedCount = 0;
                let errorCount = 0;

                // 使用Promise.all确保所有数据都保存完成
                const savePromises = extractedData.map((item, index) => {
                    return new Promise((resolveItem, rejectItem) => {
                        console.log(`处理第 ${index + 1} 条数据:`, item);
                        
                        // 先检查是否存在记录
                        const getRequest = store.get(item.picking_no);
                        
                        getRequest.onsuccess = () => {
                            const existingRecord = getRequest.result || { 
                                picking_no: item.picking_no,
                                warehouse: item.warehouse || '',
                                warehouse_code: item.warehouse_code || '',
                                warehouse_name: item.warehouse_name || '',
                                order_total: item.order_total || 0,
                                product_total: item.product_total || 0,
                                picking_type: item.picking_type || '',
                                picking_type_name: item.picking_type_name || '',
                                sku_code: [],
                                sku_details: [],
                                order_details: [],
                                total_count: 0
                            };
                            
                            // 检查是否已存在相同的SKU
                            const existingSkuIndex = existingRecord.sku_details.findIndex(sku => sku.code === item.sku_code);
                            if (existingSkuIndex >= 0) {
                                // 如果SKU已存在，更新数量
                                existingRecord.sku_details[existingSkuIndex].count += (item.count || 1);
                            } else {
                                // 如果SKU不存在，添加新的SKU详情
                                existingRecord.sku_details.push({
                                    code: item.sku_code,
                                    count: item.count || 1
                                });
                                existingRecord.sku_code.push(item.sku_code);
                            }
                            
                            // 添加订单详情（避免重复）
                            const existingOrderIndex = existingRecord.order_details.findIndex(order => 
                                order.order_no === item.order_no && order.tracking_no === item.tracking_no
                            );
                            
                            if (existingOrderIndex === -1) {
                                existingRecord.order_details.push({
                                    basket_no: item.basket_no,
                                    container_no: item.container_no,
                                    order_no: item.order_no,
                                    tracking_no: item.tracking_no,
                                    product_code: item.product_code,
                                    count: item.count || 1
                                });
                            }
                            
                            // 更新总数量
                            existingRecord.total_count = existingRecord.sku_details.reduce((sum, sku) => sum + sku.count, 0);
                            
                            // 保存记录
                            const putRequest = store.put(existingRecord);
                            
                            putRequest.onsuccess = () => {
                                console.log(`✅ 数据保存成功: picking_no: ${item.picking_no}, sku_code: ${item.sku_code}, count: ${item.count}`);
                                savedCount++;
                                resolveItem();
                            };
                            
                            putRequest.onerror = (event) => {
                                console.error(`❌ 保存失败: picking_no: ${item.picking_no}`, event.target.error);
                                errorCount++;
                                rejectItem(new Error(`保存失败: ${item.picking_no}`));
                            };
                        };
                        
                        getRequest.onerror = (event) => {
                            console.error(`❌ 读取失败: picking_no: ${item.picking_no}`, event.target.error);
                            errorCount++;
                            rejectItem(new Error(`读取失败: ${item.picking_no}`));
                        };
                    });
                });

                // 等待所有保存操作完成
                Promise.all(savePromises)
                    .then(() => {
                        console.log(`✅ IndexedDB保存完成，成功保存 ${savedCount} 条记录`);
                        resolve();
                    })
                    .catch(error => {
                        console.error('❌ 部分数据保存失败:', error);
                        reject(error);
                    });

                transaction.oncomplete = () => {
                    console.log('数据库事务完成，关闭连接');
                    db.close();
                };
                
                transaction.onerror = (event) => {
                    console.error('❌ 数据库事务失败:', event.target.error);
                    reject(new Error('数据库事务失败: ' + (event.target.error ? event.target.error.message : '未知错误')));
                };
            }).catch(error => {
                console.error('❌ 打开数据库失败:', error);
                reject(error);
            });
        });
    },

    getAllPickingDetails(callback) {
        console.log('开始执行 getAllPickingDetails......');
        this.openDB().then(db => {
            console.log('✅ 数据库打开成功，开始读取数据...');
            const transaction = db.transaction(['pickingDetails'], 'readonly');
            const store = transaction.objectStore('pickingDetails');
            const getAll = store.getAll();

            getAll.onsuccess = () => {
                const result = getAll.result;
                console.log('✅ 数据读取成功，共读取到', result.length, '条记录');
                console.log('数据示例:', result.slice(0, 2));
                callback({ data: result });
            };
            getAll.onerror = (event) => {
                console.error('❌ 读取 IndexedDB 数据失败:', event.target.error);
                callback({ error: '读取 IndexedDB 数据失败' });
            };
            transaction.oncomplete = () => {
                console.log('✅ 数据库读取事务完成，关闭连接');
                db.close();
            };
        }).catch(error => {
            console.error('❌ 打开数据库失败:', error);
            callback({ error: '打开 IndexedDB 失败: ' + error.message });
        });
    },

    getSkuCodesByPickingNo(picking_no, sku_code, callback) {
        console.log('开始执行 getSkuCodesByPickingNo......');
        this.openDB().then(db => {
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
    },

    savePickingListData(pickingListData) {
        console.log('开始执行 savePickingListData......');
        console.log('要保存的拣货单列表数据:', pickingListData);
        console.log('数据条数:', pickingListData.length);
        
        return new Promise((resolve, reject) => {
            this.openDB().then(db => {
                console.log('✅ 数据库打开成功，开始保存拣货单列表数据');
                const transaction = db.transaction(['pickingDetails'], 'readwrite');
                const store = transaction.objectStore('pickingDetails');
                let savedCount = 0;
                let errorCount = 0;

                // 使用Promise.all确保所有数据都保存完成
                const savePromises = pickingListData.map((item, index) => {
                    return new Promise((resolveItem, rejectItem) => {
                        console.log(`处理第 ${index + 1} 条拣货单数据:`, item);
                        
                        const record = {
                            picking_no: item.picking_no,
                            warehouse: item.warehouse,
                            warehouse_code: item.warehouse_code,
                            warehouse_name: item.warehouse_name,
                            order_total: item.order_total,
                            product_total: item.product_total,
                            picking_type: item.picking_type,
                            picking_type_name: item.picking_type_name,
                            sku_code: [],
                            sku_details: [],
                            order_details: [],
                            total_count: 0
                        };
                    
                        const putRequest = store.put(record);

                        putRequest.onsuccess = () => {
                            console.log(`✅ 拣货单数据保存成功: picking_no: ${item.picking_no}`);
                            savedCount++;
                            resolveItem();
                        };
                        
                        putRequest.onerror = (event) => {
                            console.error(`❌ 保存失败: picking_no: ${item.picking_no}`, event.target.error);
                            errorCount++;
                            rejectItem(new Error(`保存失败: ${item.picking_no}`));
                        };
                    });
                });

                // 等待所有保存操作完成
                Promise.all(savePromises)
                    .then(() => {
                        console.log(`✅ 拣货单列表数据保存完成，成功保存 ${savedCount} 条记录`);
                        resolve();
                    })
                    .catch(error => {
                        console.error('❌ 部分拣货单数据保存失败:', error);
                        reject(error);
                    });

                transaction.oncomplete = () => {
                    console.log('数据库事务完成，关闭连接');
                    db.close();
                };
                
                transaction.onerror = (event) => {
                    console.error('❌ 数据库事务失败:', event.target.error);
                    reject(new Error('数据库事务失败: ' + (event.target.error ? event.target.error.message : '未知错误')));
                };
            }).catch(error => {
                console.error('❌ 打开数据库失败:', error);
                reject(error);
            });
        });
    },

    /**
     * 获取拣货类型名称
     * @param {string} pickingType - 拣货类型代码
     * @returns {string} - 拣货类型名称
     */
    getPickingTypeName(pickingType) {
        switch (pickingType) {
            case '0':
                return '一票一件';
            case '1':
                return '一票一件多个';
            case '2':
                return '一票多件';
            default:
                return `未知类型[${pickingType}]`;
        }
    },

    /**
     * 根据仓库ID获取拣货单列表
     * @param {string} warehouseCode - 仓库ID：'1' 或 '2'
     * @param {boolean} isSkuPack - 是否为按SKU打包页面
     * @param {boolean} isSorting - 是否为二次分拣页面
     * @returns {Promise<Array>} - 拣货单号数组
     */
    getPickingCodesByWarehouse(warehouseCode, isSkuPack = false, isSorting = false) {
        console.log(`开始查询仓库 ${warehouseCode} 的拣货单列表，按SKU打包: ${isSkuPack}，二次分拣: ${isSorting}`);
        
        return new Promise((resolve, reject) => {
            this.openDB().then(db => {
                const transaction = db.transaction(['pickingDetails'], 'readonly');
                const store = transaction.objectStore('pickingDetails');
                const getAllRequest = store.getAll();

                getAllRequest.onsuccess = () => {
                    const allRecords = getAllRequest.result;
                    console.log(`数据库中共有 ${allRecords.length} 条拣货单记录`);
                    
                    // 调试：查看第一条记录的结构
                    if (allRecords.length > 0) {
                        console.log('第一条记录的结构:', allRecords[0]);
                        console.log('warehouse_code字段值:', allRecords[0].warehouse_code);
                        console.log('warehouse字段值:', allRecords[0].warehouse);
                    }
                    
                    // 过滤指定仓库的拣货单 - 尝试多个可能的字段名
                    let filteredRecords = allRecords.filter(record => {
                        const warehouseCodeMatch = record.warehouse_code === warehouseCode;
                        const warehouseMatch = record.warehouse === warehouseCode;
                        console.log(`记录 ${record.picking_no}: warehouse_code=${record.warehouse_code}, warehouse=${record.warehouse}, 匹配结果: ${warehouseCodeMatch || warehouseMatch}`);
                        return warehouseCodeMatch || warehouseMatch;
                    });
                    
                    // 根据页面类型进行过滤
                    if (isSkuPack) {
                        // 按SKU打包页面：只显示一票一件的拣货单
                        filteredRecords = filteredRecords.filter(record => 
                            record.picking_type === '0' || record.picking_type_name === '一票一件'
                        );
                        console.log(`按SKU打包页面，过滤后剩余 ${filteredRecords.length} 条一票一件记录`);
                    } else if (isSorting) {
                        // 二次分拣页面：显示除了一票一件之外的其他拣货单
                        filteredRecords = filteredRecords.filter(record => 
                            record.picking_type !== '0' && record.picking_type_name !== '一票一件'
                        );
                        console.log(`二次分拣页面，过滤后剩余 ${filteredRecords.length} 条非一票一件记录`);
                    }
                    
                    // 提取拣货单号和类别信息
                    const pickingCodes = filteredRecords.map(record => ({
                        code: record.picking_no,
                        type: record.picking_type_name || this.getPickingTypeName(record.picking_type),
                        displayText: `${record.picking_no} - [${record.picking_type_name || this.getPickingTypeName(record.picking_type)}]`
                    }));
                    
                    console.log(`仓库 ${warehouseCode} 的拣货单数量: ${pickingCodes.length}`);
                    console.log('拣货单列表:', pickingCodes);
                    
                    resolve(pickingCodes);
                };

                getAllRequest.onerror = (event) => {
                    console.error('❌ 查询拣货单列表失败:', event.target.error);
                    reject(new Error('查询拣货单列表失败: ' + (event.target.error ? event.target.error.message : '未知错误')));
                };

                transaction.oncomplete = () => {
                    console.log('数据库查询事务完成，关闭连接');
                    db.close();
                };
            }).catch(error => {
                console.error('❌ 打开数据库失败:', error);
                reject(error);
            });
        });
    }
};

// 将模块挂载到全局以便其它脚本访问
if (typeof window !== 'undefined') {
    window.Database = Database;
}
// 拣货单选择器模块
const PickingCodeSelector = {
    // 数据库操作对象
    database: null,

    /**
     * 设置数据库对象
     * @param {Object} db - 数据库对象
     */
    setDatabase(db) {
        this.database = db;
    },
    /**
     * 初始化拣货单选择器
     * @param {string} warehouseId - 仓库ID
     * @param {boolean} isSkuPack - 是否为按SKU打包页面
     * @param {boolean} isSorting - 是否为二次分拣页面
     */
    async init(warehouseId, isSkuPack = false, isSorting = false) {
        console.log(`初始化拣货单选择器，仓库ID: ${warehouseId}，按SKU打包: ${isSkuPack}，二次分拣: ${isSorting}`);
        
        try {
            // 通过消息传递获取拣货单列表
            const pickingCodes = await this.getPickingCodesByWarehouse(warehouseId, isSkuPack, isSorting);
            
            // 创建或更新选择器
            this.createSelector(pickingCodes);
            
            console.log('拣货单选择器初始化完成');
        } catch (error) {
            console.error('初始化拣货单选择器失败:', error);
            // 即使失败也创建选择器，只是没有选项
            this.createSelector([]);
        }
    },

    /**
     * 通过消息传递获取指定仓库的拣货单列表
     * @param {string} warehouseId - 仓库ID
     * @param {boolean} isSkuPack - 是否为按SKU打包页面
     * @param {boolean} isSorting - 是否为二次分拣页面
     * @returns {Promise<Array>} - 拣货单号数组
     */
    getPickingCodesByWarehouse(warehouseId, isSkuPack = false, isSorting = false) {
        return new Promise((resolve, reject) => {
            // 使用 safeSendMessage 函数（如果可用）
            if (typeof safeSendMessage === 'function') {
                safeSendMessage({ 
                    action: 'getPickingCodesByWarehouse', 
                    warehouseId: warehouseId,
                    isSkuPack: isSkuPack,
                    isSorting: isSorting
                }, (response) => {
                    if (response && response.success) {
                        resolve(response.data || []);
                    } else {
                        reject(new Error(response?.error || '获取拣货单列表失败'));
                    }
                });
            } else {
                // 降级方案：直接调用数据库（如果可用）
                if (this.database) {
                    this.database.getPickingCodesByWarehouse(warehouseId, isSkuPack, isSorting)
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject(new Error('无法获取拣货单列表'));
                }
            }
        });
    },

    /**
     * 创建拣货单选择器
     * @param {Array} pickingCodes - 拣货单号数组
     */
    createSelector(pickingCodes) {
        console.log('创建拣货单选择器，拣货单数量:', pickingCodes.length);
        
        // 查找现有的输入框
        const existingInput = document.querySelector('#pickingCode');
        if (!existingInput) {
            console.error('未找到拣货单输入框 #pickingCode');
            return;
        }

        // 检查是否已经初始化过
        if (existingInput.hasAttribute('data-selector-initialized')) {
            console.log('拣货单选择器已经初始化过，只更新选项');
            this.updateSelector(pickingCodes);
            return;
        }

        // 先创建datalist
        const datalist = document.createElement('datalist');
        datalist.id = 'pickingCodeList';

        // 添加拣货单选项
        pickingCodes.forEach(item => {
            const option = document.createElement('option');
            // 如果item是对象，使用displayText，否则使用code（向后兼容）
            const displayText = typeof item === 'object' ? item.displayText : item;
            const value = typeof item === 'object' ? item.code : item;
            
            option.value = value;
            option.textContent = displayText;
            datalist.appendChild(option);
            
            console.log('添加选项:', { value, displayText });
        });

        // 将datalist添加到页面
        document.body.appendChild(datalist);

        // 创建新的输入框
        const newInput = document.createElement('input');
        newInput.id = 'pickingCode';
        newInput.type = 'text';
        newInput.placeholder = '请输入或选择拣货单（显示格式：拣货单号 - [类别]）';
        newInput.setAttribute('list', 'pickingCodeList'); // 使用setAttribute确保list属性正确设置
        newInput.className = existingInput.className;
        newInput.style.cssText = existingInput.style.cssText;
        
        // 添加焦点事件，显示所有选项
        newInput.addEventListener('focus', function() {
            console.log('焦点事件触发，当前值:', this.value);
            // 焦点事件不改变内容，只显示下拉选项
        });
        
        // 添加点击事件，确保点击时显示所有选项
        newInput.addEventListener('click', function() {
            console.log('点击事件触发，当前值:', this.value);
            // 点击事件不改变内容，只显示下拉选项
        });
        
        // 标记为已初始化
        newInput.setAttribute('data-selector-initialized', 'true');

        // 直接替换原有输入框
        const oldInput = existingInput;
        oldInput.parentNode.replaceChild(newInput, oldInput);

        // 验证创建结果
        const createdDatalist = document.querySelector('#pickingCodeList');
        const createdInput = document.querySelector('#pickingCode');
        
        console.log(`拣货单选择器创建完成，添加了 ${pickingCodes.length} 个选项`);
        console.log('创建的datalist:', createdDatalist);
        console.log('创建的input:', createdInput);
        console.log('input的list属性:', createdInput ? createdInput.list : 'input不存在');
        console.log('datalist的选项数量:', createdDatalist ? createdDatalist.children.length : 'datalist不存在');
    },

    /**
     * 更新拣货单选择器
     * @param {Array} pickingCodes - 新的拣货单号数组
     */
    updateSelector(pickingCodes) {
        console.log('更新拣货单选择器，新拣货单数量:', pickingCodes.length);
        
        // 查找现有的datalist
        let datalist = document.querySelector('#pickingCodeList');
        
        if (!datalist) {
            console.log('datalist不存在，跳过更新');
            return;
        }

        // 清空现有选项
        datalist.innerHTML = '';

        // 添加新的拣货单选项
        pickingCodes.forEach(item => {
            const option = document.createElement('option');
            // 如果item是对象，使用displayText，否则使用code（向后兼容）
            const displayText = typeof item === 'object' ? item.displayText : item;
            const value = typeof item === 'object' ? item.code : item;
            
            option.value = value;
            option.textContent = displayText;
            datalist.appendChild(option);
        });

        console.log(`拣货单选择器更新完成，现在有 ${pickingCodes.length} 个选项`);
    },

    /**
     * 清空拣货单选择器
     */
    clearSelector() {
        const input = document.querySelector('#pickingCode');
        if (input) {
            input.value = '';
        }
        
        const datalist = document.querySelector('#pickingCodeList');
        if (datalist) {
            datalist.innerHTML = '';
        }
        
        console.log('拣货单选择器已清空');
    },


};

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PickingCodeSelector;
} 
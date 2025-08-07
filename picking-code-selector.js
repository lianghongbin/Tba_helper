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

        // 创建自定义下拉容器
        const dropdownContainer = document.createElement('div');
        dropdownContainer.id = 'pickingCodeDropdown';
        dropdownContainer.style.cssText = `
            position: fixed;
            z-index: 999999;
            display: none;
            background: white;
            border: 1px solid #ccc;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            font-family: Arial, sans-serif;
            font-size: 14px;
            visibility: visible;
            opacity: 1;
            max-height: 400px;
            overflow-y: auto;
        `;

        // 创建新的输入框
        const newInput = document.createElement('input');
        newInput.id = 'pickingCode';
        newInput.type = 'text';
        newInput.placeholder = '请输入或选择拣货单';
        newInput.className = existingInput.className;
        newInput.style.cssText = existingInput.style.cssText + '; position: relative;';
        
        // 创建包装容器
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative; display: inline-block; width: 250px; z-index: 999999;';
        wrapper.appendChild(newInput);
        wrapper.appendChild(dropdownContainer);
        
        // 添加拣货单选项到下拉列表
        this.populateDropdown(dropdownContainer, pickingCodes);
        
        // 添加焦点事件，显示所有选项
        newInput.addEventListener('focus', function(e) {
            console.log('焦点事件触发，当前值:', this.value);
            
            // 先全选文本
            this.select();
            
            // 显示下拉选项
            setTimeout(() => {
                console.log('准备显示下拉选项');
                console.log('下拉容器存在:', !!dropdownContainer);
                console.log('下拉容器当前显示状态:', dropdownContainer.style.display);
                console.log('下拉容器选项数量:', dropdownContainer.children.length);
                
                // 重置所有选项的显示状态，确保显示所有选项
                const options = dropdownContainer.querySelectorAll('.dropdown-option');
                options.forEach(option => {
                    option.style.display = 'block';
                });
                
                // 计算下拉容器的位置
                const inputRect = this.getBoundingClientRect();
                dropdownContainer.style.left = inputRect.left + 'px';
                dropdownContainer.style.top = (inputRect.bottom + 5) + 'px';
                dropdownContainer.style.width = inputRect.width + 'px';
                
                dropdownContainer.style.display = 'block';
                
                // 强制重新计算样式
                dropdownContainer.offsetHeight;
                
                console.log('设置显示后，下拉容器显示状态:', dropdownContainer.style.display);
                console.log('计算后的显示状态:', window.getComputedStyle(dropdownContainer).display);
            }, 100);
        });
        
        // 添加点击事件
        newInput.addEventListener('click', function(e) {
            console.log('点击事件触发，当前值:', this.value);
            
            // 显示下拉选项
            setTimeout(() => {
                // 重置所有选项的显示状态，确保显示所有选项
                const options = dropdownContainer.querySelectorAll('.dropdown-option');
                options.forEach(option => {
                    option.style.display = 'block';
                });
                
                // 计算下拉容器的位置
                const inputRect = this.getBoundingClientRect();
                dropdownContainer.style.left = inputRect.left + 'px';
                dropdownContainer.style.top = (inputRect.bottom + 5) + 'px';
                dropdownContainer.style.width = inputRect.width + 'px';
                
                dropdownContainer.style.display = 'block';
                console.log('显示下拉选项，选项数量:', dropdownContainer.children.length);
            }, 100);
        });
        
        // 添加输入事件，支持搜索过滤
        newInput.addEventListener('input', function(e) {
            console.log('输入事件触发，当前值:', this.value);
            
            // 过滤选项
            const searchValue = this.value.toLowerCase();
            const options = dropdownContainer.querySelectorAll('.dropdown-option');
            
            options.forEach(option => {
                const text = option.textContent.toLowerCase();
                if (text.includes(searchValue)) {
                    option.style.display = 'block';
                } else {
                    option.style.display = 'none';
                }
            });
            
            // 显示下拉选项
            dropdownContainer.style.display = 'block';
        });
        
        // 添加失去焦点事件，隐藏下拉选项
        newInput.addEventListener('blur', function(e) {
            console.log('失去焦点事件触发');
            
            // 检查是否点击了下拉选项
            const relatedTarget = e.relatedTarget;
            if (relatedTarget && relatedTarget.classList.contains('dropdown-option')) {
                console.log('点击了下拉选项，不隐藏下拉容器');
                return;
            }
            
            // 延迟隐藏，让点击选项有时间触发
            setTimeout(() => {
                console.log('隐藏下拉容器');
                dropdownContainer.style.display = 'none';
            }, 200);
        });
        
        // 标记为已初始化
        newInput.setAttribute('data-selector-initialized', 'true');

        // 替换原有输入框
        const oldInput = existingInput;
        oldInput.parentNode.replaceChild(wrapper, oldInput);

        console.log(`拣货单选择器创建完成，添加了 ${pickingCodes.length} 个选项`);
    },

    /**
     * 更新拣货单选择器
     * @param {Array} pickingCodes - 新的拣货单号数组
     */
    updateSelector(pickingCodes) {
        console.log('更新拣货单选择器，新拣货单数量:', pickingCodes.length);
        
        // 查找现有的下拉容器
        let dropdownContainer = document.querySelector('#pickingCodeDropdown');
        
        if (!dropdownContainer) {
            console.log('下拉容器不存在，跳过更新');
            return;
        }

        // 重新填充下拉选项
        this.populateDropdown(dropdownContainer, pickingCodes);

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
        
        const dropdownContainer = document.querySelector('#pickingCodeDropdown');
        if (dropdownContainer) {
            dropdownContainer.innerHTML = '';
        }
        
        console.log('拣货单选择器已清空');
    },

    /**
     * 填充下拉选项
     * @param {HTMLElement} container - 下拉容器
     * @param {Array} pickingCodes - 拣货单数组
     */
    populateDropdown(container, pickingCodes) {
        container.innerHTML = '';
        
        pickingCodes.forEach(item => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
                box-sizing: border-box;
            `;
            
            // 如果item是对象，使用displayText，否则使用code（向后兼容）
            const displayText = typeof item === 'object' ? item.displayText : item;
            const value = typeof item === 'object' ? item.code : item;
            
            option.textContent = displayText;
            option.dataset.value = value;
            
            // 添加悬停效果
            option.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f5f5f5';
            });
            
            option.addEventListener('mouseleave', function() {
                this.style.backgroundColor = 'white';
            });
            
            // 添加点击事件
            option.addEventListener('click', function() {
                console.log('点击选项:', this.dataset.value);
                
                const input = document.querySelector('#pickingCode');
                if (input) {
                    input.value = this.dataset.value;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('设置输入框值:', input.value);
                }
                
                console.log('隐藏下拉容器');
                container.style.display = 'none';
                console.log('下拉容器显示状态:', container.style.display);
            });
            
            container.appendChild(option);
            console.log('添加选项:', { value, displayText });
        });
    },


};

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PickingCodeSelector;
} 
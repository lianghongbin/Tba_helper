// fixking_public_label 公共标签管理模块
const FixkingPublicLabel = {
    /**
     * 创建公共标签
     */
    create() {
        if (document.getElementById('fixking_public_label')) {
            return; // 标签已存在
        }

        // 查找pickingInfo的父容器，用于创建并行容器
        const pickingInfoContainer = document.getElementById('pickingInfo');
        if (!pickingInfoContainer) {
            console.log('未找到pickingInfo容器');
            return;
        }
        
        // 获取pickingInfo的父容器
        const parentContainer = pickingInfoContainer.parentElement;
        if (!parentContainer) {
            console.log('未找到父容器');
            return;
        }

        // 创建独立的公共标签容器，继承pickingInfo的样式
        const publicLabelContainer = document.createElement('div');
        publicLabelContainer.className = 'search-module-condition';
        publicLabelContainer.id = 'fixking_public_label_container';
        publicLabelContainer.style.display = 'none'; // 默认隐藏
        
        // 复制pickingInfo的样式，让它和"未扫描"数量容器保持一样
        publicLabelContainer.style.width = '35%';
        publicLabelContainer.style.float = 'left';
        publicLabelContainer.style.marginTop = '10px';
        
        const publicLabel = document.createElement('span');
        publicLabel.id = 'fixking_public_label';
        publicLabel.className = 'span_title';
        publicLabel.textContent = 'FixKing 提示：';
        publicLabel.style.textAlign = 'center';
        publicLabel.style.display = 'block';
        publicLabel.style.width = '100%';
        
        // 将标签添加到容器中
        publicLabelContainer.appendChild(publicLabel);
        
        // 将容器插入到pickingInfo之前，作为并行容器
        parentContainer.insertBefore(publicLabelContainer, pickingInfoContainer);
        
        console.log('fixking_public_label 创建成功');
    },

    /**
     * 更新公共标签内容
     * @param {string} text - 显示文本
     * @param {string} type - 状态类型：info, success, error, warning
     */
    update(text, type = 'info') {
        const label = document.getElementById('fixking_public_label');
        const container = document.getElementById('fixking_public_label_container');
        
        if (label && container) {
            label.textContent = `FixKing 提示：${text}`;
            container.style.display = 'block'; // 显示整个容器
            
            // 根据类型设置颜色
            switch (type) {
                case 'success':
                    label.style.color = '#28a745';
                    break;
                case 'error':
                    label.style.color = '#dc3545';
                    break;
                case 'warning':
                    label.style.color = '#ffc107';
                    break;
                default:
                    label.style.color = 'inherit';
            }
            
            console.log(`fixking_public_label 更新: ${text} (${type})`);
        }
    },

    /**
     * 隐藏公共标签
     */
    hide() {
        const container = document.getElementById('fixking_public_label_container');
        if (container) {
            container.style.display = 'none';
            console.log('fixking_public_label 已隐藏');
        }
    },

    /**
     * 检查公共标签是否存在
     * @returns {boolean}
     */
    exists() {
        return !!document.getElementById('fixking_public_label');
    },

    /**
     * 开始监听弹窗
     */
    startDialogListener() {
        // 防止重复启动监听器
        if (this.observer) {
            console.log('弹窗监听器已存在，跳过重复启动');
            return;
        }
        
        // 重置所有状态
        this.isProcessing = false;
        this.lastProcessedDialog = null;
        this.lastProcessedTime = 0;
        
        // 使用 MutationObserver 监听 DOM 变化
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 检查是否是错误弹窗
                            if (node.classList && node.classList.contains('ui-dialog')) {
                                const errorMessage = node.querySelector('.tip-error-message');
                                if (errorMessage) {
                                    const errorText = errorMessage.textContent.trim();
                                    const currentTime = Date.now();
                                    
                                    // 防重复处理：如果正在处理中，则跳过
                                    if (this.isProcessing) {
                                        console.log('正在处理中，跳过处理:', errorText);
                                        return;
                                    }
                                    
                                    // 设置处理状态
                                    this.isProcessing = true;
                                    
                                    console.log('检测到错误弹窗:', errorText);
                                    
                                    // 确保公共标签存在，如果提示行不存在则等待
                                    this.ensureLabelExists();
                                    
                                    // 显示错误信息
                                    this.update(errorText, 'error');
                                    
                                    // 获取产品条码并调用方法
                                    const productBarcodeInput = document.getElementById('productBarcode');
                                    const productBarcode = productBarcodeInput ? productBarcodeInput.value : '';
                                    
                                    if (productBarcode) {
                                        HandoverOrderFetcher.findLatestOrderByProductBarcode(productBarcode)
                                            .then(result => {
                                                console.log('findLatestOrderByProductBarcode 返回结果:', result);
                                                this.isProcessing = false; // 处理完成，重置状态
                                            })
                                            .catch(error => {
                                                console.error('findLatestOrderByProductBarcode 调用失败:', error);
                                                this.isProcessing = false; // 处理完成，重置状态
                                            });
                                    } else {
                                        this.isProcessing = false; // 没有产品条码，重置状态
                                    }
                                }
                            }
                        }
                    });
                }
            });
        });

        // 开始监听 - 只监听可能包含弹窗的容器
        const targetContainer = document.body;
        this.observer.observe(targetContainer, {
            childList: true,
            subtree: false  // 改为 false，只监听直接子元素变化
        });

        console.log('弹窗监听器已启动');
    },

    /**
     * 确保公共标签存在，控制提示行显示
     */
    ensureLabelExists() {
        if (this.exists()) {
            return; // 标签已存在
        }

        // 查找提示行容器
        const searchModuleCondition = document.querySelector('.search-module-condition');
        if (searchModuleCondition) {
            // 确保提示行显示
            searchModuleCondition.style.display = 'block';
            searchModuleCondition.style.visibility = 'visible';
            
            // 创建标签
            this.create();
        } else {
            console.log('提示行容器不存在，等待创建...');
            setTimeout(() => {
                this.ensureLabelExists();
            }, 500);
        }
    }
};

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FixkingPublicLabel;
}

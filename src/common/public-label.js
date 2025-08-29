/**
 * 公共标签管理模块
 * 
 * 功能说明：
 * 1. 管理公共标签的创建、显示、隐藏
 * 2. 提供内容更新接口
 * 3. 支持不同类型的消息显示（info, success, error, warning）
 * 
 * 使用场景：
 * - 任何模块都可以调用此模块来显示提示信息
 * - 统一的标签管理，避免重复创建
 * 
 * 作者：TBA FixKing
 * 创建时间：2025年
 */

class PublicLabelManager {
    constructor() {
        this.debugMode = true; // 在浏览器环境中默认开启调试模式
        this.labelId = 'fixking_public_label';
        this.containerId = 'fixking_public_label_container';
        this.init();
    }

    init() {
        // 将实例挂载到全局，供其他模块调用
        window.PublicLabelManager = this;
        // 同步挂载到统一命名空间，避免调用方找不到
        window.xAI = window.xAI || {};
        window.xAI.PublicLabelManager = this;
    }

    /**
     * 显示内容（内部方法，外部不应直接调用）
     * @param {string} text - 显示内容
     * @param {string} type - 消息类型
     * @param {object} options - 可选配置
     * @returns {boolean} 是否成功显示
     */
    show(text, type = 'info', options = {}) {
        try {

            // 确保标签存在
            this.ensureLabelExists();

            // 更新标签内容
            this.updateContent(text, type);

            // 显示标签
            this.visible();

            return true;
        } catch (error) {
            this.log('error', '显示内容时出错:', error);
            return false;
        }
    }

    /**
     * 显示信息类型内容（外部可调用）
     * @param {string} text - 显示内容
     * @param {object} options - 可选配置
     * @returns {boolean} 是否成功显示
     */
    showInfo(text, options = {}) {
        return this.show(text, 'info', options);
    }

    /**
     * 显示成功类型内容（外部可调用）
     * @param {string} text - 显示内容
     * @param {object} options - 可选配置
     * @returns {boolean} 是否成功显示
     */
    showSuccess(text, options = {}) {
        return this.show(text, 'success', options);
    }

    /**
     * 显示错误类型内容（外部可调用）
     * @param {string} text - 显示内容
     * @param {object} options - 可选配置
     * @returns {boolean} 是否成功显示
     */
    showError(text, options = {}) {
        return this.show(text, 'error', options);
    }

    /**
     * 显示警告类型内容（外部可调用）
     * @param {string} text - 显示内容
     * @param {object} options - 可选配置
     * @returns {boolean} 是否成功显示
     */
    showWarning(text, options = {}) {
        return this.show(text, 'warning', options);
    }

    /**
     * 隐藏标签（外部可调用）
     * @returns {boolean} 是否成功隐藏
     */
    hide() {
        try {
            const container = document.getElementById(this.containerId);
            if (container) {
                container.style.display = 'none';
                this.log('info', '标签已隐藏');
            }
            return true;
        } catch (error) {
            this.log('error', '隐藏标签时出错:', error);
            return false;
        }
    }

    /**
     * 显示标签（内部方法，外部不应直接调用）
     * @returns {boolean} 是否成功显示
     */
    visible() {
        try {
            const container = document.getElementById(this.containerId);
            if (container) {
                container.style.display = 'block';
            }
            return true;
        } catch (error) {
            this.log('error', '显示标签时出错:', error);
            return false;
        }
    }

    /**
     * 更新标签内容
     * @param {string} text - 显示内容
     * @param {string} type - 消息类型：info, success, error, warning
     * @returns {boolean} 是否成功更新
     */
    updateContent(text, type = 'info') {
        try {
            const label = document.getElementById(this.labelId);
            const container = document.getElementById(this.containerId);
            
            if (label && container) {
                label.textContent = `FixKing 提示：${text}`;
                
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
                
                return true;
            } else {
                return false;
            }
        } catch (error) {
            this.log('error', '更新标签内容时出错:', error);
            return false;
        }
    }

    /**
     * 确保标签存在
     */
    ensureLabelExists() {
        if (this.labelExists()) {
            return; // 标签已存在
        }

        // 查找提示行容器
        const searchModuleCondition = document.querySelector('.search-module-condition');
        if (searchModuleCondition) {
            // 确保提示行显示
            searchModuleCondition.style.display = 'block';
            searchModuleCondition.style.visibility = 'visible';
            
            // 创建标签
            this.createLabel();
        } else {
            setTimeout(() => {
                this.ensureLabelExists();
            }, 500);
        }
    }

    /**
     * 创建标签
     */
    createLabel() {
        if (document.getElementById(this.labelId)) {
            return; // 标签已存在
        }

        // 查找pickingInfo的父容器，用于创建并行容器
        const pickingInfoContainer = document.getElementById('pickingInfo');
        if (!pickingInfoContainer) {
            return;
        }
        
        // 获取pickingInfo的父容器
        const parentContainer = pickingInfoContainer.parentElement;
        if (!parentContainer) {
            return;
        }

        // 创建独立的公共标签容器，继承pickingInfo的样式
        const publicLabelContainer = document.createElement('div');
        publicLabelContainer.className = 'search-module-condition';
        publicLabelContainer.id = this.containerId;
        publicLabelContainer.style.display = 'none'; // 默认隐藏
        
        // 复制pickingInfo的样式，让它和"未扫描"数量容器保持一样
        publicLabelContainer.style.width = '35%';
        publicLabelContainer.style.float = 'left';
        publicLabelContainer.style.marginTop = '10px';
        
        const publicLabel = document.createElement('span');
        publicLabel.id = this.labelId;
        publicLabel.className = 'span_title';
        publicLabel.textContent = 'FixKing 提示：';
        publicLabel.style.textAlign = 'center';
        publicLabel.style.display = 'block';
        publicLabel.style.width = '100%';
        
        // 将标签添加到容器中
        publicLabelContainer.appendChild(publicLabel);
        
        // 将容器插入到pickingInfo之前，作为并行容器
        parentContainer.insertBefore(publicLabelContainer, pickingInfoContainer);
    }

    /**
     * 检查标签是否存在
     * @returns {boolean}
     */
    labelExists() {
        return !!document.getElementById(this.labelId);
    }

    /**
     * 检查标签是否可见
     * @returns {boolean}
     */
    isVisible() {
        const container = document.getElementById(this.containerId);
        return container ? container.style.display !== 'none' : false;
    }

    /**
     * 获取当前标签内容
     * @returns {string}
     */
    getContent() {
        const label = document.getElementById(this.labelId);
        return label ? label.textContent.replace('FixKing 提示：', '') : '';
    }

    /**
     * 日志输出
     */
    log(level, message, ...args) {
        if (this.debugMode || level === 'error') {
            console[level](`[PublicLabel] ${message}`, ...args);
        }
    }

    /**
     * 销毁实例
     */
    destroy() {
        delete window.PublicLabelManager;
        this.log('info', '公共标签管理器已销毁');
    }
}

// 立即初始化，避免与早期使用者产生竞态
new PublicLabelManager();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PublicLabelManager;
}

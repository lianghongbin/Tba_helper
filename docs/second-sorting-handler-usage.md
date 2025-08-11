# 二次分拣处理器使用说明

## 概述

`SecondSortingHandler` 是一个专门处理二次分拣业务的模块，主要功能包括：

1. **页面加载**: 从指定地址加载二次分拣页面
2. **数据接收**: 接收来自 `error-prompt-handler` 的 `productbarcode` 和 `pickingcode`
3. **数据填充**: 自动将接收到的数据填充到二次分拣页面的相应字段
4. **业务处理**: 执行二次分拣的完整业务流程

## 文件结构

```
intercept/
├── second-sorting-handler.js          # 二次分拣处理器主文件
└── error-prompt-handler.js           # 错误弹窗处理器（已集成调用）

test/
└── second-sorting-test.html          # 测试页面

docs/
└── second-sorting-handler-usage.md   # 本文档
```

## 核心功能

### 1. 数据接收与验证

处理器接收包含以下字段的数据对象：

```javascript
{
    productbarcode: "产品条码",
    pickingcode: "拣货单号"
}
```

数据验证确保：
- 两个字段都存在且不为空
- 字段类型为字符串

### 2. 页面加载

- 使用 iframe 方式加载二次分拣页面
- 支持自定义页面地址
- 提供加载状态监控和超时处理

### 3. 数据填充

自动查找并填充以下字段：

**产品条码字段**:
- `input[name="productBarcode"]`
- `input[name="barcode"]`
- `input[name="product_barcode"]`
- `input[placeholder*="条码"]`
- `#productBarcode`
- `#barcode`

**拣货单号字段**:
- `input[name="pickingCode"]`
- `input[name="picking_code"]`
- `input[name="orderCode"]`
- `input[placeholder*="拣货单"]`
- `#pickingCode`
- `#orderCode`

**其他字段**:
- 仓库编码（自动选择二号仓）
- 根据具体业务需求可扩展

### 4. 业务逻辑执行

- 自动查找并点击提交按钮
- 处理提交后的响应
- 监控成功/错误消息

## 使用方法

### 1. 基本调用

```javascript
// 确保 SecondSortingHandler 已加载
if (window.xAI && window.xAI.SecondSortingHandler) {
    const data = {
        productbarcode: "123456789",
        pickingcode: "PICK001"
    };
    
    const result = await window.xAI.SecondSortingHandler.handleSecondSorting(data);
    
    if (result.success) {
        console.log("二次分拣处理成功:", result.message);
    } else {
        console.error("二次分拣处理失败:", result.message);
    }
}
```

### 2. 自定义配置

```javascript
// 创建自定义配置的处理器实例
const customHandler = new window.xAI.SecondSortingHandler({
    secondSortingUrl: "https://custom-domain.com/sorting",
    debugMode: true
});

const result = await customHandler.handleSecondSorting(data);
```

### 3. 集成到 ErrorPromptHandler

处理器已自动集成到 `error-prompt-handler.js` 中，当检测到需要二次分拣的情况时，会自动调用：

```javascript
// 在 error-prompt-handler.js 中的调用
if (window.xAI && window.xAI.SecondSortingHandler) {
    const secondSortingData = {
        productbarcode: productBarcode,
        pickingcode: oneLabelOneItemMulti.pickingCode
    };
    
    await window.xAI.SecondSortingHandler.handleSecondSorting(secondSortingData);
}
```

## 配置选项

### 构造函数参数

```javascript
new SecondSortingHandler({
    debugMode: true,                    // 调试模式，默认 true
    secondSortingUrl: "自定义URL"        // 二次分拣页面地址
});
```

### 默认配置

- `debugMode`: `true` - 启用详细日志输出
- `secondSortingUrl`: `"https://yzt.wms.yunwms.com/shipment/orders-pack/sorting?quick=104"`

## 页面管理

### 页面状态

- `isPageLoaded`: 页面是否已加载完成
- `iframeContainer`: iframe 容器元素
- `currentData`: 当前处理的数据

### 页面操作

```javascript
// 关闭二次分拣页面
window.xAI.SecondSortingHandler.closeSecondSortingPage();

// 检查页面状态
const status = {
    isPageLoaded: handler.isPageLoaded,
    hasContainer: !!handler.iframeContainer,
    currentData: handler.currentData
};
```

## 错误处理

### 常见错误类型

1. **数据验证错误**: 缺少必要的字段或字段类型不正确
2. **页面加载错误**: 无法访问指定地址或加载超时
3. **字段查找错误**: 无法找到对应的输入字段
4. **业务逻辑错误**: 提交失败或响应异常

### 错误处理示例

```javascript
try {
    const result = await handler.handleSecondSorting(data);
    if (result.success) {
        // 处理成功
    } else {
        // 处理失败
        console.error("业务处理失败:", result.message);
    }
} catch (error) {
    // 捕获异常
    console.error("系统错误:", error.message);
}
```

## 测试

### 使用测试页面

1. 打开 `test/second-sorting-test.html`
2. 输入测试数据
3. 点击相应的测试按钮
4. 查看日志输出和状态信息

### 测试功能

- **基本功能测试**: 测试标准流程
- **自定义地址测试**: 测试不同页面地址
- **模拟调用测试**: 模拟 ErrorPromptHandler 调用
- **数据验证测试**: 测试数据验证逻辑
- **页面管理测试**: 测试页面状态管理

## 扩展开发

### 添加新字段支持

在 `fillAdditionalFields` 方法中添加新的字段处理逻辑：

```javascript
async fillAdditionalFields(iframeDoc, data) {
    // 现有代码...
    
    // 添加新字段支持
    const newFieldSelectors = [
        'input[name="newField"]',
        '#newField'
    ];
    
    for (const selector of newFieldSelectors) {
        const element = iframeDoc.querySelector(selector);
        if (element) {
            element.value = data.newFieldValue;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            break;
        }
    }
}
```

### 自定义业务逻辑

在 `executeSecondSortingLogic` 方法中添加自定义业务处理：

```javascript
async executeSecondSortingLogic(data) {
    // 现有代码...
    
    // 添加自定义业务逻辑
    await this.customBusinessLogic(data);
}

async customBusinessLogic(data) {
    // 实现自定义业务逻辑
}
```

## 注意事项

### 1. 跨域限制

- iframe 加载的页面需要允许跨域访问
- 某些网站可能限制 iframe 嵌入

### 2. 页面兼容性

- 字段选择器需要根据实际页面结构调整
- 不同版本的页面可能有不同的字段名称

### 3. 性能考虑

- 页面加载有 30 秒超时限制
- 建议在生产环境中调整超时时间

### 4. 错误恢复

- 处理器会自动清理资源
- 支持手动关闭和重新打开页面

## 故障排除

### 常见问题

1. **页面无法加载**
   - 检查网络连接
   - 验证页面地址是否正确
   - 检查跨域设置

2. **字段无法填充**
   - 检查字段选择器是否正确
   - 确认页面是否完全加载
   - 查看控制台错误信息

3. **业务逻辑执行失败**
   - 检查提交按钮是否存在
   - 验证表单数据完整性
   - 查看页面响应消息

### 调试技巧

1. 启用 `debugMode` 查看详细日志
2. 使用浏览器开发者工具检查 iframe 内容
3. 在测试页面中逐步验证各个功能

## 更新日志

- **v1.0.0**: 初始版本，支持基本的二次分拣功能
- 支持 iframe 页面加载
- 支持数据自动填充
- 集成到 ErrorPromptHandler

## 技术支持

如有问题或建议，请联系开发团队或查看相关文档。

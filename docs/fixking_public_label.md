# fixking_public_label 公共标签说明

## 概述
`fixking_public_label` 是一个公共的信息显示区域，用于显示各种操作的状态和提示信息。

## 位置
位于拣货单信息统计行的"未扫描"数字后面，具体位置：
```html
<div class="search-module-condition">
    <span class="span_title">拣货单号：</span><span id="pickingInfoPickingCode"></span>
    <span class="span_title" style="margin-left:30px">已扫描：</span>
    <a href="javascript:void(0);" onclick="hadScanData();">
        <span id="pickingInfoPickingScanQty" class="qtyScannedCss">251</span>
    </a>
    <span style="margin-left:30px" class="span_title">未扫描：</span>
    <a href="javascript:void(0);" onclick="waitingData();">
        <span id="pickingInfoPickingQty" class="qtyCss">796</span>
    </a>
    <!-- fixking_public_label 将插入在这里 -->
</div>
```

## 特性
1. **动态显示**：当需要显示信息时，会自动显示这一行
2. **公共接口**：提供统一的API来更新显示内容
3. **样式一致**：与现有的"已扫描"、"未扫描"保持一致的视觉效果

## 使用方式
```javascript
// 创建label
createFixkingPublicLabel();

// 更新显示内容
updateFixkingPublicLabel('正在处理数据...', 'info');
updateFixkingPublicLabel('操作成功！', 'success');
updateFixkingPublicLabel('发生错误', 'error');

// 隐藏label
hideFixkingPublicLabel();
```

## 状态类型
- `info`: 普通信息（默认颜色）
- `success`: 成功信息（绿色）
- `error`: 错误信息（红色）
- `warning`: 警告信息（橙色）






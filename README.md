# AB Bridge Helper (Frame-Aware, MV3)

域名：http://yzt.wms.yunwms.com
A：/shipment/orders-one-pack/list
B：/shipment/orders-pack/sorting

## 思路
- content_script 以 all_frames 注入到每个 iframe，并根据 pathname 判定角色（A/B）。
- 每个 iframe 启动后向 background 发送 ROLE_READY（登记 tabId, frameId）。
- A 发生错误时，A→bg 指定 targetRole=B；bg 根据 (tabId,frameId) 精确把消息投递给 B 的 iframe；
  B 处理后经 sendResponse 单次回包至 A。

## 代码位置
- src/background.js：按 (tabId, frameId) 路由
- src/content/injector.js：识别角色并加载 roleA/roleB
- src/content/sku-trigger.js：A 端读取 #productBarcode，发起到 B
- src/content/second-sorting.js：B 端调 API、填写 #pickingCode、点击 #submitPicking、等待结果并回包
- src/common/logger.js：日志（Options 可配级别）
- src/common/api-client.js：API 客户端封装
- src/common/protocol.js：消息常量与 corrId
- src/options/*：配置页

## 使用
1) chrome://extensions → 开发者模式 → 加载已解压的扩展程序。
2) Options 中配置 Logger/Api 参数。
3) 在 A 页面触发错误（示例 Alt+B），B 自动处理并回包。

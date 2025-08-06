# TBA FixKing Chrome 扩展

## 简介

TBA FixKing 是一个 Chrome 扩展，用于对易仓系统进行功能增强，提升仓库管理效率。

## 主要功能

### 1. 数据抓取
- 自动抓取拣货单列表数据
- 支持多仓库数据管理
- 数据自动保存到本地 IndexedDB

### 2. 数据库查看器
- 查看所有抓取的拣货单数据
- 按仓库统计拣货单数量
- 支持搜索和分页功能

### 3. 数据管理
- 一键清除所有数据
- 数据库大小监控

## 使用方法

1. 安装扩展后，点击扩展图标打开弹窗
2. 点击"抓取数据"按钮开始抓取拣货单数据
3. 点击"数据库查看器"查看已抓取的数据
4. 点击"删除数据"清除所有数据

## 技术栈

- Chrome Extension Manifest V3
- IndexedDB 本地数据存储
- Service Worker 后台处理
- Content Script 页面注入

## 文件结构

```
├── manifest.json              # 扩展配置文件
├── background.js              # Service Worker
├── content.js                 # 内容脚本
├── popup.html                 # 弹窗界面
├── popup-event-handler.js     # 弹窗事件处理
├── popup-utils.js             # 弹窗工具函数
├── popup-styles.css           # 弹窗样式
├── database.js                # 数据库操作
├── picking-fetcher.js         # 数据抓取模块
├── message-handler.js         # 消息处理
├── utils.js                   # 通用工具
├── db-viewer.html             # 数据库查看器
├── db-viewer.js               # 数据库查看器脚本
├── iframe-injector.js         # iframe注入模块
├── iframe.html                # iframe页面
└── iframe-style.css           # iframe样式
``` 
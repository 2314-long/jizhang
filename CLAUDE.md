# 记账 — 项目文档

## 项目概述

| 项目 | 详情 |
|------|------|
| **名称** | 记账 |
| **类型** | 桌面端个人记账应用 |
| **平台** | Windows 10+ / macOS 11+ |
| **用户** | 个人单机使用，无需联网 |
| **货币** | 人民币 ¥ |
| **语言** | 简体中文 |

## 技术栈

| 角色 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Electron | 提供桌面窗口、菜单、系统托盘等系统集成能力 |
| 前端框架 | React 18 + TypeScript | UI 界面开发 |
| 构建工具（渲染进程） | Vite | React 前端开发服务器 + 生产打包 |
| 构建工具（主进程） | esbuild | 将 Electron 主进程 TypeScript 编译为 CJS |
| 数据库 | SQLite（sql.js，纯 JS 实现） | 无需编译原生模块，跨平台兼容性最佳 |
| 打包工具 | electron-builder | 生成 Windows .exe / macOS .dmg 安装包 |
| UI 组件库 | Ant Design 5 | ✅ 已确定，国内最流行、组件最全、中文文档最好 |
| 图表库 | ECharts 5（echarts-for-react） | ✅ 已确定，国内最流行、功能最强、中文文档好 |

## 核心功能

### 记账
- 记录每笔花销：金额、一级分类、二级分类、日期、备注（可选）
- 支持编辑和删除已有账单
- 金额单位为人民币（¥）

### 分类体系（二级联动）

一级分类 12 个，二级分类 55 个：

```
🍽️ 餐饮美食
  ├── 日常三餐
  ├── 零食饮品
  ├── 水果生鲜
  ├── 外卖外送
  ├── 聚餐请客
  └── 烟酒茶叶

🚗 交通出行
  ├── 公交地铁
  ├── 打车网约车
  ├── 共享单车
  ├── 加油充电
  ├── 停车过路费
  └── 长途出行

🏠 住房居家
  ├── 房租
  ├── 房贷
  ├── 水电燃气
  ├── 物业费
  ├── 维修装修
  └── 家居日用

💻 数字生活
  ├── 手机话费
  ├── 宽带网络
  ├── 视频会员
  ├── 软件订阅
  └── 云存储

👗 服饰美妆
  ├── 衣服鞋帽
  ├── 包袋配饰
  ├── 护肤彩妆
  ├── 美发美甲
  └── 珠宝腕表

🏥 医疗健康
  ├── 门诊购药
  ├── 住院医疗
  ├── 体检检查
  ├── 牙科眼科
  └── 健身运动

🎓 学习教育
  ├── 培训进修
  ├── 书籍文具
  ├── 考试考证
  ├── 兴趣培养
  └── 子女教育

🎮 休闲娱乐
  ├── 电影演出
  ├── 游戏充值
  ├── 旅游度假
  ├── KTV桌游
  └── 宠物花费

👫 人情往来
  ├── 孝敬父母
  ├── 红包礼金
  ├── 请客送礼
  ├── 婚丧嫁娶
  └── 捐赠公益

💼 工作事业
  ├── 办公用品
  ├── 出差住宿
  ├── 应酬交际
  └── 设备工具

🛒 购物消费
  ├── 数码电子
  ├── 家用电器
  ├── 个护日用
  ├── 保健食品
  └── 快递物流

🧾 其他支出
  ├── 证件补办
  ├── 罚款缴费
  └── 其他临时
```

### 数据统计
- 月度支出汇总（本月总支出、日均支出）
- 按一级分类统计占比（饼图）
- 按分类统计排行榜（柱状图）
- 月度支出趋势（折线图）

### 数据管理
- 所有数据存储在本地 SQLite 数据库，不联网
- 支持导出账单为 CSV 文件（可直接用 Excel 打开）
- 支持从 CSV 文件导入账单（格式与导出一致）
- 支持数据备份与恢复

## ⚠️ 技术决策规则（贯穿整个项目）

**用户是非技术背景。遇到任何需要技术选型的决策时，Claude 必须遵守以下流程：**

1. 列出 2-4 个可选方案
2. 用通俗易懂的语言向用户解释每个方案是什么
3. 列出每个方案的优势和劣势（至少各2条）
4. 给出明确的推荐意见
5. **等待用户做出选择**，不得自行决定

此规则适用于但不限于：
- UI 组件库选择
- 图表库选择
- CSS 方案选择
- 状态管理方案选择
- 项目目录结构设计
- 数据库表结构设计
- 打包配置方案
- 任何其他涉及技术选型的决策

## 项目结构

```
记账/
├── CLAUDE.md                 # 项目文档（本文件）
├── package.json               # 项目依赖配置
├── electron-builder.yml       # 打包配置
├── tsconfig.json              # TypeScript 配置
├── vite.config.ts             # Vite 构建配置（仅渲染进程）
├── index.html                 # HTML 入口
├── scripts/
│   └── build-electron.mjs     # esbuild 编译 Electron 主进程脚本
├── electron/                  # Electron 主进程代码（TypeScript → esbuild → CJS）
│   ├── main.ts                # 主进程入口
│   ├── preload.ts             # 预加载脚本
│   └── database.ts            # SQLite 数据库操作
├── src/                       # React 渲染进程代码（TypeScript → Vite）
│   ├── main.tsx               # React 入口
│   ├── App.tsx                # 根组件（侧边栏导航布局）
│   ├── App.css                # 全局样式
│   ├── components/
│   │   ├── AddBill.tsx         # 记账表单（含二级分类联动选择）
│   │   ├── BillList.tsx        # 账单列表（筛选、删除、CSV导出）
│   │   └── Statistics.tsx      # 统计图表（饼图/柱状图/折线图）
│   ├── types/
│   │   └── index.ts            # TypeScript 类型定义
│   └── vite-env.d.ts          # Vite 环境类型声明
├── dist-electron/             # Electron 主进程编译输出
│   ├── main.js                # 主进程（esbuild 编译产物）
│   └── preload.js             # 预加载脚本（esbuild 编译产物）
├── dist/                      # React 前端构建输出（Vite 编译产物）
└── resources/                 # 应用图标等静态资源
```

## 开发命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 启动开发模式（Vite 热更新 + Electron 窗口） |
| `npm run build` | 生产构建（esbuild 编译主进程 + Vite 打包渲染进程） |
| `npm run build:electron` | 仅编译 Electron 主进程 |
| `npm run build:renderer` | 仅打包 React 渲染进程 |
| `npm run package:win` | 打包为 Windows .exe 安装包 |
| `npm run package:mac` | 打包为 macOS .dmg 安装包 |

## 架构说明

- **Electron 主进程**（`electron/`）：用 esbuild 直接编译 TypeScript → CommonJS，保留 `require('electron')` 调用不打包
- **React 渲染进程**（`src/`）：用 Vite 打包为标准前端应用
- 主进程和渲染进程通过 IPC（`contextBridge` + `ipcRenderer.invoke`）安全通信
- 数据库文件存储在 Electron 的 `userData` 目录，不同操作系统路径不同

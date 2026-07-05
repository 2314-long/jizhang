# 🐴 记账

桌面端个人记账应用，支持 Windows 和 macOS。数据本地存储，无需联网。

## ✨ 功能

- **📝 记账** — 记录每笔花销：金额、分类、日期、备注
- **📋 账单** — 查看、筛选、编辑、删除账单，支持 CSV 导入/导出
- **📊 统计** — 月度支出汇总、分类占比饼图、排行柱状图、趋势折线图
- **📂 分类管理** — 12 大类 55 小类系统预设，支持用户自定义添加/修改/删除分类
- **💾 数据管理** — SQLite 本地存储，支持数据库备份与恢复

## 🗂️ 分类体系

```
🍽️ 餐饮美食     🚗 交通出行     🏠 住房居家     💻 数字生活
👗 服饰美妆     🏥 医疗健康     🎓 学习教育     🎮 休闲娱乐
👫 人情往来     💼 工作事业     🛒 购物消费     🧾 其他支出
```

每个大类下设 3-6 个二级小类，共 55 个预设分类。用户可自由新增、编辑、删除自定义分类。

## 🛠️ 技术栈

| 角色 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 前端 | React 18 + TypeScript |
| UI 组件 | Ant Design 5 |
| 图表 | ECharts 5 |
| 数据库 | SQLite（sql.js，纯 JS 实现） |
| 构建 | Vite + esbuild |
| 打包 | electron-builder |

## 🚀 本地运行

```bash
# 安装依赖
npm install

# 启动开发模式
npm run dev

# 打包 Windows 安装包
npm run package:win

# 打包 macOS 安装包
npm run package:mac
```

## 📦 项目结构

```
记账/
├── electron/           # Electron 主进程
│   ├── main.ts         # 窗口管理、IPC 通信
│   ├── preload.ts      # 预加载脚本（安全桥接）
│   └── database.ts     # SQLite 数据库操作
├── src/                # React 渲染进程
│   ├── App.tsx         # 根组件（侧边栏导航）
│   ├── components/
│   │   ├── AddBill.tsx        # 记账表单
│   │   ├── BillList.tsx       # 账单列表
│   │   ├── Statistics.tsx     # 统计图表
│   │   └── CategoryManager.tsx # 分类管理
│   └── types/          # TypeScript 类型定义
├── scripts/            # 构建脚本
└── resources/          # 静态资源
```

## 📄 许可

MIT License

---
name: launch
description: 启动记账APP（Vite 热更新 + Electron 窗口）。当用户说"启动"、"启动APP"、"运行"、"跑起来"时使用。
---

## 启动步骤

### 1. 清理端口
```bash
npx kill-port 5173
```

### 2. 启动
```bash
npm run dev
```

### 3. 告知用户
Electron 窗口出现后告诉用户"已启动 🚀"，无需截图或额外操作。

## 常见问题
- 端口 5173 被占用 → 再次 `npx kill-port 5173`
- Electron 磁盘缓存错误（`Unable to move the cache`）→ 忽略，不影响
- 启动失败 → 重试一次

import { contextBridge, ipcRenderer } from 'electron'

/**
 * 预加载脚本：安全地暴露 API 给渲染进程
 * 使用 contextBridge 保证安全性，渲染进程无法直接访问 Node.js API
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ---- 数据库操作 ----

  /** 执行查询语句（SELECT） */
  dbQuery: (sql: string, params?: unknown[]) =>
    ipcRenderer.invoke('db:query', sql, params),

  /** 执行修改语句（INSERT/UPDATE/DELETE） */
  dbRun: (sql: string, params?: unknown[]) =>
    ipcRenderer.invoke('db:run', sql, params),

  // ---- 文件操作 ----

  /** 导出账单为 CSV */
  exportCsv: (data: string) =>
    ipcRenderer.invoke('file:export-csv', data),

  /** 导入 CSV 账单 */
  importCsv: () =>
    ipcRenderer.invoke('file:import-csv'),

  /** 备份数据库 */
  backupDatabase: () =>
    ipcRenderer.invoke('file:backup-db'),

  /** 恢复数据库 */
  restoreDatabase: () =>
    ipcRenderer.invoke('file:restore-db'),
})

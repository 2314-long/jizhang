/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    // 数据库操作
    dbQuery: (sql: string, params?: any[]) => Promise<any>
    dbRun: (sql: string, params?: any[]) => Promise<{ lastID: number; changes: number }>
    // 文件操作
    exportCsv: (data: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
    importCsv: () => Promise<{ success: boolean; data?: string; error?: string }>
    backupDatabase: () => Promise<{ success: boolean; filePath?: string; error?: string }>
    restoreDatabase: () => Promise<{ success: boolean; error?: string }>
  }
}

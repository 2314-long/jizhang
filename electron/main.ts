import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { getDatabase, queryAll, executeRun, saveDb, closeDatabase } from './database'

app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: '记账',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ---- IPC 处理：数据库操作 (sql.js) ----

ipcMain.handle('db:query', async (_event, sql: string, params?: unknown[]) => {
  try {
    await getDatabase()
    return queryAll(sql, params as any[] || [])
  } catch (error: any) {
    console.error('DB Query Error:', error.message)
    throw error
  }
})

ipcMain.handle('db:run', async (_event, sql: string, params?: unknown[]) => {
  try {
    await getDatabase()
    return executeRun(sql, params as any[] || [])
  } catch (error: any) {
    console.error('DB Run Error:', error.message)
    throw error
  }
})

// ---- IPC 处理：文件操作 ----

ipcMain.handle('file:export-csv', async (_event, data: string) => {
  if (!mainWindow) return { success: false, error: '窗口未就绪' }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出账单',
    defaultPath: `账单导出_${new Date().toISOString().slice(0, 10)}.csv`,
    filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
  })

  if (result.canceled || !result.filePath) {
    return { success: false, error: '用户取消' }
  }

  try {
    // 写入 UTF-8 BOM，确保 Excel 正确识别中文
    fs.writeFileSync(result.filePath, '﻿' + data, 'utf-8')
    shell.showItemInFolder(result.filePath)
    return { success: true, filePath: result.filePath }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('file:import-csv', async () => {
  if (!mainWindow) return { success: false, error: '窗口未就绪' }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入账单',
    filters: [{ name: 'CSV 文件', extensions: ['csv'] }],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: '用户取消' }
  }

  try {
    const data = fs.readFileSync(result.filePaths[0], 'utf-8')
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('file:backup-db', async () => {
  if (!mainWindow) return { success: false, error: '窗口未就绪' }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: '备份数据库',
    defaultPath: `记账备份_${new Date().toISOString().slice(0, 10)}.db`,
    filters: [{ name: '数据库文件', extensions: ['db'] }],
  })

  if (result.canceled || !result.filePath) {
    return { success: false, error: '用户取消' }
  }

  try {
    saveDb()
    const db = await getDatabase()
    const data = db.export()
    fs.writeFileSync(result.filePath, Buffer.from(data))
    shell.showItemInFolder(result.filePath)
    return { success: true, filePath: result.filePath }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('file:restore-db', async () => {
  if (!mainWindow) return { success: false, error: '窗口未就绪' }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: '恢复数据库',
    filters: [{ name: '数据库文件', extensions: ['db'] }],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: '用户取消' }
  }

  try {
    const db = await getDatabase()
    const sourceBuffer = fs.readFileSync(result.filePaths[0])
    const sourceData = new Uint8Array(sourceBuffer)

    // 读取源数据中的账单和分类
    const initSqlJs = require('sql.js')
    const SQL = await initSqlJs()
    const srcDb = new SQL.Database(sourceData)

    // 清空当前数据库
    db.run('DELETE FROM bills')
    db.run('DELETE FROM sub_categories')
    db.run('DELETE FROM main_categories')

    // 导入主分类
    const mainCats = srcDb.exec('SELECT * FROM main_categories')
    if (mainCats[0]) {
      for (const row of mainCats[0].values) {
        db.run('INSERT INTO main_categories (id, name, icon, sort_order) VALUES (?, ?, ?, ?)', row)
      }
    }

    // 导入子分类
    const subCats = srcDb.exec('SELECT * FROM sub_categories')
    if (subCats[0]) {
      for (const row of subCats[0].values) {
        db.run('INSERT INTO sub_categories (id, main_category_id, name, sort_order) VALUES (?, ?, ?, ?)', row)
      }
    }

    // 导入账单
    const bills = srcDb.exec('SELECT * FROM bills')
    if (bills[0]) {
      for (const row of bills[0].values) {
        db.run('INSERT INTO bills (id, amount, category_id, bill_date, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', row)
      }
    }

    srcDb.close()
    saveDb()
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// ---- 应用生命周期 ----

app.whenReady().then(async () => {
  // 初始化数据库
  await getDatabase()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})

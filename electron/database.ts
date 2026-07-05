import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'

let db: SqlJsDatabase | null = null
let dbPath: string = ''
const initPromise: Promise<SqlJsDatabase> | null = null

// 缓存分类数据
let cachedCategories: { main_id: number; main_name: string; main_icon: string; sub_id: number; sub_name: string }[] | null = null

/**
 * 获取数据库实例（异步初始化，懒加载）
 */
export async function getDatabase(): Promise<SqlJsDatabase> {
  if (db) return db

  dbPath = path.join(app.getPath('userData'), 'heimajizhang.db')

  // 初始化 sql.js
  // 查找 WASM 文件优先级：dist-electron（生产）> node_modules（开发）
  const wasmLocations = [
    path.join(__dirname, 'sql-wasm.wasm'),
    path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ]
  let SQL: any
  let loaded = false
  for (const loc of wasmLocations) {
    if (fs.existsSync(loc)) {
      SQL = await initSqlJs({ wasmBinary: fs.readFileSync(loc) })
      loaded = true
      break
    }
  }
  if (!loaded) {
    SQL = await initSqlJs()
  }

  // 尝试从文件加载已有数据库
  if (fs.existsSync(dbPath)) {
    try {
      const buffer = fs.readFileSync(dbPath)
      db = new SQL.Database(buffer)
    } catch {
      db = new SQL.Database()
    }
  } else {
    db = new SQL.Database()
  }

  // 启用外键
  db.run('PRAGMA foreign_keys = ON')

  // 初始化表结构
  initTables(db)

  // 初始化默认分类数据
  initCategories(db)

  // 首次保存
  saveDatabase()

  return db
}

/**
 * 将数据库持久化到文件
 */
function saveDatabase(): void {
  if (!db) return
  try {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(dbPath, buffer)
  } catch (err) {
    console.error('保存数据库失败:', err)
  }
}

/**
 * 创建数据库表
 */
function initTables(database: SqlJsDatabase): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category_id INTEGER NOT NULL,
      bill_date TEXT NOT NULL,
      remark TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (category_id) REFERENCES sub_categories(id)
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS main_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS sub_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      main_category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (main_category_id) REFERENCES main_categories(id),
      UNIQUE(main_category_id, name)
    )
  `)
}

/**
 * 初始化默认分类数据
 */
function initCategories(database: SqlJsDatabase): void {
  const result = database.exec('SELECT COUNT(*) as cnt FROM main_categories')
  const cnt = result[0]?.values[0]?.[0] as number
  if (cnt > 0) return

  const categories: { name: string; icon: string; sort: number; subs: string[] }[] = [
    { name: '餐饮美食', icon: '🍽️', sort: 1, subs: ['日常三餐', '零食饮品', '水果生鲜', '外卖外送', '聚餐请客', '烟酒茶叶'] },
    { name: '交通出行', icon: '🚗', sort: 2, subs: ['公交地铁', '打车网约车', '共享单车', '加油充电', '停车过路费', '长途出行'] },
    { name: '住房居家', icon: '🏠', sort: 3, subs: ['房租', '房贷', '水电燃气', '物业费', '维修装修', '家居日用'] },
    { name: '数字生活', icon: '💻', sort: 4, subs: ['手机话费', '宽带网络', '视频会员', '软件订阅', '云存储'] },
    { name: '服饰美妆', icon: '👗', sort: 5, subs: ['衣服鞋帽', '包袋配饰', '护肤彩妆', '美发美甲', '珠宝腕表'] },
    { name: '医疗健康', icon: '🏥', sort: 6, subs: ['门诊购药', '住院医疗', '体检检查', '牙科眼科', '健身运动'] },
    { name: '学习教育', icon: '🎓', sort: 7, subs: ['培训进修', '书籍文具', '考试考证', '兴趣培养', '子女教育'] },
    { name: '休闲娱乐', icon: '🎮', sort: 8, subs: ['电影演出', '游戏充值', '旅游度假', 'KTV桌游', '宠物花费'] },
    { name: '人情往来', icon: '👫', sort: 9, subs: ['孝敬父母', '红包礼金', '请客送礼', '婚丧嫁娶', '捐赠公益'] },
    { name: '工作事业', icon: '💼', sort: 10, subs: ['办公用品', '出差住宿', '应酬交际', '设备工具'] },
    { name: '购物消费', icon: '🛒', sort: 11, subs: ['数码电子', '家用电器', '个护日用', '保健食品', '快递物流'] },
    { name: '其他支出', icon: '🧾', sort: 12, subs: ['证件补办', '罚款缴费', '其他临时'] },
  ]

  for (const cat of categories) {
    database.run('INSERT INTO main_categories (name, icon, sort_order) VALUES (?, ?, ?)', [cat.name, cat.icon, cat.sort])
    const idResult = database.exec('SELECT last_insert_rowid()')
    const mainId = idResult[0]?.values[0]?.[0] as number

    cat.subs.forEach((subName, idx) => {
      database.run('INSERT INTO sub_categories (main_category_id, name, sort_order) VALUES (?, ?, ?)', [mainId, subName, idx + 1])
    })
  }

  saveDatabase()
  console.log('✅ 默认分类数据已初始化')
}

/**
 * 执行查询语句（SELECT），返回记录数组
 */
export function queryAll(sql: string, params: any[] = []): any[] {
  if (!db) throw new Error('数据库未初始化')
  try {
    const stmt = db.prepare(sql)
    if (params.length > 0) {
      stmt.bind(params)
    }
    const rows: any[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
    stmt.free()
    return rows
  } catch (err: any) {
    console.error('DB Query Error:', err.message, 'SQL:', sql)
    throw err
  }
}

/**
 * 执行修改语句（INSERT/UPDATE/DELETE），返回影响信息
 */
export function executeRun(sql: string, params: any[] = []): { lastID: number; changes: number } {
  if (!db) throw new Error('数据库未初始化')
  try {
    db.run(sql, params)
    const lastIdResult = db.exec('SELECT last_insert_rowid()')
    const lastID = lastIdResult[0]?.values[0]?.[0] as number || 0
    const changesResult = db.exec('SELECT changes()')
    const changes = changesResult[0]?.values[0]?.[0] as number || 0
    // 每次写操作后自动保存
    saveDatabase()
    return { lastID, changes }
  } catch (err: any) {
    console.error('DB Run Error:', err.message, 'SQL:', sql)
    throw err
  }
}

/**
 * 手动保存数据库到文件
 */
export function saveDb(): void {
  saveDatabase()
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (db) {
    saveDatabase()
    db.close()
    db = null
  }
}

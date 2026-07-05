/**
 * Electron 启动脚本
 * 处理 ELECTRON_RUN_AS_NODE 环境变量问题 ——
 * 某些系统设置了此变量会导致 Electron 退化到纯 Node.js 模式。
 * 本脚本清除该变量后启动 Electron，确保正常加载 GUI。
 */
import { spawn } from 'child_process'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

// 获取 Electron 二进制路径
const electronPath = require('electron')

// 复制环境变量并移除 ELECTRON_RUN_AS_NODE
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

// 传递额外的命令行参数
const args = process.argv.slice(2)
if (args.length === 0) {
  // 默认：启动当前项目
  args.push(path.join(__dirname, '..'))
}

console.log('🚀 启动黑马记账...')

const child = spawn(electronPath, args, {
  env,
  stdio: 'inherit',
  windowsHide: false,
})

child.on('close', (code) => {
  process.exit(code ?? 0)
})

child.on('error', (err) => {
  console.error('启动失败:', err.message)
  process.exit(1)
})

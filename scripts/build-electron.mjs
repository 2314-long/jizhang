import * as esbuild from 'esbuild'
import { rmSync, cpSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

// 清理旧的构建输出
rmSync(resolve(rootDir, 'dist-electron'), { recursive: true, force: true })

// 编译主进程
await esbuild.build({
  entryPoints: [resolve(rootDir, 'electron/main.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: resolve(rootDir, 'dist-electron/main.js'),
  external: ['electron', 'sql.js', 'path', 'fs', 'util'],
  target: 'node18',
  sourcemap: false,
  minify: false,
})

// 编译预加载脚本
await esbuild.build({
  entryPoints: [resolve(rootDir, 'electron/preload.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: resolve(rootDir, 'dist-electron/preload.js'),
  external: ['electron'],
  target: 'node18',
  sourcemap: false,
  minify: false,
})

// 复制 sql.js WASM 文件到输出目录
const wasmSrc = resolve(rootDir, 'node_modules/sql.js/dist/sql-wasm.wasm')
if (existsSync(wasmSrc)) {
  cpSync(wasmSrc, resolve(rootDir, 'dist-electron/sql-wasm.wasm'))
  console.log('✅ WASM 文件已复制')
}

console.log('✅ Electron 主进程编译完成')

import { useEffect, useRef, useState, useCallback } from 'react'
import { Card, Button, Space, Statistic } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined } from '@ant-design/icons'

// ---- 游戏常量 ----
const COLS = 20
const ROWS = 20
const CELL = 20 // 每格像素
const WIDTH = COLS * CELL
const HEIGHT = ROWS * CELL
const INITIAL_SPEED = 150
const MIN_SPEED = 50
const SPEED_STEP = 5

type Point = { x: number; y: number }
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type GameState = 'idle' | 'playing' | 'paused' | 'over'

const DIRECTION_DELTA: Record<Direction, Point> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
}

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
}

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef({
    snake: [] as Point[],
    food: { x: 10, y: 10 },
    direction: 'RIGHT' as Direction,
    nextDirection: 'RIGHT' as Direction,
    score: 0,
    state: 'idle' as GameState,
    speed: INITIAL_SPEED,
  })
  const [score, setScore] = useState(0)
  const [gameState, setGameState] = useState<GameState>('idle')
  const [highScore, setHighScore] = useState(() => {
    try { return Number(localStorage.getItem('snake_high_score')) || 0 }
    catch { return 0 }
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const highScoreRef = useRef(highScore)
  highScoreRef.current = highScore

  // ---- 工具函数 ----
  const randomFood = useCallback((snake: Point[]): Point => {
    const occupied = new Set(snake.map(p => `${p.x},${p.y}`))
    const free: Point[] = []
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y })
      }
    }
    return free.length > 0 ? free[Math.floor(Math.random() * free.length)] : { x: 0, y: 0 }
  }, [])

  // ---- 渲染 ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { snake, food, state } = gameRef.current

    // 清空画布
    ctx.clearRect(0, 0, WIDTH, HEIGHT)

    // 背景网格
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#16213e' : '#1a1a2e'
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    }

    // 食物
    const fx = food.x * CELL, fy = food.y * CELL
    ctx.fillStyle = '#ff4757'
    ctx.beginPath()
    ctx.arc(fx + CELL / 2, fy + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
    // 食物光晕
    ctx.fillStyle = 'rgba(255, 71, 87, 0.3)'
    ctx.beginPath()
    ctx.arc(fx + CELL / 2, fy + CELL / 2, CELL / 2 + 3, 0, Math.PI * 2)
    ctx.fill()

    // 蛇身
    snake.forEach((p, i) => {
      const sx = p.x * CELL + 1, sy = p.y * CELL + 1, s = CELL - 2
      if (i === 0) {
        // 蛇头
        ctx.fillStyle = '#2ed573'
        ctx.beginPath()
        ctx.roundRect(sx, sy, s, s, 5)
        ctx.fill()
        // 眼睛
        ctx.fillStyle = '#fff'
        const { direction } = gameRef.current
        const ex = p.x * CELL + (direction === 'RIGHT' ? 13 : direction === 'LEFT' ? 4 : 6)
        const ey = p.y * CELL + (direction === 'DOWN' ? 13 : direction === 'UP' ? 4 : 6)
        ctx.beginPath()
        ctx.arc(ex, ey, 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(direction === 'LEFT' || direction === 'RIGHT' ? ex : p.x * CELL + 14, direction === 'LEFT' || direction === 'RIGHT' ? ey + 8 : ey, 2.5, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // 蛇身 — 渐变色
        const ratio = 1 - i / Math.max(snake.length, 1)
        const r = Math.round(46 + ratio * 30)
        const g = Math.round(213 - ratio * 80)
        const b = Math.round(115 - ratio * 40)
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.beginPath()
        ctx.roundRect(sx, sy, s, s, 4)
        ctx.fill()
      }
    })

    // 暂停遮罩
    if (state === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 28px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('⏸ 已暂停', WIDTH / 2, HEIGHT / 2)
    }

    // 结束遮罩
    if (state === 'over') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
      ctx.fillStyle = '#ff4757'
      ctx.font = 'bold 32px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('游戏结束', WIDTH / 2, HEIGHT / 2 - 10)
      ctx.fillStyle = '#fff'
      ctx.font = '16px sans-serif'
      ctx.fillText('点击"重新开始"再来一局', WIDTH / 2, HEIGHT / 2 + 30)
    }

    // 初始状态提示
    if (state === 'idle') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
      ctx.fillStyle = '#2ed573'
      ctx.font = 'bold 24px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('🐍 贪吃蛇', WIDTH / 2, HEIGHT / 2 - 20)
      ctx.fillStyle = '#aaa'
      ctx.font = '14px sans-serif'
      ctx.fillText('点击"开始游戏"或按空格键', WIDTH / 2, HEIGHT / 2 + 20)
    }
  }, [])

  // ---- 游戏逻辑 ----
  const tickRef = useRef<() => void>(() => {})
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handleGameOver = useCallback(() => {
    const g = gameRef.current
    g.state = 'over'
    setGameState('over')
    stopTimer()
    const hs = Math.max(highScoreRef.current, g.score)
    setHighScore(hs)
    try { localStorage.setItem('snake_high_score', String(hs)) } catch { /* noop */ }
    draw()
  }, [stopTimer, draw])

  const startTimer = useCallback(() => {
    stopTimer()
    timerRef.current = setInterval(() => tickRef.current(), gameRef.current.speed)
  }, [stopTimer])

  const tick = useCallback(() => {
    const g = gameRef.current
    if (g.state !== 'playing') return

    g.direction = g.nextDirection
    const delta = DIRECTION_DELTA[g.direction]
    const head = g.snake[0]
    const newHead: Point = { x: head.x + delta.x, y: head.y + delta.y }

    // 撞墙
    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
      handleGameOver()
      return
    }

    // 撞自己（排除尾部 — 尾部在同 tick 会被 pop 腾出）
    const body = g.snake.slice(0, -1)
    if (body.some(p => p.x === newHead.x && p.y === newHead.y)) {
      handleGameOver()
      return
    }

    const ate = newHead.x === g.food.x && newHead.y === g.food.y
    g.snake.unshift(newHead)
    if (ate) {
      g.score += 10
      setScore(g.score)
      g.food = randomFood(g.snake)
      // 加速：(score / 10) × 5ms 递减，下限 50ms
      g.speed = Math.max(MIN_SPEED, INITIAL_SPEED - (g.score / 10) * SPEED_STEP)
      startTimer()
    } else {
      g.snake.pop()
    }
    draw()
  }, [draw, randomFood, startTimer, stopTimer, handleGameOver])
  tickRef.current = tick

  // ---- 游戏控制 ----
  const startGame = useCallback(() => {
    const g = gameRef.current
    const centerY = Math.floor(ROWS / 2)
    const snake: Point[] = [
      { x: 6, y: centerY },
      { x: 5, y: centerY },
      { x: 4, y: centerY },
    ]
    g.snake = snake
    g.direction = 'RIGHT'
    g.nextDirection = 'RIGHT'
    g.score = 0
    g.state = 'playing'
    g.speed = INITIAL_SPEED
    g.food = randomFood(snake)
    setScore(0)
    setGameState('playing')
    startTimer()
    draw()
  }, [randomFood, startTimer, draw])

  const togglePause = useCallback(() => {
    const g = gameRef.current
    if (g.state === 'playing') {
      g.state = 'paused'
      setGameState('paused')
      stopTimer()
      draw()
    } else if (g.state === 'paused') {
      g.state = 'playing'
      setGameState('playing')
      startTimer()
    }
  }, [stopTimer, startTimer, draw])

  // ---- 键盘控制 ----
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const g = gameRef.current

      // 空格：开始 / 暂停
      if (e.code === 'Space') {
        e.preventDefault()
        if (g.state === 'idle' || g.state === 'over') { startGame(); return }
        if (g.state === 'playing' || g.state === 'paused') { togglePause(); return }
      }

      // 方向键
      const keyMap: Record<string, Direction> = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
        KeyW: 'UP', KeyS: 'DOWN', KeyA: 'LEFT', KeyD: 'RIGHT',
      }
      const dir = keyMap[e.code]
      if (dir && g.state === 'playing') {
        e.preventDefault()
        if (dir !== OPPOSITE[g.direction]) {
          g.nextDirection = dir
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [startGame, togglePause])

  // ---- 组件卸载时清理定时器 ----
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  // ---- 初始渲染 ----
  useEffect(() => { draw() }, [draw])

  return (
    <Card
      title="🐍 贪吃蛇"
      extra={
        <Space>
          <span style={{ color: '#999', fontSize: 13 }}>
            ⬆⬇⬅➡ 或 WASD 控制方向 | 空格 暂停
          </span>
        </Space>
      }
      style={{ maxWidth: 500, margin: '0 auto' }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, gap: 48 }}>
        <Statistic title="得分" value={score} valueStyle={{ color: '#2ed573', fontSize: 24 }} />
        <Statistic title="最高分" value={highScore} valueStyle={{ color: '#ffa502', fontSize: 24 }} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          style={{
            border: '2px solid #333',
            borderRadius: 8,
            display: 'block',
            margin: '0 auto',
            background: '#1a1a2e',
          }}
        />
      </div>

      <div style={{ textAlign: 'center' }}>
        <Space size={12}>
          {(gameState === 'idle' || gameState === 'over') && (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={startGame} size="large">
              {gameState === 'over' ? '重新开始' : '开始游戏'}
            </Button>
          )}
          {gameState === 'playing' && (
            <Button icon={<PauseCircleOutlined />} onClick={togglePause} size="large">
              暂停
            </Button>
          )}
          {gameState === 'paused' && (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={togglePause} size="large">
              继续
            </Button>
          )}
          {gameState !== 'idle' && (
            <Button icon={<ReloadOutlined />} onClick={startGame} size="large">
              重新开始
            </Button>
          )}
        </Space>
      </div>
    </Card>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { Card, Row, Col, Statistic, Segmented, Spin, Empty } from 'antd'
import {
  WalletOutlined,
  ShoppingOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { PieChart, BarChart, LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { CategoryStat, MonthlyStat } from '../types'

// 按需引入 ECharts 组件
echarts.use([
  PieChart,
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  CanvasRenderer,
])

interface StatisticsProps {
  refreshKey: number
}

export default function Statistics({ refreshKey }: StatisticsProps) {
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'category' | 'monthly'>('category')
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [avgPerDay, setAvgPerDay] = useState(0)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      // 按分类统计
      const catStats = await window.electronAPI.dbQuery(`
        SELECT mc.id as main_category_id, mc.name as main_category_name,
               mc.icon as main_category_icon,
               SUM(b.amount) as total, COUNT(*) as count
        FROM bills b
        JOIN sub_categories sc ON b.category_id = sc.id
        JOIN main_categories mc ON sc.main_category_id = mc.id
        GROUP BY mc.id
        ORDER BY total DESC
      `) as CategoryStat[]
      setCategoryStats(catStats)

      // 按月统计
      const monStats = await window.electronAPI.dbQuery(`
        SELECT strftime('%Y-%m', bill_date) as month,
               SUM(amount) as total, COUNT(*) as count
        FROM bills
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `) as MonthlyStat[]
      // 反转使时间从左到右
      setMonthlyStats(monStats.reverse())

      // 汇总
      const summary = await window.electronAPI.dbQuery(`
        SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM bills
      `) as any[]
      const total = summary[0]?.total || 0
      const count = summary[0]?.count || 0
      setTotalAmount(total)
      setTotalCount(count)

      // 日均消费（按有记录的天数算）
      const days = await window.electronAPI.dbQuery(`
        SELECT COUNT(DISTINCT bill_date) as days FROM bills
      `) as any[]
      const dayCount = days[0]?.days || 1
      setAvgPerDay(total / Math.max(dayCount, 1))
    } catch (err) {
      console.error('加载统计失败:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats, refreshKey])

  // 饼图配置
  const pieOption = {
    tooltip: {
      trigger: 'item' as const,
      formatter: '{b}: ¥{c} ({d}%)',
    },
    legend: {
      orient: 'vertical' as const,
      right: 10,
      top: 'center',
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}\n¥{c}',
        },
        data: categoryStats.map(c => ({
          name: `${c.main_category_icon} ${c.main_category_name}`,
          value: Number(c.total),
        })),
      },
    ],
  }

  // 柱状图配置
  const barOption = {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      formatter: (params: any) => {
        const p = params[0]
        return `${p.name}<br/>支出: ¥${Number(p.value).toFixed(2)}<br/>笔数: ${categoryStats[p.dataIndex]?.count || 0}`
      },
    },
    grid: { left: 20, right: 20, bottom: 20, top: 10, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: categoryStats.map(c => `${c.main_category_icon} ${c.main_category_name}`),
      axisLabel: { rotate: 45, fontSize: 11 },
    },
    yAxis: {
      type: 'value' as const,
      name: '元',
    },
    series: [
      {
        type: 'bar',
        data: categoryStats.map(c => Number(c.total)),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#1890ff' },
            { offset: 1, color: '#69c0ff' },
          ]),
        },
      },
    ],
  }

  // 趋势折线图
  const lineOption = {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any) => {
        const p = params[0]
        const idx = p.dataIndex
        const mon = monthlyStats[idx]
        return `${p.name}<br/>支出: ¥${Number(p.value).toFixed(2)}<br/>笔数: ${mon?.count || 0}`
      },
    },
    grid: { left: 20, right: 20, bottom: 20, top: 10, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: monthlyStats.map(m => m.month),
    },
    yAxis: {
      type: 'value' as const,
      name: '元',
    },
    series: [
      {
        type: 'line',
        data: monthlyStats.map(m => Number(m.total)),
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 3, color: '#1890ff' },
        itemStyle: { color: '#1890ff' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(24,144,255,0.3)' },
            { offset: 1, color: 'rgba(24,144,255,0.02)' },
          ]),
        },
      },
    ],
  }

  if (!loading && totalCount === 0) {
    return (
      <Card title="📊 统计分析">
        <Empty description="暂无账单数据，先记一笔吧！" />
      </Card>
    )
  }

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        {/* 汇总卡片 */}
        <Col span={8}>
          <Card>
            <Statistic
              title="总支出"
              value={totalAmount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#ff4d4f' }}
              suffix={<WalletOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="总笔数"
              value={totalCount}
              suffix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="日均消费"
              value={avgPerDay}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#faad14' }}
              suffix={<RiseOutlined />}
            />
          </Card>
        </Col>

        {/* 图表区域 */}
        <Col span={24}>
          <Card
            title="📊 支出分析"
            extra={
              <Segmented
                value={mode}
                onChange={(val) => setMode(val as 'category' | 'monthly')}
                options={[
                  { label: '🏷️ 分类统计', value: 'category' },
                  { label: '📅 月度趋势', value: 'monthly' },
                ]}
              />
            }
          >
            <Row gutter={16}>
              {mode === 'category' && (
                <>
                  <Col span={12}>
                    <ReactEChartsCore
                      echarts={echarts}
                      option={pieOption}
                      style={{ height: 350 }}
                      notMerge
                    />
                  </Col>
                  <Col span={12}>
                    <ReactEChartsCore
                      echarts={echarts}
                      option={barOption}
                      style={{ height: 350 }}
                      notMerge
                    />
                  </Col>
                </>
              )}
              {mode === 'monthly' && (
                <Col span={24}>
                  <ReactEChartsCore
                    echarts={echarts}
                    option={lineOption}
                    style={{ height: 350 }}
                    notMerge
                  />
                </Col>
              )}
            </Row>
          </Card>
        </Col>
      </Row>
    </Spin>
  )
}

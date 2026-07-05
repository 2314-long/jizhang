import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  Table,
  DatePicker,
  Select,
  Space,
  Button,
  Popconfirm,
  Tag,
  message,
  Typography,
} from 'antd'
import { DeleteOutlined, ExportOutlined, ImportOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type { Bill, MainCategory } from '../types'

const { RangePicker } = DatePicker
const { Text } = Typography

interface BillListProps {
  refreshKey: number
}

export default function BillList({ refreshKey }: BillListProps) {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(false)
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [filterCategory, setFilterCategory] = useState<number | undefined>(undefined)
  const [filterDate, setFilterDate] = useState<[Dayjs, Dayjs] | null>(null)
  const [totalAmount, setTotalAmount] = useState(0)

  const loadBills = useCallback(async () => {
    setLoading(true)
    try {
      let sql = `
        SELECT b.*, sc.name as sub_category_name,
               mc.name as main_category_name, mc.icon as main_category_icon
        FROM bills b
        JOIN sub_categories sc ON b.category_id = sc.id
        JOIN main_categories mc ON sc.main_category_id = mc.id
        WHERE 1=1
      `
      const params: any[] = []

      if (filterCategory) {
        sql += ' AND mc.id = ?'
        params.push(filterCategory)
      }

      if (filterDate && filterDate[0] && filterDate[1]) {
        sql += ' AND b.bill_date >= ? AND b.bill_date <= ?'
        params.push(
          filterDate[0].format('YYYY-MM-DD'),
          filterDate[1].format('YYYY-MM-DD')
        )
      }

      sql += ' ORDER BY b.bill_date DESC, b.created_at DESC LIMIT 500'

      const data = await window.electronAPI.dbQuery(sql, params) as Bill[]
      setBills(data)

      // 计算合计
      const total = data.reduce((sum, b) => sum + b.amount, 0)
      setTotalAmount(total)
    } catch (err) {
      console.error('加载账单失败:', err)
    } finally {
      setLoading(false)
    }
  }, [filterCategory, filterDate])

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    loadBills()
  }, [loadBills, refreshKey])

  async function loadCategories() {
    try {
      const cats = await window.electronAPI.dbQuery(
        'SELECT * FROM main_categories ORDER BY sort_order'
      ) as MainCategory[]
      setMainCategories(cats)
    } catch (err) {
      console.error('加载分类失败:', err)
    }
  }

  async function handleDelete(id: number) {
    try {
      await window.electronAPI.dbRun('DELETE FROM bills WHERE id = ?', [id])
      message.success('已删除')
      loadBills()
    } catch (err: any) {
      message.error('删除失败: ' + (err.message || '未知错误'))
    }
  }

  async function handleExport() {
    try {
      const allBills = await window.electronAPI.dbQuery(`
        SELECT b.amount, mc.name || ' - ' || sc.name as category,
               b.bill_date, b.remark
        FROM bills b
        JOIN sub_categories sc ON b.category_id = sc.id
        JOIN main_categories mc ON sc.main_category_id = mc.id
        ORDER BY b.bill_date DESC
      `) as any[]

      if (allBills.length === 0) {
        message.warning('暂无数据可导出')
        return
      }

      // 生成 CSV
      const headers = ['金额', '分类', '日期', '备注']
      const rows = allBills.map((b: any) =>
        [b.amount.toFixed(2), b.category, b.bill_date, b.remark || ''].join(',')
      )
      const csvContent = headers.join(',') + '\n' + rows.join('\n')

      const result = await window.electronAPI.exportCsv(csvContent)
      if (result.success) {
        message.success('导出成功！')
      } else if (result.error !== '用户取消') {
        message.error('导出失败: ' + result.error)
      }
    } catch (err: any) {
      message.error('导出失败: ' + (err.message || '未知错误'))
    }
  }

  async function handleImport() {
    try {
      // 1. 打开文件选择对话框，读取 CSV 内容
      const result = await window.electronAPI.importCsv()
      if (!result.success) {
        if (result.error !== '用户取消') {
          message.error('导入失败: ' + result.error)
        }
        return
      }

      const csvData = result.data!
      // 去掉 UTF-8 BOM 标记
      const cleanData = csvData.replace(/^﻿/, '')

      // 2. 解析 CSV（支持引号包裹的字段）
      const lines = cleanData.split('\n').filter(line => line.trim())
      if (lines.length < 2) {
        message.warning('CSV 文件为空或只有表头，没有数据可导入')
        return
      }

      // 检查表头
      const header = parseCsvLine(lines[0])
      const amountIdx = header.findIndex(h => h === '金额')
      const categoryIdx = header.findIndex(h => h === '分类')
      const dateIdx = header.findIndex(h => h === '日期')
      const remarkIdx = header.findIndex(h => h === '备注')

      if (amountIdx === -1 || categoryIdx === -1 || dateIdx === -1) {
        message.error('CSV 格式不正确，必须包含"金额"、"分类"、"日期"列')
        return
      }

      // 3. 预加载所有分类映射（"大类名 - 小类名" → sub_category_id）
      const categoryMap = new Map<string, number>()
      const allSubCats = await window.electronAPI.dbQuery(`
        SELECT sc.id, mc.name || ' - ' || sc.name as full_name
        FROM sub_categories sc
        JOIN main_categories mc ON sc.main_category_id = mc.id
      `) as any[]
      for (const cat of allSubCats) {
        categoryMap.set(cat.full_name, cat.id)
      }

      // 4. 逐行解析并导入
      let successCount = 0
      let skipCount = 0
      const errors: string[] = []

      for (let i = 1; i < lines.length; i++) {
        const fields = parseCsvLine(lines[i])
        if (fields.length < 3) {
          skipCount++
          continue
        }

        const amountStr = fields[amountIdx]?.trim()
        const categoryStr = fields[categoryIdx]?.trim()
        const dateStr = fields[dateIdx]?.trim()
        const remarkStr = remarkIdx >= 0 ? (fields[remarkIdx] || '').trim() : ''

        // 校验金额
        const amount = parseFloat(amountStr)
        if (isNaN(amount) || amount <= 0) {
          skipCount++
          errors.push(`第${i + 1}行: 金额"${amountStr}"无效`)
          continue
        }

        // 校验日期
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          skipCount++
          errors.push(`第${i + 1}行: 日期"${dateStr}"格式不正确`)
          continue
        }

        // 查找分类
        const categoryId = categoryMap.get(categoryStr)
        if (!categoryId) {
          skipCount++
          errors.push(`第${i + 1}行: 分类"${categoryStr}"未找到`)
          continue
        }

        // 插入数据库
        try {
          await window.electronAPI.dbRun(
            'INSERT INTO bills (amount, category_id, bill_date, remark) VALUES (?, ?, ?, ?)',
            [amount, categoryId, dateStr, remarkStr]
          )
          successCount++
        } catch (err: any) {
          skipCount++
          errors.push(`第${i + 1}行: 写入失败 - ${err.message}`)
        }
      }

      // 5. 显示结果
      if (successCount > 0) {
        message.success(
          `导入完成！成功 ${successCount} 条` +
          (skipCount > 0 ? `，跳过 ${skipCount} 条` : '')
        )
        loadBills()
      } else {
        message.warning('没有数据被导入，请检查 CSV 文件格式')
      }

      // 如果有错误，在控制台打印详情
      if (errors.length > 0 && errors.length <= 10) {
        for (const err of errors) {
          console.warn('CSV 导入:', err)
        }
      } else if (errors.length > 10) {
        console.warn(`CSV 导入: 共 ${errors.length} 条错误（前10条已显示）`)
        for (const err of errors.slice(0, 10)) {
          console.warn('CSV 导入:', err)
        }
      }
    } catch (err: any) {
      message.error('导入失败: ' + (err.message || '未知错误'))
    }
  }

  /**
   * 解析 CSV 的一行，支持双引号包裹的字段
   */
  function parseCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            // 转义的双引号
            current += '"'
            i++
          } else {
            inQuotes = false
          }
        } else {
          current += ch
        }
      } else {
        if (ch === '"') {
          inQuotes = true
        } else if (ch === ',') {
          result.push(current)
          current = ''
        } else {
          current += ch
        }
      }
    }
    result.push(current)
    return result
  }

  const columns = [
    {
      title: '日期',
      dataIndex: 'bill_date',
      width: 110,
      sorter: (a: Bill, b: Bill) => a.bill_date.localeCompare(b.bill_date),
    },
    {
      title: '分类',
      key: 'category',
      width: 180,
      render: (_: any, record: Bill) => (
        <Space>
          <span>{record.main_category_icon}</span>
          <Text>{record.main_category_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.sub_category_name}
          </Text>
        </Space>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      align: 'right' as const,
      sorter: (a: Bill, b: Bill) => a.amount - b.amount,
      render: (val: number) => (
        <Text strong style={{ color: '#ff4d4f', fontSize: 16 }}>
          -¥{val.toFixed(2)}
        </Text>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
      render: (val: string) => val || '-',
    },
    {
      title: '操作',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: Bill) => (
        <Popconfirm
          title="确定删除这条账单吗？"
          onConfirm={() => handleDelete(record.id)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ]

  return (
    <Card
      title="📋 账单列表"
      extra={
        <Space>
          <Button icon={<ImportOutlined />} onClick={handleImport}>
            导入 CSV
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出 CSV
          </Button>
        </Space>
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="按分类筛选"
          allowClear
          style={{ width: 160 }}
          value={filterCategory}
          onChange={setFilterCategory}
          options={mainCategories.map(c => ({
            value: c.id,
            label: `${c.icon} ${c.name}`,
          }))}
        />
        <RangePicker
          value={filterDate as any}
          onChange={(dates) => setFilterDate(dates as [Dayjs, Dayjs] | null)}
          placeholder={['开始日期', '结束日期']}
          format="YYYY-MM-DD"
        />
        <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
          共 {bills.length} 条 · 合计 ¥{totalAmount.toFixed(2)}
        </Tag>
      </Space>

      <Table
        rowKey="id"
        dataSource={bills}
        columns={columns}
        loading={loading}
        size="middle"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条账单`,
          pageSizeOptions: ['10', '20', '50'],
        }}
        locale={{ emptyText: '暂无账单记录，快去记一笔吧！' }}
      />
    </Card>
  )
}

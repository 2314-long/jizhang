import { useState, useEffect } from 'react'
import {
  Card,
  Form,
  InputNumber,
  Input,
  DatePicker,
  Cascader,
  Button,
  message,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { MainCategory, SubCategory, CascaderOption } from '../types'

interface AddBillProps {
  onSuccess: () => void
}

export default function AddBill({ onSuccess }: AddBillProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState<CascaderOption[]>([])

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    try {
      const mainCats = await window.electronAPI.dbQuery(
        'SELECT * FROM main_categories ORDER BY sort_order'
      ) as MainCategory[]

      const options: CascaderOption[] = []
      for (const main of mainCats) {
        const subCats = await window.electronAPI.dbQuery(
          'SELECT * FROM sub_categories WHERE main_category_id = ? ORDER BY sort_order',
          [main.id]
        ) as SubCategory[]

        options.push({
          value: 0, // 一级分类不可选
          label: `${main.icon} ${main.name}`,
          children: subCats.map(sub => ({
            value: sub.id,
            label: sub.name,
          })),
        })
      }
      setCategoryOptions(options)
    } catch (err) {
      console.error('加载分类失败:', err)
    }
  }

  async function handleSubmit(values: any) {
    setLoading(true)
    try {
      const { amount, categoryIds, bill_date, remark } = values
      await window.electronAPI.dbRun(
        'INSERT INTO bills (amount, category_id, bill_date, remark) VALUES (?, ?, ?, ?)',
        [amount, categoryIds[1], bill_date.format('YYYY-MM-DD'), remark || '']
      )
      message.success(`记账成功！¥${amount.toFixed(2)}`)
      form.resetFields()
      onSuccess()
    } catch (err: any) {
      message.error('记账失败: ' + (err.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="📝 记账" style={{ maxWidth: 600, margin: '0 auto' }}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          bill_date: dayjs(),
        }}
      >
        <Form.Item
          name="amount"
          label="金额（元）"
          rules={[
            { required: true, message: '请输入金额' },
            { type: 'number', min: 0.01, message: '金额必须大于0' },
          ]}
        >
          <InputNumber
            prefix="¥"
            placeholder="请输入花费金额"
            style={{ width: '100%' }}
            precision={2}
            min={0.01}
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="categoryIds"
          label="分类"
          rules={[{ required: true, message: '请选择分类' }]}
        >
          <Cascader
            options={categoryOptions}
            placeholder="请选择支出分类（先选大类再选小类）"
            size="large"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          name="bill_date"
          label="日期"
          rules={[{ required: true, message: '请选择日期' }]}
        >
          <DatePicker
            style={{ width: '100%' }}
            size="large"
            format="YYYY-MM-DD"
          />
        </Form.Item>

        <Form.Item name="remark" label="备注（可选）">
          <Input.TextArea
            placeholder="可填写备注信息"
            rows={2}
            maxLength={200}
            showCount
          />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<PlusOutlined />}
            size="large"
            block
          >
            记录这笔花销
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

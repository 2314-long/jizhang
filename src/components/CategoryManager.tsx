import { useState, useEffect } from 'react'
import {
  Card, Button, Modal, Form, Input, Popconfirm, message, Tag, Space, List,
  Collapse
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined,
  FileOutlined
} from '@ant-design/icons'

interface MainCat {
  id: number; name: string; icon: string; sort_order: number; is_preset: number;
}

interface SubCat {
  id: number; main_category_id: number; name: string; sort_order: number; is_preset: number;
}

const COMMON_EMOJIS = '🍽️ 🚗 🏠 💻 👗 🏥 🎓 🎮 👫 💼 🛒 🧾 💰 💳 📱 🎵 🐱 🌱 ✈️ 💄 ⚽ 🎂 🎁 📚 💊 🔧 🏃 ☕ 🍺'.split(' ')

export default function CategoryManager() {
  const [mainCats, setMainCats] = useState<MainCat[]>([])
  const [subCats, setSubCats] = useState<SubCat[]>([])
  const [loading, setLoading] = useState(false)

  // 弹窗状态
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalType, setModalType] = useState<'addMain' | 'editMain' | 'addSub' | 'editSub'>('addMain')
  const [editingCat, setEditingCat] = useState<MainCat | SubCat | null>(null)
  const [parentMainId, setParentMainId] = useState<number | null>(null)
  const [selectedEmoji, setSelectedEmoji] = useState('📌')
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const mains = await window.electronAPI.dbQuery(
        'SELECT * FROM main_categories ORDER BY sort_order'
      ) as MainCat[]
      const subs = await window.electronAPI.dbQuery(
        'SELECT * FROM sub_categories ORDER BY main_category_id, sort_order'
      ) as SubCat[]
      setMainCats(mains)
      setSubCats(subs)
    } catch (err: any) {
      message.error('加载分类失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ===== 一级分类操作 =====

  function openAddMainModal() {
    setModalType('addMain')
    setModalTitle('新增一级分类')
    setEditingCat(null)
    setSelectedEmoji('📌')
    form.resetFields()
    setModalOpen(true)
  }

  function openEditMainModal(main: MainCat) {
    setModalType('editMain')
    setModalTitle('修改一级分类')
    setEditingCat(main)
    setSelectedEmoji(main.icon)
    form.setFieldsValue({ name: main.name })
    setModalOpen(true)
  }

  async function handleDeleteMain(id: number) {
    try {
      // 检查其下二级分类是否有关联账单
      const subIds = subCats.filter(s => s.main_category_id === id).map(s => s.id)
      if (subIds.length > 0) {
        const placeholders = subIds.map(() => '?').join(',')
        const result = await window.electronAPI.dbQuery(
          `SELECT COUNT(*) as cnt FROM bills WHERE category_id IN (${placeholders})`,
          subIds
        ) as any[]
        if (result[0]?.cnt > 0) {
          message.error(`该分类下有 ${result[0].cnt} 条账单，无法删除。请先处理相关账单后再试。`)
          return
        }
      }
      await window.electronAPI.dbRun('DELETE FROM sub_categories WHERE main_category_id = ?', [id])
      await window.electronAPI.dbRun('DELETE FROM main_categories WHERE id = ?', [id])
      message.success('一级分类已删除')
      loadData()
    } catch (err: any) {
      message.error('删除失败: ' + (err.message || '未知错误'))
    }
  }

  // ===== 二级分类操作 =====

  function openAddSubModal(mainId: number) {
    setModalType('addSub')
    setModalTitle('新增二级分类')
    setEditingCat(null)
    setParentMainId(mainId)
    form.resetFields()
    setModalOpen(true)
  }

  function openEditSubModal(sub: SubCat) {
    setModalType('editSub')
    setModalTitle('修改二级分类')
    setEditingCat(sub)
    setParentMainId(sub.main_category_id)
    form.setFieldsValue({ name: sub.name })
    setModalOpen(true)
  }

  async function handleDeleteSub(id: number) {
    try {
      const result = await window.electronAPI.dbQuery(
        'SELECT COUNT(*) as cnt FROM bills WHERE category_id = ?', [id]
      ) as any[]
      if (result[0]?.cnt > 0) {
        message.error(`该分类下有 ${result[0].cnt} 条账单，无法删除。请先处理相关账单后再试。`)
        return
      }
      await window.electronAPI.dbRun('DELETE FROM sub_categories WHERE id = ?', [id])
      message.success('二级分类已删除')
      loadData()
    } catch (err: any) {
      message.error('删除失败: ' + (err.message || '未知错误'))
    }
  }

  // ===== 弹窗确认 =====

  async function handleModalOk() {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      if (modalType === 'addMain') {
        const maxSort = mainCats.reduce((max, c) => Math.max(max, c.sort_order), 0)
        await window.electronAPI.dbRun(
          'INSERT INTO main_categories (name, icon, sort_order, is_preset) VALUES (?, ?, ?, 0)',
          [values.name, selectedEmoji, maxSort + 1]
        )
        message.success('一级分类添加成功')
      } else if (modalType === 'editMain') {
        const main = editingCat as MainCat
        await window.electronAPI.dbRun(
          'UPDATE main_categories SET name = ?, icon = ? WHERE id = ?',
          [values.name, selectedEmoji, main.id]
        )
        message.success('一级分类修改成功')
      } else if (modalType === 'addSub') {
        const subsOfParent = subCats.filter(s => s.main_category_id === parentMainId)
        const maxSort = subsOfParent.reduce((max, s) => Math.max(max, s.sort_order), 0)
        await window.electronAPI.dbRun(
          'INSERT INTO sub_categories (main_category_id, name, sort_order, is_preset) VALUES (?, ?, ?, 0)',
          [parentMainId, values.name, maxSort + 1]
        )
        message.success('二级分类添加成功')
      } else if (modalType === 'editSub') {
        const sub = editingCat as SubCat
        await window.electronAPI.dbRun(
          'UPDATE sub_categories SET name = ? WHERE id = ?',
          [values.name, sub.id]
        )
        message.success('二级分类修改成功')
      }

      setModalOpen(false)
      form.resetFields()
      loadData()
    } catch (err: any) {
      if (err.message) {
        message.error('操作失败: ' + err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function getParentName(mainId: number): string {
    const main = mainCats.find(m => m.id === mainId)
    return main ? `${main.icon} ${main.name}` : ''
  }

  // ===== 渲染 =====

  return (
    <div>
      <Card
        title="📂 分类管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddMainModal}>
            新增一级分类
          </Button>
        }
        loading={loading}
      >
        <Collapse
          accordion
          items={mainCats.map(main => ({
            key: main.id,
            label: (
              <Space>
                <span style={{ fontSize: 18 }}>{main.icon}</span>
                <span style={{ fontWeight: 500 }}>{main.name}</span>
                {main.is_preset === 1 ? (
                  <Tag color="blue" icon={<LockOutlined />}>系统预设</Tag>
                ) : (
                  <Tag color="green">自定义</Tag>
                )}
              </Space>
            ),
            extra: (
              /* 阻止点击按钮时折叠面板展开/收起 */
              <span onClick={e => e.stopPropagation()}>
                <Space size={0}>
                  {main.is_preset !== 1 && (
                    <>
                      <Button type="link" size="small" icon={<EditOutlined />}
                        onClick={() => openEditMainModal(main)}>
                        编辑
                      </Button>
                      <Popconfirm
                        title="删除此一级分类将同时删除其下所有二级分类，确定删除？"
                        onConfirm={() => handleDeleteMain(main.id)}
                        okText="确定删除"
                        cancelText="取消"
                      >
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    </>
                  )}
                  <Button type="link" size="small" icon={<PlusOutlined />}
                    onClick={() => openAddSubModal(main.id)}>
                    新增二级
                  </Button>
                </Space>
              </span>
            ),
            children: (
              <List
                size="small"
                dataSource={subCats.filter(s => s.main_category_id === main.id)}
                locale={{ emptyText: '暂无二级分类，点击上方"新增二级"按钮添加' }}
                renderItem={sub => (
                  <List.Item
                    actions={
                      sub.is_preset !== 1
                        ? [
                            <Button type="link" size="small" icon={<EditOutlined />}
                              onClick={() => openEditSubModal(sub)} key="edit">
                              编辑
                            </Button>,
                            <Popconfirm
                              title="确定删除此二级分类？"
                              onConfirm={() => handleDeleteSub(sub.id)}
                              okText="确定删除"
                              cancelText="取消"
                              key="delete"
                            >
                              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                                删除
                              </Button>
                            </Popconfirm>,
                          ]
                        : []
                    }
                  >
                    <Space>
                      <FileOutlined style={{ color: '#999' }} />
                      <span>{sub.name}</span>
                      {sub.is_preset === 1 ? (
                        <Tag color="blue" style={{ fontSize: 12 }}>系统预设</Tag>
                      ) : (
                        <Tag color="green" style={{ fontSize: 12 }}>自定义</Tag>
                      )}
                    </Space>
                  </List.Item>
                )}
              />
            ),
          }))}
        />
      </Card>

      {/* 新增 / 编辑弹窗 */}
      <Modal
        title={modalTitle}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        confirmLoading={submitting}
        destroyOnHidden
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {/* 一级分类才显示图标选择 */}
          {(modalType === 'addMain' || modalType === 'editMain') && (
            <Form.Item label="图标" required>
              <div style={{ marginBottom: 8 }}>
                <Space wrap size={4}>
                  {COMMON_EMOJIS.map(emoji => (
                    <span
                      key={emoji}
                      onClick={() => setSelectedEmoji(emoji)}
                      style={{
                        fontSize: 22,
                        cursor: 'pointer',
                        padding: '2px 4px',
                        borderRadius: 4,
                        border: selectedEmoji === emoji ? '2px solid #1890ff' : '2px solid transparent',
                        background: selectedEmoji === emoji ? '#e6f7ff' : 'transparent',
                        transition: 'all 0.2s',
                      }}
                    >
                      {emoji}
                    </span>
                  ))}
                </Space>
              </div>
              <Input
                value={selectedEmoji}
                onChange={e => setSelectedEmoji(e.target.value)}
                placeholder="或直接输入 emoji"
                maxLength={4}
                style={{ width: 160 }}
              />
            </Form.Item>
          )}

          {/* 二级分类显示所属大类 */}
          {(modalType === 'addSub' || modalType === 'editSub') && (
            <Form.Item label="所属一级分类">
              <Input value={getParentName(parentMainId!)} disabled />
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label="分类名称"
            rules={[
              { required: true, message: '请输入分类名称' },
              { max: 20, message: '名称不能超过20个字符' },
            ]}
          >
            <Input placeholder="请输入分类名称" maxLength={20} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

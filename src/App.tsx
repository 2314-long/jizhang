import { useState } from 'react'
import { Layout, Menu, Typography } from 'antd'
import {
  EditOutlined,
  UnorderedListOutlined,
  PieChartOutlined,
  AppstoreOutlined,
  BugOutlined,
} from '@ant-design/icons'
import AddBill from './components/AddBill'
import BillList from './components/BillList'
import Statistics from './components/Statistics'
import CategoryManager from './components/CategoryManager'
import SnakeGame from './components/SnakeGame'

const { Header, Content, Sider } = Layout
const { Title } = Typography

type PageKey = 'add' | 'list' | 'stats' | 'categories' | 'game'

interface MenuItem {
  key: PageKey
  icon: React.ReactNode
  label: string
}

const menuItems: MenuItem[] = [
  { key: 'add', icon: <EditOutlined />, label: '记账' },
  { key: 'list', icon: <UnorderedListOutlined />, label: '账单' },
  { key: 'stats', icon: <PieChartOutlined />, label: '统计' },
  { key: 'categories', icon: <AppstoreOutlined />, label: '分类管理' },
  { key: 'game', icon: <BugOutlined />, label: '贪吃蛇' },
]

function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>('add')
  // 用于触发列表和统计刷新的 key
  const [refreshKey, setRefreshKey] = useState(0)

  function handlePageChange(page: PageKey) {
    setCurrentPage(page)
    // 每次进入账单或统计页面时触发刷新
    if (page === 'list' || page === 'stats') {
      setRefreshKey(k => k + 1)
    }
  }

  function handleBillSuccess() {
    // 记账成功后，如果用户去其他页面看数据，会自动刷新
    // 这里预刷新一下，保证数据是最新的
  }

  function renderPage() {
    switch (currentPage) {
      case 'add':
        return <AddBill onSuccess={handleBillSuccess} />
      case 'list':
        return <BillList refreshKey={refreshKey} />
      case 'stats':
        return <Statistics refreshKey={refreshKey} />
      case 'categories':
        return <CategoryManager />
      case 'game':
        return <SnakeGame />
      default:
        return null
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={200}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
            🐴 记账
          </Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[currentPage]}
          onClick={({ key }) => handlePageChange(key as PageKey)}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Content style={{ padding: 24, overflow: 'auto' }}>
          {renderPage()}
        </Content>
      </Layout>
    </Layout>
  )
}

export default App

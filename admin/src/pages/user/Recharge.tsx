import { useState, useEffect, useCallback } from 'react'
import { Tabs, Card, Button, Input, App, Row, Col, Typography, Spin, Empty, Badge, Modal, Result } from 'antd'
import { ShoppingCartOutlined, GiftOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useAuthStore } from '../../stores/authStore'

interface QuotaPackage {
  id: number
  name: string
  quota_value: number
  price_cents: number
  currency: string
  status: number
  sort_order: number
}

interface ApiResponse<T> {
  code: number
  message: string
  data?: T
}

interface PagedData<T> {
  data: T[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

const RELAY_BASE = '/v1'

async function relayFetch<T>(path: string, apiKey: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${RELAY_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...options?.headers,
    },
  })
  if (res.status === 401) {
    try { localStorage.removeItem('juhe_token') } catch { /* ignore */ }
    useAuthStore.getState().logout()
    throw new Error('未登录')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || `HTTP ${res.status}`)
  }
  return res.json()
}

function formatQuota(v: number): string {
  if (v >= 10000) return (v / 10000).toFixed(1) + '万'
  return v.toLocaleString()
}

function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2)
}

export default function Recharge() {
  const { message } = App.useApp()
  const token = useAuthStore((s) => s.token)
  const apiKey = token || ''
  const [packages, setPackages] = useState<QuotaPackage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [buyingId, setBuyingId] = useState<number | null>(null)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)

  const loadPackages = useCallback(async () => {
    if (!token) {
      message.error('未登录，请先登录')
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const res = await relayFetch<PagedData<QuotaPackage>>('/quota-packages', token)
      if (res.code === 0 && res.data) {
        setPackages(res.data.data || [])
      } else {
        const errMsg = res.message || '获取额度包失败'
        setLoadError(errMsg)
        message.error(errMsg)
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '网络错误'
      setLoadError(errMsg)
      message.error(errMsg)
    } finally {
      setLoading(false)
    }
  }, [token, message])

  // Load quota packages on mount and when token changes
  useEffect(() => {
    loadPackages()
  }, [loadPackages])

  const handleBuy = async (pkg: QuotaPackage) => {
    setBuyingId(pkg.id)
    try {
      const res = await relayFetch<{
        id: number
        quota_granted: number
        payment_status: number
        checkout_url: string
      }>('/topups', apiKey, {
        method: 'POST',
        body: JSON.stringify({ package_id: pkg.id, payment_method: 'recharge_page' }),
      })
      if (res.code === 0 && res.data) {
        message.success(`购买成功！额度 +${formatQuota(res.data.quota_granted)}`)
      } else {
        message.error(res.message || '购买失败')
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '网络错误')
    } finally {
      setBuyingId(null)
    }
  }

  const handleRedeem = async () => {
    const code = redeemCode.trim()
    if (!code) {
      message.warning('请输入兑换码')
      return
    }
    setRedeeming(true)
    try {
      const res = await relayFetch<{ id: number; quota_value: number; status: number }>(
        '/redemptions/redeem',
        apiKey,
        {
          method: 'POST',
          body: JSON.stringify({ code }),
        },
      )
      if (res.code === 0 && res.data) {
        message.success(`兑换成功！获得 ${formatQuota(res.data.quota_value)} 额度`)
        setRedeemCode('')
      } else {
        message.error(res.message || '兑换失败')
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '网络错误')
    } finally {
      setRedeeming(false)
    }
  }

  const packagesTab = (
    <Spin spinning={loading}>
      {loadError && !loading ? (
        <Result
          status="error"
          title="加载失败"
          subTitle={loadError}
          extra={
            <Button type="primary" onClick={loadPackages}>
              重试
            </Button>
          }
          style={{ marginTop: 48 }}
        />
      ) : packages.length === 0 && !loading ? (
        <Empty description="暂无额度包" style={{ marginTop: 48 }} />
      ) : (
        <Row gutter={[16, 16]}>
          {packages.map((pkg) => (
            <Col key={pkg.id} xs={24} sm={12} md={8} lg={6}>
              <Badge.Ribbon
                text={pkg.status === 0 ? '已下架' : undefined}
                color="default"
                style={{ display: pkg.status === 0 ? undefined : 'none' }}
              >
                <Card
                  hoverable={pkg.status === 1}
                  style={{
                    borderRadius: 12,
                    textAlign: 'center',
                    opacity: pkg.status === 0 ? 0.5 : 1,
                  }}
                  styles={{
                    body: { padding: 24 },
                  }}
                >
                  <ThunderboltOutlined
                    style={{ fontSize: 36, color: '#1677ff', marginBottom: 12 }}
                  />
                  <Typography.Title level={5} style={{ marginBottom: 8 }}>
                    {pkg.name}
                  </Typography.Title>
                  <div style={{ marginBottom: 8 }}>
                    <Typography.Text type="secondary">额度</Typography.Text>
                  </div>
                  <Typography.Title
                    level={3}
                    style={{ margin: '0 0 4px', color: '#1677ff' }}
                  >
                    {formatQuota(pkg.quota_value)}
                  </Typography.Title>
                  <Typography.Title
                    level={4}
                    style={{
                      margin: '0 0 16px',
                      color: '#ff4d4f',
                    }}
                  >
                    ¥{formatPrice(pkg.price_cents)}
                  </Typography.Title>
                  <Button
                    type="primary"
                    icon={<ShoppingCartOutlined />}
                    block
                    disabled={pkg.status === 0}
                    loading={buyingId === pkg.id}
                    onClick={() => {
                      Modal.confirm({
                        title: '确认购买',
                        content: `确定要购买 ${pkg.name}（¥${formatPrice(pkg.price_cents)} 元）吗？`,
                        onOk: () => handleBuy(pkg),
                      })
                    }}
                  >
                    购买
                  </Button>
                </Card>
              </Badge.Ribbon>
            </Col>
          ))}
        </Row>
      )}
    </Spin>
  )

  const redeemTab = (
    <div style={{ maxWidth: 400, margin: '48px auto 0' }}>
      <Card style={{ borderRadius: 12, textAlign: 'center' }}>
        <GiftOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
        <Typography.Title level={4} style={{ marginBottom: 24 }}>
          兑换码
        </Typography.Title>
        <Input
          size="large"
          placeholder="请输入兑换码"
          value={redeemCode}
          onChange={(e) => setRedeemCode(e.target.value)}
          onPressEnter={handleRedeem}
          style={{ marginBottom: 16 }}
        />
        <Button
          type="primary"
          size="large"
          block
          loading={redeeming}
          icon={<GiftOutlined />}
          onClick={handleRedeem}
        >
          兑换
        </Button>
      </Card>
    </div>
  )

  const tabItems = [
    {
      key: 'packages',
      label: '购买额度包',
      children: packagesTab,
    },
    {
      key: 'redeem',
      label: '兑换码',
      children: redeemTab,
    },
  ]

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        额度充值
      </Typography.Title>
      <Tabs items={tabItems} />
    </div>
  )
}

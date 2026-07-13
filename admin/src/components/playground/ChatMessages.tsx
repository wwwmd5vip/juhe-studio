import { Typography, Spin } from 'antd'
import { RobotOutlined, UserOutlined, ExperimentOutlined } from '@ant-design/icons'
import type { RefObject } from 'react'

const { Text } = Typography

export interface Message {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ChatMessagesProps {
  messages: Message[]
  isDark: boolean
  loading: boolean
  compact?: boolean
  emptyText?: string
  emptyIcon?: 'robot' | 'experiment'
  scrollAnchorRef?: RefObject<HTMLDivElement | null>
}

export default function ChatMessages({
  messages,
  isDark,
  loading,
  compact = false,
  emptyText = '等待输入...',
  emptyIcon = 'robot',
  scrollAnchorRef,
}: ChatMessagesProps) {
  if (messages.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: isDark ? '#666' : '#999',
        }}
      >
        {emptyIcon === 'experiment' ? (
          <ExperimentOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
        ) : (
          <RobotOutlined style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }} />
        )}
        <Text type="secondary" style={{ fontSize: compact ? 12 : 16, color: isDark ? '#999' : undefined }}>
          {emptyText}
        </Text>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: compact ? '8px 12px' : '16px 24px',
      }}
    >
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: compact ? 10 : 16,
          }}
        >
          <div style={{ maxWidth: compact ? '95%' : '85%', display: 'flex', gap: 8 }}>
            {!compact && msg.role === 'assistant' && (
              <AvatarIcon icon={<RobotOutlined />} color="#52c41a" />
            )}
            <div>
              <div
                style={{
                  padding: compact ? '6px 10px' : '10px 14px',
                  borderRadius: compact ? 10 : 12,
                  background: msg.role === 'user' ? '#1677ff' : isDark ? '#2a2a2a' : '#f0f0f0',
                  color: msg.role === 'user' ? '#fff' : isDark ? '#e0e0e0' : 'inherit',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: compact ? 13 : 14,
                  lineHeight: compact ? 1.5 : 1.6,
                }}
              >
                {msg.role === 'assistant' && msg.content.startsWith('❌ 错误:') ? (
                  <span style={{ color: '#ff4d4f' }}>{msg.content}</span>
                ) : msg.role === 'assistant' && !compact ? (
                  <AssistantContent content={msg.content} isDark={isDark} />
                ) : (
                  msg.content
                )}
                {msg.role === 'assistant' && msg.content === '' && loading && (
                  <Spin size="small" />
                )}
              </div>
              {!compact && (
                <div
                  style={{
                    fontSize: 11,
                    color: isDark ? '#777' : '#999',
                    marginTop: 4,
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                  }}
                >
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
            {!compact && msg.role === 'user' && (
              <AvatarIcon icon={<UserOutlined />} color="#1677ff" />
            )}
          </div>
        </div>
      ))}
      <div ref={scrollAnchorRef} />
    </div>
  )
}

// ── Internal sub-components ──

function AvatarIcon({ icon, color }: { icon: React.ReactNode; color: string }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        flexShrink: 0,
        fontSize: 16,
      }}
    >
      {icon}
    </div>
  )
}

function AssistantContent({ content, isDark }: { content: string; isDark: boolean }) {
  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.split('\n')
          const language = lines[0]?.slice(3).trim() || ''
          const code = lines.slice(1, -1).join('\n')
          return (
            <div key={i} style={{ margin: '8px 0' }}>
              {language && (
                <div
                  style={{
                    fontSize: 11,
                    color: isDark ? '#999' : '#888',
                    background: isDark ? '#333' : '#f0f0f0',
                    padding: '2px 10px',
                    borderTopLeftRadius: 6,
                    borderTopRightRadius: 6,
                    display: 'inline-block',
                  }}
                >
                  {language}
                </div>
              )}
              <pre
                style={{
                  background: isDark ? '#2d2d2d' : '#f5f5f5',
                  color: isDark ? '#d4d4d4' : '#333',
                  padding: '10px 14px',
                  borderRadius: 6,
                  margin: 0,
                  overflow: 'auto',
                  fontSize: 13,
                  lineHeight: 1.5,
                  maxWidth: '100%',
                }}
              >
                <code>{code}</code>
              </pre>
            </div>
          )
        }
        if (part.trim() === '') return null
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

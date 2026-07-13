/**
 * canvas-reference.ts - 资源引用解析
 * 遍历节点连接构建可用资源列表，支持 @[node:ID] 语法
 */
import type { CanvasConnection, CanvasNode } from '../types'

export interface CanvasResourceReference {
  id: string
  type: string
  title: string
  label: string
  active: boolean
  content?: string
  text?: string
}

/** Token 正则: @[node:ID] */
const MENTION_REGEX = /@\[(node:[^\]]+)\]/g

/**
 * 从节点和连接构建所有可引用资源
 */
export function buildCanvasResourceReferences(
  nodes: CanvasNode[],
  _connections: CanvasConnection[],
  activeNodeId?: string
): CanvasResourceReference[] {
  const _nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return nodes.map((node) => {
    const isActive = node.id === activeNodeId
    let label = node.title || node.type
    switch (node.type) {
      case 'image':
        label = `${label} (图片)`
        break
      case 'text':
        label = `${label} (文本)`
        break
      case 'video':
        label = `${label} (视频)`
        break
      case 'audio':
        label = `${label} (音频)`
        break
      default:
        break
    }

    return {
      id: node.id,
      type: node.type,
      title: node.title,
      label,
      active: isActive,
      content: node.metadata?.content,
      text: node.metadata?.content || node.metadata?.prompt
    }
  })
}

/**
 * 从提示文本中提取所有 @[node:ID] token
 */
export function parseMentionTokens(text: string): string[] {
  const tokens: string[] = []
  let match: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: ignored using `--suppress`
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    tokens.push(match[1])
  }
  return tokens
}

/**
 * 将 @[node:ID] token 替换为可读标签
 */
export function replaceMentionTokens(text: string, references: CanvasResourceReference[]): string {
  const refMap = new Map(references.map((r) => [r.id, r]))
  return text.replace(MENTION_REGEX, (_match, token: string) => {
    const ref = refMap.get(token)
    return ref ? `[${ref.label}]` : `[${token}]`
  })
}

/**
 * 从提示文本提取引用图片 URL 列表
 */
export function extractReferencedImageUrls(text: string, references: CanvasResourceReference[]): string[] {
  const tokenIds = parseMentionTokens(text)
  const refMap = new Map(references.map((r) => [r.id, r]))
  return tokenIds
    .map((id) => refMap.get(id)?.content)
    .filter(
      (url): url is string =>
        (!!url && url.startsWith('data:')) ||
        (!!url && url.startsWith('http')) ||
        (!!url && url.startsWith('file://')) ||
        (!!url && url.startsWith('juhe-image://'))
    )
}

/**
 * 构建上游节点的资源引用列表（沿连接向上遍历）
 */
export function buildUpstreamReferences(
  nodeId: string,
  nodes: CanvasNode[],
  connections: CanvasConnection[]
): CanvasResourceReference[] {
  const _nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const upstreamIds = new Set<string>()

  // BFS along connections
  const queue = [nodeId]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) continue
    for (const conn of connections) {
      if (conn.toNodeId === current && !upstreamIds.has(conn.fromNodeId)) {
        upstreamIds.add(conn.fromNodeId)
        queue.push(conn.fromNodeId)
      }
    }
  }

  return nodes
    .filter((n) => upstreamIds.has(n.id))
    .map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      label: `${n.title || n.type}`,
      active: false,
      content: n.metadata?.content,
      text: n.metadata?.content || n.metadata?.prompt
    }))
}

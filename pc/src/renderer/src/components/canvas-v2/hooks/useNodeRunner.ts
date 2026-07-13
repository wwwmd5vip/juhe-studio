/**
 * useNodeRunner.ts - 画布节点执行引擎 v2
 *
 * 复刻 infinite-canvas-main 的 handleGenerateNode 流程：
 * 1. 生成前预创建输出节点（乐观 UI）
 * 2. count > 1 → 批量堆叠卡片模式（root + children）
 * 3. 空节点复用（空图片/视频节点直接作为输出复用）
 * 4. IPC 回调只更新预创建的节点状态
 */

import type { GenerationParams } from '@shared/types/generation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createNode } from '../constants'
import type { CanvasConnection, CanvasNode, CanvasNodeType } from '../types'

interface NodeExecutionState {
  nodeId: string
  taskId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

interface UseNodeRunnerOptions {
  nodes: CanvasNode[]
  connections: CanvasConnection[]
  onNodesChange: (nodes: CanvasNode[]) => void
  onConnectionsChange: (connections: CanvasConnection[]) => void
}

interface NodeRunInput {
  runNode: (nodeId: string, mode?: string) => Promise<void>
  runCascade: (nodeIds?: string[]) => Promise<void>
  cancelNode: (nodeId: string) => Promise<void>
  runningStates: Map<string, NodeExecutionState>
  isRunning: boolean
}

// ---- helpers ----

function makeNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function makeConnId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function setNodeMeta<T>(node: CanvasNode, patch: Record<string, T>): CanvasNode {
  return {
    ...node,
    metadata: { ...node.metadata, ...patch }
  } as CanvasNode
}

function _cloneNode(node: CanvasNode, overrides: Partial<CanvasNode> = {}): CanvasNode {
  return { ...node, id: makeNodeId(), ...overrides } as CanvasNode
}

/** 节点是否为空（无内容） */
function isNodeEmpty(node: CanvasNode): boolean {
  return !node.metadata?.content
}

/** 从连接的文本/图片节点解析上游资源 */
function resolveUpstreamResources(
  configNodeId: string,
  nodeList: readonly CanvasNode[],
  connectionList: readonly CanvasConnection[]
): { textContent: string; referenceImages: string[] } {
  const nodeMap = new Map(nodeList.map((n) => [n.id, n]))
  const textParts: string[] = []
  const images: string[] = []

  const visited = new Set<string>()
  const queue = [configNodeId]

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (currentId === undefined) continue
    if (visited.has(currentId)) continue
    visited.add(currentId)

    const upstream = connectionList.filter((c) => c.toNodeId === currentId)
    for (const conn of upstream) {
      const upstreamNode = nodeMap.get(conn.fromNodeId)
      if (!upstreamNode || visited.has(conn.fromNodeId)) continue
      queue.push(conn.fromNodeId)

      if (upstreamNode.type === 'text' && upstreamNode.metadata?.content) {
        textParts.push(String(upstreamNode.metadata.content))
      }
      if (upstreamNode.type === 'image' && upstreamNode.metadata?.content) {
        const content = String(upstreamNode.metadata.content)
        if (
          content.startsWith('data:') ||
          content.startsWith('http') ||
          content.startsWith('juhe-image://')
        ) {
          images.push(content)
        } else if (content.startsWith('file://')) {
          // Reject file:// URLs with path traversal attempts
          if (!content.includes('..')) {
            images.push(content)
          }
        }
      }
    }
  }

  return { textContent: textParts.join('\n'), referenceImages: images }
}

/**
 * 预创建目标节点（在生成开始前）
 * 返回 { targetNodeIds } 用于后续更新
 */
function prepareTargetNodes(
  sourceNode: CanvasNode,
  count: number,
  mode: string,
  currentNodes: readonly CanvasNode[],
  currentConnections: readonly CanvasConnection[],
  onNodesChange: (nodes: CanvasNode[]) => void,
  onConnectionsChange: (connections: CanvasConnection[]) => void
): { targetNodeIds: string[]; isBatch: boolean } {
  const targetNodeType: CanvasNodeType = mode === 'video' ? 'video' : mode === 'audio' ? 'audio' : 'image'

  // 空节点复用：直接复用 sourceNode 自身
  const reuseSource = isNodeEmpty(sourceNode)

  if (count <= 1) {
    // 单张输出
    if (reuseSource) {
      // 复用空节点，不需要创建新节点
      const updatedSource = setNodeMeta(sourceNode, {
        status: 'loading',
        isPersistent: true
      })
      const updated = currentNodes.map((n) => (n.id === sourceNode.id ? updatedSource : n)) as CanvasNode[]
      onNodesChange(updated)
      return { targetNodeIds: [sourceNode.id], isBatch: false }
    }

    // 创建新输出节点
    const offsetX = sourceNode.position.x + (sourceNode.width || 200) + 96
    const offsetY = sourceNode.position.y
    const outNode = createNode(targetNodeType, { x: offsetX, y: offsetY })
    outNode.metadata = {
      ...outNode.metadata,
      status: 'loading',
      sourceNodeId: sourceNode.id
    } as CanvasNode['metadata']
    const newConn = { id: makeConnId(), fromNodeId: sourceNode.id, toNodeId: outNode.id }

    const updatedSource = setNodeMeta(sourceNode, { status: 'success' })
    const updated = currentNodes
      .map((n) => (n.id === sourceNode.id ? updatedSource : n))
      .concat(outNode as CanvasNode) as CanvasNode[]
    onNodesChange(updated)
    onConnectionsChange([...currentConnections, newConn])

    return { targetNodeIds: [outNode.id], isBatch: false }
  }

  // 批量输出 (count > 1) — 创建 root + N children 堆叠卡片
  const baseX = sourceNode.position.x + (sourceNode.width || 200) + 96
  const baseY = sourceNode.position.y

  // Root (batch) node
  const batchRoot = createNode(targetNodeType, { x: baseX, y: baseY })
  batchRoot.metadata = {
    ...batchRoot.metadata,
    status: 'loading',
    isBatchRoot: true,
    batchChildIds: [],
    sourceNodeId: sourceNode.id
  } as CanvasNode['metadata']
  const rootConn = { id: makeConnId(), fromNodeId: sourceNode.id, toNodeId: batchRoot.id }

  const newNodes: CanvasNode[] = [batchRoot as CanvasNode]
  const newConns: CanvasConnection[] = [rootConn]
  const childIds: string[] = []

  for (let i = 0; i < count; i++) {
    const child = createNode(targetNodeType, {
      x: baseX + i * 8,
      y: baseY + i * 8
    })
    child.metadata = {
      ...child.metadata,
      status: 'loading',
      batchRootId: batchRoot.id,
      batchIndex: i,
      sourceNodeId: sourceNode.id
    } as CanvasNode['metadata']
    childIds.push(child.id)
    newNodes.push(child as CanvasNode)
  }

  batchRoot.metadata = {
    ...batchRoot.metadata,
    batchChildIds: childIds
  } as CanvasNode['metadata']

  const updatedSource = setNodeMeta(sourceNode, { status: 'success' })
  const updated = currentNodes.map((n) => (n.id === sourceNode.id ? updatedSource : n)).concat(newNodes) as CanvasNode[]
  onNodesChange(updated)
  onConnectionsChange([...currentConnections, ...newConns])

  return { targetNodeIds: childIds, isBatch: true }
}

// ---- Hook ----

export function useNodeRunner({
  nodes,
  connections,
  onNodesChange,
  onConnectionsChange
}: UseNodeRunnerOptions): NodeRunInput {
  const { t } = useTranslation()
  const [runningStates, setRunningStates] = useState<Map<string, NodeExecutionState>>(new Map())
  const nodesRef = useRef(nodes)
  const connsRef = useRef(connections)
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())
  const runningTargetsRef = useRef<Map<string, string[]>>(new Map())
  nodesRef.current = nodes
  connsRef.current = connections

  // 监听主进程推送的节点状态更新
  useEffect(() => {
    const unsubscribe = window.api?.workflow?.onNodeUpdate?.(
      (
        _event: unknown,
        data: {
          nodeId: string
          status: string
          progress?: number
          result?: unknown
          error?: string
        }
      ) => {
        if (!data?.nodeId) return

        const currentNodes = nodesRef.current

        setRunningStates((prev) => {
          const next = new Map(prev)

          if (data.status === 'success' || data.status === 'completed') {
            // 更新目标节点内容
            if (data.result) {
              const result = data.result as { type: string; content: string }
              const targetId = data.nodeId
              const updated = currentNodes.map((n) => {
                if (n.id !== targetId) return n
                const imgWidth = n.metadata?.naturalWidth || n.width || 512
                const imgHeight = n.metadata?.naturalHeight || n.height || 512
                return setNodeMeta(n, {
                  status: 'success',
                  content: result.content || '',
                  naturalWidth: imgWidth,
                  naturalHeight: imgHeight
                } as Record<string, unknown>)
              }) as CanvasNode[]
              onNodesChange(updated)
            }
            next.delete(data.nodeId)
          } else if (data.status === 'failed') {
            const targetId = data.nodeId
            const updated = currentNodes.map((n) =>
              n.id === targetId
                ? setNodeMeta(n, {
                    status: 'error',
                    errorDetails: data.error || t('canvas.nodeContent.generationFailed')
                  })
                : n
            ) as CanvasNode[]
            onNodesChange(updated)
            next.delete(data.nodeId)
          } else {
            next.set(data.nodeId, {
              nodeId: data.nodeId,
              taskId: '',
              status: data.status as NodeExecutionState['status']
            })
          }
          return next
        })
      }
    )

    return () => {
      unsubscribe?.()
    }
  }, [onNodesChange, t])

  const runNode = useCallback(
    async (nodeId: string, mode?: string) => {
      const currentNodes = nodesRef.current
      const sourceNode = currentNodes.find((n) => n.id === nodeId)
      if (!sourceNode) return

      const generationMode = (mode || sourceNode.metadata?.generationMode || 'image') as string
      const count = Math.max(1, Number(sourceNode.metadata?.count) || 1)

      // 1. 预创建目标节点（乐观 UI）
      const { targetNodeIds } = prepareTargetNodes(
        sourceNode,
        count,
        generationMode,
        currentNodes,
        connsRef.current,
        onNodesChange,
        onConnectionsChange
      )
      // Track target nodes for this source so cancelNode only cancels the right ones
      runningTargetsRef.current.set(nodeId, targetNodeIds)

      // 2. 解析上游资源
      const { textContent, referenceImages } = resolveUpstreamResources(nodeId, currentNodes, connsRef.current)
      const prompt = (sourceNode.metadata?.prompt as string) || (sourceNode.metadata?.composerContent as string) || ''
      const effectivePrompt = textContent ? `${prompt}\n\n上游输入:\n${textContent}` : prompt

      // 3. 为每个目标节点发起生成
      const submitNode = async (targetId: string, _index: number) => {
        const ac = new AbortController()
        abortControllersRef.current.set(targetId, ac)

        const genParams: GenerationParams = {
          prompt: effectivePrompt,
          model: (sourceNode.metadata?.model as string) || undefined,
          providerId: (sourceNode.metadata?.providerId as string) || undefined,
          size: (sourceNode.metadata?.size as GenerationParams['size']) || undefined,
          n: 1, // 每个子任务生成 1 张
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          generationMode: generationMode as GenerationParams['generationMode'],
          audioVoice: (sourceNode.metadata?.audioVoice as string) || undefined,
          audioFormat: (sourceNode.metadata?.audioFormat as string) || undefined,
          audioSpeed: (sourceNode.metadata?.audioSpeed as string) || undefined,
          audioInstructions: (sourceNode.metadata?.audioInstructions as string) || undefined
        }

        try {
          const result = await window.api?.workflow?.executeNode?.({
            nodeId: targetId,
            generationParams: genParams
          })
          if (result?.taskId) {
            setRunningStates((prev) => {
              const next = new Map(prev)
              next.set(targetId, { nodeId: targetId, taskId: result.taskId as string, status: 'running' })
              return next
            })
          }
        } catch (error) {
          console.error('[useNodeRunner] executeNode failed for', targetId, error)
          const errMsg = error instanceof Error ? error.message : String(error)
          const latest = nodesRef.current
          onNodesChange(
            latest.map((n) =>
              n.id === targetId ? setNodeMeta(n, { status: 'error', errorDetails: errMsg }) : n
            ) as CanvasNode[]
          )
        }
      }

      // 并行提交所有子任务
      await Promise.all(targetNodeIds.map((id, i) => submitNode(id, i)))
    },
    [onNodesChange, onConnectionsChange]
  )

  const runCascade = useCallback(
    async (nodeIds?: string[]) => {
      const targetIds = nodeIds || nodesRef.current.filter((n) => n.type === 'config').map((n) => n.id)
      for (const id of targetIds) {
        await runNode(id)
      }
    },
    [runNode]
  )

  const cancelNode = useCallback(async (nodeId: string) => {
    // 中止该节点的所有请求
    const ac = abortControllersRef.current.get(nodeId)
    if (ac) {
      ac.abort()
      abortControllersRef.current.delete(nodeId)
    }

    // 只中止该节点对应的目标节点，不影响其他并行任务
    const targetIds = runningTargetsRef.current.get(nodeId)
    if (targetIds) {
      for (const id of targetIds) {
        const controller = abortControllersRef.current.get(id)
        if (controller) {
          controller.abort()
          abortControllersRef.current.delete(id)
        }
      }
      runningTargetsRef.current.delete(nodeId)
    }

    try {
      await window.api?.workflow?.cancelNode?.({ nodeId })
    } catch (error) {
      console.error('[useNodeRunner] cancelNode failed:', error)
    }

    setRunningStates((prev) => {
      const next = new Map(prev)
      next.delete(nodeId)
      return next
    })
  }, [])

  return {
    runNode,
    runCascade,
    cancelNode,
    runningStates,
    isRunning: runningStates.size > 0
  }
}

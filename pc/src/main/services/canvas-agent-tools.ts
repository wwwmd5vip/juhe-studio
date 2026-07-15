/**
 * Canvas Agent MCP 工具定义 — 23 个画布操控工具。
 *
 * 每个工具定义包含 name、description、inputSchema（JSON Schema）。
 * 这些定义被注册到 MCP 系统中，供 Agent Squad 或其他 MCP 客户端调用。
 * 工具的实际执行通过 IPC 桥接到渲染进程的 canvas-mcp-bridge。
 */

import type { CanvasAgentOp, CanvasNodeType } from '@shared/types/canvas-agent'

export interface CanvasToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  /** 是否需要用户确认（破坏性操作） */
  requiresConfirmation: boolean
  /** 将 JSON args 转换为 CanvasAgentOp[] */
  toOps(args: Record<string, unknown>): CanvasAgentOp[]
}

// ── 辅助函数 ──

function stringParam(desc: string, required = true): Record<string, unknown> {
  return required
    ? { type: 'string', description: desc }
    : { type: 'string', description: desc }
}

function numberParam(desc: string, required = true): Record<string, unknown> {
  return required
    ? { type: 'number', description: desc }
    : { type: 'number', description: desc }
}

function boolParam(desc: string): Record<string, unknown> {
  return { type: 'boolean', description: desc }
}

// ── 23 个工具定义 ──

export const CANVAS_AGENT_TOOLS: CanvasToolDefinition[] = [
  // ── Read 操作 (3) ──
  {
    name: 'canvas_get_state',
    description: '获取当前画布的完整状态快照：所有节点、连接、视口和选中状态。',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    requiresConfirmation: false,
    toOps: () => [{ kind: 'apply_ops', ops: [] }]
  },
  {
    name: 'canvas_get_selection',
    description: '获取当前选中的节点 ID 列表。',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    requiresConfirmation: false,
    toOps: () => [{ kind: 'apply_ops', ops: [] }]
  },
  {
    name: 'canvas_export_snapshot',
    description: '导出画布完整状态的 JSON 快照，用于备份或跨会话恢复。',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    requiresConfirmation: false,
    toOps: () => [{ kind: 'apply_ops', ops: [] }]
  },

  // ── Create 操作 (4) ──
  {
    name: 'canvas_create_node',
    description: '在指定位置创建一个画布节点。',
    inputSchema: {
      type: 'object',
      properties: {
        nodeType: stringParam('节点类型：image, text, config, video, audio, output, llm, loop, comfy, modelscope'),
        title: stringParam('节点标题'),
        x: numberParam('X 坐标'),
        y: numberParam('Y 坐标'),
        content: stringParam('节点内容（可选）', false),
        width: numberParam('节点宽度（默认 280）', false),
        height: numberParam('节点高度（默认 200）', false)
      },
      required: ['nodeType', 'title', 'x', 'y']
    },
    requiresConfirmation: true,
    toOps: (args) => [{
      kind: 'create_node',
      nodeType: args.nodeType as CanvasNodeType,
      title: args.title as string,
      position: { x: args.x as number, y: args.y as number },
      content: args.content as string | undefined,
      width: (args.width as number) || 280,
      height: (args.height as number) || 200
    }]
  },
  {
    name: 'canvas_create_text_nodes',
    description: '批量创建多个文本节点，自动排列。',
    inputSchema: {
      type: 'object',
      properties: {
        texts: {
          type: 'array',
          items: { type: 'string' },
          description: '文本内容数组'
        },
        startX: numberParam('起始 X 坐标', false),
        startY: numberParam('起始 Y 坐标', false),
        gapY: numberParam('垂直间距（默认 120）', false)
      },
      required: ['texts']
    },
    requiresConfirmation: true,
    toOps: (args) => {
      const texts = args.texts as string[]
      const startX = (args.startX as number) || 200
      const startY = (args.startY as number) || 200
      const gap = (args.gapY as number) || 120
      return texts.map((text, i) => ({
        kind: 'create_node' as const,
        nodeType: 'text' as CanvasNodeType,
        title: `Text ${i + 1}`,
        content: text,
        position: { x: startX, y: startY + i * gap },
        width: 280,
        height: 120
      }))
    }
  },
  {
    name: 'canvas_create_config_node',
    description: '创建一个带提示词的配置节点，可连接到生成节点。',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: stringParam('生成提示词'),
        title: stringParam('节点标题', false),
        x: numberParam('X 坐标', false),
        y: numberParam('Y 坐标', false),
        modelId: stringParam('模型 ID（可选）', false),
        providerId: stringParam('Provider ID（可选）', false)
      },
      required: ['prompt']
    },
    requiresConfirmation: true,
    toOps: (args) => [{
      kind: 'create_node',
      nodeType: 'config',
      title: (args.title as string) || 'Config',
      prompt: args.prompt as string,
      position: { x: (args.x as number) || 300, y: (args.y as number) || 300 },
      width: 320,
      height: 200,
      modelId: args.modelId as string,
      providerId: args.providerId as string
    }]
  },
  {
    name: 'canvas_create_image_prompt_flow',
    description: '创建完整的文生图工作流：文本节点 → 配置节点 → 连接。',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: stringParam('生成提示词'),
        imageCount: numberParam('生成图片数量（默认 1）', false),
        modelId: stringParam('模型 ID（可选）', false)
      },
      required: ['prompt']
    },
    requiresConfirmation: true,
    toOps: (args) => {
      const prompt = args.prompt as string
      const count = (args.imageCount as number) || 1
      const ops: CanvasAgentOp[] = []
      const batchId = `batch-${Date.now()}`
      for (let i = 0; i < count; i++) {
        const baseX = 200 + i * 400
        ops.push({
          kind: 'create_node',
          nodeType: 'config',
          title: `Prompt ${i + 1}`,
          prompt: count > 1 ? `${prompt} (variant ${i + 1})` : prompt,
          position: { x: baseX, y: 300 },
          width: 320,
          height: 200,
          content: batchId
        })
      }
      return ops
    }
  },

  // ── Generate 操作 (4) ──
  {
    name: 'canvas_generate_image',
    description: '在指定配置节点上触发图像生成。',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: stringParam('配置节点 ID'),
        prompt: stringParam('提示词（覆盖节点已有提示词，可选）', false),
        modelId: stringParam('模型 ID（可选）', false)
      },
      required: ['nodeId']
    },
    requiresConfirmation: true,
    toOps: (args) => [{
      kind: 'generate_image',
      nodeId: args.nodeId as string,
      prompt: args.prompt as string | undefined,
      modelId: args.modelId as string | undefined
    }]
  },
  {
    name: 'canvas_generate_video',
    description: '在指定节点上触发视频生成。',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: stringParam('配置节点 ID'),
        prompt: stringParam('视频提示词（可选）', false),
        modelId: stringParam('视频模型 ID（可选）', false)
      },
      required: ['nodeId']
    },
    requiresConfirmation: true,
    toOps: (args) => [{
      kind: 'generate_image',
      nodeId: args.nodeId as string,
      prompt: args.prompt as string | undefined,
      modelId: args.modelId as string | undefined
    }]
  },
  {
    name: 'canvas_generate_audio',
    description: '在指定节点上触发音频/TTS 生成。',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: stringParam('配置节点 ID'),
        text: stringParam('TTS 文本'),
        modelId: stringParam('TTS 模型 ID（可选）', false)
      },
      required: ['nodeId', 'text']
    },
    requiresConfirmation: true,
    toOps: (args) => [{
      kind: 'generate_image',
      nodeId: args.nodeId as string,
      prompt: args.text as string | undefined,
      modelId: args.modelId as string | undefined
    }]
  },
  {
    name: 'canvas_create_generation_flow',
    description: '创建从文本到生成的完整工作流并一键触发生成。',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: stringParam('生成提示词'),
        imageCount: numberParam('生成数量（默认 4）', false),
        layout: stringParam('布局：grid 或 horizontal（默认 grid）', false)
      },
      required: ['prompt']
    },
    requiresConfirmation: true,
    toOps: (args) => {
      const prompt = args.prompt as string
      const count = (args.imageCount as number) || 4
      const layout = (args.layout as string) || 'grid'
      const ops: CanvasAgentOp[] = []
      const cols = layout === 'horizontal' ? count : Math.ceil(Math.sqrt(count))
      for (let i = 0; i < count; i++) {
        const row = layout === 'horizontal' ? 0 : Math.floor(i / cols)
        const col = layout === 'horizontal' ? i : i % cols
        ops.push({
          kind: 'create_node',
          nodeType: 'config',
          title: `Gen ${i + 1}`,
          prompt: `${prompt} [seed:${i + 1}]`,
          position: { x: 200 + col * 400, y: 300 + row * 350 },
          width: 320,
          height: 200
        }, {
          kind: 'generate_image',
          nodeId: '' // Will be filled by session
        })
      }
      return ops
    }
  },

  // ── Batch 操作 (1) ──
  {
    name: 'canvas_apply_ops',
    description: '批量应用多个画布操作，原子性执行。',
    inputSchema: {
      type: 'object',
      properties: {
        ops: {
          type: 'array',
          description: '操作列表（JSON 序列化的 CanvasAgentOp[]）'
        }
      },
      required: ['ops']
    },
    requiresConfirmation: true,
    toOps: (args) => {
      const parsed = typeof args.ops === 'string' ? JSON.parse(args.ops) : args.ops
      return Array.isArray(parsed) ? parsed : [{ kind: 'apply_ops', ops: parsed }]
    }
  },

  // ── Mutate 操作 (7) ──
  {
    name: 'canvas_update_node',
    description: '更新指定节点的内容、标题或提示词。',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: stringParam('节点 ID'),
        title: stringParam('新标题（可选）', false),
        content: stringParam('新内容（可选）', false),
        prompt: stringParam('新提示词（可选）', false)
      },
      required: ['nodeId']
    },
    requiresConfirmation: true,
    toOps: (args) => [{
      kind: 'update_node',
      nodeId: args.nodeId as string,
      title: args.title as string | undefined,
      content: args.content as string | undefined,
      prompt: args.prompt as string | undefined
    }]
  },
  {
    name: 'canvas_move_nodes',
    description: '批量移动节点到新位置。',
    inputSchema: {
      type: 'object',
      properties: {
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: '要移动的节点 ID 列表'
        },
        deltaX: numberParam('X 偏移量'),
        deltaY: numberParam('Y 偏移量')
      },
      required: ['nodeIds', 'deltaX', 'deltaY']
    },
    requiresConfirmation: true,
    toOps: (args) => [{
      kind: 'move_nodes',
      nodeIds: args.nodeIds as string[],
      position: { x: args.deltaX as number, y: args.deltaY as number }
    }]
  },
  {
    name: 'canvas_resize_node',
    description: '调整单个节点的尺寸。',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: stringParam('节点 ID'),
        width: numberParam('新宽度'),
        height: numberParam('新高度')
      },
      required: ['nodeId', 'width', 'height']
    },
    requiresConfirmation: true,
    toOps: (args) => [{
      kind: 'resize_node',
      nodeId: args.nodeId as string,
      width: args.width as number,
      height: args.height as number
    }]
  },
  {
    name: 'canvas_delete_nodes',
    description: '批量删除节点及关联连接。',
    inputSchema: {
      type: 'object',
      properties: {
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: '要删除的节点 ID 列表'
        }
      },
      required: ['nodeIds']
    },
    requiresConfirmation: true,
    toOps: (args) => [{
      kind: 'delete_nodes',
      nodeIds: args.nodeIds as string[]
    }]
  },
  {
    name: 'canvas_connect_nodes',
    description: '在两个节点之间创建连接。',
    inputSchema: {
      type: 'object',
      properties: {
        fromNodeId: stringParam('源节点 ID'),
        toNodeId: stringParam('目标节点 ID')
      },
      required: ['fromNodeId', 'toNodeId']
    },
    requiresConfirmation: true,
    toOps: (args) => [{
      kind: 'connect_nodes',
      fromNodeId: args.fromNodeId as string,
      toNodeId: args.toNodeId as string
    }]
  },
  {
    name: 'canvas_set_viewport',
    description: '设置画布视口位置和缩放级别。',
    inputSchema: {
      type: 'object',
      properties: {
        x: numberParam('视口 X 偏移'),
        y: numberParam('视口 Y 偏移'),
        k: numberParam('缩放级别（1.0 = 100%）', false)
      },
      required: ['x', 'y']
    },
    requiresConfirmation: false,
    toOps: (args) => [{
      kind: 'set_viewport',
      viewport: { x: args.x as number, y: args.y as number, k: (args.k as number) || 1 }
    }]
  },

  // ── Selection 操作 (4) ──
  {
    name: 'canvas_select_nodes',
    description: '选中指定的节点。',
    inputSchema: {
      type: 'object',
      properties: {
        nodeIds: {
          type: 'array',
          items: { type: 'string' },
          description: '要选中的节点 ID 列表'
        }
      },
      required: ['nodeIds']
    },
    requiresConfirmation: false,
    toOps: (args) => [{
      kind: 'select_nodes',
      nodeIds: args.nodeIds as string[]
    }]
  },
  {
    name: 'canvas_clear_selection',
    description: '清除当前选中状态。',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    requiresConfirmation: false,
    toOps: () => [{ kind: 'select_nodes', nodeIds: [] }]
  },
  {
    name: 'canvas_arrange_grid',
    description: '将选中节点自动排列为网格布局。',
    inputSchema: {
      type: 'object',
      properties: {
        cols: numberParam('列数（默认 4）', false),
        gapX: numberParam('水平间距（默认 64）', false),
        gapY: numberParam('垂直间距（默认 64）', false)
      },
      required: []
    },
    requiresConfirmation: true,
    toOps: (args) => [{
      kind: 'apply_ops',
      ops: []
    }]
  },
  {
    name: 'canvas_undo',
    description: '撤销最近一次操作。',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    requiresConfirmation: false,
    toOps: () => [{ kind: 'apply_ops', ops: [] }]
  }
]

/** 按名称查找工具定义 */
export function getCanvasTool(name: string): CanvasToolDefinition | undefined {
  return CANVAS_AGENT_TOOLS.find((t) => t.name === name)
}

/** 列出所有工具名称 */
export function listCanvasToolNames(): string[] {
  return CANVAS_AGENT_TOOLS.map((t) => t.name)
}

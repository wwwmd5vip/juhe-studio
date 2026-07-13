/**
 * canvas-tools.ts - 画布助手工具定义
 * 17 个 function 工具供 LLM 调用操作画布
 */
import type { CanvasAgentOp } from './canvas-agent-ops'

export interface CanvasToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  /** 是否需要确认 (写操作) */
  requiresConfirmation: boolean
  /** 将工具参数转为原子操作 */
  toOps: (params: Record<string, unknown>) => CanvasAgentOp[]
}

export const CANVAS_TOOLS: CanvasToolDefinition[] = [
  {
    name: 'canvas_get_state',
    description: '获取当前画布的状态：所有节点和连接的摘要信息',
    parameters: { type: 'object', properties: {}, required: [] },
    requiresConfirmation: false,
    toOps: () => []
  },
  {
    name: 'canvas_get_selection',
    description: '获取当前选中的节点 ID 列表',
    parameters: { type: 'object', properties: {}, required: [] },
    requiresConfirmation: false,
    toOps: () => []
  },
  {
    name: 'canvas_create_node',
    description: '在画布上创建一个新节点',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['image', 'text', 'config', 'video', 'audio', 'output', 'llm', 'loop'],
          description: '节点类型'
        },
        title: { type: 'string', description: '节点标题' },
        position: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } },
          description: '节点位置'
        },
        content: { type: 'string', description: '文本内容 (text/config/llm 节点)' }
      },
      required: ['type']
    },
    requiresConfirmation: true,
    toOps: (params) => {
      const type = (params.type as string) || 'image'
      const position = (params.position as { x: number; y: number }) || {
        x: 300 + Math.random() * 200,
        y: 200 + Math.random() * 100
      }
      return [
        {
          action: 'create_node',
          params: {
            type,
            title: params.title || type,
            position,
            metadata: params.content ? { content: params.content } : {}
          }
        }
      ]
    }
  },
  {
    name: 'canvas_create_text_node',
    description: '创建一个文本节点并填入指定内容',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '文本内容' },
        title: { type: 'string', description: '节点标题' },
        position: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } }
        }
      },
      required: ['content']
    },
    requiresConfirmation: true,
    toOps: (params) => {
      const position = (params.position as { x: number; y: number }) || {
        x: 300 + Math.random() * 200,
        y: 200 + Math.random() * 100
      }
      return [
        {
          action: 'create_node',
          params: {
            type: 'text',
            title: params.title || '文本',
            position,
            metadata: { content: params.content }
          }
        }
      ]
    }
  },
  {
    name: 'canvas_create_config_node',
    description: '创建一个生成器/配置节点，可用于生成图片、视频等',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '生成提示词' },
        size: { type: 'string', description: '图片尺寸，如 1024x1024, 1792x1024' },
        count: { type: 'number', description: '生成数量' },
        position: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } }
        }
      },
      required: ['prompt']
    },
    requiresConfirmation: true,
    toOps: (params) => {
      const position = (params.position as { x: number; y: number }) || { x: 300, y: 200 }
      return [
        {
          action: 'create_node',
          params: {
            type: 'config',
            title: '生成配置',
            position,
            metadata: {
              prompt: params.prompt,
              content: params.prompt,
              size: params.size || '1024x1024',
              count: params.count || 1,
              status: 'idle'
            }
          }
        }
      ]
    }
  },
  {
    name: 'canvas_create_image_prompt_flow',
    description: '创建文生图工作流：创建一个文本节点和一个配置节点，并将它们连接起来',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '图片描述提示词' },
        size: { type: 'string', description: '图片尺寸，默认 1024x1024' },
        count: { type: 'number', description: '生成数量，默认 1' }
      },
      required: ['prompt']
    },
    requiresConfirmation: true,
    toOps: (params) => {
      const baseX = 300
      const baseY = 200 + Math.random() * 300
      const textId = `node-flow-text-${Date.now()}`
      const configId = `node-flow-config-${Date.now()}`
      return [
        {
          action: 'create_node',
          params: {
            type: 'text',
            title: '提示词',
            position: { x: baseX, y: baseY },
            metadata: { content: params.prompt },
            _id: textId
          }
        },
        {
          action: 'create_node',
          params: {
            type: 'config',
            title: '图片生成',
            position: { x: baseX + 400, y: baseY },
            metadata: {
              prompt: params.prompt,
              content: params.prompt,
              size: params.size || '1024x1024',
              count: params.count || 1,
              status: 'idle'
            },
            _id: configId
          }
        },
        { action: 'connect_nodes', params: { fromNodeId: textId, toNodeId: configId } }
      ]
    }
  },
  {
    name: 'canvas_generate_image',
    description: '对指定的配置节点触发图片生成',
    parameters: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: '配置节点 ID' }
      },
      required: ['nodeId']
    },
    requiresConfirmation: true,
    toOps: (params) => [
      {
        action: 'update_node',
        params: { id: params.nodeId, patch: { metadata: { status: 'queued' } } }
      }
    ]
  },
  {
    name: 'canvas_update_node',
    description: '更新节点的内容、标题等属性',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '节点 ID' },
        title: { type: 'string', description: '新标题' },
        content: { type: 'string', description: '新内容' }
      },
      required: ['id']
    },
    requiresConfirmation: true,
    toOps: (params) => {
      const patch: Record<string, unknown> = {}
      if (params.title != null) patch.title = params.title
      if (params.content != null) patch.content = params.content
      return [{ action: 'update_node', params: { id: params.id, patch: { metadata: patch } } }]
    }
  },
  {
    name: 'canvas_move_nodes',
    description: '移动一个或多个节点到新位置',
    parameters: {
      type: 'object',
      properties: {
        moves: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } }
            },
            required: ['id', 'position']
          }
        }
      },
      required: ['moves']
    },
    requiresConfirmation: true,
    toOps: (params) => [{ action: 'move_nodes', params: { moves: params.moves } }]
  },
  {
    name: 'canvas_resize_node',
    description: '调整节点大小',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' }
      },
      required: ['id', 'width', 'height']
    },
    requiresConfirmation: true,
    toOps: (params) => [
      { action: 'resize_node', params: { id: params.id, width: params.width, height: params.height } }
    ]
  },
  {
    name: 'canvas_delete_nodes',
    description: '删除指定 ID 的节点',
    parameters: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' } } },
      required: ['ids']
    },
    requiresConfirmation: true,
    toOps: (params) => [{ action: 'delete_nodes', params: { ids: params.ids } }]
  },
  {
    name: 'canvas_connect_nodes',
    description: '创建一条从源节点到目标节点的连接线',
    parameters: {
      type: 'object',
      properties: {
        fromNodeId: { type: 'string', description: '源节点 ID' },
        toNodeId: { type: 'string', description: '目标节点 ID' }
      },
      required: ['fromNodeId', 'toNodeId']
    },
    requiresConfirmation: true,
    toOps: (params) => [
      { action: 'connect_nodes', params: { fromNodeId: params.fromNodeId, toNodeId: params.toNodeId } }
    ]
  },
  {
    name: 'canvas_select_nodes',
    description: '选中指定 ID 的节点',
    parameters: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' } } },
      required: ['ids']
    },
    requiresConfirmation: false,
    toOps: (params) => [{ action: 'select_nodes', params: { ids: params.ids } }]
  },
  {
    name: 'canvas_set_viewport',
    description: '设置画布视口位置和缩放',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: '视口 X 偏移' },
        y: { type: 'number', description: '视口 Y 偏移' },
        k: { type: 'number', description: '缩放比例' }
      },
      required: []
    },
    requiresConfirmation: false,
    toOps: (params) => [{ action: 'set_viewport', params: { x: params.x, y: params.y, k: params.k } }]
  },
  {
    name: 'canvas_run_generation',
    description: '对画布上的配置节点触发图片或视频生成',
    parameters: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: '要运行的配置/视频/Comfy 节点 ID' }
      },
      required: ['nodeId']
    },
    requiresConfirmation: true,
    toOps: (params) => [
      {
        action: 'update_node',
        params: { id: params.nodeId, patch: { metadata: { status: 'queued' } } }
      }
    ]
  },
  {
    name: 'canvas_export_snapshot',
    description: '导出当前画布状态的快照（节点和连接的 JSON 描述）',
    parameters: { type: 'object', properties: {}, required: [] },
    requiresConfirmation: false,
    toOps: () => []
  },
  {
    name: 'canvas_add_image_node',
    description: '在画布上创建一个图片节点，填入指定图片 URL',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '图片 URL (data URL 或 http URL)' },
        title: { type: 'string', description: '节点标题' },
        position: {
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } }
        }
      },
      required: ['url']
    },
    requiresConfirmation: true,
    toOps: (params) => {
      const position = (params.position as { x: number; y: number }) || {
        x: 300 + Math.random() * 200,
        y: 100 + Math.random() * 200
      }
      return [
        {
          action: 'create_node',
          params: {
            type: 'image',
            title: params.title || '图片',
            position,
            metadata: { content: params.url, status: 'success' }
          }
        }
      ]
    }
  }
]

export function getToolDefinition(name: string): CanvasToolDefinition | undefined {
  return CANVAS_TOOLS.find((t) => t.name === name)
}

export function getToolDefinitions() {
  return CANVAS_TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }))
}

import type { GenerationParams } from '@shared/types/generation'
import { createRoutedGenerationTask } from './generation-router'

export interface WorkflowNodeExecutionRequest {
  nodeId: string
  generationParams: GenerationParams
}

export async function executeWorkflowNode(
  request: WorkflowNodeExecutionRequest
): Promise<{ taskId: string; status: string }> {
  const { nodeId, generationParams } = request
  console.log('[WorkflowExecution] Execute node:', {
    nodeId,
    model: generationParams.model,
    providerId: generationParams.providerId
  })

  // 将 nodeId 放入 params，让 generation queue 的 onUpdate 可以回推 workflow node 状态
  const paramsWithNodeId = { ...generationParams, nodeId }
  const task = await createRoutedGenerationTask(paramsWithNodeId, 'normal')

  return { taskId: task.id, status: task.status }
}

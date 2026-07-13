/**
 * Agent Squad IPC handlers
 */

import { ipcMain } from 'electron'
import { cancelSquadExecution, runSquadExecution, type SquadRunRequest } from '../services/agent-squad-executor'

export function registerAgentSquadIpc() {
  ipcMain.handle('agent-squad:run', async (event, req: SquadRunRequest) => {
    if (!req || !req.taskId || typeof req.taskId !== 'string') {
      throw new Error('Invalid squad run request')
    }
    if (!req.agents || !Array.isArray(req.agents) || req.agents.length === 0) {
      throw new Error('Squad run requires at least one agent')
    }
    // Intentionally not awaited: execution is long-running and streams events
    runSquadExecution(req).catch((err) => {
      console.error('[AgentSquadIPC] Unexpected execution error:', err)
      // Notify renderer of early failures so UI doesn't hang on loading spinner
      event.sender.send('agent-squad:error', { taskId: req.taskId, error: String(err) })
    })
    return { taskId: req.taskId, started: true }
  })

  ipcMain.handle('agent-squad:cancel', (_event, taskId: string) => {
    cancelSquadExecution(taskId)
    return { cancelled: true }
  })
}

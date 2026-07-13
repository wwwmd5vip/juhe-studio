/**
 * MCP IPC handlers
 */

import { eq } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { db } from '../db'
import { mcpServers } from '../db/schema'
import {
  callTool,
  connectServer,
  disconnectAll,
  disconnectServer,
  listTools,
  type McpServerConfig,
  type McpToolInfo
} from '../services/mcp'

function dbRowToConfig(row: typeof mcpServers.$inferSelect): McpServerConfig {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    transport: row.transport as McpServerConfig['transport'],
    command: row.command || undefined,
    args: row.args as string[] | undefined,
    env: row.env as Record<string, string> | undefined,
    url: row.url || undefined
  }
}

export function registerMcpIpc() {
  // List all configured MCP servers
  ipcMain.handle('mcp:servers:list', async () => {
    const rows = await db.select().from(mcpServers).orderBy(mcpServers.createdAt)
    return rows.map(dbRowToConfig)
  })

  // Save (create or update) MCP servers
  ipcMain.handle('mcp:servers:save', async (_, configs: McpServerConfig[]) => {
    const now = new Date().toISOString()
    for (const config of configs) {
      const existing = await db.select().from(mcpServers).where(eq(mcpServers.id, config.id)).limit(1)
      const payload = {
        id: config.id,
        name: config.name,
        enabled: config.enabled,
        transport: config.transport,
        command: config.command || null,
        args: config.args as string[] | null,
        env: config.env as Record<string, string> | null,
        url: config.url || null,
        updatedAt: now
      }
      if (existing.length > 0) {
        await db.update(mcpServers).set(payload).where(eq(mcpServers.id, config.id))
      } else {
        await db.insert(mcpServers).values({ ...payload, createdAt: now })
      }
    }
    return configs
  })

  // Delete an MCP server
  ipcMain.handle('mcp:servers:delete', async (_, id: string) => {
    await disconnectServer(id)
    await db.delete(mcpServers).where(eq(mcpServers.id, id))
    return { success: true }
  })

  // Test connection to an MCP server
  ipcMain.handle('mcp:servers:test', async (_, config: McpServerConfig) => {
    try {
      await connectServer(config)
      const tools = await listTools(config.id)
      return { success: true, tools }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })

  // Connect enabled servers and list all available tools
  ipcMain.handle('mcp:tools:list', async (_, serverId?: string) => {
    if (serverId) {
      const configRow = await db.select().from(mcpServers).where(eq(mcpServers.id, serverId)).limit(1)
      if (configRow.length > 0) {
        await connectServer(dbRowToConfig(configRow[0]))
      }
      return listTools(serverId)
    }

    const enabledRows = await db.select().from(mcpServers).where(eq(mcpServers.enabled, true))
    for (const row of enabledRows) {
      try {
        await connectServer(dbRowToConfig(row))
      } catch (err) {
        console.warn(`[MCP] Failed to connect server ${row.id}:`, err)
      }
    }
    return listTools()
  })

  // Call an MCP tool
  ipcMain.handle('mcp:tools:call', async (_, serverId: string, toolName: string, args: unknown) => {
    try {
      const result = await callTool(serverId, toolName, args)
      return { success: true, result }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  })

  // Disconnect all MCP servers (e.g. on app quit)
  ipcMain.handle('mcp:disconnect-all', async () => {
    await disconnectAll()
    return { success: true }
  })
}

export type { McpServerConfig, McpToolInfo }

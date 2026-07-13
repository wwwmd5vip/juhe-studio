/**
 * MCP (Model Context Protocol) store
 */

import { create } from 'zustand'

export type McpTransportType = 'stdio' | 'sse' | 'streamable-http'

export interface McpServerConfig {
  id: string
  name: string
  enabled: boolean
  transport: McpTransportType
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
}

export interface McpToolInfo {
  serverId: string
  serverName: string
  name: string
  description?: string
  inputSchema?: unknown
}

interface McpState {
  servers: McpServerConfig[]
  tools: McpToolInfo[]
  isLoading: boolean
  error: string | null
  loadServers: () => Promise<void>
  saveServers: (servers: McpServerConfig[]) => Promise<void>
  deleteServer: (id: string) => Promise<void>
  testServer: (config: McpServerConfig) => Promise<{ success: boolean; error?: string; tools?: McpToolInfo[] }>
  loadTools: (serverId?: string) => Promise<void>
  callTool: (
    serverId: string,
    toolName: string,
    args: unknown
  ) => Promise<{ success: boolean; error?: string; result?: unknown }>
  clearError: () => void
}

const api = (
  window as unknown as {
    api: {
      mcp: {
        listServers: () => Promise<McpServerConfig[]>
        saveServers: (configs: McpServerConfig[]) => Promise<McpServerConfig[]>
        deleteServer: (id: string) => Promise<{ success: boolean }>
        testServer: (config: McpServerConfig) => Promise<{ success: boolean; error?: string; tools?: McpToolInfo[] }>
        listTools: (serverId?: string) => Promise<McpToolInfo[]>
        callTool: (
          serverId: string,
          toolName: string,
          args: unknown
        ) => Promise<{ success: boolean; error?: string; result?: unknown }>
      }
    }
  }
).api

export const useMcpStore = create<McpState>((set, get) => ({
  servers: [],
  tools: [],
  isLoading: false,
  error: null,

  loadServers: async () => {
    set({ isLoading: true, error: null })
    try {
      const servers = await api.mcp.listServers()
      set({ servers, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message, isLoading: false })
    }
  },

  saveServers: async (servers) => {
    set({ isLoading: true, error: null })
    try {
      const saved = await api.mcp.saveServers(servers)
      set({ servers: saved, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message, isLoading: false })
      throw err
    }
  },

  deleteServer: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.mcp.deleteServer(id)
      set({ servers: get().servers.filter((s) => s.id !== id), isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message, isLoading: false })
      throw err
    }
  },

  testServer: async (config) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.mcp.testServer(config)
      set({ isLoading: false })
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message, isLoading: false })
      return { success: false, error: message }
    }
  },

  loadTools: async (serverId) => {
    set({ isLoading: true, error: null })
    try {
      const tools = await api.mcp.listTools(serverId)
      set({ tools, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set({ error: message, isLoading: false })
    }
  },

  callTool: async (serverId, toolName, args) => {
    try {
      return await api.mcp.callTool(serverId, toolName, args)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  },

  clearError: () => set({ error: null })
}))

/**
 * MCP (Model Context Protocol) runtime service
 * Manages stdio / SSE / streamable-http MCP server connections and tool invocation.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'

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

interface ActiveConnection {
  client: Client
  transport: Transport
  tools: McpToolInfo[]
}

const activeConnections = new Map<string, ActiveConnection>()

// ── MCP command safety validation ──
// Commands that can cause irreversible damage — always blocked
const DANGEROUS_COMMANDS = new Set(['rm', 'sudo', 'chmod', 'chown', 'mkfs', 'dd', 'mv', 'shutdown', 'reboot', 'killall'])

// Safe interpreters and package runners that are commonly used by MCP servers
const ALLOWED_COMMANDS = new Set(['node', 'python', 'python3', 'npx', 'uvx', 'deno', 'bun', 'go'])

// Shell metacharacters that suggest command injection
const SHELL_METACHAR_PATTERN = /[;&|`$(){}[\]!#~*?<>\\]/

/** Validates that an MCP stdio command does not pose a security risk. */
function validateMcpCommand(command: string): boolean {
  // Extract the base command name (last segment, strip path separators)
  const trimmed = command.trim()
  if (!trimmed) return false

  // Reject commands containing shell metacharacters that allow command injection
  if (SHELL_METACHAR_PATTERN.test(trimmed)) {
    return false
  }

  // Extract the executable name (strip directory path)
  const parts = trimmed.split('/')
  const baseCmd = parts[parts.length - 1] || trimmed

  // Block known dangerous commands
  if (DANGEROUS_COMMANDS.has(baseCmd)) return false

  // Allow known safe interpreters and package runners
  if (ALLOWED_COMMANDS.has(baseCmd)) return true

  // For absolute paths, allow only from common safe locations
  if (trimmed.startsWith('/')) {
    const allowedPrefixes = [
      '/usr/local/bin/',
      '/usr/bin/',
      '/opt/homebrew/bin/',
      '/home/',
    ]
    // Also allow paths under the user's home directory
    const homePrefix = process.env.HOME ? `${process.env.HOME}/` : null
    if (homePrefix && trimmed.startsWith(homePrefix)) return true
    return allowedPrefixes.some((prefix) => trimmed.startsWith(prefix))
  }

  // For bare command names (no path), reject unless explicitly allowed
  return false
}

function createTransport(config: McpServerConfig): Transport {
  switch (config.transport) {
    case 'stdio': {
      if (!config.command) {
        throw new Error(`MCP server ${config.id} is missing command for stdio transport`)
      }
      if (!validateMcpCommand(config.command)) {
        console.warn(
          `[MCP] Blocked potentially dangerous command for server "${config.id}": ${config.command}`
        )
        throw new Error(
          `MCP server "${config.id}" command rejected by safety policy: ${config.command}`
        )
      }
      return new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          USER: process.env.USER,
          ...config.env,
        } as Record<string, string>
      })
    }
    case 'sse': {
      if (!config.url) {
        throw new Error(`MCP server ${config.id} is missing url for sse transport`)
      }
      return new SSEClientTransport(new URL(config.url))
    }
    case 'streamable-http': {
      if (!config.url) {
        throw new Error(`MCP server ${config.id} is missing url for streamable-http transport`)
      }
      return new StreamableHTTPClientTransport(new URL(config.url))
    }
    default:
      throw new Error(`Unsupported MCP transport: ${config.transport}`)
  }
}

export async function connectServer(config: McpServerConfig): Promise<void> {
  if (activeConnections.has(config.id)) {
    await disconnectServer(config.id)
  }

  const client = new Client({ name: 'juhe-studio', version: '1.0.0-rc.0' })
  const transport = createTransport(config)

  await client.connect(transport)

  const toolsResult = await client.listTools()
  const tools: McpToolInfo[] = (toolsResult.tools || []).map((tool: Tool) => ({
    serverId: config.id,
    serverName: config.name,
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }))

  activeConnections.set(config.id, { client, transport, tools })
}

export async function disconnectServer(serverId: string): Promise<void> {
  const conn = activeConnections.get(serverId)
  if (!conn) return
  try {
    await conn.client.close()
  } catch (err) {
    console.warn(`[MCP] Error closing client ${serverId}:`, err)
  }
  activeConnections.delete(serverId)
}

export async function listTools(serverId?: string): Promise<McpToolInfo[]> {
  if (serverId) {
    const conn = activeConnections.get(serverId)
    return conn?.tools || []
  }
  return Array.from(activeConnections.values()).flatMap((conn) => conn.tools)
}

const MCP_TOOL_TIMEOUT_MS = 60000 // 60 seconds

export async function callTool(serverId: string, toolName: string, args: unknown): Promise<unknown> {
  const conn = activeConnections.get(serverId)
  if (!conn) {
    throw new Error(`MCP server not connected: ${serverId}`)
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MCP_TOOL_TIMEOUT_MS)
  try {
    const result = await Promise.race([
      conn.client.callTool({ name: toolName, arguments: args as Record<string, unknown> }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`MCP tool '${toolName}' call timed out after ${MCP_TOOL_TIMEOUT_MS}ms`)), MCP_TOOL_TIMEOUT_MS)
      )
    ])
    return result
  } finally {
    clearTimeout(timeout)
  }
}

export async function disconnectAll(): Promise<void> {
  for (const serverId of Array.from(activeConnections.keys())) {
    await disconnectServer(serverId)
  }
}

export function getConnectedServerIds(): string[] {
  return Array.from(activeConnections.keys())
}

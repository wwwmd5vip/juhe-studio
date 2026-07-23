/**
 * 插件安装来源白名单校验（纯函数，无 Electron 依赖，便于单元测试）。
 *
 * 规则：
 * - 本地目录：必须位于 userData/plugins-available 之内（用户需手动把插件目录放到这里）。
 * - URL：必须匹配配置的官方 registry 前缀（PLUGIN_REGISTRY_URLS 环境变量，逗号分隔，
 *   仅接受 https:// 前缀）。默认无任何前缀 → 所有 URL 安装一律拒绝。
 */
import { resolve, sep } from 'node:path'

export function isLocalPathWithin(root: string, target: string): boolean {
  const r = resolve(root)
  const t = resolve(target)
  return t === r || t.startsWith(r + sep)
}

export interface PluginSourceWhitelist {
  /** 允许安装本地插件的目录（绝对路径），通常为 userData/plugins-available */
  allowedDir: string
  /** 允许的官方 registry URL 前缀列表（https://...） */
  registryPrefixes: string[]
}

export function isPluginSourceAllowed(source: string, whitelist: PluginSourceWhitelist): boolean {
  if (typeof source !== 'string' || source.length === 0) return false
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return whitelist.registryPrefixes.some((prefix) => source.startsWith(prefix))
  }
  return isLocalPathWithin(whitelist.allowedDir, source)
}

/** 从环境变量解析 registry 前缀（逗号分隔，仅保留 https://） */
export function parseRegistryPrefixes(envValue: string | undefined): string[] {
  return (envValue ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('https://'))
}

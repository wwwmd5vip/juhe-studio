/**
 * Plugin install source whitelist tests — pure functions, no mocks needed.
 */
import { describe, it, expect } from 'vitest'
import { isLocalPathWithin, isPluginSourceAllowed, parseRegistryPrefixes } from '../plugin-source'

const ALLOWED_DIR = '/mock/userData/plugins-available'

describe('isLocalPathWithin', () => {
  it('accepts paths inside the root', () => {
    expect(isLocalPathWithin(ALLOWED_DIR, `${ALLOWED_DIR}/my-plugin`)).toBe(true)
    expect(isLocalPathWithin(ALLOWED_DIR, ALLOWED_DIR)).toBe(true)
  })

  it('rejects paths outside the root', () => {
    expect(isLocalPathWithin(ALLOWED_DIR, '/etc/passwd')).toBe(false)
    expect(isLocalPathWithin(ALLOWED_DIR, '/mock/userData/plugins')).toBe(false)
    // 前缀相同但不在目录内（plugins-available-evil）
    expect(isLocalPathWithin(ALLOWED_DIR, `${ALLOWED_DIR}-evil/x`)).toBe(false)
  })

  it('rejects traversal attempts', () => {
    expect(isLocalPathWithin(ALLOWED_DIR, `${ALLOWED_DIR}/../../../etc/passwd`)).toBe(false)
  })
})

describe('isPluginSourceAllowed', () => {
  const whitelist = { allowedDir: ALLOWED_DIR, registryPrefixes: ['https://plugins.example.com/'] }

  it('allows local directories under plugins-available', () => {
    expect(isPluginSourceAllowed(`${ALLOWED_DIR}/my-plugin`, whitelist)).toBe(true)
  })

  it('rejects arbitrary local paths', () => {
    expect(isPluginSourceAllowed('/etc/passwd', whitelist)).toBe(false)
    expect(isPluginSourceAllowed('/tmp/evil-plugin', whitelist)).toBe(false)
    expect(isPluginSourceAllowed(`${ALLOWED_DIR}/../../.ssh/id_rsa`, whitelist)).toBe(false)
  })

  it('allows URLs matching a configured registry prefix', () => {
    expect(isPluginSourceAllowed('https://plugins.example.com/foo.zip', whitelist)).toBe(true)
  })

  it('rejects URLs not matching any registry prefix', () => {
    expect(isPluginSourceAllowed('https://evil.example.com/foo.zip', whitelist)).toBe(false)
    expect(isPluginSourceAllowed('http://plugins.example.com/foo.zip', whitelist)).toBe(false)
  })

  it('rejects all URLs when no registry prefix is configured', () => {
    const noRegistry = { allowedDir: ALLOWED_DIR, registryPrefixes: [] }
    expect(isPluginSourceAllowed('https://plugins.example.com/foo.zip', noRegistry)).toBe(false)
  })

  it('rejects empty input', () => {
    expect(isPluginSourceAllowed('', whitelist)).toBe(false)
  })
})

describe('parseRegistryPrefixes', () => {
  it('parses comma-separated https prefixes only', () => {
    expect(parseRegistryPrefixes('https://a.com/, http://b.com/, https://c.com/x ,,')).toEqual([
      'https://a.com/',
      'https://c.com/x'
    ])
    expect(parseRegistryPrefixes(undefined)).toEqual([])
    expect(parseRegistryPrefixes('')).toEqual([])
  })
})

/**
 * Jimeng (即梦) 图像/视频生成服务
 * 通过火山引擎视觉 API 调用即梦服务
 *
 * 即梦只有一个模型，通过不同 req_key 区分功能：
 * - jimeng_t2i_v40:  文生图 4.0
 * - jimeng_t2i_v31:  文生图 3.1
 * - jimeng_t2i_v30:  文生图 3.0
 * - jimeng_i2i_v30:  图生图 3.0
 * - jimeng_ti2v_v30_pro: 文生视频 / 图生视频 3.0 Pro
 * - jimeng_vgfm_i2v_l20: 图生视频 S2.0 Pro
 *
 * API 文档: https://www.volcengine.com/docs/85621
 */

import * as crypto from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import type { GenerationOutput, GenerationTask } from '@shared/types/generation'
import { updateTaskProgress } from '@shared/utils/task-utils'
import { httpRequest, HttpError } from '@shared/utils/http-client'
import { eq } from 'drizzle-orm'
import { app } from 'electron'
import { db } from '../db'
import { providers } from '../db/schema'

function getFrameCount(duration?: string | number | null): number {
  if (duration == null) return 241
  const n = Number(duration)
  return Number.isFinite(n) && n <= 5 ? 121 : 241
}

// ===== 本地图片服务器（为即梦 API 提供可下载的图片 URL）=====
let imageServer: ReturnType<typeof createServer> | null = null
let imageServerPort = 0

function getImageServerDir(): string {
  const dir = join(app.getPath('userData'), 'Data', 'JimengImages')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/** Promise that resolves when image server is ready */
let imageServerReadyPromise: Promise<number> | null = null

/** Pre-start the image server during app initialization to ensure port is ready */
export function initImageServer(): Promise<number> {
  if (imageServerReadyPromise) return imageServerReadyPromise
  if (imageServer) return Promise.resolve(imageServerPort)

  imageServerReadyPromise = new Promise((resolve) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url || '/', `http://localhost`)
        const filename = url.pathname.slice(1) // remove leading /
        if (!filename) {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const filepath = join(getImageServerDir(), filename)
        // Validate path stays within image server directory
        const resolved = require('node:path').resolve(filepath)
        const serverDir = getImageServerDir()
        if (!resolved.startsWith(serverDir + require('node:path').sep) && resolved !== serverDir) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }
        if (!existsSync(filepath)) {
          res.writeHead(404)
          res.end('File not found')
          return
        }

        const data = readFileSync(filepath)
        const ext = filename.split('.').pop()?.toLowerCase()
        const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png'

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': data.length,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        })
        res.end(data)
      } catch (err) {
        console.error('[ImageServer] Error:', err)
        res.writeHead(500)
        res.end('Internal error')
      }
    })

    // Try preferred ports first, then random
    const tryPorts = [19527, 19528, 19529]

    function tryListen(portIndex: number): void {
      // Remove previous error listeners to prevent listener accumulation
      server.removeAllListeners('error')
      if (portIndex >= tryPorts.length) {
        // All preferred ports failed, try random
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address()
          imageServerPort = typeof addr === 'object' && addr ? addr.port : 0
          imageServer = server
          console.log(`[ImageServer] Started on random port http://0.0.0.0:${imageServerPort}`)
          resolve(imageServerPort)
        })
        return
      }

      const port = tryPorts[portIndex]
      server.once('error', (err: Error) => {
        if ((err as unknown as { code?: string }).code === 'EADDRINUSE') {
          console.log(`[ImageServer] Port ${port} in use, trying next...`)
          tryListen(portIndex + 1)
        } else {
          console.error(`[ImageServer] Port ${port} error:`, err.message)
          tryListen(portIndex + 1)
        }
      })

      server.listen(port, '127.0.0.1', () => {
        imageServerPort = port
        imageServer = server
        console.log(`[ImageServer] Started on http://0.0.0.0:${imageServerPort}`)
        resolve(imageServerPort)
      })
    }

    tryListen(0)
  })

  return imageServerReadyPromise
}

/** Get the current image server port (0 if not started) */
function _getImageServerPort(): number {
  return imageServerPort
}

/** Stop the image server */
export function closeImageServer(): void {
  if (imageServer) {
    console.log('[ImageServer] Closing...')
    imageServer.close()
    imageServer = null
    imageServerPort = 0
    imageServerReadyPromise = null
  }
}

/** Wait for image server to be ready, returns port */
export async function ensureImageServerReady(): Promise<number> {
  if (imageServer && imageServerPort > 0) return imageServerPort
  if (imageServerReadyPromise) return imageServerReadyPromise
  // If not initialized yet, initialize now
  return initImageServer()
}

/** ngrok tunnel URL for external access (set when tunnel is active) */
let ngrokTunnelUrl: string | null = null

/** Set ngrok tunnel URL for external access */
export function setNgrokTunnelUrl(url: string | null): void {
  ngrokTunnelUrl = url
  console.log('[ImageServer] Ngrok tunnel URL set:', url)
}

/** Get the best host for external API access */
function getExternalHost(): string {
  // If ngrok tunnel is available, use it
  if (ngrokTunnelUrl) {
    // Return empty string since ngrok URL includes protocol and host
    return ''
  }

  const os = require('node:os')
  const interfaces = os.networkInterfaces()
  // Prefer 192.168.x.x addresses
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
        return iface.address
      }
    }
  }
  // Try 10.x.x.x
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('10.')) {
        return iface.address
      }
    }
  }
  // Try 172.16-31.x.x
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const addr = iface.address
        if (addr.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
          return addr
        }
      }
    }
  }
  return '127.0.0.1'
}

/** 从各种URL格式提取base64字符串 */
async function extractBase64FromUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/)
    if (match) {
      return match[2]
    }
    throw new Error('Invalid data URL format')
  }
  if (url.startsWith('file://') || url.startsWith('juhe-image://')) {
    const filePath = url.startsWith('file://')
      ? decodeURIComponent(url.slice(7))
      : decodeURIComponent(url.slice('juhe-image://'.length))
    // Validate path stays within userData to prevent path traversal
    const resolved = require('node:path').resolve(filePath)
    const userDataDir = require('electron').app.getPath('userData')
    if (!resolved.startsWith(userDataDir + require('node:path').sep) && resolved !== userDataDir) {
      throw new Error(`Access denied: ${filePath} is outside user data directory`)
    }
    const fileData = readFileSync(resolved)
    return fileData.toString('base64')
  }
  // 已经是外部URL，下载并转为base64
  let response: Response
  try {
    const result = await httpRequest(url, { method: 'GET', raw: true })
    response = result.response
  } catch (err) {
    if (err instanceof HttpError) {
      throw new Error(`Failed to fetch image: ${err.status}`)
    }
    throw err
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  return buffer.toString('base64')
}

/** 将 base64 data URL 保存为本地文件，返回可下载的 HTTP URL */
async function saveBase64ToLocalServer(dataUrl: string): Promise<string> {
  // Ensure server is ready before proceeding
  const port = await ensureImageServerReady()
  if (port === 0) {
    console.error('[ImageServer] Server not started, cannot save base64 image')
    return dataUrl
  }
  const dir = getImageServerDir()

  // Parse data URL
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg));base64,(.+)$/)
  if (!match) {
    console.error('[ImageServer] Invalid data URL format')
    return dataUrl // fallback
  }

  const mimeType = match[1]
  const base64Data = match[3]
  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png'
  const hash = crypto.createHash('md5').update(base64Data).digest('hex')
  const filename = `${hash}.${ext}`
  const filepath = join(dir, filename)

  if (!existsSync(filepath)) {
    const buffer = Buffer.from(base64Data, 'base64')
    const tmpPath = filepath + '.tmp.' + process.pid
    writeFileSync(tmpPath, buffer)
    renameSync(tmpPath, filepath)
    console.log('[ImageServer] Saved image:', filename, 'size:', buffer.length)
  }

  // If ngrok tunnel is available, use it instead of local IP
  if (ngrokTunnelUrl) {
    const cleanUrl = ngrokTunnelUrl.replace(/\/$/, '')
    console.log('[ImageServer] Using ngrok tunnel:', cleanUrl)
    return `${cleanUrl}/${filename}`
  }

  const host = getExternalHost()
  console.log('[ImageServer] Using local host for external access:', host, 'port:', port)
  return `http://${host}:${port}/${filename}`
}

// ===== 功能到 req_key 的映射 =====
// 即梦只有一个模型，不同功能对应不同 req_key
const JIMENG_FUNCTION_MAP: Record<string, { reqKey: string; outputType: 'image' | 'video' }> = {
  // ===== 文生图 =====
  'jimeng-t2i-v40': { reqKey: 'jimeng_t2i_v40', outputType: 'image' },
  'jimeng-t2i-v31': { reqKey: 'jimeng_t2i_v31', outputType: 'image' },
  'jimeng-t2i-v30': { reqKey: 'jimeng_t2i_v30', outputType: 'image' },
  // ===== 图生图 =====
  'jimeng-i2i-v30': { reqKey: 'jimeng_i2i_v30', outputType: 'image' },
  // ===== 图片生成4.6 (Seedream) =====
  'jimeng-seedream46-cvtob': { reqKey: 'jimeng_seedream46_cvtob', outputType: 'image' },
  // ===== 智能扩图 =====
  'jimeng-outpainting': { reqKey: 'jimeng_img2img_seed3_painting_edit', outputType: 'image' },
  // ===== 智能超清 =====
  'jimeng-super-resolution': { reqKey: 'jimeng_i2i_seed3_tilesr_cvtob', outputType: 'image' },
  // ===== 交互编辑inpainting =====
  'jimeng-inpainting': { reqKey: 'jimeng_image2image_dream_inpaint', outputType: 'image' },
  // ===== 素材提取-商品提取 =====
  'jimeng-extract-product': { reqKey: 'jimeng_i2i_extract_tiled_images', outputType: 'image' },
  // ===== 素材提取-POD按需定制 =====
  'jimeng-extract-pod': { reqKey: 'i2i_material_extraction', outputType: 'image' },
  // ===== 文生/图生视频 3.0 Pro =====
  'jimeng-t2v-v30-pro': { reqKey: 'jimeng_ti2v_v30_pro', outputType: 'video' },
  // ===== 视频生成 720P =====
  'jimeng-t2v-v30-720p': { reqKey: 'jimeng_t2v_v30', outputType: 'video' },
  'jimeng-i2v-first-v30-720p': { reqKey: 'jimeng_i2v_first_v30', outputType: 'video' },
  'jimeng-i2v-first-tail-v30-720p': { reqKey: 'jimeng_i2v_first_tail_v30', outputType: 'video' },
  'jimeng-i2v-recamera-v30-720p': { reqKey: 'jimeng_i2v_recamera_v30', outputType: 'video' },
  // ===== 视频生成 1080P =====
  'jimeng-t2v-v30-1080p': { reqKey: 'jimeng_t2v_v30_1080p', outputType: 'video' },
  'jimeng-i2v-first-v30-1080p': { reqKey: 'jimeng_i2v_first_v30_1080', outputType: 'video' },
  'jimeng-i2v-first-tail-v30-1080p': { reqKey: 'jimeng_i2v_first_tail_v30_1080', outputType: 'video' },
  // ===== 图生视频 S2.0 Pro =====
  'jimeng-i2v-s2-pro': { reqKey: 'jimeng_vgfm_i2v_l20', outputType: 'video' },
  // ===== 动作模仿 =====
  'jimeng-dream-actor': { reqKey: 'jimeng_dream_actor_m1_gen_video_cv', outputType: 'video' },
  'jimeng-dream-actor-v2': { reqKey: 'jimeng_dreamactor_m20_gen_video', outputType: 'video' },
  // ===== 小云雀-营销成片Agent =====
  'jimeng-pippit-marketing': { reqKey: 'pippit_iv2v_cvtob_master', outputType: 'video' },
  // ===== 小云雀-智能生视频Agent 2.0 =====
  'jimeng-pippit-video-v2': { reqKey: 'pippit_iv2v_v20_cvtob', outputType: 'video' },
  'jimeng-pippit-video-v2-with-ref': { reqKey: 'pippit_iv2v_v20_cvtob_with_vinput', outputType: 'video' },
  // ===== 兼容旧版本/别名 =====
  'jimeng-i2v-first-v30': { reqKey: 'jimeng_vgfm_i2v_l20', outputType: 'video' }
}

// 尺寸映射: 按版本区分
// 文生图 4.0 (jimeng_t2i_v40) 支持尺寸
// 官方文档推荐: https://www.volcengine.com/docs/85621/1817045
// 4.0 默认不传 width/height，由模型根据 prompt 智能判断
// 如需指定，推荐 2K 及以上分辨率
const T2I_V40_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '1:1': { width: 2048, height: 2048 },
  '16:9': { width: 2560, height: 1440 },
  '9:16': { width: 1440, height: 2560 },
  '4:3': { width: 2304, height: 1728 },
  '3:4': { width: 1728, height: 2304 },
  '3:2': { width: 2496, height: 1664 },
  '2:3': { width: 1664, height: 2496 },
  '21:9': { width: 3024, height: 1296 },
  '9:21': { width: 1296, height: 3024 }
}

// 文生图 3.1 (jimeng_t2i_v31) 支持尺寸
const T2I_V31_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1328, height: 1328 },
  '16:9': { width: 1664, height: 936 },
  '9:16': { width: 936, height: 1664 },
  '4:3': { width: 1472, height: 1104 },
  '3:4': { width: 1104, height: 1472 },
  '3:2': { width: 1584, height: 1056 },
  '2:3': { width: 1056, height: 1584 },
  '21:9': { width: 2016, height: 864 },
  '9:21': { width: 864, height: 2016 }
}

// 文生图 3.0 (jimeng_t2i_v30) 支持尺寸
const T2I_V30_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '3:2': { width: 1024, height: 682 },
  '2:3': { width: 682, height: 1024 }
}

// 图生图 3.0 (jimeng_i2i_v30) 支持尺寸
const I2I_V30_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '3:2': { width: 1024, height: 682 },
  '2:3': { width: 682, height: 1024 }
}

/** 根据 reqKey 获取对应的尺寸映射 */
function getSizeMap(reqKey: string): Record<string, { width: number; height: number }> {
  if (reqKey === 'jimeng_t2i_v40') return T2I_V40_SIZE_MAP
  if (reqKey === 'jimeng_t2i_v31') return T2I_V31_SIZE_MAP
  if (reqKey === 'jimeng_t2i_v30') return T2I_V30_SIZE_MAP
  if (reqKey === 'jimeng_i2i_v30') return I2I_V30_SIZE_MAP
  // 默认使用 3.0 尺寸
  return T2I_V30_SIZE_MAP
}

// 视频比例映射
const VIDEO_ASPECT_RATIO_MAP: Record<string, string> = {
  '1:1': '1:1',
  '16:9': '16:9',
  '9:16': '9:16',
  '4:3': '4:3',
  '3:4': '3:4',
  '21:9': '21:9',
  '9:21': '9:21'
}

// 火山引擎 API 配置
const VOLCENGINE_HOST = 'visual.volcengineapi.com'
const VOLCENGINE_REGION = 'cn-north-1' // 官方文档要求 cn-north-1
const VOLCENGINE_SERVICE = 'cv'

interface JimengApiResponse {
  code: number
  data?: {
    task_id?: string
    status?: string
    image_urls?: string[]
    binary_data_base64?: string[]
    video_url?: string
    algorithm_base_resp?: {
      status_code?: number
      status_message?: string
    }
    algo_status_code?: number
    algo_status_message?: string
    progress?: number
  }
  message?: string
  request_id?: string
  status?: number
}

/**
 * 获取 Provider 的解密 AK/SK
 */
export async function getProviderCredentials(
  providerId: string
): Promise<{ accessKeyId: string; secretAccessKey: string } | null> {
  const result = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1)

  const provider = result[0]
  if (!provider) return null

  const { decryptApiKey } = await import('../services/secure-storage')

  if (provider.accessKeyId && provider.secretAccessKey) {
    return {
      accessKeyId: decryptApiKey(provider.accessKeyId).trim(),
      secretAccessKey: decryptApiKey(provider.secretAccessKey).trim()
    }
  }

  if (provider.apiKey) {
    const decrypted = decryptApiKey(provider.apiKey)
    const parts = decrypted.split(':')
    if (parts.length === 2) {
      return {
        accessKeyId: parts[0].trim(),
        secretAccessKey: parts[1].trim()
      }
    }
    return {
      accessKeyId: decrypted.trim(),
      secretAccessKey: process.env.VOLCSTACK_SECRET_ACCESS_KEY || ''
    }
  }

  return null
}

// ===== 签名相关（对齐火山引擎官方 SDK） =====
// 参考: https://www.volcengine.com/docs/6369/67269
// 火山引擎 V4 签名算法 —— 与 AWS Signature V4 兼容
const UNSIGNED_HEADERS = new Set(['authorization', 'content-length', 'user-agent', 'presigned-expires', 'expect'])

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest()
}

function sha256Hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * 获取 UTC 时间字符串，格式: YYYYMMDD'T'HHMMSS'Z'
 * 必须与 X-Date header 的值完全一致
 */
function getDateTime(date?: Date): string {
  const d = date ?? new Date()
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const hours = String(d.getUTCHours()).padStart(2, '0')
  const minutes = String(d.getUTCMinutes()).padStart(2, '0')
  const seconds = String(d.getUTCSeconds()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

function signRequest(params: {
  method: string
  uri: string
  query: Record<string, string>
  headers: Record<string, string>
  body: string
  region: string
  service: string
  accessKeyId: string
  secretAccessKey: string
}): Record<string, string> {
  const { method, uri, query, headers, body, region, service, accessKeyId, secretAccessKey } = params

  const datetime = getDateTime()
  const date = datetime.slice(0, 8)

  // 1. 规范化查询字符串 (URI 编码，按 key 排序)
  const sortedQueryKeys = Object.keys(query)
    .filter((k) => query[k] !== undefined && query[k] !== null)
    .sort()
  const canonicalQueryString = sortedQueryKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join('&')

  // 2. 统一 headers 为小写 key，并确保 host 和 content-type 存在
  const lowerHeaders: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v
  }

  // 确保 host 是小写的
  if (lowerHeaders.host) {
    lowerHeaders.host = lowerHeaders.host.toLowerCase()
  }

  // 3. 添加火山引擎签名必需头
  lowerHeaders['x-date'] = datetime
  lowerHeaders['x-content-sha256'] = sha256Hash(body)

  // 4. 构建 signed headers 列表 (排除 unsigned headers，按字母排序)
  const signedHeadersList = Object.keys(lowerHeaders)
    .filter((k) => !UNSIGNED_HEADERS.has(k))
    .sort()

  const signedHeadersStr = signedHeadersList.join(';')

  // 5. 构建 canonical headers (key:value\n 格式)
  const canonicalHeadersLines = signedHeadersList.map((k) => `${k}:${lowerHeaders[k].trim()}`)

  const canonicalHeaders = canonicalHeadersLines.join('\n')

  // 6. 构建 canonical request
  const canonicalRequest = [
    method.toUpperCase(),
    uri,
    canonicalQueryString,
    canonicalHeaders,
    '', // 空行分隔 headers 和 signed headers
    signedHeadersStr,
    lowerHeaders['x-content-sha256']
  ].join('\n')

  // 7. 构建 string to sign
  const credentialScope = `${date}/${region}/${service}/request`
  const stringToSign = ['HMAC-SHA256', datetime, credentialScope, sha256Hash(canonicalRequest)].join('\n')

  // 8. 派生签名密钥 (与 AWS Signature V4 相同)
  const kDate = hmacSha256(secretAccessKey, date)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  const kSigning = hmacSha256(kService, 'request')
  const signature = hmacSha256(kSigning, stringToSign).toString('hex')

  // 9. 构建 Authorization header
  const authorization = `HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`

  // 10. 返回完整 headers (保留原始 headers + 签名相关 headers)
  return {
    ...headers,
    Host: lowerHeaders.host,
    'Content-Type': lowerHeaders['content-type'],
    'X-Date': datetime,
    'X-Content-Sha256': lowerHeaders['x-content-sha256'],
    Authorization: authorization
  }
}

// ===== API 调用 =====

/**
 * 提交 Jimeng 任务
 */
async function submitJimengTask(
  accessKeyId: string,
  secretAccessKey: string,
  reqKey: string,
  bodyPayload: Record<string, unknown>
): Promise<string> {
  // 打印即将发送的payload关键信息（不打印完整base64避免日志过大）
  console.log('[Jimeng] submitJimengTask payload:', {
    reqKey,
    hasBinaryData: !!bodyPayload.binary_data_base64,
    binaryDataCount: Array.isArray(bodyPayload.binary_data_base64) ? bodyPayload.binary_data_base64.length : 0,
    binaryDataLengths: Array.isArray(bodyPayload.binary_data_base64)
      ? (bodyPayload.binary_data_base64 as string[]).map((b, i) => ({ index: i, length: b.length }))
      : undefined,
    hasImageUrls: !!bodyPayload.image_urls,
    imageUrlsCount: Array.isArray(bodyPayload.image_urls) ? bodyPayload.image_urls.length : 0,
    prompt: bodyPayload.prompt,
    width: bodyPayload.width,
    height: bodyPayload.height,
    seed: bodyPayload.seed,
    scale: bodyPayload.scale,
    style: bodyPayload.style,
    quality: bodyPayload.quality
  })
  const body = JSON.stringify(bodyPayload)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Host: VOLCENGINE_HOST
  }

  const signedHeaders = signRequest({
    method: 'POST',
    uri: '/',
    query: {
      Action: 'CVSync2AsyncSubmitTask',
      Version: '2022-08-31'
    },
    headers,
    body,
    region: VOLCENGINE_REGION,
    service: VOLCENGINE_SERVICE,
    accessKeyId,
    secretAccessKey
  })

  let data: JimengApiResponse
  try {
    const result = await httpRequest<JimengApiResponse>(
      `https://${VOLCENGINE_HOST}/?Action=CVSync2AsyncSubmitTask&Version=2022-08-31`,
      {
        method: 'POST',
        headers: signedHeaders,
        body: bodyPayload,
        timeoutMs: 120_000
      }
    )
    data = result.data
  } catch (err) {
    if (err instanceof HttpError) {
      console.error('[Jimeng] Submit failed:', { status: err.status, body: err.body.slice(0, 500), reqKey })
      throw new Error(`即梦接口请求失败， ${err.status} ${err.body.slice(0, 200)}`)
    }
    throw err
  }

  if (typeof data === 'string') {
    console.error('[Jimeng] Invalid JSON response:', String(data).slice(0, 500))
    throw new Error(`即梦接口返回了无法解析的数据： ${String(data).slice(0, 200)}`)
  }

  if (data.code !== 10000 && data.code !== 0) {
    console.error('[Jimeng] Submit error:', { code: data.code, message: data.message, reqKey })
    throw new Error(`即梦接口请求失败， ${data.message || 'Unknown error'} (code: ${data.code})`)
  }

  const taskId = data.data?.task_id
  if (!taskId) {
    console.error('[Jimeng] No task_id in response:', { data: data.data, reqKey })
    throw new Error('即梦接口未返回任务ID，请重试')
  }

  return taskId
}

/**
 * 查询 Jimeng 任务结果
 */
async function getJimengResult(
  accessKeyId: string,
  secretAccessKey: string,
  reqKey: string,
  taskId: string
): Promise<JimengApiResponse['data']> {
  const bodyPayload = { req_key: reqKey, task_id: taskId }
  const body = JSON.stringify(bodyPayload)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Host: VOLCENGINE_HOST
  }

  const signedHeaders = signRequest({
    method: 'POST',
    uri: '/',
    query: {
      Action: 'CVSync2AsyncGetResult',
      Version: '2022-08-31'
    },
    headers,
    body,
    region: VOLCENGINE_REGION,
    service: VOLCENGINE_SERVICE,
    accessKeyId,
    secretAccessKey
  })

  let data: JimengApiResponse
  try {
    const result = await httpRequest<JimengApiResponse>(
      `https://${VOLCENGINE_HOST}/?Action=CVSync2AsyncGetResult&Version=2022-08-31`,
      {
        method: 'POST',
        headers: signedHeaders,
        body: bodyPayload,
        timeoutMs: 30_000
      }
    )
    data = result.data
  } catch (err) {
    if (err instanceof HttpError) {
      console.error('[Jimeng] Query failed:', {
        status: err.status,
        body: err.body.slice(0, 500),
        reqKey,
        taskId
      })
      throw new Error(`即梦接口请求失败， ${err.status} ${err.body.slice(0, 200)}`)
    }
    throw err
  }

  if (typeof data === 'string') {
    console.error('[Jimeng] Invalid JSON in query response:', String(data).slice(0, 500))
    throw new Error(`即梦接口返回了无法解析的数据： ${String(data).slice(0, 200)}`)
  }

  if (data.code !== 10000 && data.code !== 0) {
    console.error('[Jimeng] Query error:', { code: data.code, message: data.message, reqKey, taskId })
    throw new Error(`即梦接口请求失败， ${data.message || 'Unknown error'} (code: ${data.code})`)
  }

  return data.data
}

// ===== 轮询逻辑 =====

/**
 * 轮询 Jimeng 任务结果
 */
async function pollJimengTask(
  task: GenerationTask,
  credentials: { accessKeyId: string; secretAccessKey: string },
  reqKey: string,
  outputType: 'image' | 'video',
  taskId: string,
  maxAttempts: number,
  pollInterval: number
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (task.status === 'cancelled') {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval))

    const result = await getJimengResult(credentials.accessKeyId, credentials.secretAccessKey, reqKey, taskId)

    if (!result) {
      continue
    }

    const status = result.status?.toLowerCase()

    // 状态值: done | generating | in_queue | not_found | expired | canceled | over_max_retries
    if (status === 'done') {
      // 检查 algo_status_code
      if (result.algo_status_code !== undefined && result.algo_status_code !== 0) {
        const errorMsg = result.algo_status_message || `即梦任务失败 (algo_status_code: ${result.algo_status_code})`
        throw new Error(errorMsg)
      }

      const outputs: GenerationOutput[] = []

      // 图片结果
      if (outputType === 'image') {
        if (result.image_urls && result.image_urls.length > 0) {
          for (let i = 0; i < result.image_urls.length; i++) {
            outputs.push({
              id: `${task.id}-${i}`,
              type: 'image',
              url: result.image_urls[i],
              mediaType: 'image/png'
            })
          }
        }
        if (result.binary_data_base64 && result.binary_data_base64.length > 0) {
          for (let i = 0; i < result.binary_data_base64.length; i++) {
            outputs.push({
              id: `${task.id}-${i}`,
              type: 'image',
              base64: result.binary_data_base64[i],
              mediaType: 'image/png'
            })
          }
        }
      }

      // 视频结果
      if (outputType === 'video') {
        if (result.video_url) {
          outputs.push({
            id: `${task.id}-0`,
            type: 'video',
            url: result.video_url,
            mediaType: 'video/mp4'
          })
        }
        // 有些视频接口也返回 image_urls
        if (outputs.length === 0 && result.image_urls && result.image_urls.length > 0) {
          for (let i = 0; i < result.image_urls.length; i++) {
            outputs.push({
              id: `${task.id}-${i}`,
              type: 'video',
              url: result.image_urls[i],
              mediaType: 'video/mp4'
            })
          }
        }
      }

      if (outputs.length === 0) {
        throw new Error(
          `即梦${outputType === 'image' ? 'image' : 'video'} task completed but returned no results`
        )
      }

      task.outputs = outputs
      updateTaskProgress(task, 'completed', 100)
      return
    } else if (
      status === 'not_found' ||
      status === 'expired' ||
      status === 'canceled' ||
      status === 'over_max_retries'
    ) {
      const errorMap: Record<string, string> = {
        not_found: '即梦任务不存在或已过期',
        expired: '即梦任务已过期',
        canceled: '即梦任务已取消',
        over_max_retries: '即梦任务重试次数超限'
      }
      throw new Error(errorMap[status] || `即梦任务失败，状态： ${status}`)
    } else {
      // generating 或 in_queue
      const stage = status === 'generating' ? 'generating' : 'queued'
      const progress = result.progress !== undefined && result.progress > 0 ? result.progress : status === 'generating' ? 60 : 30
      updateTaskProgress(task, stage, progress)
    }
  }

  throw new Error(`即梦${outputType === 'image' ? 'image' : 'video'} generation timed out`)
}

// ===== 执行器 =====

/** Jimeng seed 有效范围 */
const JIMENG_SEED_MIN = -99999999
const JIMENG_SEED_MAX = 99999999

function clampJimengSeed(seed: number | undefined): number | undefined {
  if (seed === undefined) return undefined
  if (seed < JIMENG_SEED_MIN) return JIMENG_SEED_MIN
  if (seed > JIMENG_SEED_MAX) return JIMENG_SEED_MAX
  return seed
}

/**
 * 构建 Jimeng 请求体
 */
async function buildJimengPayload(reqKey: string, params: GenerationTask['params']): Promise<Record<string, unknown>> {
  console.log('[Jimeng] buildJimengPayload start:', {
    reqKey,
    hasReferenceImages: !!params.referenceImages?.length,
    referenceImageCount: params.referenceImages?.length ?? 0,
    referenceImagesTypes: params.referenceImages?.map((url, i) => ({
      index: i,
      prefix: url.slice(0, 30),
      isBase64: url.startsWith('data:'),
      isFileUrl: url.startsWith('file://') || url.startsWith('juhe-image://'),
      isHttpUrl: url.startsWith('http://') || url.startsWith('https://'),
      length: url.length
    })),
    hasFirstFrame: !!params.firstFrame,
    firstFramePrefix: params.firstFrame?.slice(0, 30)
  })
  const payload: Record<string, unknown> = {
    req_key: reqKey,
    prompt: params.prompt
  }

  // 文生图参数 (包括 4.0, 3.1, 3.0 和 4.6 seedream)
  const isTextToImage = reqKey.startsWith('jimeng_t2i_') || reqKey === 'jimeng_seedream46_cvtob'
  if (isTextToImage) {
    // 4.0 和 4.6 默认不传 width/height，由模型智能判断；其他版本传尺寸
    if (reqKey !== 'jimeng_t2i_v40' && reqKey !== 'jimeng_seedream46_cvtob') {
      const sizeMap = getSizeMap(reqKey)
      if (params.aspectRatio && sizeMap[params.aspectRatio]) {
        const size = sizeMap[params.aspectRatio]
        payload.width = size.width
        payload.height = size.height
      } else if (params.size) {
        const [w, h] = params.size.split('x').map(Number)
        if (!Number.isNaN(w) && !Number.isNaN(h)) {
          payload.width = w
          payload.height = h
        }
      }
    } else if (params.size) {
      // 4.0/4.6 用户手动选择了尺寸才传
      const [w, h] = params.size.split('x').map(Number)
      if (!Number.isNaN(w) && !Number.isNaN(h)) {
        payload.width = w
        payload.height = h
      }
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }

    // 风格参数（如果用户选择了）
    if (params.style) {
      payload.style = params.style
    }

    // 画质参数（如果用户选择了）
    if (params.quality) {
      // 即梦 API 使用 quality 字段控制画质
      const qualityMap: Record<string, string> = {
        standard: 'standard',
        hd: 'high',
        high: 'high',
        medium: 'standard',
        low: 'standard'
      }
      payload.quality = qualityMap[params.quality] || params.quality
    }

    // 文生图 4.0/4.6 支持多图参考
    // 文档说只支持 image_urls，但局域网IP无法被即梦服务器访问
    // 所以优先尝试 binary_data_base64（如果接口支持），否则使用本地服务器URL
    if (reqKey === 'jimeng_t2i_v40' || reqKey === 'jimeng_seedream46_cvtob') {
      console.log('[Jimeng] Checking reference images for', reqKey, ':', {
        hasReferenceImages: !!params.referenceImages,
        referenceImageCount: params.referenceImages?.length ?? 0,
        referenceImagesDefined: params.referenceImages !== undefined
      })
      if (params.referenceImages && params.referenceImages.length > 0) {
        console.log(
          '[Jimeng] Processing reference images in order:',
          params.referenceImages.map((url, i) => ({
            index: i,
            isBase64: url.startsWith('data:'),
            isFileUrl: url.startsWith('file://') || url.startsWith('juhe-image://'),
            isHttpUrl: url.startsWith('http://') || url.startsWith('https://'),
            length: url.length
          }))
        )

        const base64List: string[] = []
        const imageUrls: string[] = []

        for (let index = 0; index < params.referenceImages.length; index++) {
          const url = params.referenceImages[index]
          if (url.startsWith('data:')) {
            // 提取base64，优先使用binary_data_base64
            const match = url.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/)
            if (match) {
              base64List.push(match[2])
              console.log(
                `[Jimeng] Reference image [${index}]: extracted base64, mimeType:`,
                match[1],
                'length:',
                match[2].length
              )
            } else {
              console.error(`[Jimeng] Reference image [${index}]: invalid data URL, falling back to local server`)
              imageUrls.push(await saveBase64ToLocalServer(url))
            }
          } else if (url.startsWith('file://') || url.startsWith('juhe-image://')) {
            // 读取文件转为base64，优先使用binary_data_base64
            try {
              const filePath = url.startsWith('file://')
                ? decodeURIComponent(url.slice(7))
                : url.slice('juhe-image://'.length)
              // Validate path stays within userData to prevent path traversal
              const resolvedRefPath = require('node:path').resolve(filePath)
              const userDataDirRef = require('electron').app.getPath('userData')
              if (!resolvedRefPath.startsWith(userDataDirRef + require('node:path').sep) && resolvedRefPath !== userDataDirRef) {
                throw new Error(`Access denied: ${filePath} is outside user data directory`)
              }
              const fileData = readFileSync(resolvedRefPath)
              const base64 = fileData.toString('base64')
              base64List.push(base64)
              console.log(
                `[Jimeng] Reference image [${index}]: converted file to base64, path:`,
                filePath,
                'size:',
                fileData.length,
                'base64Length:',
                base64.length
              )
            } catch (err) {
              console.error(
                `[Jimeng] Reference image [${index}]: failed to read file, falling back to local server:`,
                err
              )
              imageUrls.push(await saveBase64ToLocalServer(url))
            }
          } else {
            // 已经是外部URL，直接使用
            imageUrls.push(url)
            console.log(`[Jimeng] Reference image [${index}]: using external URL:`, url.slice(0, 100))
          }
        }

        // 优先使用 binary_data_base64（避免局域网IP问题）
        if (base64List.length > 0) {
          payload.binary_data_base64 = base64List
          console.log('[Jimeng] Using binary_data_base64 for', reqKey, ', count:', base64List.length)
        }
        // 同时设置 image_urls（兼容文档要求）
        if (imageUrls.length > 0) {
          payload.image_urls = imageUrls
          console.log('[Jimeng] Using image_urls for', reqKey, ', count:', imageUrls.length)
        }

        // 检查是否有局域网URL，即梦服务器无法访问内网IP
        const privateIpPatterns = [
          /^http:\/\/10\./,
          /^http:\/\/172\.(1[6-9]|2[0-9]|3[01])\./,
          /^http:\/\/192\.168\./,
          /^http:\/\/127\./,
          /^http:\/\/localhost[:/]/
        ]
        const hasPrivateUrl = imageUrls.some((url) => privateIpPatterns.some((p) => p.test(url)))
        if (hasPrivateUrl) {
          console.warn(
            '[Jimeng] WARNING: Some reference images use private IP URLs. Jimeng server cannot access LAN addresses.'
          )
          console.warn('[Jimeng] binary_data_base64 is used as primary method. If it fails, try:')
          console.warn('[Jimeng]   1) Use ngrok/cloudflare tunnel to expose local server to public internet')
          console.warn('[Jimeng]   2) Upload images to cloud storage (OSS/COS) first')
        }

        // 参考图融合模式（如果用户选择了）
        if (params.referenceMode) {
          const modeMap: Record<string, string> = {
            fusion: 'fusion',
            controlnet: 'controlnet',
            ipadapter: 'ipadapter'
          }
          payload.reference_mode = modeMap[params.referenceMode] || 'fusion'
          console.log('[Jimeng] Reference mode:', payload.reference_mode)
        }

        // 4.0 uses scale float (0-1), 4.6 uses scale int (1-100)
        if (reqKey === 'jimeng_seedream46_cvtob') {
          // 4.6: scale is int 1-100
          const scaleValue =
            params.referenceWeights && params.referenceWeights.length > 0
              ? Math.round(params.referenceWeights[0] * 100)
              : params.referenceWeight !== undefined
                ? Math.round(params.referenceWeight * 100)
                : 50
          payload.scale = Math.max(1, Math.min(100, scaleValue))
          console.log('[Jimeng] Reference scale (4.6 int):', payload.scale)
        } else {
          // 4.0: scale is float 0-1
          const scaleValue =
            params.referenceWeights && params.referenceWeights.length > 0
              ? params.referenceWeights[0]
              : params.referenceWeight !== undefined
                ? params.referenceWeight
                : 0.5
          payload.scale = scaleValue
          console.log('[Jimeng] Reference scale (4.0 float):', payload.scale)
        }
      } else {
        console.log('[Jimeng] No reference images for', reqKey)
      }

      // 4.0/4.6 通用可选参数
      if (params.forceSingle !== undefined) {
        payload.force_single = params.forceSingle
      }
      if (params.minRatio !== undefined) {
        payload.min_ratio = params.minRatio
      }
      if (params.maxRatio !== undefined) {
        payload.max_ratio = params.maxRatio
      }
      // 4.0/4.6 支持传 int 面积值 (size 字段)
      if (params.imageArea !== undefined) {
        payload.size = params.imageArea
      }
    }
  }

  // 图生图参数
  if (reqKey === 'jimeng_i2i_v30') {
    const sizeMap = getSizeMap(reqKey)
    if (params.aspectRatio && sizeMap[params.aspectRatio]) {
      const size = sizeMap[params.aspectRatio]
      payload.width = size.width
      payload.height = size.height
    } else if (params.size) {
      const [w, h] = params.size.split('x').map(Number)
      if (!Number.isNaN(w) && !Number.isNaN(h)) {
        payload.width = w
        payload.height = h
      }
    }
    // 图生图3.0支持 binary_data_base64 直接上传，无需本地服务器
    // 文档: binary_data_base64 和 image_urls 二选一
    if (params.referenceImages && params.referenceImages.length > 0) {
      const base64List: string[] = []
      const urlList: string[] = []

      for (const url of params.referenceImages.slice(0, 1)) {
        // 只传1张
        console.log('[Jimeng] Processing i2i reference image:', {
          urlPrefix: url.slice(0, 30),
          isDataUrl: url.startsWith('data:'),
          isFileUrl: url.startsWith('file://') || url.startsWith('juhe-image://'),
          isHttpUrl: url.startsWith('http://') || url.startsWith('https://'),
          length: url.length
        })
        if (url.startsWith('data:')) {
          // 更宽松的正则匹配各种 image/* 格式
          const match = url.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/)
          if (match) {
            base64List.push(match[2])
            console.log(
              '[Jimeng] Extracted base64 from data URL for i2i, mimeType:',
              match[1],
              'base64Length:',
              match[2].length
            )
          } else {
            console.error('[Jimeng] Invalid data URL format for i2i, url prefix:', url.slice(0, 50))
          }
        } else if (url.startsWith('file://') || url.startsWith('juhe-image://')) {
          try {
            const filePath = url.startsWith('file://')
              ? decodeURIComponent(url.slice(7))
              : url.slice('juhe-image://'.length)
            // Validate path stays within userData to prevent path traversal
            const resolvedI2IPath = require('node:path').resolve(filePath)
            const userDataDirI2I = require('electron').app.getPath('userData')
            if (!resolvedI2IPath.startsWith(userDataDirI2I + require('node:path').sep) && resolvedI2IPath !== userDataDirI2I) {
              throw new Error(`Access denied: ${filePath} is outside user data directory`)
            }
            const fileData = readFileSync(resolvedI2IPath)
            const base64 = fileData.toString('base64')
            base64List.push(base64)
            console.log(
              '[Jimeng] Converted file to base64 for i2i:',
              filePath,
              'fileSize:',
              fileData.length,
              'base64Length:',
              base64.length
            )
          } catch (err) {
            console.error('[Jimeng] Failed to read file for i2i:', err)
          }
        } else {
          // 已经是URL，收集到urlList
          urlList.push(url)
          console.log('[Jimeng] Collected external URL for i2i:', url.slice(0, 100))
        }
      }

      // 二选一: 优先使用 binary_data_base64
      if (base64List.length > 0) {
        payload.binary_data_base64 = base64List
        // 确保不设置 image_urls
        delete payload.image_urls
        console.log(
          '[Jimeng] Set binary_data_base64 for i2i, count:',
          base64List.length,
          'firstItemLength:',
          base64List[0]?.length
        )
      } else if (urlList.length > 0) {
        payload.image_urls = urlList
        console.log('[Jimeng] Set image_urls for i2i, count:', urlList.length)
      } else {
        console.warn('[Jimeng] No valid reference images processed for i2i')
      }
    } else {
      console.log('[Jimeng] No reference images for i2i')
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    // scale: 编辑强度 0-1
    if (params.referenceWeight !== undefined) {
      payload.scale = params.referenceWeight
    }
    // 风格参数
    if (params.style) {
      payload.style = params.style
    }
    // 画质参数
    if (params.quality) {
      const qualityMap: Record<string, string> = {
        standard: 'standard',
        hd: 'high',
        high: 'high',
        medium: 'standard',
        low: 'standard'
      }
      payload.quality = qualityMap[params.quality] || params.quality
    }
  }

  // 文生/图生视频 3.0 Pro 参数
  if (reqKey === 'jimeng_ti2v_v30_pro') {
    if (params.aspectRatio && VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]) {
      payload.aspect_ratio = VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    // 帧数: 121=5s, 241=10s
    if (params.duration) {
      const frames = getFrameCount(params.duration)
      payload.frames = frames
    }
    // 传图 = 图生视频
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.image_urls = [await saveBase64ToLocalServer(params.referenceImages[0])]
    } else if (params.firstFrame) {
      payload.image_urls = [await saveBase64ToLocalServer(params.firstFrame)]
    }
  }

  // 图生视频 S2.0 Pro 参数
  if (reqKey === 'jimeng_vgfm_i2v_l20') {
    if (params.aspectRatio && VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]) {
      payload.aspect_ratio = VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    // 必须传图
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.image_urls = [await saveBase64ToLocalServer(params.referenceImages[0])]
    } else if (params.firstFrame) {
      payload.image_urls = [await saveBase64ToLocalServer(params.firstFrame)]
    }
  }

  // ===== 视频生成 720P 文生视频 =====
  if (reqKey === 'jimeng_t2v_v30') {
    if (params.aspectRatio && VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]) {
      payload.aspect_ratio = VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    // 帧数: 121=5s, 241=10s
    if (params.duration) {
      payload.frames = getFrameCount(params.duration)
    }
  }

  // ===== 视频生成 720P 图生视频-首帧 =====
  if (reqKey === 'jimeng_i2v_first_v30') {
    if (params.aspectRatio && VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]) {
      payload.aspect_ratio = VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    if (params.duration) {
      payload.frames = getFrameCount(params.duration)
    }
    // 必须传1张图
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.referenceImages[0])]
    } else if (params.firstFrame) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.firstFrame)]
    }
  }

  // ===== 视频生成 720P 图生视频-首尾帧 =====
  if (reqKey === 'jimeng_i2v_first_tail_v30') {
    if (params.aspectRatio && VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]) {
      payload.aspect_ratio = VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    if (params.duration) {
      payload.frames = getFrameCount(params.duration)
    }
    // 必须传2张图（首帧+尾帧）
    if (params.referenceImages && params.referenceImages.length >= 2) {
      payload.binary_data_base64 = [
        await extractBase64FromUrl(params.referenceImages[0]),
        await extractBase64FromUrl(params.referenceImages[1])
      ]
    } else if (params.firstFrame && params.lastFrame) {
      payload.binary_data_base64 = [
        await extractBase64FromUrl(params.firstFrame),
        await extractBase64FromUrl(params.lastFrame)
      ]
    }
  }

  // ===== 视频生成 720P 图生视频-运镜 =====
  if (reqKey === 'jimeng_i2v_recamera_v30') {
    if (params.aspectRatio && VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]) {
      payload.aspect_ratio = VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    if (params.duration) {
      payload.frames = getFrameCount(params.duration)
    }
    // 运镜模板ID
    if (params.cameraMotion) {
      payload.template_id = params.cameraMotion
    }
    // 运镜强度 (必选): weak, medium, strong
    if (params.cameraStrength) {
      payload.camera_strength = params.cameraStrength
    } else {
      payload.camera_strength = 'medium'
    }
    // 必须传1张图
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.referenceImages[0])]
    } else if (params.firstFrame) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.firstFrame)]
    }
  }

  // ===== 视频生成 1080P 文生视频 =====
  if (reqKey === 'jimeng_t2v_v30_1080p') {
    if (params.aspectRatio && VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]) {
      payload.aspect_ratio = VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    if (params.duration) {
      payload.frames = getFrameCount(params.duration)
    }
  }

  // ===== 视频生成 1080P 图生视频-首帧 =====
  if (reqKey === 'jimeng_i2v_first_v30_1080') {
    if (params.aspectRatio && VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]) {
      payload.aspect_ratio = VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    if (params.duration) {
      payload.frames = getFrameCount(params.duration)
    }
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.referenceImages[0])]
    } else if (params.firstFrame) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.firstFrame)]
    }
  }

  // ===== 视频生成 1080P 图生视频-首尾帧 =====
  if (reqKey === 'jimeng_i2v_first_tail_v30_1080') {
    if (params.aspectRatio && VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]) {
      payload.aspect_ratio = VIDEO_ASPECT_RATIO_MAP[params.aspectRatio]
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    if (params.duration) {
      payload.frames = getFrameCount(params.duration)
    }
    if (params.referenceImages && params.referenceImages.length >= 2) {
      payload.binary_data_base64 = [
        await extractBase64FromUrl(params.referenceImages[0]),
        await extractBase64FromUrl(params.referenceImages[1])
      ]
    } else if (params.firstFrame && params.lastFrame) {
      payload.binary_data_base64 = [
        await extractBase64FromUrl(params.firstFrame),
        await extractBase64FromUrl(params.lastFrame)
      ]
    }
  }

  // ===== 智能扩图 outpainting =====
  if (reqKey === 'jimeng_img2img_seed3_painting_edit') {
    // 扩图方向参数 (0-1)
    if (params.outpaintTop !== undefined) payload.top = params.outpaintTop
    if (params.outpaintBottom !== undefined) payload.bottom = params.outpaintBottom
    if (params.outpaintLeft !== undefined) payload.left = params.outpaintLeft
    if (params.outpaintRight !== undefined) payload.right = params.outpaintRight
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    // 扩图提示词（可选）
    if (params.prompt) {
      payload.prompt = params.prompt
    }
    // 传1张图（普通扩图）或2张图（画布扩展：原图+mask）
    if (params.referenceImages && params.referenceImages.length > 0) {
      const imgs = params.referenceImages.slice(0, 2)
      payload.binary_data_base64 = await Promise.all(imgs.map(extractBase64FromUrl))
    }
  }

  // ===== 智能超清 =====
  if (reqKey === 'jimeng_i2i_seed3_tilesr_cvtob') {
    // 分辨率: 4k 或 8k
    if (params.resolution) {
      payload.resolution = params.resolution
    }
    // 细节生成程度 scale: 0-100
    if (params.superResolutionScale !== undefined) {
      payload.scale = Math.max(0, Math.min(100, params.superResolutionScale))
    }
    // 传1张图
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.referenceImages[0])]
    } else if (params.firstFrame) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.firstFrame)]
    }
  }

  // ===== 交互编辑 inpainting =====
  if (reqKey === 'jimeng_image2image_dream_inpaint') {
    // 交互编辑默认seed为101
    const seed = params.seed !== undefined ? clampJimengSeed(params.seed) : 101
    payload.seed = seed
    // 传2张图: 原图 + mask图
    if (params.referenceImages && params.referenceImages.length >= 2) {
      payload.binary_data_base64 = [
        await extractBase64FromUrl(params.referenceImages[0]),
        await extractBase64FromUrl(params.referenceImages[1])
      ]
    }
    // prompt 必选
    if (params.prompt) {
      payload.prompt = params.prompt
    }
  }

  // ===== 素材提取-商品提取 =====
  if (reqKey === 'jimeng_i2i_extract_tiled_images') {
    // 编辑指令: 提取全身衣服/提取鞋子/提取包包等
    if (params.editPrompt) {
      payload.edit_prompt = params.editPrompt
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    if (params.size) {
      const [w, h] = params.size.split('x').map(Number)
      if (!Number.isNaN(w) && !Number.isNaN(h)) {
        payload.width = w
        payload.height = h
      }
    }
    // 传1张图
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.referenceImages[0])]
    } else if (params.firstFrame) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.firstFrame)]
    }
  }

  // ===== 素材提取-POD按需定制 =====
  if (reqKey === 'i2i_material_extraction') {
    if (params.editPrompt) {
      payload.image_edit_prompt = params.editPrompt
    }
    if (params.loraWeight !== undefined) {
      payload.lora_weight = params.loraWeight
    }
    const seed = clampJimengSeed(params.seed)
    if (seed !== undefined) {
      payload.seed = seed
    }
    if (params.size) {
      const [w, h] = params.size.split('x').map(Number)
      if (!Number.isNaN(w) && !Number.isNaN(h)) {
        payload.width = w
        payload.height = h
      }
    }
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.referenceImages[0])]
    } else if (params.firstFrame) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.firstFrame)]
    }
  }

  // ===== 动作模仿 =====
  if (reqKey === 'jimeng_dream_actor_m1_gen_video_cv') {
    // 需要视频URL + 图片URL
    if (params.videoUrl) {
      payload.video_url = params.videoUrl
    }
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.image_url = params.referenceImages[0]
    } else if (params.firstFrame) {
      payload.image_url = params.firstFrame
    }
  }

  // ===== 动作模仿2.0 =====
  if (reqKey === 'jimeng_dreamactor_m20_gen_video') {
    if (params.videoUrl) {
      payload.video_url = params.videoUrl
    }
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.referenceImages[0])]
    } else if (params.firstFrame) {
      payload.binary_data_base64 = [await extractBase64FromUrl(params.firstFrame)]
    }
    if (params.cutResultFirstSecond !== undefined) {
      payload.cut_result_first_second_switch = params.cutResultFirstSecond
    }
  }

  // ===== 小云雀-营销成片Agent =====
  if (reqKey === 'pippit_iv2v_cvtob_master') {
    if (params.productName) {
      payload.product_name = params.productName
    }
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.product_img_url_list = params.referenceImages.slice(0, 5)
    }
    if (params.modelImages && params.modelImages.length > 0) {
      payload.model_img_url_list = params.modelImages.slice(0, 5)
    }
  }

  // ===== 小云雀-智能生视频Agent 2.0 无参考 =====
  if (reqKey === 'pippit_iv2v_v20_cvtob') {
    if (params.aspectRatio) {
      payload.ratio = params.aspectRatio
    }
    if (params.duration) {
      payload.duration = params.duration
    }
    if (params.language) {
      payload.language = params.language
    }
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.img_url_list = params.referenceImages.slice(0, 50)
    }
    if (params.enableWatermark !== undefined) {
      payload.enable_watermark = params.enableWatermark
    }
  }

  // ===== 小云雀-智能生视频Agent 2.0 有参考 =====
  if (reqKey === 'pippit_iv2v_v20_cvtob_with_vinput') {
    if (params.aspectRatio) {
      payload.ratio = params.aspectRatio
    }
    if (params.duration) {
      payload.duration = params.duration
    }
    if (params.language) {
      payload.language = params.language
    }
    if (params.referenceImages && params.referenceImages.length > 0) {
      payload.img_url_list = params.referenceImages.slice(0, 50)
    }
    if (params.videoUrls && params.videoUrls.length > 0) {
      payload.video_url_list = params.videoUrls.slice(0, 10)
    }
    if (params.enableWatermark !== undefined) {
      payload.enable_watermark = params.enableWatermark
    }
  }

  return payload
}

/**
 * Jimeng 统一执行器
 * 根据 params.model 区分功能（文生图/图生图/文生视频/图生视频）
 */
export async function executeJimengGeneration(task: GenerationTask): Promise<void> {
  const { params } = task
  const startTime = Date.now()

  if (!params.providerId || !params.model) {
    throw new Error('ERR_NO_PROVIDER_MODEL: Please select a provider and model first')
  }

  let funcConfig = JIMENG_FUNCTION_MAP[params.model]
  if (!funcConfig) {
    throw new Error(`ERR_UNSUPPORTED_JIMENG_MODEL: Unsupported Jimeng model: ${params.model}`)
  }

  // 文生图3.0/3.1不支持参考图，如果有参考图则自动切换到图生图3.0
  const hasReferenceImages = !!(params.referenceImages && params.referenceImages.length > 0)
  const hasFirstFrame = !!params.firstFrame
  if (
    (params.model === 'jimeng-t2i-v30' || params.model === 'jimeng-t2i-v31') &&
    (hasReferenceImages || hasFirstFrame)
  ) {
    console.log('[Jimeng] Auto-switching to img2img because reference images are provided:', {
      fromModel: params.model,
      toModel: 'jimeng-i2i-v30',
      hasReferenceImages,
      hasFirstFrame
    })
    funcConfig = JIMENG_FUNCTION_MAP['jimeng-i2i-v30']
  }

  // 获取 AK/SK
  const credentials = await getProviderCredentials(params.providerId)
  if (!credentials) {
    throw new Error(
      '即梦API密钥未配置，请在设置中填写Access Key ID和Secret Access Key'
    )
  }

  console.log('[Jimeng] Execute start:', {
    taskId: task.id,
    model: params.model,
    reqKey: funcConfig.reqKey,
    outputType: funcConfig.outputType,
    prompt: params.prompt,
    promptLength: params.prompt?.length,
    hasReferenceImages: !!params.referenceImages?.length,
    referenceImageCount: params.referenceImages?.length ?? 0,
    referenceImagesSample: params.referenceImages?.map((url, i) => ({
      index: i,
      isBase64: url.startsWith('data:'),
      isFileUrl: url.startsWith('file://') || url.startsWith('juhe-image://'),
      isHttpUrl: url.startsWith('http://') || url.startsWith('https://'),
      length: url.length
    })),
    hasFirstFrame: !!params.firstFrame,
    aspectRatio: params.aspectRatio,
    size: params.size,
    seed: params.seed,
    duration: params.duration
  })

  // 重试场景：已有 externalTaskId 直接查询
  let taskId: string
  if (task.externalTaskId && task.externalProvider === 'jimeng') {
    taskId = task.externalTaskId
    console.log('[Jimeng] Retry mode, using existing taskId:', taskId)
    task.stage = 'queued'
    task.progress = 20
  } else {
    // 新任务：构建请求体并提交
    task.stage = 'submitting'
    task.progress = 10

    const payload = await buildJimengPayload(funcConfig.reqKey, params)
    console.log('[Jimeng] Submit payload:', {
      reqKey: funcConfig.reqKey,
      prompt: payload.prompt,
      promptLength: typeof payload.prompt === 'string' ? payload.prompt.length : 0,
      width: payload.width,
      height: payload.height,
      aspect_ratio: payload.aspect_ratio,
      frames: payload.frames,
      hasImageUrls: !!payload.image_urls,
      imageUrlsCount: Array.isArray(payload.image_urls) ? payload.image_urls.length : 0,
      hasBinaryData: !!payload.binary_data_base64,
      binaryDataCount: Array.isArray(payload.binary_data_base64) ? payload.binary_data_base64.length : 0,
      binaryDataSample:
        Array.isArray(payload.binary_data_base64) && payload.binary_data_base64.length > 0
          ? `${(payload.binary_data_base64 as string[])[0].slice(0, 50)}...(${(payload.binary_data_base64 as string[])[0].length} chars)`
          : undefined,
      seed: payload.seed,
      scale: payload.scale,
      style: payload.style,
      quality: payload.quality,
      reference_mode: payload.reference_mode
    })

    taskId = await submitJimengTask(credentials.accessKeyId, credentials.secretAccessKey, funcConfig.reqKey, payload)

    console.log('[Jimeng] Submitted successfully:', { taskId, reqKey: funcConfig.reqKey })
    task.externalTaskId = taskId
    task.externalProvider = 'jimeng'

    task.stage = 'queued'
    task.progress = 20
  }

  // 轮询获取结果
  const maxAttempts = funcConfig.outputType === 'video' ? 120 : 60
  try {
    await pollJimengTask(task, credentials, funcConfig.reqKey, funcConfig.outputType, taskId, maxAttempts, 5000)
    console.log('[Jimeng] Execute completed:', {
      taskId: task.id,
      externalTaskId: taskId,
      duration: `${Date.now() - startTime}ms`,
      outputCount: task.outputs.length,
      outputs: task.outputs.map((o) => ({
        type: o.type,
        hasUrl: !!o.url,
        hasBase64: !!o.base64,
        mediaType: o.mediaType
      }))
    })
  } catch (err) {
    console.error('[Jimeng] Execute failed:', {
      taskId: task.id,
      externalTaskId: taskId,
      duration: `${Date.now() - startTime}ms`,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    })
    throw err
  }
}

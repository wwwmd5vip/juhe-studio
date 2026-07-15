import type { GenerationParams, GenerationTask, GenerationOutput } from './generation'

// ── Provider 元数据 ──

/** Provider 支持的生成模式 */
export type ProviderGenerationMode = 'image' | 'video' | 'audio'

/** Provider 认证方式 */
export type ProviderAuthType =
  | 'api-key'      // 单一 Bearer token / API Key
  | 'dual-key'     // AccessKey + SecretKey（火山引擎 HMAC）
  | 'oauth'        // OAuth 2.0（预留）

/** Provider 能力声明 */
export interface ProviderCapabilityDeclaration {
  /** 支持的模型 ID 列表（空 = 支持该 Provider 下所有模型） */
  modelIds?: string[]
  /** 支持的生成模式 */
  modes: ProviderGenerationMode[]
  /** 是否支持异步提交+轮询 */
  supportsAsync: boolean
  /** 是否支持同步直接返回 */
  supportsSync: boolean
  /** 是否支持参考图 */
  supportsReferenceImage: boolean
}

// ── Provider 接口 ──

/** 提交生成任务的结果 */
export interface ProviderSubmitResult {
  /** Provider 侧的任务 ID（可选，用于后续轮询） */
  externalTaskId?: string
  /** 如果是同步 Provider，直接返回结果 */
  outputs?: GenerationOutput[]
}

/** 轮询任务状态的结果 */
export interface ProviderPollResult {
  /** 任务是否已完成 */
  done: boolean
  /** 如果已完成，返回输出 */
  outputs?: GenerationOutput[]
  /** Provider 原始错误信息 */
  error?: string
}

/** 参数校验结果 */
export interface ProviderValidateResult {
  valid: boolean
  errors: string[]
  /** 校验后规范化/补全的参数 */
  normalizedParams?: GenerationParams
}

// ── Provider 规范接口 ──

/**
 * Provider 规范接口 —— 所有图像/视频/音频 Provider 的抽象契约。
 *
 * 每个 Provider 实现声明自己支持的能力（capabilities），
 * 由工厂根据 capability 匹配路由，替代硬编码的 presetId 判断。
 */
export interface ImageProviderSpec {
  /** Provider 唯一标识（对应 providers.presetId 或自定义 key） */
  readonly providerId: string

  /** 能力声明 */
  readonly capabilities: ProviderCapabilityDeclaration

  /**
   * 校验参数是否被此 Provider 支持。
   * 返回规范化后的参数（补全默认值、转换格式等）。
   */
  validate(params: GenerationParams): Promise<ProviderValidateResult>

  /**
   * 提交生成任务（可能同步返回，也可能返回 externalTaskId 用于异步轮询）。
   * @param params 已通过 validate() 的参数
   * @param onProgress 进度回调（0–100）
   */
  submit(
    params: GenerationParams,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<ProviderSubmitResult>

  /**
   * 轮询异步任务状态。
   * @param externalTaskId submit() 返回的外部任务 ID
   */
  poll(externalTaskId: string): Promise<ProviderPollResult>

  /**
   * 取消正在进行的异步任务。
   * @param externalTaskId submit() 返回的外部任务 ID
   */
  cancel?(externalTaskId: string): Promise<void>

  /**
   * 检查此 Provider 是否支持给定的模式和模型。
   * BaseImageProvider 有默认实现，但接口也声明此方法供工厂调用。
   */
  supports(mode: ProviderGenerationMode, modelId?: string): boolean
}

// ── Provider 注册条目 ──

/** 工厂注册的单条 Provider 配置 */
export interface ProviderRegistration {
  /** 匹配条件：providers 表的 presetId */
  presetId: string
  /** 特定模型 ID 匹配（可选，用于同一 presetId 下不同模型走不同执行器） */
  modelIds?: string[]
  /** Provider 实例 */
  provider: ImageProviderSpec
}

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { JuheAPIError, JuheAuthError, JuheNetworkError, JuheRateLimitError } from './errors.js'
import { parseSSEStream } from './stream.js'
import type {
  ApiResponse,
  Channel,
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResponse,
  CreateTokenRequest,
  DailyBill,
  DashboardStats,
  DashboardTrendItem,
  ImageGenerationRequest,
  ImageGenerationResponse,
  Log,
  LoginCredentials,
  LoginResult,
  Model,
  ModelChannelInfo,
  MonthlyBill as MonthlyBillSummary,
  OpenAIModelList,
  PagedResponse,
  Pricing,
  Prompt,
  PromptCategory,
  PromptListItem,
  QuotaInfo,
  QuotaPackage,
  QuotaTransaction,
  Redemption,
  RenderPackageResponse,
  RenderPromptResponse,
  Setting,
  Subscription,
  SubscriptionPlan,
  Token,
  TopUp,
  UpdateTokenRequest,
  User,
  Vendor
} from './types.js'

export interface JuheClientOptions {
  /** Juhe Management server URL. Falls back to JUHE_API_URL env var. */
  baseURL?: string
  apiKey?: string
  adminToken?: string
  timeout?: number
}

export class JuheClient {
  private adminApi: AxiosInstance
  private relayApi: AxiosInstance
  private options: JuheClientOptions
  private maxRetries = 3
  private retryDelay = 1000

  constructor(options: JuheClientOptions) {
    this.options = options
    const resolvedBaseURL = options.baseURL || process.env.JUHE_API_URL
    if (!resolvedBaseURL) {
      throw new Error(
        'JuheClient: baseURL is required. Set it via constructor options or JUHE_API_URL environment variable.'
      )
    }
    const baseURL = resolvedBaseURL.replace(/\/$/, '')
    const timeout = options.timeout ?? 60000
    this.adminApi = axios.create({
      baseURL: `${baseURL}/api`,
      timeout
    })
    this.relayApi = axios.create({
      baseURL: `${baseURL}/v1`,
      timeout
    })

    this.adminApi.interceptors.request.use((config) => {
      if (options.adminToken && config.headers) {
        config.headers.Authorization = `Bearer ${options.adminToken}`
      }
      return config
    })

    this.relayApi.interceptors.request.use((config) => {
      if (options.apiKey && config.headers) {
        config.headers.Authorization = `Bearer ${options.apiKey}`
      }
      return config
    })

    // Add response interceptor for error normalization
    const errorInterceptor = (error: unknown) => {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const { status, data } = error.response
          if (status === 401) throw new JuheAuthError(data?.message)
          if (status === 429) throw new JuheRateLimitError(data?.message)
          throw new JuheAPIError(data?.message || error.message, data?.code || status, status)
        }
        if (error.request) {
          throw new JuheNetworkError('Network error: ' + error.message, error)
        }
      }
      throw new JuheNetworkError('Unknown error', error instanceof Error ? error : undefined)
    }
    this.adminApi.interceptors.response.use(undefined, errorInterceptor)
    this.relayApi.interceptors.response.use(undefined, errorInterceptor)
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof JuheRateLimitError) return true
    if (error instanceof JuheNetworkError) return true
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      return status === undefined || status >= 500 || status === 429
    }
    return false
  }

  private async retryRequest<T>(fn: () => Promise<T>, retries = this.maxRetries): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        if (attempt === retries || !this.shouldRetry(error)) throw error
        const delay = this.retryDelay * 2 ** attempt
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
    throw new Error('Unreachable')
  }

  // Admin API wrappers with retry
  private get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.adminApi.get<T>(url, config))
  }

  private post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.adminApi.post<T>(url, data, config))
  }

  private put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.adminApi.put<T>(url, data, config))
  }

  private del<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.adminApi.delete<T>(url, config))
  }

  // Relay API wrappers with retry
  private rget<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.relayApi.get<T>(url, config))
  }

  private rpost<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.relayApi.post<T>(url, data, config))
  }

  private unwrap<T>(res: AxiosResponse<ApiResponse<T>>, path: string): T {
    const body = res.data
    if (!body || typeof body !== 'object') {
      throw new JuheAPIError(`Unexpected response from ${path}`, -1, res.status)
    }
    if (body.code !== 0) {
      throw new JuheAPIError(body.message || 'Unknown error', body.code, res.status)
    }
    // Support DELETE / 204 where data is empty
    if (body.data === undefined || body.data === null) return undefined as unknown as T
    return body.data
  }

  // Auth / Admin

  async login(credentials: LoginCredentials): Promise<LoginResult> {
    return this.unwrap(await this.post<ApiResponse<LoginResult>>('/auth/login', credentials), 'login')
  }

  async getCaptcha(): Promise<{ captcha_id: string; image: string }> {
    return this.unwrap(await this.get<ApiResponse<{ captcha_id: string; image: string }>>('/auth/captcha'), 'getCaptcha')
  }

  async me(): Promise<User> {
    return this.unwrap(await this.get<ApiResponse<User>>('/auth/me'), 'me')
  }

  async createToken(data: CreateTokenRequest): Promise<Token> {
    return this.unwrap(await this.post<ApiResponse<Token>>('/tokens', data), 'createToken')
  }

  async listTokens(page = 1, pageSize = 20): Promise<PagedResponse<Token>> {
    return this.unwrap(
      await this.get<ApiResponse<PagedResponse<Token>>>(`/tokens?page=${page}&page_size=${pageSize}`),
      'listTokens'
    )
  }

  async getToken(id: number): Promise<Token> {
    return this.unwrap(await this.get<ApiResponse<Token>>(`/tokens/${id}`), 'getToken')
  }

  async updateToken(id: number, data: UpdateTokenRequest): Promise<Token> {
    return this.unwrap(await this.put<ApiResponse<Token>>(`/tokens/${id}`, data), 'updateToken')
  }

  async deleteToken(id: number): Promise<void> {
    await this.unwrap(await this.del<ApiResponse<unknown>>(`/tokens/${id}`), 'deleteToken')
  }

  // ── Admin: Users ──
  async listUsers(page = 1, pageSize = 20, keyword = ''): Promise<PagedResponse<User>> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<User>>>('/users', {
        params: { page, page_size: pageSize, keyword }
      }),
      'listUsers'
    )
  }
  async getUser(id: number): Promise<User> {
    return this.unwrap(await this.adminApi.get<ApiResponse<User>>(`/users/${id}`), 'getUser')
  }
  async createUser(data: {
    username: string
    password: string
    nickname?: string
    email?: string
    role?: number
    quota_total?: number
  }): Promise<User> {
    return this.unwrap(await this.adminApi.post<ApiResponse<User>>('/users', data), 'createUser')
  }
  async updateUser(
    id: number,
    data: { nickname?: string; email?: string; role?: number; status?: number; quota_total?: number }
  ): Promise<User> {
    return this.unwrap(await this.adminApi.put<ApiResponse<User>>(`/users/${id}`, data), 'updateUser')
  }
  async deleteUser(id: number): Promise<void> {
    await this.unwrap(await this.adminApi.delete<ApiResponse<unknown>>(`/users/${id}`), 'deleteUser')
  }
  async adjustUserQuota(id: number, amount: number): Promise<void> {
    await this.unwrap(
      await this.adminApi.post<ApiResponse<unknown>>(`/users/${id}/quota`, { amount }),
      'adjustUserQuota'
    )
  }

  // ── Admin: Models ──
  async listModelsAdmin(
    page = 1,
    pageSize = 20,
    keyword = '',
    type?: string,
    channelId?: number
  ): Promise<PagedResponse<Model>> {
    const params: Record<string, unknown> = { page, page_size: pageSize, keyword }
    if (type) params.type = type
    if (channelId) params.channel_id = channelId
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<Model>>>('/models', { params }),
      'listModelsAdmin'
    )
  }
  async getModelAdmin(id: number): Promise<Model> {
    return this.unwrap(await this.adminApi.get<ApiResponse<Model>>(`/models/${id}`), 'getModelAdmin')
  }
  async createModel(data: {
    model_name: string
    display_name?: string
    type: string
    capabilities?: string[]
    endpoints?: string[]
    match_rule?: number
    channel_ids?: number[]
    context_window?: number
    max_output_tokens?: number
  }): Promise<Model> {
    return this.unwrap(await this.adminApi.post<ApiResponse<Model>>('/models', data), 'createModel')
  }
  async updateModel(
    id: number,
    data: Partial<{
      model_name: string
      display_name: string
      type: string
      capabilities: string[]
      endpoints: string[]
      match_rule: number
      channel_ids: number[]
      context_window: number
      max_output_tokens: number
    }>
  ): Promise<Model> {
    return this.unwrap(await this.adminApi.put<ApiResponse<Model>>(`/models/${id}`, data), 'updateModel')
  }
  async deleteModel(id: number): Promise<void> {
    await this.unwrap(await this.adminApi.delete<ApiResponse<unknown>>(`/models/${id}`), 'deleteModel')
  }
  async listModelChannels(id: number): Promise<ModelChannelInfo[]> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<ModelChannelInfo[]>>(`/models/${id}/channels`),
      'listModelChannels'
    )
  }

  // ── Admin: Channels ──
  async listChannels(
    page = 1,
    pageSize = 20,
    keyword = '',
    type?: string,
    status?: number
  ): Promise<PagedResponse<Channel>> {
    const params: Record<string, unknown> = { page, page_size: pageSize, keyword }
    if (type) params.type = type
    if (status !== undefined) params.status = status
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<Channel>>>('/channels', { params }),
      'listChannels'
    )
  }
  async getChannel(id: number): Promise<Channel> {
    return this.unwrap(await this.adminApi.get<ApiResponse<Channel>>(`/channels/${id}`), 'getChannel')
  }
  async createChannel(data: {
    type: string
    name: string
    base_url?: string
    keys: string
    models?: string
    groups?: string
    auth_type?: string
    weight?: number
    priority?: number
    timeout_seconds?: number
    auto_ban?: boolean
    model_mapping?: Record<string, string>
    status_code_mapping?: Record<string, string>
  }): Promise<Channel> {
    return this.unwrap(await this.adminApi.post<ApiResponse<Channel>>('/channels', data), 'createChannel')
  }
  async updateChannel(
    id: number,
    data: Partial<{
      type: string
      name: string
      base_url: string
      keys: string
      models: string
      groups: string
      auth_type: string
      weight: number
      priority: number
      timeout_seconds: number
      auto_ban: boolean
      model_mapping: Record<string, string>
      status_code_mapping: Record<string, string>
    }>
  ): Promise<Channel> {
    return this.unwrap(await this.adminApi.put<ApiResponse<Channel>>(`/channels/${id}`, data), 'updateChannel')
  }
  async deleteChannel(id: number): Promise<void> {
    await this.unwrap(await this.adminApi.delete<ApiResponse<unknown>>(`/channels/${id}`), 'deleteChannel')
  }
  async testChannel(id: number): Promise<{ success: boolean; message: string }> {
    return this.unwrap(
      await this.adminApi.post<ApiResponse<{ success: boolean; message: string }>>(`/channels/${id}/test`),
      'testChannel'
    )
  }
  async fetchChannelModels(id: number): Promise<{ models: string[]; existing_types?: Record<string, string> }> {
    return this.unwrap(
      await this.adminApi.post<ApiResponse<{ models: string[]; existing_types?: Record<string, string> }>>(
        `/channels/${id}/fetch-models`
      ),
      'fetchChannelModels'
    )
  }

  // ── Admin: Pricing ──
  async listPricing(page = 1, pageSize = 20, modelName = '', group = ''): Promise<PagedResponse<Pricing>> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<Pricing>>>('/pricing', {
        params: { page, page_size: pageSize, model_name: modelName, group }
      }),
      'listPricing'
    )
  }
  async getPricing(id: number): Promise<Pricing> {
    return this.unwrap(await this.adminApi.get<ApiResponse<Pricing>>(`/pricing/${id}`), 'getPricing')
  }
  async createPricing(data: {
    model_name: string
    group?: string
    billing_mode: string
    model_ratio?: number
    completion_ratio?: number
    fixed_price_cents?: number
    tiered_expr?: string
    effective_from: string
  }): Promise<Pricing> {
    return this.unwrap(await this.adminApi.post<ApiResponse<Pricing>>('/pricing', data), 'createPricing')
  }
  async updatePricing(
    id: number,
    data: Partial<{
      model_name: string
      group: string
      billing_mode: string
      model_ratio: number
      completion_ratio: number
      fixed_price_cents: number
      tiered_expr: string
      effective_from: string
    }>
  ): Promise<Pricing> {
    return this.unwrap(await this.adminApi.put<ApiResponse<Pricing>>(`/pricing/${id}`, data), 'updatePricing')
  }
  async deletePricing(id: number): Promise<void> {
    await this.unwrap(await this.adminApi.delete<ApiResponse<unknown>>(`/pricing/${id}`), 'deletePricing')
  }

  // ── Admin: Tokens Admin ──
  async listTokensAdmin(page = 1, pageSize = 20, keyword = '', userId?: number): Promise<PagedResponse<Token>> {
    const params: Record<string, unknown> = { page, page_size: pageSize, keyword }
    if (userId) params.user_id = userId
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<Token>>>('/tokens', { params }),
      'listTokensAdmin'
    )
  }

  // ── Admin: Dashboard ──
  async getDashboardStats(): Promise<DashboardStats> {
    return this.unwrap(await this.adminApi.get<ApiResponse<DashboardStats>>('/dashboard/stats'), 'getDashboardStats')
  }
  async getDashboardTrends(days = 30): Promise<DashboardTrendItem[]> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<DashboardTrendItem[]>>('/dashboard/trends', { params: { days } }),
      'getDashboardTrends'
    )
  }

  // ── Admin: Logs ──
  async listLogs(
    params: {
      page?: number
      page_size?: number
      user_id?: number
      model_name?: string
      log_type?: string
      status_code?: string
      channel_id?: number
      start_date?: string
      end_date?: string
    } = {}
  ): Promise<PagedResponse<Log>> {
    return this.unwrap(await this.adminApi.get<ApiResponse<PagedResponse<Log>>>('/logs', { params }), 'listLogs')
  }

  // ── Admin: TopUps ──
  async listTopUps(page = 1, pageSize = 20): Promise<PagedResponse<TopUp>> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<TopUp>>>('/topups', { params: { page, page_size: pageSize } }),
      'listTopUps'
    )
  }

  // ── Admin: Redemptions ──
  async listRedemptions(page = 1, pageSize = 20): Promise<PagedResponse<Redemption>> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<Redemption>>>('/redemptions', {
        params: { page, page_size: pageSize }
      }),
      'listRedemptions'
    )
  }
  async generateRedemptions(data: { quota_amount: number; max_uses?: number; count?: number }): Promise<Redemption[]> {
    return this.unwrap(await this.adminApi.post<ApiResponse<Redemption[]>>('/redemptions', data), 'generateRedemptions')
  }

  // ── Admin: QuotaPackages ──
  async listQuotaPackages(page = 1, pageSize = 20): Promise<PagedResponse<QuotaPackage>> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<QuotaPackage>>>('/quota-packages', {
        params: { page, page_size: pageSize }
      }),
      'listQuotaPackages'
    )
  }

  // ── Admin: DailyBills ──
  async listDailyBills(page = 1, pageSize = 20): Promise<PagedResponse<DailyBill>> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<DailyBill>>>('/daily-bills', {
        params: { page, page_size: pageSize }
      }),
      'listDailyBills'
    )
  }
  async listMonthlyBills(
    page = 1,
    pageSize = 20,
    startMonth?: string,
    endMonth?: string
  ): Promise<PagedResponse<MonthlyBillSummary>> {
    const params: Record<string, unknown> = { page, page_size: pageSize }
    if (startMonth) params.start_month = startMonth
    if (endMonth) params.end_month = endMonth
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<MonthlyBillSummary>>>('/daily-bills/monthly', { params }),
      'listMonthlyBills'
    )
  }

  // ── Admin: QuotaTransactions ──
  async listQuotaTransactions(page = 1, pageSize = 20): Promise<PagedResponse<QuotaTransaction>> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<QuotaTransaction>>>('/quota-transactions', {
        params: { page, page_size: pageSize }
      }),
      'listQuotaTransactions'
    )
  }

  // ── Admin: Subscriptions ──
  async listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<SubscriptionPlan[]>>('/subscriptions/plans'),
      'listSubscriptionPlans'
    )
  }
  async listUserSubscriptions(page = 1, pageSize = 20): Promise<PagedResponse<Subscription>> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<Subscription>>>('/subscriptions', {
        params: { page, page_size: pageSize }
      }),
      'listUserSubscriptions'
    )
  }

  // ── Admin: Prompts ──
  async listPromptsAdmin(page = 1, pageSize = 20, keyword = ''): Promise<PagedResponse<Prompt>> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<Prompt>>>('/prompts', {
        params: { page, page_size: pageSize, keyword }
      }),
      'listPromptsAdmin'
    )
  }
  async createPrompt(data: Partial<Prompt>): Promise<Prompt> {
    return this.unwrap(await this.adminApi.post<ApiResponse<Prompt>>('/prompts', data), 'createPrompt')
  }
  async updatePrompt(id: number, data: Partial<Prompt>): Promise<Prompt> {
    return this.unwrap(await this.adminApi.put<ApiResponse<Prompt>>(`/prompts/${id}`, data), 'updatePrompt')
  }
  async deletePrompt(id: number): Promise<void> {
    await this.unwrap(await this.adminApi.delete<ApiResponse<unknown>>(`/prompts/${id}`), 'deletePrompt')
  }

  // ── Admin: Settings ──
  async listSettings(page = 1, pageSize = 20): Promise<PagedResponse<Setting>> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<Setting>>>('/settings', {
        params: { page, page_size: pageSize }
      }),
      'listSettings'
    )
  }

  // ── Admin: Vendors ──
  async listVendors(page = 1, pageSize = 20): Promise<PagedResponse<Vendor>> {
    return this.unwrap(
      await this.adminApi.get<ApiResponse<PagedResponse<Vendor>>>('/vendors', {
        params: { page, page_size: pageSize }
      }),
      'listVendors'
    )
  }

  async listModels(): Promise<OpenAIModelList> {
    return this.unwrap(await this.rget<ApiResponse<OpenAIModelList>>('/models'), 'listModels')
  }

  // Relay: chat completions

  async chatCompletions(body: ChatCompletionRequest, config?: AxiosRequestConfig): Promise<ChatCompletionResponse> {
    return this.unwrap(
      await this.rpost<ApiResponse<ChatCompletionResponse>>('/chat/completions', body, config),
      'chatCompletions'
    )
  }

  async *streamChatCompletions(
    body: Omit<ChatCompletionRequest, 'stream'>,
    config?: AxiosRequestConfig
  ): AsyncGenerator<ChatCompletionChunk> {
    const baseUrl = (this.relayApi.defaults.baseURL || '').replace(/\/$/, '')
    const url = `${baseUrl}/chat/completions`
    const headers: Record<string, string> = {
      ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
      ...((config?.headers as Record<string, string>) || {})
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ ...body, stream: true })
    })
    yield* parseSSEStream(response)
  }

  // Relay: images

  async createImage(body: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    return this.unwrap(
      await this.rpost<ApiResponse<ImageGenerationResponse>>('/images/generations', body),
      'createImage'
    )
  }

  // Relay: quota

  async getQuota(): Promise<QuotaInfo> {
    return this.unwrap(await this.rget<ApiResponse<QuotaInfo>>('/quota'), 'getQuota')
  }

  // Relay: prompts

  async listPrompts(
    type: 'image' | 'agent' | 'package' = 'image',
    params?: { page?: number; page_size?: number; category_id?: number; tag?: string; keyword?: string }
  ): Promise<PagedResponse<PromptListItem>> {
    const query = new URLSearchParams({ type })
    if (params?.page) query.set('page', String(params.page))
    if (params?.page_size) query.set('page_size', String(params.page_size))
    if (params?.category_id) query.set('category_id', String(params.category_id))
    if (params?.tag) query.set('tag', params.tag)
    if (params?.keyword) query.set('keyword', params.keyword)
    return this.unwrap(
      await this.rget<ApiResponse<PagedResponse<PromptListItem>>>(`/prompts?${query.toString()}`),
      'listPrompts'
    )
  }

  async getPrompt(id: number): Promise<Prompt> {
    return this.unwrap(await this.rget<ApiResponse<Prompt>>(`/prompts/${id}`), 'getPrompt')
  }

  async listPromptCategories(type: 'image' | 'agent' | 'package' = 'image'): Promise<PagedResponse<PromptCategory>> {
    return this.unwrap(
      await this.rget<ApiResponse<PagedResponse<PromptCategory>>>(`/prompts/categories?type=${type}`),
      'listPromptCategories'
    )
  }

  async renderPrompt(id: number, variables: Record<string, string> = {}): Promise<string> {
    const res = await this.unwrap(
      await this.rpost<ApiResponse<RenderPromptResponse>>(`/prompts/${id}/render`, { variables }),
      'renderPrompt'
    )
    return res.content
  }

  async renderPackage(id: number, variables: Record<string, string> = {}): Promise<RenderPackageResponse['results']> {
    const res = await this.unwrap(
      await this.rpost<ApiResponse<RenderPackageResponse>>(`/prompts/${id}/render-package`, { variables }),
      'renderPackage'
    )
    return res.results
  }
}

export * from './types.js'

// ==================== Enums ====================

export type UserRole = 1 | 10 | 100 // user | admin | superadmin
export type UserStatus = 0 | 1 // disabled | active
export type TokenStatus = 0 | 1 // disabled | active
export type ChannelStatus = 0 | 1 | 2 // disabled | active | error

export type ChannelType =
  | 'openai'
  | 'openai-compatible'
  | 'azure'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'siliconflow'
  | 'volcengine'
  | 'zhipu'
  | 'qwen'
  | 'moonshot'
  | 'openrouter'
  | 'ollama'
  | 'vertex'
  | 'bedrock'
  | 'jimeng'
  | 'kling'
  | 'coze'
  | 'xai'
  | 'custom'

export type AuthType = 'api-key' | 'api-key-header' | 'oauth' | 'aws-sigv4' | 'gcp-sa'

export type BillingMode = 'token' | 'fixed' | 'tiered'
export type ModelType = 'llm' | 'image' | 'video' | 'audio' | 'embedding'
export type MatchRule = 0 | 1 | 2 | 3 // exact | prefix | suffix | contain
export type LogType = 'chat' | 'image' | 'audio' | 'embedding'
export type LogMode = 'stream' | 'non-stream'
export type PromptType = 'image' | 'agent' | 'package'
export type PromptStatus = 0 | 1 | 2 // draft | published | archived
export type QuotaTransactionType = 'recharge' | 'consume' | 'refund' | 'adjust' | 'freeze' | 'unfreeze'
export type TopUpStatus = 0 | 1 | 2 | 3 // pending | success | failed | refunded
export type RedemptionStatus = 0 | 1 // unused | used
export type SubscriptionStatus = 0 | 1 | 2 | 3 // inactive | active | cancelled | expired
export type SettingType = 'string' | 'json' | 'bool' | 'number'

// ==================== API Response ====================

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data?: T
}

export interface Pagination {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface PagedResponse<T> {
  data: T[]
  pagination: Pagination
}

// ==================== Auth ====================

export interface LoginCredentials {
  username: string
  password: string
  captcha_id?: string
  captcha_code?: string
}

export interface LoginResult {
  token: string
  expires_at: string
  user: User
}

export interface UpdatePasswordRequest {
  old_password: string
  new_password: string
}

// ==================== User ====================

export interface User {
  id: number
  username: string
  email?: string
  role: UserRole
  status: UserStatus
  group: string
  quota: number
  used_quota: number
  created_at: string
  updated_at: string
}

export interface CreateUserRequest {
  username: string
  email?: string
  password: string
  role: UserRole
  group?: string
}

export interface UpdateUserRequest {
  email?: string
  role?: UserRole
  status?: UserStatus
  group?: string
  quota?: number
}

export interface AdjustQuotaRequest {
  amount: number
  description?: string
}

export interface BatchDeleteUsersRequest {
  ids: number[]
}

export interface BatchUpdateStatusRequest {
  ids: number[]
  status: UserStatus
}

// ==================== Token ====================

export interface Token {
  id: number
  user_id: number
  name: string
  key?: string // only returned on creation
  key_mask: string
  status: TokenStatus
  remain_quota: number
  unlimited_quota: boolean
  model_limits_enabled: boolean
  model_limits?: string[]
  group: string
  cross_group_retry: boolean
  allowed_ips?: string
  rate_limit: number
  last_used_at?: string
  created_at: string
  updated_at: string
}

export interface CreateTokenRequest {
  name: string
  remain_quota?: number
  unlimited_quota?: boolean
  group?: string
  model_limits?: string[]
}

export interface UpdateTokenRequest {
  name?: string
  status?: TokenStatus
  remain_quota?: number
  unlimited_quota?: boolean
  group?: string
  model_limits?: string[]
}

export interface BatchDeleteTokensRequest {
  ids: number[]
}

// ==================== Channel ====================

export interface Channel {
  id: number
  type: ChannelType
  name: string
  base_url?: string
  auth_type: AuthType
  models: string
  groups: string
  weight: number
  priority: number
  status: ChannelStatus
  model_mapping?: Record<string, string>
  status_code_mapping?: Record<string, string>
  timeout_seconds: number
  auto_ban: boolean
  fail_count: number
  consecutive_failures: number
  last_error?: string
  last_checked_at?: string
  response_time_ms: number
  created_at: string
  updated_at: string
}

export interface CreateChannelRequest {
  type: ChannelType
  name: string
  base_url?: string
  auth_type?: AuthType
  keys: string
  models: string
  groups?: string
  weight?: number
  priority?: number
  model_mapping?: Record<string, string>
  status_code_mapping?: Record<string, string>
  timeout_seconds?: number
  auto_ban?: boolean
}

export interface UpdateChannelRequest {
  type?: ChannelType
  name?: string
  base_url?: string
  auth_type?: AuthType
  keys?: string
  models?: string
  groups?: string
  weight?: number
  priority?: number
  model_mapping?: Record<string, string>
  status_code_mapping?: Record<string, string>
  timeout_seconds?: number
  auto_ban?: boolean
  status?: ChannelStatus
}

export interface FetchUpstreamModelsResponse {
  fetched: number
  models: string[]
}

export interface PreviewUpstreamModelsResponse {
  models: string[]
  existing_types: Record<string, string>
}

export interface PreviewModelsFromConfigRequest {
  type: ChannelType
  base_url?: string
  keys: string
}

export interface TestChannelFromConfigRequest {
  type: ChannelType
  base_url?: string
  keys: string
  timeout_seconds?: number
}

export interface TestChannelFromConfigResponse {
  response_time_ms: number
}

export interface SyncUpstreamModelsRequest {
  models: SyncModelItem[]
}

export interface SyncModelItem {
  model_name: string
  type: ModelType
  capabilities?: string[]
  endpoints?: string[]
}

export interface SyncUpstreamModelsResponse {
  synced: number
  models: string[]
}

export interface ChannelTypeInfo {
  type: ChannelType
  default_url: string
  description?: string
}

// ==================== Model ====================

export interface Model {
  id: number
  model_name: string
  display_name?: string
  type: ModelType
  vendor_id?: number
  endpoints?: string[]
  capabilities?: string[]
  context_window: number
  max_output_tokens: number
  input_modalities?: string[]
  output_modalities?: string[]
  match_rule: MatchRule
  status: number
  created_at: string
  updated_at: string
}

export interface CreateModelRequest {
  model_name: string
  display_name?: string
  type: ModelType
  capabilities?: string[]
  channel_ids?: number[]
  endpoints?: string[]
  match_rule?: MatchRule
  context_window?: number
  max_output_tokens?: number
}

export interface UpdateModelRequest {
  display_name?: string
  type?: ModelType
  capabilities?: string[]
  channel_ids?: number[]
  endpoints?: string[]
  match_rule?: MatchRule
  context_window?: number
  max_output_tokens?: number
  status?: number
}

export interface ModelChannelInfo {
  id: number
  name: string
  type: ChannelType
  status: number
  base_url?: string
  group: string
}

// ==================== Vendor ====================

export interface Vendor {
  id: number
  name: string
  description?: string
  icon_url?: string
  created_at: string
  updated_at: string
}

export interface CreateVendorRequest {
  name: string
  description?: string
  icon_url?: string
}

export interface UpdateVendorRequest {
  name?: string
  description?: string
  icon_url?: string
}

// ==================== Pricing ====================

export interface Pricing {
  id: number
  model_name: string
  group: string
  billing_mode: BillingMode
  model_ratio: number
  completion_ratio: number
  fixed_price_cents?: number
  image_ratio: number
  tiered_expr?: string
  effective_from: string
  created_at: string
  updated_at: string
}

export interface CreatePricingRequest {
  model_name: string
  group?: string
  billing_mode: BillingMode
  model_ratio?: number
  completion_ratio?: number
  fixed_price_cents?: number
  image_ratio?: number
  tiered_expr?: string
  effective_from?: string
}

export interface UpdatePricingRequest {
  billing_mode?: BillingMode
  model_ratio?: number
  completion_ratio?: number
  fixed_price_cents?: number
  image_ratio?: number
  tiered_expr?: string
  effective_from?: string
}

// ==================== Log ====================

export interface Log {
  id: number
  user_id: number
  token_id?: number
  channel_id?: number
  model_name: string
  request_id: string
  type: LogType
  mode: LogMode
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  image_n: number
  quota_used: number
  quota_pre_consumed: number
  status_code: number
  upstream_status?: string
  ip_address: string
  user_agent: string
  request_content: string
  response_content: string
  error_message: string
  use_time_ms: number
  created_at: string
}

export interface LogFilter {
  page?: number
  page_size?: number
  user_id?: number
  token_id?: number
  channel_id?: number
  model_name?: string
  type?: LogType
  status_code?: number
  keyword?: string
  start_time?: string
  end_time?: string
}

// ==================== Dashboard ====================

export interface DashboardStats {
  user_count: number
  token_count: number
  channel_count: number
  active_channel_count: number
  model_count: number
  today_request_count: number
  today_token_count: number
  today_quota_consumed: number
  today_quota_recharged: number
  month_quota_consumed: number
  error_channel_count: number
}

export interface DashboardTrendItem {
  date: string
  requests: number
  quota: number
}

// ==================== TopUp ====================

export interface TopUp {
  id: number
  user_id: number
  package_id?: number
  amount_cents: number
  quota_granted: number
  currency: string
  payment_method: string
  payment_status: TopUpStatus
  transaction_id?: string
  paid_at?: string
  created_at: string
  updated_at: string
}

export interface CreateTopUpRequest {
  user_id: number
  quota_granted: number
  payment_method?: string
}

export interface CreatePackageOrderRequest {
  package_id: number
  payment_method: string
}

// ==================== Redemption ====================

export interface Redemption {
  id: number
  code: string
  quota_value: number
  status: RedemptionStatus
  used_by?: number
  used_at?: string
  expires_at?: string
  created_at: string
}

export interface GenerateRedemptionRequest {
  count: number
  quota_value: number
  prefix?: string
  expires_at?: string
}

export interface RedeemRequest {
  code: string
}

// ==================== QuotaPackage ====================

export interface QuotaPackage {
  id: number
  name: string
  quota_value: number
  price_cents: number
  currency: string
  status: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CreateQuotaPackageRequest {
  name: string
  quota_value: number
  price_cents: number
  currency?: string
  sort_order?: number
}

export interface UpdateQuotaPackageRequest {
  name?: string
  quota_value?: number
  price_cents?: number
  status?: number
  sort_order?: number
}

// ==================== QuotaTransaction ====================

export interface QuotaTransaction {
  id: number
  user_id: number
  token_id?: number
  type: QuotaTransactionType
  amount: number
  balance_after: number
  related_id?: string
  related_type?: string
  description?: string
  created_at: string
}

export interface QuotaInfo {
  quota: number
  used_quota: number
}

// ==================== DailyBill ====================

export interface DailyBill {
  id: number
  bill_date: string
  user_id: number
  model_name: string
  request_count: number
  token_count: number
  quota_consumed: number
  quota_recharged: number
  created_at: string
  updated_at: string
}

export interface MonthlyBill {
  month: string
  request_count: number
  token_count: number
  quota_consumed: number
  quota_recharged: number
}

// ==================== Subscription ====================

export interface SubscriptionPlan {
  id: number
  name: string
  quota_value: number
  price_cents: number
  currency: string
  interval_months: number
  status: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CreateSubscriptionPlanRequest {
  name: string
  quota_value: number
  price_cents: number
  currency?: string
  interval_months?: number
  sort_order?: number
}

export interface UpdateSubscriptionPlanRequest {
  name?: string
  quota_value?: number
  price_cents?: number
  currency?: string
  interval_months?: number
  status?: number
  sort_order?: number
}

export interface Subscription {
  id: number
  user_id: number
  plan_id: number
  status: SubscriptionStatus
  started_at: string
  expires_at: string
  last_billed_at?: string
  created_at: string
  updated_at: string
}

// ==================== Prompt ====================

export interface PromptCategory {
  id: number
  name: string
  type: PromptType
  description?: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CreateCategoryRequest {
  name: string
  description?: string
  sort_order?: number
}

export interface UpdateCategoryRequest {
  name?: string
  description?: string
  sort_order?: number
}

export interface Prompt {
  id: number
  type: PromptType
  category_id: number
  title: string
  content: string
  variables?: Record<string, string>
  tags?: string[]
  status: PromptStatus
  author_id: number
  created_at: string
  updated_at: string
}

export interface PromptListItem {
  id: number
  type: PromptType
  category_id: number
  title: string
  variables?: Record<string, string>
  tags?: string[]
  status: PromptStatus
  author_id: number
  created_at: string
  updated_at: string
}

export interface CreatePromptRequest {
  category_id: number
  title: string
  content: string
  variables?: Record<string, string>
  tags?: string[]
  status: PromptStatus
}

export interface UpdatePromptRequest {
  category_id?: number
  title?: string
  content?: string
  variables?: Record<string, string>
  tags?: string[]
  status?: PromptStatus
}

export interface RenderPromptRequest {
  variables: Record<string, string>
}

export interface RenderPromptResponse {
  content: string
}

export interface PromptVersion {
  id: number
  prompt_id: number
  title: string
  content: string
  variables?: Record<string, string>
  tags?: string[]
  author_id: number
  created_at: string
}

export interface PromptPackageItem {
  id: number
  prompt_id: number
  sort_order: number
}

export interface SetPackageItemsRequest {
  items: Array<{ prompt_id: number; sort_order?: number }>
}

export interface RenderPackageResponse {
  results: RenderPackageItemResult[]
}

export interface RenderPackageItemResult {
  prompt_id: number
  title: string
  content: string
}

// ==================== Setting ====================

export interface Setting {
  id: number
  key: string
  value: string
  type: SettingType
  description: string
  created_at: string
  updated_at: string
}

export interface UpsertSettingRequest {
  key: string
  value: string
  type?: SettingType
  description?: string
}

// ==================== Ability ====================

export interface Ability {
  id: number
  group: string
  model_name: string
  channel_id: number
  priority: number
  weight: number
  enabled: boolean
  created_at: string
  updated_at: string
}

// ==================== OpenAI Compatible ====================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
  [key: string]: unknown
}

export interface ChatCompletionChoice {
  index: number
  message: ChatMessage
  finish_reason: string
}

export interface ChatCompletionUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: ChatCompletionChoice[]
  usage: ChatCompletionUsage
}

export interface ImageGenerationRequest {
  model: string
  prompt: string
  n?: number
  size?: string
  response_format?: 'url' | 'b64_json'
  quality?: string
  style?: string
  [key: string]: unknown
}

export interface ImageGenerationResponse {
  created: number
  data: Array<{
    url?: string
    b64_json?: string
    revised_prompt?: string
  }>
}

export interface EmbeddingRequest {
  model: string
  input: string | string[]
}

export interface AudioSpeechRequest {
  model: string
  input: string
  voice?: string
}

export interface OpenAIModel {
  id: string
  object: string
  created: number
  owned_by: string
}

export interface OpenAIModelList {
  object: string
  data: OpenAIModel[]
}

export interface OpenAIError {
  message: string
  type: string
  param?: string
  code: string
}

export interface OpenAIErrorResponse {
  error: OpenAIError
}

// ==================== SSE Streaming ====================

export interface ChatCompletionChunkDelta {
  role?: string
  content?: string
}

export interface ChatCompletionChunkChoice {
  index: number
  delta: ChatCompletionChunkDelta
  finish_reason: string | null
}

export interface ChatCompletionChunk {
  id: string
  object: string
  created: number
  model: string
  choices: ChatCompletionChunkChoice[]
}

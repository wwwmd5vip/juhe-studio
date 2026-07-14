import { relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// ==================== Generations ====================
export const generations = sqliteTable(
  'generations',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(), // 'image' | 'video' | 'text'
    providerId: text('provider_id').notNull(),
    modelId: text('model_id').notNull(),
    prompt: text('prompt').notNull(),
    negativePrompt: text('negative_prompt'),
    seed: integer('seed'),
    width: integer('width'),
    height: integer('height'),
    steps: integer('steps'),
    cfgScale: integer('cfg_scale'),
    parameters: text('parameters', { mode: 'json' }),
    resultUrls: text('result_urls', { mode: 'json' }),
    status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
    errorMessage: text('error_message'),
    // Task persistence fields
    priority: text('priority').default('normal'),
    progress: integer('progress').default(0),
    stage: text('stage').default('queued'),
    startedAt: text('started_at'),
    completedAt: text('completed_at'),
    externalTaskId: text('external_task_id'),
    externalProvider: text('external_provider'),
    outputs: text('outputs', { mode: 'json' }),
    // Creator OS: nullable FK to projects
    projectId: text('project_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('generations_status_idx').on(table.status),
    index('generations_type_idx').on(table.type),
    index('generations_created_at_idx').on(table.createdAt)
  ]
)

// ==================== Workflows (Canvas) ====================
export const workflows = sqliteTable(
  'workflows',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    nodes: text('nodes', { mode: 'json' }).notNull(),
    edges: text('edges', { mode: 'json' }).notNull(),
    viewport: text('viewport', { mode: 'json' }),
    viewMode: text('view_mode').default('smart'),
    version: integer('version').default(1),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [index('workflows_favorite_idx').on(table.isFavorite)]
)

// ==================== Ecommerce Workflows ====================
export const ecommerceWorkflows = sqliteTable(
  'ecommerce_workflows',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull().default('tv'),
    context: text('context', { mode: 'json' }).notNull(),
    steps: text('steps', { mode: 'json' }).notNull(),
    modules: text('modules', { mode: 'json' }).notNull(),
    status: text('status').notNull().default('draft'),
    // Creator OS: nullable FK to projects
    projectId: text('project_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('ecommerce_workflows_template_idx').on(table.templateId),
    index('ecommerce_workflows_status_idx').on(table.status),
    index('ecommerce_workflows_updated_at_idx').on(table.updatedAt),
    index('ecommerce_workflows_category_idx').on(table.category)
  ]
)

// ==================== Prompt Templates ====================
export const promptTemplates = sqliteTable(
  'prompt_templates',
  {
    id: text('id').primaryKey(),
    category: text('category').notNull(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    description: text('description'),
    tags: text('tags', { mode: 'json' }),
    coverImage: text('cover_image'),
    aspectRatio: text('aspect_ratio'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
    usageCount: integer('usage_count').default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('prompt_templates_category_idx').on(table.category),
    index('prompt_templates_favorite_idx').on(table.isFavorite)
  ]
)

// ==================== Providers ====================
export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'openai' | 'anthropic' | 'ollama' | etc.
  presetId: text('preset_id'), // references provider preset (e.g. 'openai', 'anthropic')
  baseUrl: text('base_url'),
  apiKey: text('api_key'),
  // Volcengine-style dual-key auth (Access Key ID + Secret Access Key)
  accessKeyId: text('access_key_id'),
  secretAccessKey: text('secret_access_key'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
  isCustom: integer('is_custom', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

// ==================== Models ====================
export const models = sqliteTable(
  'models',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id').notNull(),
    name: text('name').notNull(),
    displayName: text('display_name'),
    type: text('type').notNull(), // 'llm' | 'image' | 'video' | 'embedding'
    capabilities: text('capabilities', { mode: 'json' }),
    parameters: text('parameters', { mode: 'json' }),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
    createdAt: text('created_at').notNull()
  },
  (table) => [index('models_provider_idx').on(table.providerId), index('models_type_idx').on(table.type)]
)

// ==================== Chat Sessions ====================
export const chatSessions = sqliteTable(
  'chat_sessions',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull().default('New Chat'),
    providerId: text('provider_id'),
    modelId: text('model_id'),
    systemPrompt: text('system_prompt'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('chat_sessions_created_at_idx').on(table.createdAt),
    index('chat_sessions_favorite_idx').on(table.isFavorite)
  ]
)

// ==================== Chat Messages ====================
export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull(),
    role: text('role').notNull(), // 'user' | 'assistant' | 'system'
    content: text('content').notNull(),
    attachments: text('attachments', { mode: 'json' }), // image URLs etc.
    blocks: text('blocks', { mode: 'json' }), // MessageBlock[] - 1:1 Cherry Studio 架构
    modelId: text('model_id'),
    tokensUsed: integer('tokens_used'),
    latency: integer('latency'), // ms
    createdAt: text('created_at').notNull()
  },
  (table) => [
    index('chat_messages_session_idx').on(table.sessionId),
    index('chat_messages_created_at_idx').on(table.createdAt)
  ]
)

// ==================== Quick Phrases ====================
export const quickPhrases = sqliteTable(
  'quick_phrases',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
    orderKey: integer('order_key').default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('quick_phrases_favorite_idx').on(table.isFavorite),
    index('quick_phrases_order_idx').on(table.orderKey)
  ]
)

// ==================== Settings ====================
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull()
})

// ==================== Web Search Providers ====================
export const webSearchProviders = sqliteTable('web_search_providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'tavily' | 'searxng' | 'exa' | 'jina' | 'zhipu' | 'bocha' | 'querit' | 'fetch'
  apiKey: text('api_key'),
  apiHost: text('api_host'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
  engines: text('engines', { mode: 'json' }), // for searxng: ['google', 'bing', etc.]
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

// ==================== Skills ====================
export const skills = sqliteTable(
  'skills',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    content: text('content').notNull(),
    category: text('category').default('custom'),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
    isBuiltin: integer('is_builtin', { mode: 'boolean' }).default(false),
    metadata: text('metadata', { mode: 'json' }),
    icon: text('icon'),
    orderKey: integer('order_key').default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('skills_category_idx').on(table.category),
    index('skills_enabled_idx').on(table.isEnabled),
    index('skills_order_idx').on(table.orderKey)
  ]
)

// ==================== Memories (MGP Lite) ====================
export const memories = sqliteTable(
  'memories',
  {
    id: text('id').primaryKey(),
    // Subject: who this memory is about
    subjectId: text('subject_id').notNull(), // 'user' | sessionId
    subjectType: text('subject_type').notNull().default('user'), // 'user' | 'session'

    // Memory type (MGP semantic types)
    type: text('type').notNull(), // 'preference' | 'profile' | 'episodic_event' | 'semantic_fact' | 'procedural_rule'

    // Content: structured payload
    content: text('content').notNull().unique(), // JSON string

    // Metadata
    scope: text('scope').notNull().default('user'), // 'user' | 'session' | 'global'
    confidence: integer('confidence').default(100), // 0-100

    // Lifecycle
    status: text('status').notNull().default('active'), // 'active' | 'expired' | 'deleted'
    expiresAt: text('expires_at'), // ISO date or null for permanent

    // Source
    sourceType: text('source_type').default('chat'), // 'chat' | 'user' | 'system' | 'import'
    sourceId: text('source_id'), // messageId or null

    // Timestamps
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('memories_subject_idx').on(table.subjectId, table.subjectType),
    index('memories_type_idx').on(table.type),
    index('memories_scope_idx').on(table.scope),
    index('memories_status_idx').on(table.status),
    index('memories_created_at_idx').on(table.createdAt)
  ]
)

// ==================== MCP Servers ====================
export const mcpServers = sqliteTable(
  'mcp_servers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    transport: text('transport').notNull(), // 'stdio' | 'sse' | 'streamable-http'
    command: text('command'),
    args: text('args', { mode: 'json' }),
    env: text('env', { mode: 'json' }),
    url: text('url'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [index('mcp_servers_enabled_idx').on(table.enabled)]
)

// ==================== Chat Assistants ====================
export const chatAssistants = sqliteTable(
  'chat_assistants',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    emoji: text('emoji').notNull().default('💬'),
    systemPrompt: text('system_prompt').notNull().default(''),
    description: text('description').notNull().default(''),
    modelId: text('model_id'),
    providerId: text('provider_id'),
    isPreset: integer('is_preset', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [index('chat_assistants_preset_idx').on(table.isPreset)]
)

// ==================== Showcase Tasks ====================
export const showcaseTasks = sqliteTable(
  'showcase_tasks',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: ['selling_points', 'plan', 'images'] }).notNull(),
    status: text('status', { enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] })
      .notNull()
      .default('pending'),
    input: text('input', { mode: 'json' }).notNull(),
    result: text('result', { mode: 'json' }),
    errorMsg: text('error_msg'),
    pointCost: integer('point_cost'),
    generationTaskIds: text('generation_task_ids', { mode: 'json' }),
    // Creator OS: nullable FK to projects
    projectId: text('project_id'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('showcase_tasks_status_idx').on(table.status),
    index('showcase_tasks_updated_at_idx').on(table.updatedAt)
  ]
)


// ==================== Creator OS: Projects ====================
export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull().default('product_set'),
    status: text('status').notNull().default('draft'),
    description: text('description'),
    batchStatus: text('batch_status').default('idle'),
    batchError: text('batch_error'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('projects_updated_at_idx').on(table.updatedAt),
    index('projects_batch_status_idx').on(table.batchStatus)
  ]
)

// ==================== Creator OS: Assets ====================
export const assets = sqliteTable(
  'assets',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('source'),
    filePath: text('file_path').notNull(),
    mimeType: text('mime_type').notNull().default('image/png'),
    width: integer('width'),
    height: integer('height'),
    metadata: text('metadata', { mode: 'json' }),
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('assets_project_idx').on(table.projectId),
    index('assets_kind_idx').on(table.kind)
  ]
)

// ==================== Creator OS: Creator Tasks ====================
export const creatorTasks = sqliteTable(
  'creator_tasks',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    runtimeTaskId: text('runtime_task_id').notNull(),
    templateSlotId: text('template_slot_id').notNull(),
    slotIndex: integer('slot_index').notNull().default(0),
    status: text('status').notNull().default('pending'),
    runtimeStatus: text('runtime_status').notNull().default('pending'),
    errorMessage: text('error_message'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('creator_tasks_project_idx').on(table.projectId),
    index('creator_tasks_runtime_idx').on(table.runtimeTaskId)
  ]
)

// ==================== Creator OS: Versions ====================
export const versions = sqliteTable(
  'versions',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').notNull().references(() => creatorTasks.id, { onDelete: 'cascade' }),
    generationId: text('generation_id'),
    versionNumber: integer('version_number').notNull().default(1),
    filePath: text('file_path').notNull(),
    mimeType: text('mime_type').notNull().default('image/png'),
    isSelected: integer('is_selected', { mode: 'boolean' }).notNull().default(true),
    metadata: text('metadata', { mode: 'json' }),
    createdAt: text('created_at').notNull()
  },
  (table) => [
    index('versions_task_idx').on(table.taskId)
  ]
)

// ==================== Creator OS: Deliverables ====================
export const deliverables = sqliteTable(
  'deliverables',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    taskId: text('task_id').notNull().references(() => creatorTasks.id, { onDelete: 'cascade' }),
    versionId: text('version_id').references(() => versions.id, { onDelete: 'set null' }),
    label: text('label').notNull(),
    slotIndex: integer('slot_index').notNull().default(0),
    isSelected: integer('is_selected', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('deliverables_project_idx').on(table.projectId)
  ]
)

// ==================== Relations ====================
export const providersRelations = relations(providers, ({ many }) => ({
  models: many(models)
}))

export const modelsRelations = relations(models, ({ one }) => ({
  provider: one(providers, {
    fields: [models.providerId],
    references: [providers.id]
  })
}))

export const chatSessionsRelations = relations(chatSessions, ({ many }) => ({
  messages: many(chatMessages)
}))

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id]
  })
}))

// ── Creator OS relations ──

export const projectsRelations = relations(projects, ({ many }) => ({
  assets: many(assets),
  creatorTasks: many(creatorTasks),
  deliverables: many(deliverables)
}))

export const assetsRelations = relations(assets, ({ one }) => ({
  project: one(projects, {
    fields: [assets.projectId],
    references: [projects.id]
  })
}))

export const creatorTasksRelations = relations(creatorTasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [creatorTasks.projectId],
    references: [projects.id]
  }),
  versions: many(versions)
}))

export const versionsRelations = relations(versions, ({ one }) => ({
  task: one(creatorTasks, {
    fields: [versions.taskId],
    references: [creatorTasks.id]
  })
}))

export const deliverablesRelations = relations(deliverables, ({ one }) => ({
  project: one(projects, {
    fields: [deliverables.projectId],
    references: [projects.id]
  }),
  task: one(creatorTasks, {
    fields: [deliverables.taskId],
    references: [creatorTasks.id]
  }),
  version: one(versions, {
    fields: [deliverables.versionId],
    references: [versions.id]
  })
}))

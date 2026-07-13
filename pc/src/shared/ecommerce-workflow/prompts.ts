import type { Language } from './enums'

export type PromptTemplateKey =
  | 'ecommerce.workflow.productSet.vision.systemPrompt'
  | 'ecommerce.workflow.productSet.vision.userPrompt'
  | 'ecommerce.workflow.productSet.copy.systemPrompt'
  | 'ecommerce.workflow.productSet.copy.userPrompt'
  | 'ecommerce.workflow.productSet.split.systemPrompt'
  | 'ecommerce.workflow.productSet.split.userPrompt'
  | 'ecommerce.workflow.platformListing.sellingPoints.systemPrompt'
  | 'ecommerce.workflow.platformListing.sellingPoints.userPrompt'
  | 'ecommerce.workflow.platformListing.structuredInfo.systemPrompt'
  | 'ecommerce.workflow.platformListing.structuredInfo.userPrompt'
  | 'ecommerce.workflow.platformListing.moduleGenerate.systemPrompt'
  | 'ecommerce.workflow.platformListing.moduleGenerate.userPrompt'
  | 'ecommerce.workflow.productDetailPage.copy.systemPrompt'
  | 'ecommerce.workflow.productDetailPage.copy.userPrompt'
  | 'ecommerce.workflow.productDetailPage.moduleRecommend.systemPrompt'
  | 'ecommerce.workflow.productDetailPage.moduleRecommend.userPrompt'
  | 'ecommerce.workflow.productDetailPage.moduleGenerate.systemPrompt'
  | 'ecommerce.workflow.productDetailPage.moduleGenerate.userPrompt'

const DEFAULT_FALLBACK_LANG: Language = 'en'

const TEMPLATES: Record<PromptTemplateKey, Partial<Record<Language, string>>> = {
  'ecommerce.workflow.productSet.vision.systemPrompt': {
    zh: '你是一位专业的电商产品视觉分析助手。请仔细分析用户上传的产品图片，结合用户提供的补充文字，提炼出产品最吸引人的核心卖点。输出要求：只输出 3-5 条核心卖点，每条卖点一句话，简洁有力，适合后续生成多场景电商套图。不要输出 JSON、表格或多余说明。',
    en: 'You are an expert e-commerce product visual analyst. Analyze the uploaded product image and the user-supplied text, then extract the 3-5 most compelling selling points. Output only 3-5 concise, punchy selling points, one per line. Do not output JSON, tables, or extra explanations.'
  },
  'ecommerce.workflow.productSet.vision.userPrompt': {
    zh: '产品补充信息：\n{{productText}}\n\n请根据图片和上述信息，用 {{language}} 语言提炼 3-5 条核心卖点。',
    en: 'Additional product information:\n{{productText}}\n\nBased on the image and the information above, extract 3-5 core selling points in {{language}}.'
  },
  'ecommerce.workflow.productSet.copy.systemPrompt': {
    zh: '你是一位资深电商文案策划。根据上一步提取的产品卖点，为每个卖点撰写吸引目标市场消费者的营销文案。输出要求：为每条卖点写一段简短文案（20-40 字），整体用 {{language}} 语言，贴合 {{market}} 市场风格。只输出文案列表，不要 JSON 或表格。',
    en: 'You are a senior e-commerce copywriter. Based on the selling points extracted in the previous step, write compelling marketing copy for each point. Write a short paragraph (20-40 words) per selling point in {{language}}, tailored to the {{market}} market. Output only the copy list, no JSON or tables.'
  },
  'ecommerce.workflow.productSet.copy.userPrompt': {
    zh: '上一步输出的卖点：\n{{previousOutput}}\n\n目标市场：{{market}}\n文案语言：{{language}}\n\n请为每条卖点撰写营销文案。',
    en: 'Selling points from the previous step:\n{{previousOutput}}\n\nTarget market: {{market}}\nCopy language: {{language}}\n\nPlease write marketing copy for each selling point.'
  },
  'ecommerce.workflow.productSet.split.systemPrompt': {
    zh: '你是一位电商 AI 图像提示词工程师。根据产品卖点和文案，将其拆分为 3-5 张独立图片的生成方案。每张图需包含：模块名（如主图、细节图、场景图、对比图、使用图）、用于图像生成的英文提示词（image_prompt，30-80 词，包含产品主体、场景、光影、风格）、以及该模块的文案要求（copy_requirements，中文说明）。输出必须是严格的 JSON 数组，格式如下：\n[{\n  "module_id": "main",\n  "module_name": "主图",\n  "image_prompt": "...",\n  "copy_requirements": "..."\n}]\n只输出 JSON 数组，不要 markdown 代码块和额外文字。',
    en: 'You are an e-commerce AI image prompt engineer. Based on the selling points and copy, split them into 3-5 independent image generation modules. Each module must include: module_id (snake_case), module_name (display name in {{language}}), image_prompt (30-80 English words describing subject, scene, lighting, style), and copy_requirements (description in {{language}}). Output a strict JSON array only. Format:\n[{\n  "module_id": "main",\n  "module_name": "Main Image",\n  "image_prompt": "...",\n  "copy_requirements": "..."\n}]\nOutput only the JSON array, no markdown code blocks or extra text.'
  },
  'ecommerce.workflow.productSet.split.userPrompt': {
    zh: '卖点与文案：\n{{previousOutput}}\n\n目标市场：{{market}}\n文案语言：{{language}}\n\n请拆分为 3-5 个图片生成模块，并输出 JSON 数组。',
    en: 'Selling points and copy:\n{{previousOutput}}\n\nTarget market: {{market}}\nCopy language: {{language}}\n\nPlease split into 3-5 image generation modules and output a JSON array.'
  },
  'ecommerce.workflow.platformListing.sellingPoints.systemPrompt': {
    zh: '你是一位跨境电商平台运营专家。分析用户上传的产品图片和文字，提炼出适合 {{platform}} 平台、面向 {{market}} 市场消费者的 3-5 个核心卖点。输出要求：每条卖点一句话，语言为 {{language}}，符合当地电商表达习惯。只输出卖点列表。',
    en: 'You are a cross-border e-commerce platform specialist. Analyze the uploaded product image and text, then extract 3-5 core selling points suitable for {{platform}} and the {{market}} market. Output one sentence per point in {{language}}, matching local e-commerce tone. Output only the list.'
  },
  'ecommerce.workflow.platformListing.sellingPoints.userPrompt': {
    zh: '产品补充信息：\n{{productText}}\n\n目标平台：{{platform}}\n目标市场：{{market}}\n输出语言：{{language}}\n\n请提炼核心卖点。',
    en: 'Additional product information:\n{{productText}}\n\nTarget platform: {{platform}}\nTarget market: {{market}}\nOutput language: {{language}}\n\nPlease extract the core selling points.'
  },
  'ecommerce.workflow.platformListing.structuredInfo.systemPrompt': {
    zh: '你是一位电商 Listing 信息结构化专家。根据上一步提炼的卖点和补充信息，生成一份结构化的产品信息表，用于后续为各平台模块（主图、细节图、场景图等）生成图片提示词和文案要求。输出必须是严格的 JSON 对象，包含以下字段：title（标题）、category（类目）、audience（受众）、key_features（字符串数组，3-5 条核心特性）、emotional_appeal（情感卖点，字符串数组）、visual_style（期望视觉风格描述）、tone（文案调性）。只输出 JSON，不要 markdown 代码块。',
    en: 'You are an e-commerce listing information structuring expert. Based on the selling points and additional information from the previous step, generate a structured product information object for downstream module image prompt and copy generation. Output a strict JSON object with: title, category, audience, key_features (array of 3-5 strings), emotional_appeal (array of strings), visual_style (visual style description), tone (copy tone). Output only JSON, no markdown code blocks.'
  },
  'ecommerce.workflow.platformListing.structuredInfo.userPrompt': {
    zh: '上一步卖点：\n{{previousOutput}}\n\n产品补充信息：\n{{productText}}\n\n目标平台：{{platform}}\n目标市场：{{market}}\n输出语言：{{language}}\n图片比例：{{ratio}}\n\n请输出结构化产品信息 JSON。',
    en: 'Selling points from previous step:\n{{previousOutput}}\n\nAdditional product info:\n{{productText}}\n\nTarget platform: {{platform}}\nTarget market: {{market}}\nOutput language: {{language}}\nImage ratio: {{ratio}}\n\nPlease output the structured product information JSON.'
  },
  'ecommerce.workflow.platformListing.moduleGenerate.systemPrompt': {
    zh: '你是一位电商模块创意生成助手。根据结构化产品信息，为 {{platform}} 平台生成一组可提交生成的模块。每个模块包含：module_id（snake_case 标识）、module_name（{{language}} 展示名）、image_prompt（英文生图提示词，30-80 词，必须包含主体、场景、光影和 {{platform}} 平台视觉风格）、copy_requirements（{{language}} 文案要求）。\n\n输出必须是严格的 JSON 数组，格式：\n[{\n  "module_id": "main",\n  "module_name": "主图",\n  "image_prompt": "...",\n  "copy_requirements": "..."\n}]\n只输出 JSON 数组，不要 markdown 代码块。',
    en: 'You are an e-commerce module creative generator. Based on the structured product information, generate a set of modules for {{platform}}. Each module includes: module_id (snake_case), module_name (display name in {{language}}), image_prompt (English image generation prompt, 30-80 words, must include subject, scene, lighting and {{platform}} visual style), copy_requirements (copy requirements in {{language}}).\n\nOutput a strict JSON array. Format:\n[{\n  "module_id": "main",\n  "module_name": "Main Image",\n  "image_prompt": "...",\n  "copy_requirements": "..."\n}]\nOutput only the JSON array, no markdown code blocks.'
  },
  'ecommerce.workflow.platformListing.moduleGenerate.userPrompt': {
    zh: '结构化产品信息：\n{{previousOutput}}\n\n目标平台：{{platform}}\n目标市场：{{market}}\n输出语言：{{language}}\n图片比例：{{ratio}}\n\n请生成模块列表 JSON 数组。',
    en: 'Structured product information:\n{{previousOutput}}\n\nTarget platform: {{platform}}\nTarget market: {{market}}\nOutput language: {{language}}\nImage ratio: {{ratio}}\n\nPlease generate the module list as a JSON array.'
  },
  'ecommerce.workflow.productDetailPage.copy.systemPrompt': {
    zh: '你是一位资深电商文案策划。根据上一步的视觉分析，为产品提炼 3-5 个核心卖点，并输出一段适合详情页使用的营销文案。输出要求：先输出卖点列表（每点一句话），再输出一段 50-100 字的综合文案。使用 {{language}} 语言，贴合 {{market}} 市场风格。不要输出 JSON 或表格。',
    en: 'You are a senior e-commerce copywriter. Based on the previous visual analysis, extract 3-5 core selling points and write a 50-100 word marketing copy suitable for a product detail page. Output the selling points first (one sentence each), followed by a comprehensive paragraph. Use {{language}} and tailor to the {{market}} market. Do not output JSON or tables.'
  },
  'ecommerce.workflow.productDetailPage.copy.userPrompt': {
    zh: '上一步视觉分析：\n{{previousOutput}}\n\n产品补充信息：\n{{productText}}\n\n目标平台：{{platform}}\n目标市场：{{market}}\n输出语言：{{language}}\n\n请提炼卖点并撰写详情页文案。',
    en: 'Previous visual analysis:\n{{previousOutput}}\n\nAdditional product information:\n{{productText}}\n\nTarget platform: {{platform}}\nTarget market: {{market}}\nOutput language: {{language}}\n\nPlease extract selling points and write detail-page copy.'
  },
  'ecommerce.workflow.productDetailPage.moduleRecommend.systemPrompt': {
    zh: '你是一位电商视觉策划专家。请根据商品信息，从提供的模块候选池中选择最应该生成的详情页图片模块。只返回 JSON，格式为 {"recommendedModules": ["module_id_1", ...]}，不要任何解释。module_id 必须从候选池中选取。',
    en: 'You are an e-commerce visual planning expert. Based on the product information, select the most suitable detail-page image modules from the provided candidate pool. Return only JSON in the format {"recommendedModules": ["module_id_1", ...]}, no explanations. module_id must be from the candidate pool.'
  },
  'ecommerce.workflow.productDetailPage.moduleRecommend.userPrompt': {
    zh: '目标平台：{{platform}}\n目标市场：{{market}}\n输出语言：{{language}}\n产品补充信息：\n{{productText}}\n\n上一步卖点文案：\n{{previousOutput}}\n\n可选模块：\n{{modulePool}}\n\n请推荐应生成哪些模块，只返回 JSON。',
    en: 'Target platform: {{platform}}\nTarget market: {{market}}\nOutput language: {{language}}\nAdditional product information:\n{{productText}}\n\nSelling points from previous step:\n{{previousOutput}}\n\nAvailable modules:\n{{modulePool}}\n\nPlease recommend which modules to generate, return only JSON.'
  },
  'ecommerce.workflow.productDetailPage.moduleGenerate.systemPrompt': {
    zh: '你是一位电商图片提示词工程师。请根据商品信息和用户选中的模块类型，为每个模块生成英文 image_prompt 和 {{language}} 语言的 copy_requirements。输出必须是严格的 JSON 数组，每个元素包含 module_id、module_name、image_prompt、copy_requirements。image_prompt 必须详细描述画面内容、风格、构图、光线，适合直接交给 AI 图像模型。module_name 使用 {{language}} 语言。',
    en: 'You are an e-commerce image prompt engineer. Based on the product information and selected module types, generate an English image_prompt and {{language}} copy_requirements for each module. Output must be a strict JSON array where each item contains module_id, module_name, image_prompt, copy_requirements. image_prompt must vividly describe the scene, style, composition, and lighting, suitable for direct use by an AI image model. module_name should be in {{language}}.'
  },
  'ecommerce.workflow.productDetailPage.moduleGenerate.userPrompt': {
    zh: '目标平台：{{platform}}\n目标市场：{{market}}\n输出语言：{{language}}\n图片比例：{{ratio}}\n产品补充信息：\n{{productText}}\n\n卖点文案：\n{{copyOutput}}\n\n请为以下模块类型生成提示词：{{selectedModuleTypes}}\n\n严格要求：每个模块的 `module_id` 必须且只能是上面列表中的 ID 之一，使用 snake_case，不要新增或改写 ID。\n\n输出 JSON 数组。',
    en: "Target platform: {{platform}}\nTarget market: {{market}}\nOutput language: {{language}}\nImage ratio: {{ratio}}\nAdditional product information:\n{{productText}}\n\nSelling points copy:\n{{copyOutput}}\n\nPlease generate prompts for the following module types: {{selectedModuleTypes}}\n\nStrict requirement: each module's `module_id` must be one of the IDs listed above, in snake_case. Do not invent or rewrite IDs.\n\nOutput a JSON array."
  }
}

function interpolate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = context[key]
    return value !== undefined && value !== null ? String(value) : ''
  })
}

export function resolvePrompt(key: PromptTemplateKey, language: Language, context: Record<string, unknown>): string {
  const langTemplates = TEMPLATES[key]
  const template = langTemplates[language] ?? langTemplates[DEFAULT_FALLBACK_LANG]
  if (!template) {
    throw new Error(`Prompt template not found for key: ${key}, language: ${language}`)
  }
  return interpolate(template, context)
}

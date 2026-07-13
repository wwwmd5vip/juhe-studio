/**
 * 行业模板库 — 预置 Prompt 模板，支持变量插值
 * 灵感来源：YunQiao Image Studio、PrismPix、Merak
 */

export interface TemplateVariable {
  key: string
  label: string
  placeholder: string
  defaultValue?: string
}

export interface IndustryTemplate {
  id: string
  name: string
  category: string
  icon: string
  description: string
  prompt: string
  negativePrompt?: string
  variables: TemplateVariable[]
  size?: string
  quality?: string
  style?: string
}

// ===== 电商行业模板 =====

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: 'ecom-white-bg',
    name: '白底主图',
    category: 'ecommerce',
    icon: '📦',
    description: '纯白背景产品主图，Amazon/淘宝标准',
    prompt: '{product_name} 专业产品摄影，纯白色背景（RGB 255,255,255），产品居中约占画面85%，均匀影棚灯光。无文字、无水印、无道具、无阴影。高端商业摄影风格，清晰锐利，仅展示产品本身。',
    negativePrompt: '文字, 标志, 水印, 边框, 色块, 图形叠加, 徽章, 道具, 支架, 阴影, 重复产品, 包装, 模特, 人物, 背景杂乱, 图案, 纹理背景',
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '无线蓝牙耳机', defaultValue: '产品' },
    ],
    size: '1024x1024',
    quality: 'high',
    style: 'natural',
  },
  {
    id: 'ecom-lifestyle',
    name: '生活场景图',
    category: 'ecommerce',
    icon: '🏠',
    description: '产品在真实使用场景中的展示图',
    prompt: '{product_name} 生活场景摄影，{scene_description}。自然温暖光线，浅景深，真实且具有向往感的场景。产品为画面主体，自然融入环境。专业商业摄影，移动端友好构图，层次清晰。',
    negativePrompt: '文字, 标志, 水印, 背景杂乱, 低质量, 模糊, 过饱和, 卡通, 插画, AI痕迹',
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '无线蓝牙耳机' },
      { key: 'scene_description', label: '使用场景', placeholder: '现代咖啡店桌面，旁边有笔记本电脑和咖啡杯', defaultValue: '现代家居环境' },
    ],
    size: '1024x1280',
    quality: 'high',
    style: 'natural',
  },
  {
    id: 'ecom-detail',
    name: '细节特写图',
    category: 'ecommerce',
    icon: '🔍',
    description: '产品细节/材质/工艺特写',
    prompt: '{product_name} 微距特写摄影，聚焦于 {detail_focus}。极高清晰度，突显纹理、材质和工艺品质。影棚光线配合微妙反光强调质感。背景干净不干扰主体细节。超高分辨率商业产品摄影。',
    negativePrompt: '全景, 广角, 杂乱, 文字, 水印, 模糊, 失焦, 低分辨率',
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '真皮手提包' },
      { key: 'detail_focus', label: '细节焦点', placeholder: '缝线细节和皮革纹理', defaultValue: '产品纹理和材质' },
    ],
    size: '1024x1024',
    quality: 'high',
    style: 'natural',
  },
  {
    id: 'ecom-comparison',
    name: '对比图',
    category: 'ecommerce',
    icon: '⚖️',
    description: '产品效果对比（使用前后/竞品对比）',
    prompt: '{product_name} 专业效果图对比，清晰的分屏或并排布局，商业风格。直观展示变化或优势。影棚级灯光，背景一致，移动端可读。',
    negativePrompt: '文字, 水印, 杂乱, 灯光不一致, 卡通, 插画',
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '护肤精华液' },
    ],
    size: '1024x512',
    quality: 'high',
    style: 'natural',
  },
  {
    id: 'ecom-scale',
    name: '尺寸/比例图',
    category: 'ecommerce',
    icon: '📏',
    description: '展示产品大小比例（参照物对比）',
    prompt: '{product_name} 比例参照摄影，旁边放置 {reference_object}。构图清晰传达产品大小。专业产品摄影，微妙阴影增加层次，简洁不干扰的背景。',
    negativePrompt: '文字, 水印, 多产品, 背景杂乱, 比例混乱',
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '便携式蓝牙音箱' },
      { key: 'reference_object', label: '参照物', placeholder: '一张标准信用卡', defaultValue: '人手' },
    ],
    size: '1024x1024',
    quality: 'high',
    style: 'natural',
  },
  {
    id: 'ecom-content',
    name: '信息图/卖点图',
    category: 'ecommerce',
    icon: '📊',
    description: '带文字说明的产品卖点图',
    prompt: '{product_name} 精美信息图风格产品画，简洁的中文核心卖点 {key_benefit}。布局清晰有层次，信息丰富但不杂乱。高端商业设计，间距平衡，排版克制。产品为主体。',
    negativePrompt: '文字过密, 杂乱, 文字不可读, 水印, 卡通, 插画, 颜色过多',
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '空气净化器' },
      { key: 'key_benefit', label: '核心卖点', placeholder: 'HEPA过滤, 覆盖50平米, 静音运行', defaultValue: '产品核心卖点' },
    ],
    size: '1024x1024',
    quality: 'high',
    style: 'natural',
  },

  // —— 美食/饮料 ——
  {
    id: 'food-hero',
    name: '美食主图',
    category: 'food',
    icon: '🍽️',
    description: '美食摄影，诱人食欲的主图',
    prompt: '{food_name} 令人垂涎的美食摄影，{background_style}。专业食物戏剧性侧光，热气腾腾，可见新鲜食材。45度俯拍角度，浅景深，色彩诱人诱人。餐厅级摆盘，编辑级美食摄影风格。',
    negativePrompt: '塑料, 人造, 卡通, 插画, 文字, 水印, 食物不新鲜, 光线差, 过曝, 摆盘凌乱',
    variables: [
      { key: 'food_name', label: '菜品名称', placeholder: '黑松露意大利面配帕玛森芝士', defaultValue: '美食佳肴' },
      { key: 'background_style', label: '背景风格', placeholder: '深色复古木质桌面', defaultValue: '白色瓷盘放置在大理石台面' },
    ],
    size: '1024x1024',
    quality: 'high',
    style: 'natural',
  },
  {
    id: 'food-packaging',
    name: '食品包装图',
    category: 'food',
    icon: '🎁',
    description: '食品包装展示图',
    prompt: '{food_name} 专业产品摄影。干净的画面展示完整包装设计，如有产品展示窗则呈现诱人内容。影棚渐变灯光，品牌高级感。包装完好居中。',
    negativePrompt: '包装破损, 褶皱, 凹陷, 文字编辑, 水印, 卡通',
    variables: [
      { key: 'food_name', label: '产品名称', placeholder: '高级抹茶绿茶礼盒', defaultValue: '食品包装' },
    ],
    size: '1024x1024',
    quality: 'high',
    style: 'natural',
  },

  // —— 美妆/护肤 ——
  {
    id: 'beauty-product',
    name: '美妆产品图',
    category: 'beauty',
    icon: '💄',
    description: '美妆产品高端展示图',
    prompt: '{product_name} 奢华美妆产品摄影，放置于 {surface}。柔和漫射灯光配合微妙反光，构图简洁优雅，背景干净极简。瓶身/容器完美无瑕，瓶盖对齐。高端化妆品广告摄影，与品牌协调的微妙色彩点缀。',
    negativePrompt: '凌乱, 杂乱, 光线刺眼, 文字, 水印, 卡通, 产品破损, 指纹',
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '维C精华液瓶', defaultValue: '护肤产品' },
      { key: 'surface', label: '放置表面', placeholder: '大理石表面配玫瑰花瓣', defaultValue: '干净的白色表面' },
    ],
    size: '1024x1024',
    quality: 'high',
    style: 'natural',
  },
  {
    id: 'beauty-texture',
    name: '质地/成分图',
    category: 'beauty',
    icon: '✨',
    description: '展示产品质地或核心成分',
    prompt: '{product_name} 惊艳的微距质地特写，展现 {texture_type}。超近距离极致细节，美丽光影突出质感与品质。抽象但可辨识，奢华美妆编辑风格。色彩饱和，艺术构图。',
    negativePrompt: '文字, 水印, 卡通, 全景, 模糊, 细节不足',
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '玻尿酸精华液', defaultValue: '护肤产品' },
      { key: 'texture_type', label: '质地类型', placeholder: '水润凝胶质地带光反射', defaultValue: '质地和稠度' },
    ],
    size: '1024x1024',
    quality: 'high',
    style: 'natural',
  },

  // —— 家居/装饰 ——
  {
    id: 'home-hero',
    name: '家居主图',
    category: 'home',
    icon: '🛋️',
    description: '家居产品场景展示图',
    prompt: '{product_name} 室内设计摄影，{room_type}。精美布置，自然窗光，协调的色调。产品自然融入真实且具有向往感的房间场景。专业室内摄影，杂志编辑级品质。',
    negativePrompt: '空房间, 未装修, 阴影刺眼, 文字, 水印, 卡通, 杂乱, 凌乱, 布置差',
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '北欧极简落地灯', defaultValue: '家居装饰产品' },
      { key: 'room_type', label: '房间类型', placeholder: '现代北欧风客厅', defaultValue: '现代客厅' },
    ],
    size: '1024x1280',
    quality: 'high',
    style: 'natural',
  },

  // —— 服装/时尚 ——
  {
    id: 'fashion-product',
    name: '服装平铺/悬挂图',
    category: 'fashion',
    icon: '👗',
    description: '服装平铺或悬挂展示图',
    prompt: '{product_name} 干净的产品摄影，纯白色背景展示。服装完美展开无褶皱，均匀漫射影棚灯光。平铺或悬挂展示，完整呈现产品。专业电商服装摄影。',
    negativePrompt: '模特, 人体, 身体, 文字, 水印, 阴影, 褶皱, 破损, 脏污, 人体模型',
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '羊绒 oversize 毛衣', defaultValue: '服装' },
    ],
    size: '1024x1280',
    quality: 'high',
    style: 'natural',
  },
  {
    id: 'fashion-lifestyle',
    name: '穿搭场景图',
    category: 'fashion',
    icon: '🌟',
    description: '服装穿搭场景图',
    prompt: '{product_name} 时尚编辑摄影，{setting} 场景搭配。现代且向往的生活场景，自然光线，通过造型和构图展现自信姿态。服装为主体，版型和垂感清晰可见。杂志级时尚摄影。',
    negativePrompt: '文字, 水印, 卡通, 插画, 人体模型, 平铺, 光线差, 背景杂乱',
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '亚麻夏日连衣裙', defaultValue: '时尚单品' },
      { key: 'setting', label: '场景', placeholder: '阳光照射的欧洲老街', defaultValue: '城市户外场景' },
    ],
    size: '1024x1280',
    quality: 'high',
    style: 'natural',
  },
  {
    id: 'fashion-model',
    name: 'AI模特穿搭',
    category: 'fashion',
    icon: '👠',
    description: 'AI生成真人模特穿搭展示图',
    prompt: '一位身穿 {product_name} 真人模特，专业时尚摄影棚拍摄，{model_style}。模特自然站立展示服装细节，清晰展示版型、材质和上身效果。高端电商模特图，自然光影，精品商业摄影风格。',
    negativePrompt: '面部畸形, 多余手指, 肢体畸形, 低质量, 模糊, 假人, 塑料感, 真人照片',
    variables: [
      { key: 'product_name', label: '产品名称', placeholder: '高腰阔腿牛仔裤', defaultValue: '服装' },
      { key: 'model_style', label: '模特风格', placeholder: '亚裔女性，自然妆容，简约珠宝搭配', defaultValue: '年轻女性，自然优雅风格' },
    ],
    size: '1024x1280',
    quality: 'high',
    style: 'natural',
  },
]

// ===== 模板分类 =====

export const TEMPLATE_CATEGORIES = [
  { id: 'ecommerce', label: '电商通用', icon: '🏪' },
  { id: 'food', label: '美食饮料', icon: '🍽️' },
  { id: 'beauty', label: '美妆护肤', icon: '💄' },
  { id: 'home', label: '家居装饰', icon: '🛋️' },
  { id: 'fashion', label: '服装时尚', icon: '👗' },
]

// ===== 工具函数 =====

export function interpolateTemplate(template: IndustryTemplate, variables: Record<string, string>): { prompt: string; negativePrompt: string } {
  let prompt = template.prompt
  let negPrompt = template.negativePrompt || ''

  for (const v of template.variables) {
    const value = variables[v.key]?.trim() || v.defaultValue || v.placeholder
    const regex = new RegExp(`\\{${v.key}\\}`, 'g')
    prompt = prompt.replace(regex, value)
    negPrompt = negPrompt.replace(regex, value)
  }

  return { prompt, negativePrompt: negPrompt }
}

export function getTemplatesByCategory(category: string): IndustryTemplate[] {
  return INDUSTRY_TEMPLATES.filter((t) => t.category === category)
}

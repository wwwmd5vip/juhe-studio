/**
 * Smart Tools Registry — Unified parameter-driven prompt tools
 */

import type { LucideIcon } from 'lucide-react'
import {
  Brush,
  Camera,
  Eraser,
  ImageDown,
  ImageUp,
  LayoutTemplate,
  Palette,
  Puzzle,
  Scissors,
  Shirt,
  Sparkles,
  Star,
  Wand2
} from 'lucide-react'

// ---- Types ----

export type ToolParamType = 'select' | 'toggle' | 'slider'
export type ToolParamOption = { id: string; labelKey: string; hintKey?: string }

export interface ToolParam {
  id: string
  type: ToolParamType
  labelKey: string
  options?: ToolParamOption[]
  min?: number
  max?: number
  step?: number
  defaultValue: string | number | boolean
}

export type QualityLevel = 'standard' | 'high' | 'ultra'

export interface ToolGenDefaults {
  strength: number
  scale: number
  quality: QualityLevel
  denoise: number
  saturation: number
}

export interface SmartTool {
  id: string
  labelKey: string
  descriptionKey: string
  icon: LucideIcon
  params: ToolParam[]
  buildPrompt: (params: Record<string, unknown>) => string
  genDefaults: ToolGenDefaults
}

// ---- Prompt Templates ----

const GENDER_MAP: Record<string, string> = { male: '男性', female: '女性', neutral: '人物' }
const SIZE_MAP: Record<string, string> = { 'one-inch': '一寸', 'two-inch': '二寸', passport: '标准证件' }
const BG_MAP: Record<string, string> = { red: '纯净红色', blue: '纯净蓝色', white: '纯净白色' }

// ---- Tool Definitions ----

export const SMART_TOOLS: SmartTool[] = [
  {
    id: 'id-photo',
    labelKey: 'idPhoto.title',
    descriptionKey: 'idPhoto.subtitle',
    icon: Camera,
    params: [
      {
        id: 'gender',
        type: 'select',
        labelKey: 'idPhoto.gender',
        defaultValue: 'male',
        options: [
          { id: 'male', labelKey: 'idPhoto.genderMale', hintKey: 'idPhoto.genderMaleHint' },
          { id: 'female', labelKey: 'idPhoto.genderFemale', hintKey: 'idPhoto.genderFemaleHint' },
          { id: 'neutral', labelKey: 'idPhoto.genderNeutral', hintKey: 'idPhoto.genderNeutralHint' }
        ]
      },
      {
        id: 'size',
        type: 'select',
        labelKey: 'idPhoto.size',
        defaultValue: 'one-inch',
        options: [
          { id: 'one-inch', labelKey: 'idPhoto.sizeOneInch', hintKey: 'idPhoto.sizeOneInchHint' },
          { id: 'two-inch', labelKey: 'idPhoto.sizeTwoInch', hintKey: 'idPhoto.sizeTwoInchHint' },
          { id: 'passport', labelKey: 'idPhoto.sizePassport', hintKey: 'idPhoto.sizePassportHint' }
        ]
      },
      {
        id: 'background',
        type: 'select',
        labelKey: 'idPhoto.background',
        defaultValue: 'white',
        options: [
          { id: 'red', labelKey: 'idPhoto.bgRed', hintKey: 'idPhoto.bgRedHint' },
          { id: 'blue', labelKey: 'idPhoto.bgBlue', hintKey: 'idPhoto.bgBlueHint' },
          { id: 'white', labelKey: 'idPhoto.bgWhite', hintKey: 'idPhoto.bgWhiteHint' }
        ]
      }
    ],
    buildPrompt: (params) => {
      const gender = GENDER_MAP[params.gender as string] ?? '人物'
      const size = SIZE_MAP[params.size as string] ?? '一寸'
      const bg = BG_MAP[params.background as string] ?? '纯净白色'
      return `将图中的【${gender}】照片处理为标准【${size}】证件照，保持人物面部不变，更换为${bg}背景，调整光影适配证件照规范，裁剪保留头部肩部构图，校正面部光线`
    },
    genDefaults: { strength: 0.68, scale: 2, quality: 'high', denoise: 0.78, saturation: 10 }
  },
  {
    id: 'photo-repair',
    labelKey: 'photoRepair.title',
    descriptionKey: 'photoRepair.subtitle',
    icon: Palette,
    params: [
      { id: 'enhance', type: 'toggle', labelKey: 'photoRepair.enhance', defaultValue: true },
      { id: 'colorize', type: 'toggle', labelKey: 'photoRepair.colorize', defaultValue: true },
      { id: 'removeDamage', type: 'toggle', labelKey: 'photoRepair.removeDamage', defaultValue: true },
      { id: 'hdRestore', type: 'toggle', labelKey: 'photoRepair.hdRestore', defaultValue: true },
      { id: 'denoise', type: 'slider', labelKey: 'photoRepair.denoise', min: 0, max: 100, step: 1, defaultValue: 85 },
      {
        id: 'saturation',
        type: 'slider',
        labelKey: 'photoRepair.saturation',
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 52
      }
    ],
    buildPrompt: (params) => {
      const parts = ['修复老照片，清晰化面部细节，保持原照片的人物特征和构图']
      const prompts: Record<string, string> = {
        enhance: '增强清晰度',
        colorize: '智能上色（还原自然肤色和服装的真实色彩）',
        removeDamage: '去除划痕与噪点',
        hdRestore: '高清修复'
      }
      for (const [k, v] of Object.entries(prompts)) {
        if (params[k]) parts.push(v)
      }
      return parts.join('，')
    },
    genDefaults: { strength: 0.72, scale: 2, quality: 'high', denoise: 0.85, saturation: 52 }
  },
  {
    id: 'bg-remove',
    labelKey: 'smartTools.bgRemove.title',
    descriptionKey: 'smartTools.bgRemove.description',
    icon: Eraser,
    params: [],
    buildPrompt: () => '移除图像背景，输出透明背景的PNG图片',
    genDefaults: { strength: 0.7, scale: 1, quality: 'high', denoise: 0, saturation: 0 }
  },
  {
    id: 'auto-enhance',
    labelKey: 'smartTools.autoEnhance.title',
    descriptionKey: 'smartTools.autoEnhance.description',
    icon: Sparkles,
    params: [
      {
        id: 'brightness',
        type: 'slider',
        labelKey: 'smartTools.autoEnhance.brightness',
        min: -50,
        max: 50,
        step: 1,
        defaultValue: 0
      },
      {
        id: 'contrast',
        type: 'slider',
        labelKey: 'smartTools.autoEnhance.contrast',
        min: -50,
        max: 50,
        step: 1,
        defaultValue: 0
      },
      {
        id: 'sharpness',
        type: 'slider',
        labelKey: 'smartTools.autoEnhance.sharpness',
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 30
      }
    ],
    buildPrompt: (params) => {
      const parts = ['增强画质']
      if (params.brightness && params.brightness !== 0) parts.push('调整亮度')
      if (params.contrast && params.contrast !== 0) parts.push('优化对比度')
      if (params.sharpness) parts.push(`锐化${params.sharpness}%`)
      return parts.join('，')
    },
    genDefaults: { strength: 0.5, scale: 1, quality: 'high', denoise: 30, saturation: 5 }
  },
  {
    id: 'style-transfer',
    labelKey: 'smartTools.styleTransfer.title',
    descriptionKey: 'smartTools.styleTransfer.description',
    icon: Wand2,
    params: [
      {
        id: 'style',
        type: 'select',
        labelKey: 'smartTools.styleTransfer.style',
        defaultValue: 'anime',
        options: [
          { id: 'anime', labelKey: 'smartTools.styleTransfer.anime', hintKey: 'smartTools.styleTransfer.animeHint' },
          {
            id: 'oil-painting',
            labelKey: 'smartTools.styleTransfer.oilPainting',
            hintKey: 'smartTools.styleTransfer.oilPaintingHint'
          },
          {
            id: 'watercolor',
            labelKey: 'smartTools.styleTransfer.watercolor',
            hintKey: 'smartTools.styleTransfer.watercolorHint'
          },
          { id: 'sketch', labelKey: 'smartTools.styleTransfer.sketch', hintKey: 'smartTools.styleTransfer.sketchHint' },
          {
            id: 'cyberpunk',
            labelKey: 'smartTools.styleTransfer.cyberpunk',
            hintKey: 'smartTools.styleTransfer.cyberpunkHint'
          }
        ]
      }
    ],
    buildPrompt: (params) => {
      const m: Record<string, string> = {
        anime: '转换为日系动漫风格，保留原图构图，使用干净线条和柔和色彩',
        'oil-painting': '转换为油画风格，厚重的笔触和丰富的色彩层次',
        watercolor: '转换为水彩画风格，透明轻盈的色调和流动感',
        sketch: '转换为素描风格，黑白灰的细腻线条表现',
        cyberpunk: '转换为赛博朋克风格，霓虹灯光和科技感色调'
      }
      return m[params.style as string] ?? m.anime
    },
    genDefaults: { strength: 0.65, scale: 1, quality: 'high', denoise: 20, saturation: 15 }
  },
  {
    id: 'hairstyle-report',
    labelKey: 'smartTools.hairstyle.title',
    descriptionKey: 'smartTools.hairstyle.description',
    icon: Scissors,
    params: [],
    buildPrompt: () => {
      return `请基于上传的正面形象照片，生成一张横向 4:3 的高完成度「AI 发型美学升级报告」。严格保留用户本人的脸部辨识度、五官结构、脸型比例、年龄感、皮肤真实质感、表情气质和原有穿搭。本次升级重点只放在发型设计上。画面采用「左侧 Before 原始发型大图 + 右侧 After 主推发型大图 + 中下部 Best Options 推荐区 + 下方 Less Flattering 避雷区 + 底部 Hair Style Guide 执行指南」的结构。整体视觉高级清爽、留白合理。After 发型方向偏韩系自然、Clean Cut、松弛有型、低维护。标题：AI 发型美学升级报告。包含专业注释标注（刘海、头顶蓬松度、两侧体积、层次、发尾、发色）、4个推荐发型方案卡、3个不推荐方案（带轻微趣味感但不过度恶搞）、底部执行指南和自然发色色卡。避免改变五官、瘦脸、磨皮、换穿搭。不要杀马特、二次元、过度油头漂染。底部标注：本报告为AI发型美学视觉提案，仅供参考。实际发型建议请以专业发型师面诊为准。`
    },
    genDefaults: { strength: 0.7, scale: 2, quality: 'high', denoise: 0.75, saturation: 8 }
  },
  {
    id: 'style-upgrade',
    labelKey: 'smartTools.styleUpgrade.title',
    descriptionKey: 'smartTools.styleUpgrade.description',
    icon: Shirt,
    params: [
      {
        id: 'styleDirection',
        type: 'select',
        labelKey: 'smartTools.styleUpgrade.styleDirection',
        defaultValue: 'korean-clean',
        options: [
          { id: 'korean-clean', labelKey: 'smartTools.styleUpgrade.koreanClean' },
          { id: 'city-boy', labelKey: 'smartTools.styleUpgrade.cityBoy' },
          { id: 'japanese-minimal', labelKey: 'smartTools.styleUpgrade.japaneseMinimal' },
          { id: 'hk-relaxed', labelKey: 'smartTools.styleUpgrade.hkRelaxed' }
        ]
      }
    ],
    buildPrompt: (params: Record<string, unknown>) => {
      const styleNames: Record<string, string> = {
        'korean-clean': '韩系轻潮',
        'city-boy': 'City Boy 都市休闲',
        'japanese-minimal': '日系简约街头',
        'hk-relaxed': '港风松弛有型'
      }
      const styleName = styleNames[params.styleDirection as string] ?? '韩系轻潮'
      return `请基于上传的形象照片，生成一张横向 4:3 的高完成度「AI 衣品升级改造报告」。保留用户本人的基础身份特征、脸部辨识度、五官特征、发型特征和整体气质，但在不改变"这个人是谁"的前提下，对整体穿搭、气质、比例、层次、配饰和上镜状态进行明显升级。核心审美方向：${styleName}、Clean Fit、清爽高级、日常可穿、上镜好看。画面采用 Before vs After 双人像强对比（占55%-60%视觉权重），左边 Before 呈现原始穿着基线，右边 After 呈现明显更帅更潮更有型的新形象。版式像潮流杂志内页+专业形象顾问提案板，包含：风格主题、核心变化点标签、色系选择色卡、材质构成展示、廓形比例策略、3套推荐Look缩略图、关键单品升级展示、细节箭头注释、底部总结。After 穿搭逻辑：短款夹克/工装夹克/干净衬衫外套 + 高质感内搭 + 直筒裤/微阔裤 + 复古运动鞋/德训鞋 + 小体量斜挎包/项链/手表等精致配饰。避免After古板老气商务化、普通夹克西裤、全身灰黑沉闷、过度暗黑或花哨、像Excel表格。输出高完成度、高级潮流杂志感的个人穿搭升级方案。`
    },
    genDefaults: { strength: 0.7, scale: 2, quality: 'high', denoise: 0.75, saturation: 10 }
  },
  {
    id: 'ai-portrait',
    labelKey: 'smartTools.aiPortrait.title',
    descriptionKey: 'smartTools.aiPortrait.description',
    icon: Star,
    params: [
      {
        id: 'style',
        type: 'select',
        labelKey: 'smartTools.aiPortrait.style',
        defaultValue: 'professional',
        options: [
          { id: 'professional', labelKey: 'smartTools.aiPortrait.professional' },
          { id: 'artistic', labelKey: 'smartTools.aiPortrait.artistic' },
          { id: 'street', labelKey: 'smartTools.aiPortrait.street' },
          { id: 'cinematic', labelKey: 'smartTools.aiPortrait.cinematic' }
        ]
      }
    ],
    buildPrompt: (params) => {
      const styles: Record<string, string> = {
        professional: '专业商务形象照，柔和棚拍布光，干净背景，自信自然的微笑，西装或商务休闲穿搭，高端职业人像摄影',
        artistic: '艺术写真风格，柔焦奶油色背景，电影感侧光，高级艺术人像，细腻肤质质感，淡雅色调',
        street: '都市街拍风格，自然光，潮流穿搭，城市背景虚化，真实街景氛围，时尚杂志感',
        cinematic: '电影感肖像，戏剧性光影，深邃背景，情绪感氛围，胶片色调，专业级电影人像'
      }
      return `基于上传的人脸照片生成一张${styles[params.style as string] ?? styles.professional}。严格保留人物面部辨识度、五官结构和个人特征，仅提升光影、背景和整体质感。`
    },
    genDefaults: { strength: 0.65, scale: 2, quality: 'high', denoise: 0.7, saturation: 8 }
  },
  {
    id: 'photo-anime',
    labelKey: 'smartTools.photoAnime.title',
    descriptionKey: 'smartTools.photoAnime.description',
    icon: Brush,
    params: [
      {
        id: 'style',
        type: 'select',
        labelKey: 'smartTools.photoAnime.style',
        defaultValue: 'ghibli',
        options: [
          { id: 'ghibli', labelKey: 'smartTools.photoAnime.ghibli' },
          { id: 'shinkai', labelKey: 'smartTools.photoAnime.shinkai' },
          { id: 'jojo', labelKey: 'smartTools.photoAnime.jojo' },
          { id: 'demonslayer', labelKey: 'smartTools.photoAnime.demonslayer' },
          { id: 'disney', labelKey: 'smartTools.photoAnime.disney' }
        ]
      }
    ],
    buildPrompt: (params) => {
      const styles: Record<string, string> = {
        ghibli: '吉卜力/宫崎骏动画风格，柔和温暖的手绘质感，自然色调，角色化处理保留人物特征，经典日式动画电影感',
        shinkai: '新海诚动画风格，极致细腻的光影渲染，高饱和度的天空和场景，电影级画面质感，唯美写实动画风',
        jojo: 'JoJo的奇妙冒险漫画风格，强烈的线条勾勒，戏剧化的轮廓阴影，夸张但保留辨识度的角色化',
        demonslayer: '鬼灭之刃动画风格，浮世绘质感笔触，和风色调，锐利线条，日式美学角色化',
        disney: '迪士尼 3D 动画风格，圆润柔和的角色造型，丰富的表情和光影，保留人物特征的角色化处理'
      }
      return `将照片转换为${styles[params.style as string] ?? styles.ghibli}。保留原始人物特征和面部辨识度，仅改变绘画风格和画面质感。`
    },
    genDefaults: { strength: 0.75, scale: 1, quality: 'high', denoise: 0.5, saturation: 18 }
  },
  {
    id: 'product-enhance',
    labelKey: 'smartTools.productEnhance.title',
    descriptionKey: 'smartTools.productEnhance.description',
    icon: ImageUp,
    params: [
      {
        id: 'platform',
        type: 'select',
        labelKey: 'smartTools.productEnhance.platform',
        defaultValue: 'taobao',
        options: [
          { id: 'taobao', labelKey: 'smartTools.productEnhance.taobao' },
          { id: 'jd', labelKey: 'smartTools.productEnhance.jd' },
          { id: 'amazon', labelKey: 'smartTools.productEnhance.amazon' },
          { id: 'pdd', labelKey: 'smartTools.productEnhance.pdd' }
        ]
      },
      {
        id: 'removeWatermark',
        type: 'toggle',
        labelKey: 'smartTools.productEnhance.removeWatermark',
        defaultValue: true
      },
      { id: 'whitenBg', type: 'toggle', labelKey: 'smartTools.productEnhance.whitenBg', defaultValue: true }
    ],
    buildPrompt: (params) => {
      const parts = ['优化商品主图，提升商品质感，增强光影层次和细节清晰度，专业电商产品摄影风格']
      if (params.removeWatermark) parts.push('自动去除图片上的水印和文字')
      if (params.whitenBg) parts.push('提亮背景为干净纯白/浅灰')
      return parts.join('，')
    },
    genDefaults: { strength: 0.55, scale: 1, quality: 'high', denoise: 0.4, saturation: 5 }
  },
  {
    id: 'product-hero',
    labelKey: 'smartTools.productHero.title',
    descriptionKey: 'smartTools.productHero.description',
    icon: ImageDown,
    params: [
      {
        id: 'style',
        type: 'select',
        labelKey: 'smartTools.productHero.style',
        defaultValue: 'white-bg',
        options: [
          { id: 'white-bg', labelKey: 'smartTools.productHero.whiteBg' },
          { id: 'scene', labelKey: 'smartTools.productHero.scene' },
          { id: 'detail', labelKey: 'smartTools.productHero.detail' },
          { id: 'lifestyle', labelKey: 'smartTools.productHero.lifestyle' }
        ]
      }
    ],
    buildPrompt: (params) => {
      const styles: Record<string, string> = {
        'white-bg': '专业白底商品首图，柔和棚拍布光，产品居中展示，高画质细节呈现，干净高级的电商主图风格',
        scene: '商品场景展示图，将产品自然融入高端使用场景，真实环境光影，商业摄影级别，展现产品应用场景',
        detail: '商品细节特写图，微距级别展示产品材质、纹理和工艺细节，浅景深突出核心卖点',
        lifestyle: '商品生活方式图，产品在真实生活场景中的自然呈现，人物手持或使用产品的温馨画面，自然光线'
      }
      return `基于上传的商品图片，生成一张${styles[params.style as string] ?? styles['white-bg']}。保留产品的准确外观、颜色和材质，仅优化光影、构图和背景氛围。`
    },
    genDefaults: { strength: 0.55, scale: 1, quality: 'high', denoise: 0.35, saturation: 8 }
  },
  {
    id: 'art-filter',
    labelKey: 'smartTools.artFilter.title',
    descriptionKey: 'smartTools.artFilter.description',
    icon: Palette,
    params: [
      {
        id: 'style',
        type: 'select',
        labelKey: 'smartTools.artFilter.style',
        defaultValue: '3d-render',
        options: [
          { id: '3d-render', labelKey: 'smartTools.artFilter.3dRender' },
          { id: 'pixel-art', labelKey: 'smartTools.artFilter.pixelArt' },
          { id: 'ukiyoe', labelKey: 'smartTools.artFilter.ukiyoe' },
          { id: 'ink-wash', labelKey: 'smartTools.artFilter.inkWash' },
          { id: 'pop-art', labelKey: 'smartTools.artFilter.popArt' },
          { id: 'vintage-film', labelKey: 'smartTools.artFilter.vintageFilm' }
        ]
      }
    ],
    buildPrompt: (params) => {
      const styles: Record<string, string> = {
        '3d-render': '高质量 3D 渲染风格，类似皮克斯/迪士尼的材质质感，圆润饱满的造型，柔和的高级光照，干净的背景',
        'pixel-art': '经典像素艺术风格，8-bit/16-bit 游戏画面质感，清晰的像素格，复古电子游戏美学',
        ukiyoe: '日本浮世绘风格，葛饰北斋式笔触和配色，平面化构图，和风色彩体系，传统木板刻画质感',
        'ink-wash': '中国传统水墨画风格，浓淡墨色晕染，留白意境，写意笔法，宣纸质感和毛笔纹理',
        'pop-art': '安迪沃霍尔波普艺术风格，高饱和对比色，丝网印刷质感，大胆的色块分割和网点纹理',
        'vintage-film': '复古胶片风格，35mm胶片颗粒感，褪色暖调，轻微漏光和暗角，80-90年代冲印质感'
      }
      return `将照片转换为${styles[params.style as string] ?? styles['3d-render']}。保留原始画面构图和主体特征，仅改变艺术风格和画面质感。`
    },
    genDefaults: { strength: 0.7, scale: 1, quality: 'high', denoise: 0.25, saturation: 20 }
  },
  {
    id: 'logo-gen',
    labelKey: 'smartTools.logoGen.title',
    descriptionKey: 'smartTools.logoGen.description',
    icon: Puzzle,
    params: [
      {
        id: 'industry',
        type: 'select',
        labelKey: 'smartTools.logoGen.industry',
        defaultValue: 'tech',
        options: [
          { id: 'tech', labelKey: 'smartTools.logoGen.tech' },
          { id: 'beauty', labelKey: 'smartTools.logoGen.beauty' },
          { id: 'food', labelKey: 'smartTools.logoGen.food' },
          { id: 'fashion', labelKey: 'smartTools.logoGen.fashion' },
          { id: 'fitness', labelKey: 'smartTools.logoGen.fitness' }
        ]
      },
      {
        id: 'style',
        type: 'select',
        labelKey: 'smartTools.logoGen.style',
        defaultValue: 'minimal',
        options: [
          { id: 'minimal', labelKey: 'smartTools.logoGen.minimal' },
          { id: 'gradient', labelKey: 'smartTools.logoGen.gradient' },
          { id: 'line-art', labelKey: 'smartTools.logoGen.lineArt' },
          { id: 'vintage', labelKey: 'smartTools.logoGen.vintage' }
        ]
      }
    ],
    buildPrompt: (params) => {
      const industries: Record<string, string> = {
        tech: '科技/互联网',
        beauty: '美妆/护肤',
        food: '餐饮/食品',
        fashion: '时尚/服饰',
        fitness: '健身/运动'
      }
      const styles: Record<string, string> = {
        minimal: '极简风格，干净的几何图形，留白设计，纯色或双色搭配',
        gradient: '渐变风格，现代渐变色图标，流畅的曲线和渐变过渡',
        'line-art': '线性艺术风格，优雅的单线条勾勒，精致的轮廓设计',
        vintage: '复古风格，经典徽章式设计，衬线字体，怀旧质感'
      }
      const industry = industries[params.industry as string] ?? '科技'
      const style = styles[params.style as string] ?? styles.minimal
      return `设计一个${industry}行业的品牌Logo，${style}，适合应用图标和网站favicon，正方形构图，白色/浅灰背景，无需文字（纯图形标记）。`
    },
    genDefaults: { strength: 0.6, scale: 2, quality: 'high', denoise: 0.1, saturation: 0 }
  },
  {
    id: 'photo-collage',
    labelKey: 'smartTools.photoCollage.title',
    descriptionKey: 'smartTools.photoCollage.description',
    icon: LayoutTemplate,
    params: [
      {
        id: 'layout',
        type: 'select',
        labelKey: 'smartTools.photoCollage.layout',
        defaultValue: 'grid-9',
        options: [
          { id: 'grid-9', labelKey: 'smartTools.photoCollage.grid9' },
          { id: 'xiaohongshu', labelKey: 'smartTools.photoCollage.xiaohongshu' },
          { id: 'compare', labelKey: 'smartTools.photoCollage.compare' },
          { id: 'grid-4', labelKey: 'smartTools.photoCollage.grid4' }
        ]
      },
      {
        id: 'ratio',
        type: 'select',
        labelKey: 'smartTools.photoCollage.ratio',
        defaultValue: '1:1',
        options: [
          { id: '1:1', labelKey: 'smartTools.photoCollage.square' },
          { id: '3:4', labelKey: 'smartTools.photoCollage.vertical' },
          { id: '16:9', labelKey: 'smartTools.photoCollage.wide' }
        ]
      }
    ],
    buildPrompt: (params) => {
      const layouts: Record<string, string> = {
        'grid-9': '3×3 九宫格均匀拼接排版，每格大小一致，等距间隔，白色细边框',
        xiaohongshu: '小红书风格竖版长图拼接，三张图片上下排列，中间留白，适合社交分享',
        compare: '左右对比排版，Before/After 并排展示，中间分割线，标注标签',
        'grid-4': '2×2 四宫格拼接排版，每格大小一致，等距间隔，适合多角度展示'
      }
      return `将上传的多张图片按照${layouts[params.layout as string] ?? layouts['grid-9']}的方式进行智能排版拼接。保持每张图片的原始内容不变，仅做裁剪适配和排版拼接。`
    },
    genDefaults: { strength: 0.3, scale: 2, quality: 'high', denoise: 0.1, saturation: 0 }
  },
  {
    id: 'photo-restore-pro',
    labelKey: 'smartTools.photoRestorePro.title',
    descriptionKey: 'smartTools.photoRestorePro.description',
    icon: Wand2,
    params: [
      {
        id: 'upscale',
        type: 'select',
        labelKey: 'smartTools.photoRestorePro.upscale',
        defaultValue: '2x',
        options: [
          { id: '2x', labelKey: 'smartTools.photoRestorePro.2x' },
          { id: '4x', labelKey: 'smartTools.photoRestorePro.4x' }
        ]
      },
      { id: 'faceEnhance', type: 'toggle', labelKey: 'smartTools.photoRestorePro.faceEnhance', defaultValue: true },
      {
        id: 'scratchRepair',
        type: 'slider',
        labelKey: 'smartTools.photoRestorePro.scratchRepair',
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 80
      },
      {
        id: 'perspectiveFix',
        type: 'toggle',
        labelKey: 'smartTools.photoRestorePro.perspectiveFix',
        defaultValue: true
      }
    ],
    buildPrompt: (params) => {
      const parts = [`超分辨率修复老照片，放大至${params.upscale ?? '2x'}倍，保持细节清晰不模糊`]
      if (params.faceEnhance) parts.push('AI 人脸增强，恢复模糊面部细节，提升五官清晰度')
      parts.push(`划痕和折痕修复强度 ${params.scratchRepair ?? 80}%`)
      if (params.perspectiveFix) parts.push('自动矫正翻拍导致的透视畸变和歪斜')
      parts.push('去噪、去黄、色彩还原，最终输出高质量翻新照片')
      return parts.join('，')
    },
    genDefaults: { strength: 0.6, scale: 2, quality: 'ultra', denoise: 0.9, saturation: 45 }
  }
]

export function getToolById(id: string): SmartTool | undefined {
  return SMART_TOOLS.find((t) => t.id === id)
}

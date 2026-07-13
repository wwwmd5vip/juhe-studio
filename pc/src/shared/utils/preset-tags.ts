import type { PresetCategoryConfig, PresetTag } from '../types/prompt-system'

export const presetCategories: PresetCategoryConfig[] = [
  { id: 'style', label: '风格', icon: 'Palette', description: '艺术风格与流派' },
  { id: 'medium', label: '媒介', icon: 'Brush', description: '材质与表现媒介' },
  { id: 'camera', label: '镜头', icon: 'Camera', description: '摄影机位与构图' },
  { id: 'lighting', label: '光影', icon: 'Sun', description: '光照条件与氛围' },
  { id: 'quality', label: '画质', icon: 'Sparkles', description: '分辨率与质量修饰' },
  { id: 'color', label: '色彩', icon: 'Droplets', description: '色调与配色方案' },
  { id: 'mood', label: '氛围', icon: 'Cloud', description: '情绪与氛围表达' },
  { id: 'detail', label: '细节', icon: 'Focus', description: '细节精度与装饰' },
  { id: 'subject', label: '主体', icon: 'User', description: '人物与生物类型' },
  { id: 'background', label: '背景', icon: 'Mountains', description: '环境背景设定' },
  { id: 'pose', label: '姿态', icon: 'Move', description: '动作与姿势' },
  { id: 'era', label: '时代', icon: 'Clock', description: '历史时期与年代' }
]

export const presetTags: PresetTag[] = [
  // ===== 风格 =====
  { id: 's1', label: '写实', en: 'photorealistic, ultra realistic', zh: '写实', category: 'style', popular: true },
  { id: 's2', label: '油画', en: 'oil painting, fine art', zh: '油画', category: 'style' },
  { id: 's3', label: '水彩', en: 'watercolor painting, soft wash', zh: '水彩', category: 'style' },
  {
    id: 's4',
    label: '赛博朋克',
    en: 'cyberpunk, neon lights, futuristic',
    zh: '赛博朋克',
    category: 'style',
    popular: true
  },
  { id: 's5', label: '吉卜力', en: 'Studio Ghibli style, anime', zh: '吉卜力风格', category: 'style' },
  { id: 's6', label: '像素风', en: 'pixel art, 8-bit style', zh: '像素风', category: 'style' },
  { id: 's7', label: '宫崎骏', en: 'Hayao Miyazaki style, whimsical anime', zh: '宫崎骏风格', category: 'style' },
  { id: 's8', label: '新海诚', en: 'Makoto Shinkai style, vivid anime', zh: '新海诚风格', category: 'style' },
  { id: 's9', label: '蒸汽波', en: 'vaporwave, retro aesthetic', zh: '蒸汽波', category: 'style' },
  { id: 's10', label: '低多边形', en: 'low poly, geometric art', zh: '低多边形', category: 'style' },
  { id: 's11', label: '素描', en: 'pencil sketch, hand drawn', zh: '素描', category: 'style' },
  { id: 's12', label: '浮世绘', en: 'ukiyo-e, Japanese woodblock print', zh: '浮世绘', category: 'style' },
  {
    id: 's13',
    label: '3D渲染',
    en: '3D render, octane render, blender',
    zh: '3D渲染',
    category: 'style',
    popular: true
  },
  { id: 's14', label: '概念艺术', en: 'concept art, digital painting', zh: '概念艺术', category: 'style' },
  { id: 's15', label: '极简主义', en: 'minimalist, clean lines, simple', zh: '极简主义', category: 'style' },
  { id: 's16', label: '暗黑奇幻', en: 'dark fantasy, grim atmosphere', zh: '暗黑奇幻', category: 'style' },
  { id: 's17', label: '波普艺术', en: 'pop art, bold colors, Andy Warhol', zh: '波普艺术', category: 'style' },
  { id: 's18', label: '印象派', en: 'impressionist, Monet style, soft brushstrokes', zh: '印象派', category: 'style' },
  { id: 's19', label: '故障艺术', en: 'glitch art, digital distortion', zh: '故障艺术', category: 'style' },
  {
    id: 's20',
    label: '超现实主义',
    en: 'surrealism, Salvador Dali style, dreamlike',
    zh: '超现实主义',
    category: 'style'
  },

  // ===== 媒介 =====
  { id: 'm1', label: '数字绘画', en: 'digital painting', zh: '数字绘画', category: 'medium' },
  { id: 'm2', label: '胶片', en: 'film grain, analog photography', zh: '胶片质感', category: 'medium' },
  { id: 'm3', label: 'CG', en: 'CG art, computer graphics', zh: 'CG', category: 'medium' },
  { id: 'm4', label: '黏土', en: 'claymation, clay figure', zh: '黏土', category: 'medium' },
  { id: 'm5', label: '纸艺', en: 'paper cut art, origami style', zh: '纸艺', category: 'medium' },
  { id: 'm6', label: '墨水', en: 'ink wash, Chinese ink painting', zh: '水墨', category: 'medium' },
  { id: 'm7', label: '蜡笔', en: 'crayon drawing, pastel colors', zh: '蜡笔画', category: 'medium' },

  // ===== 镜头 =====
  { id: 'c1', label: '特写', en: 'extreme close-up, macro shot', zh: '特写', category: 'camera', popular: true },
  { id: 'c2', label: '中景', en: 'medium shot, waist up', zh: '中景', category: 'camera' },
  { id: 'c3', label: '全景', en: 'wide shot, full body', zh: '全景', category: 'camera' },
  { id: 'c4', label: '鸟瞰', en: 'aerial view, bird eye view', zh: '鸟瞰', category: 'camera' },
  { id: 'c5', label: '鱼眼', en: 'fisheye lens, distorted perspective', zh: '鱼眼镜头', category: 'camera' },
  { id: 'c6', label: '景深', en: 'shallow depth of field, bokeh', zh: '浅景深', category: 'camera' },
  { id: 'c7', label: '对称构图', en: 'symmetrical composition, centered', zh: '对称构图', category: 'camera' },
  { id: 'c8', label: '三分法', en: 'rule of thirds, balanced composition', zh: '三分法构图', category: 'camera' },
  { id: 'c9', label: '低角度', en: 'low angle shot, looking up', zh: '低角度', category: 'camera' },
  { id: 'c10', label: '长焦', en: 'telephoto lens, compressed perspective', zh: '长焦镜头', category: 'camera' },
  { id: 'c11', label: '广角', en: 'wide angle lens, expansive view', zh: '广角镜头', category: 'camera' },
  { id: 'c12', label: '移轴', en: 'tilt-shift, miniature effect', zh: '移轴摄影', category: 'camera' },

  // ===== 光影 =====
  { id: 'l1', label: '自然光', en: 'natural lighting, soft light', zh: '自然光', category: 'lighting' },
  {
    id: 'l2',
    label: '黄金时刻',
    en: 'golden hour, warm sunlight',
    zh: '黄金时刻',
    category: 'lighting',
    popular: true
  },
  { id: 'l3', label: '蓝调时刻', en: 'blue hour, twilight', zh: '蓝调时刻', category: 'lighting' },
  { id: 'l4', label: '霓虹灯', en: 'neon lighting, colorful glow', zh: '霓虹灯', category: 'lighting' },
  { id: 'l5', label: '体积光', en: 'volumetric lighting, god rays', zh: '体积光', category: 'lighting' },
  { id: 'l6', label: '侧光', en: 'side lighting, dramatic shadows', zh: '侧光', category: 'lighting' },
  { id: 'l7', label: '逆光', en: 'backlight, silhouette', zh: '逆光', category: 'lighting' },
  { id: 'l8', label: '柔光箱', en: 'softbox lighting, studio light', zh: '柔光箱', category: 'lighting' },
  { id: 'l9', label: '烛光', en: 'candlelight, warm flicker', zh: '烛光', category: 'lighting' },
  {
    id: 'l10',
    label: '丁达尔效应',
    en: 'Tyndall effect, light rays through mist',
    zh: '丁达尔效应',
    category: 'lighting'
  },
  { id: 'l11', label: '夜景', en: 'night scene, city lights', zh: '夜景', category: 'lighting' },
  { id: 'l12', label: '伦勃朗光', en: 'Rembrandt lighting, dramatic portrait', zh: '伦勃朗光', category: 'lighting' },

  // ===== 画质 =====
  { id: 'q1', label: '8K', en: '8k resolution, ultra detailed', zh: '8K', category: 'quality', popular: true },
  { id: 'q2', label: '4K', en: '4k resolution, highly detailed', zh: '4K', category: 'quality' },
  { id: 'q3', label: '超精细', en: 'hyper detailed, intricate details', zh: '超精细', category: 'quality' },
  {
    id: 'q4',
    label: '大师级',
    en: 'masterpiece, best quality, award winning',
    zh: '大师级',
    category: 'quality',
    popular: true
  },
  { id: 'q5', label: '电影级', en: 'cinematic, film still, movie quality', zh: '电影级', category: 'quality' },
  { id: 'q6', label: '高动态', en: 'HDR, high dynamic range', zh: 'HDR', category: 'quality' },
  { id: 'q7', label: '锐化', en: 'sharp focus, crisp edges', zh: '锐化', category: 'quality' },
  { id: 'q8', label: 'RAW', en: 'raw photo, unprocessed', zh: 'RAW', category: 'quality' },
  { id: 'q9', label: '壁纸级', en: 'wallpaper, desktop background quality', zh: '壁纸级', category: 'quality' },

  // ===== 色彩 =====
  { id: 'co1', label: '暖色调', en: 'warm colors, orange and yellow tones', zh: '暖色调', category: 'color' },
  { id: 'co2', label: '冷色调', en: 'cool colors, blue and cyan tones', zh: '冷色调', category: 'color' },
  { id: 'co3', label: '黑白', en: 'black and white, monochrome', zh: '黑白', category: 'color' },
  { id: 'co4', label: '赛博配色', en: 'neon color palette, magenta and cyan', zh: '赛博配色', category: 'color' },
  { id: 'co5', label: ' pastel', en: 'pastel colors, soft palette', zh: '粉彩', category: 'color' },
  { id: 'co6', label: '高饱和', en: 'vibrant colors, saturated, vivid', zh: '高饱和', category: 'color' },
  { id: 'co7', label: '低饱和', en: 'muted colors, desaturated, muted tones', zh: '低饱和', category: 'color' },
  { id: 'co8', label: '金色调', en: 'golden tones, amber glow', zh: '金色调', category: 'color' },
  { id: 'co9', label: '青橙色调', en: 'teal and orange, cinematic color grading', zh: '青橙色调', category: 'color' },

  // ===== 氛围 =====
  { id: 'mo1', label: '神秘', en: 'mysterious, enigmatic atmosphere', zh: '神秘', category: 'mood' },
  { id: 'mo2', label: '宁静', en: 'serene, peaceful, calm', zh: '宁静', category: 'mood' },
  { id: 'mo3', label: '史诗', en: 'epic, grand, majestic', zh: '史诗', category: 'mood' },
  { id: 'mo4', label: '恐怖', en: 'horror, eerie, unsettling', zh: '恐怖', category: 'mood' },
  { id: 'mo5', label: '浪漫', en: 'romantic, dreamy, soft', zh: '浪漫', category: 'mood' },
  { id: 'mo6', label: '孤独', en: 'lonely, solitary, melancholic', zh: '孤独', category: 'mood' },
  { id: 'mo7', label: '活力', en: 'energetic, dynamic, vibrant', zh: '活力', category: 'mood' },
  { id: 'mo8', label: '怀旧', en: 'nostalgic, vintage, retro', zh: '怀旧', category: 'mood' },
  { id: 'mo9', label: '未来', en: 'futuristic, sci-fi, advanced', zh: '未来感', category: 'mood' },
  { id: 'mo10', label: '魔幻', en: 'magical, enchanted, mystical', zh: '魔幻', category: 'mood' },

  // ===== 细节 =====
  { id: 'd1', label: '毛发细节', en: 'detailed fur, hair texture', zh: '毛发细节', category: 'detail' },
  { id: 'd2', label: '皮肤纹理', en: 'detailed skin texture, pores', zh: '皮肤纹理', category: 'detail' },
  { id: 'd3', label: '金属反光', en: 'metallic reflection, chrome surface', zh: '金属反光', category: 'detail' },
  { id: 'd4', label: '布料纹理', en: 'fabric texture, cloth folds', zh: '布料纹理', category: 'detail' },
  { id: 'd5', label: '水珠', en: 'water droplets, wet surface', zh: '水珠', category: 'detail' },
  { id: 'd6', label: '粒子效果', en: 'particle effects, dust motes', zh: '粒子效果', category: 'detail' },
  { id: 'd7', label: '划痕磨损', en: 'scratches, weathered, worn', zh: '划痕磨损', category: 'detail' },
  { id: 'd8', label: '玻璃折射', en: 'glass refraction, transparent', zh: '玻璃折射', category: 'detail' },

  // ===== 主体 =====
  { id: 'su1', label: '少女', en: 'beautiful girl, young woman', zh: '少女', category: 'subject', popular: true },
  { id: 'su2', label: '少年', en: 'handsome boy, young man', zh: '少年', category: 'subject' },
  { id: 'su3', label: '龙', en: 'dragon, mythical creature', zh: '龙', category: 'subject' },
  { id: 'su4', label: '机甲', en: 'mecha, robot, mechanical suit', zh: '机甲', category: 'subject' },
  { id: 'su5', label: '猫', en: 'cat, feline', zh: '猫', category: 'subject' },
  { id: 'su6', label: '狼', en: 'wolf, canine', zh: '狼', category: 'subject' },
  { id: 'su7', label: '狐狸', en: 'fox, kitsune', zh: '狐狸', category: 'subject' },
  { id: 'su8', label: '精灵', en: 'elf, fairy, fae', zh: '精灵', category: 'subject' },
  { id: 'su9', label: '宇航员', en: 'astronaut, space suit', zh: '宇航员', category: 'subject' },
  { id: 'su10', label: '武士', en: 'samurai, warrior', zh: '武士', category: 'subject' },
  { id: 'su11', label: '女巫', en: 'witch, sorceress', zh: '女巫', category: 'subject' },

  // ===== 背景 =====
  { id: 'bg1', label: '星空', en: 'starry sky, cosmos, galaxy', zh: '星空', category: 'background', popular: true },
  { id: 'bg2', label: '城市', en: 'cityscape, urban environment', zh: '城市', category: 'background' },
  { id: 'bg3', label: '森林', en: 'forest, woodland, trees', zh: '森林', category: 'background' },
  { id: 'bg4', label: '海洋', en: 'ocean, sea, underwater', zh: '海洋', category: 'background' },
  { id: 'bg5', label: '雪山', en: 'snowy mountains, alpine', zh: '雪山', category: 'background' },
  { id: 'bg6', label: '沙漠', en: 'desert, sand dunes', zh: '沙漠', category: 'background' },
  { id: 'bg7', label: '废墟', en: 'ruins, abandoned building', zh: '废墟', category: 'background' },
  { id: 'bg8', label: '花园', en: 'garden, flowers, botanical', zh: '花园', category: 'background' },
  { id: 'bg9', label: '太空站', en: 'space station, orbital', zh: '太空站', category: 'background' },
  { id: 'bg10', label: '雨夜', en: 'rainy night, wet streets', zh: '雨夜', category: 'background' },

  // ===== 姿态 =====
  { id: 'p1', label: '站立', en: 'standing pose', zh: '站立', category: 'pose' },
  { id: 'p2', label: '坐姿', en: 'sitting pose', zh: '坐姿', category: 'pose' },
  { id: 'p3', label: '奔跑', en: 'running, dynamic motion', zh: '奔跑', category: 'pose' },
  { id: 'p4', label: '飞翔', en: 'flying, floating in air', zh: '飞翔', category: 'pose' },
  { id: 'p5', label: '回眸', en: 'looking back, over shoulder', zh: '回眸', category: 'pose' },
  { id: 'p6', label: '战斗', en: 'fighting stance, action pose', zh: '战斗姿态', category: 'pose' },
  { id: 'p7', label: '沉思', en: 'contemplative, thoughtful', zh: '沉思', category: 'pose' },

  // ===== 时代 =====
  { id: 'e1', label: '古代', en: 'ancient, historical', zh: '古代', category: 'era' },
  { id: 'e2', label: '中世纪', en: 'medieval, middle ages', zh: '中世纪', category: 'era' },
  { id: 'e3', label: '维多利亚', en: 'Victorian era, 19th century', zh: '维多利亚', category: 'era' },
  { id: 'e4', label: '1920s', en: '1920s, art deco, roaring twenties', zh: '1920年代', category: 'era' },
  { id: 'e5', label: '未来', en: 'future, sci-fi, year 3000', zh: '未来', category: 'era' },
  { id: 'e6', label: '后启示录', en: 'post-apocalyptic, dystopian', zh: '后启示录', category: 'era' }
]

export function getTagsByCategory(category: string): PresetTag[] {
  return presetTags.filter((t) => t.category === category)
}

export function getPopularTags(limit = 20): PresetTag[] {
  return presetTags.filter((t) => t.popular).slice(0, limit)
}

export function searchTags(query: string): PresetTag[] {
  const q = query.toLowerCase()
  return presetTags.filter((t) => t.label.includes(q) || t.zh.includes(q) || t.en.toLowerCase().includes(q))
}

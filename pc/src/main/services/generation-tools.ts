/**
 * Generation Tools — 对话式 Agent 用的生成工具
 *
 * 当用户在聊天中描述生成需求时，LLM 可以调用这些工具自动创建生成任务。
 */
import { dynamicTool, jsonSchema } from '@ai-sdk/provider-utils'

/**
 * 生成图片工具 — LLM 调用后自动提交到 Generation Queue
 */
export const generateImageTool = dynamicTool({
  description: `Generate an image based on a text prompt. Use this when the user wants to create, draw, or generate an image, picture, photo, or illustration. The system will automatically route the request to the best available image generation provider.`,

  inputSchema: jsonSchema<{
    prompt: string
    size?: string
    negative_prompt?: string
    style?: string
    n?: number
  }>({
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Detailed English prompt describing the image to generate. Include style, composition, lighting, colors, and subject details.'
      },
      size: {
        type: 'string',
        description: 'Image size. Options: 1024x1024 (square), 1024x1536 (portrait 3:4), 1536x1024 (landscape 16:9). Default is 1024x1024.'
      },
      negative_prompt: {
        type: 'string',
        description: 'Things to avoid in the generated image (optional).'
      },
      style: {
        type: 'string',
        description: 'Visual style of the image. Options: realistic, anime, oil-painting, sketch, 3d-render, cinematic, watercolor, pixel-art.'
      },
      n: {
        type: 'number',
        description: 'Number of images to generate (1-4). Default is 1.'
      }
    },
    required: ['prompt']
  }),

  execute: async (_args: unknown): Promise<string> => {
    // 实际的生成任务创建由 chat.ts 中的工具调用处理器完成
    // 这里返回占位符 — execute 不会直接被调用，因为 chat.ts 拦截了 tool-call 块
    return 'Image generation task submitted.'
  }
})

/**
 * 生成视频工具 — LLM 调用后自动提交到 Generation Queue
 */
export const generateVideoTool = dynamicTool({
  description: `Generate a video from a text prompt or an image reference. Use this when the user wants to create, make, or produce a video, animation, or moving image. The system will route to the best available video generation provider.`,

  inputSchema: jsonSchema<{
    prompt: string
    duration?: number
    reference_image?: string
    motion_strength?: number
  }>({
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Detailed English prompt describing the video content and motion to generate.'
      },
      duration: {
        type: 'number',
        description: 'Video duration in seconds. Options: 5, 10. Default is 5.'
      },
      reference_image: {
        type: 'string',
        description: 'Optional base64-encoded image to use as the starting frame for image-to-video generation.'
      },
      motion_strength: {
        type: 'number',
        description: 'How much motion/change in the video (0.0-1.0). Default is 0.7.'
      }
    },
    required: ['prompt']
  }),

  execute: async (_args: unknown): Promise<string> => {
    return 'Video generation task submitted.'
  }
})

/**
 * 套图生成工具 — 一键生成电商 4 张套图
 */
export const generateProductSetTool = dynamicTool({
  description: `Generate a complete e-commerce product image set (4 images) from a product description. Creates: main product photo on white background, selling point poster, lifestyle scene image, and detail header image. Use this when the user wants to create product images, e-commerce photos, or product showcases.`,

  inputSchema: jsonSchema<{
    product_name: string
    product_description?: string
    category?: string
    selling_points?: string[]
  }>({
    type: 'object',
    properties: {
      product_name: {
        type: 'string',
        description: 'Name of the product.'
      },
      product_description: {
        type: 'string',
        description: 'Detailed description of the product including materials, colors, features.'
      },
      category: {
        type: 'string',
        description: 'Product category. Options: beauty, food, fashion, home, digital.'
      },
      selling_points: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key selling points or features to highlight.'
      }
    },
    required: ['product_name']
  }),

  execute: async (_args: unknown): Promise<string> => {
    return 'Product set generation task submitted.'
  }
})

/**
 * 所有生成工具的映射表
 */
export const GENERATION_TOOLS = {
  generate_image: generateImageTool,
  generate_video: generateVideoTool,
  generate_product_set: generateProductSetTool
} as const

export type GenerationToolName = keyof typeof GENERATION_TOOLS

/**
 * canvas-node-size.ts - 节点尺寸计算工具
 */
import type { CanvasNode } from '../types'

/**
 * 根据图片比例计算最佳节点尺寸
 */
export function fitNodeSize(
  imageWidth: number,
  imageHeight: number,
  maxWidth = 340,
  maxHeight = 340,
  minWidth = 180,
  minHeight = 120
): { width: number; height: number } {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: maxWidth, height: maxHeight }
  }

  const ratio = imageWidth / imageHeight

  let width = maxWidth
  let height = width / ratio

  if (height > maxHeight) {
    height = maxHeight
    width = height * ratio
  }

  width = Math.max(minWidth, Math.min(maxWidth, width))
  height = Math.max(minHeight, Math.min(maxHeight, height))

  return { width: Math.round(width), height: Math.round(height) }
}

/**
 * 根据字符串比例 (如 "16:9") 计算节点尺寸
 */
export function nodeSizeFromRatio(
  ratioStr: string,
  maxWidth = 500,
  maxHeight = 500
): { width: number; height: number } {
  const [w, h] = ratioStr.split(':').map(Number)
  if (!w || !h) return { width: 340, height: 240 }

  const ratio = w / h
  let width = maxWidth
  let height = width / ratio

  if (height > maxHeight) {
    height = maxHeight
    width = height * ratio
  }

  return { width: Math.round(width), height: Math.round(height) }
}

/**
 * 计算一组节点的包围盒
 */
export function getNodesBounds(
  nodes: CanvasNode[],
  padding = 0
): {
  x: number
  y: number
  width: number
  height: number
} {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const node of nodes) {
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + node.width)
    maxY = Math.max(maxY, node.position.y + node.height)
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2
  }
}

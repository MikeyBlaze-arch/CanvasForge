import type { Edge, Node } from '@xyflow/react'
import type {
  CanvasNodeData,
  GroupNodeData,
  ImageAssetNodeData,
  ImageGenNodeData,
  ResultImageNodeData,
} from './nodeTypes'

export const IMAGE_COLLECTION_OUTPUT_HANDLE = 'image_collection_output'
export const IMAGE_COLLECTION_OUTPUT_TYPE = 'image_collection'

export type ImageCollectionOutputType = typeof IMAGE_COLLECTION_OUTPUT_TYPE

export type GroupImageOutput = {
  groupNodeId: string
  sourceNodeId: string
  imageUrl: string
  label?: string
  sourceType: 'image_asset' | 'result_image' | 'image_gen'
  width?: number
  height?: number
  index: number
}

function getNodeData(node: Node<CanvasNodeData>): CanvasNodeData {
  return node.data as unknown as CanvasNodeData
}

function normalizeImageUrl(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function uniqueUrls(urls: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const url of urls) {
    if (!url || seen.has(url)) continue
    seen.add(url)
    result.push(url)
  }
  return result
}

function extractImageUrlsFromAsset(data: ImageAssetNodeData | ResultImageNodeData): string[] {
  const extra = data as Record<string, unknown>
  const imageUrl = [
    normalizeImageUrl(data.imageUrl),
    normalizeImageUrl(extra.url),
    normalizeImageUrl(extra.src),
    normalizeImageUrl(extra.dataUrl),
    normalizeImageUrl(extra.outputUrl),
    normalizeImageUrl(extra.outputImageUrl),
    normalizeImageUrl(extra.originalImageUrl),
    normalizeImageUrl(extra.downloadUrl),
  ].find(Boolean)
  return imageUrl ? [imageUrl] : []
}

function extractImageUrlsFromImageGen(data: ImageGenNodeData): string[] {
  const extra = data as Record<string, unknown>
  const generatedImages = Array.isArray(extra.generatedImages)
    ? extra.generatedImages.flatMap((item) => {
        if (typeof item === 'string') return [normalizeImageUrl(item)]
        if (!item || typeof item !== 'object') return []
        const image = item as Record<string, unknown>
        return [
          normalizeImageUrl(image.imageUrl),
          normalizeImageUrl(image.url),
          normalizeImageUrl(image.src),
          normalizeImageUrl(image.dataUrl),
        ]
      })
    : []
  const images = Array.isArray(extra.images)
    ? extra.images.map((item) => normalizeImageUrl(item))
    : []

  return uniqueUrls([
    ...(data.lastOutputImageUrls ?? []).map((url) => normalizeImageUrl(url)),
    normalizeImageUrl(data.lastGeneratedImageUrl),
    normalizeImageUrl(extra.outputUrl),
    normalizeImageUrl(extra.outputImageUrl),
    ...generatedImages,
    ...images,
  ])
}

function extractImageOutputsFromNode(
  groupNodeId: string,
  node: Node<CanvasNodeData>
): GroupImageOutput[] {
  const data = getNodeData(node)

  if (data.nodeType === 'image_asset') {
    return extractImageUrlsFromAsset(data).map((imageUrl, index) => ({
      groupNodeId,
      sourceNodeId: node.id,
      imageUrl,
      label: data.title,
      sourceType: 'image_asset',
      width: data.naturalWidth,
      height: data.naturalHeight,
      index,
    }))
  }

  if (data.nodeType === 'result_image') {
    return extractImageUrlsFromAsset(data).map((imageUrl, index) => ({
      groupNodeId,
      sourceNodeId: node.id,
      imageUrl,
      label: data.title,
      sourceType: 'result_image',
      width: data.naturalWidth,
      height: data.naturalHeight,
      index,
    }))
  }

  if (data.nodeType === 'image_gen') {
    return extractImageUrlsFromImageGen(data).map((imageUrl, index) => ({
      groupNodeId,
      sourceNodeId: node.id,
      imageUrl,
      label: data.title,
      sourceType: 'image_gen',
      width: data.lastOutputWidth,
      height: data.lastOutputHeight,
      index,
    }))
  }

  return []
}

function resolveGroupChildren(groupNode: Node<CanvasNodeData>, nodes: Node<CanvasNodeData>[]) {
  const groupData = getNodeData(groupNode) as GroupNodeData
  const childIds = new Set(Array.isArray(groupData.childNodeIds) ? groupData.childNodeIds : [])
  const groupId = groupNode.id

  return nodes.filter((node) => {
    if (node.id === groupId) return false
    const maybeParent = node as Node<CanvasNodeData> & { parentId?: string; parentNode?: string }
    return childIds.has(node.id) || maybeParent.parentId === groupId || maybeParent.parentNode === groupId
  })
}

export function getGroupImageOutputKey(output: Pick<GroupImageOutput, 'groupNodeId' | 'sourceNodeId' | 'index'>): string {
  return output.index > 0
    ? `${output.groupNodeId}:${output.sourceNodeId}:${output.index}`
    : `${output.groupNodeId}:${output.sourceNodeId}`
}

export function resolveGroupImageOutputs(
  groupNodeId: string,
  nodes: Node<CanvasNodeData>[],
  _edges: Edge[]
): GroupImageOutput[] {
  const groupNode = nodes.find((node) => node.id === groupNodeId)
  if (!groupNode || getNodeData(groupNode).nodeType !== 'group') return []

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const children = resolveGroupChildren(groupNode, nodes)
  return children
    .flatMap((child) => extractImageOutputsFromNode(groupNodeId, child))
    .sort((a, b) => {
      const nodeA = nodeById.get(a.sourceNodeId)
      const nodeB = nodeById.get(b.sourceNodeId)
      const ay = nodeA?.position.y ?? 0
      const by = nodeB?.position.y ?? 0
      if (Math.abs(ay - by) > 8) return ay - by
      const ax = nodeA?.position.x ?? 0
      const bx = nodeB?.position.x ?? 0
      if (ax !== bx) return ax - bx
      return a.index - b.index
    })
}

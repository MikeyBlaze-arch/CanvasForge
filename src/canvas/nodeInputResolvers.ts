import type { Edge, Node } from '@xyflow/react'
import type {
  CanvasNodeData,
  ImageAssetNodeData,
  ImageGenNodeData,
  ProductAnalysisNodeData,
  ResultImageNodeData,
  TextNodeData,
} from './nodeTypes'
import { formatProductAnalysisOutput, normalizeProductAnalysisPageCount } from './productAnalysisPrompt'
import { resolveHandleId } from './connectionRules'
import {
  IMAGE_COLLECTION_OUTPUT_HANDLE,
  getGroupImageOutputKey,
  resolveGroupImageOutputs,
} from './groupImageOutputs'
import { getImageSourceUrl } from './imageSourceUtils'

type NodeMatch = {
  edge: Edge
  edgeIndex: number
  node: Node<CanvasNodeData>
}

type ReferenceImageMatch = NodeMatch & {
  imageUrl: string
  referenceKey: string
  sourceNodeId: string
  groupNodeId?: string
  naturalWidth?: number
  naturalHeight?: number
}

export type ImageGenInputs = {
  prompt: string
  negativePrompt: string
  referenceImages: string[]
  referenceImageLabels: string[]
  normalizedReferenceImageOrder: string[]
  connectedPromptNodeCount: number
  connectedReferenceImageNodeCount: number
  connectedOutputImageNodeIds: string[]
  connectedOutputImageNodes: Array<{ nodeId: string; node: Node<CanvasNodeData> }>
  referenceImageNodes: Array<{ nodeId: string; imageUrl: string; naturalWidth?: number; naturalHeight?: number; label: string }>
}

export type LLMInputs = {
  inputText: string
  imageInputs: string[]
  connectedTextNodeCount: number
  connectedImageNodeCount: number
  connectedOutputTextNodeIds: string[]
  connectedTextOutputNodes: Array<{ nodeId: string; node: Node<CanvasNodeData> }>
}

export type ProductAnalysisInputs = {
  inputText: string
  imageInputs: string[]
  connectedInputTextNodeCount: number
  connectedInputImageNodeCount: number
  connectedOutputTextNodeIds: string[]
  connectedOutputTextNodes: Array<{ nodeId: string; node: Node<CanvasNodeData> }>
}

export type VideoGenInputs = {
  prompt: string
  imageUrl?: string
  connectedPromptNodeCount: number
  connectedImageNodeCount: number
  connectedOutputVideoNodeIds: string[]
  connectedOutputVideoNodes: Array<{ nodeId: string; node: Node<CanvasNodeData> }>
}

function getNodeData(node: Node<CanvasNodeData>): CanvasNodeData {
  return node.data as unknown as CanvasNodeData
}

function sortTextMatches(matches: NodeMatch[]): NodeMatch[] {
  return [...matches].sort((a, b) => {
    const y = a.node.position.y - b.node.position.y
    if (y !== 0) return y
    const x = a.node.position.x - b.node.position.x
    if (x !== 0) return x
    return a.edgeIndex - b.edgeIndex
  })
}

function getImageUrl(data: CanvasNodeData): string | undefined {
  return getImageSourceUrl(data, 'payload')
}

function getImageDimensions(data: CanvasNodeData): { naturalWidth?: number; naturalHeight?: number } {
  if (data.nodeType === 'image_asset') {
    const imageData = data as ImageAssetNodeData
    return { naturalWidth: imageData.naturalWidth, naturalHeight: imageData.naturalHeight }
  }
  if (data.nodeType === 'result_image') {
    const imageData = data as ResultImageNodeData
    return { naturalWidth: imageData.naturalWidth, naturalHeight: imageData.naturalHeight }
  }
  if (data.nodeType === 'image_gen') {
    const imageData = data as ImageGenNodeData
    return { naturalWidth: imageData.lastOutputWidth, naturalHeight: imageData.lastOutputHeight }
  }
  return {}
}

function sortByConnectionOrder<T extends NodeMatch>(matches: T[]): T[] {
  return [...matches].sort((a, b) => a.edgeIndex - b.edgeIndex)
}

function getTextOutput(data: CanvasNodeData): string {
  if (data.nodeType === 'text') return (data as TextNodeData).content.trim()
  if (data.nodeType === 'product_analysis') {
    const productAnalysisData = data as ProductAnalysisNodeData
    if (productAnalysisData.structuredOutput) {
      return formatProductAnalysisOutput(
        productAnalysisData.structuredOutput,
        normalizeProductAnalysisPageCount(productAnalysisData.pageCount),
      )
    }
    return (productAnalysisData.analysisResult || '').trim()
  }
  if (data.nodeType === 'llm') return ((data as unknown as { outputText?: string }).outputText || '').trim()
  return ''
}

function normalizeReferenceImageOrder(matches: ReferenceImageMatch[], savedOrder: unknown): string[] {
  const connectionOrder = sortByConnectionOrder(matches).map((match) => match.referenceKey)
  const connectedIds = new Set(connectionOrder)
  const seen = new Set<string>()
  const normalized: string[] = []

  if (Array.isArray(savedOrder)) {
    for (const value of savedOrder) {
      if (typeof value !== 'string' || !connectedIds.has(value) || seen.has(value)) continue
      normalized.push(value)
      seen.add(value)
    }
  }

  for (const nodeId of connectionOrder) {
    if (seen.has(nodeId)) continue
    normalized.push(nodeId)
    seen.add(nodeId)
  }

  return normalized.slice(0, 12)
}

function sortReferenceImageMatches(
  matches: ReferenceImageMatch[],
  normalizedOrder: string[]
): ReferenceImageMatch[] {
  const byReferenceKey = new Map(matches.map((match) => [match.referenceKey, match]))
  const ordered = normalizedOrder
    .map((referenceKey) => byReferenceKey.get(referenceKey))
    .filter((match): match is ReferenceImageMatch => Boolean(match))
  const orderedIds = new Set(ordered.map((match) => match.referenceKey))
  const leftovers = sortByConnectionOrder(matches).filter((match) => !orderedIds.has(match.referenceKey))
  return [...ordered, ...leftovers].slice(0, 12)
}

export function getImageGenInputs(
  nodeId: string,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  ownPromptText = ''
): ImageGenInputs {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const imageGenNode = nodeById.get(nodeId)
  const imageGenData = imageGenNode ? getNodeData(imageGenNode) : undefined
  const promptMatches: NodeMatch[] = []
  const negativeMatches: NodeMatch[] = []
  const referenceImageMatches: ReferenceImageMatch[] = []
  let connectedPromptNodeCount = 0
  let connectedReferenceImageNodeCount = 0

  edges.forEach((edge, edgeIndex) => {
    if (edge.target !== nodeId) return
    const sourceNode = nodeById.get(edge.source)
    if (!sourceNode) return

    const sourceData = getNodeData(sourceNode)
    const sourceHandle = resolveHandleId(sourceData.nodeType, edge.sourceHandle) ?? undefined
    const targetHandle = resolveHandleId('image_gen', edge.targetHandle) ?? undefined

    if (sourceData.nodeType === 'text') {
      connectedPromptNodeCount += 1
      const content = (sourceData as TextNodeData).content.trim()
      if (!content) return

      if (targetHandle === 'negative_prompt' || sourceHandle === 'negative_prompt') {
        negativeMatches.push({ edge, edgeIndex, node: sourceNode })
        return
      }

      promptMatches.push({ edge, edgeIndex, node: sourceNode })
      return
    }

    if (
      sourceData.nodeType === 'image_asset' ||
      sourceData.nodeType === 'result_image' ||
      sourceData.nodeType === 'image_gen'
    ) {
      connectedReferenceImageNodeCount += 1
      const imageUrl = getImageUrl(sourceData)
      if (imageUrl) {
        referenceImageMatches.push({
          edge,
          edgeIndex,
          node: sourceNode,
          imageUrl,
          referenceKey: sourceNode.id,
          sourceNodeId: sourceNode.id,
          ...getImageDimensions(sourceData),
        })
      }
      return
    }

    if (sourceData.nodeType === 'group' && sourceHandle === IMAGE_COLLECTION_OUTPUT_HANDLE) {
      connectedReferenceImageNodeCount += 1
      const groupImages = resolveGroupImageOutputs(sourceNode.id, nodes, edges)
      for (const image of groupImages) {
        referenceImageMatches.push({
          edge,
          edgeIndex,
          node: sourceNode,
          imageUrl: image.payloadUrl ?? image.imageUrl,
          referenceKey: getGroupImageOutputKey(image),
          sourceNodeId: image.sourceNodeId,
          groupNodeId: sourceNode.id,
          naturalWidth: image.width,
          naturalHeight: image.height,
        })
      }
    }
  })

  const promptParts = sortTextMatches(promptMatches)
    .map(({ node }) => {
      const d = getNodeData(node) as TextNodeData
      return d.content.trim()
    })
    .filter(Boolean)
  if (ownPromptText.trim()) {
    promptParts.push(ownPromptText.trim())
  }
  const prompt = promptParts.join('\n')
  const negativePrompt = sortTextMatches(negativeMatches)
    .map(({ node }) => {
      const d = getNodeData(node) as TextNodeData
      return d.content.trim()
    })
    .filter(Boolean)
    .join('\n')

  const normalizedReferenceImageOrder = normalizeReferenceImageOrder(
    referenceImageMatches,
    imageGenData?.nodeType === 'image_gen' ? (imageGenData as ImageGenNodeData).referenceImageOrder : undefined,
  )
  const sortedReferenceImageMatches = sortReferenceImageMatches(referenceImageMatches, normalizedReferenceImageOrder)

  const referenceImages = sortedReferenceImageMatches.map((match) => match.imageUrl).slice(0, 12)

  // Collect reference image nodes with dimension data
  const referenceImageNodes = sortedReferenceImageMatches.map((match, index) => {
    return {
      nodeId: match.referenceKey,
      imageUrl: match.imageUrl,
      naturalWidth: match.naturalWidth && match.naturalWidth > 0 ? match.naturalWidth : undefined,
      naturalHeight: match.naturalHeight && match.naturalHeight > 0 ? match.naturalHeight : undefined,
      label: `图${index + 1}`,
    }
  })

  const referenceImageLabels = referenceImages.map((_, index) => {
    return `图${index + 1}`
  })

  const connectedOutputImageNodes = edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => {
      const targetNode = nodeById.get(edge.target)
      if (!targetNode) return null
      return getNodeData(targetNode).nodeType === 'image_asset'
        ? { nodeId: targetNode.id, node: targetNode }
        : null
    })
    .filter((match): match is { nodeId: string; node: Node<CanvasNodeData> } => Boolean(match))

  return {
    prompt,
    negativePrompt,
    referenceImages,
    referenceImageLabels,
    normalizedReferenceImageOrder,
    referenceImageNodes,
    connectedPromptNodeCount,
    connectedReferenceImageNodeCount,
    connectedOutputImageNodeIds: connectedOutputImageNodes.map((node) => node.nodeId),
    connectedOutputImageNodes,
  }
}

export function getLLMInputs(
  nodeId: string,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  ownInputText: string
): LLMInputs {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const textMatches: NodeMatch[] = []
  const imageInputs: string[] = []
  let connectedTextNodeCount = 0
  let connectedImageNodeCount = 0

  edges.forEach((edge, edgeIndex) => {
    if (edge.target !== nodeId) return
    const sourceNode = nodeById.get(edge.source)
    if (!sourceNode) return

    const sourceData = getNodeData(sourceNode)
    const sourceHandle = resolveHandleId(sourceData.nodeType, edge.sourceHandle) ?? undefined
    const targetHandle = resolveHandleId('llm', edge.targetHandle) ?? undefined

    if (sourceData.nodeType === 'text' || sourceData.nodeType === 'product_analysis') {
      connectedTextNodeCount += 1
      const content = getTextOutput(sourceData)
      if (content) textMatches.push({ edge, edgeIndex, node: sourceNode })
      return
    }

    if (
      sourceData.nodeType === 'image_asset' ||
      sourceData.nodeType === 'result_image' ||
      sourceData.nodeType === 'image_gen'
    ) {
      connectedImageNodeCount += 1
      const imageUrl = getImageUrl(sourceData)
      if (imageUrl) imageInputs.push(imageUrl)
      return
    }

    if (sourceData.nodeType === 'group' && sourceHandle === IMAGE_COLLECTION_OUTPUT_HANDLE) {
      connectedImageNodeCount += 1
      imageInputs.push(...resolveGroupImageOutputs(sourceNode.id, nodes, edges).map((image) => image.payloadUrl ?? image.imageUrl))
    }
  })

  const textParts = sortTextMatches(textMatches)
    .map(({ node }) => {
      return getTextOutput(getNodeData(node))
    })
    .filter(Boolean)

  if (ownInputText.trim()) {
    textParts.push(ownInputText.trim())
  }

  const connectedTextOutputNodes = edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => {
      const targetNode = nodeById.get(edge.target)
      if (!targetNode) return null
      return getNodeData(targetNode).nodeType === 'text'
        ? { nodeId: targetNode.id, node: targetNode }
        : null
    })
    .filter((match): match is { nodeId: string; node: Node<CanvasNodeData> } => Boolean(match))

  return {
    inputText: textParts.join('\n'),
    imageInputs,
    connectedTextNodeCount,
    connectedImageNodeCount,
    connectedOutputTextNodeIds: connectedTextOutputNodes.map((node) => node.nodeId),
    connectedTextOutputNodes,
  }
}

export function getProductAnalysisInputs(
  nodeId: string,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[]
): ProductAnalysisInputs {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const textMatches: NodeMatch[] = []
  const imageInputs: string[] = []
  let connectedInputTextNodeCount = 0
  let connectedInputImageNodeCount = 0

  edges.forEach((edge, edgeIndex) => {
    if (edge.target !== nodeId) return
    const sourceNode = nodeById.get(edge.source)
    if (!sourceNode) return

    const sourceData = getNodeData(sourceNode)
    const sourceHandle = resolveHandleId(sourceData.nodeType, edge.sourceHandle) ?? undefined
    if (
      sourceData.nodeType === 'text' ||
      sourceData.nodeType === 'llm' ||
      sourceData.nodeType === 'product_analysis'
    ) {
      connectedInputTextNodeCount += 1
      const content = getTextOutput(sourceData)
      if (content) textMatches.push({ edge, edgeIndex, node: sourceNode })
      return
    }

    if (
      sourceData.nodeType === 'image_asset' ||
      sourceData.nodeType === 'result_image' ||
      sourceData.nodeType === 'image_gen'
    ) {
      connectedInputImageNodeCount += 1
      const imageUrl = getImageUrl(sourceData)
      if (imageUrl) imageInputs.push(imageUrl)
      return
    }

    if (sourceData.nodeType === 'group' && sourceHandle === IMAGE_COLLECTION_OUTPUT_HANDLE) {
      connectedInputImageNodeCount += 1
      imageInputs.push(...resolveGroupImageOutputs(sourceNode.id, nodes, edges).map((image) => image.payloadUrl ?? image.imageUrl))
    }
  })

  const connectedOutputTextNodes = edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => {
      const targetNode = nodeById.get(edge.target)
      if (!targetNode) return null
      return getNodeData(targetNode).nodeType === 'text'
        ? { nodeId: targetNode.id, node: targetNode }
        : null
    })
    .filter((match): match is { nodeId: string; node: Node<CanvasNodeData> } => Boolean(match))

  return {
    inputText: sortTextMatches(textMatches)
      .map(({ node }) => getTextOutput(getNodeData(node)))
      .filter(Boolean)
      .join('\n'),
    imageInputs,
    connectedInputTextNodeCount,
    connectedInputImageNodeCount,
    connectedOutputTextNodeIds: connectedOutputTextNodes.map((node) => node.nodeId),
    connectedOutputTextNodes,
  }
}

export function getVideoGenInputs(
  nodeId: string,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  ownPromptText = ''
): VideoGenInputs {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const promptMatches: NodeMatch[] = []
  let imageUrl: string | undefined
  let connectedPromptNodeCount = 0
  let connectedImageNodeCount = 0

  edges.forEach((edge, edgeIndex) => {
    if (edge.target !== nodeId) return
    const sourceNode = nodeById.get(edge.source)
    if (!sourceNode) return

    const sourceData = getNodeData(sourceNode)

    if (sourceData.nodeType === 'text') {
      connectedPromptNodeCount += 1
      const content = (sourceData as TextNodeData).content.trim()
      if (content) promptMatches.push({ edge, edgeIndex, node: sourceNode })
      return
    }

    if (sourceData.nodeType === 'llm') {
      connectedPromptNodeCount += 1
      const content = ((sourceData as unknown as { outputText?: string }).outputText || '').trim()
      if (content) promptMatches.push({ edge, edgeIndex, node: sourceNode })
      return
    }

    if (
      sourceData.nodeType === 'image_asset' ||
      sourceData.nodeType === 'result_image' ||
      sourceData.nodeType === 'image_gen'
    ) {
      connectedImageNodeCount += 1
      const resolved = getImageUrl(sourceData)
      if (resolved && !imageUrl) imageUrl = resolved
    }
  })

  const promptParts = sortTextMatches(promptMatches)
    .map(({ node }) => {
      const d = getNodeData(node)
      if (d.nodeType === 'llm') return ((d as unknown as { outputText?: string }).outputText || '').trim()
      return (d as TextNodeData).content.trim()
    })
    .filter(Boolean)
  if (ownPromptText.trim()) promptParts.push(ownPromptText.trim())

  const connectedOutputVideoNodes = edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => {
      const targetNode = nodeById.get(edge.target)
      if (!targetNode) return null
      return getNodeData(targetNode).nodeType === 'video_asset'
        ? { nodeId: targetNode.id, node: targetNode }
        : null
    })
    .filter((match): match is { nodeId: string; node: Node<CanvasNodeData> } => Boolean(match))

  return {
    prompt: promptParts.join('\n'),
    imageUrl,
    connectedPromptNodeCount,
    connectedImageNodeCount,
    connectedOutputVideoNodeIds: connectedOutputVideoNodes.map((node) => node.nodeId),
    connectedOutputVideoNodes,
  }
}

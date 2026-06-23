import type { Edge, Node } from '@xyflow/react'
import type { CanvasNodeData, ImageGenNodeData, TextNodeData } from '../canvas/nodeTypes'
import { normalizeImageBatchSize } from '../canvas/nodeTypes'
import {
  assertCleanBackendModel,
  getImageModelById,
  normalizeImageModel,
  normalizeImageSeries,
} from './imageModelRegistry'
import type { ImageModelDefinition } from './imageModelRegistry'
import {
  findClosestGptImageAspectRatio,
  findClosestNanoBananaAspectRatio,
  normalizeAspectRatio,
  normalizeResolution,
  resolveGptImage2FixedSize,
} from './sizeRegistry'

type BuildInput = {
  imageGenNode: ImageGenNodeData
  connectedTextNodes: TextNodeData[]
  connectedImageNodes: CanvasNodeData[]
  referenceImageLabels?: string[]
  edges: Edge[]
  nodes: Node<CanvasNodeData>[]
  targetNodeId: string
}

type DirectBuildInput = {
  modelId: string
  prompt: string
  aspectRatio: string
  resolution: string
  batchSize?: number
}

function loadImageDimensions(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function resolveAutoRatio(
  aspectRatio: string,
  referenceImages: string[],
  model: ImageModelDefinition,
  connectedImageNodes?: CanvasNodeData[],
): Promise<string> {
  if (aspectRatio !== 'auto' || referenceImages.length === 0) {
    return normalizeAspectRatio(aspectRatio)
  }

  const firstNode = connectedImageNodes?.[0]
  if (
    firstNode &&
    'naturalWidth' in firstNode &&
    'naturalHeight' in firstNode &&
    firstNode.naturalWidth &&
    firstNode.naturalHeight &&
    firstNode.naturalWidth > 0 &&
    firstNode.naturalHeight > 0
  ) {
    const ratioValue = firstNode.naturalWidth / firstNode.naturalHeight
    return model.sizeMode === 'aspect_ratio_image_size'
      ? findClosestNanoBananaAspectRatio(ratioValue)
      : findClosestGptImageAspectRatio(ratioValue)
  }

  const firstUrl = referenceImages[0]
  if (!firstUrl) return '1:1'

  try {
    const dims = await loadImageDimensions(firstUrl)
    if (dims?.width && dims.height) {
      const ratioValue = dims.width / dims.height
      return model.sizeMode === 'aspect_ratio_image_size'
        ? findClosestNanoBananaAspectRatio(ratioValue)
        : findClosestGptImageAspectRatio(ratioValue)
    }
  } catch {
    // Fall back to square when image dimensions are unavailable.
  }

  return '1:1'
}

function appendGptImagePromptInstruction(prompt: string, aspectRatio: string, size: string) {
  const ratio = normalizeAspectRatio(aspectRatio)
  const base = String(prompt || '').trim()
  const instruction = `Aspect ratio: ${ratio}. Pixel size: ${size}.`
  return base ? `${base}\n\n${instruction}` : instruction
}

function appendNanoBananaPromptInstruction(prompt: string, aspectRatio: string, imageSize: string) {
  const base = String(prompt || '').trim()
  const instruction = `Aspect ratio: ${aspectRatio}. Resolution: ${imageSize}. Return the original full-resolution image, not a preview or thumbnail.`
  return base ? `${base}\n\n${instruction}` : instruction
}

function mergeTextPrompts(connectedTextNodes: TextNodeData[]) {
  const promptParts: string[] = []
  const negativeParts: string[] = []

  for (const node of connectedTextNodes) {
    const content = node.content.trim()
    if (!content) continue
    if (node.textKind === 'negative_prompt') {
      negativeParts.push(content)
    } else {
      promptParts.push(content)
    }
  }

  return {
    prompt: promptParts.join('\n'),
    negativePrompt: negativeParts.join('\n'),
  }
}

function buildGptImage2Payload(params: {
  backendModel: string
  prompt: string
  aspectRatio: string
  resolution: string
  batchSize?: number
}) {
  const size = resolveGptImage2FixedSize(params.aspectRatio, params.resolution)

  return {
    model: params.backendModel,
    prompt: appendGptImagePromptInstruction(params.prompt, params.aspectRatio, size),
    size,
    n: normalizeImageBatchSize(params.batchSize),
  }
}

function buildNanoBananaPayload(params: {
  backendModel: string
  prompt: string
  aspectRatio: string
  resolution: string
  batchSize?: number
}) {
  const ratio = normalizeAspectRatio(params.aspectRatio)
  const imageSize = normalizeResolution(params.resolution)

  // Standard Nano relay fields only. Do NOT spam aliases (size / quality /
  // resolution / return_* / preview / thumbnail) — some relays misroute when
  // they see an OpenAI-style `size` next to `image_size`.
  return {
    model: params.backendModel,
    prompt: appendNanoBananaPromptInstruction(params.prompt, ratio, imageSize),
    n: normalizeImageBatchSize(params.batchSize),
    aspect_ratio: ratio,
    image_size: imageSize,
  }
}

function buildPayloadForModel(params: DirectBuildInput): Record<string, unknown> {
  const modelId = normalizeImageModel(params.modelId)
  const model = getImageModelById(modelId)
  if (!model) throw new Error(`Unknown image model id: ${params.modelId}`)

  assertCleanBackendModel(model.backendModel)

  if (model.engineType === 'gpt-image-2') {
    return buildGptImage2Payload({
      backendModel: model.backendModel,
      prompt: params.prompt,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      batchSize: params.batchSize,
    })
  }

  if (model.engineType === 'nano-banana') {
    return buildNanoBananaPayload({
      backendModel: model.backendModel,
      prompt: params.prompt,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      batchSize: params.batchSize,
    })
  }

  throw new Error(`Unsupported engineType: ${(model as ImageModelDefinition).engineType}`)
}

async function buildPayloadForNode(input: BuildInput): Promise<Record<string, unknown>> {
  const { imageGenNode, connectedTextNodes, connectedImageNodes, referenceImageLabels } = input

  const series = normalizeImageSeries(imageGenNode.modelSeries)
  const modelId = normalizeImageModel(imageGenNode.modelId)
  const model = getImageModelById(modelId)
  if (!model) throw new Error(`Unknown image model id: ${imageGenNode.modelId}`)

  const { prompt: finalPrompt, negativePrompt } = mergeTextPrompts(connectedTextNodes)

  const directImages: string[] = connectedImageNodes
    .map((node) => {
      if ('imageUrl' in node && node.imageUrl) return node.imageUrl
      if ('lastGeneratedImageUrl' in node && node.lastGeneratedImageUrl) return node.lastGeneratedImageUrl
      if ('lastOutputImageUrls' in node && Array.isArray(node.lastOutputImageUrls)) return node.lastOutputImageUrls[0]
      return undefined
    })
    .filter((url): url is string => Boolean(url))

  const images = directImages.slice(0, 12)

  const requestedAspectRatio = imageGenNode.aspectRatio
  const effectiveAspectRatio = await resolveAutoRatio(requestedAspectRatio, images, model, connectedImageNodes)
  const resolution = normalizeResolution(imageGenNode.resolution)
  const requestedBatchSize = normalizeImageBatchSize(imageGenNode.batchSize)
  const payload = buildPayloadForModel({
    modelId,
    prompt: finalPrompt,
    aspectRatio: effectiveAspectRatio,
    resolution,
    batchSize: 1,
  })

  payload._meta = {
    selectedModelId: modelId,
    modelSeries: model.series,
    engineType: model.engineType,
    sizeMode: model.sizeMode,
    requestedAspectRatio,
    effectiveAspectRatio,
    resolution,
    requestedBatchSize,
    backendModel: model.backendModel,
    normalizedFromSeries: series,
  }

  if (images.length > 0) {
    payload.images = images
    payload.referenceImages = images
    payload.referenceImageLabels = referenceImageLabels?.slice(0, images.length) ?? images.map((_, index) => `图${index + 1}`)
  }

  if (model.sizeMode === 'aspect_ratio_image_size') {
    if (negativePrompt) payload.negative_prompt = negativePrompt
    if (imageGenNode.seed != null) payload.seed = imageGenNode.seed
  }

  return payload
}

export function buildImageGenerationPayload(params: DirectBuildInput): Record<string, unknown>
export function buildImageGenerationPayload(params: BuildInput): Promise<Record<string, unknown>>
export function buildImageGenerationPayload(params: DirectBuildInput | BuildInput): Record<string, unknown> | Promise<Record<string, unknown>> {
  if ('modelId' in params) return buildPayloadForModel(params)
  return buildPayloadForNode(params)
}

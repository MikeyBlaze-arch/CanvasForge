import type {
  CanvasNodeData,
  ImageAssetNodeData,
  ImageGenNodeData,
  ResultImageNodeData,
} from './nodeTypes'

export type ImageSourcePurpose = 'thumbnail' | 'display' | 'displayZoomed' | 'payload' | 'download'

export type ImageSourceOptions = {
  zoom?: number
  cssWidth?: number
  cssHeight?: number
  devicePixelRatio?: number
  zoomSwitchThreshold?: number
}

export type ImageSourceSet = {
  thumbnailUrl?: string
  originalImageUrl?: string
  downloadUrl?: string
  displayUrl?: string
  displayZoomedUrl?: string
  payloadUrl?: string
  downloadSourceUrl?: string
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function firstUrl(values: unknown[]): string | undefined {
  for (const value of values) {
    const url = nonEmptyString(value)
    if (url) return url
  }
  return undefined
}

function getObjectUrl(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  return firstUrl(keys.map((key) => record[key]))
}

function shouldUseFullDisplaySource(options?: ImageSourceOptions): boolean {
  const zoom = options?.zoom ?? 1
  const dpr = options?.devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1) ?? 1
  const threshold = options?.zoomSwitchThreshold ?? 1.25
  return zoom * dpr >= threshold
}

function getImageGenUrl(data: ImageGenNodeData): string | undefined {
  const extra = data as Record<string, unknown>
  const generatedImages = Array.isArray(extra.generatedImages) ? extra.generatedImages : []
  const firstGenerated = generatedImages
    .map((item) => {
      if (typeof item === 'string') return item
      if (!item || typeof item !== 'object') return undefined
      const image = item as Record<string, unknown>
      return firstUrl([image.downloadUrl, image.originalImageUrl, image.url, image.imageUrl, image.src, image.dataUrl])
    })
    .find(Boolean)

  return firstUrl([
    data.lastGeneratedImageUrl,
    data.lastOutputImageUrls?.[0],
    extra.downloadUrl,
    extra.originalImageUrl,
    extra.outputUrl,
    extra.outputImageUrl,
    firstGenerated,
  ])
}

export function getImageSourceSet(data: CanvasNodeData): ImageSourceSet {
  if (data.nodeType === 'image_asset' || data.nodeType === 'result_image') {
    const imageData = data as ImageAssetNodeData | ResultImageNodeData
    const extra = data as Record<string, unknown>
    const thumbnailUrl = firstUrl([
      imageData.imageUrl,
      extra.thumbnailUrl,
      extra.previewUrl,
      getObjectUrl(extra.image, ['previewUrl', 'thumbnailUrl', 'imageUrl', 'url']),
      getObjectUrl(extra.output, ['previewUrl', 'thumbnailUrl', 'imageUrl', 'url']),
    ])
    const originalImageUrl = firstUrl([
      imageData.originalImageUrl,
      extra.originalUrl,
      getObjectUrl(extra.image, ['url', 'originalImageUrl', 'downloadUrl', 'src', 'dataUrl']),
      getObjectUrl(extra.output, ['url', 'originalImageUrl', 'downloadUrl', 'src', 'dataUrl']),
      extra.outputUrl,
      extra.outputImageUrl,
      extra.url,
      extra.src,
      extra.dataUrl,
    ])
    const downloadUrl = firstUrl([imageData.downloadUrl, originalImageUrl])
    const zoomedUrl = firstUrl([originalImageUrl, downloadUrl, thumbnailUrl])
    const payloadUrl = firstUrl([downloadUrl, originalImageUrl, thumbnailUrl])

    return {
      thumbnailUrl,
      originalImageUrl,
      downloadUrl,
      displayUrl: firstUrl([thumbnailUrl, originalImageUrl, downloadUrl]),
      displayZoomedUrl: zoomedUrl,
      payloadUrl,
      downloadSourceUrl: payloadUrl,
    }
  }

  if (data.nodeType === 'image_gen') {
    const imageUrl = getImageGenUrl(data as ImageGenNodeData)
    return {
      thumbnailUrl: imageUrl,
      originalImageUrl: imageUrl,
      downloadUrl: imageUrl,
      displayUrl: imageUrl,
      displayZoomedUrl: imageUrl,
      payloadUrl: imageUrl,
      downloadSourceUrl: imageUrl,
    }
  }

  return {}
}

export function getImageSourceUrl(
  data: CanvasNodeData,
  purpose: ImageSourcePurpose,
  options?: ImageSourceOptions
): string | undefined {
  const sources = getImageSourceSet(data)
  switch (purpose) {
    case 'thumbnail':
      return sources.thumbnailUrl ?? sources.displayZoomedUrl
    case 'display':
      return shouldUseFullDisplaySource(options)
        ? sources.displayZoomedUrl ?? sources.displayUrl
        : sources.displayUrl ?? sources.displayZoomedUrl
    case 'displayZoomed':
      return sources.displayZoomedUrl
    case 'payload':
      return sources.payloadUrl
    case 'download':
      return sources.downloadSourceUrl
  }
}

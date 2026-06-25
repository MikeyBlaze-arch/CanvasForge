import { getApiKey, getApiBaseUrl, getAuthHeaders, isValidBaseUrl } from '../store/apiSettingsStore'
import { assertCleanBackendModel, getImageModelByBackendModel } from './imageModelRegistry'
import type { ImageModelDefinition } from './imageModelRegistry'
import { buildImageGenerationRequest, type ImageGenerationDebugInfo } from './imageRequestAdapter'
import { buildRawResponsePreview, parseImageGenerationResponse } from './imageResponseParser'

export type GenerateImageItem = {
  url: string
  width: number
  height: number
  originalUrl?: string
  downloadUrl?: string
  widthEstimated?: boolean
  sizeWarning?: string
}

export type GenerateResult = {
  images: GenerateImageItem[]
  url: string
  width: number
  height: number
  originalUrl?: string
  downloadUrl?: string
  widthEstimated?: boolean
  sizeWarning?: string
  debugInfo?: ImageGenerationDebugInfo
}

export class ImageGenerationError extends Error {
  debugInfo?: ImageGenerationDebugInfo

  constructor(message: string, debugInfo?: ImageGenerationDebugInfo) {
    super(message)
    this.name = 'ImageGenerationError'
    this.debugInfo = debugInfo
  }
}

const DEFAULT_TIMEOUT_MS = 120_000

function resolvePayloadModel(payload: Record<string, unknown>): ImageModelDefinition {
  const requestModel = String(payload.model ?? '')
  assertCleanBackendModel(requestModel)

  const model = getImageModelByBackendModel(requestModel)
  if (!model) {
    throw new Error(`未知图片模型：${requestModel}`)
  }

  if (payload.model !== model.backendModel) {
    throw new Error(`模型名被错误改写：selected=${model.backendModel}, request=${String(payload.model ?? '')}`)
  }

  return model
}

function loadImageDimensions(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function parsePixelSize(sizeStr: unknown): { w: number; h: number } | null {
  if (typeof sizeStr !== 'string') return null
  const parts = sizeStr.split('x')
  const w = parseInt(parts[0])
  const h = parseInt(parts[1])
  if (Number.isNaN(w) || Number.isNaN(h) || w <= 0 || h <= 0) return null
  return { w, h }
}

function validateReturnedSize(
  realW: number,
  realH: number,
  requestPayload: Record<string, unknown>,
  sizeMode?: string,
): string | undefined {
  const resolution = String(requestPayload.resolution ?? requestPayload.image_size ?? '')
  const requestedRes = resolution.toUpperCase()

  if (requestedRes === '4K') {
    const maxEdge = Math.max(realW, realH)
    if (maxEdge < 2000) {
      if (sizeMode === 'aspect_ratio_image_size') {
        return `API returned ${realW}x${realH}, which may be a preview or the relay may have ignored image_size=4K.`
      }
      return `API returned ${realW}x${realH}, below the requested 4K size. The relay may have ignored the size parameter.`
    }
  }

  if (requestedRes === '2K') {
    const maxEdge = Math.max(realW, realH)
    if (maxEdge < 1400) {
      return `API returned ${realW}x${realH}, below the requested 2K size. The relay may have ignored image_size/size.`
    }
  }

  if (sizeMode !== 'aspect_ratio_image_size' && typeof requestPayload.size === 'string') {
    const px = parsePixelSize(requestPayload.size)
    if (px) {
      const sentArea = px.w * px.h
      const gotArea = realW * realH
      if (gotArea < sentArea * 0.6) {
        return `API returned ${realW}x${realH}, much smaller than requested ${px.w}x${px.h}. The relay may have ignored the size parameter.`
      }
    }
  }

  return undefined
}

function parseErrorBody(body: string): string {
  try {
    const json = JSON.parse(body)
    if (json.error?.message) return json.error.message
    if (json.message) return json.message
    if (json.msg) return json.msg
    if (json.detail) return json.detail
    if (json.data?.message) return json.data.message
    return body
  } catch {
    return body || '(empty response body)'
  }
}

async function readResponseBody(resp: Response): Promise<unknown> {
  const text = await resp.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function responseStatus(resp: Response) {
  return `${resp.status} ${resp.statusText}`.trim()
}

async function buildDimensions(
  imageUrl: string,
  requestPayload: Record<string, unknown>,
): Promise<{ width: number; height: number; estimated: boolean }> {
  const dims = await loadImageDimensions(imageUrl)
  if (dims) return { width: dims.width, height: dims.height, estimated: false }

  const fallback = parsePixelSize(requestPayload.size)
  return {
    width: fallback?.w ?? 1024,
    height: fallback?.h ?? 1024,
    estimated: true,
  }
}

export async function generateImage(
  payload: Record<string, unknown>,
  timeoutMs?: number,
  baseUrlOverride?: string,
): Promise<GenerateResult> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('MISSING_API_KEY')
  }

  const baseUrl = (baseUrlOverride ?? getApiBaseUrl()).replace(/\/+$/, '')
  if (!isValidBaseUrl(baseUrl)) {
    throw new Error('MISSING_API_BASE_URL')
  }

  const model = resolvePayloadModel(payload)
  const timeout = Math.min(timeoutMs ?? DEFAULT_TIMEOUT_MS, 180_000)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  let requestDebug: ImageGenerationDebugInfo | undefined

  try {
    const request = await buildImageGenerationRequest({
      payload,
      model,
      baseUrl,
      authHeaders: getAuthHeaders(),
    })
    requestDebug = request.debugInfo

    console.info('[image-generation-request]', {
      ...request.debugInfo,
      requestPayload: request.requestPayloadForLog,
    })

    let resp: Response
    try {
      resp = await fetch(request.endpoint, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal,
      })
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ImageGenerationError('Image generation timed out. Please try again.', requestDebug)
      }
      throw new ImageGenerationError(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`, requestDebug)
    }

    const rawBody = await readResponseBody(resp)
    const debugInfo: ImageGenerationDebugInfo = {
      ...requestDebug,
      responseStatus: resp.status,
      rawResponsePreview: buildRawResponsePreview(rawBody),
    }

    if (!resp.ok) {
      const errorMessage = typeof rawBody === 'string' ? parseErrorBody(rawBody) : parseErrorBody(JSON.stringify(rawBody))
      console.error('[ImageGen] Failure:', {
        status: resp.status,
        statusText: resp.statusText,
        request: request.debugInfo,
        response: debugInfo.rawResponsePreview,
      })
      throw new ImageGenerationError(`[${responseStatus(resp)}] ${errorMessage}`, debugInfo)
    }

    const parsed = parseImageGenerationResponse(rawBody)
    const imageItems = parsed.images
      .map((item) => ({
        ...item,
        url: item.imageUrl ?? item.dataUrl,
      }))
      .filter((item): item is typeof item & { url: string } => Boolean(item.url))
    const finalDebugInfo: ImageGenerationDebugInfo = {
      ...debugInfo,
      responseParserMatchedField: parsed.images.map((item) => item.matchedField).filter(Boolean).join(', ') || parsed.matchedField,
    }

    if (imageItems.length === 0) {
      console.error('[ImageGen] No image in response:', finalDebugInfo.rawResponsePreview)
      throw new ImageGenerationError('No image in response.', finalDebugInfo)
    }

    const images = await Promise.all(imageItems.map(async (item) => {
      const dimensions = await buildDimensions(item.url, request.requestPayloadForLog)
      const sizeWarning = dimensions.estimated
        ? undefined
        : validateReturnedSize(dimensions.width, dimensions.height, request.requestPayloadForLog, model.sizeMode)

      if (sizeWarning) {
        console.warn('[ImageGen] Size validation warning:', sizeWarning, {
          request: request.debugInfo,
          responseParserMatchedField: item.matchedField,
        })
      }

      return {
        url: item.url,
        width: dimensions.width,
        height: dimensions.height,
        originalUrl: item.imageUrl,
        downloadUrl: item.imageUrl,
        widthEstimated: dimensions.estimated,
        sizeWarning,
      }
    }))

    const firstImage = images[0]

    return {
      images,
      url: firstImage.url,
      width: firstImage.width,
      height: firstImage.height,
      originalUrl: firstImage.originalUrl,
      downloadUrl: firstImage.downloadUrl,
      widthEstimated: firstImage.widthEstimated,
      sizeWarning: firstImage.sizeWarning,
      debugInfo: finalDebugInfo,
    }
  } catch (err: unknown) {
    if (err instanceof ImageGenerationError) throw err
    if (err instanceof Error) {
      throw new ImageGenerationError(err.message, requestDebug)
    }
    throw new ImageGenerationError(`Unknown error: ${String(err)}`, requestDebug)
  } finally {
    clearTimeout(timer)
  }
}

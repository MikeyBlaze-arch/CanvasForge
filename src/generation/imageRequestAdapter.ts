import { assertCleanBackendModel, type ImageModelDefinition } from './imageModelRegistry'

export type ImageGenerationDebugInfo = {
  selectedLabel?: string
  selectedModelId?: string
  requestModel: string
  engineType: ImageModelDefinition['engineType']
  sizeMode: ImageModelDefinition['sizeMode']
  endpoint: string
  method: 'POST'
  contentType: 'application/json' | 'multipart/form-data'
  hasReferenceImages: boolean
  referenceImageCount: number
  payloadKeys: string[]
  responseStatus?: number
  responseParserMatchedField?: string
  rawResponsePreview?: string
  requestWarnings?: string[]
}

export type ImageGenerationRequest = {
  endpoint: string
  method: 'POST'
  headers: Record<string, string>
  body: BodyInit
  debugInfo: ImageGenerationDebugInfo
  requestPayloadForLog: Record<string, unknown>
}

type ReferenceImage = {
  source: string
  mimeType?: string
  filename: string
  blob?: Blob
  base64?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function pickString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function dataUrlToReference(dataUrl: string, index: number): ReferenceImage | undefined {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/)
  if (!match) return undefined

  const mimeType = match[1] || 'image/png'
  const base64 = match[2] || ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  const ext = mimeType.split('/')[1] || 'png'

  return {
    source: dataUrl,
    mimeType,
    filename: `reference_${index + 1}.${ext}`,
    blob: new Blob([bytes], { type: mimeType }),
    base64,
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'))
    reader.readAsDataURL(blob)
  })
}

async function blobToReference(blob: Blob, index: number, filename?: string): Promise<ReferenceImage | undefined> {
  const dataUrl = await blobToDataUrl(blob)
  const ref = dataUrlToReference(dataUrl, index)
  if (!ref) return undefined
  return {
    ...ref,
    blob,
    filename: filename || ref.filename,
  }
}

function extractReferenceInputs(payload: Record<string, unknown>): unknown[] {
  const values = [payload.images, payload.image, payload.referenceImages, payload.reference_images]
  for (const value of values) {
    if (Array.isArray(value)) return value.filter(Boolean)
    if (value) return [value]
  }
  return []
}

async function normalizeReferenceImages(payload: Record<string, unknown>, warnings: string[]): Promise<ReferenceImage[]> {
  const inputs = extractReferenceInputs(payload)
  const refs: ReferenceImage[] = []

  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index]
    try {
      if (typeof input === 'string') {
        if (input.startsWith('data:image/')) {
          const ref = dataUrlToReference(input, index)
          if (ref) refs.push(ref)
          continue
        }

        try {
          const response = await fetch(input)
          if (response.ok) {
            const blob = await response.blob()
            const ref = await blobToReference(blob, index)
            if (ref) refs.push({ ...ref, source: input })
            else warnings.push(`参考图 ${index + 1} 无法转换为 base64。`)
          } else {
            warnings.push(`参考图 ${index + 1} 下载失败：${response.status} ${response.statusText}`)
            refs.push({ source: input, filename: `reference_${index + 1}.txt` })
          }
        } catch (error) {
          warnings.push(`参考图 ${index + 1} 读取失败：${error instanceof Error ? error.message : String(error)}`)
          refs.push({ source: input, filename: `reference_${index + 1}.txt` })
        }
        continue
      }

      if (typeof Blob !== 'undefined' && input instanceof Blob) {
        const fileName = typeof File !== 'undefined' && input instanceof File ? input.name : undefined
        const ref = await blobToReference(input, index, fileName)
        if (ref) refs.push(ref)
      }
    } catch (error) {
      warnings.push(`参考图 ${index + 1} 处理失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return refs
}

function createGptJsonPayload(payload: Record<string, unknown>, model: ImageModelDefinition) {
  return {
    model: model.backendModel,
    prompt: pickString(payload.prompt),
    size: pickString(payload.size),
    n: Number(payload.n ?? 1) || 1,
  }
}

function createNanoPayload(payload: Record<string, unknown>, model: ImageModelDefinition) {
  const aspectRatio = pickString(payload.aspect_ratio ?? payload.ratio, '1:1')
  const imageSize = pickString(payload.image_size ?? payload.imageSize, '2K')

  // Standard Nano relay fields only — keep in sync with buildNanoBananaPayload.
  return {
    model: model.backendModel,
    prompt: pickString(payload.prompt),
    n: Number(payload.n ?? 1) || 1,
    aspect_ratio: aspectRatio,
    image_size: imageSize,
  }
}

function appendReferenceFiles(formData: FormData, refs: ReferenceImage[]) {
  refs.forEach((ref, index) => {
    if (ref.blob) {
      formData.append('image', ref.blob, ref.filename)
    } else {
      formData.append('image', ref.source)
    }
    if (!ref.blob) return
    if (index === 0) return
  })
}

function createGptEditFormData(payload: Record<string, unknown>, model: ImageModelDefinition, refs: ReferenceImage[]) {
  const body = createGptJsonPayload(payload, model)
  const formData = new FormData()
  formData.append('model', body.model)
  formData.append('prompt', body.prompt)
  formData.append('size', body.size)
  formData.append('n', String(body.n))
  appendReferenceFiles(formData, refs)
  return formData
}

function createGeminiNanoPayload(payload: Record<string, unknown>, refs: ReferenceImage[]) {
  const nano = createNanoPayload(payload, {
    backendModel: String(payload.model ?? ''),
  } as ImageModelDefinition)
  const parts: Record<string, unknown>[] = []
  refs.forEach((ref, index) => {
    parts.push({ text: `Reference image ${index + 1}:` })
    if (ref.base64) {
      parts.push({
        inlineData: {
          mimeType: ref.mimeType || 'image/png',
          data: ref.base64,
        },
      })
    }
  })
  parts.push({ text: nano.prompt })

  return {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: nano.aspect_ratio,
        imageSize: nano.image_size,
      },
    },
  }
}

function metaFromPayload(payload: Record<string, unknown>) {
  return isRecord(payload._meta) ? payload._meta : undefined
}

function createDebugInfo(params: {
  payload: Record<string, unknown>
  model: ImageModelDefinition
  endpoint: string
  contentType: ImageGenerationDebugInfo['contentType']
  refs: ReferenceImage[]
  requestPayloadForLog: Record<string, unknown>
  warnings: string[]
}): ImageGenerationDebugInfo {
  const meta = metaFromPayload(params.payload)
  return {
    selectedLabel: params.model.label,
    selectedModelId: String(meta?.selectedModelId ?? params.model.id),
    requestModel: params.model.backendModel,
    engineType: params.model.engineType,
    sizeMode: params.model.sizeMode,
    endpoint: params.endpoint,
    method: 'POST',
    contentType: params.contentType,
    hasReferenceImages: params.refs.length > 0,
    referenceImageCount: params.refs.length,
    payloadKeys: Object.keys(params.requestPayloadForLog).sort(),
    requestWarnings: params.warnings.length > 0 ? params.warnings : undefined,
  }
}

export async function buildImageGenerationRequest(params: {
  payload: Record<string, unknown>
  model: ImageModelDefinition
  baseUrl: string
  authHeaders: Record<string, string>
}): Promise<ImageGenerationRequest> {
  const { payload, model, baseUrl, authHeaders } = params
  assertCleanBackendModel(model.backendModel)

  const warnings: string[] = []
  const refs = await normalizeReferenceImages(payload, warnings)
  const hasReferenceImages = refs.length > 0

  if (model.engineType === 'gpt-image-2') {
    if (hasReferenceImages) {
      const endpoint = `${baseUrl}/v1/images/edits`
      const formData = createGptEditFormData(payload, model, refs)
      const requestPayloadForLog = {
        ...createGptJsonPayload(payload, model),
        image: `[${refs.length} reference image${refs.length > 1 ? 's' : ''}]`,
      }
      return {
        endpoint,
        method: 'POST',
        headers: { ...authHeaders },
        body: formData,
        requestPayloadForLog,
        debugInfo: createDebugInfo({
          payload,
          model,
          endpoint,
          contentType: 'multipart/form-data',
          refs,
          requestPayloadForLog,
          warnings,
        }),
      }
    }

    const endpoint = `${baseUrl}/v1/images/generations`
    const requestPayloadForLog = createGptJsonPayload(payload, model)
    return {
      endpoint,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(requestPayloadForLog),
      requestPayloadForLog,
      debugInfo: createDebugInfo({
        payload,
        model,
        endpoint,
        contentType: 'application/json',
        refs,
        requestPayloadForLog,
        warnings,
      }),
    }
  }

  if (hasReferenceImages) {
    const inlineRefs = refs.filter((ref) => ref.base64)
    const endpoint = `${baseUrl}/v1beta/models/${model.backendModel}:generateContent`
    if (inlineRefs.length === 0) {
      warnings.push('Nano Banana 参考图未能转换为 inlineData，仍按 PixelForge 路径发送，可能由中转返回错误。')
    }
    const body = createGeminiNanoPayload({ ...payload, model: model.backendModel }, inlineRefs)
    const requestPayloadForLog = {
      contents: `[prompt + ${inlineRefs.length} inlineData reference image${inlineRefs.length > 1 ? 's' : ''}]`,
      generationConfig: body.generationConfig,
    }
    return {
      endpoint,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
      requestPayloadForLog,
      debugInfo: createDebugInfo({
        payload,
        model,
        endpoint,
        contentType: 'application/json',
        refs,
        requestPayloadForLog,
        warnings,
      }),
    }
  }

  const endpoint = `${baseUrl}/v1/images/generations`
  const requestPayloadForLog = createNanoPayload(payload, model)
  return {
    endpoint,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(requestPayloadForLog),
    requestPayloadForLog,
    debugInfo: createDebugInfo({
      payload,
      model,
      endpoint,
      contentType: 'application/json',
      refs,
      requestPayloadForLog,
      warnings,
    }),
  }
}

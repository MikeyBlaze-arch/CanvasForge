export type ParsedImageItem = {
  imageUrl?: string
  dataUrl?: string
  matchedField?: string
}

export type ParsedImageResponse = {
  images: ParsedImageItem[]
  imageUrl?: string
  dataUrl?: string
  matchedField?: string
}

const IMAGE_URL_RE = /https?:\/\/[^\s"'`<>)]+|blob:[^\s"'`<>)]+|data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/
const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\(([^)\s]+)\)/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeUrl(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(IMAGE_URL_RE)
  return match ? match[0] : trimmed
}

function base64ToDataUrl(value: string, mimeType = 'image/png') {
  if (value.startsWith('data:image/')) return value
  return `data:${mimeType};base64,${value}`
}

function looksLikeBareImageBase64(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 120 && /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed)
}

function parseImageString(value: string, field: string): ParsedImageItem | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith('data:image/')) {
    return { dataUrl: trimmed, matchedField: field }
  }

  const markdown = trimmed.match(MARKDOWN_IMAGE_RE)
  if (markdown?.[1]) {
    const url = sanitizeUrl(markdown[1])
    return url.startsWith('data:image/')
      ? { dataUrl: url, matchedField: `${field}.markdown_image` }
      : { imageUrl: url, matchedField: `${field}.markdown_image` }
  }

  const imageUrl = trimmed.match(IMAGE_URL_RE)?.[0]
  if (imageUrl) {
    const url = sanitizeUrl(imageUrl)
    return url.startsWith('data:image/')
      ? { dataUrl: url, matchedField: field }
      : { imageUrl: url, matchedField: field }
  }

  if (looksLikeBareImageBase64(trimmed)) {
    return { dataUrl: base64ToDataUrl(trimmed), matchedField: field }
  }

  return undefined
}

function parseInlineData(value: unknown, field: string): ParsedImageItem | undefined {
  if (!isRecord(value) || typeof value.data !== 'string') return undefined
  const mimeType = String(value.mimeType ?? value.mime_type ?? 'image/png')
  return {
    dataUrl: base64ToDataUrl(value.data, mimeType),
    matchedField: field,
  }
}

function walk(value: unknown, path: string, visited: WeakSet<object>): ParsedImageItem | undefined {
  if (typeof value === 'string') {
    return parseImageString(value, path)
  }

  if (!value || typeof value !== 'object') return undefined
  if (visited.has(value)) return undefined
  visited.add(value)

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const found = walk(value[index], `${path}[${index}]`, visited)
      if (found) return found
    }
    return undefined
  }

  const object = value as Record<string, unknown>

  for (const key of ['inlineData', 'inline_data']) {
    const inline = parseInlineData(object[key], path ? `${path}.${key}` : key)
    if (inline) return inline
  }

  if (typeof object.b64_json === 'string') {
    return {
      dataUrl: base64ToDataUrl(object.b64_json, String(object.mime_type ?? object.mimeType ?? 'image/png')),
      matchedField: path ? `${path}.b64_json` : 'b64_json',
    }
  }

  const preferredUrlKeys = [
    'url',
    'output_url',
    'outputUrl',
    'image_url',
    'imageUrl',
    'result_url',
    'resultUrl',
    'download_url',
    'downloadUrl',
    'original_url',
    'originalUrl',
  ]

  for (const key of preferredUrlKeys) {
    const candidate = object[key]
    if (typeof candidate === 'string') {
      const found = parseImageString(candidate, path ? `${path}.${key}` : key)
      if (found) return found
    }
    if (isRecord(candidate)) {
      const nested = walk(candidate, path ? `${path}.${key}` : key, visited)
      if (nested) return nested
    }
  }

  for (const [key, candidate] of Object.entries(object)) {
    const nested = walk(candidate, path ? `${path}.${key}` : key, visited)
    if (nested) return nested
  }

  return undefined
}

function addParsedImage(result: ParsedImageItem[], item: ParsedImageItem | undefined) {
  const url = item?.imageUrl ?? item?.dataUrl
  if (!item || !url) return
  if (result.some((existing) => (existing.imageUrl ?? existing.dataUrl) === url)) return
  result.push(item)
}

function parseDataItem(value: unknown, path: string): ParsedImageItem | undefined {
  if (!isRecord(value)) return walk(value, path, new WeakSet())

  if (typeof value.url === 'string') {
    const parsed = parseImageString(value.url, `${path}.url`)
    if (parsed) return parsed
  }

  if (typeof value.b64_json === 'string') {
    return {
      dataUrl: base64ToDataUrl(value.b64_json, String(value.mime_type ?? value.mimeType ?? 'image/png')),
      matchedField: `${path}.b64_json`,
    }
  }

  return walk(value, path, new WeakSet())
}

function withCompatFields(images: ParsedImageItem[]): ParsedImageResponse {
  const first = images[0]
  return {
    images,
    imageUrl: first?.imageUrl,
    dataUrl: first?.dataUrl,
    matchedField: first?.matchedField,
  }
}

export function parseImageGenerationResponse(raw: unknown): ParsedImageResponse {
  const images: ParsedImageItem[] = []

  if (isRecord(raw) && Array.isArray(raw.data)) {
    for (let index = 0; index < raw.data.length; index++) {
      addParsedImage(images, parseDataItem(raw.data[index], `data[${index}]`))
    }
    if (images.length > 0) return withCompatFields(images)
  }

  addParsedImage(images, walk(raw, '', new WeakSet()))
  return withCompatFields(images)
}

export function buildRawResponsePreview(raw: unknown, maxLength = 3000): string {
  const seen = new WeakSet<object>()
  const safe = JSON.stringify(raw, (_key, value: unknown) => {
    if (typeof value === 'string') {
      if (value.startsWith('data:image/')) return `[dataURL ${value.length} chars]`
      if (looksLikeBareImageBase64(value)) return `[base64 ${value.length} chars]`
      return value.length > 600 ? `${value.slice(0, 600)}... [truncated ${value.length} chars]` : value
    }
    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[Circular]'
      seen.add(value)
    }
    return value
  }, 2)

  const text = safe ?? String(raw ?? '')
  return text.length > maxLength ? `${text.slice(0, maxLength)}... [truncated ${text.length} chars]` : text
}

/**
 * Unified image download utilities for CanvasForge image nodes.
 * All download logic is frontend-only — no server-side saving.
 * Download priority: downloadUrl > originalImageUrl > imageUrl.
 */

export type ImageSourceData = {
  imageUrl?: string
  originalImageUrl?: string
  downloadUrl?: string
  url?: string
  dataUrl?: string
  base64?: string
  mimeType?: string
  fileName?: string
  createdAt?: number
  widthEstimated?: boolean
  [key: string]: unknown
}

/** Extract the best download URL — prefers original/full-resolution over preview. */
export function getDownloadSource(data: ImageSourceData): string | undefined {
  if (data.downloadUrl && data.downloadUrl.length > 0) return data.downloadUrl
  if (data.originalImageUrl && data.originalImageUrl.length > 0) return data.originalImageUrl
  return getImageSource(data)
}

/** Extract any available image URL from node data (for preview/display, not download). */
export function getImageSource(data: ImageSourceData): string | undefined {
  if (data.imageUrl && data.imageUrl.length > 0) return data.imageUrl
  if (data.url && data.url.length > 0) return data.url
  if (data.dataUrl && data.dataUrl.length > 0) return data.dataUrl
  if (data.base64 && data.base64.length > 0) {
    return data.base64.startsWith('data:') ? data.base64 : `data:image/png;base64,${data.base64}`
  }
  return undefined
}

/** Detect MIME type from image source string or explicit mimeType field. */
export function getImageMimeType(data: ImageSourceData): string {
  if (data.mimeType) return data.mimeType

  const src = getImageSource(data)
  if (!src) return 'image/png'

  const mimeMatch = src.match(/^data:(image\/[a-zA-Z0-9.+-]+);/)
  if (mimeMatch) return mimeMatch[1]

  return 'image/png'
}

/** Build filename from existing fileName or auto-generate with timestamp. */
export function getDownloadFilename(data: ImageSourceData): string {
  if (data.fileName && data.fileName.length > 0) return data.fileName

  const mime = getImageMimeType(data)
  const ext = mimeToExt(mime)

  const now = new Date()
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')

  return `canvasforge-image-${ts}.${ext}`
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
  }
  return map[mime] ?? 'png'
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mimeMatch = parts[0]?.match(/:(.*?);/)
  const mime = mimeMatch?.[1] ?? 'image/png'
  const base64 = parts[1] ?? ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Download the image from the provided node data.
 * Priority: downloadUrl > originalImageUrl > imageUrl / url / dataUrl / base64.
 */
export async function downloadImage(data: ImageSourceData): Promise<void> {
  const src = getDownloadSource(data)
  if (!src) {
    throw new Error('No image source available')
  }

  if (data.widthEstimated) {
    console.warn('[Download] Current dimensions may be estimated from request params, not actual image size.')
  }

  const filename = getDownloadFilename(data)

  // Data URL or base64 — convert directly to Blob and download
  if (src.startsWith('data:')) {
    const blob = dataUrlToBlob(src)
    triggerDownload(blob, filename)
    return
  }

  // Bare base64 (no data: prefix) — add prefix then Blob download
  if (/^[A-Za-z0-9+/=]+$/.test(src) && src.length > 100) {
    const mime = getImageMimeType(data)
    const dataUrl = `data:${mime};base64,${src}`
    const blob = dataUrlToBlob(dataUrl)
    triggerDownload(blob, filename)
    return
  }

  // HTTP/HTTPS URL — fetch first, then Blob download
  try {
    const resp = await fetch(src)
    if (!resp.ok) {
      throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`)
    }
    const blob = await resp.blob()
    triggerDownload(blob, filename)
  } catch (fetchErr) {
    console.warn('[Download] Fetch failed, falling back to direct link:', fetchErr)

    const a = document.createElement('a')
    a.href = src
    a.download = filename
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

const THUMBNAIL_MAX_WIDTH = 320
const THUMBNAIL_MAX_HEIGHT = 320

export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/')
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('HISTORY_THUMBNAIL_DECODE_FAILED'))
    img.src = src
  })
}

export async function generateHistoryThumbnail(src: string): Promise<string | undefined> {
  if (!src || typeof document === 'undefined') return undefined

  try {
    const img = await loadImage(src)
    const width = img.naturalWidth
    const height = img.naturalHeight
    if (width <= 0 || height <= 0) return undefined

    const scale = Math.min(1, THUMBNAIL_MAX_WIDTH / width, THUMBNAIL_MAX_HEIGHT / height)
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return undefined
  }
}

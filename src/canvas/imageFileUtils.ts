/**
 * Shared helpers for turning a local image File into the data an
 * ImageAssetNode needs (data URL + intrinsic dimensions).
 */

export type ReadImageResult = {
  file: File
  imageUrl: string
  /** Lightweight thumbnail data URL used for node card display. */
  thumbnailUrl: string
  /** Full-resolution data URL used for download / persistence. */
  originalUrl: string
  fileName: string
  mimeType: string
  size: number
  naturalWidth: number
  naturalHeight: number
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/** Thumbnail max dimension — matches the node card display constraints. */
const THUMBNAIL_MAX_DIM = 400

/**
 * Generate a compressed thumbnail data URL from an HTMLImageElement.
 * Preserves transparency for PNG/WebP; uses JPEG for opaque formats.
 */
function generateThumbnail(img: HTMLImageElement, mimeType: string): string {
  const w = img.naturalWidth
  const h = img.naturalHeight
  if (w <= 0 || h <= 0) return img.src

  const scale = Math.min(1, THUMBNAIL_MAX_DIM / Math.max(w, h))
  const tw = Math.max(1, Math.round(w * scale))
  const th = Math.max(1, Math.round(h * scale))

  try {
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) return img.src
    ctx.drawImage(img, 0, 0, tw, th)

    const hasAlpha = mimeType === 'image/png' || mimeType === 'image/webp' || mimeType === 'image/gif'
    if (hasAlpha) {
      return canvas.toDataURL('image/png')
    }
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    return img.src
  }
}

/**
 * Read a single image File: base64 data URL via FileReader, then decode
 * intrinsic dimensions via Image.onload. Rejects on read/decode failure.
 * Also generates a lightweight thumbnail for efficient node display.
 */
export function readImageFile(file: File): Promise<ReadImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('FILE_READ_FAILED'))
    reader.onload = () => {
      const originalUrl = reader.result as string
      const img = new Image()
      img.onload = () => {
        const thumbnailUrl = generateThumbnail(img, file.type)
        resolve({
          file,
          imageUrl: thumbnailUrl,
          thumbnailUrl,
          originalUrl,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        })
      }
      img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'))
      img.src = originalUrl
    }
    reader.readAsDataURL(file)
  })
}

/** Read several image Files, skipping any that fail to load. */
export async function readImageFiles(files: File[]): Promise<ReadImageResult[]> {
  const results = await Promise.allSettled(files.map(readImageFile))
  return results
    .filter((r): r is PromiseFulfilledResult<ReadImageResult> => r.status === 'fulfilled')
    .map((r) => r.value)
}

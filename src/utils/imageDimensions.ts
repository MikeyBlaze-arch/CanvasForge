/**
 * Image dimension utilities for CanvasForge.
 * Thumbnail calculations keep nodes compact (max 360×280) regardless of source resolution.
 */

export type ImageDimResult = {
  naturalWidth: number
  naturalHeight: number
}

export type ThumbnailSize = {
  width: number
  height: number
}

export type PreviewCrop = {
  left: number
  top: number
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
}

/** Node card thumbnail constraints — keeps previews compact. */
const THUMB_MAX_W = 360
const THUMB_MAX_H = 280
const THUMB_MIN_W = 180
const THUMB_MIN_H = 140

/** Default when dimensions are unknown. */
const FALLBACK: ThumbnailSize = { width: 320, height: 240 }

/**
 * Load an image from a URL and return its natural dimensions.
 */
export function getImageDimensions(url: string): Promise<ImageDimResult> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      })
    }
    img.onerror = () => reject(new Error('Failed to load image for dimension detection'))
    img.src = url
  })
}

/**
 * Calculate thumbnail display size.
 * Always fits within the 360×280 max box, preserves aspect ratio.
 * The calculated width is used as the node card width.
 *
 * Original pixel dimensions are preserved as naturalWidth/naturalHeight
 * and displayed in the node title — they do NOT affect node size.
 */
export function calcThumbnailSize(naturalW: number, naturalH: number): ThumbnailSize {
  if (!naturalW || !naturalH || naturalW <= 0 || naturalH <= 0) {
    return FALLBACK
  }

  const ratio = naturalW / naturalH

  // Scale to fit within the max box
  let w = THUMB_MAX_W
  let h = w / ratio

  if (h > THUMB_MAX_H) {
    h = THUMB_MAX_H
    w = h * ratio
  }

  // If very narrow, try to reach min width (only if height allows)
  if (w < THUMB_MIN_W && h < THUMB_MAX_H) {
    w = THUMB_MIN_W
    h = w / ratio
  }

  // If very short, try to reach min height (only if width allows)
  if (h < THUMB_MIN_H && w < THUMB_MAX_W) {
    h = THUMB_MIN_H
    w = h * ratio
  }

  // Final clamp to max box
  if (w > THUMB_MAX_W) { w = THUMB_MAX_W; h = w / ratio }
  if (h > THUMB_MAX_H) { h = THUMB_MAX_H; w = h * ratio }

  // Floor minimum
  if (w < THUMB_MIN_W) w = THUMB_MIN_W
  if (h < THUMB_MIN_H) h = THUMB_MIN_H

  return { width: Math.round(w), height: Math.round(h) }
}

/**
 * Calculate node card display width from image dimensions.
 * Uses the same thumbnail constraints.
 */
export function calcNodeDisplayWidth(naturalW: number, naturalH: number): number {
  return calcThumbnailSize(naturalW, naturalH).width
}

/**
 * Calculate node card display dimensions (width + height).
 */
export function calcNodeDisplaySize(naturalW: number, naturalH: number): ThumbnailSize {
  return calcThumbnailSize(naturalW, naturalH)
}

/**
 * Detect white or transparent edges around the subject in an image.
 * Returns crop coordinates to remove empty borders while preserving subject.
 */
export function detectSubjectBounds(
  image: HTMLImageElement,
  options?: { safeMarginPercent?: number },
): PreviewCrop | null {
  const safeMargin = (options?.safeMarginPercent ?? 3) / 100

  try {
    const canvas = document.createElement('canvas')
    const w = image.naturalWidth
    const h = image.naturalHeight

    const maxSample = 400
    const scale = Math.min(1, maxSample / Math.max(w, h))
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const pixels = imageData.data
    const sw = canvas.width
    const sh = canvas.height

    const WHITE_THRESHOLD = 240
    const ALPHA_THRESHOLD = 10

    function isBackground(r: number, g: number, b: number, a: number): boolean {
      if (a < ALPHA_THRESHOLD) return true
      if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) return true
      return false
    }

    let top = 0
    let bottom = sh - 1
    let left = 0
    let right = sw - 1

    for (let y = 0; y < sh; y++) {
      let hasContent = false
      for (let x = 0; x < sw; x++) {
        const idx = (y * sw + x) * 4
        if (!isBackground(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3])) {
          hasContent = true
          break
        }
      }
      if (hasContent) { top = y; break }
    }

    for (let y = sh - 1; y >= 0; y--) {
      let hasContent = false
      for (let x = 0; x < sw; x++) {
        const idx = (y * sw + x) * 4
        if (!isBackground(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3])) {
          hasContent = true
          break
        }
      }
      if (hasContent) { bottom = y; break }
    }

    for (let x = 0; x < sw; x++) {
      let hasContent = false
      for (let y = top; y <= bottom; y++) {
        const idx = (y * sw + x) * 4
        if (!isBackground(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3])) {
          hasContent = true
          break
        }
      }
      if (hasContent) { left = x; break }
    }

    for (let x = sw - 1; x >= 0; x--) {
      let hasContent = false
      for (let y = top; y <= bottom; y++) {
        const idx = (y * sw + x) * 4
        if (!isBackground(pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3])) {
          hasContent = true
          break
        }
      }
      if (hasContent) { right = x; break }
    }

    const detectedW = right - left + 1
    const detectedH = bottom - top + 1
    if (detectedW <= 0 || detectedH <= 0) return null
    if (detectedW < sw * 0.1 || detectedH < sh * 0.1) return null

    const marginW = Math.round(detectedW * safeMargin)
    const marginH = Math.round(detectedH * safeMargin)
    const invScale = 1 / scale

    return {
      left: Math.max(0, Math.round((left - marginW) * invScale)),
      top: Math.max(0, Math.round((top - marginH) * invScale)),
      width: Math.round((right + marginW - (left - marginW)) * invScale),
      height: Math.round((bottom + marginH - (top - marginH)) * invScale),
      sourceWidth: w,
      sourceHeight: h,
    }
  } catch {
    return null
  }
}

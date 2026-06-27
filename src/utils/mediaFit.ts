export type MediaFitInput = {
  mediaWidth?: number
  mediaHeight?: number
  viewportWidth: number
  viewportHeight: number
  horizontalPadding?: number
  verticalPadding?: number
  reservedChromeHeight?: number
  maxWidthRatio?: number
  maxHeightRatio?: number
  fallbackAspectRatio?: number
  minWidth?: number
  minHeight?: number
}

export type MediaFitSize = {
  width: number
  height: number
  aspectRatio: number
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function calcMediaFitSize(input: MediaFitInput): MediaFitSize {
  const aspectRatio = isPositiveFinite(input.mediaWidth) && isPositiveFinite(input.mediaHeight)
    ? input.mediaWidth / input.mediaHeight
    : input.fallbackAspectRatio && input.fallbackAspectRatio > 0
      ? input.fallbackAspectRatio
      : 1

  const maxWidthRatio = input.maxWidthRatio ?? 0.96
  const maxHeightRatio = input.maxHeightRatio ?? 0.94
  const horizontalPadding = input.horizontalPadding ?? 48
  const verticalPadding = input.verticalPadding ?? 48
  const reservedChromeHeight = input.reservedChromeHeight ?? 92

  const availableWidth = Math.max(1, input.viewportWidth * maxWidthRatio - horizontalPadding)
  const availableHeight = Math.max(1, input.viewportHeight * maxHeightRatio - verticalPadding - reservedChromeHeight)
  const minWidth = Math.min(input.minWidth ?? 260, availableWidth)
  const minHeight = Math.min(input.minHeight ?? 180, availableHeight)

  let width = availableWidth
  let height = width / aspectRatio

  if (height > availableHeight) {
    height = availableHeight
    width = height * aspectRatio
  }

  width = Math.min(availableWidth, Math.max(minWidth, width))
  height = Math.min(availableHeight, Math.max(minHeight, height))

  if (width / height > aspectRatio) {
    width = height * aspectRatio
  } else {
    height = width / aspectRatio
  }

  return {
    width: Math.max(1, Math.round(Math.min(width, availableWidth))),
    height: Math.max(1, Math.round(Math.min(height, availableHeight))),
    aspectRatio,
  }
}

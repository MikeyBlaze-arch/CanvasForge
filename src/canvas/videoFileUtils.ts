export type ReadVideoResult = {
  file: File
  videoUrl: string
  fileName: string
  mimeType: string
  size: number
  naturalWidth: number
  naturalHeight: number
  duration: number
  previewWidth: number
  previewHeight: number
}

const MIN_VIDEO_NODE_WIDTH = 190
const MAX_VIDEO_NODE_WIDTH = 460
const MIN_VIDEO_NODE_HEIGHT = 160
const MAX_VIDEO_NODE_HEIGHT = 520

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

export type ResolvedVideoSource = {
  url: string
  filename?: string
  file?: File
  width?: number
  height?: number
  duration?: number
  source: string
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function calculateVideoNodeSize(videoWidth?: number, videoHeight?: number): { width: number; height: number } {
  if (!videoWidth || !videoHeight || videoWidth <= 0 || videoHeight <= 0) {
    return { width: 320, height: 220 }
  }

  const ratio = videoWidth / videoHeight

  if (ratio >= 1.2) {
    const width = 420
    const height = Math.round(width / ratio)
    return {
      width: clamp(width, MIN_VIDEO_NODE_WIDTH, MAX_VIDEO_NODE_WIDTH),
      height: clamp(height, MIN_VIDEO_NODE_HEIGHT, MAX_VIDEO_NODE_HEIGHT),
    }
  }

  if (ratio <= 0.8) {
    const height = 460
    const width = Math.round(height * ratio)
    return {
      width: clamp(width, MIN_VIDEO_NODE_WIDTH, MAX_VIDEO_NODE_WIDTH),
      height: clamp(height, MIN_VIDEO_NODE_HEIGHT, MAX_VIDEO_NODE_HEIGHT),
    }
  }

  return { width: 320, height: 320 }
}

export function resolveVideoSource(input: unknown): ResolvedVideoSource | null {
  if (!input) return null

  if (typeof input === 'string') {
    if (!input) return null
    return {
      url: input,
      source: input.startsWith('blob:') ? 'local-preview' : 'remote',
    }
  }

  if (typeof input !== 'object') return null

  const value = input as {
    url?: unknown
    previewUrl?: unknown
    filename?: unknown
    name?: unknown
    fileName?: unknown
    file?: unknown
    width?: unknown
    height?: unknown
    naturalWidth?: unknown
    naturalHeight?: unknown
    duration?: unknown
    source?: unknown
  }

  const url = typeof value.url === 'string'
    ? value.url
    : typeof value.previewUrl === 'string'
      ? value.previewUrl
      : ''

  if (!url) return null

  const filename = typeof value.filename === 'string'
    ? value.filename
    : typeof value.name === 'string'
      ? value.name
      : typeof value.fileName === 'string'
        ? value.fileName
        : undefined

  const width = typeof value.width === 'number'
    ? value.width
    : typeof value.naturalWidth === 'number'
      ? value.naturalWidth
      : undefined
  const height = typeof value.height === 'number'
    ? value.height
    : typeof value.naturalHeight === 'number'
      ? value.naturalHeight
      : undefined

  return {
    url,
    filename,
    file: value.file instanceof File ? value.file : undefined,
    width,
    height,
    duration: typeof value.duration === 'number' ? value.duration : undefined,
    source: typeof value.source === 'string'
      ? value.source
      : url.startsWith('blob:')
        ? 'local-preview'
        : 'object',
  }
}

export function readVideoFile(file: File): Promise<ReadVideoResult> {
  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true

    video.onloadedmetadata = () => {
      const nw = video.videoWidth
      const nh = video.videoHeight
      const duration = video.duration
      const preview = calculateVideoNodeSize(nw, nh)
      resolve({
        file,
        videoUrl,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        naturalWidth: nw,
        naturalHeight: nh,
        duration: isFinite(duration) ? duration : 0,
        previewWidth: preview.width,
        previewHeight: preview.height,
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl)
      reject(new Error('VIDEO_LOAD_FAILED'))
    }

    video.src = videoUrl
  })
}

// Video model registry: single source of truth for CanvasForge video generation.
// backendModel strings are sent to the New API `/v1/video/generations` endpoint
// verbatim — size/duration/aspect must NEVER be appended to the model name.

export type VideoModelProvider = 'grok' | 'omni' | 'seedance' | 'veo'
export type VideoSizePreset = '720p' | '1080p'
export type VideoAspectRatio = '16:9' | '9:16' | '1:1'

export type VideoModelDefinition = {
  id: string
  label: string
  backendModel: string
  provider: VideoModelProvider
  defaultDuration: number
  allowedDurations: number[]
  defaultAspectRatio: VideoAspectRatio
  allowedAspectRatios: VideoAspectRatio[]
  defaultSize: VideoSizePreset
  allowedSizes: VideoSizePreset[]
  supportsImageInput: boolean
  endpointMode: 'video_generations'
}

export const VIDEO_MODEL_REGISTRY: VideoModelDefinition[] = [
  {
    id: 'c-grok-1-5-video-15s',
    label: 'C Grok 1.5 视频 15s',
    backendModel: 'C-grok-1.5-video-15s',
    provider: 'grok',
    defaultDuration: 15,
    allowedDurations: [15],
    defaultAspectRatio: '16:9',
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultSize: '720p',
    allowedSizes: ['720p', '1080p'],
    supportsImageInput: true,
    endpointMode: 'video_generations',
  },
  {
    id: 'a-grok-imagine-1-5-video-apimart',
    label: 'A Grok Imagine 1.5 视频',
    backendModel: 'A-grok-imagine-1.5-video-apimart',
    provider: 'grok',
    defaultDuration: 6,
    allowedDurations: [5, 6, 10, 15],
    defaultAspectRatio: '16:9',
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultSize: '720p',
    allowedSizes: ['720p', '1080p'],
    supportsImageInput: true,
    endpointMode: 'video_generations',
  },
  {
    id: 'c-omni-flash-10s',
    label: 'C Omni Flash 10s',
    backendModel: 'C-omni_flash-10s',
    provider: 'omni',
    defaultDuration: 10,
    allowedDurations: [10],
    defaultAspectRatio: '16:9',
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultSize: '720p',
    allowedSizes: ['720p', '1080p'],
    supportsImageInput: true,
    endpointMode: 'video_generations',
  },
  {
    id: 'c-seedance-2-fast',
    label: 'C Seedance 2 Fast',
    backendModel: 'C-seedance-2-fast',
    provider: 'seedance',
    defaultDuration: 5,
    allowedDurations: [5, 10],
    defaultAspectRatio: '16:9',
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultSize: '720p',
    allowedSizes: ['720p', '1080p'],
    supportsImageInput: true,
    endpointMode: 'video_generations',
  },
  {
    id: 'c-seedance-2',
    label: 'C Seedance 2',
    backendModel: 'C-seedance-2',
    provider: 'seedance',
    defaultDuration: 5,
    allowedDurations: [5, 10],
    defaultAspectRatio: '16:9',
    allowedAspectRatios: ['16:9', '9:16', '1:1'],
    defaultSize: '720p',
    allowedSizes: ['720p', '1080p'],
    supportsImageInput: true,
    endpointMode: 'video_generations',
  },
  {
    id: 'c-veo3-1-fast',
    label: 'C Veo 3.1 Fast',
    backendModel: 'C-veo3.1-fast',
    provider: 'veo',
    defaultDuration: 8,
    allowedDurations: [5, 8],
    defaultAspectRatio: '16:9',
    allowedAspectRatios: ['16:9', '9:16'],
    defaultSize: '720p',
    allowedSizes: ['720p', '1080p'],
    supportsImageInput: true,
    endpointMode: 'video_generations',
  },
]

export const DEFAULT_VIDEO_MODEL_ID = VIDEO_MODEL_REGISTRY[0].id

const MODEL_BY_ID = new Map(VIDEO_MODEL_REGISTRY.map((m) => [m.id, m]))
const MODEL_BY_BACKEND = new Map(VIDEO_MODEL_REGISTRY.map((m) => [m.backendModel.toLowerCase(), m]))

export function getVideoModelById(id?: string | null): VideoModelDefinition | undefined {
  return id ? MODEL_BY_ID.get(id) : undefined
}

export function getVideoModelByBackendModel(backendModel?: string | null): VideoModelDefinition | undefined {
  if (!backendModel) return undefined
  return MODEL_BY_BACKEND.get(backendModel.toLowerCase())
}

/** Resolve a (possibly legacy/unknown) model id to a known registry id, falling back to the default. */
export function normalizeVideoModelId(id?: string | null): string {
  if (id && MODEL_BY_ID.has(id)) return id
  const byBackend = getVideoModelByBackendModel(id)
  if (byBackend) return byBackend.id
  return DEFAULT_VIDEO_MODEL_ID
}

export function normalizeVideoAspectRatio(value?: string | null, allowed?: VideoAspectRatio[]): VideoAspectRatio {
  if (value === '16:9' || value === '9:16' || value === '1:1') {
    if (!allowed || allowed.includes(value)) return value
  }
  return allowed?.[0] ?? '16:9'
}

export function normalizeVideoSize(value?: string | null, allowed?: VideoSizePreset[]): VideoSizePreset {
  if (value === '720p' || value === '1080p') {
    if (!allowed || allowed.includes(value)) return value
  }
  return allowed?.[0] ?? '720p'
}

/** Clamp a duration to the model's allowed list (falls back to the model default). */
export function clampVideoDuration(model: VideoModelDefinition, duration?: number): number {
  if (duration != null && model.allowedDurations.includes(duration)) return duration
  return model.defaultDuration
}

// New API video generation client.
//   POST /v1/video/generations        -> create async task, returns task_id
//   GET  /v1/video/generations/{id}   -> poll status until completed/failed

import {
  getApiKey,
  getApiBaseUrl,
  getAuthHeaders,
  isValidBaseUrl,
  resolveApiUrl,
} from '../store/apiSettingsStore'

export type VideoGenStatus = 'idle' | 'queued' | 'submitting' | 'polling' | 'success' | 'failed'

export class VideoGenerationError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'VideoGenerationError'
    this.status = status
  }
}

export type VideoGenerationResult = {
  videoUrl: string
  width: number
  height: number
  duration?: number
  taskId: string
  raw: unknown
}

export type VideoStatusUpdate = {
  phase: 'queued' | 'polling'
  status?: string
  progress?: number
  raw?: unknown
}

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 10 * 60 * 1000

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseErrorBody(body: unknown): string {
  if (typeof body === 'string') {
    try {
      const json = JSON.parse(body)
      return parseErrorBody(json)
    } catch {
      return body || '(empty response body)'
    }
  }
  if (isRecord(body)) {
    if (typeof body.error === 'object' && body.error && typeof (body.error as Record<string, unknown>).message === 'string') {
      return String((body.error as Record<string, unknown>).message)
    }
    if (typeof body.message === 'string') return body.message
    if (typeof body.msg === 'string') return body.msg
    if (typeof body.detail === 'string') return body.detail
  }
  try {
    return JSON.stringify(body) || '(empty response body)'
  } catch {
    return '(empty response body)'
  }
}

async function readBody(resp: Response): Promise<unknown> {
  const text = await resp.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function statusLabel(resp: Response): string {
  return `${resp.status} ${resp.statusText}`.trim()
}

/** Resolve a possibly-relative video URL against the API base URL. */
function resolveMediaUrl(url: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) return url
  if (url.startsWith('/')) return `${baseUrl}${url}`
  return `${baseUrl}/${url}`
}

/**
 * Extract a video URL from a completed task response, supporting the common
 * field names used by New API relays.
 */
export function extractVideoUrl(response: unknown, baseUrl?: string): string | undefined {
  if (!response) return undefined

  const topKeys = [
    'url',
    'video_url',
    'videoUrl',
    'output_url',
    'outputUrl',
    'result_url',
    'resultUrl',
  ]

  if (isRecord(response)) {
    for (const key of topKeys) {
      const value = response[key]
      if (typeof value === 'string' && value.trim()) {
        return baseUrl ? resolveMediaUrl(value.trim(), baseUrl) : value.trim()
      }
    }

    // Nested objects: data.url / content.url / video.url
    for (const key of ['data', 'content', 'video', 'output', 'result']) {
      const nested = response[key]
      if (isRecord(nested)) {
        const found = extractVideoUrl(nested, baseUrl)
        if (found) return found
      }
    }

    // data[0].url
    if (Array.isArray(response.data) && response.data[0]) {
      const found = extractVideoUrl(response.data[0], baseUrl)
      if (found) return found
    }
  }

  return undefined
}

function extractTaskId(response: unknown): string | undefined {
  if (!isRecord(response)) return undefined
  const candidates = [response.task_id, response.taskId, response.id]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate)
  }
  return undefined
}

function extractDimensions(response: unknown): { width?: number; height?: number; duration?: number } {
  if (!isRecord(response)) return {}
  const meta = isRecord(response.metadata) ? response.metadata : {}
  const num = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value
      : typeof value === 'string' && /^\d+$/.test(value) ? Number(value)
        : undefined
  return {
    width: num(meta.width) ?? num(response.width),
    height: num(meta.height) ?? num(response.height),
    duration: num(meta.duration) ?? num(response.duration),
  }
}

function normalizeStatus(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (!value) return ''
  // Treat common synonyms as the canonical New API states.
  if (value === 'succeeded' || value === 'success' || value === 'complete' || value === 'finished') return 'completed'
  if (value === 'processing' || value === 'running' || value === 'in-progress') return 'in_progress'
  if (value === 'pending' || value === 'waiting') return 'queued'
  if (value === 'error') return 'failed'
  return value
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/** Create a video generation task. Returns the task id + raw response. */
export async function createVideoGenerationTask(params: {
  payload: Record<string, unknown>
  baseUrl: string
  signal: AbortSignal
}): Promise<{ taskId: string; raw: unknown }> {
  const endpoint = resolveApiUrl('/v1/video/generations')
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...getAuthHeaders() }

  let resp: Response
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(params.payload),
      signal: params.signal,
    })
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new VideoGenerationError(`网络请求失败：${err instanceof Error ? err.message : 'Unknown error'}`)
  }

  const raw = await readBody(resp)
  if (!resp.ok) {
    throw new VideoGenerationError(`[${statusLabel(resp)}] ${parseErrorBody(raw)}`, resp.status)
  }

  const taskId = extractTaskId(raw)
  if (!taskId) {
    throw new VideoGenerationError('视频任务创建失败：中转未返回任务 ID')
  }
  return { taskId, raw }
}

/** Query a video generation task once. */
export async function queryVideoGenerationTask(params: {
  taskId: string
  baseUrl: string
  signal: AbortSignal
}): Promise<unknown> {
  const endpoint = resolveApiUrl(`/v1/video/generations/${encodeURIComponent(params.taskId)}`)
  const headers: Record<string, string> = { ...getAuthHeaders() }

  let resp: Response
  try {
    resp = await fetch(endpoint, { method: 'GET', headers, signal: params.signal })
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new VideoGenerationError(`网络请求失败：${err instanceof Error ? err.message : 'Unknown error'}`)
  }

  const raw = await readBody(resp)
  if (!resp.ok) {
    throw new VideoGenerationError(`[${statusLabel(resp)}] ${parseErrorBody(raw)}`, resp.status)
  }
  return raw
}

/**
 * Run the full video generation flow: create task, then poll until
 * completed/failed/timeout. Respects the supplied AbortSignal so the caller
 * can cancel (re-click / node unmount / regenerate).
 */
export async function runVideoGeneration(params: {
  payload: Record<string, unknown>
  signal: AbortSignal
  baseUrlOverride?: string
  pollIntervalMs?: number
  timeoutMs?: number
  onStatus?: (update: VideoStatusUpdate) => void
}): Promise<VideoGenerationResult> {
  const apiKey = getApiKey()
  if (!apiKey) throw new VideoGenerationError('MISSING_API_KEY')

  const baseUrl = (params.baseUrlOverride ?? getApiBaseUrl()).replace(/\/+$/, '')
  if (!isValidBaseUrl(baseUrl)) throw new VideoGenerationError('MISSING_API_BASE_URL')

  // Create the task.
  const { taskId, raw: createRaw } = await createVideoGenerationTask({
    payload: params.payload,
    baseUrl,
    signal: params.signal,
  })

  const interval = params.pollIntervalMs ?? POLL_INTERVAL_MS
  const timeout = params.timeoutMs ?? POLL_TIMEOUT_MS
  const startedAt = Date.now()

  // Report the initial status from the create response.
  const createStatus = normalizeStatus((createRaw as Record<string, unknown>)?.status)
  params.onStatus?.({ phase: createStatus === 'in_progress' ? 'polling' : 'queued', status: createStatus || undefined, raw: createRaw })

  let lastRaw: unknown = createRaw

  // Poll loop.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (params.signal.aborted) throw new DOMException('Aborted', 'AbortError')

    if (Date.now() - startedAt > timeout) {
      throw new VideoGenerationError('视频生成超时（超过 10 分钟），请稍后重试')
    }

    await sleep(interval, params.signal)

    const polled = await queryVideoGenerationTask({ taskId, baseUrl, signal: params.signal })
    lastRaw = polled
    const status = normalizeStatus((polled as Record<string, unknown>)?.status)
    const progressRaw = isRecord(polled) ? (polled as Record<string, unknown>).progress : undefined
    const progress = typeof progressRaw === 'number' ? progressRaw : undefined

    params.onStatus?.({
      phase: status === 'queued' ? 'queued' : 'polling',
      status: status || undefined,
      progress,
      raw: polled,
    })

    if (status === 'completed') {
      const videoUrl = extractVideoUrl(polled, baseUrl)
      if (!videoUrl) {
        throw new VideoGenerationError('任务已完成，但未返回视频 URL')
      }
      const dims = extractDimensions(polled)
      const payloadDims = isRecord(params.payload)
        ? { width: params.payload.width, height: params.payload.height, duration: params.payload.duration }
        : {}
      const width = typeof dims.width === 'number'
        ? dims.width
        : typeof payloadDims.width === 'number' ? payloadDims.width : 1280
      const height = typeof dims.height === 'number'
        ? dims.height
        : typeof payloadDims.height === 'number' ? payloadDims.height : 720
      const duration = dims.duration ?? (typeof payloadDims.duration === 'number' ? payloadDims.duration : undefined)
      return { videoUrl, width, height, duration, taskId, raw: polled }
    }

    if (status === 'failed') {
      const msg = parseErrorBody(isRecord(polled) ? (polled as Record<string, unknown>).error : polled)
        || parseErrorBody(polled)
        || '视频生成失败，请检查模型、提示词、参考图或中转状态'
      throw new VideoGenerationError(msg)
    }
    // queued / in_progress / unknown → keep polling.
  }
}

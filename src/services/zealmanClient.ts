/**
 * Zealman ComfyUI workflow API client.
 *
 * Full call chain:
 *  1. GET  /api/health             → check panel alive
 *  2. GET  /api/gpu/info           → check GPU availability
 *  3. GET  /api/comfy/status       → check ComfyUI state
 *  4. POST /api/comfy/start        → start ComfyUI if needed
 *  5. poll /api/comfy/status       → wait until running === true
 *  6. POST /api/comfy/upload/file  → upload local files
 *  7. POST /api/workflow/generate  → submit task, get prompt_id
 *  8. GET  /api/workflow/result    → poll until pending === false
 *  9. Extract video from results[]
 */

/**
 * 不要在此处填写任何真实的服务器地址，必须留空，引导用户在设置面板中自行填写。
 * Do not hard-code any real server address here. Leave it empty and guide users to configure it in the settings panel.
 */
const DEFAULT_ZEALMAN_BASE_URL = ''

// ── Types ───────────────────────────────────────────────────────────────

export type PanelHealthStatus = { ok: boolean; detail?: string }
export type GpuInfoStatus = {
  hasGpu: boolean
  detail?: string
  name?: string
  vram?: string
  raw?: Record<string, unknown>
}
export type ComfyStatus = { running: boolean; starting?: boolean; detail?: string }
export type WorkflowCheckStatus = { found: boolean; id?: string; name?: string; detail?: string }
export type ServiceStatusSnapshot = {
  panel: PanelHealthStatus | null
  gpu: GpuInfoStatus | null
  comfy: ComfyStatus | null
  workflow: WorkflowCheckStatus | null
  checkedAt: number
}

export interface ExtractedVideoResult {
  type: 'video'
  url: string
  rawUrl: string
  filename: string
  raw: Record<string, unknown>
}

export interface UploadResult {
  name: string
  subfolder: string
  type: string
}

// ── Base URL resolution ─────────────────────────────────────────────────

function resolveEnvBaseUrl(): string {
  try {
    const env = (import.meta as unknown as Record<string, Record<string, string>>)?.env
    if (env) {
      const v =
        env.VITE_ZEALMAN_BASE_URL ||
        env.NEXT_PUBLIC_ZEALMAN_BASE_URL ||
        env.REACT_APP_ZEALMAN_BASE_URL
      if (v) return v
    }
  } catch { /* import.meta unavailable */ }
  return ''
}

export function getZealmanBaseUrl(explicit?: string): string {
  if (explicit && /^https?:\/\//i.test(explicit)) {
    return explicit.replace(/\/+$/, '')
  }
  const envUrl = resolveEnvBaseUrl()
  if (envUrl) return envUrl.replace(/\/+$/, '')
  return DEFAULT_ZEALMAN_BASE_URL.replace(/\/+$/, '')
}

// ── URL normalization ───────────────────────────────────────────────────

export function normalizeOutputUrl(url: string, baseUrl: string): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return baseUrl.replace(/\/$/, '') + url
  return baseUrl.replace(/\/$/, '') + '/' + url
}

// ── Safe JSON ───────────────────────────────────────────────────────────

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`接口返回非 JSON 内容: ${text.slice(0, 200)}`)
  }
}

// Re-export for consumers that need a standalone safe fetch
export { safeFetchJson } from '../utils/safeFetch'

// ── 1. checkPanelHealth ─────────────────────────────────────────────────

export async function checkPanelHealth(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<PanelHealthStatus> {
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal })
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
    const data = await safeJson(res)
    return { ok: data.status === 'ok' || data.success === true || res.ok, detail: data.detail as string | undefined }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : '网络错误' }
  }
}

// ── 2. checkGpuInfo (multi-format) ───────────────────────────────────────

export async function checkGpuInfo(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<GpuInfoStatus> {
  try {
    const res = await fetch(`${baseUrl}/api/gpu/info`, { signal })
    if (!res.ok) return { hasGpu: false, detail: `HTTP ${res.status}` }
    const data = await safeJson(res)
    return normalizeGpuInfo(data)
  } catch (err) {
    return { hasGpu: false, detail: err instanceof Error ? err.message : 'GPU 信息查询失败' }
  }
}

function normalizeGpuInfo(data: Record<string, unknown>): GpuInfoStatus {
  const devices = data.devices as Array<Record<string, unknown>> | undefined
  const gpus = data.gpus as Array<Record<string, unknown>> | undefined
  const gpuObj = data.gpu as Record<string, unknown> | undefined
  // Also check nested data.gpus (some APIs nest under "data")
  const dataField = data.data as Record<string, unknown> | undefined
  const dataGpus = dataField?.gpus as Array<Record<string, unknown>> | undefined
  const gpuList = Array.isArray(devices) ? devices
    : Array.isArray(gpus) ? gpus
    : Array.isArray(dataGpus) ? dataGpus
    : []

  const hasGpuByList = gpuList.length > 0
  const hasGpuByFlag = data.hasGpu === true || data.hasGPU === true || data.available === true
  const hasGpuByName = !!(data.name || data.gpu_name || gpuObj?.name || dataField?.gpu_name)
  const hasGpu = hasGpuByList || hasGpuByFlag || hasGpuByName

  const first = gpuList.length > 0 ? gpuList[0] : (gpuObj || {})
  const gpuName = (first.name as string) || (data.name as string) || (data.gpu_name as string) || (dataField?.gpu_name as string) || undefined
  const vram = (first.vram as string) || (first.memory_total as string) || (data.vram as string) || undefined

  return {
    hasGpu,
    name: gpuName,
    vram,
    detail: hasGpu ? undefined : (data.message as string) || '未检测到 GPU',
    raw: data,
  }
}

// ── 3. getComfyStatus ───────────────────────────────────────────────────

export async function getComfyStatus(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<ComfyStatus> {
  try {
    const res = await fetch(`${baseUrl}/api/comfy/status`, { signal })
    if (!res.ok) return { running: false, detail: `HTTP ${res.status}` }
    const data = await safeJson(res)
    return {
      running: data.running === true,
      starting: data.starting === true,
      detail: data.detail as string | undefined,
    }
  } catch (err) {
    return { running: false, detail: err instanceof Error ? err.message : '查询失败' }
  }
}

// ── 4. startComfy ───────────────────────────────────────────────────────

export async function startComfy(
  baseUrl: string,
  options?: { useProxy?: boolean; proxyType?: string; disableCopilot?: boolean },
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const body = {
    useProxy: options?.useProxy ?? true,
    proxyType: options?.proxyType ?? 'network_turbo',
    disableCopilot: options?.disableCopilot ?? true,
  }
  const res = await fetch(`${baseUrl}/api/comfy/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const data = await safeJson(res)
  if (!res.ok) {
    throw new Error((data.error as string) || `ComfyUI 启动失败：HTTP ${res.status}`)
  }
  return data
}

// ── 5. waitForComfyReady ────────────────────────────────────────────────

export async function waitForComfyReady(
  baseUrl: string,
  options?: { intervalMs?: number; timeoutMs?: number },
  signal?: AbortSignal,
): Promise<ComfyStatus> {
  const intervalMs = options?.intervalMs ?? 3000
  const timeoutMs = options?.timeoutMs ?? 120000
  const start = Date.now()

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const elapsed = Date.now() - start
    if (elapsed >= timeoutMs) {
      throw new Error('ComfyUI 启动超时，请稍后重试')
    }
    const status = await getComfyStatus(baseUrl, signal)
    if (status.running) return status
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
  }
}

// ── 6. uploadComfyFile ──────────────────────────────────────────────────

export async function uploadComfyFile(
  baseUrl: string,
  file: File | Blob,
  signal?: AbortSignal,
): Promise<UploadResult> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('overwrite', 'true')

  const res = await fetch(`${baseUrl}/api/comfy/upload/file`, {
    method: 'POST',
    body: fd,
    signal,
  })

  const text = await res.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`文件上传接口返回非 JSON：${text.slice(0, 300)}`)
  }

  if (!res.ok) {
    throw new Error((data.error as string | undefined) || `文件上传失败：HTTP ${res.status}`)
  }

  if (!data.name) throw new Error('文件上传成功但未返回 name')

  return {
    name: data.name as string,
    subfolder: (data.subfolder as string) || '',
    type: (data.type as string) || '',
  }
}

// ── 7. generateWorkflow ─────────────────────────────────────────────────

export interface GenerateWorkflowPayload {
  workflow_id: string
  input_values: Record<string, unknown>
  client_id?: string
}

export async function generateWorkflow(
  baseUrl: string,
  payload: GenerateWorkflowPayload,
  signal?: AbortSignal,
): Promise<{ success: boolean; prompt_id: string; [k: string]: unknown }> {
  const url = `${baseUrl}/api/workflow/generate`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  const data = await safeJson(res)
  console.log('[MotionTransfer] generate response', data)

  if (!res.ok) {
    throw new Error((data.error as string) || `工作流提交失败：HTTP ${res.status}`)
  }
  if (!data.success) {
    throw new Error((data.error as string) || '工作流提交失败')
  }
  if (!data.prompt_id) {
    throw new Error('工作流已提交但未返回 prompt_id')
  }

  return data as { success: boolean; prompt_id: string; [k: string]: unknown }
}

// ── 8. getWorkflowResult ────────────────────────────────────────────────

export async function getWorkflowResult(
  baseUrl: string,
  promptId: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const url = `${baseUrl}/api/workflow/result?prompt_id=${encodeURIComponent(promptId)}`
  const res = await fetch(url, { signal })
  const data = await safeJson(res)
  if (!res.ok) {
    throw new Error((data.error as string) || `查询结果失败：HTTP ${res.status}`)
  }
  return data
}

// ── 9. waitForWorkflowResult ────────────────────────────────────────────

export interface WaitForOptions {
  intervalMs?: number
  timeoutMs?: number
  onProgress?: (info: {
    promptId: string
    elapsedMs: number
    data: Record<string, unknown>
  }) => void
}

export async function waitForWorkflowResult(
  baseUrl: string,
  promptId: string,
  options: WaitForOptions = {},
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const intervalMs = options.intervalMs ?? 1500
  const timeoutMs = options.timeoutMs ?? 600000
  const start = Date.now()

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const elapsed = Date.now() - start
    if (elapsed >= timeoutMs) {
      throw new Error('动作迁移生成超时，请稍后重试')
    }

    const data = await getWorkflowResult(baseUrl, promptId, signal)
    console.log('[MotionTransfer] polling result', { pending: data.pending, elapsed })

    options.onProgress?.({ promptId, elapsedMs: elapsed, data })

    if (data.success === false) {
      throw new Error(
        (data.error as string) || '远程工作流服务未就绪，请检查 ComfyUI 状态',
      )
    }

    if (data.pending === false) {
      console.log('[MotionTransfer] final result', data)
      return data
    }

    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
  }
}

// ── 10. extractVideoResult ──────────────────────────────────────────────

const VIDEO_EXTS = /\.(mp4|webm|mov|mkv|avi|m3u8)(\?|$)/i

export function extractVideoResult(
  resultData: Record<string, unknown>,
  baseUrl: string,
): ExtractedVideoResult | null {
  const results = resultData.results

  if (!Array.isArray(results) || results.length === 0) {
    return null
  }

  // Priority 1: type === 'video'
  let item: Record<string, unknown> | undefined = results.find(
    (r: Record<string, unknown>) => r.type === 'video',
  ) as Record<string, unknown> | undefined

  // Priority 2: url ending with video extension
  if (!item) {
    item = results.find((r: Record<string, unknown>) => {
      const url = r.url as string
      return typeof url === 'string' && VIDEO_EXTS.test(url)
    }) as Record<string, unknown> | undefined
  }

  // Priority 3: filename ending with video extension
  if (!item) {
    item = results.find((r: Record<string, unknown>) => {
      const filename = r.filename as string
      return typeof filename === 'string' && VIDEO_EXTS.test(filename)
    }) as Record<string, unknown> | undefined
  }

  // Priority 4: any item with a url
  if (!item) {
    item = results.find((r: Record<string, unknown>) =>
      typeof r.url === 'string',
    ) as Record<string, unknown> | undefined
  }

  if (!item || typeof item.url !== 'string' || !item.url) {
    return null
  }

  const fullUrl = normalizeOutputUrl(item.url, baseUrl)
  console.log('[MotionTransfer] extracted video', { rawUrl: item.url, fullUrl })

  return {
    type: 'video',
    url: fullUrl,
    rawUrl: item.url,
    filename: (item.filename as string) || '',
    raw: item,
  }
}

// ── 10b. getWorkflowHistory ─────────────────────────────────────────────

export async function getWorkflowHistory(
  baseUrl: string,
  promptId: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const url = `${baseUrl}/api/comfy/proxy/history?prompt_id=${encodeURIComponent(promptId)}`
  const res = await fetch(url, { signal })
  return safeJson(res)
}

// ── 10c. extractVideoFromHistory ────────────────────────────────────────

export function extractVideoFromHistory(
  historyData: Record<string, unknown>,
  promptId: string,
  baseUrl: string,
): ExtractedVideoResult | null {
  // ComfyUI history format: { [promptId]: { outputs: { [nodeId]: { videos/images/files } } } }
  const promptEntry = (historyData[promptId] || historyData) as Record<string, unknown>
  if (!promptEntry || typeof promptEntry !== 'object') return null

  const outputs = promptEntry.outputs as Record<string, Record<string, unknown>> | undefined
  if (!outputs || typeof outputs !== 'object') return null

  const videoCandidates: Array<Record<string, unknown>> = []

  for (const nodeOutputs of Object.values(outputs)) {
    // videos array
    const videos = nodeOutputs.videos as Array<Record<string, unknown>> | undefined
    if (Array.isArray(videos)) {
      videoCandidates.push(...videos)
    }
    // gifs array (often animated)
    const gifs = nodeOutputs.gifs as Array<Record<string, unknown>> | undefined
    if (Array.isArray(gifs)) {
      videoCandidates.push(...gifs)
    }
    // images that are actually video files
    const images = nodeOutputs.images as Array<Record<string, unknown>> | undefined
    if (Array.isArray(images)) {
      for (const img of images) {
        const fn = (img.filename as string) || ''
        if (VIDEO_EXTS.test(fn)) videoCandidates.push(img)
      }
    }
    // files array
    const files = nodeOutputs.files as Array<Record<string, unknown>> | undefined
    if (Array.isArray(files)) {
      for (const f of files) {
        const fn = (f.filename as string) || ''
        if (VIDEO_EXTS.test(fn)) videoCandidates.push(f)
      }
    }
  }

  // Find best video candidate
  const best = videoCandidates.find((v) => VIDEO_EXTS.test((v.filename as string) || ''))
    || videoCandidates.find((v) => typeof v.url === 'string' && VIDEO_EXTS.test(v.url))
    || videoCandidates[0]

  if (!best) return null

  let url = (best.url as string) || ''
  if (!url) {
    const filename = (best.filename as string) || ''
    const subfolder = (best.subfolder as string) || ''
    const type = (best.type as string) || 'output'
    if (filename) {
      if (type === 'input' || type === 'temp') {
        url = `${baseUrl}/api/comfy/view?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(type)}&subfolder=${encodeURIComponent(subfolder)}`
      } else {
        const path = subfolder ? `${subfolder}/${filename}` : filename
        url = `${baseUrl}/output/${path}`
      }
    }
  } else {
    url = normalizeOutputUrl(url, baseUrl)
  }

  if (!url) return null

  return {
    type: 'video',
    url,
    rawUrl: (best.url as string) || '',
    filename: (best.filename as string) || '',
    raw: best,
  }
}

export function extractHistoryError(
  historyData: Record<string, unknown>,
  promptId: string,
): string | null {
  const promptEntry = (historyData[promptId] || historyData) as Record<string, unknown>
  if (!promptEntry) return null

  const status = promptEntry.status as Record<string, unknown> | undefined
  if (status) {
    const statusStr = status.status_str as string
    if (statusStr && statusStr !== 'success') {
      const exception = (status.exception as string) || (status.message as string) || ''
      return `${statusStr}${exception ? `: ${exception}` : ''}`
    }
  }
  return null
}

// ── 11. resolveInputValue (blocks blob URLs) ────────────────────────────

export async function resolveInputValue(
  baseUrl: string,
  value: unknown,
  kind: 'video' | 'image' = 'image',
  signal?: AbortSignal,
): Promise<string> {
  if (!value) return ''

  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return ''

    // Already an uploaded filename (no slash, no scheme)
    if (!s.includes('/') && !s.includes(':')) return s

    // Remote HTTP URL — can be fetched by ComfyUI
    if (/^https?:\/\//i.test(s)) return s

    // Base64 data URL — ComfyUI can handle these directly
    if (s.startsWith('data:')) return s

    // blob: URL — BLOCK. Must be uploaded as File/Blob upstream
    if (s.startsWith('blob:')) {
      throw new Error(
        kind === 'video'
          ? '视频节点只传出了本地预览地址，未传出原始 File 对象，请修复视频节点输出结构'
          : '图片节点只传出了本地预览地址，未传出原始 File 对象，请修复图片节点输出结构',
      )
    }

    // Fallback: treat as uploaded filename
    return s
  }

  // File / Blob — must upload to get the name
  if (value instanceof Blob) {
    const result = await uploadComfyFile(baseUrl, value, signal)
    return result.name
  }

  return String(value)
}

// ── 12. normalizeMotionTransferError ────────────────────────────────────

export function normalizeMotionTransferError(err: unknown): string {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return '已停止等待结果，远程任务可能仍在运行'
  }
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return '远程面板服务不可用，请检查 Zealman Base URL 是否正确'
  }
  if (err instanceof Error) {
    if (err.message.includes('接口返回非 JSON')) {
      return '远程面板服务不可用，请检查 Zealman Base URL 是否正确'
    }
    return err.message
  }
  return String(err)
}

// ── 13. Workflow list & config ──────────────────────────────────────────

export const MOTION_TRANSFER_WORKFLOW_ID = 'P17-动作迁移4090-48G显卡专用V8'

export async function listWorkflows(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}/api/workflow/list`, { signal })
  return safeJson(res)
}

export async function getWorkflowConfig(
  baseUrl: string,
  workflowId: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}/api/workflow/config/${encodeURIComponent(workflowId)}`, { signal })
  return safeJson(res)
}

export async function ensureMotionTransferWorkflow(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<{ workflowId: string; workflow: Record<string, unknown>; config?: Record<string, unknown> }> {
  const listData = await listWorkflows(baseUrl, signal)
  const workflows = (listData.workflows || listData.data || []) as Array<Record<string, unknown>>

  const target = workflows.find((w) => {
    const wid = (w.id as string) || (w.name as string) || ''
    return wid === MOTION_TRANSFER_WORKFLOW_ID
      || wid === `${MOTION_TRANSFER_WORKFLOW_ID}.json`
      || wid.replace('.json', '') === MOTION_TRANSFER_WORKFLOW_ID
  })

  if (!target) {
    throw new Error('未找到 P17 动作迁移工作流，请先在 Zealman 面板 API 生成页导入并保存该工作流')
  }

  const resolvedId = (target.id as string) || (target.name as string) || MOTION_TRANSFER_WORKFLOW_ID
  let config: Record<string, unknown> | undefined
  try {
    config = await getWorkflowConfig(baseUrl, resolvedId, signal)
  } catch { /* non-critical — config may not exist */ }

  return { workflowId: resolvedId, workflow: target, config }
}

export async function checkWorkflowExists(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<WorkflowCheckStatus> {
  try {
    const result = await ensureMotionTransferWorkflow(baseUrl, signal)
    return { found: true, id: result.workflowId, name: MOTION_TRANSFER_WORKFLOW_ID }
  } catch {
    return { found: false, detail: '未找到 P17 工作流' }
  }
}

// ── 14. checkAllServices (convenience) ──────────────────────────────────

export async function checkAllServices(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<ServiceStatusSnapshot> {
  // Check panel first — if it fails, skip everything else
  const panel = await checkPanelHealth(baseUrl, signal)
  if (!panel.ok) {
    console.log('[MotionTransfer] panel health failed, skipping all checks', { panel })
    return { panel, gpu: null, comfy: null, workflow: null, checkedAt: Date.now() }
  }

  const [gpu, comfy, workflow] = await Promise.all([
    checkGpuInfo(baseUrl, signal),
    getComfyStatus(baseUrl, signal),
    checkWorkflowExists(baseUrl, signal),
  ])
  console.log('[MotionTransfer] service status', { panel, gpu, comfy, workflow })
  return { panel, gpu, comfy, workflow, checkedAt: Date.now() }
}

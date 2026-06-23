/**
 * Motion Transfer executor — P17 workflow with history fallback.
 */

import {
  getZealmanBaseUrl,
  checkPanelHealth,
  getComfyStatus,
  startComfy,
  waitForComfyReady,
  uploadComfyFile,
  generateWorkflow,
  waitForWorkflowResult,
  extractVideoResult,
  extractVideoFromHistory,
  extractHistoryError,
  getWorkflowHistory,
  normalizeMotionTransferError,
  ensureMotionTransferWorkflow,
  checkGpuInfo,
  MOTION_TRANSFER_WORKFLOW_ID,
} from '../services/zealmanClient'
import { useRemoteServiceStore } from '../store/remoteServiceStore'
import type { ServiceStatusSnapshot } from '../services/zealmanClient'

export type MotionTransferPhase =
  | 'idle'
  | 'checking'
  | 'startingComfy'
  | 'uploading'
  | 'submitting'
  | 'polling'
  | 'parsing'
  | 'loadingVideo'
  | 'success'
  | 'error'

export type MotionTransferResult = {
  videoUrl: string
  width: number
  height: number
  filename: string
  promptId: string
  rawResult: Record<string, unknown>
}

export interface MotionTransferParams {
  sourceVideo: unknown
  targetImage: unknown
  mode?: number
  resolution?: number
  param265?: number
  param266?: number
  param271?: boolean
  param297?: number
  param300?: number
  param361?: number
  param370?: boolean
  signal?: AbortSignal
  baseUrlOverride?: string
  onPhaseChange?: (phase: MotionTransferPhase, detail?: string) => void
  onServiceStatus?: (status: ServiceStatusSnapshot) => void
  onDebugInfo?: (info: MotionTransferDebugInfo) => void
  onUploadCache?: (
    kind: 'video' | 'image',
    cache: WorkflowFileCache,
    sourceInput: unknown,
  ) => void
}

export type WorkflowFileCache = {
  uploaded: true
  remoteName: string
  uploadedName: string
  uploadedType: string
  uploadedSubfolder: string
  uploadedBaseUrl: string
  uploadedAt: number
}

export interface MotionTransferDebugInfo {
  baseUrl?: string
  serviceStatus?: ServiceStatusSnapshot
  gpuRaw?: unknown
  gpuNormalized?: unknown
  workflowLookup?: unknown
  workflowConfig?: unknown
  rawVideoInput?: unknown
  rawVideoInputType?: string
  rawVideoInputKeys?: string[]
  rawVideoHasFile?: boolean
  rawVideoUrl?: string
  rawVideoMessage?: string
  rawImageInput?: unknown
  rawImageInputType?: string
  rawImageInputKeys?: string[]
  rawImageHasFile?: boolean
  rawImageUrl?: string
  rawImageMessage?: string
  videoUploadResponse?: unknown
  imageUploadResponse?: unknown
  resolvedVideo?: string
  resolvedImage?: string
  inputValues?: Record<string, unknown>
  generatePayload?: unknown
  generateResponse?: unknown
  resultResponse?: unknown
  historyResponse?: unknown
  extractedVideo?: unknown
  finalVideoUrl?: string
  warnings?: string[]
  error?: string
}

type WorkflowFileKind = 'video' | 'image'

type WorkflowFileResolveResult = {
  value: string
  uploadResponse?: unknown
  cache?: WorkflowFileCache
}

function isBlobUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('blob:')
}

function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:')
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function isFileLike(value: unknown): value is File | Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function getObjectUrl(input: Record<string, unknown>): unknown {
  return input.url || input.previewUrl || input.src || input.value || input.imageUrl || input.videoUrl
}

function describeWorkflowInput(input: unknown, kind: WorkflowFileKind) {
  const inputType = isFileLike(input)
    ? ((typeof File !== 'undefined' && input instanceof File) ? 'File' : 'Blob')
    : Array.isArray(input) ? 'Array'
    : input === null ? 'null'
    : typeof input === 'object' ? 'Object'
    : typeof input

  const keys = isObjectRecord(input) && !isFileLike(input) ? Object.keys(input) : []
  const fileCandidate = isObjectRecord(input) && !isFileLike(input)
    ? input.file || input.blob
    : input
  const hasFile = isFileLike(fileCandidate)
  const urlCandidate = typeof input === 'string'
    ? input
    : isObjectRecord(input) && !isFileLike(input)
      ? getObjectUrl(input)
      : undefined
  const url = typeof urlCandidate === 'string' ? urlCandidate : undefined
  const message = (() => {
    if (typeof input === 'string' && isBlobUrl(input)) {
      return kind === 'video'
        ? '上游视频节点只传出了 blob 字符串，必须修复视频节点 output。'
        : '上游图片节点只传出了 blob 字符串，必须修复图片节点 output。'
    }
    if (isObjectRecord(input) && !isFileLike(input) && isBlobUrl(url)) {
      if (hasFile) return kind === 'video' ? '视频 File 已获取，可上传。' : '图片 File 已获取，可上传。'
      return kind === 'video' ? '视频节点 output 缺少 file 字段。' : '图片节点 output 缺少 file 字段。'
    }
    if (hasFile) return kind === 'video' ? '视频 File 已获取，可上传。' : '图片 File 已获取，可上传。'
    if (url) return '输入包含 URL。'
    return '输入未包含可用文件或 URL。'
  })()

  return {
    inputType,
    keys,
    hasFile,
    url,
    message,
    preview: sanitizeDebugInput(input),
  }
}

function sanitizeDebugInput(input: unknown): unknown {
  if (isFileLike(input)) {
    return describeFileLike(input)
  }
  if (!isObjectRecord(input)) {
    return typeof input === 'string' ? input.slice(0, 300) : input
  }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (isFileLike(value)) {
      out[key] = describeFileLike(value)
    } else if (typeof value === 'string') {
      out[key] = value.slice(0, 300)
    } else if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
      out[key] = value
    } else {
      out[key] = `[${Array.isArray(value) ? 'Array' : 'Object'}]`
    }
  }
  return out
}

function describeFileLike(value: File | Blob): Record<string, unknown> {
  return {
    kind: typeof File !== 'undefined' && value instanceof File ? 'File' : 'Blob',
    name: typeof File !== 'undefined' && value instanceof File ? value.name : undefined,
    type: value.type,
    size: value.size,
  }
}

async function resolveWorkflowFileInput(
  baseUrl: string,
  input: unknown,
  kind: WorkflowFileKind,
  signal?: AbortSignal,
): Promise<WorkflowFileResolveResult> {
  if (!input) {
    throw new Error(kind === 'video' ? '请先连接视频输入' : '请先连接图片输入')
  }

  if (isFileLike(input)) {
    try {
      const uploaded = await uploadComfyFile(baseUrl, input, signal)
      return {
        value: uploaded.name,
        uploadResponse: uploaded,
        cache: {
          uploaded: true,
          remoteName: uploaded.name,
          uploadedName: uploaded.name,
          uploadedType: uploaded.type,
          uploadedSubfolder: uploaded.subfolder,
          uploadedBaseUrl: baseUrl,
          uploadedAt: Date.now(),
        },
      }
    } catch (err) {
      throw new Error(kind === 'video' ? `视频上传失败，请检查远程服务：${messageFromError(err)}` : `图片上传失败，请检查远程服务：${messageFromError(err)}`)
    }
  }

  if (typeof input === 'string') {
    const value = input.trim()
    if (!value) throw new Error(kind === 'video' ? '请先连接视频输入' : '请先连接图片输入')
    if (isHttpUrl(value) || isDataUrl(value)) return { value }
    if (isBlobUrl(value)) {
      throw new Error(
        kind === 'video'
          ? '视频节点只传出了本地预览地址，未传出原始 File 对象，请修复视频节点输出结构'
          : '图片节点只传出了本地预览地址，未传出原始 File 对象，请修复图片节点输出结构',
      )
    }
    return { value }
  }

  if (!isObjectRecord(input)) {
    throw new Error(kind === 'video' ? '视频输入无效' : '图片输入无效')
  }

  const cachedName = typeof input.remoteName === 'string' && input.remoteName
    ? input.remoteName
    : typeof input.uploadedName === 'string' && input.uploadedName
      ? input.uploadedName
      : ''
  if (input.uploaded === true && input.uploadedBaseUrl === baseUrl && cachedName) {
    return { value: cachedName }
  }

  const fileCandidate = input.file || input.blob
  if (isFileLike(fileCandidate)) {
    try {
      const uploaded = await uploadComfyFile(baseUrl, fileCandidate, signal)
      return {
        value: uploaded.name,
        uploadResponse: uploaded,
        cache: {
          uploaded: true,
          remoteName: uploaded.name,
          uploadedName: uploaded.name,
          uploadedType: uploaded.type,
          uploadedSubfolder: uploaded.subfolder,
          uploadedBaseUrl: baseUrl,
          uploadedAt: Date.now(),
        },
      }
    } catch (err) {
      throw new Error(kind === 'video' ? `视频上传失败，请检查远程服务：${messageFromError(err)}` : `图片上传失败，请检查远程服务：${messageFromError(err)}`)
    }
  }

  const url = getObjectUrl(input)
  if (isHttpUrl(url) || isDataUrl(url)) return { value: url }
  if (isDataUrl(input.base64)) return { value: input.base64 }

  if (isBlobUrl(url)) {
    throw new Error(
      kind === 'video'
        ? '视频节点只传出了本地预览地址，未传出原始 File 对象，请修复视频节点输出结构'
        : '图片节点只传出了本地预览地址，未传出原始 File 对象，请修复图片节点输出结构',
    )
  }

  if (input.uploaded === true && typeof input.name === 'string' && input.name) {
    return { value: input.name }
  }

  throw new Error(kind === 'video' ? '视频输入无效' : '图片输入无效')
}

function messageFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function assertNoBlobInInputValues(inputValues: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(inputValues)) {
    if (typeof value === 'string' && isBlobUrl(value)) {
      throw new Error(`input_values 中禁止出现 blob URL：${key}`)
    }
  }
}

export async function runMotionTransfer(
  params: MotionTransferParams,
): Promise<MotionTransferResult> {
  const {
    sourceVideo,
    targetImage,
    mode = 1,
    resolution = 720,
    param265 = 1.0000000000000002,
    param266 = 0.20000000000000004,
    param271 = false,
    param297 = 1.0000000000000002,
    param300 = 840,
    param361 = 1.0000000000000002,
    param370 = false,
    signal,
    baseUrlOverride,
    onPhaseChange,
    onServiceStatus,
    onDebugInfo,
    onUploadCache,
  } = params

  const debug: MotionTransferDebugInfo = {}
  const warnings: string[] = []
  const updateDebug = (patch: Partial<MotionTransferDebugInfo>) => {
    Object.assign(debug, patch)
    onDebugInfo?.(debug)
  }

  const storeUrl = useRemoteServiceStore.getState().zealmanBaseUrl
  const baseUrl = getZealmanBaseUrl(baseUrlOverride || storeUrl || undefined)
  updateDebug({ baseUrl, warnings })

  const setPhase = (phase: MotionTransferPhase, detail?: string) => {
    console.log(`[MotionTransfer] phase: ${phase}${detail ? ` — ${detail}` : ''}`)
    onPhaseChange?.(phase, detail)
  }

  // ── 1. Validate inputs ────────────────────────────────────────────────
  if (!sourceVideo) throw new Error('请先连接视频输入')
  if (!targetImage) throw new Error('请先连接图片输入')

  const videoDebug = describeWorkflowInput(sourceVideo, 'video')
  const imageDebug = describeWorkflowInput(targetImage, 'image')
  updateDebug({
    rawVideoInput: videoDebug.preview,
    rawVideoInputType: videoDebug.inputType,
    rawVideoInputKeys: videoDebug.keys,
    rawVideoHasFile: videoDebug.hasFile,
    rawVideoUrl: videoDebug.url,
    rawVideoMessage: videoDebug.message,
    rawImageInput: imageDebug.preview,
    rawImageInputType: imageDebug.inputType,
    rawImageInputKeys: imageDebug.keys,
    rawImageHasFile: imageDebug.hasFile,
    rawImageUrl: imageDebug.url,
    rawImageMessage: imageDebug.message,
  })

  // ── 2. Check panel health ─────────────────────────────────────────────
  setPhase('checking', '检查远程服务中')
  const panelHealth = await checkPanelHealth(baseUrl, signal)
  if (!panelHealth.ok) {
    throw new Error('远程面板服务不可用，请到 API 设置中检查 Zealman Base URL')
  }

  // ── 3. Check GPU (informational only) ──────────────────────────────────
  try {
    const gpu = await checkGpuInfo(baseUrl, signal)
    updateDebug({ gpuRaw: gpu.raw || gpu, gpuNormalized: { hasGpu: gpu.hasGpu, name: gpu.name } })
    if (!gpu.hasGpu) {
      warnings.push('GPU 检测异常，但 ComfyUI 已就绪，继续提交任务')
      updateDebug({ warnings: [...warnings] })
    }
  } catch {
    warnings.push('GPU 信息读取失败，但 ComfyUI 已就绪，继续提交任务')
    updateDebug({ warnings: [...warnings] })
  }

  // ── 4. Check / start ComfyUI ──────────────────────────────────────────
  const comfy = await getComfyStatus(baseUrl, signal)
  const autoStart = useRemoteServiceStore.getState().autoStartComfy

  if (!comfy.running) {
    if (comfy.starting) {
      setPhase('startingComfy', 'ComfyUI 启动中，等待就绪')
      await waitForComfyReady(baseUrl, { intervalMs: 3000, timeoutMs: 120000 }, signal)
    } else if (autoStart) {
      setPhase('startingComfy', '启动 ComfyUI 中')
      await startComfy(baseUrl, undefined, signal)
      await waitForComfyReady(baseUrl, { intervalMs: 3000, timeoutMs: 120000 }, signal)
    } else {
      throw new Error('ComfyUI 未就绪，请先启动 ComfyUI')
    }
  }

  // ── 5. Ensure workflow exists ─────────────────────────────────────────
  const wfResult = await ensureMotionTransferWorkflow(baseUrl, signal)
  updateDebug({ workflowLookup: wfResult.workflow, workflowConfig: wfResult.config })

  // ── 6. Upload files (blob URLs blocked) ───────────────────────────────
  setPhase('uploading', '上传素材中')
  const [videoResolved, imageResolved] = await Promise.all([
    resolveWorkflowFileInput(baseUrl, sourceVideo, 'video', signal),
    resolveWorkflowFileInput(baseUrl, targetImage, 'image', signal),
  ])
  const videoValue = videoResolved.value
  const imageValue = imageResolved.value

  if (videoResolved.cache) onUploadCache?.('video', videoResolved.cache, sourceVideo)
  if (imageResolved.cache) onUploadCache?.('image', imageResolved.cache, targetImage)

  updateDebug({
    resolvedVideo: videoValue,
    resolvedImage: imageValue,
    videoUploadResponse: videoResolved.uploadResponse,
    imageUploadResponse: imageResolved.uploadResponse,
  })

  if (!videoValue) throw new Error('视频节点已连接，但没有可用视频')
  if (!imageValue) throw new Error('图片节点已连接，但没有可用图片')

  // ── 7. Build full P17 input_values ────────────────────────────────────
  const inputValues: Record<string, unknown> = {
    '265:value': Number(param265),
    '266:value': Number(param266),
    '271:value': Boolean(param271),
    '275:video': videoValue,
    '293:select': Number(mode),
    '294:value': Number(resolution),
    '297:value': Number(param297),
    '299:image': imageValue,
    '300:value': Number(param300),
    '361:value': Number(param361),
    '370:value': Boolean(param370),
  }
  assertNoBlobInInputValues(inputValues)

  const payload = {
    workflow_id: wfResult.workflowId,
    input_values: inputValues,
    client_id: `canvasforge-motion-transfer-${Date.now()}`,
  }

  console.log('[MotionTransfer] submit payload', {
    workflow_id: payload.workflow_id,
    input_values: { ...inputValues, '275:video': '[video]', '299:image': '[image]' },
  })
  updateDebug({ inputValues, generatePayload: { workflow_id: payload.workflow_id, client_id: payload.client_id } })

  // ── 8. Submit task ────────────────────────────────────────────────────
  setPhase('submitting', '提交任务中')
  const submitData = await generateWorkflow(baseUrl, payload, signal)
  const promptId = submitData.prompt_id
  updateDebug({ generateResponse: submitData })

  // ── 9. Poll for result ────────────────────────────────────────────────
  setPhase('polling', '生成中')
  const resultData = await waitForWorkflowResult(
    baseUrl,
    promptId,
    {
      intervalMs: 1500,
      timeoutMs: 600000,
      onProgress: ({ elapsedMs }) => {
        const sec = Math.floor(elapsedMs / 1000)
        setPhase('polling', `生成中 ${sec}s`)
      },
    },
    signal,
  )
  updateDebug({ resultResponse: resultData })

  // ── 10. Extract video (result → history fallback) ─────────────────────
  setPhase('parsing', '解析结果中')

  // Try extracting from result first
  let videoResult = extractVideoResult(resultData, baseUrl)
  let videoSource = 'result'

  // Fallback: try history
  if (!videoResult) {
    console.log('[MotionTransfer] no video in results, trying history...')
    try {
      const historyData = await getWorkflowHistory(baseUrl, promptId, signal)
      updateDebug({ historyResponse: historyData })

      // Check for execution errors
      const historyError = extractHistoryError(historyData, promptId)
      if (historyError) {
        throw new Error(`工作流执行失败：${historyError}`)
      }

      videoResult = extractVideoFromHistory(historyData, promptId, baseUrl)
      videoSource = 'history'
    } catch (historyErr: unknown) {
      if (historyErr instanceof Error && historyErr.message.startsWith('工作流执行失败')) throw historyErr
      console.warn('[MotionTransfer] history query failed:', historyErr)
      console.warn('[MotionTransfer] history query failed:', historyErr)
    }
  }

  if (!videoResult) {
    throw new Error('任务已完成，但未找到视频输出，请检查 P17 工作流的输出节点是否保存视频')
  }

  updateDebug({ extractedVideo: { ...videoResult, source: videoSource }, finalVideoUrl: videoResult.url })
  console.log('[MotionTransfer] final video url', videoResult.url, 'source:', videoSource)

  // ── 11. Return ────────────────────────────────────────────────────────
  setPhase('loadingVideo', '视频加载中')
  const resH = Math.round(resolution * 9 / 16)
  return {
    videoUrl: videoResult.url,
    width: resolution,
    height: resH,
    filename: videoResult.filename,
    promptId,
    rawResult: resultData,
  }
}

export { normalizeMotionTransferError, MOTION_TRANSFER_WORKFLOW_ID }

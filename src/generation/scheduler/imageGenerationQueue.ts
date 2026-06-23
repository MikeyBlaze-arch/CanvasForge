import { generateImage, type GenerateImageItem, type GenerateResult } from '../imageGenerationApi'

export type SingleGenerationTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type BatchGenerationTaskStatus = 'queued' | 'running' | 'partial' | 'completed' | 'failed' | 'cancelled'

export type SingleGenerationTask = {
  id: string
  index: number
  status: SingleGenerationTaskStatus
  requestPayload: Record<string, unknown>
  result?: GenerateImageItem
  error?: string
  startedAt?: number
  finishedAt?: number
}

export type BatchGenerationTask = {
  batchId: string
  requestedCount: number
  completedCount: number
  failedCount: number
  status: BatchGenerationTaskStatus
  concurrency: 1
  createdAt: number
  startedAt?: number
  finishedAt?: number
  items: SingleGenerationTask[]
}

export type RunBatchGenerationOptions = {
  batchId?: string
  basePayload: Record<string, unknown>
  requestedCount: number
  onTaskStart?: (task: SingleGenerationTask, batch: BatchGenerationTask) => void
  onTaskSuccess?: (task: SingleGenerationTask, batch: BatchGenerationTask) => void
  onTaskFailure?: (task: SingleGenerationTask, batch: BatchGenerationTask) => void
  shouldCancel?: () => boolean
}

function clonePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    ...payload,
    images: Array.isArray(payload.images) ? [...payload.images] : payload.images,
    referenceImages: Array.isArray(payload.referenceImages) ? [...payload.referenceImages] : payload.referenceImages,
    referenceImageLabels: Array.isArray(payload.referenceImageLabels) ? [...payload.referenceImageLabels] : payload.referenceImageLabels,
    _meta: payload._meta && typeof payload._meta === 'object' ? { ...(payload._meta as Record<string, unknown>) } : payload._meta,
  }
}

export function buildSingleImagePayload(basePayload: Record<string, unknown>, index: number): Record<string, unknown> {
  const payload = clonePayload(basePayload)
  if ('n' in payload) payload.n = 1
  if (typeof payload.seed === 'number') payload.seed = payload.seed + index
  if (payload._meta && typeof payload._meta === 'object') {
    payload._meta = {
      ...(payload._meta as Record<string, unknown>),
      batchTaskIndex: index,
      singleTaskN: 'n' in payload ? 1 : undefined,
    }
  }
  return payload
}

export async function runSerialImageGenerationBatch(options: RunBatchGenerationOptions): Promise<BatchGenerationTask> {
  const requestedCount = Math.max(1, Math.floor(options.requestedCount))
  const batch: BatchGenerationTask = {
    batchId: options.batchId ?? `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    requestedCount,
    completedCount: 0,
    failedCount: 0,
    status: 'queued',
    concurrency: 1,
    createdAt: Date.now(),
    items: Array.from({ length: requestedCount }, (_, index) => ({
      id: `task_${index + 1}_${Math.random().toString(36).slice(2, 8)}`,
      index,
      status: 'queued',
      requestPayload: buildSingleImagePayload(options.basePayload, index),
    })),
  }

  batch.status = 'running'
  batch.startedAt = Date.now()

  for (const task of batch.items) {
    if (options.shouldCancel?.()) {
      task.status = 'cancelled'
      batch.status = batch.completedCount > 0 ? 'partial' : 'cancelled'
      break
    }

    task.status = 'running'
    task.startedAt = Date.now()
    options.onTaskStart?.(task, batch)

    try {
      const result: GenerateResult = await generateImage(task.requestPayload)
      const firstImage = result.images[0]
      if (!firstImage) throw new Error('No image in response.')

      task.result = {
        ...firstImage,
        sizeWarning: firstImage.sizeWarning ?? result.sizeWarning,
      }
      task.status = 'completed'
      task.finishedAt = Date.now()
      batch.completedCount += 1
      options.onTaskSuccess?.(task, batch)
    } catch (err: unknown) {
      task.status = 'failed'
      task.finishedAt = Date.now()
      task.error = err instanceof Error ? err.message : String(err)
      batch.failedCount += 1
      options.onTaskFailure?.(task, batch)
    }
  }

  batch.finishedAt = Date.now()
  if (batch.status !== 'cancelled') {
    batch.status = batch.failedCount === 0
      ? 'completed'
      : batch.completedCount > 0
        ? 'partial'
        : 'failed'
  }

  return batch
}

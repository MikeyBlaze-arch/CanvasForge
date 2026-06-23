import type { HistoryRecord } from '../canvas/nodeTypes'
import { getImageModelById, normalizeImageGenSelection } from '../generation/imageModelRegistry'

export const HISTORY_SCHEMA_VERSION = 3
export const MAX_HISTORY_ITEMS = 500
export const HISTORY_LOCAL_STORAGE_KEY = 'canvasforge_history'
export const HISTORY_STORAGE_META_KEY = 'canvasforge_history_meta'

function looksLikeDataUrl(value: unknown) {
  return typeof value === 'string' && value.startsWith('data:image/')
}

export function stripLargeImageDataForExport(record: HistoryRecord): HistoryRecord {
  const copy = { ...record }
  if (looksLikeDataUrl(copy.url)) copy.url = undefined
  if (looksLikeDataUrl(copy.imageUrl)) copy.imageUrl = undefined
  if (looksLikeDataUrl(copy.originalUrl)) copy.originalUrl = undefined
  if (Array.isArray(copy.imageUrls)) {
    copy.imageUrls = copy.imageUrls.map((url) => looksLikeDataUrl(url) ? '' : url).filter(Boolean)
  }
  if (Array.isArray(copy.outputs)) {
    copy.outputs = copy.outputs
      .map((output) => looksLikeDataUrl(output.url) || looksLikeDataUrl(output.imageUrl)
        ? { ...output, url: '', imageUrl: '', thumbnailUrl: '' }
        : output)
      .filter((output) => output.url || output.imageUrl || output.status === 'failed' || output.error)
  }
  return copy
}

export function normalizeHistoryRecord(record: HistoryRecord): HistoryRecord {
  try {
    const now = Date.now()
    const type = record.type || (record.videoUrl ? 'video' : 'image')
    const createdAt = Number.isFinite(record.createdAt) && record.createdAt > 0 ? record.createdAt : now
    const timeUnknown = record.timeUnknown ?? !(Number.isFinite(record.createdAt) && record.createdAt > 0)

    if (type !== 'image') {
      return {
        ...record,
        schemaVersion: HISTORY_SCHEMA_VERSION,
        type: 'video',
        status: record.status ?? (record.error || record.errorMessage ? 'failed' : 'success'),
        createdAt,
        timeUnknown,
      }
    }

    const selection = normalizeImageGenSelection(record as unknown as Record<string, unknown>)
    const model = getImageModelById(selection.modelId)
    const imageUrl = record.imageUrl || record.url || record.thumbnailUrl || ''
    const width = record.width ?? record.naturalWidth ?? 0
    const height = record.height ?? record.naturalHeight ?? 0
    const imageUrls = Array.isArray(record.imageUrls) && record.imageUrls.length > 0
      ? record.imageUrls.filter(Boolean)
      : imageUrl
        ? [imageUrl]
        : []
    const outputs = Array.isArray(record.outputs) && record.outputs.length > 0
      ? record.outputs
      : imageUrls.map((url, index) => ({
          type: 'image' as const,
          index,
          status: 'completed' as const,
          url,
          imageUrl: url,
          thumbnailUrl: url,
          naturalWidth: width,
          naturalHeight: height,
          width,
          height,
        }))
    const finalSize = record.finalSize || (width > 0 && height > 0 ? `${width}x${height}` : undefined)
    const prompt = record.prompt ?? record.promptSnapshot ?? ''
    const negativePrompt = record.negativePrompt ?? record.negativePromptSnapshot

    return {
      ...record,
      schemaVersion: HISTORY_SCHEMA_VERSION,
      type: 'image',
      status: record.status ?? (imageUrl ? 'success' : record.error || record.errorMessage ? 'failed' : 'success'),
      imageUrl,
      url: record.url || imageUrl,
      originalUrl: record.originalUrl || record.url || record.imageUrl,
      thumbnailUrl: record.thumbnailUrl || imageUrl,
      modelSeries: selection.modelSeries,
      modelId: selection.modelId,
      modelLabel: model?.label ?? record.modelLabel,
      backendModel: model?.backendModel ?? record.backendModel,
      engineType: model?.engineType ?? record.engineType,
      sizeMode: model?.sizeMode ?? record.sizeMode,
      prompt,
      promptSnapshot: prompt,
      negativePrompt,
      negativePromptSnapshot: negativePrompt,
      aspectRatio: selection.aspectRatio,
      resolution: selection.resolution,
      naturalWidth: width,
      naturalHeight: height,
      width,
      height,
      imageUrls,
      outputs,
      batchSize: record.batchSize ?? (imageUrls.length || 1),
      returnedBatchSize: record.returnedBatchSize ?? (imageUrls.length || 1),
      batchId: record.batchId,
      batchIndex: record.batchIndex,
      batchTotal: record.batchTotal,
      requestedCount: record.requestedCount ?? record.batchSize ?? (imageUrls.length || 1),
      completedCount: record.completedCount ?? imageUrls.length,
      failedCount: record.failedCount ?? 0,
      batchStatus: record.batchStatus,
      finalSize,
      createdAt,
      timeUnknown,
    }
  } catch {
    return {
      ...record,
      schemaVersion: HISTORY_SCHEMA_VERSION,
      type: record.type || 'image',
      status: record.status ?? (record.error || record.errorMessage ? 'failed' : 'success'),
      createdAt: record.createdAt || Date.now(),
      timeUnknown: record.timeUnknown ?? !record.createdAt,
    }
  }
}

function successfulLegacyImageOutputs(record: HistoryRecord) {
  const imageUrls = Array.isArray(record.imageUrls)
    ? record.imageUrls.filter(Boolean)
    : []

  if (imageUrls.length > 1) {
    return imageUrls.map((url, index) => {
      const output = record.outputs?.find((item) => item.index === index && item.status !== 'failed' && item.status !== 'cancelled')
      return { url, output }
    })
  }

  const outputs = Array.isArray(record.outputs)
    ? record.outputs.filter((item) => item.status !== 'failed' && item.status !== 'cancelled' && (item.url || item.imageUrl || item.thumbnailUrl))
    : []

  if (outputs.length > 1) {
    return outputs.map((output) => ({
      url: output.url || output.imageUrl || output.thumbnailUrl || '',
      output,
    })).filter((item) => Boolean(item.url))
  }

  return []
}

function expandLegacyAggregateHistoryRecord(record: HistoryRecord): HistoryRecord[] {
  if (record.type && record.type !== 'image') return [record]
  if (record.batchIndex != null && record.batchTotal != null) return [record]

  const images = successfulLegacyImageOutputs(record)
  if (images.length <= 1) return [record]

  const batchId = record.batchId ?? record.id
  const baseCreatedAt = Number.isFinite(record.createdAt) && record.createdAt > 0 ? record.createdAt : Date.now()

  return images.map(({ url, output }, index) => ({
    ...record,
    id: `${record.id}_image_${index + 1}`,
    imageUrl: url,
    url,
    thumbnailUrl: output?.thumbnailUrl || url,
    originalUrl: output?.url || output?.imageUrl || record.originalUrl,
    naturalWidth: output?.naturalWidth ?? output?.width ?? record.naturalWidth,
    naturalHeight: output?.naturalHeight ?? output?.height ?? record.naturalHeight,
    width: output?.width ?? output?.naturalWidth ?? record.width,
    height: output?.height ?? output?.naturalHeight ?? record.height,
    imageUrls: undefined,
    outputs: undefined,
    returnedBatchSize: 1,
    batchId,
    batchIndex: index + 1,
    batchTotal: images.length,
    createdAt: baseCreatedAt + index,
  }))
}

export function migrateHistoryItems(items: HistoryRecord[]): HistoryRecord[] {
  return items
    .flatMap((item) => expandLegacyAggregateHistoryRecord(item))
    .map((item) => {
      try {
        return normalizeHistoryRecord(item)
      } catch {
        return null
      }
    })
    .filter((item): item is HistoryRecord => Boolean(item))
    .filter((item) => item.status !== 'failed' || item.failedCount != null || item.batchStatus != null)
}

export function sortByNewest(records: HistoryRecord[]) {
  return [...records].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

/**
 * Remove records that share the same `id`, keeping the first occurrence.
 * History is normally sorted newest-first, so the first occurrence is the
 * freshest state. Records without an `id` are preserved as-is.
 */
export function dedupeHistoryRecords<T extends { id?: string }>(records: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const record of records) {
    if (!record?.id) {
      result.push(record)
      continue
    }
    if (seen.has(record.id)) continue
    seen.add(record.id)
    result.push(record)
  }
  return result
}

export function enforceHistoryLimit(records: HistoryRecord[], maxItems = MAX_HISTORY_ITEMS) {
  if (maxItems <= 0) return sortByNewest(records)
  return sortByNewest(records).slice(0, maxItems)
}

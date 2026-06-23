import type { HistoryRecord } from '../canvas/nodeTypes'
import { downloadImage } from '../utils/downloadImage'

function safeFilePart(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 48) || 'CanvasForge'
}

function formatDatePart(createdAt?: number) {
  const date = new Date(createdAt || Date.now())
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '_',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
  ].join('')
}

export function historyImageUrl(record: HistoryRecord) {
  return record.url || record.imageUrl || record.originalUrl || record.thumbnailUrl || ''
}

export function buildHistoryImageFilename(record: HistoryRecord, index?: number) {
  const model = safeFilePart(record.modelLabel || record.backendModel || record.modelId || 'CanvasForge')
  const size = safeFilePart(record.finalSize || `${record.width || record.naturalWidth || 0}x${record.height || record.naturalHeight || 0}`)
  const seq = index == null ? '' : `_${String(index + 1).padStart(3, '0')}`
  return `${formatDatePart(record.createdAt)}_${model}_${size}${seq}.png`
}

export async function downloadHistoryImage(record: HistoryRecord, index?: number) {
  await downloadImage({
    imageUrl: record.imageUrl,
    url: historyImageUrl(record),
    downloadUrl: record.url || record.originalUrl || record.imageUrl,
    fileName: buildHistoryImageFilename(record, index),
    createdAt: record.createdAt,
  })
}

export function downloadHistoryImagesIndividually(records: HistoryRecord[]) {
  const downloadable = records.filter((record) => record.type === 'image' && record.status !== 'failed' && historyImageUrl(record))
  downloadable.forEach((record, index) => {
    window.setTimeout(() => {
      downloadHistoryImage(record, index).catch(() => {
        const url = historyImageUrl(record)
        if (url) window.open(url, '_blank')
      })
    }, index * 250)
  })
  return downloadable.length
}

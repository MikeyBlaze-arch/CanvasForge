import { create } from 'zustand'
import type { HistoryRecord } from '../canvas/nodeTypes'
import {
  addHistoryRecord,
  clearHistoryRecords,
  exportHistoryRecords,
  loadHistoryRecords,
  parseImportedHistoryJson,
  removeHistoryRecords,
  replaceHistoryRecords,
} from '../history/historyStorage'
import { generateHistoryThumbnail, isImageDataUrl } from '../history/historyThumbnail'
import {
  dedupeHistoryRecords,
  enforceHistoryLimit,
  HISTORY_SCHEMA_VERSION,
  normalizeHistoryRecord,
  sortByNewest,
  stripLargeImageDataForExport,
} from '../history/historyMigration'

export { HISTORY_SCHEMA_VERSION }

type HistoryModelSeriesFilter = 'all' | 'G' | 'R' | 'C'
type HistoryResolutionFilter = 'all' | '1K' | '2K' | '4K'
type HistoryTimeRangeFilter = 'all' | 'today' | '7d' | '30d'

function successAssetsOnly(records: HistoryRecord[]) {
  return records.filter((record) => record.status !== 'failed')
}

function isInTimeRange(record: HistoryRecord, timeRange: HistoryTimeRangeFilter) {
  if (timeRange === 'all') return true
  if (!record.createdAt || record.timeUnknown) return false

  const now = new Date()
  const created = new Date(record.createdAt)
  if (Number.isNaN(created.getTime())) return false

  if (timeRange === 'today') {
    return created.toDateString() === now.toDateString()
  }

  const days = timeRange === '7d' ? 7 : 30
  return now.getTime() - created.getTime() <= days * 24 * 60 * 60 * 1000
}

function searchableText(record: HistoryRecord) {
  return [
    record.modelLabel,
    record.backendModel,
    record.modelId,
    record.modelSeries,
    record.prompt,
    record.promptSnapshot,
    record.negativePrompt,
    record.negativePromptSnapshot,
    record.aspectRatio,
    record.resolution,
    record.finalSize,
    record.width,
    record.height,
    record.naturalWidth,
    record.naturalHeight,
    record.type,
    record.type === 'image' ? '图片 image' : '视频 video',
  ].filter((value) => value != null).join(' ').toLowerCase()
}

async function withThumbnail(record: HistoryRecord): Promise<HistoryRecord> {
  if (record.type !== 'image' || record.status === 'failed') return record
  if (record.thumbnailUrl && record.thumbnailUrl !== record.url && record.thumbnailUrl !== record.imageUrl) return record

  const source = record.url || record.imageUrl || record.originalUrl
  if (!source) return record

  // Remote URLs can be CORS-blocked in canvas; keep them as URLs and rely on lazy loading.
  if (!isImageDataUrl(source)) {
    return {
      ...record,
      thumbnailUrl: record.thumbnailUrl || source,
      originalUrl: record.originalUrl || record.url || record.imageUrl,
    }
  }

  const thumbnailUrl = await generateHistoryThumbnail(source)
  return {
    ...record,
    thumbnailUrl: thumbnailUrl || record.thumbnailUrl || source,
    originalUrl: record.originalUrl || record.url || record.imageUrl,
  }
}

interface HistoryState {
  records: HistoryRecord[]
  searchKeyword: string
  typeFilter: 'all' | 'image' | 'video'
  modelSeriesFilter: HistoryModelSeriesFilter
  resolutionFilter: HistoryResolutionFilter
  timeRangeFilter: HistoryTimeRangeFilter
  modelFilter: string
  initialized: boolean
  loading: boolean
  setSearchKeyword: (kw: string) => void
  setTypeFilter: (f: 'all' | 'image' | 'video') => void
  setModelSeriesFilter: (f: HistoryModelSeriesFilter) => void
  setResolutionFilter: (f: HistoryResolutionFilter) => void
  setTimeRangeFilter: (f: HistoryTimeRangeFilter) => void
  setModelFilter: (m: string) => void
  resetFilters: () => void
  addRecord: (record: HistoryRecord) => void
  removeRecord: (id: string) => void
  removeRecords: (ids: string[]) => void
  clearRecords: () => void
  setRecords: (records: HistoryRecord[]) => void
  updateRecord: (id: string, patch: Partial<HistoryRecord>) => void
  getRecord: (id: string) => HistoryRecord | undefined
  loadRecords: () => void
  getFilteredRecords: () => HistoryRecord[]
  exportRecordsJson: () => string
  importRecordsJson: (json: string) => Promise<number>
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],
  searchKeyword: '',
  typeFilter: 'all',
  modelSeriesFilter: 'all',
  resolutionFilter: 'all',
  timeRangeFilter: 'all',
  modelFilter: '',
  initialized: false,
  loading: false,

  setSearchKeyword: (searchKeyword) => set({ searchKeyword }),
  setTypeFilter: (typeFilter) => set({ typeFilter }),
  setModelSeriesFilter: (modelSeriesFilter) => set({ modelSeriesFilter }),
  setResolutionFilter: (resolutionFilter) => set({ resolutionFilter }),
  setTimeRangeFilter: (timeRangeFilter) => set({ timeRangeFilter }),
  setModelFilter: (modelFilter) => set({ modelFilter }),
  resetFilters: () => set({
    searchKeyword: '',
    typeFilter: 'all',
    modelSeriesFilter: 'all',
    resolutionFilter: 'all',
    timeRangeFilter: 'all',
    modelFilter: '',
  }),

  loadRecords: () => {
    if (get().initialized || get().loading) return
    set({ loading: true })
    loadHistoryRecords()
      .then((records) => {
        const assets = dedupeHistoryRecords(successAssetsOnly(records))
        set({ records: assets, initialized: true, loading: false })
        if (assets.length !== records.length) replaceHistoryRecords(assets).catch(() => {})
      })
      .catch(() => set({ records: [], initialized: true, loading: false }))
  },

  addRecord: (record) => {
    const normalized = normalizeHistoryRecord(record)
    if (normalized.status === 'failed') return

    // Optimistic insert: drop any prior copy of the same id so the record only
    // ever exists once in memory, then show it immediately.
    const currentWithoutSameId = get().records.filter((item) => item.id !== normalized.id)
    const optimistic = enforceHistoryLimit(dedupeHistoryRecords([normalized, ...currentWithoutSameId]))
    set({ records: optimistic })

    withThumbnail(normalized)
      .then((readyRecord) => {
        // The thumbnail-ready record replaces the optimistic copy — never append
        // a second entry for the same id (that was the duplicate-card bug).
        const withoutSameId = get().records.filter((item) => item.id !== readyRecord.id)
        return addHistoryRecord(readyRecord, withoutSameId)
      })
      .then((records) => set({ records: enforceHistoryLimit(dedupeHistoryRecords(records)) }))
      .catch(() => {
        const records = enforceHistoryLimit(dedupeHistoryRecords([normalized, ...get().records.filter((item) => item.id !== normalized.id)]))
        set({ records })
      })
  },

  removeRecord: (id) => {
    const records = get().records.filter((record) => record.id !== id)
    set({ records })
    removeHistoryRecords([id], get().records).catch(() => {})
  },

  removeRecords: (ids) => {
    const idSet = new Set(ids)
    const records = get().records.filter((record) => !idSet.has(record.id))
    set({ records })
    removeHistoryRecords(ids, get().records).catch(() => {})
  },

  clearRecords: () => {
    set({ records: [] })
    clearHistoryRecords().catch(() => {})
  },

  setRecords: (records) => {
    const normalized = enforceHistoryLimit(dedupeHistoryRecords(successAssetsOnly(records.map(normalizeHistoryRecord))))
    set({ records: normalized, initialized: true, loading: false })
    replaceHistoryRecords(normalized).catch(() => {})
  },

  updateRecord: (id, patch) => {
    const records = sortByNewest(successAssetsOnly(get().records.map((record) => (
      record.id === id ? normalizeHistoryRecord({ ...record, ...patch }) : record
    ))))
    set({ records })
    replaceHistoryRecords(records).catch(() => {})
  },

  getRecord: (id) => get().records.find((record) => record.id === id),

  getFilteredRecords: () => {
    const {
      records,
      searchKeyword,
      typeFilter,
      modelSeriesFilter,
      resolutionFilter,
      timeRangeFilter,
      modelFilter,
    } = get()
    const kw = searchKeyword.trim().toLowerCase()

    return sortByNewest(successAssetsOnly(records)).filter((record) => {
      if (typeFilter !== 'all' && record.type !== typeFilter) return false
      if (modelSeriesFilter !== 'all' && record.modelSeries !== modelSeriesFilter) return false
      if (resolutionFilter !== 'all' && record.resolution !== resolutionFilter) return false
      if (!isInTimeRange(record, timeRangeFilter)) return false
      if (modelFilter && record.modelId !== modelFilter) return false
      if (kw && !searchableText(record).includes(kw)) return false
      return true
    })
  },

  exportRecordsJson: () => exportHistoryRecords(get().records.map(stripLargeImageDataForExport)),

  importRecordsJson: async (json) => {
    const imported = parseImportedHistoryJson(json, new Set(get().records.map((record) => record.id)))
    const next = enforceHistoryLimit(dedupeHistoryRecords(successAssetsOnly([...imported, ...get().records].map(normalizeHistoryRecord))))
    const saved = await replaceHistoryRecords(next)
    set({ records: saved })
    return successAssetsOnly(imported).length
  },
}))

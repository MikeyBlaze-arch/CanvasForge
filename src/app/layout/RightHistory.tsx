import React, { useEffect, useCallback, useMemo, useState } from 'react'
import { useHistoryStore } from '../../store/historyStore'
import { useNodeStore, createNodeId } from '../../store/nodeStore'
import { useProjectStore } from '../../store/projectStore'
import { useReactFlow } from '@xyflow/react'
import { getImageModelById, normalizeImageModel, normalizeImageSeries } from '../../generation/imageModelRegistry'
import { useI18n } from '../../i18n/useI18n'
import { Search, Trash2, Film, Copy, Download, Plus, Filter, X } from 'lucide-react'
import type { VideoAssetNodeData, ImageAssetNodeData, HistoryRecord } from '../../canvas/nodeTypes'
import { calcThumbnailSize } from '../../utils/imageDimensions'
import { downloadHistoryImage, historyImageUrl } from '../../history/historyDownload'

const HISTORY_DRAG_MIME = 'application/x-canvasforge-history-image'
const HISTORY_PAGE_SIZE = 30

type GroupedRecords = {
  label: string
  records: HistoryRecord[]
}

type Translate = (key: string) => string

function formatMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ''))
}

function recordImageUrl(record: HistoryRecord) {
  return historyImageUrl(record)
}

function recordOutputCount(record: HistoryRecord) {
  if (typeof record.returnedBatchSize === 'number' && record.returnedBatchSize > 1) return record.returnedBatchSize
  if (Array.isArray(record.imageUrls) && record.imageUrls.length > 1) return record.imageUrls.length
  if (Array.isArray(record.outputs) && record.outputs.length > 1) return record.outputs.length
  return 1
}

function recordBatchBadge(record: HistoryRecord) {
  if (record.batchTotal && record.batchTotal > 1 && record.batchIndex) {
    return `${record.batchIndex}/${record.batchTotal}`
  }
  return ''
}

function recordPrompt(record: HistoryRecord) {
  return record.prompt || record.promptSnapshot || ''
}

function recordWidth(record: HistoryRecord) {
  return record.width || record.naturalWidth || 1024
}

function recordHeight(record: HistoryRecord) {
  return record.height || record.naturalHeight || 1024
}

function recordFinalSize(record: HistoryRecord, t?: Translate) {
  return record.finalSize || (recordWidth(record) > 0 && recordHeight(record) > 0 ? `${recordWidth(record)}x${recordHeight(record)}` : (t ? t('history.unknownSize') : 'Unknown size'))
}

function formatTime(record: HistoryRecord, t: Translate) {
  if (record.timeUnknown || !record.createdAt) return t('history.unknownTime')
  const date = new Date(record.createdAt)
  if (Number.isNaN(date.getTime())) return t('history.unknownTime')

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs >= 0 && diffMs < 60_000) return t('history.justNow')
  if (diffMs >= 0 && diffMs < 60 * 60_000) return formatMessage(t('history.minutesAgo'), { count: Math.floor(diffMs / 60_000) })

  const sameDate = date.toDateString() === now.toDateString()
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  if (sameDate) return `${t('history.group.today')} ${time}`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `${t('history.group.yesterday')} ${time}`

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${time}`
}

function timeGroup(record: HistoryRecord, t: Translate) {
  if (record.timeUnknown || !record.createdAt) return t('history.group.older')
  const date = new Date(record.createdAt)
  if (Number.isNaN(date.getTime())) return t('history.group.older')

  const now = new Date()
  if (date.toDateString() === now.toDateString()) return t('history.group.today')

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return t('history.group.yesterday')

  const diffMs = now.getTime() - date.getTime()
  if (diffMs <= 7 * 24 * 60 * 60 * 1000) return t('history.group.last7Days')
  return t('history.group.older')
}

function groupRecords(records: HistoryRecord[], t: Translate): GroupedRecords[] {
  const order = [t('history.group.today'), t('history.group.yesterday'), t('history.group.last7Days'), t('history.group.older')]
  return order
    .map((label) => ({
      label,
      records: records.filter((record) => timeGroup(record, t) === label),
    }))
    .filter((group) => group.records.length > 0)
}

function safeFilePart(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 48) || 'CanvasForge'
}

async function copyTextToClipboard(text: string) {
  if (!text.trim()) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    let copied = false
    try {
      copied = document.execCommand('copy')
    } catch {
      copied = false
    }
    document.body.removeChild(textarea)
    return copied
  }
}

function historyDragPayload(record: HistoryRecord) {
  return {
    // Discriminator + stable history id so the canvas drop handler can preserve origin metadata.
    type: 'canvasforge/history-image',
    historyId: record.id,
    id: record.id,
    mediaType: record.type,
    url: recordImageUrl(record),
    imageUrl: recordImageUrl(record),
    thumbnailUrl: record.thumbnailUrl || recordImageUrl(record),
    naturalWidth: recordWidth(record),
    naturalHeight: recordHeight(record),
    width: recordWidth(record),
    height: recordHeight(record),
    sourceNodeId: record.sourceNodeId,
    modelSeries: record.modelSeries,
    modelId: record.modelId,
    modelLabel: record.modelLabel,
    backendModel: record.backendModel,
    engineType: record.engineType,
    sizeMode: record.sizeMode,
    aspectRatio: record.aspectRatio,
    resolution: record.resolution,
    finalSize: recordFinalSize(record),
    prompt: recordPrompt(record),
    negativePrompt: record.negativePrompt || record.negativePromptSnapshot,
    createdAt: record.createdAt,
    batchId: record.batchId,
    batchIndex: record.batchIndex,
    batchTotal: record.batchTotal,
  }
}

export function RightHistory() {
  const records = useHistoryStore((s) => s.records)
  const loadRecords = useHistoryStore((s) => s.loadRecords)
  const removeRecord = useHistoryStore((s) => s.removeRecord)
  const clearRecords = useHistoryStore((s) => s.clearRecords)
  const searchKeyword = useHistoryStore((s) => s.searchKeyword)
  const setSearchKeyword = useHistoryStore((s) => s.setSearchKeyword)
  const typeFilter = useHistoryStore((s) => s.typeFilter)
  const setTypeFilter = useHistoryStore((s) => s.setTypeFilter)
  const modelSeriesFilter = useHistoryStore((s) => s.modelSeriesFilter)
  const setModelSeriesFilter = useHistoryStore((s) => s.setModelSeriesFilter)
  const resolutionFilter = useHistoryStore((s) => s.resolutionFilter)
  const setResolutionFilter = useHistoryStore((s) => s.setResolutionFilter)
  const timeRangeFilter = useHistoryStore((s) => s.timeRangeFilter)
  const setTimeRangeFilter = useHistoryStore((s) => s.setTimeRangeFilter)
  const resetFilters = useHistoryStore((s) => s.resetFilters)
  const getFilteredRecords = useHistoryStore((s) => s.getFilteredRecords)
  const loading = useHistoryStore((s) => s.loading)
  const addNode = useNodeStore((s) => s.addNode)
  const markDirty = useProjectStore((s) => s.markDirty)
  const reactFlow = useReactFlow()
  const { t } = useI18n()
  const [confirmClear, setConfirmClear] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [detailRecord, setDetailRecord] = useState<HistoryRecord | null>(null)
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE)
  const [queryInput, setQueryInput] = useState(searchKeyword)
  const [copyNotice, setCopyNotice] = useState<string | null>(null)

  useEffect(() => { loadRecords() }, [loadRecords])

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchKeyword(queryInput), 180)
    return () => window.clearTimeout(timer)
  }, [queryInput, setSearchKeyword])

  useEffect(() => {
    setQueryInput(searchKeyword)
  }, [searchKeyword])

  const filtered = getFilteredRecords()
  const visibleRecords = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const grouped = useMemo(() => groupRecords(visibleRecords, t), [visibleRecords, t])

  useEffect(() => {
    setVisibleCount(HISTORY_PAGE_SIZE)
  }, [searchKeyword, typeFilter, modelSeriesFilter, resolutionFilter, timeRangeFilter, filtered.length])

  const createImageNodeFromRecord = useCallback((record: HistoryRecord, position?: { x: number; y: number }) => {
    const imageUrl = recordImageUrl(record)
    if (!imageUrl) return

    const width = recordWidth(record)
    const height = recordHeight(record)
    const thumb = calcThumbnailSize(width, height)
    const pos = position ?? reactFlow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })

    addNode({
      id: createNodeId(),
      type: 'image_asset',
      position: pos,
      data: {
        nodeType: 'image_asset',
        title: record.modelLabel || t('common.history'),
        imageUrl,
        originalImageUrl: record.url || record.imageUrl,
        downloadUrl: record.url || record.imageUrl,
        naturalWidth: width,
        naturalHeight: height,
        previewWidth: thumb.width,
        previewHeight: thumb.height,
        role: 'reference',
        sourceType: 'image_gen',
        sourceNodeId: record.sourceNodeId,
        modelSeries: normalizeImageSeries(record.modelSeries),
        modelId: normalizeImageModel(record.modelId),
        modelLabel: record.modelLabel,
        backendModel: record.backendModel,
        engineType: record.engineType,
        sizeMode: record.sizeMode,
        aspectRatio: record.aspectRatio,
        resolution: record.resolution,
        finalSize: recordFinalSize(record, t),
        prompt: recordPrompt(record),
        negativePrompt: record.negativePrompt || record.negativePromptSnapshot,
        metadata: {
          source: 'history',
          historyId: record.id,
          historyRecordId: record.id,
          prompt: recordPrompt(record),
          modelLabel: record.modelLabel,
          backendModel: record.backendModel,
          aspectRatio: record.aspectRatio,
          resolution: record.resolution,
          finalSize: recordFinalSize(record, t),
          createdAt: record.createdAt,
          historyCreatedAt: record.createdAt,
          batchId: record.batchId,
          batchIndex: record.batchIndex,
          batchTotal: record.batchTotal,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } satisfies ImageAssetNodeData,
    })
    markDirty()
  }, [reactFlow, addNode, markDirty, t])

  const addToCanvas = useCallback((record: HistoryRecord) => {
    if (record.type === 'video') {
      const center = reactFlow.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      addNode({
        id: createNodeId(),
        type: 'video_asset',
        position: center,
        data: {
          nodeType: 'video_asset',
          title: t('common.history'),
          videoUrl: record.videoUrl || '',
          originalVideoUrl: record.videoUrl,
          downloadUrl: record.videoUrl,
          naturalWidth: recordWidth(record),
          naturalHeight: recordHeight(record),
          duration: record.duration,
          previewWidth: Math.min(recordWidth(record), 380),
          previewHeight: Math.round(Math.min(recordWidth(record), 380) * (recordHeight(record) / (recordWidth(record) || 1))),
          role: 'source',
          sourceType: 'upload',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } satisfies VideoAssetNodeData,
      })
      markDirty()
      return
    }

    createImageNodeFromRecord(record)
  }, [reactFlow, addNode, markDirty, t, createImageNodeFromRecord])

  const showCopyNotice = useCallback((message: string) => {
    setCopyNotice(message)
    window.setTimeout(() => setCopyNotice(null), 1600)
  }, [])

  const copyPromptFromRecord = useCallback((record: HistoryRecord) => {
    const prompt = recordPrompt(record)
    copyTextToClipboard(prompt)
      .then((copied) => showCopyNotice(copied ? t('history.copySuccess') : t('history.copyFailed')))
      .catch(() => showCopyNotice(t('history.copyFailed')))
  }, [showCopyNotice, t])

  const downloadItem = useCallback((record: HistoryRecord) => {
    if (record.type === 'video') {
      const url = record.videoUrl
      if (!url) return
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeFilePart(record.modelLabel || 'CanvasForge-video')}-${record.createdAt || Date.now()}.mp4`
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.click()
      return
    }

    downloadHistoryImage(record).catch(() => {
      const url = recordImageUrl(record)
      if (url) window.open(url, '_blank')
    })
  }, [])

  const deleteItem = useCallback((record: HistoryRecord) => {
    if (!window.confirm(t('history.deleteConfirm'))) return
    removeRecord(record.id)
    setDetailRecord((current) => current?.id === record.id ? null : current)
  }, [removeRecord, t])

  const handleDragStart = useCallback((event: React.DragEvent, record: HistoryRecord) => {
    if (record.type !== 'image' || !recordImageUrl(record) || record.status === 'failed') return
    const payload = historyDragPayload(record)
    const url = recordImageUrl(record)
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(HISTORY_DRAG_MIME, JSON.stringify(payload))
    event.dataTransfer.setData('text/uri-list', url)
    event.dataTransfer.setData('text/plain', url)
  }, [])

  const handleClearAll = useCallback(() => {
    if (confirmClear) {
      clearRecords()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
    }
  }, [confirmClear, clearRecords])

  const setBasicFilter = useCallback((filter: 'all' | 'image' | 'video') => {
    setTypeFilter(filter)
  }, [setTypeFilter])

  const renderCard = (record: HistoryRecord) => {
    const model = record.type === 'image' ? getImageModelById(record.modelId) : null
    const modelLabel = record.modelLabel ?? model?.label ?? record.modelId
    const imageUrl = recordImageUrl(record)
    const batchBadge = recordBatchBadge(record)
    const openDetail = () => setDetailRecord(record)
    const stop = (event: React.MouseEvent) => event.stopPropagation()

    return (
      <div
        key={record.id}
        className="history-card success"
        draggable={record.type === 'image' && Boolean(imageUrl) && record.status !== 'failed'}
        onDragStart={(event) => handleDragStart(event, record)}
        onClick={openDetail}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openDetail()
          }
        }}
      >
        {(record.thumbnailUrl || imageUrl || record.videoUrl) && (
          <div
            className="history-card-preview"
            title={record.type === 'image' ? t('history.previewHint') : undefined}
          >
            {record.type === 'video' ? (
              <div className="history-card-video-preview">
                <Film size={20} style={{ color: 'var(--text-muted)' }} />
                {record.duration != null && (
                  <span className="history-card-duration">{Math.floor(record.duration)}s</span>
                )}
              </div>
            ) : (
              <img
                src={record.thumbnailUrl || imageUrl}
                className="history-card-img"
                loading="lazy"
                alt=""
              />
            )}
            <span className="history-card-kind">
              {record.type === 'video' ? t('history.videoLabel') : t('history.imageLabel')}
            </span>
            {record.type === 'image' && batchBadge && (
              <span className="history-card-duration">{batchBadge}</span>
            )}
            {record.type === 'image' && !batchBadge && recordOutputCount(record) > 1 && (
              <span className="history-card-duration">{formatMessage(t('history.outputCount'), { count: recordOutputCount(record) })}</span>
            )}
            <div className="history-card-overlay" onClick={stop}>
              <button
                draggable={false}
                className="history-card-action"
                onClick={(e) => { e.stopPropagation(); copyPromptFromRecord(record) }}
                title={t('history.copyPrompt')}
                aria-label={t('history.copyPrompt')}
              >
                <Copy size={12} /> {t('common.copy')}
              </button>
              <button
                draggable={false}
                className="history-card-action"
                onClick={(e) => { e.stopPropagation(); addToCanvas(record) }}
                title={t('history.insertCanvas')}
                aria-label={t('history.insertCanvas')}
              >
                <Plus size={12} /> {t('history.insert')}
              </button>
              <button
                draggable={false}
                className="history-card-action"
                onClick={(e) => { e.stopPropagation(); downloadItem(record) }}
                title={t('common.download')}
                aria-label={t('common.download')}
              >
                <Download size={12} /> {t('common.download')}
              </button>
              <button
                draggable={false}
                className="history-card-action danger"
                onClick={(e) => { e.stopPropagation(); deleteItem(record) }}
                title={t('common.delete')}
                aria-label={t('common.delete')}
              >
                <Trash2 size={12} /> {t('common.delete')}
              </button>
            </div>
          </div>
        )}

        <div className="history-card-body">
          <div className="history-card-model">{modelLabel}</div>
          <div className="history-card-meta">
            {record.aspectRatio && <span className="history-card-pill">{record.aspectRatio}</span>}
            {record.resolution && <span className="history-card-pill">{record.resolution}</span>}
            <span className="history-card-pill">{recordFinalSize(record, t)}</span>
          </div>
          <div className="history-card-time">{formatTime(record, t)}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="history-panel">
      <div className="history-toolbar">
        <div className="history-summary">
          <span>{loading ? t('common.loading') : formatMessage(t('history.totalCount'), { count: filtered.length })}</span>
        </div>
      </div>
      {copyNotice && (
        <div className="history-copy-toast" role="status">
          {copyNotice}
        </div>
      )}

      <div className="history-search-row">
        <div className="history-search-box">
          <Search size={12} />
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder={t('history.searchPlaceholderFull')}
            className="nodrag nopan nowheel"
          />
        </div>
        <button type="button" className="cf-btn cf-btn-sm" onClick={() => setFiltersOpen((value) => !value)}>
          <Filter size={10} /> {t('history.filter')}
        </button>
      </div>

      <div className="history-basic-filters">
        {(['all', 'image', 'video'] as const).map((filter) => {
          const active = typeFilter === filter
          return (
            <button
              key={filter}
              onClick={() => setBasicFilter(filter)}
              className={`history-filter-chip ${active ? 'active' : ''}`}
            >
              {filter === 'all' ? t('common.all') : filter === 'image' ? t('common.image') : t('common.video')}
            </button>
          )
        })}
      </div>

      {filtersOpen && (
        <div className="history-advanced-filters">
          <label>
            {t('history.filter.type')}
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | 'image' | 'video')}>
              <option value="all">{t('common.all')}</option>
              <option value="image">{t('common.image')}</option>
              <option value="video">{t('common.video')}</option>
            </select>
          </label>
          <label>
            {t('history.filter.series')}
            <select value={modelSeriesFilter} onChange={(event) => setModelSeriesFilter(event.target.value as 'all' | 'G' | 'R' | 'C')}>
              <option value="all">{t('common.all')}</option>
              <option value="G">G</option>
              <option value="R">R</option>
              <option value="C">C</option>
            </select>
          </label>
          <label>
            {t('history.filter.resolution')}
            <select value={resolutionFilter} onChange={(event) => setResolutionFilter(event.target.value as 'all' | '1K' | '2K' | '4K')}>
              <option value="all">{t('common.all')}</option>
              <option value="1K">1K</option>
              <option value="2K">2K</option>
              <option value="4K">4K</option>
            </select>
          </label>
          <label>
            {t('history.filter.time')}
            <select value={timeRangeFilter} onChange={(event) => setTimeRangeFilter(event.target.value as 'all' | 'today' | '7d' | '30d')}>
              <option value="all">{t('common.all')}</option>
              <option value="today">{t('history.group.today')}</option>
              <option value="7d">{t('history.group.last7Days')}</option>
              <option value="30d">{t('history.group.last30Days')}</option>
            </select>
          </label>
          <button type="button" className="cf-btn cf-btn-sm" onClick={resetFilters}>
            <X size={10} /> {t('history.resetFilters')}
          </button>
        </div>
      )}

      <div className="history-clear-row">
        <button
          onClick={handleClearAll}
          className="history-clear-btn"
        >
          <Trash2 size={10} />
          {confirmClear ? t('history.confirmClear') : t('history.clearAll')}
        </button>
      </div>

      <div className="history-list">
        {filtered.length === 0 ? (
          <div className="empty-state">{records.length === 0 ? t('history.empty') : t('history.noMatching')}</div>
        ) : (
          grouped.map((group) => (
            <section key={group.label} className="history-group">
              <div className="history-group-title">{group.label}</div>
              <div className="history-group-list">
                {group.records.map(renderCard)}
              </div>
            </section>
          ))
        )}
        {filtered.length > visibleRecords.length && (
          <button
            type="button"
            className="cf-btn cf-btn-sm history-load-more"
            onClick={() => setVisibleCount((count) => count + HISTORY_PAGE_SIZE)}
          >
            {formatMessage(t('history.loadMore'), { count: filtered.length - visibleRecords.length })}
          </button>
        )}
      </div>

      {detailRecord && (
        <div className="history-preview-overlay" onClick={() => setDetailRecord(null)}>
          <div className="history-preview-modal nodrag nopan nowheel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="history-preview-close" onClick={() => setDetailRecord(null)}>
              <X size={16} />
            </button>
            <div className="history-preview-image-wrap">
              {detailRecord.type === 'video' ? (
                <div className="history-card-video-preview">
                  <Film size={28} style={{ color: 'var(--text-muted)' }} />
                  {detailRecord.duration != null && (
                    <span className="history-card-duration">{Math.floor(detailRecord.duration)}s</span>
                  )}
                </div>
              ) : (
                <img src={detailRecord.url || detailRecord.originalUrl || detailRecord.imageUrl || recordImageUrl(detailRecord)} alt="" />
              )}
            </div>
            <div className="history-preview-info">
              <div className="history-preview-title">{detailRecord.modelLabel || getImageModelById(detailRecord.modelId)?.label || detailRecord.modelId}</div>
              <div className="history-card-meta">
                {detailRecord.modelSeries && <span className="history-card-pill">{detailRecord.modelSeries}</span>}
                {detailRecord.backendModel && <span className="history-card-pill">{detailRecord.backendModel}</span>}
                {detailRecord.aspectRatio && <span className="history-card-pill">{detailRecord.aspectRatio}</span>}
                {detailRecord.resolution && <span className="history-card-pill">{detailRecord.resolution}</span>}
                <span className="history-card-pill">{recordFinalSize(detailRecord, t)}</span>
                {detailRecord.type === 'image' && recordBatchBadge(detailRecord) && (
                  <span className="history-card-pill">{recordBatchBadge(detailRecord)}</span>
                )}
                {detailRecord.type === 'image' && !recordBatchBadge(detailRecord) && recordOutputCount(detailRecord) > 1 && (
                  <span className="history-card-pill">{formatMessage(t('history.outputCount'), { count: recordOutputCount(detailRecord) })}</span>
                )}
                <span className="history-card-pill">{formatTime(detailRecord, t)}</span>
              </div>
              {recordPrompt(detailRecord) && <div className="history-preview-prompt">{recordPrompt(detailRecord)}</div>}
              <div className="history-preview-actions">
                <button type="button" className="cf-btn cf-btn-sm" onClick={() => copyPromptFromRecord(detailRecord)}>
                  <Copy size={10} /> {t('history.copyPrompt')}
                </button>
                <button type="button" className="cf-btn cf-btn-sm" onClick={() => addToCanvas(detailRecord)}>
                  <Plus size={10} /> {t('history.insertCanvas')}
                </button>
                <button type="button" className="cf-btn cf-btn-sm" onClick={() => downloadItem(detailRecord)}>
                  <Download size={10} /> {t('common.download')}
                </button>
                <button type="button" className="cf-btn cf-btn-sm cf-btn-danger" onClick={() => deleteItem(detailRecord)}>
                  <Trash2 size={10} /> {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

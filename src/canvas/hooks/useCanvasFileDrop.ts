import { useCallback } from 'react'
import type { ReactFlowInstance } from '@xyflow/react'
import { useNodeStore, createNodeId } from '../../store/nodeStore'
import { useUndoRedoStore } from '../../store/undoRedoStore'
import { readImageFile, isImageFile } from '../imageFileUtils'
import { readVideoFile, isVideoFile } from '../videoFileUtils'
import { calcThumbnailSize } from '../../utils/imageDimensions'
import type { ImageAssetNodeData, VideoAssetNodeData, HistoryRecord } from '../nodeTypes'
import { normalizeImageModel, normalizeImageSeries } from '../../generation/imageModelRegistry'

const HISTORY_DRAG_MIME = 'application/x-canvasforge-history-image'

function recordImageUrl(record: Partial<HistoryRecord>) {
  return record.url || record.imageUrl || record.thumbnailUrl || ''
}

function recordWidth(record: Partial<HistoryRecord>) {
  return record.width || record.naturalWidth || 1024
}

function recordHeight(record: Partial<HistoryRecord>) {
  return record.height || record.naturalHeight || 1024
}

function recordPrompt(record: Partial<HistoryRecord>) {
  return record.prompt || record.promptSnapshot || ''
}

function recordFinalSize(record: Partial<HistoryRecord>) {
  const width = recordWidth(record)
  const height = recordHeight(record)
  return record.finalSize || (width > 0 && height > 0 ? `${width}x${height}` : undefined)
}

export function useCanvasFileDrop(
  reactFlow: ReactFlowInstance,
  markDirty: () => void,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()
      const historyPayload = event.dataTransfer.getData(HISTORY_DRAG_MIME)
      if (historyPayload) {
        try {
          const record = JSON.parse(historyPayload) as Partial<HistoryRecord> & { historyId?: string }
          const imageUrl = recordImageUrl(record)
          if (!imageUrl) return

          const { addNode } = useNodeStore.getState()
          const basePos = reactFlow.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          })
          const width = recordWidth(record)
          const height = recordHeight(record)
          const thumb = calcThumbnailSize(width, height)

          useUndoRedoStore.getState().capture('Add image from history')
          const historyId = record.historyId || record.id
          addNode({
            id: createNodeId(),
            type: 'image_asset',
            position: basePos,
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
              modelId: normalizeImageModel(record.modelId || record.backendModel),
              modelLabel: record.modelLabel,
              backendModel: record.backendModel,
              engineType: record.engineType,
              sizeMode: record.sizeMode,
              aspectRatio: record.aspectRatio,
              resolution: record.resolution,
              finalSize: recordFinalSize(record),
              prompt: recordPrompt(record),
              negativePrompt: record.negativePrompt || record.negativePromptSnapshot,
              metadata: {
                source: 'history',
                historyId,
                historyRecordId: historyId,
                prompt: recordPrompt(record),
                modelLabel: record.modelLabel,
                backendModel: record.backendModel,
                aspectRatio: record.aspectRatio,
                resolution: record.resolution,
                finalSize: recordFinalSize(record),
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
          return
        } catch (error) {
          console.warn('[CanvasRoot] Failed to parse history drag payload:', error)
          return
        }
      }

      const allFiles = Array.from(event.dataTransfer.files)
      const imageFiles = allFiles.filter(isImageFile)
      const videoFiles = allFiles.filter(isVideoFile)
      if (imageFiles.length === 0 && videoFiles.length === 0) return

      const { addNode } = useNodeStore.getState()
      const basePos = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      // Capture undo snapshot before any file uploads
      useUndoRedoStore.getState().capture('拖拽上传')

      let offsetIdx = 0

      // Read all images; offsets prevent overlap when multiple files are dropped at once
      const imgResults = await Promise.allSettled(imageFiles.map(readImageFile))
      for (const r of imgResults) {
        if (r.status !== 'fulfilled') continue
        const { file, thumbnailUrl, originalUrl, fileName, mimeType, size, naturalWidth, naturalHeight } = r.value
        const thumb = calcThumbnailSize(naturalWidth, naturalHeight)
        const output = {
          type: 'image' as const,
          file,
          url: thumbnailUrl,
          previewUrl: thumbnailUrl,
          name: fileName,
          mimeType,
          size,
          width: naturalWidth,
          height: naturalHeight,
          source: 'local' as const,
        }
        const offset = offsetIdx * 280
        offsetIdx++
        addNode({
          id: createNodeId(),
          type: 'image_asset',
          position: { x: basePos.x + offset, y: basePos.y },
          data: {
            nodeType: 'image_asset',
            title: fileName,
            imageUrl: thumbnailUrl,
            originalImageUrl: originalUrl,
            downloadUrl: originalUrl,
            image: output,
            output,
            fileName,
            mimeType,
            naturalWidth,
            naturalHeight,
            previewWidth: thumb.width,
            previewHeight: thumb.height,
            role: 'reference',
            sourceType: 'upload',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } satisfies ImageAssetNodeData,
        })
      }

      // Read all videos
      const vidResults = await Promise.allSettled(videoFiles.map(readVideoFile))
      for (const r of vidResults) {
        if (r.status !== 'fulfilled') continue
        const { file, videoUrl, fileName, mimeType, size, naturalWidth, naturalHeight, duration, previewWidth, previewHeight } = r.value
        const output = {
          type: 'video' as const,
          file,
          url: videoUrl,
          previewUrl: videoUrl,
          name: fileName,
          mimeType,
          size,
          width: naturalWidth,
          height: naturalHeight,
          duration,
          source: 'local' as const,
        }
        const offset = offsetIdx * 400
        offsetIdx++
        addNode({
          id: createNodeId(),
          type: 'video_asset',
          position: { x: basePos.x + offset, y: basePos.y },
          data: {
            nodeType: 'video_asset',
            title: fileName,
            videoUrl,
            originalVideoUrl: videoUrl,
            downloadUrl: videoUrl,
            video: output,
            output,
            fileName,
            mimeType,
            naturalWidth,
            naturalHeight,
            duration,
            previewWidth,
            previewHeight,
            role: 'source',
            sourceType: 'upload',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } satisfies VideoAssetNodeData,
        })
      }
      markDirty()
    },
    [reactFlow, markDirty, t]
  )

  return {
    onDragOver,
    onDrop,
  }
}

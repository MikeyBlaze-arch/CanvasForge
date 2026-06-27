import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ImageIcon, Upload, Download, Trash2 } from 'lucide-react'
import { NodeShell } from '../../components/NodeShell'
import { PortLabel } from '../../components/PortLabel'
import { useNodeStore } from '../../store/nodeStore'
import type { ImageAssetNodeData } from '../nodeTypes'
import { useI18n } from '../../i18n/useI18n'
import { isImageFile, readImageFile } from '../imageFileUtils'
import { downloadImage } from '../../utils/downloadImage'
import { getImageDimensions, calcThumbnailSize } from '../../utils/imageDimensions'
import { useUIStore } from '../../store/uiStore'
import { getImageSourceUrl } from '../imageSourceUtils'
import { ImagePreviewModal } from '../../components/ImagePreviewModal'

/** Thumbnail config for node display — decoupled from source resolution. */
const THUMB_DEFAULTS = { width: 320, height: 240 }
const HIGH_RES_PREVIEW_ZOOM = 1.35

function getNodeCardWidth(data: ImageAssetNodeData): number {
  if (!data.imageUrl) return 210
  if (data.previewWidth && data.previewWidth > 0) return data.previewWidth
  return THUMB_DEFAULTS.width
}

export const ImageAssetNodeComponent = React.memo(function ImageAssetNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as ImageAssetNodeData
  const updateNodeData = useNodeStore((s) => s.updateNodeData)
  const fileRef = useRef<HTMLInputElement>(null)
  const dimsLoadedRef = useRef(false)
  const dragDepthRef = useRef(0)
  const [previewCropStyle, setPreviewCropStyle] = useState<React.CSSProperties>({})
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const { t } = useI18n()
  const viewportZoom = useUIStore((s) => s.viewportZoom)
  const nodeWidth = getNodeCardWidth(d)
  const previewImageUrl = getImageSourceUrl(d, 'display', {
    zoom: viewportZoom,
    cssWidth: nodeWidth,
    cssHeight: d.previewHeight,
    zoomSwitchThreshold: HIGH_RES_PREVIEW_ZOOM,
  })
  const zoomedImageUrl = getImageSourceUrl(d, 'download') ?? previewImageUrl

  const hasValidDims = d.naturalWidth != null && d.naturalWidth > 0 && d.naturalHeight != null && d.naturalHeight > 0
  const hasThumbnail = d.previewWidth != null && d.previewWidth > 0

  // Auto-detect real dimensions + calculate thumbnail when missing
  useEffect(() => {
    if (!d.imageUrl) {
      dimsLoadedRef.current = false
      return
    }
    if (hasValidDims && hasThumbnail) {
      dimsLoadedRef.current = true
      return
    }
    if (dimsLoadedRef.current) return

    let cancelled = false
    dimsLoadedRef.current = true

    getImageDimensions(d.imageUrl)
      .then((dims) => {
        if (cancelled) return
        const thumb = calcThumbnailSize(dims.naturalWidth, dims.naturalHeight)
        updateNodeData(id, {
          naturalWidth: dims.naturalWidth,
          naturalHeight: dims.naturalHeight,
          previewWidth: thumb.width,
          previewHeight: thumb.height,
          updatedAt: Date.now(),
        } as Partial<ImageAssetNodeData>)
      })
      .catch(() => {
        if (!cancelled) dimsLoadedRef.current = false
      })

    return () => { cancelled = true }
  }, [d.imageUrl, hasValidDims, hasThumbnail, id, updateNodeData])

  const updateWithThumbnail = useCallback(
    (patch: Partial<ImageAssetNodeData>) => {
      const nw = patch.naturalWidth ?? d.naturalWidth ?? 0
      const nh = patch.naturalHeight ?? d.naturalHeight ?? 0
      if (nw > 0 && nh > 0) {
        const thumb = calcThumbnailSize(nw, nh)
        patch.previewWidth = thumb.width
        patch.previewHeight = thumb.height
      }
      patch.updatedAt = Date.now()
      updateNodeData(id, patch)
    },
    [id, d.naturalWidth, d.naturalHeight, updateNodeData]
  )

  const replaceWithFile = useCallback(
    (file: File) => {
      if (!isImageFile(file)) return
      dimsLoadedRef.current = false
      setPreviewCropStyle({})
      setPreviewOpen(false)
      readImageFile(file)
        .then((result) => {
          const output = {
            type: 'image' as const,
            file: result.file,
            url: result.thumbnailUrl,
            previewUrl: result.thumbnailUrl,
            name: result.fileName,
            mimeType: result.mimeType,
            size: result.size,
            width: result.naturalWidth,
            height: result.naturalHeight,
            source: 'local' as const,
          }
          updateWithThumbnail({
            imageUrl: result.thumbnailUrl,
            originalImageUrl: result.originalUrl,
            downloadUrl: result.originalUrl,
            image: output,
            output,
            fileName: result.fileName,
            mimeType: result.mimeType,
            naturalWidth: result.naturalWidth,
            naturalHeight: result.naturalHeight,
            sourceType: 'upload',
          })
        })
        .catch(() => {})
    },
    [updateWithThumbnail]
  )

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) replaceWithFile(file)
      e.target.value = ''
    },
    [replaceWithFile]
  )

  const handleImageDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.items).some((item) => item.kind === 'file' && item.type.startsWith('image/'))) return
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current += 1
    setIsDragOver(true)
  }, [])

  const handleImageDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.items).some((item) => item.kind === 'file' && item.type.startsWith('image/'))) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleImageDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDragOver(false)
  }, [])

  const handleImageDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = 0
    setIsDragOver(false)

    const file = Array.from(event.dataTransfer.files).find(isImageFile)
    if (file) replaceWithFile(file)
  }, [replaceWithFile])

  const handleClear = useCallback(() => {
    dimsLoadedRef.current = false
    setPreviewCropStyle({})
    setPreviewOpen(false)
    updateNodeData(id, {
      imageUrl: '',
      originalImageUrl: undefined,
      downloadUrl: undefined,
      image: undefined,
      output: undefined,
      fileName: undefined,
      previewWidth: undefined,
      previewHeight: undefined,
      updatedAt: Date.now(),
    } as Partial<ImageAssetNodeData>)
  }, [id, updateNodeData])

  const handleDownload = useCallback(() => {
    downloadImage(d).catch((err) => {
      console.error('[ImageAsset] Download failed:', err)
      alert(t('imageNode.downloadFailed'))
    })
  }, [d, t])

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    if (!zoomedImageUrl) return
    event.preventDefault()
    event.stopPropagation()
    setPreviewOpen(true)
  }, [zoomedImageUrl])

  const dimensionsLabel = d.imageUrl && hasValidDims
    ? ` · ${d.naturalWidth} × ${d.naturalHeight}`
    : ''

  return (
    <NodeShell nodeType="image_asset" title={`${t('node.image')}${dimensionsLabel}`} selected={!!selected} width={nodeWidth}>
      {d.imageUrl ? (
        <div
          className={['image-node-preview-wrap', isDragOver ? 'image-node-drag-over' : ''].filter(Boolean).join(' ')}
          onDoubleClick={handleDoubleClick}
          onDragEnter={handleImageDragEnter}
          onDragOver={handleImageDragOver}
          onDragLeave={handleImageDragLeave}
          onDrop={handleImageDrop}
        >
          <img src={previewImageUrl} alt={d.fileName || 'asset'} style={previewCropStyle} decoding="async" loading="lazy" />
          <div className="image-node-overlay">
            <button className="image-node-overlay-btn" onClick={() => fileRef.current?.click()} title={t('imageNode.replace')}>
              <Upload size={13} />
            </button>
            <button className="image-node-overlay-btn" onClick={handleDownload} title={t('imageNode.download')}>
              <Download size={13} />
            </button>
            <button className="image-node-overlay-btn" onClick={handleClear} title={t('imageNode.remove')}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div
          className={['image-node-placeholder', isDragOver ? 'image-node-drag-over' : ''].filter(Boolean).join(' ')}
          onClick={() => fileRef.current?.click()}
          onDragEnter={handleImageDragEnter}
          onDragOver={handleImageDragOver}
          onDragLeave={handleImageDragLeave}
          onDrop={handleImageDrop}
        >
          <ImageIcon size={28} strokeWidth={1.2} />
          <span style={{ fontSize: 11 }}>{t('imageNode.empty')}</span>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {/* Ports — main handles visible, semantic handles invisible */}
      <ImagePreviewModal
        open={previewOpen}
        imageUrl={zoomedImageUrl}
        filename={d.fileName}
        width={d.naturalWidth}
        height={d.naturalHeight}
        onClose={() => setPreviewOpen(false)}
        onDownload={handleDownload}
      />

      <div className="node-ports">
        <div className="node-port-group">
          <PortLabel type="target" id="main_input" mode="main" />
          <PortLabel type="target" id="image_input" mode="legacy" />
        </div>
        <div className="node-port-group">
          <PortLabel type="source" id="main_output" mode="main" />
          <PortLabel type="source" id="image_output" mode="semantic" />
          <PortLabel type="source" id="reference_image" mode="semantic" />
          <PortLabel type="source" id="source_image" mode="semantic" />
          <PortLabel type="source" id="mask_image" mode="semantic" />
        </div>
      </div>
    </NodeShell>
  )
})

import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ImageIcon, Upload, Download, Trash2 } from 'lucide-react'
import { NodeShell } from '../../components/NodeShell'
import { PortLabel } from '../../components/PortLabel'
import { useNodeStore } from '../../store/nodeStore'
import type { ImageAssetNodeData } from '../nodeTypes'
import { useI18n } from '../../i18n/useI18n'
import { readImageFile } from '../imageFileUtils'
import { downloadImage } from '../../utils/downloadImage'
import { getImageDimensions, calcThumbnailSize } from '../../utils/imageDimensions'

/** Thumbnail config for node display — decoupled from source resolution. */
const THUMB_DEFAULTS = { width: 320, height: 240 }

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
  const [previewCropStyle, setPreviewCropStyle] = useState<React.CSSProperties>({})
  const { t } = useI18n()
  const nodeWidth = getNodeCardWidth(d)

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

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      dimsLoadedRef.current = false
      setPreviewCropStyle({})
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

  const handleClear = useCallback(() => {
    dimsLoadedRef.current = false
    setPreviewCropStyle({})
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

  const handleDoubleClick = useCallback(() => {
    if (!d.imageUrl) return
    // Find or create a global overlay for full-size preview
    const existing = document.getElementById('cf-image-preview-overlay')
    if (existing) existing.remove()

    const overlay = document.createElement('div')
    overlay.id = 'cf-image-preview-overlay'
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:9999;',
      'display:flex;align-items:center;justify-content:center;',
      'background:rgba(0,0,0,0.85);',
      'cursor:pointer;',
    ].join('')
    overlay.onclick = () => overlay.remove()

    const wrapper = document.createElement('div')
    wrapper.style.cssText = [
      'position:relative;max-width:90vw;max-height:85vh;',
      'display:flex;flex-direction:column;align-items:center;gap:10px;',
    ].join('')
    wrapper.onclick = (e) => e.stopPropagation()

    const img = document.createElement('img')
    img.src = d.imageUrl
    img.alt = d.fileName || 'preview'
    img.style.cssText = [
      'max-width:90vw;max-height:80vh;object-fit:contain;',
      'border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);',
    ].join('')

    const btnRow = document.createElement('div')
    btnRow.style.cssText = 'display:flex;gap:8px;'

    const downloadBtn = document.createElement('button')
    downloadBtn.textContent = t('imageNode.download')
    downloadBtn.style.cssText = [
      'padding:8px 16px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);',
      'background:rgba(255,255,255,0.1);color:#fff;font-size:13px;cursor:pointer;',
    ].join('')
    downloadBtn.onclick = () => handleDownload()

    const closeBtn = document.createElement('button')
    closeBtn.textContent = t('common.cancel')
    closeBtn.style.cssText = downloadBtn.style.cssText
    closeBtn.onclick = () => overlay.remove()

    btnRow.appendChild(downloadBtn)
    btnRow.appendChild(closeBtn)
    wrapper.appendChild(img)
    wrapper.appendChild(btnRow)
    overlay.appendChild(wrapper)
    document.body.appendChild(overlay)

    // Close on Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey) }
    }
    document.addEventListener('keydown', onKey)
  }, [d, t, handleDownload])

  const dimensionsLabel = d.imageUrl && hasValidDims
    ? ` · ${d.naturalWidth} × ${d.naturalHeight}`
    : ''

  return (
    <NodeShell nodeType="image_asset" title={`${t('node.image')}${dimensionsLabel}`} selected={!!selected} width={nodeWidth}>
      {d.imageUrl ? (
        <div className="image-node-preview-wrap" onDoubleClick={handleDoubleClick}>
          <img src={d.imageUrl} alt={d.fileName || 'asset'} style={previewCropStyle} decoding="async" loading="lazy" />
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
        <div className="image-node-placeholder" onClick={() => fileRef.current?.click()}>
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

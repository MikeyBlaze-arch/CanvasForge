import React, { useCallback, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Download, Link2 } from 'lucide-react'
import { NodeShell } from '../../components/NodeShell'
import { PortLabel } from '../../components/PortLabel'
import { useNodeStore } from '../../store/nodeStore'
import type { ResultImageNodeData, ImageAssetNodeData } from '../nodeTypes'
import { getImageModelConfig } from '../../generation/imageModelRegistry'
import { calcThumbnailSize } from '../../utils/imageDimensions'
import { downloadImage } from '../../utils/downloadImage'
import { useI18n } from '../../i18n/useI18n'
import { getImageSourceUrl } from '../imageSourceUtils'
import { useUIStore } from '../../store/uiStore'
import { ImagePreviewModal } from '../../components/ImagePreviewModal'

const HIGH_RES_PREVIEW_ZOOM = 1.35

export const ResultImageNodeComponent = React.memo(function ResultImageNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as ResultImageNodeData
  const modelConfig = getImageModelConfig(d.modelSeries, d.modelId)
  const addNode = useNodeStore((s) => s.addNode)
  const nodes = useNodeStore((s) => s.nodes)
  const [hovered, setHovered] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const { t } = useI18n()
  const viewportZoom = useUIStore((s) => s.viewportZoom)

  const thumb = d.naturalWidth && d.naturalHeight
    ? calcThumbnailSize(d.naturalWidth, d.naturalHeight)
    : { width: 280, height: 210 }
  const previewImageUrl = getImageSourceUrl(d, 'display', {
    zoom: viewportZoom,
    cssWidth: thumb.width,
    cssHeight: thumb.height,
    zoomSwitchThreshold: HIGH_RES_PREVIEW_ZOOM,
  })
  const zoomedImageUrl = getImageSourceUrl(d, 'download') ?? previewImageUrl

  const handleDownload = useCallback(() => {
    downloadImage(d).catch((err) => {
      console.error('[ResultImage] Download failed:', err)
    })
  }, [d])

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    if (!zoomedImageUrl) return
    event.preventDefault()
    event.stopPropagation()
    setPreviewOpen(true)
  }, [zoomedImageUrl])

  return (
    <NodeShell nodeType="result_image" title={t('node.result')} selected={!!selected} width={thumb.width}>
      {d.imageUrl && (
        <div
          className="image-node-preview-wrap"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onDoubleClick={handleDoubleClick}
        >
          <img src={previewImageUrl} alt="result" decoding="async" loading="lazy" />
          {hovered && (
            <div className="image-node-overlay">
              <button className="image-node-overlay-btn" onClick={() => {
                const sourceNode = nodes.find((n) => n.id === id)
                const imgThumb = d.naturalWidth && d.naturalHeight
                  ? calcThumbnailSize(d.naturalWidth, d.naturalHeight)
                  : { width: 320, height: 240 }
                addNode({
                  id: 'n_' + Date.now().toString(36),
                  type: 'image_asset',
                  position: { x: (sourceNode?.position.x ?? 0) + 300, y: (sourceNode?.position.y ?? 0) + 200 },
                  data: {
                    nodeType: 'image_asset',
                    title: t('result.titleFromResult'),
                    imageUrl: d.imageUrl,
                    originalImageUrl: d.originalImageUrl || d.downloadUrl || d.imageUrl,
                    downloadUrl: d.downloadUrl || d.originalImageUrl || d.imageUrl,
                    naturalWidth: d.naturalWidth,
                    naturalHeight: d.naturalHeight,
                    previewWidth: imgThumb.width,
                    previewHeight: imgThumb.height,
                    role: 'reference',
                    sourceType: 'result_convert',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  } as ImageAssetNodeData,
                })
              }} title={t('result.setAsReference')}>
                <Link2 size={13} />
              </button>
              <button className="image-node-overlay-btn" onClick={handleDownload} title={t('result.export')}>
                <Download size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Compact meta */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <span className="history-card-pill">{d.modelLabel ?? modelConfig?.label ?? d.modelId}</span>
        <span className="history-card-pill">{d.aspectRatio}</span>
        <span className="history-card-pill">{d.resolution}</span>
      </div>

      <ImagePreviewModal
        open={previewOpen}
        imageUrl={zoomedImageUrl}
        filename="result"
        width={d.naturalWidth}
        height={d.naturalHeight}
        onClose={() => setPreviewOpen(false)}
        onDownload={handleDownload}
      />

      {/* Handles - main handles visible, semantic handles invisible */}
      <div className="node-ports">
        <div className="node-port-group">
          <PortLabel type="target" id="main_input" mode="main" />
          <PortLabel type="target" id="generated_image" mode="semantic" />
        </div>
        <div className="node-port-group">
          <PortLabel type="source" id="main_output" mode="main" />
          <PortLabel type="source" id="reference_image" mode="semantic" />
          <PortLabel type="source" id="source_image" mode="semantic" />
        </div>
      </div>
    </NodeShell>
  )
})

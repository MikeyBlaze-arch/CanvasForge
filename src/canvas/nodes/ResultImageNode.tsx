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

export const ResultImageNodeComponent = React.memo(function ResultImageNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as ResultImageNodeData
  const modelConfig = getImageModelConfig(d.modelSeries, d.modelId)
  const addNode = useNodeStore((s) => s.addNode)
  const nodes = useNodeStore((s) => s.nodes)
  const [hovered, setHovered] = useState(false)
  const { t } = useI18n()

  const thumb = d.naturalWidth && d.naturalHeight
    ? calcThumbnailSize(d.naturalWidth, d.naturalHeight)
    : { width: 280, height: 210 }

  const handleDownload = useCallback(() => {
    downloadImage(d).catch((err) => {
      console.error('[ResultImage] Download failed:', err)
    })
  }, [d])

  const handleDoubleClick = useCallback(() => {
    if (!d.imageUrl) return
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

    const img = document.createElement('img')
    img.src = d.imageUrl
    img.alt = 'preview'
    img.style.cssText = [
      'max-width:90vw;max-height:85vh;object-fit:contain;',
      'border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);',
    ].join('')
    img.onclick = (e) => e.stopPropagation()
    overlay.appendChild(img)
    document.body.appendChild(overlay)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey) }
    }
    document.addEventListener('keydown', onKey)
  }, [d])

  return (
    <NodeShell nodeType="result_image" title={t('node.result')} selected={!!selected} width={thumb.width}>
      {d.imageUrl && (
        <div
          className="image-node-preview-wrap"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onDoubleClick={handleDoubleClick}
        >
          <img src={d.imageUrl} alt="result" decoding="async" loading="lazy" />
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

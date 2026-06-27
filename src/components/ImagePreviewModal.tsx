import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'

type ImagePreviewModalProps = {
  open: boolean
  imageUrl?: string
  filename?: string
  width?: number
  height?: number
  onClose: () => void
  onDownload?: () => void
}

const MIN_SCALE = 0.25
const MAX_SCALE = 8
const SCALE_STEP = 1.2

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

export function ImagePreviewModal({
  open,
  imageUrl,
  filename,
  onClose,
}: ImagePreviewModalProps) {
  const { t } = useI18n()
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 })

  const fitToWindow = useCallback(() => {
    setScale(1)
    setRotation(0)
    setOffset({ x: 0, y: 0 })
  }, [])

  const zoomBy = useCallback((factor: number) => {
    setScale((value) => {
      const next = clampScale(value * factor)
      if (next <= 1) setOffset({ x: 0, y: 0 })
      return next
    })
  }, [])

  const zoomIn = useCallback(() => zoomBy(SCALE_STEP), [zoomBy])
  const zoomOut = useCallback(() => zoomBy(1 / SCALE_STEP), [zoomBy])
  const rotateLeft = useCallback(() => setRotation((value) => value - 90), [])
  const rotateRight = useCallback(() => setRotation((value) => value + 90), [])

  useEffect(() => {
    if (!open) return
    fitToWindow()
  }, [fitToWindow, imageUrl, open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key === '+' || event.key === '=') zoomIn()
      if (event.key === '-') zoomOut()
      if (event.key === '0') fitToWindow()
      if (event.key === '[') rotateLeft()
      if (event.key === ']') rotateRight()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fitToWindow, onClose, open, rotateLeft, rotateRight, zoomIn, zoomOut])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (event: MouseEvent) => {
      event.preventDefault()
      setOffset({
        x: dragStartRef.current.offsetX + event.clientX - dragStartRef.current.x,
        y: dragStartRef.current.offsetY + event.clientY - dragStartRef.current.y,
      })
    }

    const handleMouseUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  if (!open || !imageUrl || typeof document === 'undefined') return null

  const title = filename || t('preview.imageTitle')

  const handleBlankMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    zoomBy(event.deltaY < 0 ? SCALE_STEP : 1 / SCALE_STEP)
  }

  const handleImageMouseDown = (event: React.MouseEvent<HTMLImageElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (scale <= 1) return

    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    }
    setIsDragging(true)
  }

  return createPortal(
    <div className="image-viewer-overlay nodrag nopan nowheel" onMouseDown={handleBlankMouseDown}>
      <div className="image-viewer-stage" onMouseDown={handleBlankMouseDown} onWheel={handleWheel}>
        <img
          className="image-viewer-image"
          src={imageUrl}
          alt={title}
          draggable={false}
          onMouseDown={handleImageMouseDown}
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
        />
      </div>

      <div
        className="image-viewer-toolbar"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="image-viewer-tool-btn" onClick={zoomOut} title={t('preview.zoomOut')} aria-label={t('preview.zoomOut')}>
          <ZoomOut size={18} />
        </button>
        <button type="button" className="image-viewer-tool-btn" onClick={zoomIn} title={t('preview.zoomIn')} aria-label={t('preview.zoomIn')}>
          <ZoomIn size={18} />
        </button>
        <button type="button" className="image-viewer-tool-btn" onClick={fitToWindow} title={t('preview.fitToWindow')} aria-label={t('preview.fitToWindow')}>
          <Maximize2 size={18} />
        </button>
        <button type="button" className="image-viewer-tool-btn" onClick={rotateLeft} title={t('preview.rotateLeft')} aria-label={t('preview.rotateLeft')}>
          <RotateCcw size={18} />
        </button>
        <button type="button" className="image-viewer-tool-btn" onClick={rotateRight} title={t('preview.rotateRight')} aria-label={t('preview.rotateRight')}>
          <RotateCw size={18} />
        </button>
      </div>
    </div>,
    document.body,
  )
}

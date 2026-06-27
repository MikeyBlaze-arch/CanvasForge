import React, { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { Modal } from './Modal'
import { useI18n } from '../i18n/useI18n'
import { useViewportSize } from '../hooks/useViewportSize'
import { calcMediaFitSize } from '../utils/mediaFit'

type Props = {
  open: boolean
  videoUrl?: string
  filename?: string
  width?: number
  height?: number
  duration?: number
  onClose: () => void
}

function formatDuration(duration?: number): string {
  if (duration == null || !Number.isFinite(duration) || duration <= 0) return ''
  const total = Math.floor(duration)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function VideoPreviewModal({ open, videoUrl, filename, width, height, duration, onClose }: Props) {
  const { t } = useI18n()
  const viewport = useViewportSize()
  const size = useMemo(() => {
    if (!open) return null
    return calcMediaFitSize({
      mediaWidth: width,
      mediaHeight: height,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      horizontalPadding: 48,
      verticalPadding: 48,
      reservedChromeHeight: 92,
      maxWidthRatio: 0.96,
      maxHeightRatio: 0.94,
      fallbackAspectRatio: 16 / 9,
      minWidth: 320,
      minHeight: 180,
    })
  }, [height, open, viewport.height, viewport.width, width])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open || !size) return null

  const hasResolution =
    width != null &&
    height != null &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  const resolution = hasResolution ? `${width} x ${height}` : ''
  const durationLabel = formatDuration(duration)
  const meta = [resolution, durationLabel].filter(Boolean).join(' - ')
  const stopNativeVideoFullscreen = (event: React.MouseEvent<HTMLVideoElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }
  const stopRepeatedMouseDown = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (event.detail < 2) return
    stopNativeVideoFullscreen(event)
  }

  return (
    <Modal open={open} onClose={onClose} className="media-preview-shell">
      <div className="media-preview-modal video-preview-modal nodrag nopan nowheel" style={{ width: size.width }}>
        <div className="media-preview-toolbar video-preview-header">
          <span className="media-preview-title" title={filename || t('preview.videoTitle')}>{filename || t('preview.videoTitle')}</span>
          <button type="button" className="media-preview-btn video-preview-close" onClick={onClose} aria-label={t('preview.close')} title={t('preview.close')}>
            <X size={16} />
          </button>
        </div>

        <div className="media-preview-stage" style={{ width: size.width, height: size.height }}>
          {videoUrl && (
            <video
              src={videoUrl}
              className="media-preview-video"
              controls
              controlsList="nofullscreen"
              autoPlay
              playsInline
              disablePictureInPicture
              onMouseDownCapture={stopRepeatedMouseDown}
              onDoubleClickCapture={stopNativeVideoFullscreen}
            />
          )}
        </div>

        <div className="media-preview-meta video-preview-meta">{meta || t('preview.fit')}</div>
      </div>
    </Modal>
  )
}

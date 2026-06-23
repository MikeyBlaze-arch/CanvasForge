import React, { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { Modal } from './Modal'
import { useI18n } from '../i18n/useI18n'

type Props = {
  open: boolean
  videoUrl?: string
  filename?: string
  width?: number
  height?: number
  duration?: number
  onClose: () => void
}

function getVideoPreviewSize(width?: number, height?: number) {
  if (typeof window === 'undefined') return { width: 720, height: 405 }

  const maxModalWidth = Math.min(window.innerWidth * 0.86, 1100)
  const maxModalHeight = window.innerHeight * 0.86
  const chromeHeight = 76
  const maxVideoHeight = Math.max(240, maxModalHeight - chromeHeight)
  const hasValidSize =
    width != null &&
    height != null &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  const aspectRatio = hasValidSize ? width / height : 16 / 9

  let videoWidth = maxModalWidth
  let videoHeight = videoWidth / aspectRatio

  if (videoHeight > maxVideoHeight) {
    videoHeight = maxVideoHeight
    videoWidth = videoHeight * aspectRatio
  }

  videoWidth = Math.max(220, videoWidth)
  videoHeight = Math.max(160, videoHeight)
  videoWidth = Math.min(videoWidth, maxModalWidth)
  videoHeight = Math.min(videoHeight, maxVideoHeight)

  return {
    width: Math.round(videoWidth),
    height: Math.round(videoHeight),
  }
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
  const size = useMemo(() => {
    if (!open) return null
    return getVideoPreviewSize(width, height)
  }, [open, width, height])

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
    <Modal open={open} onClose={onClose} className="video-preview-shell">
      <div className="video-preview-modal nodrag nopan nowheel" style={{ width: size.width }}>
        <div className="video-preview-header">
          <span>{filename || t('video.preview.title')}</span>
          <button type="button" className="video-preview-close" onClick={onClose} aria-label={t('video.preview.close')}>
            <X size={16} />
          </button>
        </div>

        {videoUrl && (
          <video
            src={videoUrl}
            controls
            controlsList="nofullscreen"
            autoPlay
            playsInline
            disablePictureInPicture
            style={{ width: size.width, height: size.height, objectFit: 'contain', background: '#000' }}
            onMouseDownCapture={stopRepeatedMouseDown}
            onDoubleClickCapture={stopNativeVideoFullscreen}
          />
        )}

        {meta && <div className="video-preview-meta">{meta}</div>}
      </div>
    </Modal>
  )
}

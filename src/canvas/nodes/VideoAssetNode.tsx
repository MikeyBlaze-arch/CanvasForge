import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { Download, Trash2, Upload, Video } from 'lucide-react'
import { NodeShell } from '../../components/NodeShell'
import { PortLabel } from '../../components/PortLabel'
import { VideoPreviewModal } from '../../components/VideoPreviewModal'
import { useNodeStore } from '../../store/nodeStore'
import type { LocalVideoOutput, VideoAssetNodeData } from '../nodeTypes'
import { calculateVideoNodeSize, resolveVideoSource } from '../videoFileUtils'
import { useI18n } from '../../i18n/useI18n'

export const VideoAssetNodeComponent = React.memo(function VideoAssetNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as VideoAssetNodeData
  const updateNodeData = useNodeStore((s) => s.updateNodeData)
  const updateNodeInternals = useUpdateNodeInternals()
  const fileRef = useRef<HTMLInputElement>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const { t } = useI18n()

  const source = useMemo(
    () => resolveVideoSource(d.output || d.video || d.videoUrl),
    [d.output, d.video, d.videoUrl],
  )
  const videoUrl = source?.url || ''
  const filename = source?.filename || d.fileName
  const naturalWidth = source?.width ?? d.naturalWidth
  const naturalHeight = source?.height ?? d.naturalHeight
  const duration = source?.duration ?? d.duration
  const nodeSize = useMemo(
    () => calculateVideoNodeSize(naturalWidth, naturalHeight),
    [naturalWidth, naturalHeight],
  )
  const nodeWidth = videoUrl ? nodeSize.width : 240
  const previewHeight = nodeSize.height

  const updateNodeSize = useCallback(
    (width: number) => {
      const state = useNodeStore.getState()
      state.setNodes(state.nodes.map((node) => {
        if (node.id !== id) return node
        const nextStyle = { ...node.style, width }
        if (node.style?.width === width) return node
        return { ...node, style: nextStyle }
      }))
      requestAnimationFrame(() => updateNodeInternals(id))
    },
    [id, updateNodeInternals],
  )

  useEffect(() => {
    if (videoUrl) {
      updateNodeSize(nodeWidth)
      return
    }
    requestAnimationFrame(() => updateNodeInternals(id))
  }, [id, nodeWidth, previewHeight, updateNodeInternals, updateNodeSize, videoUrl])

  const handleLoadedMetadata = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = event.currentTarget
      const videoWidth = video.videoWidth
      const videoHeight = video.videoHeight
      const videoDuration = Number.isFinite(video.duration) ? video.duration : undefined
      const size = calculateVideoNodeSize(videoWidth, videoHeight)

      const patchVideoOutput = (value?: LocalVideoOutput): LocalVideoOutput | undefined => {
        if (!value) return undefined
        return {
          ...value,
          url: value.url || videoUrl,
          previewUrl: value.previewUrl || videoUrl,
          width: videoWidth,
          height: videoHeight,
          duration: videoDuration,
        }
      }

      const patch: Partial<VideoAssetNodeData> = {
        videoUrl,
        naturalWidth: videoWidth,
        naturalHeight: videoHeight,
        duration: videoDuration,
        previewWidth: size.width,
        previewHeight: size.height,
        updatedAt: Date.now(),
      }
      const nextVideo = patchVideoOutput(d.video)
      const nextOutput = patchVideoOutput(d.output)
      if (nextVideo) patch.video = nextVideo
      if (nextOutput) patch.output = nextOutput

      const changed =
        d.videoUrl !== videoUrl ||
        d.naturalWidth !== videoWidth ||
        d.naturalHeight !== videoHeight ||
        d.duration !== videoDuration ||
        d.previewWidth !== size.width ||
        d.previewHeight !== size.height

      if (changed) updateNodeData(id, patch)
      updateNodeSize(size.width)
    },
    [d.duration, d.naturalHeight, d.naturalWidth, d.output, d.previewHeight, d.previewWidth, d.video, d.videoUrl, id, updateNodeData, updateNodeSize, videoUrl],
  )

  const handleFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const url = URL.createObjectURL(file)
      const probe = document.createElement('video')
      probe.preload = 'metadata'
      probe.onloadedmetadata = () => {
        const width = probe.videoWidth
        const height = probe.videoHeight
        const durationValue = Number.isFinite(probe.duration) ? probe.duration : 0
        const size = calculateVideoNodeSize(width, height)
        const output: LocalVideoOutput = {
          type: 'video',
          file,
          url,
          previewUrl: url,
          filename: file.name,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          width,
          height,
          duration: durationValue,
          source: 'local',
        }
        updateNodeData(id, {
          videoUrl: url,
          originalVideoUrl: url,
          downloadUrl: url,
          video: output,
          output,
          fileName: file.name,
          mimeType: file.type,
          naturalWidth: width,
          naturalHeight: height,
          duration: durationValue,
          previewWidth: size.width,
          previewHeight: size.height,
          sourceType: 'upload',
          role: 'source',
          updatedAt: Date.now(),
        } as Partial<VideoAssetNodeData>)
        updateNodeSize(size.width)
      }
      probe.onerror = () => {
        URL.revokeObjectURL(url)
      }
      probe.src = url
      event.target.value = ''
    },
    [id, updateNodeData, updateNodeSize],
  )

  const handleClear = useCallback(() => {
    if (videoUrl.startsWith('blob:')) URL.revokeObjectURL(videoUrl)
    updateNodeData(id, {
      videoUrl: '',
      originalVideoUrl: undefined,
      downloadUrl: undefined,
      video: undefined,
      output: undefined,
      fileName: undefined,
      previewWidth: undefined,
      previewHeight: undefined,
      updatedAt: Date.now(),
    } as Partial<VideoAssetNodeData>)
    setPreviewOpen(false)
    updateNodeSize(240)
  }, [id, updateNodeData, updateNodeSize, videoUrl])

  const handleDownload = useCallback(() => {
    const src = d.downloadUrl || d.originalVideoUrl || videoUrl
    if (!src) return
    if (src.startsWith('blob:') || src.startsWith('data:')) {
      const anchor = document.createElement('a')
      anchor.href = src
      anchor.download = filename || 'video.mp4'
      anchor.click()
      return
    }
    fetch(src)
      .then((response) => response.blob())
      .then((blob) => {
        const anchor = document.createElement('a')
        anchor.href = URL.createObjectURL(blob)
        anchor.download = filename || 'video.mp4'
        anchor.click()
        URL.revokeObjectURL(anchor.href)
      })
      .catch(() => {
        window.open(src, '_blank')
      })
  }, [d.downloadUrl, d.originalVideoUrl, filename, videoUrl])

  const openPreviewFromDoubleClick = useCallback((event: React.MouseEvent) => {
    if (!videoUrl) return
    event.preventDefault()
    event.stopPropagation()
    setPreviewOpen(true)
  }, [videoUrl])

  const handleVideoMouseDownCapture = useCallback((event: React.MouseEvent<HTMLVideoElement>) => {
    if (event.detail < 2) return
    if (!videoUrl) return
    event.preventDefault()
    event.stopPropagation()
    setPreviewOpen(true)
  }, [videoUrl])

  const handleVideoDoubleClickCapture = useCallback((event: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoUrl) return
    event.preventDefault()
    event.stopPropagation()
    setPreviewOpen(true)
  }, [videoUrl])

  const dims = naturalWidth && naturalHeight ? `${naturalWidth} x ${naturalHeight}` : ''
  const dur = duration ? `${Math.floor(duration)}s` : ''

  return (
    <NodeShell nodeType="video_asset" title={`${t('video.title')}${dims ? ` - ${dims}` : ''}${dur ? ` - ${dur}` : ''}`} selected={!!selected} width={nodeWidth}>
      {videoUrl ? (
        <div
          className="video-node-preview-wrap"
          style={{ height: previewHeight }}
          onWheel={(event) => event.stopPropagation()}
          onDoubleClickCapture={openPreviewFromDoubleClick}
        >
          <video
            src={videoUrl}
            className="video-node-video nodrag nopan nowheel"
            controls
            controlsList="nofullscreen"
            preload="metadata"
            playsInline
            disablePictureInPicture
            onLoadedMetadata={handleLoadedMetadata}
            onMouseDownCapture={handleVideoMouseDownCapture}
            onDoubleClickCapture={handleVideoDoubleClickCapture}
          />
          <div className="video-node-actions nodrag nopan nowheel">
            <button type="button" className="image-node-overlay-btn" onClick={(event) => { event.stopPropagation(); fileRef.current?.click() }} title={t('imageNode.replace')}>
              <Upload size={13} />
            </button>
            <button type="button" className="image-node-overlay-btn" onClick={(event) => { event.stopPropagation(); handleDownload() }} title={t('imageNode.download')}>
              <Download size={13} />
            </button>
            <button type="button" className="image-node-overlay-btn" onClick={(event) => { event.stopPropagation(); handleClear() }} title={t('imageNode.remove')}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div className="image-node-placeholder" onClick={() => fileRef.current?.click()}>
          <Video size={28} strokeWidth={1.2} />
          <span style={{ fontSize: 11 }}>{t('video.clickToUpload')}</span>
        </div>
      )}

      <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleFile} />

      <VideoPreviewModal
        open={previewOpen}
        videoUrl={videoUrl}
        filename={filename}
        width={naturalWidth}
        height={naturalHeight}
        duration={duration}
        onClose={() => setPreviewOpen(false)}
      />

      <div className="node-ports">
        <div className="node-port-group">
          <PortLabel type="target" id="main_input" mode="main" />
          <PortLabel type="target" id="video_input" mode="semantic" />
        </div>
        <div className="node-port-group">
          <PortLabel type="source" id="main_output" mode="main" />
          <PortLabel type="source" id="video_output" mode="semantic" />
          <PortLabel type="source" id="source_video" mode="semantic" />
          <PortLabel type="source" id="motion_video" mode="semantic" />
        </div>
      </div>
    </NodeShell>
  )
})

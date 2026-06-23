import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Film, Image as ImageIcon, Play } from 'lucide-react'
import { NodeShell } from '../../components/NodeShell'
import { PortLabel } from '../../components/PortLabel'
import { CompactSelect } from '../../components/Select'
import { useNodeStore, createNodeId } from '../../store/nodeStore'
import { useEdgeStore } from '../../store/edgeStore'
import type { VideoAssetNodeData, VideoGenNodeData, LocalVideoOutput } from '../nodeTypes'
import {
  VIDEO_MODEL_REGISTRY,
  clampVideoDuration,
  getVideoModelById,
  normalizeVideoAspectRatio,
  normalizeVideoModelId,
  normalizeVideoSize,
} from '../../generation/videoModelRegistry'
import { buildVideoGenerationPayload } from '../../generation/videoPayloadBuilder'
import {
  runVideoGeneration,
  VideoGenerationError,
  type VideoStatusUpdate,
} from '../../generation/videoGenerationApi'
import { calculateVideoNodeSize } from '../videoFileUtils'
import { getVideoGenInputs } from '../nodeHelpers'
import { useI18n } from '../../i18n/useI18n'
import { useHistoryStore } from '../../store/historyStore'
import { useProjectStore } from '../../store/projectStore'

const FPS_PRESETS = [24, 30] as const

export const VideoGenNodeComponent = React.memo(function VideoGenNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as VideoGenNodeData
  const updateNodeData = useNodeStore((s) => s.updateNodeData)
  const addNode = useNodeStore((s) => s.addNode)
  const nodes = useNodeStore((s) => s.nodes)
  const edges = useEdgeStore((s) => s.edges)
  const addEdge = useEdgeStore((s) => s.addEdge)
  const markDirty = useProjectStore((s) => s.markDirty)
  const { t } = useI18n()

  const [promptInput, setPromptInput] = useState(d.promptInput ?? '')
  const isComposingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const runIdRef = useRef<string | null>(null)

  const setField = useCallback(
    (patch: Partial<VideoGenNodeData>) => {
      updateNodeData(id, { ...patch, updatedAt: Date.now() } as Partial<VideoGenNodeData>)
    },
    [id, updateNodeData],
  )

  useEffect(() => {
    if (!isComposingRef.current) {
      setPromptInput(d.promptInput ?? '')
    }
  }, [d.promptInput])

  // Stop any in-flight polling when the node is unmounted (deleted / canvas cleared).
  useEffect(() => () => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const commitPromptInput = useCallback(
    (value = promptInput) => {
      if ((d.promptInput ?? '') !== value) {
        setField({ promptInput: value })
      }
    },
    [d.promptInput, promptInput, setField],
  )

  const currentModel = getVideoModelById(d.modelId) ?? VIDEO_MODEL_REGISTRY[0]

  const handleModelChange = useCallback(
    (newModelId: string) => {
      const model = getVideoModelById(newModelId) ?? VIDEO_MODEL_REGISTRY[0]
      const aspectRatio = normalizeVideoAspectRatio(d.aspectRatio, model.allowedAspectRatios)
      const size = normalizeVideoSize(d.size, model.allowedSizes)
      const duration = clampVideoDuration(model, d.duration)
      setField({
        modelId: model.id,
        backendModel: model.backendModel,
        modelLabel: model.label,
        aspectRatio,
        size,
        duration,
      })
    },
    [d.aspectRatio, d.size, d.duration, setField],
  )

  /**
   * Write a generated video to connected VideoAssetNodes, or auto-create one
   * on the right and wire it up. Mirrors MotionTransferNode's output handling.
   */
  const writeResultToVideoAssetNodes = useCallback(
    (
      videoUrl: string,
      width: number,
      height: number,
      duration: number | undefined,
      taskId: string,
      statusResponse: unknown,
    ) => {
      const outputSize = calculateVideoNodeSize(width, height)
      const filename = `${currentModel.label || 'video'}-${taskId}.mp4`
      const outputVideo: LocalVideoOutput = {
        type: 'video',
        url: videoUrl,
        previewUrl: videoUrl,
        filename,
        name: filename,
        mimeType: 'video/mp4',
        width,
        height,
        duration,
        source: 'generated',
        raw: statusResponse,
      }

      const existingOutputNodeIds = edges
        .filter((edge) => edge.source === id && edge.sourceHandle === 'video' && edge.targetHandle === 'video_input')
        .map((edge) => edge.target)
        .filter((targetId) => {
          const targetNode = nodes.find((node) => node.id === targetId)
          return targetNode && (targetNode.data as { nodeType?: string }).nodeType === 'video_asset'
        })

      if (existingOutputNodeIds.length > 0) {
        existingOutputNodeIds.forEach((targetId) => {
          updateNodeData(targetId, {
            videoUrl,
            originalVideoUrl: videoUrl,
            downloadUrl: videoUrl,
            video: outputVideo,
            output: outputVideo,
            fileName: filename,
            naturalWidth: width,
            naturalHeight: height,
            duration,
            previewWidth: outputSize.width,
            previewHeight: outputSize.height,
            role: 'output',
            sourceNodeId: id,
            sourceType: 'generated',
            updatedAt: Date.now(),
          } as Partial<VideoAssetNodeData>)
        })
        return
      }

      const sourceNode = nodes.find((n) => n.id === id)
      const newNodeId = createNodeId()
      addNode({
        id: newNodeId,
        type: 'video_asset',
        position: {
          x: (sourceNode?.position.x ?? 0) + 380,
          y: sourceNode?.position.y ?? 0,
        },
        data: {
          nodeType: 'video_asset',
          title: t('videoGen.resultTitle'),
          videoUrl,
          originalVideoUrl: videoUrl,
          downloadUrl: videoUrl,
          video: outputVideo,
          output: outputVideo,
          fileName: filename,
          naturalWidth: width,
          naturalHeight: height,
          duration,
          previewWidth: outputSize.width,
          previewHeight: outputSize.height,
          role: 'output',
          sourceNodeId: id,
          sourceType: 'generated',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } satisfies VideoAssetNodeData,
      })

      addEdge({
        id: '',
        source: id,
        sourceHandle: 'video',
        target: newNodeId,
        targetHandle: 'video_input',
        type: 'canvas',
      })
    },
    [id, currentModel.label, edges, nodes, addNode, addEdge, updateNodeData, t],
  )

  const handleGenerate = useCallback(async () => {
    // Re-entrance guard: never start a second task while one is running.
    if (d.status === 'submitting' || d.status === 'queued' || d.status === 'polling') return

    // Cancel any previous polling, then start a fresh run.
    abortRef.current?.abort()
    const controller = new AbortController()
    const runId = 'vrun_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
    runIdRef.current = runId

    // Gather inputs (prompt + reference image).
    const statusInputs = getVideoGenInputs(id, nodes, edges)
    const hasConnectedTextInput = statusInputs.connectedPromptNodeCount > 0
    if (!hasConnectedTextInput) {
      commitPromptInput(promptInput)
    }
    const inputs = getVideoGenInputs(id, nodes, edges, hasConnectedTextInput ? '' : promptInput)

    if (!inputs.prompt.trim()) {
      setField({ status: 'failed', error: t('videoGen.error.promptRequired') })
      runIdRef.current = null
      return
    }

    const model = getVideoModelById(d.modelId) ?? VIDEO_MODEL_REGISTRY[0]
    if (inputs.imageUrl && !model.supportsImageInput) {
      setField({ status: 'failed', error: t('videoGen.error.imageUnsupported') })
      runIdRef.current = null
      return
    }

    setField({
      status: 'submitting',
      error: undefined,
      taskId: undefined,
      progress: undefined,
      lastGeneratedVideoUrl: undefined,
      lastStatusResponse: undefined,
      inputImageUrl: inputs.imageUrl,
      lastPrompt: inputs.prompt,
    })

    const payload = buildVideoGenerationPayload({
      model,
      prompt: inputs.prompt,
      image: inputs.imageUrl,
      aspectRatio: d.aspectRatio,
      size: d.size,
      duration: clampVideoDuration(model, d.duration),
      fps: d.fps,
      seed: d.seed,
    })

    const cleanPayload = { ...payload }
    delete (cleanPayload as { _meta?: unknown })._meta

    try {
      const onStatus = (update: VideoStatusUpdate) => {
        if (runIdRef.current !== runId) return
        if (update.phase === 'queued') {
          setField({ status: 'queued', progress: update.progress, lastStatusResponse: update.raw })
        } else if (update.phase === 'polling') {
          setField({ status: 'polling', progress: update.progress, lastStatusResponse: update.raw })
        }
      }

      const result = await runVideoGeneration({
        payload,
        signal: controller.signal,
        onStatus,
      })

      if (runIdRef.current !== runId) return

      writeResultToVideoAssetNodes(
        result.videoUrl,
        result.width,
        result.height,
        result.duration,
        result.taskId,
        result.raw,
      )

      if (runIdRef.current !== runId) return

      setField({
        status: 'success',
        taskId: result.taskId,
        lastGeneratedVideoUrl: result.videoUrl,
        lastOutputWidth: result.width,
        lastOutputHeight: result.height,
        lastOutputDuration: result.duration,
        lastRequestPayload: cleanPayload,
        lastStatusResponse: result.raw,
        error: undefined,
      })

      // Write to history (success only — failures never reach here).
      try {
        useHistoryStore.getState().addRecord({
          id: 'hist_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
          type: 'video',
          status: 'success',
          sourceNodeId: id,
          modelSeries: 'C',
          modelId: model.id,
          modelLabel: model.label,
          backendModel: model.backendModel,
          promptSnapshot: inputs.prompt,
          prompt: inputs.prompt,
          videoUrl: result.videoUrl,
          url: result.videoUrl,
          thumbnailUrl: undefined,
          naturalWidth: result.width,
          naturalHeight: result.height,
          width: result.width,
          height: result.height,
          duration: result.duration,
          aspectRatio: d.aspectRatio,
          resolution: d.size,
          finalSize: `${result.width}×${result.height}`,
          createdAt: Date.now(),
        })
      } catch { /* non-critical */ }

      markDirty()

      // Auto-reset to idle so the button returns to a re-generate state.
      setTimeout(() => {
        if (runIdRef.current === runId) {
          runIdRef.current = null
          setField({ status: 'idle' })
        }
      }, 1500)
    } catch (err: unknown) {
      if (controller.signal.aborted) return // superseded by a newer run or unmounted
      if (runIdRef.current !== runId) return

      const msg = err instanceof VideoGenerationError && err.message === 'MISSING_API_KEY'
        ? t('videoGen.error.missingApiKey')
        : err instanceof VideoGenerationError && err.message === 'MISSING_API_BASE_URL'
          ? t('videoGen.error.missingApiBaseUrl')
          : err instanceof Error
            ? err.message
            : String(err)

      console.error('[VideoGen] Generation error:', msg)
      setField({
        status: 'failed',
        error: msg,
        lastRequestPayload: cleanPayload,
      })
      runIdRef.current = null
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [id, d.status, d.modelId, d.aspectRatio, d.size, d.duration, d.fps, d.seed, nodes, edges, promptInput, setField, commitPromptInput, writeResultToVideoAssetNodes, markDirty, t])

  const inputs = getVideoGenInputs(id, nodes, edges)
  const promptConnected = inputs.connectedPromptNodeCount > 0
  const imageConnected = inputs.connectedImageNodeCount > 0

  const isRunning = d.status === 'submitting' || d.status === 'queued' || d.status === 'polling'

  const statusLabel = (() => {
    switch (d.status) {
      case 'submitting': return t('videoGen.submitting')
      case 'queued': return t('videoGen.queued')
      case 'polling': return t('videoGen.polling')
      case 'success': return t('videoGen.success')
      case 'failed': return t('videoGen.failed')
      default: return ''
    }
  })()

  const getButtonLabel = () => {
    if (isRunning) return statusLabel
    if (d.status === 'failed') return t('videoGen.retry')
    if (d.status === 'success' || d.lastGeneratedVideoUrl) return t('videoGen.regenerate')
    return t('videoGen.generate')
  }

  return (
    <NodeShell
      nodeType="video_gen"
      title={t('node.videoGen')}
      selected={!!selected}
      status={d.status}
      width={290}
      actions={
        <button
          className={`node-btn primary ${d.status === 'failed' ? 'node-btn-failed' : ''}`}
          onClick={handleGenerate}
          disabled={isRunning}
        >
          <Play size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {getButtonLabel()}
        </button>
      }
    >
      {/* Model select */}
      <div className="node-field">
        <CompactSelect
          value={currentModel.id}
          onChange={(value) => handleModelChange(value)}
          options={VIDEO_MODEL_REGISTRY.map((m) => ({ value: m.id, label: m.label }))}
        />
      </div>

      {/* Aspect ratio + size */}
      <div className="node-row">
        <div className="node-field">
          <CompactSelect
            value={d.aspectRatio}
            onChange={(value) => setField({ aspectRatio: value as VideoGenNodeData['aspectRatio'] })}
            options={currentModel.allowedAspectRatios.map((ratio) => ({ value: ratio, label: ratio }))}
          />
        </div>
        <div className="node-field">
          <CompactSelect
            value={d.size}
            onChange={(value) => setField({ size: value as VideoGenNodeData['size'] })}
            options={currentModel.allowedSizes.map((size) => ({ value: size, label: size }))}
          />
        </div>
      </div>

      {/* Duration + fps */}
      <div className="node-row">
        <div className="node-field">
          <CompactSelect
            value={String(d.duration)}
            onChange={(value) => setField({ duration: Number(value) })}
            options={currentModel.allowedDurations.map((dur) => ({ value: String(dur), label: `${dur}s` }))}
          />
        </div>
        <div className="node-field">
          <CompactSelect
            value={String(d.fps ?? 24)}
            onChange={(value) => setField({ fps: Number(value) })}
            options={FPS_PRESETS.map((fps) => ({ value: String(fps), label: `${fps}fps` }))}
          />
        </div>
      </div>

      {/* Seed (optional) */}
      <div className="node-row">
        <div className="node-field" style={{ flex: 1 }}>
          <div className="node-field-label">{t('videoGen.seed')}</div>
          <input
            type="number"
            value={d.seed ?? ''}
            placeholder="-"
            onChange={(e) => {
              const raw = e.target.value
              setField({ seed: raw === '' ? undefined : Number(raw) })
            }}
            className="cf-textarea nodrag nopan nowheel"
            style={{ width: '100%', fontSize: 11, padding: '3px 6px' }}
            onWheelCapture={(e) => { e.stopPropagation(); e.preventDefault() }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      <div className="divider" />

      {/* Prompt textarea — hidden when a text node supplies the prompt */}
      {!promptConnected && (
        <textarea
          rows={3}
          value={promptInput}
          onChange={(event) => setPromptInput(event.target.value)}
          onBlur={() => commitPromptInput()}
          onCompositionStart={() => { isComposingRef.current = true }}
          onCompositionEnd={(event) => {
            isComposingRef.current = false
            setPromptInput(event.currentTarget.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) handleGenerate()
          }}
          placeholder={t('videoGen.promptPlaceholder')}
          className="cf-textarea node-prompt-textarea nodrag nopan"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        />
      )}

      {/* Connection status */}
      <div style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--field-bg)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)' }}>{t('videoGen.promptPort')}</span>
          <b style={{ color: promptConnected ? 'var(--accent-green)' : 'var(--text-muted)' }}>
            {promptConnected ? t('videoGen.connected') : t('videoGen.notConnected')}
          </b>
        </div>
        <div style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--field-bg)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ImageIcon size={10} />
          <span style={{ color: 'var(--text-muted)' }}>{t('videoGen.imagePort')}</span>
          <b style={{ color: imageConnected ? 'var(--accent-green)' : 'var(--text-muted)' }}>
            {imageConnected ? t('videoGen.connected') : t('videoGen.imageOptional')}
          </b>
        </div>
      </div>

      {/* Running status / progress */}
      {isRunning && (
        <div style={{
          fontSize: 10, padding: '3px 8px', borderRadius: 4,
          background: 'var(--field-bg)', border: '1px solid var(--border-primary)',
          color: 'var(--text-secondary)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{statusLabel}</span>
          {typeof d.progress === 'number' && d.progress > 0 && (
            <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--text-muted)' }}>
              {Math.round(d.progress)}%
            </span>
          )}
        </div>
      )}

      {/* Error display (no raw response, no debug panel) */}
      {d.error && (
        <div style={{ color: 'var(--accent-red)', fontSize: 10, padding: '4px 0', wordBreak: 'break-word' }}>
          {d.error}
        </div>
      )}

      {/* Success preview hint */}
      {d.status === 'success' && d.lastGeneratedVideoUrl && (
        <div style={{
          fontSize: 10, padding: '4px 8px', borderRadius: 6,
          background: 'var(--field-bg)', border: '1px solid var(--border-primary)',
          color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Film size={11} />
          <span>{t('videoGen.generated')}</span>
        </div>
      )}

      {/* Ports — main handles visible, semantic handles invisible */}
      <div className="node-ports">
        <div className="node-port-group">
          <PortLabel type="target" id="main_input" mode="main" />
          <PortLabel type="target" id="prompt" mode="semantic" />
          <PortLabel type="target" id="image" mode="semantic" />
        </div>
        <div className="node-port-group">
          <PortLabel type="source" id="main_output" mode="main" />
          <PortLabel type="source" id="video" mode="semantic" />
        </div>
      </div>
    </NodeShell>
  )
})

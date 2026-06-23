import React, { useCallback, useRef, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Move, Play, Image, ChevronDown, ChevronRight, Bug, Activity, Power, RefreshCw } from 'lucide-react'
import { NodeShell } from '../../components/NodeShell'
import { PortLabel } from '../../components/PortLabel'
import { CompactSelect } from '../../components/Select'
import { useNodeStore, createNodeId } from '../../store/nodeStore'
import { useEdgeStore } from '../../store/edgeStore'
import type { LocalVideoOutput, MotionTransferNodeData, MotionTransferPhase, VideoAssetNodeData, ImageAssetNodeData, ServiceStatusCache } from '../nodeTypes'
import { runMotionTransfer, normalizeMotionTransferError, MOTION_TRANSFER_WORKFLOW_ID, type WorkflowFileCache } from '../../generation/motionTransferApi'
import { calculateVideoNodeSize } from '../videoFileUtils'
import { useI18n } from '../../i18n/useI18n'
import { useHistoryStore } from '../../store/historyStore'
import { useProjectStore } from '../../store/projectStore'
import { useRemoteServiceStore } from '../../store/remoteServiceStore'
import {
  getZealmanBaseUrl,
  checkAllServices,
  checkPanelHealth,
  startComfy,
  waitForComfyReady,
} from '../../services/zealmanClient'
import type { ServiceStatusSnapshot } from '../../services/zealmanClient'

function getVideoInputValue(data: VideoAssetNodeData | null): unknown {
  return data?.output || data?.video || data?.videoUrl || ''
}

function getImageInputValue(data: ImageAssetNodeData | null): unknown {
  return data?.output || data?.image || data?.imageUrl || ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

export const MotionTransferNodeComponent = React.memo(function MotionTransferNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as MotionTransferNodeData
  const updateNodeData = useNodeStore((s) => s.updateNodeData)
  const nodes = useNodeStore((s) => s.nodes)
  const edges = useEdgeStore((s) => s.edges)
  const addNode = useNodeStore((s) => s.addNode)
  const addEdge = useEdgeStore((s) => s.addEdge)
  const markDirty = useProjectStore((s) => s.markDirty)
  const { t } = useI18n()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  const [serviceOpen, setServiceOpen] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [startingComfy, setStartingComfy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // ── Settings from store ────────────────────────────────────────────────
  const zealmanBaseUrl = useRemoteServiceStore((s) => s.zealmanBaseUrl)
  const autoStartComfy = useRemoteServiceStore((s) => s.autoStartComfy)
  const setAutoStartComfy = useRemoteServiceStore((s) => s.setAutoStartComfy)
  const setGlobalServiceStatus = useRemoteServiceStore((s) => s.setServiceStatus)

  const baseUrl = getZealmanBaseUrl(zealmanBaseUrl || undefined)

  // ── Edge lookups ────────────────────────────────────────────────────────
  const videoEdge = edges.find((e) => e.target === id && e.targetHandle === 'motion_video')
  const imageEdge = edges.find((e) => e.target === id && e.targetHandle === 'source_image')

  const videoNode = videoEdge ? nodes.find((n) => n.id === videoEdge.source) : null
  const imageNode = imageEdge ? nodes.find((n) => n.id === imageEdge.source) : null

  const videoData = videoNode ? (videoNode.data as unknown as VideoAssetNodeData) : null
  const imageData = imageNode ? (imageNode.data as unknown as ImageAssetNodeData) : null

  const hasVideoValue = Boolean(getVideoInputValue(videoData))
  const hasImageValue = Boolean(getImageInputValue(imageData))
  const hasVideoEdge = Boolean(videoEdge)
  const hasImageEdge = Boolean(imageEdge)

  const setField = useCallback(
    (patch: Partial<MotionTransferNodeData>) => {
      updateNodeData(id, { ...patch, updatedAt: Date.now() } as Partial<MotionTransferNodeData>)
    },
    [id, updateNodeData],
  )

  // ── Connection status labels ────────────────────────────────────────────
  const videoStatusLabel = (() => {
    if (!hasVideoEdge) return { text: t('motion.notConnected'), color: 'var(--text-muted)' }
    if (!hasVideoValue) return { text: t('motion.connectedNoData'), color: 'var(--accent-orange)' }
    return { text: t('motion.connected'), color: 'var(--accent-green)' }
  })()

  const imageStatusLabel = (() => {
    if (!hasImageEdge) return { text: t('motion.notConnected'), color: 'var(--text-muted)' }
    if (!hasImageValue) return { text: t('motion.connectedNoData'), color: 'var(--accent-orange)' }
    return { text: t('motion.connected'), color: 'var(--accent-green)' }
  })()

  // ── Service status helpers ──────────────────────────────────────────────
  const ss = d.serviceStatus
  const panelOk = ss?.panelOk === true
  const panelFailed = ss?.panelOk === false
  const panelUnknown = ss?.panelOk == null

  const panelLabel = panelUnknown ? t('motion.svcNotDetected')
    : panelOk ? t('motion.svcOk') : t('motion.svcError')
  const panelColor = panelUnknown ? 'var(--text-muted)' : panelOk ? 'var(--accent-green)' : 'var(--accent-red)'

  const gpuLabel = panelFailed ? t('motion.svcNotDetected')
    : ss?.gpuHas == null ? t('motion.svcNotDetected')
    : ss.gpuHas ? (ss.gpuName || t('motion.gpuAvailable')) : t('motion.gpuUnknown')
  const gpuColor = panelFailed ? 'var(--text-muted)'
    : ss?.gpuHas == null ? 'var(--text-muted)'
    : ss.gpuHas ? 'var(--accent-green)' : 'var(--accent-orange)'

  const comfyLabel = panelFailed ? t('motion.svcNotDetected')
    : ss?.comfyRunning ? t('motion.comfyReady')
    : ss?.comfyStarting ? t('motion.comfyStarting')
    : ss?.checkedAt ? t('motion.comfyStopped') : t('motion.svcNotDetected')
  const comfyColor = panelFailed ? 'var(--text-muted)'
    : ss?.comfyRunning ? 'var(--accent-green)'
    : ss?.comfyStarting ? 'var(--accent-orange)'
    : 'var(--text-muted)'

  const wfLabel = panelFailed ? t('motion.svcNotDetected')
    : ss?.workflowFound === true ? t('motion.workflowFound')
    : ss?.workflowFound === false ? t('motion.workflowNotFound')
    : t('motion.svcNotDetected')
  const wfColor = panelFailed ? 'var(--text-muted)'
    : ss?.workflowFound === true ? 'var(--accent-green)'
    : ss?.workflowFound === false ? 'var(--accent-red)'
    : 'var(--text-muted)'

  const isRunning = d.status === 'running'

  // ── Detect services ─────────────────────────────────────────────────────
  const handleDetect = useCallback(async () => {
    setDetecting(true)
    try {
      const status = await checkAllServices(baseUrl)
      const cache: ServiceStatusCache = {
        panelOk: status.panel?.ok ?? null,
        gpuHas: status.gpu?.hasGpu ?? null,
        gpuName: status.gpu?.name || undefined,
        comfyRunning: status.comfy?.running ?? null,
        comfyStarting: status.comfy?.starting ?? null,
        workflowFound: status.workflow?.found ?? null,
        checkedAt: status.checkedAt,
      }
      setField({ serviceStatus: cache })
      setGlobalServiceStatus(status)
    } catch (err) {
      console.error('[MotionTransfer] detect failed', err)
    } finally {
      setDetecting(false)
    }
  }, [baseUrl, setField, setGlobalServiceStatus])

  // ── Start ComfyUI manually ──────────────────────────────────────────────
  const handleStartComfy = useCallback(async () => {
    setStartingComfy(true)
    try {
      const health = await checkPanelHealth(baseUrl)
      if (!health.ok) {
        setField({ error: t('motion.panelUnavailable') })
        return
      }
      await startComfy(baseUrl)
      await waitForComfyReady(baseUrl, { intervalMs: 3000, timeoutMs: 120000 })
      setField({
        serviceStatus: {
          ...d.serviceStatus,
          comfyRunning: true,
          comfyStarting: false,
          checkedAt: Date.now(),
        },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[MotionTransfer] start ComfyUI failed', err)
      setField({ error: msg })
    } finally {
      setStartingComfy(false)
    }
  }, [baseUrl, d.serviceStatus, setField, t])

  // ── Abort handler ───────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setField({ status: 'failed', phase: 'error', phaseLabel: t('motion.stoppedWaiting'), error: t('motion.stoppedWaiting') })
  }, [setField, t])

  // ── Main execution ──────────────────────────────────────────────────────
  const handleTransfer = useCallback(async () => {
    if (isRunning) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setField({
      status: 'running',
      phase: 'idle',
      phaseLabel: '',
      error: undefined,
      outputVideoUrl: undefined,
      output: undefined,
      promptId: undefined,
      debugBaseUrl: undefined,
      debugGenerateResponse: undefined,
      debugResultResponse: undefined,
      debugHistoryResponse: undefined,
      debugRawVideoInput: undefined,
      debugRawVideoInputType: undefined,
      debugRawVideoInputKeys: undefined,
      debugRawVideoHasFile: undefined,
      debugRawVideoUrl: undefined,
      debugRawVideoMessage: undefined,
      debugVideoUploadResponse: undefined,
      debugResolvedVideo: undefined,
      debugRawImageInput: undefined,
      debugRawImageInputType: undefined,
      debugRawImageInputKeys: undefined,
      debugRawImageHasFile: undefined,
      debugRawImageUrl: undefined,
      debugRawImageMessage: undefined,
      debugImageUploadResponse: undefined,
      debugResolvedImage: undefined,
      debugInputValues: undefined,
      debugExtractedVideo: undefined,
      debugVideoUrl: undefined,
      debugError: undefined,
    })

    try {
      const result = await runMotionTransfer({
        sourceVideo: getVideoInputValue(videoData),
        targetImage: getImageInputValue(imageData),
        mode: d.mode || 1,
        resolution: d.resolution || 720,
        param265: d.param265 ?? 1.0000000000000002,
        param266: d.param266 ?? 0.20000000000000004,
        param271: d.param271 ?? false,
        param297: d.param297 ?? 1.0000000000000002,
        param300: d.param300 ?? 840,
        param361: d.param361 ?? 1.0000000000000002,
        param370: d.param370 ?? false,
        signal: controller.signal,
        baseUrlOverride: zealmanBaseUrl || undefined,
        onPhaseChange: (phase: MotionTransferPhase, detail?: string) => {
          setField({ phase, phaseLabel: detail || phase })
        },
        onServiceStatus: (status: ServiceStatusSnapshot) => {
          const cache: ServiceStatusCache = {
            panelOk: status.panel?.ok ?? null,
            gpuHas: status.gpu?.hasGpu ?? null,
            gpuName: status.gpu?.name || undefined,
            comfyRunning: status.comfy?.running ?? null,
            comfyStarting: status.comfy?.starting ?? null,
            workflowFound: status.workflow?.found ?? null,
            checkedAt: status.checkedAt,
          }
          setField({ serviceStatus: cache })
        },
        onDebugInfo: (info) => {
          setField({
            debugBaseUrl: info.baseUrl,
            debugGenerateResponse: info.generateResponse,
            debugResultResponse: info.resultResponse,
            debugHistoryResponse: info.historyResponse,
            debugRawVideoInput: info.rawVideoInput,
            debugRawVideoInputType: info.rawVideoInputType,
            debugRawVideoInputKeys: info.rawVideoInputKeys,
            debugRawVideoHasFile: info.rawVideoHasFile,
            debugRawVideoUrl: info.rawVideoUrl,
            debugRawVideoMessage: info.rawVideoMessage,
            debugVideoUploadResponse: info.videoUploadResponse,
            debugResolvedVideo: info.resolvedVideo,
            debugRawImageInput: info.rawImageInput,
            debugRawImageInputType: info.rawImageInputType,
            debugRawImageInputKeys: info.rawImageInputKeys,
            debugRawImageHasFile: info.rawImageHasFile,
            debugRawImageUrl: info.rawImageUrl,
            debugRawImageMessage: info.rawImageMessage,
            debugImageUploadResponse: info.imageUploadResponse,
            debugResolvedImage: info.resolvedImage,
            debugInputValues: info.inputValues,
            debugExtractedVideo: info.extractedVideo,
            debugVideoUrl: info.finalVideoUrl,
            debugError: info.error,
          })
        },
        onUploadCache: (kind, cache: WorkflowFileCache, sourceInput) => {
          if (!isRecord(sourceInput)) return
          if (kind === 'video' && videoNode && videoData) {
            const current = (videoData.output || videoData.video) as unknown
            if (!isRecord(current)) return
            const next = { ...current, ...cache }
            updateNodeData(videoNode.id, {
              video: next,
              output: next,
              updatedAt: Date.now(),
            } as Partial<VideoAssetNodeData>)
          }
          if (kind === 'image' && imageNode && imageData) {
            const current = (imageData.output || imageData.image) as unknown
            if (!isRecord(current)) return
            const next = { ...current, ...cache }
            updateNodeData(imageNode.id, {
              image: next,
              output: next,
              updatedAt: Date.now(),
            } as Partial<ImageAssetNodeData>)
          }
        },
      })

      const outputSize = calculateVideoNodeSize(result.width, result.height)
      const outputVideo: LocalVideoOutput = {
        type: 'video',
        url: result.videoUrl,
        previewUrl: result.videoUrl,
        filename: result.filename,
        name: result.filename,
        width: result.width,
        height: result.height,
        promptId: result.promptId,
        workflowId: MOTION_TRANSFER_WORKFLOW_ID,
        source: 'generated',
        raw: result.rawResult,
      }
      const existingOutputEdges = edges.filter((edge) =>
        edge.source === id &&
        edge.sourceHandle === 'output_video' &&
        edge.targetHandle === 'video_input'
      )
      const existingOutputNodeIds = existingOutputEdges
        .map((edge) => edge.target)
        .filter((targetId) => {
          const targetNode = nodes.find((node) => node.id === targetId)
          return targetNode && (targetNode.data as { nodeType?: string }).nodeType === 'video_asset'
        })

      if (existingOutputNodeIds.length > 0) {
        existingOutputNodeIds.forEach((targetId) => {
          updateNodeData(targetId, {
            videoUrl: result.videoUrl,
            originalVideoUrl: result.videoUrl,
            downloadUrl: result.videoUrl,
            video: outputVideo,
            output: outputVideo,
            fileName: result.filename,
            naturalWidth: result.width,
            naturalHeight: result.height,
            previewWidth: outputSize.width,
            previewHeight: outputSize.height,
            role: 'output',
            sourceNodeId: id,
            sourceType: 'generated',
            updatedAt: Date.now(),
          } as Partial<VideoAssetNodeData>)
        })
      } else {
        const newNodeId = createNodeId()
        const sourceNode = nodes.find((n) => n.id === id)
        addNode({
          id: newNodeId,
          type: 'video_asset',
          position: {
            x: (sourceNode?.position.x ?? 0) + 380,
            y: sourceNode?.position.y ?? 0,
          },
          data: {
            nodeType: 'video_asset',
            title: t('motion.resultTitle'),
            videoUrl: result.videoUrl,
            originalVideoUrl: result.videoUrl,
            downloadUrl: result.videoUrl,
            video: outputVideo,
            output: outputVideo,
            fileName: result.filename,
            naturalWidth: result.width,
            naturalHeight: result.height,
            previewWidth: outputSize.width,
            previewHeight: outputSize.height,
            role: 'output',
            sourceNodeId: id,
            sourceType: 'generated',
            duration: undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } satisfies VideoAssetNodeData,
        })

        addEdge({
          id: '',
          source: id,
          sourceHandle: 'output_video',
          target: newNodeId,
          targetHandle: 'video_input',
          type: 'canvas',
        })
      }

      setField({
        status: 'success',
        phase: 'success',
        phaseLabel: t('motion.done'),
        outputVideoUrl: result.videoUrl,
        output: outputVideo,
        outputWidth: result.width,
        outputHeight: result.height,
        promptId: result.promptId,
        debugVideoUrl: result.videoUrl,
        debugResultResponse: result.rawResult,
      })

      try {
        useHistoryStore.getState().addRecord({
          id: 'hist_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
          type: 'video',
          status: 'success',
          sourceNodeId: id,
          modelSeries: '',
          modelId: 'motion_transfer',
          promptSnapshot: '',
          videoUrl: result.videoUrl,
          thumbnailUrl: undefined,
          naturalWidth: result.width,
          naturalHeight: result.height,
          duration: undefined,
          resolution: `${d.resolution || 720}p`,
          createdAt: Date.now(),
        })
      } catch { /* non-critical */ }

      markDirty()
      setTimeout(() => setField({ status: 'idle', phase: 'idle' }), 3000)
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      const msg = normalizeMotionTransferError(err)
      console.error('[MotionTransfer] Error:', msg, err)
      setField({ status: 'failed', phase: 'error', phaseLabel: msg, error: msg, debugError: msg })
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [
    id, isRunning, d.mode, d.resolution, d.param265, d.param266, d.param271, d.param297, d.param300, d.param361, d.param370,
    videoData, imageData, videoNode, imageNode, nodes, edges, zealmanBaseUrl, setField, updateNodeData, addNode, addEdge, markDirty, t,
  ])

  // ── Phase display ───────────────────────────────────────────────────────
  const phaseDisplay = (() => {
    const phase = d.phase
    if (!phase || phase === 'idle' || phase === 'success') return null
    if (phase === 'error') return null

    const label = d.phaseLabel || phase
    const promptShort = d.promptId ? d.promptId.slice(0, 8) : ''

    return (
      <div style={{
        fontSize: 10, padding: '3px 8px', borderRadius: 4,
        background: 'var(--field-bg)', border: '1px solid var(--border-primary)',
        color: 'var(--text-secondary)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{label}</span>
        {promptShort && (
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--text-muted)' }}>
            {promptShort}
          </span>
        )}
      </div>
    )
  })()

  const isDevMode = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  return (
    <NodeShell
      nodeType="motion_transfer"
      title={t('motion.title')}
      selected={!!selected}
      width={300}
      status={d.status}
      actions={
        isRunning ? (
          <button className="node-btn node-btn-failed" onClick={handleStop}>
            {t('motion.stop')}
          </button>
        ) : (
          <button
            className={`node-btn primary ${d.status === 'failed' ? 'node-btn-failed' : ''}`}
            onClick={handleTransfer}
          >
            <Move size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {d.status === 'failed' ? t('motion.failedRetry') : t('motion.transferMotion')}
          </button>
        )
      }
    >
      {/* Input status */}
      <div style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--field-bg)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Play size={10} />
          <span>{t('motion.videoInput')}: <b style={{ color: videoStatusLabel.color }}>{videoStatusLabel.text}</b></span>
        </div>
        <div style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--field-bg)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Image size={10} />
          <span>{t('motion.imageInput')}: <b style={{ color: imageStatusLabel.color }}>{imageStatusLabel.text}</b></span>
        </div>
      </div>

      {/* Phase display */}
      {phaseDisplay}

      {/* Remote Service section (collapsible) */}
      <div
        onClick={() => setServiceOpen(!serviceOpen)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)', padding: '2px 0' }}
      >
        {serviceOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <Activity size={10} />
        {t('motion.remoteService')}
      </div>

      {serviceOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px', borderRadius: 6, background: 'var(--field-bg)', border: '1px solid var(--border-primary)', fontSize: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('motion.svcPanel')}</span>
            <b style={{ color: panelColor }}>{panelLabel}</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('motion.gpu')}</span>
            <b style={{ color: gpuColor }}>{gpuLabel}</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('motion.comfy')}</span>
            <b style={{ color: comfyColor }}>{comfyLabel}</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>{t('motion.workflowLabel')}</span>
            <b style={{ color: wfColor }}>{wfLabel}</b>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button className="node-btn" style={{ flex: 1 }} onClick={handleDetect} disabled={detecting || isRunning}>
              <RefreshCw size={9} style={{ marginRight: 2 }} />
              {detecting ? t('motion.detecting') : t('motion.detect')}
            </button>
            <button className="node-btn" style={{ flex: 1 }} onClick={handleStartComfy} disabled={startingComfy || isRunning || ss?.comfyRunning === true}>
              <Power size={9} style={{ marginRight: 2 }} />
              {startingComfy ? t('motion.comfyStarting') : t('motion.startComfy')}
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', marginTop: 2 }}>
            <input
              type="checkbox"
              checked={autoStartComfy}
              onChange={(e) => setAutoStartComfy(e.target.checked)}
            />
            {t('motion.autoStartComfy')}
          </label>
        </div>
      )}

      {/* Basic params */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div className="node-field" style={{ flex: 1 }}>
          <div className="node-field-label">{t('motion.mode')}</div>
          <CompactSelect
            value={String(d.mode ?? 1)}
            onChange={(v) => setField({ mode: Number(v) })}
            options={[
              { value: '1', label: t('motion.mode1') },
              { value: '2', label: t('motion.mode2') },
            ]}
          />
        </div>
        <div className="node-field" style={{ flex: 1 }}>
          <div className="node-field-label">{t('motion.resolution')}</div>
          <CompactSelect
            value={String(d.resolution ?? 720)}
            onChange={(v) => setField({ resolution: Number(v) })}
            options={[
              { value: '480', label: '480p' },
              { value: '720', label: '720p' },
              { value: '1080', label: '1080p' },
            ]}
          />
        </div>
      </div>

      {/* Advanced toggle */}
      <div
        onClick={() => setAdvancedOpen(!advancedOpen)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)', padding: '2px 0' }}
      >
        {advancedOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {t('motion.advancedParams')}
      </div>

      {advancedOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 8px', borderRadius: 6, background: 'var(--field-bg)', border: '1px solid var(--border-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: 'var(--text-muted)' }}>265 (param265)</span>
            <input
              type="number" step={0.1} min={0} max={2}
              value={d.param265 ?? 1.0000000000000002}
              onChange={(e) => setField({ param265: Number(e.target.value) })}
              className="cf-textarea nodrag nopan nowheel"
              style={{ width: 60, fontSize: 10, padding: '2px 4px', textAlign: 'right' }}
              onWheelCapture={(e) => { e.stopPropagation(); e.preventDefault() }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: 'var(--text-muted)' }}>266 (param266)</span>
            <input
              type="number" step={0.1} min={0} max={1}
              value={d.param266 ?? 0.20000000000000004}
              onChange={(e) => setField({ param266: Number(e.target.value) })}
              className="cf-textarea nodrag nopan nowheel"
              style={{ width: 60, fontSize: 10, padding: '2px 4px', textAlign: 'right' }}
              onWheelCapture={(e) => { e.stopPropagation(); e.preventDefault() }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: 'var(--text-muted)' }}>271 (param271)</span>
            <input
              type="checkbox"
              checked={d.param271 ?? false}
              onChange={(e) => setField({ param271: e.target.checked })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: 'var(--text-muted)' }}>297 (param297)</span>
            <input
              type="number" step={0.1} min={0} max={2}
              value={d.param297 ?? 1.0000000000000002}
              onChange={(e) => setField({ param297: Number(e.target.value) })}
              className="cf-textarea nodrag nopan nowheel"
              style={{ width: 60, fontSize: 10, padding: '2px 4px', textAlign: 'right' }}
              onWheelCapture={(e) => { e.stopPropagation(); e.preventDefault() }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: 'var(--text-muted)' }}>300 (param300)</span>
            <input
              type="number" step={1} min={0}
              value={d.param300 ?? 840}
              onChange={(e) => setField({ param300: Number(e.target.value) })}
              className="cf-textarea nodrag nopan nowheel"
              style={{ width: 60, fontSize: 10, padding: '2px 4px', textAlign: 'right' }}
              onWheelCapture={(e) => { e.stopPropagation(); e.preventDefault() }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: 'var(--text-muted)' }}>361 (param361)</span>
            <input
              type="number" step={0.1} min={0} max={2}
              value={d.param361 ?? 1.0000000000000002}
              onChange={(e) => setField({ param361: Number(e.target.value) })}
              className="cf-textarea nodrag nopan nowheel"
              style={{ width: 60, fontSize: 10, padding: '2px 4px', textAlign: 'right' }}
              onWheelCapture={(e) => { e.stopPropagation(); e.preventDefault() }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
            <span style={{ color: 'var(--text-muted)' }}>370 (param370)</span>
            <input
              type="checkbox"
              checked={d.param370 ?? false}
              onChange={(e) => setField({ param370: e.target.checked })}
            />
          </div>
        </div>
      )}

      {/* Debug toggle — visible in dev mode or on error */}
      {(isDevMode || d.phase === 'error') && (
        <div
          onClick={() => setDebugOpen(!debugOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            fontSize: 10, color: 'var(--text-muted)', padding: '2px 0',
          }}
        >
          <Bug size={10} />
          {debugOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {t('motion.debugTitle')}
        </div>
      )}

      {/* Debug panel */}
      {debugOpen && (
        <div style={{
          padding: '6px 8px', borderRadius: 6,
          background: 'var(--field-bg)', border: '1px solid var(--border-primary)',
          fontSize: 9, fontFamily: 'monospace',
          maxHeight: 280, overflowY: 'auto',
          color: 'var(--text-secondary)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <DebugRow label="baseUrl" value={d.debugBaseUrl || baseUrl} />
          <DebugRow label="zealmanUrl (store)" value={zealmanBaseUrl || '(empty)'} />
          <DebugRow label="workflow_id" value={MOTION_TRANSFER_WORKFLOW_ID} />
          <DebugRow label="prompt_id" value={d.promptId} />
          <DebugRow label="panel" value={ss?.panelOk == null ? '-' : ss.panelOk ? 'OK' : 'FAIL'} />
          <DebugRow label="GPU" value={ss?.gpuHas == null ? '-' : `${ss.gpuHas ? 'YES' : 'NO'}${ss.gpuName ? ` (${ss.gpuName})` : ''}`} />
          <DebugRow label="ComfyUI" value={ss?.comfyRunning ? 'running' : ss?.comfyStarting ? 'starting' : 'stopped'} />
          <DebugRow label="workflow" value={ss?.workflowFound == null ? '-' : ss.workflowFound ? 'found' : 'not found'} />
          <DebugRow label="raw video input type" value={d.debugRawVideoInputType} error={isInputDebugError(d.debugRawVideoMessage)} />
          <DebugJson label="raw video input keys" value={d.debugRawVideoInputKeys} />
          <DebugRow label="raw video has file" value={String(d.debugRawVideoHasFile ?? false)} error={d.debugRawVideoHasFile === false && Boolean(d.debugRawVideoUrl?.startsWith('blob:'))} />
          <DebugRow label="raw video url" value={d.debugRawVideoUrl} error={Boolean(d.debugRawVideoUrl?.startsWith('blob:'))} />
          <DebugRow label="raw video status" value={d.debugRawVideoMessage} error={isInputDebugError(d.debugRawVideoMessage)} />
          <DebugJson label="raw video input" value={d.debugRawVideoInput} />
          <DebugJson label="video upload response" value={d.debugVideoUploadResponse} />
          <DebugRow label="resolved video value" value={d.debugResolvedVideo} error={Boolean(d.debugResolvedVideo?.startsWith('blob:'))} />
          <DebugRow label="raw image input type" value={d.debugRawImageInputType} error={isInputDebugError(d.debugRawImageMessage)} />
          <DebugJson label="raw image input keys" value={d.debugRawImageInputKeys} />
          <DebugRow label="raw image has file" value={String(d.debugRawImageHasFile ?? false)} error={d.debugRawImageHasFile === false && Boolean(d.debugRawImageUrl?.startsWith('blob:'))} />
          <DebugRow label="raw image url" value={d.debugRawImageUrl} error={Boolean(d.debugRawImageUrl?.startsWith('blob:'))} />
          <DebugRow label="raw image status" value={d.debugRawImageMessage} error={isInputDebugError(d.debugRawImageMessage)} />
          <DebugJson label="raw image input" value={d.debugRawImageInput} />
          <DebugJson label="image upload response" value={d.debugImageUploadResponse} />
          <DebugRow label="resolved image value" value={d.debugResolvedImage} error={Boolean(d.debugResolvedImage?.startsWith('blob:'))} />
          <DebugJson label="final input_values" value={d.debugInputValues} />
          <DebugJson label="generate response" value={d.debugGenerateResponse} />
          <DebugJson label="result response" value={d.debugResultResponse} />
          <DebugJson label="history response" value={d.debugHistoryResponse} />
          <DebugJson label="extracted video" value={d.debugExtractedVideo} />
          <DebugRow label="final video URL" value={d.debugVideoUrl} />
          <DebugRow label="file inputs" value={(() => {
            const iv = d.debugInputValues as Record<string, unknown> | undefined
            if (!iv) return '-'
            const video = String(iv['275:video'] || '')
            const image = String(iv['299:image'] || '')
            const hasBlob = video.startsWith('blob:') || image.startsWith('blob:')
            return hasBlob ? 'CONTAINS BLOB URL (ERROR)' : 'no blob URL'
          })()} />
          {d.debugError && <DebugRow label="error" value={d.debugError} error />}
        </div>
      )}

      {/* Error display */}
      {d.error && (
        <div style={{ color: 'var(--accent-red)', fontSize: 10, padding: '4px 0', wordBreak: 'break-word' }}>
          {d.error}
        </div>
      )}

      {d.outputVideoUrl && (
        <div style={{
          fontSize: 10,
          padding: '4px 8px',
          borderRadius: 6,
          background: 'var(--field-bg)',
          border: '1px solid var(--border-primary)',
          color: 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <span>{t('motion.done')}</span>
          <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.output?.filename || d.output?.name || 'output video'}
          </span>
        </div>
      )}

      <div className="node-ports">
        <div className="node-port-group">
          <PortLabel type="target" id="main_input" mode="main" />
          <PortLabel type="target" id="motion_video" mode="semantic" />
          <PortLabel type="target" id="source_image" mode="semantic" />
        </div>
        <div className="node-port-group">
          <PortLabel type="source" id="main_output" mode="main" />
          <PortLabel type="source" id="output_video" mode="semantic" />
        </div>
      </div>
    </NodeShell>
  )
})

// ── Debug helpers ─────────────────────────────────────────────────────────

function isInputDebugError(message?: string): boolean {
  if (!message) return false
  return message.includes('blob 字符串') || message.includes('缺少 file')
}

function DebugRow({ label, value, error }: { label: string; value?: string; error?: boolean }) {
  return (
    <div style={{ color: error ? 'var(--accent-red)' : undefined }}>
      <b>{label}:</b> {value || '-'}
    </div>
  )
}

function DebugJson({ label, value }: { label: string; value?: unknown }) {
  return (
    <div>
      <b>{label}:</b>
      <pre style={{ margin: 0, fontSize: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {value ? JSON.stringify(value, null, 2) : '-'}
      </pre>
    </div>
  )
}

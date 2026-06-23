import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeProps, Edge } from '@xyflow/react'
import { NodeShell } from '../../components/NodeShell'
import { PortLabel } from '../../components/PortLabel'
import { CompactSelect } from '../../components/Select'
import { useNodeStore } from '../../store/nodeStore'
import { useEdgeStore } from '../../store/edgeStore'
import type { ImageGenNodeData, ImageAssetNodeData } from '../nodeTypes'
import { normalizeImageBatchSize } from '../nodeTypes'
import { DEFAULT_MODEL_BY_SERIES, getModelsForSeries, getModelsGroupedByCategory, getImageModelConfig, normalizeImageModel, normalizeImageSeries, IMAGE_SERIES, getModelSupportedResolutions, getModelSupportedAspectRatios, type ImageModelSeries } from '../../generation/imageModelRegistry'
import { formatAspectRatioLabel, getResolutionsForAspectRatio, normalizeAspectRatioOptionValue } from '../../generation/sizeRegistry'
import { buildImageGenerationPayload } from '../../generation/imagePayloadBuilder'
import type { GenerateImageItem } from '../../generation/imageGenerationApi'
import {
  buildSingleImagePayload,
  runSerialImageGenerationBatch,
  type BatchGenerationTask,
} from '../../generation/scheduler/imageGenerationQueue'
import { checkModelAvailabilitySoft } from '../../store/apiSettingsStore'
import { getImageGenInputs, buildImageGenOutputMetadata } from '../nodeHelpers'
import { calcThumbnailSize } from '../../utils/imageDimensions'
import { useI18n } from '../../i18n/useI18n'
import { createNodeId } from '../../store/nodeStore'
import { useHistoryStore } from '../../store/historyStore'
import { createCanvasEdgeId } from '../../store/edgeStore'

const BATCH_SIZE_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1)
  return { value, label: `${value}\u5f20` }
})

type ImageOutputSlot = {
  nodeId: string
  index: number
}

const PROGRESS_RUNNING = '\u6b63\u5728\u751f\u6210'
const PROGRESS_DONE = '\u5df2\u5b8c\u6210'
const PROGRESS_FAILED = '\u5931\u8d25'
const MAX_REFERENCE_IMAGES = 12

function sameStringArray(a: readonly string[] | undefined, b: readonly string[]) {
  if (!a || a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

function formatGenerationProgress(progress?: ImageGenNodeData['generationProgress']) {
  if (!progress || progress.total <= 1) return ''
  if (progress.status === 'running' || progress.status === 'queued') {
    return `${PROGRESS_RUNNING} ${progress.current}/${progress.total}`
  }
  if (progress.failed > 0) {
    return `${PROGRESS_DONE} ${progress.completed}/${progress.total}, ${PROGRESS_FAILED} ${progress.failed}`
  }
  return `${PROGRESS_DONE} ${progress.completed}/${progress.total}`
}

function getErrorDebugInfo(err: unknown): unknown {
  if (err && typeof err === 'object' && 'debugInfo' in err) {
    return (err as { debugInfo?: unknown }).debugInfo
  }
  return undefined
}

export const ImageGenNodeComponent = React.memo(function ImageGenNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as ImageGenNodeData
  const updateNodeData = useNodeStore((s) => s.updateNodeData)
  const addNode = useNodeStore((s) => s.addNode)
  const nodes = useNodeStore((s) => s.nodes)
  const edges = useEdgeStore((s) => s.edges)
  const addEdge = useEdgeStore((s) => s.addEdge)
  const [promptInput, setPromptInput] = useState(d.promptInput ?? '')
  const [referenceExpanded, setReferenceExpanded] = useState(false)
  const [draggingReferenceNodeId, setDraggingReferenceNodeId] = useState<string | null>(null)
  const [dragOverReferenceNodeId, setDragOverReferenceNodeId] = useState<string | null>(null)
  const isComposingRef = useRef(false)
  const activeRequestIdRef = useRef<string | null>(null)
  const { t } = useI18n()

  const models = getModelsForSeries(d.modelSeries)
  const currentModel = models.find((m) => m.id === d.modelId)
  const modelCategory = currentModel?.category
  const ratios = getModelSupportedAspectRatios(d.modelId)
  const supportedResolutions = getModelSupportedResolutions(d.modelId)
  const aspectRatioValue = normalizeAspectRatioOptionValue(d.aspectRatio)
  const resolutions = getResolutionsForAspectRatio(d.modelSeries, aspectRatioValue, modelCategory)
    .filter((r) => supportedResolutions.includes(r))
  const batchSize = normalizeImageBatchSize(d.batchSize)

  const setField = useCallback(
    (patch: Partial<ImageGenNodeData>) => {
      updateNodeData(id, { ...patch, updatedAt: Date.now() } as Partial<ImageGenNodeData>)
    },
    [id, updateNodeData]
  )

  useEffect(() => {
    if (!isComposingRef.current) {
      setPromptInput(d.promptInput ?? '')
    }
  }, [d.promptInput])

  const commitPromptInput = useCallback(
    (value = promptInput) => {
      if ((d.promptInput ?? '') !== value) {
        setField({ promptInput: value })
      }
    },
    [d.promptInput, promptInput, setField]
  )

  const handleModelChange = useCallback(
    (newModelId: string) => {
      const newModel = models.find((m) => m.id === newModelId)
      const newResolutions = getModelSupportedResolutions(newModelId)
      let newResolution = d.resolution
      if (!newResolutions.includes(d.resolution)) {
        newResolution = newModel?.defaultResolution ?? newResolutions[newResolutions.length - 1] ?? '2K'
        console.warn('[ImageGen] Resolution downgraded:', d.resolution, '->', newResolution,
          'because model', newModelId, 'does not support', d.resolution,
          'Supports:', newResolutions.join(', '))
      }
      setField({ modelId: newModelId, resolution: newResolution as ImageGenNodeData['resolution'] })
    },
    [d.resolution, models, setField]
  )

  const handleSeriesChange = useCallback(
    (series: ImageModelSeries) => {
      const nextModelId = DEFAULT_MODEL_BY_SERIES[series]
      const firstModel = getModelsForSeries(series).find((m) => m.id === nextModelId)
      const firstRatio = firstModel?.defaultAspectRatio ?? '1:1'
      // Derive resolution from the NEW model's supported list 鈥?never from
      // the outgoing model's `resolutions`, which may have been filtered
      // against the old series/category.
      const newSupported: ('1K' | '2K' | '4K')[] = firstModel
        ? getModelSupportedResolutions(firstModel.id)
        : ['2K']
      let firstRes: '1K' | '2K' | '4K' = firstModel?.defaultResolution ?? '2K'
      if (!newSupported.includes(firstRes)) {
        firstRes = newSupported[newSupported.length - 1] ?? '2K'
      }
      setField({
        modelSeries: series,
        modelId: nextModelId,
        aspectRatio: firstRatio,
        resolution: firstRes as ImageGenNodeData['resolution'],
      })
    },
    [setField]
  )

  const ensureOutputImageSlots = useCallback(
    (
      count: number,
      prompt: string,
      negativePrompt: string,
      inputEdges: Edge[],
    ): ImageOutputSlot[] => {
      const inputs = getImageGenInputs(id, nodes, inputEdges)
      const sourceNode = nodes.find((n) => n.id === id)
      const existingSlots = inputs.connectedOutputImageNodes.slice(0, count).map((slot, index) => ({
        nodeId: slot.nodeId,
        index,
      }))

      for (const slot of existingSlots) {
        updateNodeData(slot.nodeId, {
          metadata: {
            source: 'image_gen_queue',
            generationStatus: 'queued',
            generationIndex: slot.index,
            requestedCount: count,
          },
          updatedAt: Date.now(),
        } as Partial<ImageAssetNodeData>)
      }

      const slots = [...existingSlots]
      for (let index = slots.length; index < count; index++) {
        const newNodeId = createNodeId()
        addNode({
          id: newNodeId,
          type: 'image_asset',
          position: {
            x: (sourceNode?.position.x ?? 0) + 380,
            y: (sourceNode?.position.y ?? 0) + index * 220,
          },
          data: {
            nodeType: 'image_asset',
            title: t('node.image'),
            imageUrl: '',
            role: 'unknown',
            sourceNodeId: id,
            sourceType: 'image_gen',
            modelSeries: d.modelSeries,
            modelId: d.modelId,
            aspectRatio: d.aspectRatio,
            resolution: d.resolution,
            prompt,
            negativePrompt: negativePrompt || undefined,
            metadata: {
              source: 'image_gen_queue',
              generationStatus: 'queued',
              generationIndex: index,
              requestedCount: count,
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } satisfies ImageAssetNodeData,
        })

        const edge = {
          source: id,
          sourceHandle: 'generated_image',
          target: newNodeId,
          targetHandle: 'image_input',
          type: 'canvas' as const,
        }
        addEdge({
          ...edge,
          id: createCanvasEdgeId(edge),
        })
        slots.push({ nodeId: newNodeId, index })
      }

      return slots
    },
    [id, d, nodes, addNode, addEdge, updateNodeData, t]
  )

  const writeResultToImageSlot = useCallback(
    (
      slot: ImageOutputSlot | undefined,
      item: GenerateImageItem,
      prompt: string,
      negativePrompt: string,
    ) => {
      if (!slot) return
      const thumb = calcThumbnailSize(item.width, item.height)
      const metadata = buildImageGenOutputMetadata(id, d, prompt, negativePrompt, item.width, item.height)
      updateNodeData(slot.nodeId, {
        imageUrl: item.url,
        originalImageUrl: item.originalUrl,
        downloadUrl: item.downloadUrl,
        naturalWidth: item.width,
        naturalHeight: item.height,
        realWidth: item.width,
        realHeight: item.height,
        widthEstimated: item.widthEstimated,
        previewWidth: thumb.width,
        previewHeight: thumb.height,
        metadata: {
          source: 'image_gen_queue',
          generationStatus: 'completed',
          generationIndex: slot.index,
        },
        ...metadata,
      } as Partial<ImageAssetNodeData>)
    },
    [id, d, updateNodeData]
  )

  const markImageSlotFailed = useCallback(
    (slot: ImageOutputSlot | undefined, error: string) => {
      if (!slot) return
      updateNodeData(slot.nodeId, {
        metadata: {
          source: 'image_gen_queue',
          generationStatus: 'failed',
          generationIndex: slot.index,
          error,
        },
        updatedAt: Date.now(),
      } as Partial<ImageAssetNodeData>)
    },
    [updateNodeData]
  )

  const handleGenerate = useCallback(async () => {
    // 鈹€鈹€ Re-entrance guard: prevent double-click 鈹€鈹€
    if (d.status === 'generating') return

    // 鈹€鈹€ Assign a unique run ID for this request 鈹€鈹€
    const runId = 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
    activeRequestIdRef.current = runId

    // 鈹€鈹€ Gather inputs 鈹€鈹€
    const statusInputs = getImageGenInputs(id, nodes, edges)
    const hasConnectedTextInput = statusInputs.connectedPromptNodeCount > 0
    if (!hasConnectedTextInput) {
      commitPromptInput(promptInput)
    }
    const inputs = getImageGenInputs(id, nodes, edges, hasConnectedTextInput ? '' : promptInput)

    // 鈹€鈹€ Debug log: show collected inputs 鈹€鈹€
    console.log('[ImageGen] Generation inputs:', {
      nodeId: id,
      prompt: inputs.prompt,
      negativePrompt: inputs.negativePrompt,
      referenceImageCount: inputs.referenceImages.length,
      referenceImages: inputs.referenceImages.map((url: string) =>
        url.startsWith('data:') ? `[dataURL ${url.length} chars]` : url
      ),
      referenceImageLabels: inputs.referenceImageLabels,
      connectedPromptNodeCount: inputs.connectedPromptNodeCount,
      connectedReferenceImageNodeCount: inputs.connectedReferenceImageNodeCount,
    })

    // Log upstream edges for debugging
    const upstreamEdges = edges.filter((e) => e.target === id)
    console.log('[ImageGen] Upstream edges:', upstreamEdges.map((e) => {
      const srcNode = nodes.find((n) => n.id === e.source)
      const srcType = srcNode ? (srcNode.data as { nodeType?: string }).nodeType ?? 'unknown' : 'unknown'
      return {
        source: e.source,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        sourceNodeType: srcType,
      }
    }))

    // 鈹€鈹€ Validate: warn if reference image nodes connected but have no image 鈹€鈹€
    if (inputs.connectedReferenceImageNodeCount > 0 && inputs.referenceImages.length === 0) {
      setField({ status: 'failed', error: 'Reference image node has no image. Please upload an image first.' })
      activeRequestIdRef.current = null
      return
    }

    if (!inputs.prompt.trim()) {
      setField({ status: 'failed', error: t('imageGen.error.connectText') })
      return
    }

    const requestedBatchSize = batchSize

    // 鈹€鈹€ Set generating state 鈹€鈹€
    setField({
      status: 'generating',
      error: undefined,
      generationProgress: {
        current: 0,
        total: requestedBatchSize,
        completed: 0,
        failed: 0,
        status: 'queued',
      },
    })

    // 鈹€鈹€ Pre-generation model checks 鈹€鈹€
    const series = normalizeImageSeries(d.modelSeries)
    const modelId = normalizeImageModel(d.modelId)
    const modelConfig = getImageModelConfig(series, modelId)

    if (modelConfig && inputs.referenceImages.length > 0 && !modelConfig.supportsImageInput) {
      setField({ status: 'failed', error: `Current model ${modelConfig.label} does not support reference image input. Please switch models.` })
      activeRequestIdRef.current = null
      return
    }

    if (modelConfig) {
      // Soft availability check 鈥?an empty / stale / missing model list (e.g.
      // an old availableModels cache after an update) must NEVER block the
      // request. A model that isn't in /v1/models becomes a console warning at
      // most; the real relay response is the only thing that can fail this.
      const availability = await checkModelAvailabilitySoft(modelConfig.backendModel)
      if (availability.status === 'not_listed') {
        console.warn('[ImageGen] Current model is not listed by /v1/models, continuing request.', {
          model: modelConfig.backendModel,
          availableModels: availability.availableModels,
        })
      }
    }

    let payload: Record<string, unknown> | undefined

    try {
      // Build text node data from gathered inputs for payload builder
      const textNodesForPayload = [{
        nodeType: 'text' as const,
        title: '',
        textKind: 'prompt' as const,
        content: inputs.prompt,
        language: 'mixed' as const,
        updatedAt: Date.now(),
      }]

      const negTextNode = inputs.negativePrompt ? [{
        nodeType: 'text' as const,
        title: '',
        textKind: 'negative_prompt' as const,
        content: inputs.negativePrompt,
        language: 'mixed' as const,
        updatedAt: Date.now(),
      }] : []

      const allTextNodes = [...textNodesForPayload, ...negTextNode]

      // Build image node data from reference images (with dimensions)
      const imageNodesForPayload = inputs.referenceImageNodes.map((ref) => ({
        nodeType: 'image_asset' as const,
        title: '',
        imageUrl: ref.imageUrl,
        naturalWidth: ref.naturalWidth,
        naturalHeight: ref.naturalHeight,
        role: 'reference' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }))

      payload = await buildImageGenerationPayload({
        imageGenNode: d,
        connectedTextNodes: allTextNodes,
        connectedImageNodes: imageNodesForPayload,
        referenceImageLabels: inputs.referenceImageLabels,
        edges,
        nodes,
        targetNodeId: id,
      })

      const payloadModel = String(payload.model ?? '')
      const requestModelConfig = modelConfig && modelConfig.backendModel === payloadModel
        ? modelConfig
        : undefined
      const historyModel = requestModelConfig ?? modelConfig
      const finalSize = String(payload.size || payload.image_size || '')

      // 鈹€鈹€ Race check: only proceed if this is still the active request 鈹€鈹€
      if (activeRequestIdRef.current !== runId) return

      const outputSlots = ensureOutputImageSlots(
        requestedBatchSize,
        inputs.prompt,
        inputs.negativePrompt,
        edges,
      )

      const batchTask: BatchGenerationTask = await runSerialImageGenerationBatch({
        batchId: runId,
        basePayload: payload,
        requestedCount: requestedBatchSize,
        shouldCancel: () => activeRequestIdRef.current !== runId,
        onTaskStart: (task, batch) => {
          if (activeRequestIdRef.current !== runId) return
          setField({
            status: 'generating',
            generationProgress: {
              current: task.index + 1,
              total: batch.requestedCount,
              completed: batch.completedCount,
              failed: batch.failedCount,
              status: 'running',
            },
          })
        },
        onTaskSuccess: (task, batch) => {
          if (activeRequestIdRef.current !== runId || !task.result) return
          writeResultToImageSlot(outputSlots[task.index], task.result, inputs.prompt, inputs.negativePrompt)
          setField({
            status: 'generating',
            generationProgress: {
              current: task.index + 1,
              total: batch.requestedCount,
              completed: batch.completedCount,
              failed: batch.failedCount,
              status: 'running',
            },
          })
        },
        onTaskFailure: (task, batch) => {
          if (activeRequestIdRef.current !== runId) return
          markImageSlotFailed(outputSlots[task.index], task.error ?? 'Generation failed.')
          setField({
            status: 'generating',
            generationProgress: {
              current: task.index + 1,
              total: batch.requestedCount,
              completed: batch.completedCount,
              failed: batch.failedCount,
              status: 'running',
            },
          })
        },
      })

      // 鈹€鈹€ Race check again after side effects 鈹€鈹€
      if (activeRequestIdRef.current !== runId && batchTask.status === 'cancelled') return

      const returnedImages = batchTask.items
        .filter((task) => task.status === 'completed' && task.result)
        .map((task) => task.result as GenerateImageItem)
      const firstImage = returnedImages[0]
      const returnedBatchSize = batchTask.completedCount
      const failedBatchSize = batchTask.failedCount

      // Store clean payload without internal _meta field
      const cleanPayload = buildSingleImagePayload(payload, 0)
      delete cleanPayload._meta

      const sizeWarning = returnedImages.find((item) => item.sizeWarning)?.sizeWarning
      if (sizeWarning) {
        console.warn('[ImageGen] Size warning:', sizeWarning)
      }
      const countWarning = failedBatchSize > 0
        ? `Completed ${returnedBatchSize}/${requestedBatchSize}, failed ${failedBatchSize}.`
        : undefined
      const finalProgress: ImageGenNodeData['generationProgress'] = {
        current: requestedBatchSize,
        total: requestedBatchSize,
        completed: returnedBatchSize,
        failed: failedBatchSize,
        status: batchTask.status,
      }
      const finalStatus = returnedBatchSize > 0 ? 'success' : 'failed'
      const historyBatchStatus = batchTask.status === 'queued' || batchTask.status === 'running'
        ? undefined
        : batchTask.status

      // Update self status to success
      setField({
        status: finalStatus,
        lastRequestPayload: cleanPayload,
        lastDebugInfo: undefined,
        lastOutputImageUrls: returnedImages.map((item) => item.url),
        lastOutputWidth: firstImage?.width,
        lastOutputHeight: firstImage?.height,
        lastGeneratedImageUrl: firstImage?.url,
        lastPrompt: inputs.prompt,
        lastReferenceImages: inputs.referenceImages,
        generationProgress: finalProgress,
        error: countWarning || sizeWarning || (returnedBatchSize === 0 ? 'Generation failed.' : undefined),
      })

      // Write to history
      try {
        const historyStore = useHistoryStore.getState()
        const historyBatchId = batchTask.batchId
        const historyCreatedAt = Date.now()
        batchTask.items.forEach((task) => {
          if (task.status !== 'completed' || !task.result) return
          const item = task.result
          historyStore.addRecord({
            id: `${historyBatchId}_${task.index + 1}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'image',
            status: 'success',
            sourceNodeId: id,
            modelSeries: d.modelSeries,
            modelId: d.modelId,
            modelLabel: historyModel?.label,
            backendModel: historyModel?.backendModel,
            engineType: historyModel?.engineType,
            sizeMode: historyModel?.sizeMode,
            promptSnapshot: inputs.prompt,
            prompt: inputs.prompt,
            negativePromptSnapshot: inputs.negativePrompt || undefined,
            negativePrompt: inputs.negativePrompt || undefined,
            imageUrl: item.url,
            url: item.url,
            thumbnailUrl: item.url,
            naturalWidth: item.width,
            naturalHeight: item.height,
            width: item.width,
            height: item.height,
            batchId: historyBatchId,
            batchIndex: task.index + 1,
            batchTotal: requestedBatchSize,
            batchSize: requestedBatchSize,
            returnedBatchSize: 1,
            requestedCount: requestedBatchSize,
            completedCount: returnedBatchSize,
            failedCount: failedBatchSize,
            batchStatus: historyBatchStatus,
            aspectRatio: d.aspectRatio,
            resolution: d.resolution,
            finalSize,
            requestPayload: cleanPayload,
            createdAt: historyCreatedAt + task.index,
          })
        })
      } catch { /* non-critical */ }

      // Auto-reset to idle after 1.2s so button shows "Regenerate"
      setTimeout(() => {
        // Only reset if still showing success (user hasn't triggered new generation)
        if (activeRequestIdRef.current === runId) {
          activeRequestIdRef.current = null
          setField({ status: 'idle' })
        }
      }, 1200)
    } catch (err: unknown) {
      // 鈹€鈹€ Race check 鈹€鈹€
      if (activeRequestIdRef.current !== runId) return

      const msg = err instanceof Error && err.message === 'MISSING_API_KEY'
        ? t('imageGen.error.missingApiKey')
        : err instanceof Error && err.message === 'MISSING_API_BASE_URL'
          ? t('imageGen.error.missingApiBaseUrl')
          : err instanceof Error
            ? err.message
            : String(err)

      console.error('[ImageGen] Generation error:', msg)

      setField({
        status: 'failed',
        error: msg,
        lastRequestPayload: payload,
        lastDebugInfo: getErrorDebugInfo(err),
      })

      // Auto-clear activeRequestId so next click works
      activeRequestIdRef.current = null
    }
  }, [
    id,
    d,
    edges,
    nodes,
    promptInput,
    setField,
    commitPromptInput,
    t,
    batchSize,
    ensureOutputImageSlots,
    writeResultToImageSlot,
    markImageSlotFailed,
  ])

  // Connection-driven prompt input visibility.
  const inputs = getImageGenInputs(id, nodes, edges)
  // Reference thumbnails are derived purely from the live connection graph —
  // disconnecting an image node makes its thumbnail disappear automatically.
  // No separate copy of the list is kept, so display never drifts from edges.
  const allReferenceItems = inputs.referenceImageNodes
    .filter((item) => item.nodeId && typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0)
  const referenceCount = allReferenceItems.length
  const visibleReferenceItems = referenceExpanded
    ? allReferenceItems
    : allReferenceItems.slice(0, MAX_REFERENCE_IMAGES)
  const referenceHiddenCount = Math.max(referenceCount - MAX_REFERENCE_IMAGES, 0)

  useEffect(() => {
    if (sameStringArray(d.referenceImageOrder, inputs.normalizedReferenceImageOrder)) return
    setField({ referenceImageOrder: inputs.normalizedReferenceImageOrder })
  }, [d.referenceImageOrder, inputs.normalizedReferenceImageOrder, setField])

  // Drag-to-reorder reference thumbnails. Reorders the canonical
  // normalizedReferenceImageOrder (source node ids) and writes it back, so the
  // new order drives BOTH the grid display and the generation payload (they
  // share the same sorted source in getImageGenInputs).
  const handleReferenceReorder = useCallback(
    (sourceNodeId: string, targetNodeId: string) => {
      if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) return
      const order = inputs.normalizedReferenceImageOrder
      const fromIndex = order.indexOf(sourceNodeId)
      const toIndex = order.indexOf(targetNodeId)
      if (fromIndex < 0 || toIndex < 0) return
      const next = [...order]
      const [moved] = next.splice(fromIndex, 1)
      if (moved == null) return
      next.splice(toIndex, 0, moved)
      setField({ referenceImageOrder: next })
    },
    [inputs.normalizedReferenceImageOrder, setField]
  )

  const promptConnected = inputs.connectedPromptNodeCount > 0

  // 鈹€鈹€ Multi-state button label 鈹€鈹€
  const getButtonLabel = () => {
    switch (d.status) {
      case 'generating': return t('imageGen.generating')
      case 'success': return t('imageGen.generateSuccess')
      case 'failed': return t('imageGen.generateFailed')
      default: {
        // If node has previous results, show "Regenerate"
        const hasHistory = Boolean(d.lastGeneratedImageUrl)
        return hasHistory ? t('imageGen.regenerate') : t('imageGen.generate')
      }
    }
  }

  const isButtonDisabled = d.status === 'generating' || d.status === 'success'
  const progressLabel = formatGenerationProgress(d.generationProgress)

  return (
    <NodeShell
      nodeType="image_gen"
      title={t('node.imageGen')}
      selected={!!selected}
      status={d.status}
      width={260}
      actions={
        <>
          <button
            className={`node-btn primary ${d.status === 'failed' ? 'node-btn-failed' : ''}`}
            onClick={handleGenerate}
            disabled={isButtonDisabled}
          >
            {getButtonLabel()}
          </button>
        </>
      }
    >
      {/* Series selector */}
      <div className="segmented-control">
        {IMAGE_SERIES.map((s) => (
          <button
            key={s}
            className={`segmented-btn ${d.modelSeries === s ? 'active' : ''}`}
            onClick={() => handleSeriesChange(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Model select + batch size */}
      <div className="image-gen-model-row nodrag nopan nowheel">
        <div className="image-gen-model-field">
          <CompactSelect
            value={d.modelId}
            onChange={(value) => handleModelChange(value)}
            groups={getModelsGroupedByCategory(d.modelSeries).map((g) => ({
              label: g.group,
              options: g.models.map((m) => ({ value: m.id, label: m.label })),
            }))}
            title="模型选择"
          />
        </div>
        <div className="image-gen-batch-field">
          <CompactSelect
            value={String(batchSize)}
            onChange={(value) => setField({ batchSize: normalizeImageBatchSize(value) })}
            options={BATCH_SIZE_OPTIONS}
            title="生成张数"
          />
        </div>
      </div>

      {/* Ratio + Resolution */}
      <div className="node-row">
        <div className="node-field">
          <CompactSelect
            value={aspectRatioValue}
            onChange={(value) => setField({ aspectRatio: normalizeAspectRatioOptionValue(value) })}
            options={ratios.map((ratio) => ({ value: ratio, label: formatAspectRatioLabel(ratio) }))}
          />
        </div>
        <div className="node-field">
          <CompactSelect
            value={d.resolution}
            onChange={(value) => setField({ resolution: value as '1K' | '2K' | '4K' })}
            options={(['1K', '2K', '4K'] as const).map((resolution) => ({
              value: resolution,
              label: resolution,
            }))}
          />
        </div>
      </div>

      {referenceCount > 0 ? (
        <div className="reference-preview-section nodrag nopan">
          <div className="reference-preview-header">
            <span>{`参考图（${referenceCount}/${MAX_REFERENCE_IMAGES}）`}</span>
          </div>
          <div className={`reference-image-grid${referenceExpanded ? ' expanded' : ''}`}>
            {visibleReferenceItems.map((item, index) => (
              <div
                key={item.nodeId}
                className={`reference-image-item${draggingReferenceNodeId === item.nodeId ? ' dragging' : ''}${dragOverReferenceNodeId === item.nodeId ? ' drag-over' : ''}`}
                draggable
                title={item.label}
                onMouseDown={(event) => event.stopPropagation()}
                onDragStart={(event) => {
                  event.stopPropagation()
                  setDraggingReferenceNodeId(item.nodeId)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', item.nodeId)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  event.dataTransfer.dropEffect = 'move'
                  if (dragOverReferenceNodeId !== item.nodeId) setDragOverReferenceNodeId(item.nodeId)
                }}
                onDragLeave={() => {
                  if (dragOverReferenceNodeId === item.nodeId) setDragOverReferenceNodeId(null)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  const sourceNodeId = draggingReferenceNodeId ?? event.dataTransfer.getData('text/plain')
                  handleReferenceReorder(sourceNodeId, item.nodeId)
                  setDraggingReferenceNodeId(null)
                  setDragOverReferenceNodeId(null)
                }}
                onDragEnd={(event) => {
                  event.stopPropagation()
                  setDraggingReferenceNodeId(null)
                  setDragOverReferenceNodeId(null)
                }}
              >
                <img src={item.imageUrl} alt="" draggable={false} />
                <span className="reference-preview-badge">{`图${index + 1}`}</span>
              </div>
            ))}
          </div>
          {referenceHiddenCount > 0 && (
            <button
              type="button"
              className="reference-image-toggle"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => setReferenceExpanded((expanded) => !expanded)}
            >
              {referenceExpanded ? '收起' : `还有 ${referenceHiddenCount} 张，展开`}
            </button>
          )}
        </div>
      ) : null}

      {/* Prompt input: hidden when connected Text nodes provide prompt content. */}
      <div className="divider" />
      {!promptConnected && (
        <textarea
          rows={3}
          value={promptInput}
          onChange={(event) => setPromptInput(event.target.value)}
          onBlur={() => commitPromptInput()}
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={(event) => {
            isComposingRef.current = false
            setPromptInput(event.currentTarget.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) handleGenerate()
          }}
          placeholder={t('imageGen.promptPlaceholder')}
          className="cf-textarea node-prompt-textarea nodrag nopan"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        />
      )}

      {d.error && (
        <div style={{ color: 'var(--accent-red)', fontSize: 11, padding: '4px 0' }}>{d.error}</div>
      )}
      {progressLabel && (
        <div className="image-gen-progress">{progressLabel}</div>
      )}

      {/* Ports 鈥?main handles visible, semantic handles invisible */}
      <div className="node-ports">
        <div className="node-port-group">
          <PortLabel type="target" id="main_input" mode="main" />
          <PortLabel type="target" id="prompt" mode="semantic" />
          <PortLabel type="target" id="negative_prompt" mode="semantic" />
          <PortLabel type="target" id="reference_image" mode="semantic" />
          <PortLabel type="target" id="camera" mode="semantic" />
        </div>
        <div className="node-port-group">
          <PortLabel type="source" id="main_output" mode="main" />
          <PortLabel type="source" id="generated_image" mode="semantic" />
          <PortLabel type="source" id="output" mode="semantic" />
        </div>
      </div>
    </NodeShell>
  )
})

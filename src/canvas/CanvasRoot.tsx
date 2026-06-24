import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type OnConnectStart,
  type OnConnectEnd,
  applyNodeChanges,
  applyEdgeChanges,
  type Edge,
  type Node,
  type Viewport,
  SelectionMode,
  ConnectionMode,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useNodeStore } from '../store/nodeStore'
import { createNodeId } from '../store/nodeStore'
import { useEdgeStore } from '../store/edgeStore'
import { useProjectStore } from '../store/projectStore'
import { useCanvasShortcuts } from './hooks/useCanvasShortcuts'
import { CanvasContextMenu } from './CanvasContextMenu'
import { isValidConnection, EDGE_ERROR_MSG } from './edgeRules'
import { CanvasEdge } from './edges/CanvasEdge'
import { TextNodeComponent } from './nodes/TextNode'
import { ProductAnalysisNodeComponent } from './nodes/ProductAnalysisNode'
import { ImageAssetNodeComponent } from './nodes/ImageAssetNode'
import { ImageGenNodeComponent } from './nodes/ImageGenNode'
import { LLMNodeComponent } from './nodes/LLMNode'
import { ResultImageNodeComponent } from './nodes/ResultImageNode'
import { GroupNodeComponent } from './nodes/GroupNode'
import { VideoAssetNodeComponent } from './nodes/VideoAssetNode'
import { VideoGenNodeComponent } from './nodes/VideoGenNode'
import { MotionTransferNodeComponent } from './nodes/MotionTransferNode'
import { useUIStore } from '../store/uiStore'
import { useCanvasStore } from '../store/canvasStore'
import { useUndoRedoStore } from '../store/undoRedoStore'
import { StarryCanvasBackground } from './StarryCanvasBackground'
import { CanvasSelectionToolbar } from './CanvasSelectionToolbar'
import { createCanvasEdgeId, isDuplicateEdge, normalizeCanvasEdge } from '../store/edgeStore'
import type { Connection } from '@xyflow/react'
import { readImageFile, isImageFile } from './imageFileUtils'
import { readVideoFile, isVideoFile } from './videoFileUtils'
import { calcThumbnailSize } from '../utils/imageDimensions'
import type { ImageAssetNodeData, CanvasNodeData, TextNodeData, ImageGenNodeData, LLMNodeData, VideoAssetNodeData, MotionTransferNodeData, VideoGenNodeData, HistoryRecord } from './nodeTypes'
import { normalizeConnection, migrateEdges } from './connectionNormalizer'
import { getReferenceMenuRule } from './referenceMenuRules'
import { ReferenceCreateMenu } from '../components/ReferenceCreateMenu'
import type { ReferenceMenuItem } from './referenceMenuRules'
import { useI18n } from '../i18n/useI18n'
import { normalizeImageModel, normalizeImageSeries } from '../generation/imageModelRegistry'
import { DEFAULT_VIDEO_MODEL_ID, getVideoModelById } from '../generation/videoModelRegistry'
import { createDefaultProductAnalysisNodeData } from './productAnalysisPrompt'
import { DEFAULT_LLM_MODEL_ID } from '../generation/llmModelRegistry'

const nodeTypes = {
  text: TextNodeComponent,
  product_analysis: ProductAnalysisNodeComponent,
  image_asset: ImageAssetNodeComponent,
  image_gen: ImageGenNodeComponent,
  llm: LLMNodeComponent,
  result_image: ResultImageNodeComponent,
  group: GroupNodeComponent,
  video_asset: VideoAssetNodeComponent,
  motion_transfer: MotionTransferNodeComponent,
  video_gen: VideoGenNodeComponent,
}

const edgeTypes = {
  canvas: CanvasEdge,
}

const HISTORY_DRAG_MIME = 'application/x-canvasforge-history-image'
const VIEWPORT_ZOOM_STEP = 0.05

function snapViewportZoom(zoom: number) {
  return Number((Math.round(zoom / VIEWPORT_ZOOM_STEP) * VIEWPORT_ZOOM_STEP).toFixed(2))
}

function roundViewportCoord(value: number) {
  return Number(value.toFixed(2))
}

function normalizeViewportForStorage(vp: Viewport): Viewport {
  return {
    x: roundViewportCoord(vp.x),
    y: roundViewportCoord(vp.y),
    zoom: snapViewportZoom(vp.zoom),
  }
}

function recordImageUrl(record: Partial<HistoryRecord>) {
  return record.url || record.imageUrl || record.thumbnailUrl || ''
}

function recordWidth(record: Partial<HistoryRecord>) {
  return record.width || record.naturalWidth || 1024
}

function recordHeight(record: Partial<HistoryRecord>) {
  return record.height || record.naturalHeight || 1024
}

function recordPrompt(record: Partial<HistoryRecord>) {
  return record.prompt || record.promptSnapshot || ''
}

function recordFinalSize(record: Partial<HistoryRecord>) {
  const width = recordWidth(record)
  const height = recordHeight(record)
  return record.finalSize || (width > 0 && height > 0 ? `${width}x${height}` : undefined)
}

function cloneGraphSnapshot(nodes: Node<CanvasNodeData>[], edges: Edge[]) {
  return {
    nodes: JSON.parse(JSON.stringify(nodes)) as Node<CanvasNodeData>[],
    edges: JSON.parse(JSON.stringify(edges)) as Edge[],
  }
}

function didNodePositionsChange(before: Node<CanvasNodeData>[], after: Node<CanvasNodeData>[]): boolean {
  const beforeById = new Map(before.map((node) => [node.id, node.position]))
  return after.some((node) => {
    const prev = beforeById.get(node.id)
    return prev != null && (prev.x !== node.position.x || prev.y !== node.position.y)
  })
}

export function CanvasRoot() {
  const rightDragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const leftDragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const connectSucceededRef = useRef(false)
  const dragStartSnapshotRef = useRef<ReturnType<typeof cloneGraphSnapshot> | null>(null)
  const viewportFrameRef = useRef<number | null>(null)
  const pendingViewportRef = useRef<Viewport | null>(null)
  const nodes = useNodeStore((s) => s.nodes)
  const setNodes = useNodeStore((s) => s.setNodes)
  const edges = useEdgeStore((s) => s.edges)
  const setEdges = useEdgeStore((s) => s.setEdges)
  const markDirty = useProjectStore((s) => s.markDirty)
  const reactFlow = useReactFlow()
  const { t } = useI18n()
  const [interactionClass, setInteractionClass] = useState('')

  // Reference menu state
  const [referenceMenu, setReferenceMenu] = useState<{
    x: number
    y: number
    sourceNodeId: string
    sourceHandle: string | null
    sourceNodeType: string
  } | null>(null)

  useCanvasShortcuts()

  useEffect(() => () => {
    if (viewportFrameRef.current != null) {
      cancelAnimationFrame(viewportFrameRef.current)
    }
  }, [])

  const onPaneMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button === 0) {
      leftDragRef.current = { x: event.clientX, y: event.clientY, moved: false }
    }
    if (event.button === 2) {
      rightDragRef.current = { x: event.clientX, y: event.clientY, moved: false }
    }
  }, [])

  const onPaneMouseMove = useCallback((event: React.MouseEvent) => {
    useCanvasStore.getState().setLastMouseFlowPosition(
      reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    )

    const leftDrag = leftDragRef.current
    if (leftDrag && Math.hypot(event.clientX - leftDrag.x, event.clientY - leftDrag.y) > 6) {
      leftDrag.moved = true
      if (interactionClass !== 'canvas-dragging') {
        setInteractionClass('canvas-dragging')
      }
    }

    const rightDrag = rightDragRef.current
    if (rightDrag && Math.hypot(event.clientX - rightDrag.x, event.clientY - rightDrag.y) > 6) {
      rightDrag.moved = true
      if (interactionClass !== 'canvas-dragging') {
        setInteractionClass('canvas-dragging')
      }
    }
  }, [interactionClass, reactFlow])

  const onPaneMouseUp = useCallback(() => {
    setTimeout(() => {
      leftDragRef.current = null
      rightDragRef.current = null
    }, 0)
    if (interactionClass !== '') {
      setInteractionClass('')
    }
  }, [interactionClass])

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const groupMoveDeltas = new Map<string, { x: number; y: number }>()
      const movedNodeIds = new Set<string>()
      const nodeById = new Map(nodes.map((node) => [node.id, node]))
      const hasPersistedChange = changes.some((change) => {
        if (change.type === 'select' || change.type === 'dimensions') return false
        if (change.type === 'position' && 'dragging' in change && change.dragging) return false
        return true
      })

      for (const change of changes) {
        if (change.type !== 'position' || !change.position) continue
        movedNodeIds.add(change.id)

        const node = nodeById.get(change.id)
        if (!node || (node.data as { nodeType?: string }).nodeType !== 'group') continue

        const delta = {
          x: change.position.x - node.position.x,
          y: change.position.y - node.position.y,
        }

        if (delta.x !== 0 || delta.y !== 0) {
          groupMoveDeltas.set(change.id, delta)
        }
      }

      let nextNodes = applyNodeChanges(changes, nodes) as typeof nodes

      if (groupMoveDeltas.size > 0) {
        const childDeltas = new Map<string, { x: number; y: number }>()

        for (const [groupId, delta] of groupMoveDeltas) {
          const group = nodeById.get(groupId)
          const childNodeIds = ((group?.data as { childNodeIds?: string[] })?.childNodeIds ?? [])

          for (const childId of childNodeIds) {
            if (movedNodeIds.has(childId)) continue
            const current = childDeltas.get(childId) ?? { x: 0, y: 0 }
            childDeltas.set(childId, { x: current.x + delta.x, y: current.y + delta.y })
          }
        }

        nextNodes = nextNodes.map((node) => {
          const delta = childDeltas.get(node.id)
          if (!delta) return node

          return {
            ...node,
            position: {
              x: node.position.x + delta.x,
              y: node.position.y + delta.y,
            },
          }
        })
      }

      setNodes(nextNodes)
      if (hasPersistedChange) {
        markDirty()
      }
    },
    [nodes, setNodes, markDirty]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges(applyEdgeChanges(changes, edges).map(normalizeCanvasEdge))
      markDirty()
    },
    [edges, setEdges, markDirty]
  )

  // Track drag wire start
  const onConnectStart: OnConnectStart = useCallback((event, { nodeId, handleId, handleType }) => {
    connectSucceededRef.current = false
    setReferenceMenu(null)
    if (handleType !== 'source') return
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    const nodeType = (node.data as { nodeType?: string }).nodeType
    if (!nodeType || nodeType === 'group') return
    const ui = useUIStore.getState()
    ui.hideContextMenu()
  }, [nodes])

  // Handle drag wire end - show reference menu if dropped on empty space
  const onConnectEnd: OnConnectEnd = useCallback((event, connectionState) => {
    // If onConnect already handled the connection, skip reference menu
    if (connectSucceededRef.current) {
      setReferenceMenu(null)
      return
    }

    // If connectionState indicates a valid target was found, skip reference menu
    if (connectionState.isValid) {
      setReferenceMenu(null)
      return
    }
    if (connectionState.toNode || connectionState.toHandle) {
      setReferenceMenu(null)
      return
    }

    const sourceNode = connectionState.fromNode
    if (!sourceNode) return

    const sourceNodeId = sourceNode.id
    const sourceType = (sourceNode.data as { nodeType?: string }).nodeType
    if (!sourceType || sourceType === 'group') return

    const mouseEvent = event as MouseEvent
    if (!mouseEvent.clientX) return

    // Check the DOM target to confirm it's truly empty canvas (not a node/handle/edge)
    const target = mouseEvent.target as HTMLElement
    if (
      target.closest('.react-flow__node') ||
      target.closest('.react-flow__handle') ||
      target.closest('.react-flow__edge')
    ) {
      return
    }

    const menuRule = getReferenceMenuRule(sourceType)
    if (menuRule && menuRule.items.length > 0) {
      setReferenceMenu({
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
        sourceNodeId: sourceNodeId,
        sourceHandle: connectionState.fromHandle?.id ?? null,
        sourceNodeType: sourceType,
      })
    }
  }, [nodes])

  const handleReferenceMenuSelect = useCallback((
    nodeType: ReferenceMenuItem['nodeType']
  ) => {
    if (!referenceMenu) return

    const { sourceNodeId, sourceHandle } = referenceMenu
    const sourceNode = nodes.find((n) => n.id === sourceNodeId)
    if (!sourceNode) return
    const addNode = useNodeStore.getState().addNode

    // Calculate position for new node
    let flowPos = reactFlow.screenToFlowPosition({
      x: referenceMenu.x,
      y: referenceMenu.y,
    })

    // Avoid overlap by offsetting if too close
    const dx = flowPos.x - sourceNode.position.x
    const dy = flowPos.y - sourceNode.position.y
    if (Math.abs(dx) < 50 && Math.abs(dy) < 50) {
      flowPos.x += 320
    }

    // Create new node based on type
    const newNodeId = createNodeId()
    let newNodeData: CanvasNodeData
    let newNodeWidth = 260

    switch (nodeType) {
      case 'text': {
        const textData: TextNodeData = {
          nodeType: 'text',
          title: t('node.text'),
          textKind: 'prompt',
          content: '',
          language: 'mixed',
          updatedAt: Date.now(),
        }
        newNodeData = textData as CanvasNodeData
        newNodeWidth = 260
        break
      }
      case 'product_analysis': {
        newNodeData = createDefaultProductAnalysisNodeData() as CanvasNodeData
        newNodeWidth = 330
        break
      }
      case 'image_asset': {
        const imageData: ImageAssetNodeData = {
          nodeType: 'image_asset',
          title: t('node.image'),
          imageUrl: '',
          role: 'reference',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        newNodeData = imageData as CanvasNodeData
        newNodeWidth = 220
        break
      }
      case 'image_gen': {
        const genData: ImageGenNodeData = {
          nodeType: 'image_gen',
          title: t('node.imageGen'),
          modelSeries: 'G',
          modelId: 'g-gpt-image-2',
          aspectRatio: '1:1',
          resolution: '2K',
          batchSize: 1,
          referenceImageOrder: [],
          status: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        newNodeData = genData as CanvasNodeData
        newNodeWidth = 260
        break
      }
      case 'llm': {
        const llmData: LLMNodeData = {
          nodeType: 'llm',
          title: t('node.llm'),
          llmProvider: 'openai_compatible',
          llmModelId: DEFAULT_LLM_MODEL_ID,
          mode: 'chat',
          userInput: '',
          conversation: [],
          status: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        newNodeData = llmData as CanvasNodeData
        newNodeWidth = 280
        break
      }
      case 'video_asset': {
        const videoData: VideoAssetNodeData = {
          nodeType: 'video_asset',
          title: t('node.videoAsset'),
          videoUrl: '',
          role: 'source',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        newNodeData = videoData as CanvasNodeData
        newNodeWidth = 320
        break
      }
      case 'motion_transfer': {
        const mtData: MotionTransferNodeData = {
          nodeType: 'motion_transfer',
          title: t('node.motionTransfer'),
          mode: 1,
          resolution: 720,
          status: 'idle',
          param265: 1.0000000000000002,
          param266: 0.20000000000000004,
          param271: false,
          param297: 1.0000000000000002,
          param300: 840,
          param361: 1.0000000000000002,
          param370: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        newNodeData = mtData as CanvasNodeData
        newNodeWidth = 300
        break
      }
      case 'video_gen': {
        const vgModel = getVideoModelById(DEFAULT_VIDEO_MODEL_ID)
        const vgData: VideoGenNodeData = {
          nodeType: 'video_gen',
          title: t('node.videoGen'),
          modelId: vgModel?.id ?? DEFAULT_VIDEO_MODEL_ID,
          backendModel: vgModel?.backendModel,
          modelLabel: vgModel?.label,
          aspectRatio: vgModel?.defaultAspectRatio ?? '16:9',
          size: vgModel?.defaultSize ?? '720p',
          duration: vgModel?.defaultDuration ?? 5,
          fps: 24,
          status: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        newNodeData = vgData as CanvasNodeData
        newNodeWidth = 290
        break
      }
      default:
        return
    }

    // Add the new node
    const newNode: Node<CanvasNodeData> = {
      id: newNodeId,
      type: nodeType,
      position: flowPos,
      data: newNodeData,
    }
    const nextNodes = [...nodes, newNode]
    addNode(newNode)

    // Create connection with normalized handles 鈥?use nextNodes so normalizeConnection can find the new node
    const normalizedConnection = normalizeConnection({
      source: sourceNodeId,
      target: newNodeId,
      sourceHandle: sourceHandle || 'main_output',
      targetHandle: 'main_input',
    }, nextNodes, edges)

    if (normalizedConnection && isValidConnection(normalizedConnection, nextNodes, edges) && !isDuplicateEdge(edges, normalizedConnection)) {
      const newEdge = {
        ...normalizedConnection,
        id: createCanvasEdgeId(normalizedConnection),
        type: 'canvas' as const,
      }
      setEdges([...edges, newEdge] as Edge[])
    }

    markDirty()
    setReferenceMenu(null)
  }, [referenceMenu, nodes, reactFlow, edges, setEdges, markDirty, t])

  const validateLiveConnection = useCallback(
    (connection: Edge | Connection): boolean => {
      const conn = {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
      }
      const normalized = normalizeConnection(conn, nodes as Node<CanvasNodeData>[], edges)
      if (!normalized) return false
      return isValidConnection(normalized, nodes as Node<CanvasNodeData>[], edges)
    },
    [nodes, edges]
  )

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const normalized = normalizeConnection(connection, nodes as Node<CanvasNodeData>[], edges)
      if (!normalized) return
      if (isDuplicateEdge(edges, normalized)) {
        connectSucceededRef.current = true
        setReferenceMenu(null)
        return
      }
      if (!isValidConnection(normalized, nodes as Node<CanvasNodeData>[], edges)) return

      useUndoRedoStore.getState().capture('鍒涘缓杩炵嚎')

      const newEdge = {
        ...normalized,
        id: createCanvasEdgeId(normalized),
        type: 'canvas' as const,
      }
      setEdges([...edges, newEdge] as Edge[])
      connectSucceededRef.current = true
      setReferenceMenu(null)
      markDirty()
    },
    [nodes, edges, setEdges, markDirty]
  )

  const onPaneClick = useCallback(() => {
    if (leftDragRef.current?.moved) return
    setNodes(nodes.map((node) => ({ ...node, selected: false })))
    setEdges(edges.map((edge) => ({ ...edge, selected: false })))
    setReferenceMenu(null)
    if (useUIStore.getState().activeRightPanel) {
      useUIStore.getState().closeRightPanel()
    }
  }, [nodes, edges, setNodes, setEdges])

  // Close reference menu on viewport change
  const onMove = useCallback(() => {
    setReferenceMenu(null)
  }, [])

  const onCanvasDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return

      const target = event.target as HTMLElement

      // Don't trigger on nodes, edges, menus, or interactive elements
      if (
        target.closest('.react-flow__node') ||
        target.closest('.react-flow__edge') ||
        target.closest('.floating-add-menu') ||
        target.closest('.canvas-context-menu') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select')
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      const flowPos = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const ui = useUIStore.getState()
      ui.hideContextMenu()
      ui.showAddNodeMenuAt(
        { x: event.clientX, y: event.clientY },
        flowPos
      )
    },
    [reactFlow]
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      event.stopPropagation()
      const nodeType = (node.data as { nodeType?: string })?.nodeType
      useUIStore.getState().showContextMenu(event.clientX, event.clientY, node.id, nodeType)
    },
    []
  )

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      if (rightDragRef.current?.moved) return
      const clientX = 'clientX' in event ? event.clientX : 0
      const clientY = 'clientY' in event ? event.clientY : 0
      useUIStore.getState().showContextMenu(clientX, clientY)
    },
    []
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onNodeDragStart = useCallback(() => {
    useUndoRedoStore.getState().capture('绉诲姩鑺傜偣')
    setInteractionClass('node-dragging')
  }, [])

  const onNodeDragStop = useCallback(() => {
    setInteractionClass('')
    markDirty()
  }, [markDirty])

  const onViewportChange = useCallback((vp: Viewport) => {
    pendingViewportRef.current = vp
    if (viewportFrameRef.current != null) return
    viewportFrameRef.current = requestAnimationFrame(() => {
      viewportFrameRef.current = null
      const pending = pendingViewportRef.current
      if (!pending) return
      pendingViewportRef.current = null
      const normalized = normalizeViewportForStorage(pending)
      const { setViewportZoom } = useUIStore.getState()
      setViewportZoom(normalized.zoom)
      useCanvasStore.getState().setViewport(normalized)
    })
  }, [])

  const onViewportMoveEnd = useCallback((_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
    const snappedZoom = snapViewportZoom(viewport.zoom)
    if (Math.abs(snappedZoom - viewport.zoom) < 0.001) return
    reactFlow.zoomTo(snappedZoom, { duration: 80 })
  }, [reactFlow])

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()
      const historyPayload = event.dataTransfer.getData(HISTORY_DRAG_MIME)
      if (historyPayload) {
        try {
          const record = JSON.parse(historyPayload) as Partial<HistoryRecord> & { historyId?: string }
          const imageUrl = recordImageUrl(record)
          if (!imageUrl) return

          const { addNode } = useNodeStore.getState()
          const basePos = reactFlow.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          })
          const width = recordWidth(record)
          const height = recordHeight(record)
          const thumb = calcThumbnailSize(width, height)

          useUndoRedoStore.getState().capture('Add image from history')
          const historyId = record.historyId || record.id
          addNode({
            id: createNodeId(),
            type: 'image_asset',
            position: basePos,
            data: {
              nodeType: 'image_asset',
              title: record.modelLabel || t('common.history'),
              imageUrl,
              originalImageUrl: record.url || record.imageUrl,
              downloadUrl: record.url || record.imageUrl,
              naturalWidth: width,
              naturalHeight: height,
              previewWidth: thumb.width,
              previewHeight: thumb.height,
              role: 'reference',
              sourceType: 'image_gen',
              sourceNodeId: record.sourceNodeId,
              modelSeries: normalizeImageSeries(record.modelSeries),
              modelId: normalizeImageModel(record.modelId || record.backendModel),
              modelLabel: record.modelLabel,
              backendModel: record.backendModel,
              engineType: record.engineType,
              sizeMode: record.sizeMode,
              aspectRatio: record.aspectRatio,
              resolution: record.resolution,
              finalSize: recordFinalSize(record),
              prompt: recordPrompt(record),
              negativePrompt: record.negativePrompt || record.negativePromptSnapshot,
              metadata: {
                source: 'history',
                historyId,
                historyRecordId: historyId,
                prompt: recordPrompt(record),
                modelLabel: record.modelLabel,
                backendModel: record.backendModel,
                aspectRatio: record.aspectRatio,
                resolution: record.resolution,
                finalSize: recordFinalSize(record),
                createdAt: record.createdAt,
                historyCreatedAt: record.createdAt,
                batchId: record.batchId,
                batchIndex: record.batchIndex,
                batchTotal: record.batchTotal,
              },
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } satisfies ImageAssetNodeData,
          })
          markDirty()
          return
        } catch (error) {
          console.warn('[CanvasRoot] Failed to parse history drag payload:', error)
          return
        }
      }

      const allFiles = Array.from(event.dataTransfer.files)
      const imageFiles = allFiles.filter(isImageFile)
      const videoFiles = allFiles.filter(isVideoFile)
      if (imageFiles.length === 0 && videoFiles.length === 0) return

      const { addNode } = useNodeStore.getState()
      const basePos = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      // Capture undo snapshot before any file uploads
      useUndoRedoStore.getState().capture('鎷栨嫿涓婁紶')

      let offsetIdx = 0

      // Read all images; offsets prevent overlap when multiple files are dropped at once
      const imgResults = await Promise.allSettled(imageFiles.map(readImageFile))
      for (const r of imgResults) {
        if (r.status !== 'fulfilled') continue
        const { file, thumbnailUrl, originalUrl, fileName, mimeType, size, naturalWidth, naturalHeight } = r.value
        const thumb = calcThumbnailSize(naturalWidth, naturalHeight)
        const output = {
          type: 'image' as const,
          file,
          url: thumbnailUrl,
          previewUrl: thumbnailUrl,
          name: fileName,
          mimeType,
          size,
          width: naturalWidth,
          height: naturalHeight,
          source: 'local' as const,
        }
        const offset = offsetIdx * 280
        offsetIdx++
        addNode({
          id: createNodeId(),
          type: 'image_asset',
          position: { x: basePos.x + offset, y: basePos.y },
          data: {
            nodeType: 'image_asset',
            title: fileName,
            imageUrl: thumbnailUrl,
            originalImageUrl: originalUrl,
            downloadUrl: originalUrl,
            image: output,
            output,
            fileName,
            mimeType,
            naturalWidth,
            naturalHeight,
            previewWidth: thumb.width,
            previewHeight: thumb.height,
            role: 'reference',
            sourceType: 'upload',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } satisfies ImageAssetNodeData,
        })
      }

      // Read all videos
      const vidResults = await Promise.allSettled(videoFiles.map(readVideoFile))
      for (const r of vidResults) {
        if (r.status !== 'fulfilled') continue
        const { file, videoUrl, fileName, mimeType, size, naturalWidth, naturalHeight, duration, previewWidth, previewHeight } = r.value
        const output = {
          type: 'video' as const,
          file,
          url: videoUrl,
          previewUrl: videoUrl,
          name: fileName,
          mimeType,
          size,
          width: naturalWidth,
          height: naturalHeight,
          duration,
          source: 'local' as const,
        }
        const offset = offsetIdx * 400
        offsetIdx++
        addNode({
          id: createNodeId(),
          type: 'video_asset',
          position: { x: basePos.x + offset, y: basePos.y },
          data: {
            nodeType: 'video_asset',
            title: fileName,
            videoUrl,
            originalVideoUrl: videoUrl,
            downloadUrl: videoUrl,
            video: output,
            output,
            fileName,
            mimeType,
            naturalWidth,
            naturalHeight,
            duration,
            previewWidth,
            previewHeight,
            role: 'source',
            sourceType: 'upload',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          } satisfies VideoAssetNodeData,
        })
      }
      markDirty()
    },
    [reactFlow, markDirty]
  )

  return (
    <div className={`canvas-root${interactionClass ? ' ' + interactionClass : ''}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        isValidConnection={validateLiveConnection}
        connectionMode={ConnectionMode.Loose}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        noWheelClassName="nowheel"
        noPanClassName="nopan"
        noDragClassName="nodrag"
        selectionOnDrag
        selectionKeyCode={null}
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panActivationKeyCode="Space"
        onMouseDown={onPaneMouseDown}
        onMouseMove={onPaneMouseMove}
        onMouseUp={onPaneMouseUp}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onDoubleClick={onCanvasDoubleClick}
        zoomOnDoubleClick={false}
        onNodeContextMenu={onNodeContextMenu}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onViewportChange={onViewportChange}
        onMoveEnd={onViewportMoveEnd}
        fitView
        style={{ background: 'transparent' }}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={2}
      >
        <StarryCanvasBackground />
        <CanvasSelectionToolbar />
      </ReactFlow>
      <CanvasContextMenu />
      {referenceMenu && (
        <ReferenceCreateMenu
          x={referenceMenu.x}
          y={referenceMenu.y}
          menuTitleKey={getReferenceMenuRule(referenceMenu.sourceNodeType)?.menuTitleKey || ''}
          items={getReferenceMenuRule(referenceMenu.sourceNodeType)?.items || []}
          onSelect={handleReferenceMenuSelect}
          onClose={() => setReferenceMenu(null)}
        />
      )}
    </div>
  )
}

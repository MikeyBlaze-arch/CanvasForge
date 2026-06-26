import React, { useCallback, useEffect, useRef } from 'react'
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
import { useEdgeStore } from '../store/edgeStore'
import { useProjectStore } from '../store/projectStore'
import { useCanvasShortcuts } from './hooks/useCanvasShortcuts'
import { useCanvasPaneInteraction } from './hooks/useCanvasPaneInteraction'
import { useCanvasFileDrop } from './hooks/useCanvasFileDrop'
import { useReferenceCreateMenu } from './hooks/useReferenceCreateMenu'
import { CanvasContextMenu } from './CanvasContextMenu'
import { isValidConnection } from './edgeRules'
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
import { ImageCompareNodeComponent } from './nodes/ImageCompareNode'
import { useUIStore } from '../store/uiStore'
import { useCanvasStore } from '../store/canvasStore'
import { useUndoRedoStore } from '../store/undoRedoStore'
import { StarryCanvasBackground } from './StarryCanvasBackground'
import { CanvasSelectionToolbar } from './CanvasSelectionToolbar'
import { createCanvasEdgeId, isDuplicateEdge, normalizeCanvasEdge } from '../store/edgeStore'
import type { Connection } from '@xyflow/react'
import type { CanvasNodeData } from './nodeTypes'
import { normalizeConnection } from './connectionNormalizer'
import { ReferenceCreateMenu } from '../components/ReferenceCreateMenu'
import { useI18n } from '../i18n/useI18n'

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
  image_compare: ImageCompareNodeComponent,
}

const edgeTypes = {
  canvas: CanvasEdge,
}

function roundViewportCoord(value: number) {
  return Number(value.toFixed(2))
}

function roundViewportZoom(value: number) {
  return Number(value.toFixed(4))
}

function normalizeViewportForStorage(vp: Viewport): Viewport {
  return {
    x: roundViewportCoord(vp.x),
    y: roundViewportCoord(vp.y),
    zoom: roundViewportZoom(vp.zoom),
  }
}

export function CanvasRoot() {
  const connectSucceededRef = useRef(false)
  const viewportFrameRef = useRef<number | null>(null)
  const pendingViewportRef = useRef<Viewport | null>(null)
  const nodes = useNodeStore((s) => s.nodes)
  const setNodes = useNodeStore((s) => s.setNodes)
  const edges = useEdgeStore((s) => s.edges)
  const setEdges = useEdgeStore((s) => s.setEdges)
  const markDirty = useProjectStore((s) => s.markDirty)
  const reactFlow = useReactFlow()
  const { t } = useI18n()

  useCanvasShortcuts()

  // Custom hooks for interaction management
  const {
    interactionClass,
    setInteractionClass,
    onPaneMouseDown,
    onPaneMouseMove,
    onPaneMouseUp,
    leftDragRef,
    rightDragRef,
  } = useCanvasPaneInteraction(reactFlow)

  const { onDragOver, onDrop } = useCanvasFileDrop(reactFlow, markDirty, t)

  const {
    referenceMenu,
    setReferenceMenu,
    handleReferenceMenuSelect,
    getReferenceMenuRule,
  } = useReferenceCreateMenu(nodes, edges, setEdges, reactFlow, markDirty, t)

  useEffect(() => () => {
    if (viewportFrameRef.current != null) {
      cancelAnimationFrame(viewportFrameRef.current)
    }
  }, [])

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
  }, [nodes, setReferenceMenu])

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
  }, [nodes, setReferenceMenu, getReferenceMenuRule])


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

      useUndoRedoStore.getState().capture('创建连线')

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
    [nodes, edges, setEdges, markDirty, setReferenceMenu]
  )

  const onPaneClick = useCallback(() => {
    if (leftDragRef.current?.moved) return
    setNodes(nodes.map((node) => ({ ...node, selected: false })))
    setEdges(edges.map((edge) => ({ ...edge, selected: false })))
    setReferenceMenu(null)
    if (useUIStore.getState().activeRightPanel) {
      useUIStore.getState().closeRightPanel()
    }
  }, [nodes, edges, setNodes, setEdges, setReferenceMenu])

  // Close reference menu on viewport change
  const onMove = useCallback(() => {
    setReferenceMenu(null)
  }, [setReferenceMenu])

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

  const onNodeDragStart = useCallback(() => {
    useUndoRedoStore.getState().capture('移动节点')
    setInteractionClass('node-dragging')
  }, [setInteractionClass])

  const onNodeDragStop = useCallback(() => {
    setInteractionClass('')
    markDirty()
  }, [markDirty, setInteractionClass])

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
        onMove={onMove}
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

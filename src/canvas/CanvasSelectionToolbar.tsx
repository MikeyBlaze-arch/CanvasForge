import React, { useCallback, useMemo } from 'react'
import { FolderPlus, Play, Ungroup } from 'lucide-react'
import { useViewport, type Node } from '@xyflow/react'
import { useNodeStore } from '../store/nodeStore'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'
import { useUndoRedoStore } from '../store/undoRedoStore'
import type { CanvasNodeData, GroupNodeData } from './nodeTypes'
import { useI18n } from '../i18n/useI18n'

const NODE_SIZE_BY_TYPE: Record<string, { width: number; height: number }> = {
  text: { width: 210, height: 184 },
  image_asset: { width: 210, height: 178 },
  image_gen: { width: 260, height: 262 },
  llm: { width: 280, height: 292 },
  result_image: { width: 220, height: 214 },
  group: { width: 560, height: 430 },
}

function getNodeSize(node: Node<CanvasNodeData>) {
  const measured = (node as Node<CanvasNodeData> & { measured?: { width?: number; height?: number } }).measured
  const nodeType = (node.data as CanvasNodeData).nodeType
  const fallback = NODE_SIZE_BY_TYPE[nodeType] ?? { width: 220, height: 180 }

  if (nodeType === 'group') {
    const groupData = node.data as GroupNodeData
    return {
      width: groupData.width ?? measured?.width ?? node.width ?? fallback.width,
      height: groupData.height ?? measured?.height ?? node.height ?? fallback.height,
    }
  }

  return {
    width: measured?.width ?? node.width ?? fallback.width,
    height: measured?.height ?? node.height ?? fallback.height,
  }
}

export function CanvasSelectionToolbar() {
  const nodes = useNodeStore((s) => s.nodes)
  const setNodes = useNodeStore((s) => s.setNodes)
  const markDirty = useProjectStore((s) => s.markDirty)
  const viewport = useViewport()
  const { t } = useI18n()

  const selectedNodes = useMemo(
    () => nodes.filter((node) => node.selected && (node.data as CanvasNodeData).nodeType !== 'group'),
    [nodes]
  )

  const selectedGroupNode = useMemo(
    () => {
      const selectedGroups = nodes.filter((node) => node.selected && (node.data as CanvasNodeData).nodeType === 'group')
      return selectedGroups.length === 1 ? selectedGroups[0] as Node<CanvasNodeData> : null
    },
    [nodes]
  )

  const bounds = useMemo(() => {
    if (selectedGroupNode) {
      const size = getNodeSize(selectedGroupNode)
      return {
        minX: selectedGroupNode.position.x,
        minY: selectedGroupNode.position.y,
        maxX: selectedGroupNode.position.x + size.width,
        maxY: selectedGroupNode.position.y + size.height,
      }
    }

    if (selectedNodes.length < 2) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const node of selectedNodes) {
      const size = getNodeSize(node)
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + size.width)
      maxY = Math.max(maxY, node.position.y + size.height)
    }

    return { minX, minY, maxX, maxY }
  }, [selectedGroupNode, selectedNodes])

  const handleGroup = useCallback(() => {
    if (!bounds || selectedNodes.length < 2) return

    useUIStore.getState().openGroupDialog({
      open: true,
      mode: 'selection',
      nodeIds: selectedNodes.map((node) => node.id),
      bounds,
    })
  }, [bounds, selectedNodes])

  const handleRunGroup = useCallback(() => {
    if (!selectedGroupNode) return
  }, [selectedGroupNode])

  const handleUngroup = useCallback(() => {
    if (!selectedGroupNode) return

    useUndoRedoStore.getState().capture(t('selection.ungroup'))

    const childNodeIds = new Set((selectedGroupNode.data as GroupNodeData).childNodeIds)
    setNodes(nodes
      .filter((node) => node.id !== selectedGroupNode.id)
      .map((node) => ({
        ...node,
        selected: childNodeIds.has(node.id),
      }))
    )
    markDirty()
  }, [markDirty, nodes, selectedGroupNode, setNodes, t])

  if (!bounds || (!selectedGroupNode && selectedNodes.length < 2)) return null

  const centerX = ((bounds.minX + bounds.maxX) / 2) * viewport.zoom + viewport.x
  const topY = bounds.minY * viewport.zoom + viewport.y
  const isGroupToolbar = !!selectedGroupNode

  return (
    <div
      className={`canvas-selection-toolbar nodrag nopan${isGroupToolbar ? ' canvas-selection-toolbar-group' : ''}`}
      style={{
        left: centerX,
        top: Math.max(18, topY - 46),
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {isGroupToolbar ? (
        <>
          <button className="canvas-selection-toolbar-btn" onClick={handleRunGroup}>
            <Play size={14} fill="currentColor" />
            <span>{t('selection.runGroup')}</span>
          </button>
          <button className="canvas-selection-toolbar-btn" onClick={handleUngroup}>
            <Ungroup size={14} />
            <span>{t('selection.ungroup')}</span>
          </button>
        </>
      ) : (
        <button className="canvas-selection-toolbar-btn" onClick={handleGroup}>
          <FolderPlus size={14} />
          <span>{t('selection.group')}</span>
        </button>
      )}
    </div>
  )
}

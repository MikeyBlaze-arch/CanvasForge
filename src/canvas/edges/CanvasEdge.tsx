import React, { useCallback } from 'react'
import type { EdgeProps } from '@xyflow/react'
import { EdgeLabelRenderer } from '@xyflow/react'
import { Scissors } from 'lucide-react'
import { useEdgeStore } from '../../store/edgeStore'
import { useNodeStore } from '../../store/nodeStore'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { useI18n } from '../../i18n/useI18n'
import { getCanvasEdgePath, isNodeRunning } from './edgeUtils'

export const CanvasEdge = React.memo(function CanvasEdge(props: EdgeProps) {
  const { id, source, target, sourceX, sourceY, targetX, targetY, selected } = props
  const removeEdge = useEdgeStore((s) => s.removeEdge)
  const markDirty = useProjectStore((s) => s.markDirty)
  const edgeStyle = useUIStore((s) => s.edgeStyle)
  const edgeCurvature = useUIStore((s) => s.edgeCurvature)

  // Flow triggers. Each selector returns a primitive boolean so zustand only
  // re-renders THIS edge when its own source/target node flips state — never
  // the whole canvas. Both ends are watched so input AND output edges of a
  // selected/running node light up.
  const sourceSelected = useNodeStore((s) => {
    const n = s.nodes.find((x) => x.id === source)
    return !!n?.selected
  })
  const targetSelected = useNodeStore((s) => {
    const n = s.nodes.find((x) => x.id === target)
    return !!n?.selected
  })
  const sourceRunning = useNodeStore((s) => {
    const n = s.nodes.find((x) => x.id === source)
    return !!n && isNodeRunning(n.data)
  })
  const targetRunning = useNodeStore((s) => {
    const n = s.nodes.find((x) => x.id === target)
    return !!n && isNodeRunning(n.data)
  })

  const isSelectedFlow = !!(selected || sourceSelected || targetSelected)
  const isRunningFlow = !!(sourceRunning || targetRunning)
  const isFlowing = isSelectedFlow || isRunningFlow

  const { t } = useI18n()
  const { path, labelX, labelY } = getCanvasEdgePath(
    { sourceX, sourceY, targetX, targetY },
    edgeStyle,
    edgeCurvature
  )

  const gradientId = `canvas-edge-flow-gradient-${id}`
  const basePathClass = [
    'canvas-edge-path',
    selected ? 'selected' : '',
    isFlowing ? 'flowing' : '',
    isSelectedFlow ? 'selected-flow' : '',
    isRunningFlow ? 'running-flow' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const flowPathClass = [
    'canvas-edge-flow',
    isSelectedFlow ? 'selected-flow' : '',
    isRunningFlow ? 'running-flow' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const deleteEdge = useCallback(
    (event?: React.MouseEvent) => {
      event?.preventDefault()
      event?.stopPropagation()
      removeEdge(id)
      markDirty()
    },
    [id, removeEdge, markDirty]
  )

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<SVGPathElement>) => {
      deleteEdge(event)
    },
    [deleteEdge]
  )

  return (
    <>
      <path className="canvas-edge-hit-path" d={path} onDoubleClick={handleDoubleClick} />
      <path className={basePathClass} d={path} onDoubleClick={handleDoubleClick} />
      {isFlowing && (
        <>
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={Math.min(sourceX, targetX)}
              y1={sourceY}
              x2={Math.max(sourceX, targetX)}
              y2={targetY}
            >
              <stop offset="0%" stopColor="rgb(160,160,160)" stopOpacity="0.22" />
              <stop offset="42%" stopColor="rgb(180,180,180)" stopOpacity="0.34" />
              <stop offset="72%" stopColor="rgb(215,215,215)" stopOpacity="0.68" />
              <stop offset="100%" stopColor="rgb(245,245,245)" stopOpacity="0.92" />
            </linearGradient>
          </defs>
          <path className={flowPathClass} d={path} style={{ stroke: `url(#${gradientId})` }} />
        </>
      )}
      <EdgeLabelRenderer>
        <button
          className={`canvas-edge-delete ${selected ? 'visible' : ''}`}
          style={{ transform: `translate3d(${labelX}px, ${labelY}px, 0) translate(-50%, -50%)` }}
          onClick={deleteEdge}
          title={t('edge.delete')}
          aria-label={t('edge.delete')}
        >
          <Scissors size={13} />
        </button>
      </EdgeLabelRenderer>
    </>
  )
})

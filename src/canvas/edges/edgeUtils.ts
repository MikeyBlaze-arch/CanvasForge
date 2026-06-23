import type { EdgeProps } from '@xyflow/react'
import type { CanvasNodeData } from '../nodeTypes'

export type CanvasEdgeStyle = 'bezier' | 'straight' | 'step'

export type CanvasEdgePathResult = {
  path: string
  labelX: number
  labelY: number
}

type EdgePointArgs = Pick<EdgeProps, 'sourceX' | 'sourceY' | 'targetX' | 'targetY'>

export function getCanvasEdgePath(
  args: EdgePointArgs,
  style: CanvasEdgeStyle,
  curvature: number
): CanvasEdgePathResult {
  const { sourceX, sourceY, targetX, targetY } = args
  const labelX = (sourceX + targetX) / 2
  const labelY = (sourceY + targetY) / 2

  if (style === 'straight') {
    return {
      path: `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`,
      labelX,
      labelY,
    }
  }

  if (style === 'step') {
    return {
      path: `M ${sourceX} ${sourceY} L ${labelX} ${sourceY} L ${labelX} ${targetY} L ${targetX} ${targetY}`,
      labelX,
      labelY,
    }
  }

  const dx = Math.max(Math.abs(targetX - sourceX), 80)
  const tension = Math.min(1, Math.max(0, curvature))
  const controlOffset = dx * tension

  return {
    path: `M ${sourceX} ${sourceY} C ${sourceX + controlOffset} ${sourceY}, ${targetX - controlOffset} ${targetY}, ${targetX} ${targetY}`,
    labelX,
    labelY,
  }
}

/**
 * Whether a node is currently "running" (producing output).
 * Used to decide if its outgoing edges should show the flow animation.
 * Covers image-gen batches, LLM streaming, video-gen and motion-transfer.
 */
export function isNodeRunning(data: CanvasNodeData): boolean {
  const d = data as unknown as { nodeType?: string; status?: string }
  switch (d.nodeType) {
    case 'image_gen':
      return d.status === 'queued' || d.status === 'generating'
    case 'llm':
      return d.status === 'running'
    case 'video_gen':
      return d.status === 'queued' || d.status === 'submitting' || d.status === 'polling'
    case 'motion_transfer':
      return d.status === 'queued' || d.status === 'running'
    default:
      return false
  }
}

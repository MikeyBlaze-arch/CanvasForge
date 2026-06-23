import type { Connection } from '@xyflow/react'
import type { CanvasNodeData } from './nodeTypes'
import type { Node, Edge } from '@xyflow/react'
import { isConnectionAllowed, getConnectionErrorMessage, resolveHandleId } from './connectionRules'

/**
 * Validate a connection attempt between two nodes.
 * Uses centralized connection rules from connectionRules.ts.
 * Handles legacy handle IDs for backward compatibility.
 */
export function isValidConnection(
  connection: Connection,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[] = []
): boolean {
  const sourceNode = nodes.find((n) => n.id === connection.source)
  const targetNode = nodes.find((n) => n.id === connection.target)
  if (!sourceNode || !targetNode) return false

  const sourceType = (sourceNode.data as CanvasNodeData).nodeType
  const targetType = (targetNode.data as CanvasNodeData).nodeType

  return isConnectionAllowed({
    sourceType,
    sourceHandle: connection.sourceHandle,
    targetType,
    targetHandle: connection.targetHandle,
    sourceId: connection.source ?? undefined,
    targetId: connection.target ?? undefined,
    edges,
  })
}

export const EDGE_ERROR_MSG = getConnectionErrorMessage()

/**
 * Resolve a legacy handle ID to its canonical form.
 * Re-exported from connectionRules for convenience.
 */
export { resolveHandleId }

import { create } from 'zustand'
import type { Connection, Edge } from '@xyflow/react'
import type { CanvasNodeData } from '../canvas/nodeTypes'
import { isConnectionAllowed } from '../canvas/connectionRules'

export function isDuplicateEdge(edges: Edge[], connection: Connection | Edge): boolean {
  return edges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.target === connection.target &&
      edge.targetHandle === connection.targetHandle
  )
}

export function createCanvasEdgeId(connection: Connection | Edge): string {
  return [
    'e',
    connection.source,
    connection.sourceHandle ?? 'source',
    connection.target,
    connection.targetHandle ?? 'target',
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 8),
  ].join('_')
}

export function normalizeCanvasEdge(edge: Edge): Edge {
  return {
    ...edge,
    type: 'canvas',
  }
}

interface EdgeState {
  edges: Edge[]
  setEdges: (edges: Edge[]) => void
  addEdge: (edge: Edge) => void
  removeEdge: (id: string) => void
  removeEdgesByNode: (nodeId: string) => void
  getUpstreamNodes: (targetNodeId: string, sourceHandle?: string) => Array<{ nodeId: string; handle?: string }>
}

export const useEdgeStore = create<EdgeState>((set, get) => ({
  edges: [],

  setEdges: (edges) => set({ edges: edges.map(normalizeCanvasEdge) }),

  addEdge: (edge) => set((s) => {
    if (isDuplicateEdge(s.edges, edge)) return s
    return { edges: [...s.edges, normalizeCanvasEdge({ ...edge, id: edge.id || createCanvasEdgeId(edge) })] }
  }),

  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  removeEdgesByNode: (nodeId) =>
    set((s) => ({
      edges: s.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    })),

  getUpstreamNodes: (targetNodeId, targetHandle) => {
    const { edges } = get()
    return edges
      .filter((e) => e.target === targetNodeId && (!targetHandle || e.targetHandle === targetHandle))
      .map((e) => ({ nodeId: e.source, handle: e.sourceHandle ?? undefined }))
  },
}))

/**
 * Check if a connection is valid using centralized rules.
 */
export function canConnect(
  sourceType: string,
  sourceHandle: string | null,
  targetType: string,
  targetHandle: string | null
): boolean {
  return isConnectionAllowed({
    sourceType,
    sourceHandle,
    targetType,
    targetHandle,
  })
}

export function getConnectErrorMessage(): string {
  return '当前节点端口类型不兼容，无法连接。'
}

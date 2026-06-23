import { create } from 'zustand'
import type { Edge, Node } from '@xyflow/react'
import type { CanvasNodeData, GroupNodeData } from '../canvas/nodeTypes'
import { useUndoRedoStore } from './undoRedoStore'
import { useProjectStore } from './projectStore'

function genId(): string {
  return 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

interface NodeState {
  nodes: Node<CanvasNodeData>[]
  setNodes: (nodes: Node<CanvasNodeData>[]) => void
  addNode: (node: Node<CanvasNodeData>) => void
  updateNodeData: (id: string, patch: Partial<CanvasNodeData>) => void
  removeNode: (id: string) => void
  cloneNode: (id: string) => Node<CanvasNodeData> | undefined
  copyBuffer: { nodes: Node<CanvasNodeData>[]; edges: Edge[] } | null
  setCopyBuffer: (buffer: { nodes: Node<CanvasNodeData>[]; edges: Edge[] } | null) => void
  getUpstreamTextNodes: (nodeId: string) => Node<CanvasNodeData>[]
  getUpstreamImageNodes: (nodeId: string) => Node<CanvasNodeData>[]
}

export const useNodeStore = create<NodeState>((set, get) => ({
  nodes: [],
  copyBuffer: null,

  setNodes: (nodes) => set({ nodes }),

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),

  updateNodeData: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } as CanvasNodeData } : n
      ),
    })),

  removeNode: (id) => set((s) => ({ nodes: s.nodes.filter((n) => n.id !== id) })),

  cloneNode: (id) => {
    const node = get().nodes.find((n) => n.id === id)
    if (!node) return undefined
    const cloned: Node<CanvasNodeData> = {
      ...node,
      id: genId(),
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: { ...node.data, title: (node.data as { title?: string }).title + ' (副本)' } as CanvasNodeData,
      selected: false,
    }
    set((s) => ({ nodes: [...s.nodes, cloned] }))
    return cloned
  },

  setCopyBuffer: (buffer) => set({ copyBuffer: buffer }),

  getUpstreamTextNodes: (nodeId) => {
    const { nodes } = get()
    // This will be used in conjunction with edgeStore - simplified version
    return nodes.filter(
      (n) => (n.data as CanvasNodeData).nodeType === 'text'
    )
  },

  getUpstreamImageNodes: (nodeId) => {
    const { nodes } = get()
    return nodes.filter(
      (n) =>
        (n.data as CanvasNodeData).nodeType === 'image_asset' ||
        (n.data as CanvasNodeData).nodeType === 'result_image'
    )
  },
}))

export function createNodeId(): string {
  return genId()
}

export type CreateGroupOptions = {
  title: string
  position?: { x: number; y: number }
  nodeIds?: string[]
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
}

export function createGroupFromDialog(options: CreateGroupOptions) {
  const { title, position, nodeIds, bounds } = options

  useUndoRedoStore.getState().capture('新建分组')

  const padding = 32
  let groupX: number
  let groupY: number
  let groupW: number
  let groupH: number
  let childIds: string[] = []

  if (nodeIds && nodeIds.length > 0 && bounds) {
    groupX = bounds.minX - padding
    groupY = bounds.minY - padding
    groupW = bounds.maxX - bounds.minX + padding * 2
    groupH = bounds.maxY - bounds.minY + padding * 2
    childIds = nodeIds
  } else {
    groupX = position?.x ?? 100
    groupY = position?.y ?? 100
    groupW = 560
    groupH = 430
  }

  const id = genId()
  const groupNode: Node<CanvasNodeData> = {
    id,
    type: 'group',
    position: { x: groupX, y: groupY },
    selected: true,
    zIndex: -1,
    data: {
      nodeType: 'group',
      title,
      label: title,
      childNodeIds: childIds,
      width: groupW,
      height: groupH,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as unknown as CanvasNodeData,
  }

  const { nodes, setNodes } = useNodeStore.getState()
  setNodes([
    groupNode,
    ...nodes.map((n) => ({ ...n, selected: false })),
  ])

  useProjectStore.getState().markDirty()
  return id
}

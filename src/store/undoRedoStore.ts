import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import type { CanvasNodeData } from '../canvas/nodeTypes'
import { useNodeStore } from './nodeStore'
import { useEdgeStore } from './edgeStore'
import { useProjectStore } from './projectStore'

type Snapshot = {
  id: string
  label: string
  nodes: Node<CanvasNodeData>[]
  edges: Edge[]
  createdAt: number
}

interface UndoRedoState {
  undoStack: Snapshot[]
  redoStack: Snapshot[]
  maxStack: number
  capture: (label: string) => void
  captureSnapshot: (label: string, snapshot: Pick<Snapshot, 'nodes' | 'edges'>) => void
  undo: () => void
  redo: () => void
  clear: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

function snapId(): string {
  return 'snap_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

function currentState(): Snapshot {
  return {
    id: snapId(),
    label: '',
    nodes: JSON.parse(JSON.stringify(useNodeStore.getState().nodes)),
    edges: JSON.parse(JSON.stringify(useEdgeStore.getState().edges)),
    createdAt: Date.now(),
  }
}

function snapshotFrom(label: string, snapshot: Pick<Snapshot, 'nodes' | 'edges'>): Snapshot {
  return {
    id: snapId(),
    label,
    nodes: JSON.parse(JSON.stringify(snapshot.nodes)),
    edges: JSON.parse(JSON.stringify(snapshot.edges)),
    createdAt: Date.now(),
  }
}

export const useUndoRedoStore = create<UndoRedoState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxStack: 80,

  capture: (label: string) => {
    const { undoStack, maxStack } = get()
    const snap: Snapshot = { ...currentState(), label }
    set({
      undoStack: [...undoStack.slice(-(maxStack - 1)), snap],
      redoStack: [],
    })
  },

  captureSnapshot: (label, snapshot) => {
    const { undoStack, maxStack } = get()
    const snap = snapshotFrom(label, snapshot)
    set({
      undoStack: [...undoStack.slice(-(maxStack - 1)), snap],
      redoStack: [],
    })
  },

  undo: () => {
    const { undoStack, redoStack } = get()
    if (undoStack.length === 0) return
    const current = currentState()
    const snap = undoStack[undoStack.length - 1]
    useNodeStore.getState().setNodes(snap.nodes)
    useEdgeStore.getState().setEdges(snap.edges)
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, current],
    })
    useProjectStore.getState().markDirty()
  },

  redo: () => {
    const { undoStack, redoStack } = get()
    if (redoStack.length === 0) return
    const current = currentState()
    const snap = redoStack[redoStack.length - 1]
    useNodeStore.getState().setNodes(snap.nodes)
    useEdgeStore.getState().setEdges(snap.edges)
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, current],
    })
    useProjectStore.getState().markDirty()
  },

  clear: () => set({ undoStack: [], redoStack: [] }),

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
}))

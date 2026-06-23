import { create } from 'zustand'
import type { Viewport } from '@xyflow/react'

interface CanvasState {
  viewport: Viewport
  setViewport: (vp: Viewport) => void
  lastMouseFlowPosition: { x: number; y: number } | null
  setLastMouseFlowPosition: (position: { x: number; y: number } | null) => void
  undoStack: unknown[]
  redoStack: unknown[]
  pushUndo: (snapshot: unknown) => void
  undo: () => unknown | undefined
  redo: () => unknown | undefined
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  lastMouseFlowPosition: null,
  undoStack: [],
  redoStack: [],
  setViewport: (vp) => set({ viewport: vp }),
  setLastMouseFlowPosition: (position) => set({ lastMouseFlowPosition: position }),
  pushUndo: (snapshot) =>
    set((s) => ({ undoStack: [...s.undoStack.slice(-49), snapshot], redoStack: [] })),
  undo: () => {
    const { undoStack, redoStack } = get()
    if (undoStack.length === 0) return undefined
    const last = undoStack[undoStack.length - 1]
    set({ undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, last] })
    return last
  },
  redo: () => {
    const { undoStack, redoStack } = get()
    if (redoStack.length === 0) return undefined
    const last = redoStack[redoStack.length - 1]
    set({ redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, last] })
    return last
  },
}))

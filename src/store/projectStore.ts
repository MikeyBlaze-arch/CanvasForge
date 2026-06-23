import { create } from 'zustand'
import type { Viewport } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import type { CanvasNodeData, HistoryRecord } from '../canvas/nodeTypes'

export type ProjectData = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  viewport: Viewport
  nodes: Node<CanvasNodeData>[]
  edges: Edge[]
  history: HistoryRecord[]
}

interface ProjectState {
  currentProject: ProjectData | null
  isDirty: boolean
  lastSavedAt: number | null
  createProject: (name?: string) => ProjectData
  loadProject: (project: ProjectData) => void
  markDirty: () => void
  markSaved: () => void
  updateProjectName: (name: string) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  isDirty: false,
  lastSavedAt: null,

  createProject: (name) => {
    const project: ProjectData = {
      id: 'proj_' + Date.now().toString(36),
      name: name ?? '未命名项目',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [],
      edges: [],
      history: [],
    }
    set({ currentProject: project, isDirty: false })
    return project
  },

  loadProject: (project) => set({ currentProject: project, isDirty: false }),

  markDirty: () => set({ isDirty: true }),

  markSaved: () => set({ isDirty: false, lastSavedAt: Date.now() }),

  updateProjectName: (name) =>
    set((s) => ({
      currentProject: s.currentProject
        ? { ...s.currentProject, name, updatedAt: Date.now() }
        : null,
      isDirty: true,
    })),
}))

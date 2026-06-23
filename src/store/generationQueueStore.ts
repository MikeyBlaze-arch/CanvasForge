import { create } from 'zustand'

export type GenTaskStatus = 'pending' | 'running' | 'success' | 'failed'

export type GenTask = {
  id: string
  nodeId: string
  type: 'image' | 'llm'
  status: GenTaskStatus
  error?: string
  createdAt: number
  completedAt?: number
}

interface GenQueueState {
  tasks: GenTask[]
  addTask: (task: GenTask) => void
  updateTaskStatus: (id: string, status: GenTaskStatus, error?: string) => void
  removeTask: (id: string) => void
}

export const useGenerationQueueStore = create<GenQueueState>((set) => ({
  tasks: [],
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTaskStatus: (id, status, error) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? { ...t, status, error, completedAt: status === 'success' || status === 'failed' ? Date.now() : undefined }
          : t
      ),
    })),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
}))

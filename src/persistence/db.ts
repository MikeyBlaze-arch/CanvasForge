import Dexie, { type Table } from 'dexie'
import type { HistoryRecord } from '../canvas/nodeTypes'

export interface ProjectRow {
  id: string
  name: string
  data: string // JSON serialized
  createdAt: number
  updatedAt: number
}

export interface AssetRow {
  id: string
  projectId: string
  blob: Blob
  mimeType: string
  createdAt: number
}

export interface HistoryRow {
  id: string
  data: string // JSON serialized
  createdAt: number
}

export interface HistoryBlobRow {
  key: string
  blob: Blob
  mimeType: string
  createdAt: number
}

class CanvasForgeDB extends Dexie {
  projects!: Table<ProjectRow>
  assets!: Table<AssetRow>
  history!: Table<HistoryRow>
  historyBlobs!: Table<HistoryBlobRow>

  constructor() {
    super('CanvasForgeDB')
    this.version(1).stores({
      projects: 'id, name, updatedAt',
      assets: 'id, projectId',
    })
    this.version(2).stores({
      projects: 'id, name, updatedAt',
      assets: 'id, projectId',
      history: 'id, createdAt',
    }).upgrade(tx => {
      // empty upgrade - just adds the history table
    })
    this.version(3).stores({
      projects: 'id, name, updatedAt',
      assets: 'id, projectId',
      history: 'id, createdAt',
      historyBlobs: 'key, createdAt',
    })
  }
}

export const db = new CanvasForgeDB()

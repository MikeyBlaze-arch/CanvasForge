import type { HistoryRecord } from '../canvas/nodeTypes'
import { db } from '../persistence/db'
import {
  dedupeHistoryRecords,
  enforceHistoryLimit,
  HISTORY_LOCAL_STORAGE_KEY,
  HISTORY_SCHEMA_VERSION,
  HISTORY_STORAGE_META_KEY,
  migrateHistoryItems,
  normalizeHistoryRecord,
  sortByNewest,
} from './historyMigration'

function readLocalStorageHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_LOCAL_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HistoryRecord[]
  } catch {
    return []
  }
}

function markLocalStorageMigrated() {
  try {
    localStorage.setItem(HISTORY_STORAGE_META_KEY, JSON.stringify({
      schemaVersion: HISTORY_SCHEMA_VERSION,
      migratedAt: Date.now(),
      storage: 'indexeddb',
    }))
    localStorage.removeItem(HISTORY_LOCAL_STORAGE_KEY)
  } catch {
    // Ignore localStorage failures.
  }
}

async function writeRows(records: HistoryRecord[]) {
  await db.history.bulkPut(records.map((record) => ({
    id: record.id,
    createdAt: record.createdAt || Date.now(),
    data: JSON.stringify(record),
  })))
}

export async function loadHistoryRecords(): Promise<HistoryRecord[]> {
  try {
    const rows = await db.history.orderBy('createdAt').reverse().toArray()
    if (rows.length > 0) {
      const records = migrateHistoryItems(rows.map((row) => {
        try {
          return JSON.parse(row.data) as HistoryRecord
        } catch {
          return { id: row.id, type: 'image', sourceNodeId: '', modelSeries: 'G', modelId: '', promptSnapshot: '', naturalWidth: 0, naturalHeight: 0, createdAt: row.createdAt } as HistoryRecord
        }
      }))
      // migrateHistoryItems already drops failed records; dedupe cleans up any
      // legacy duplicate ids left over from earlier optimistic-insert bugs.
      const limited = enforceHistoryLimit(dedupeHistoryRecords(records))
      if (limited.length !== records.length || records.some((record) => record.schemaVersion !== HISTORY_SCHEMA_VERSION)) {
        await replaceHistoryRecords(limited)
      }
      markLocalStorageMigrated()
      return limited
    }

    const legacy = migrateHistoryItems(readLocalStorageHistory())
    const limited = enforceHistoryLimit(dedupeHistoryRecords(legacy))
    if (limited.length > 0) await writeRows(limited)
    markLocalStorageMigrated()
    return limited
  } catch {
    return enforceHistoryLimit(dedupeHistoryRecords(migrateHistoryItems(readLocalStorageHistory())))
  }
}

export async function replaceHistoryRecords(records: HistoryRecord[]): Promise<HistoryRecord[]> {
  const limited = enforceHistoryLimit(dedupeHistoryRecords(records.map(normalizeHistoryRecord)))
  await db.history.clear()
  if (limited.length > 0) await writeRows(limited)
  markLocalStorageMigrated()
  return limited
}

export async function addHistoryRecord(record: HistoryRecord, currentRecords: HistoryRecord[]): Promise<HistoryRecord[]> {
  const normalized = normalizeHistoryRecord(record)
  // Drop any stale copy of the same id before prepending so the record never
  // exists twice — even if an upstream caller forgot to filter.
  const withoutSameId = currentRecords.filter((item) => item.id !== normalized.id)
  const next = enforceHistoryLimit(dedupeHistoryRecords([normalized, ...withoutSameId]))
  await replaceHistoryRecords(next)
  return next
}

export async function removeHistoryRecords(ids: string[], currentRecords: HistoryRecord[]): Promise<HistoryRecord[]> {
  const idSet = new Set(ids)
  const next = sortByNewest(currentRecords.filter((record) => !idSet.has(record.id)))
  try {
    await db.history.bulkDelete(ids)
  } catch {
    await replaceHistoryRecords(next)
  }
  return next
}

export async function clearHistoryRecords(): Promise<void> {
  await db.history.clear()
  try {
    localStorage.removeItem(HISTORY_LOCAL_STORAGE_KEY)
  } catch {
    // Ignore localStorage failures.
  }
}

export function exportHistoryRecords(records: HistoryRecord[]): string {
  return JSON.stringify({
    schemaVersion: HISTORY_SCHEMA_VERSION,
    exportedAt: Date.now(),
    items: records,
  }, null, 2)
}

export function parseImportedHistoryJson(json: string, existingIds: Set<string>): HistoryRecord[] {
  const parsed = JSON.parse(json) as { items?: HistoryRecord[] } | HistoryRecord[]
  const items = Array.isArray(parsed) ? parsed : parsed.items || []
  return migrateHistoryItems(items).map((record) => {
    if (!existingIds.has(record.id)) return record
    return {
      ...record,
      id: `${record.id}_import_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    }
  })
}

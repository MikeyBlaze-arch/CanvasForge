import { describe, it, expect } from 'vitest'
import {
  normalizeHistoryRecord,
  migrateHistoryItems,
  dedupeHistoryRecords,
  enforceHistoryLimit,
  sortByNewest,
  stripLargeImageDataForExport,
  HISTORY_SCHEMA_VERSION,
  MAX_HISTORY_ITEMS,
} from '../historyMigration'
import type { HistoryRecord } from '../../canvas/nodeTypes'

describe('historyMigration', () => {
  describe('normalizeHistoryRecord', () => {
    it('should set current schema version', () => {
      const record = normalizeHistoryRecord({
        id: 'test1',
        type: 'image',
        status: 'success',
        imageUrl: 'https://example.com/img.png',
        createdAt: 1000,
      } as any)

      expect(record.schemaVersion).toBe(HISTORY_SCHEMA_VERSION)
    })

    it('should preserve all essential fields', () => {
      const record = normalizeHistoryRecord({
        id: 'test1',
        type: 'image',
        status: 'success',
        imageUrl: 'https://example.com/img.png',
        url: 'https://example.com/img.png',
        thumbnailUrl: 'https://example.com/thumb.png',
        modelSeries: 'G',
        modelId: 'g-gpt-image-2',
        promptSnapshot: 'test prompt',
        createdAt: 1000,
      } as any)

      expect(record.id).toBe('test1')
      expect(record.type).toBe('image')
      expect(record.status).toBe('success')
      expect(record.imageUrl).toBe('https://example.com/img.png')
      expect(record.thumbnailUrl).toBe('https://example.com/thumb.png')
      expect(record.modelSeries).toBe('G')
      expect(record.promptSnapshot).toBe('test prompt')
    })

    it('should normalize legacy model selection', () => {
      const record = normalizeHistoryRecord({
        id: 'test1',
        type: 'image',
        status: 'success',
        imageUrl: 'https://example.com/img.png',
        modelId: 'legacy-model-name',
        createdAt: 1000,
      } as any)

      expect(record.modelId).toBeDefined()
      expect(record.modelSeries).toBeDefined()
    })

    it('should handle missing thumbnailUrl by using imageUrl', () => {
      const record = normalizeHistoryRecord({
        id: 'test1',
        type: 'image',
        status: 'success',
        imageUrl: 'https://example.com/img.png',
        createdAt: 1000,
      } as any)

      expect(record.thumbnailUrl).toBe('https://example.com/img.png')
    })

    it('should handle missing url by using imageUrl', () => {
      const record = normalizeHistoryRecord({
        id: 'test1',
        type: 'image',
        status: 'success',
        imageUrl: 'https://example.com/img.png',
        createdAt: 1000,
      } as any)

      expect(record.url).toBe('https://example.com/img.png')
    })
  })

  describe('migrateHistoryItems', () => {
    it('should return empty array for empty input', () => {
      const result = migrateHistoryItems([])
      expect(result).toEqual([])
    })

    it('should split legacy batch records into individual records', () => {
      const legacyBatch = {
        id: 'batch1',
        type: 'image',
        status: 'success',
        imageUrl: 'https://example.com/img1.png',
        imageUrls: [
          'https://example.com/img1.png',
          'https://example.com/img2.png',
          'https://example.com/img3.png',
        ],
        modelSeries: 'G',
        modelId: 'g-gpt-image-2',
        promptSnapshot: 'test',
        createdAt: 1000,
      } as any

      const result = migrateHistoryItems([legacyBatch])

      expect(result.length).toBe(3)
      expect(result[0].batchId).toBe('batch1')
      expect(result[0].batchIndex).toBe(1)
      expect(result[0].batchTotal).toBe(3)
      expect(result[0].imageUrl).toBe('https://example.com/img1.png')

      expect(result[1].batchId).toBe('batch1')
      expect(result[1].batchIndex).toBe(2)
      expect(result[1].imageUrl).toBe('https://example.com/img2.png')

      expect(result[2].batchIndex).toBe(3)
      expect(result[2].imageUrl).toBe('https://example.com/img3.png')
    })

    it('should preserve single-image records as-is', () => {
      const singleRecord = {
        id: 'single1',
        type: 'image',
        status: 'success',
        imageUrl: 'https://example.com/img.png',
        modelSeries: 'R',
        modelId: 'r-gpt-image-2',
        promptSnapshot: 'test',
        createdAt: 1000,
      } as any

      const result = migrateHistoryItems([singleRecord])

      expect(result.length).toBe(1)
      expect(result[0].id).toBe('single1')
      expect(result[0].imageUrl).toBe('https://example.com/img.png')
    })

    it('should handle mixed batch and single records', () => {
      const records = [
        {
          id: 'single1',
          type: 'image',
          status: 'success',
          imageUrl: 'https://example.com/img1.png',
          createdAt: 1000,
        },
        {
          id: 'batch1',
          type: 'image',
          status: 'success',
          imageUrl: 'https://example.com/img2.png',
          imageUrls: ['https://example.com/img2.png', 'https://example.com/img3.png'],
          createdAt: 2000,
        },
      ] as any[]

      const result = migrateHistoryItems(records)

      expect(result.length).toBe(3)
      expect(result[0].id).toBe('single1')
      expect(result[1].batchId).toBe('batch1')
      expect(result[2].batchId).toBe('batch1')
    })

    it('should preserve thumbnail URLs during migration', () => {
      const record = {
        id: 'test1',
        type: 'image',
        status: 'success',
        imageUrl: 'https://example.com/img.png',
        thumbnailUrl: 'https://example.com/thumb.png',
        createdAt: 1000,
      } as any

      const result = migrateHistoryItems([record])

      expect(result[0].thumbnailUrl).toBe('https://example.com/thumb.png')
    })

    it('should generate thumbnail URL from imageUrl when missing', () => {
      const record = {
        id: 'test1',
        type: 'image',
        status: 'success',
        imageUrl: 'https://example.com/img.png',
        createdAt: 1000,
      } as any

      const result = migrateHistoryItems([record])

      expect(result[0].thumbnailUrl).toBe('https://example.com/img.png')
    })
  })

  describe('dedupeHistoryRecords', () => {
    it('should remove duplicate IDs keeping first occurrence', () => {
      const records = [
        { id: 'id1', createdAt: 3000 },
        { id: 'id2', createdAt: 2000 },
        { id: 'id1', createdAt: 1000 },
      ] as any[]

      const result = dedupeHistoryRecords(records)

      expect(result.length).toBe(2)
      expect(result[0].id).toBe('id1')
      expect(result[0].createdAt).toBe(3000)
      expect(result[1].id).toBe('id2')
    })

    it('should preserve records without ID', () => {
      const records = [
        { id: 'id1', createdAt: 3000 },
        { createdAt: 2000 },
        { id: 'id1', createdAt: 1000 },
      ] as any[]

      const result = dedupeHistoryRecords(records)

      expect(result.length).toBe(2)
      expect(result[0].id).toBe('id1')
      expect(result[1].id).toBeUndefined()
    })

    it('should handle empty array', () => {
      const result = dedupeHistoryRecords([])
      expect(result).toEqual([])
    })

    it('should handle all unique IDs', () => {
      const records = [
        { id: 'id1', createdAt: 3000 },
        { id: 'id2', createdAt: 2000 },
        { id: 'id3', createdAt: 1000 },
      ] as any[]

      const result = dedupeHistoryRecords(records)

      expect(result.length).toBe(3)
    })
  })

  describe('enforceHistoryLimit', () => {
    it('should limit records to MAX_HISTORY_ITEMS by default', () => {
      const records = Array.from({ length: MAX_HISTORY_ITEMS + 100 }, (_, i) => ({
        id: `id${i}`,
        createdAt: i,
      })) as HistoryRecord[]

      const result = enforceHistoryLimit(records)

      expect(result.length).toBe(MAX_HISTORY_ITEMS)
    })

    it('should keep newest records when limiting', () => {
      const records = [
        { id: 'old', createdAt: 1000 },
        { id: 'newer', createdAt: 2000 },
        { id: 'newest', createdAt: 3000 },
      ] as HistoryRecord[]

      const result = enforceHistoryLimit(records, 2)

      expect(result.length).toBe(2)
      expect(result[0].id).toBe('newest')
      expect(result[1].id).toBe('newer')
    })

    it('should handle custom maxItems parameter', () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        id: `id${i}`,
        createdAt: i,
      })) as HistoryRecord[]

      const result = enforceHistoryLimit(records, 50)

      expect(result.length).toBe(50)
    })

    it('should return all records when under limit', () => {
      const records = [
        { id: 'id1', createdAt: 1000 },
        { id: 'id2', createdAt: 2000 },
      ] as HistoryRecord[]

      const result = enforceHistoryLimit(records, 100)

      expect(result.length).toBe(2)
    })

    it('should sort by newest when maxItems is 0 or negative', () => {
      const records = [
        { id: 'old', createdAt: 1000 },
        { id: 'newest', createdAt: 3000 },
        { id: 'newer', createdAt: 2000 },
      ] as HistoryRecord[]

      const result = enforceHistoryLimit(records, 0)

      expect(result[0].id).toBe('newest')
      expect(result[1].id).toBe('newer')
      expect(result[2].id).toBe('old')
    })
  })

  describe('sortByNewest', () => {
    it('should sort records by createdAt descending', () => {
      const records = [
        { id: 'id1', createdAt: 1000 },
        { id: 'id3', createdAt: 3000 },
        { id: 'id2', createdAt: 2000 },
      ] as HistoryRecord[]

      const result = sortByNewest(records)

      expect(result[0].createdAt).toBe(3000)
      expect(result[1].createdAt).toBe(2000)
      expect(result[2].createdAt).toBe(1000)
    })

    it('should handle missing createdAt as 0', () => {
      const records = [
        { id: 'id1', createdAt: 1000 },
        { id: 'id2' },
        { id: 'id3', createdAt: 3000 },
      ] as any[]

      const result = sortByNewest(records)

      expect(result[0].createdAt).toBe(3000)
      expect(result[1].createdAt).toBe(1000)
      expect(result[2].createdAt).toBeUndefined()
    })

    it('should not mutate original array', () => {
      const records = [
        { id: 'id1', createdAt: 1000 },
        { id: 'id2', createdAt: 2000 },
      ] as HistoryRecord[]

      const result = sortByNewest(records)

      expect(records[0].id).toBe('id1')
      expect(result[0].id).toBe('id2')
    })
  })

  describe('stripLargeImageDataForExport', () => {
    it('should strip data URLs from url field', () => {
      const record = {
        id: 'test1',
        type: 'image',
        status: 'success',
        url: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
        createdAt: 1000,
      } as any

      const result = stripLargeImageDataForExport(record)

      expect(result.url).toBeUndefined()
    })

    it('should strip data URLs from imageUrl field', () => {
      const record = {
        id: 'test1',
        type: 'image',
        status: 'success',
        imageUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        createdAt: 1000,
      } as any

      const result = stripLargeImageDataForExport(record)

      expect(result.imageUrl).toBeUndefined()
    })

    it('should strip data URLs from originalUrl field', () => {
      const record = {
        id: 'test1',
        type: 'image',
        status: 'success',
        originalUrl: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
        createdAt: 1000,
      } as any

      const result = stripLargeImageDataForExport(record)

      expect(result.originalUrl).toBeUndefined()
    })

    it('should preserve HTTP URLs', () => {
      const record = {
        id: 'test1',
        type: 'image',
        status: 'success',
        url: 'https://example.com/img.png',
        imageUrl: 'https://example.com/img.png',
        originalUrl: 'https://example.com/img.png',
        createdAt: 1000,
      } as any

      const result = stripLargeImageDataForExport(record)

      expect(result.url).toBe('https://example.com/img.png')
      expect(result.imageUrl).toBe('https://example.com/img.png')
      expect(result.originalUrl).toBe('https://example.com/img.png')
    })

    it('should strip data URLs from imageUrls array', () => {
      const record = {
        id: 'test1',
        type: 'image',
        status: 'success',
        imageUrls: [
          'https://example.com/img1.png',
          'data:image/png;base64,iVBORw0KGgoAAAANS...',
          'https://example.com/img2.png',
        ],
        createdAt: 1000,
      } as any

      const result = stripLargeImageDataForExport(record)

      expect(result.imageUrls).toEqual([
        'https://example.com/img1.png',
        'https://example.com/img2.png',
      ])
    })

    it('should not mutate original record', () => {
      const record = {
        id: 'test1',
        type: 'image',
        status: 'success',
        url: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
        createdAt: 1000,
      } as any

      const result = stripLargeImageDataForExport(record)

      expect(record.url).toBe('data:image/png;base64,iVBORw0KGgoAAAANS...')
      expect(result.url).toBeUndefined()
    })
  })

  describe('integration: full migration workflow', () => {
    it('should handle complete migration pipeline', () => {
      const legacyRecords = [
        {
          id: 'batch1',
          type: 'image',
          status: 'success',
          imageUrl: 'https://example.com/img1.png',
          imageUrls: ['https://example.com/img1.png', 'https://example.com/img2.png'],
          modelId: 'legacy-model',
          createdAt: 3000,
        },
        {
          id: 'single1',
          type: 'image',
          status: 'success',
          imageUrl: 'https://example.com/img3.png',
          createdAt: 2000,
        },
        {
          id: 'batch1',
          type: 'image',
          status: 'success',
          imageUrl: 'https://example.com/img1.png',
          createdAt: 1000,
        },
      ] as any[]

      const migrated = migrateHistoryItems(legacyRecords)
      const deduped = dedupeHistoryRecords(migrated)
      const limited = enforceHistoryLimit(deduped, 10)

      expect(limited.length).toBeGreaterThan(0)
      expect(limited[0].schemaVersion).toBe(HISTORY_SCHEMA_VERSION)
      expect(limited.every(r => r.modelSeries && r.modelId)).toBe(true)
    })
  })
})

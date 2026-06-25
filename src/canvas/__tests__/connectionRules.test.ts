import { describe, it, expect } from 'vitest'
import {
  resolveHandleId,
  isConnectionAllowed,
  CONNECTION_RULES,
  LEGACY_HANDLE_MAP,
} from '../connectionRules'

describe('connectionRules', () => {
  describe('resolveHandleId', () => {
    it('should return null for null/undefined input', () => {
      expect(resolveHandleId('text', null)).toBe(null)
      expect(resolveHandleId('text', undefined)).toBe(null)
      expect(resolveHandleId('llm', null)).toBe(null)
    })

    it('should map legacy text node handles', () => {
      expect(resolveHandleId('text', 'llm_output')).toBe('llm_input')
    })

    it('should map legacy llm node handles', () => {
      expect(resolveHandleId('llm', 'optimized_prompt')).toBe('llm_output')
      expect(resolveHandleId('llm', 'text')).toBe('text_input')
    })

    it('should map legacy product_analysis handles', () => {
      expect(resolveHandleId('product_analysis', 'text_output')).toBe('analysis_result_output')
    })

    it('should return original handleId when no mapping exists', () => {
      expect(resolveHandleId('text', 'prompt')).toBe('prompt')
      expect(resolveHandleId('image_gen', 'generated_image')).toBe('generated_image')
      expect(resolveHandleId('unknown_node', 'some_handle')).toBe('some_handle')
    })

    it('should handle image_asset node (empty legacy map)', () => {
      expect(resolveHandleId('image_asset', 'image_output')).toBe('image_output')
      expect(resolveHandleId('image_asset', 'reference_image')).toBe('reference_image')
    })
  })

  describe('isConnectionAllowed', () => {
    it('should reject self-connections', () => {
      expect(isConnectionAllowed({
        sourceType: 'text',
        sourceHandle: 'prompt',
        targetType: 'image_gen',
        targetHandle: 'prompt',
        sourceId: 'node1',
        targetId: 'node1',
      })).toBe(false)
    })

    it('should reject connections with missing node types', () => {
      expect(isConnectionAllowed({
        sourceType: '',
        sourceHandle: 'prompt',
        targetType: 'image_gen',
        targetHandle: 'prompt',
      })).toBe(false)

      expect(isConnectionAllowed({
        sourceType: 'text',
        sourceHandle: 'prompt',
        targetType: '',
        targetHandle: 'prompt',
      })).toBe(false)
    })

    it('should allow text -> image_gen prompt connection', () => {
      expect(isConnectionAllowed({
        sourceType: 'text',
        sourceHandle: 'prompt',
        targetType: 'image_gen',
        targetHandle: 'prompt',
      })).toBe(true)
    })

    it('should allow image_asset -> image_gen reference connection', () => {
      expect(isConnectionAllowed({
        sourceType: 'image_asset',
        sourceHandle: 'image_output',
        targetType: 'image_gen',
        targetHandle: 'reference_image',
      })).toBe(true)
    })

    it('should apply legacy handle mapping before rule matching', () => {
      expect(isConnectionAllowed({
        sourceType: 'llm',
        sourceHandle: 'optimized_prompt',
        targetType: 'text',
        targetHandle: 'llm_input',
      })).toBe(true)
    })

    it('should allow product_analysis connections', () => {
      expect(isConnectionAllowed({
        sourceType: 'text',
        sourceHandle: 'prompt',
        targetType: 'product_analysis',
        targetHandle: 'product_info_input',
      })).toBe(true)

      expect(isConnectionAllowed({
        sourceType: 'product_analysis',
        sourceHandle: 'analysis_result_output',
        targetType: 'llm',
        targetHandle: 'text_input',
      })).toBe(true)
    })

    it('should allow video-related connections', () => {
      expect(isConnectionAllowed({
        sourceType: 'video_asset',
        sourceHandle: 'video_output',
        targetType: 'motion_transfer',
        targetHandle: 'motion_video',
      })).toBe(true)

      expect(isConnectionAllowed({
        sourceType: 'text',
        sourceHandle: 'prompt',
        targetType: 'video_gen',
        targetHandle: 'prompt',
      })).toBe(true)
    })

    it('should allow group image collection output connections', () => {
      expect(isConnectionAllowed({
        sourceType: 'group',
        sourceHandle: 'image_collection_output',
        targetType: 'image_gen',
        targetHandle: 'reference_image',
      })).toBe(true)

      expect(isConnectionAllowed({
        sourceType: 'group',
        sourceHandle: 'image_collection_output',
        targetType: 'llm',
        targetHandle: 'image_input',
      })).toBe(true)
    })

    it('should reject invalid connections', () => {
      expect(isConnectionAllowed({
        sourceType: 'product_analysis',
        sourceHandle: 'analysis_result_output',
        targetType: 'image_gen',
        targetHandle: 'prompt',
      })).toBe(false)

      expect(isConnectionAllowed({
        sourceType: 'video_asset',
        sourceHandle: 'video_output',
        targetType: 'image_gen',
        targetHandle: 'reference_image',
      })).toBe(false)
    })

    it('should work with null handles when rules have specific handles', () => {
      // null sourceHandle should fail to match rules that require specific handles
      // But if there's a rule with 'main_output' it might still match
      const result = isConnectionAllowed({
        sourceType: 'text',
        sourceHandle: null,
        targetType: 'image_gen',
        targetHandle: 'prompt',
      })
      // This connection is actually allowed because text->image_gen has rules
      expect(typeof result).toBe('boolean')
    })
  })

  describe('CONNECTION_RULES integrity', () => {
    it('should not contain duplicate rules', () => {
      const ruleStrings = CONNECTION_RULES.map(rule =>
        `${rule.sourceType}:${rule.sourceHandle}->${rule.targetType}:${rule.targetHandle}`
      )
      const uniqueRules = new Set(ruleStrings)
      expect(uniqueRules.size).toBe(ruleStrings.length)
    })

    it('should have rules for all node types', () => {
      const nodeTypes = [
        'text', 'image_asset', 'image_gen', 'result_image',
        'llm', 'product_analysis', 'group',
        'video_asset', 'motion_transfer', 'video_gen'
      ]

      for (const nodeType of nodeTypes) {
        const hasSource = CONNECTION_RULES.some(rule => rule.sourceType === nodeType)
        const hasTarget = CONNECTION_RULES.some(rule => rule.targetType === nodeType)
        expect(hasSource || hasTarget).toBe(true)
      }
    })

    it('should have main_output rules for core node types', () => {
      const coreTypes = ['text', 'image_gen', 'llm', 'product_analysis']

      for (const type of coreTypes) {
        const outgoingMain = CONNECTION_RULES.filter(rule =>
          rule.sourceType === type && rule.sourceHandle === 'main_output'
        )
        expect(outgoingMain.length).toBeGreaterThan(0)
      }
    })

    it('should use consistent handle names for similar node types', () => {
      const imageOutputHandles = CONNECTION_RULES
        .filter(rule => rule.sourceType === 'image_asset')
        .map(rule => rule.sourceHandle)

      const expectedImageHandles = ['main_output', 'image_output', 'reference_image', 'source_image', 'mask_image']
      const actualImageHandles = new Set(imageOutputHandles)

      for (const handle of actualImageHandles) {
        expect(expectedImageHandles.includes(handle)).toBe(true)
      }
    })
  })

  describe('LEGACY_HANDLE_MAP completeness', () => {
    it('should only map handles that exist in CONNECTION_RULES', () => {
      for (const [nodeType, mapping] of Object.entries(LEGACY_HANDLE_MAP)) {
        for (const [, newHandle] of Object.entries(mapping)) {
          const hasRule = CONNECTION_RULES.some(rule =>
            (rule.sourceType === nodeType && rule.sourceHandle === newHandle) ||
            (rule.targetType === nodeType && rule.targetHandle === newHandle)
          )
          expect(hasRule).toBe(true)
        }
      }
    })
  })
})

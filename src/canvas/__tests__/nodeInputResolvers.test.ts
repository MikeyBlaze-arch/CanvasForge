import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import {
  getImageGenInputs,
  getLLMInputs,
  getProductAnalysisInputs,
  getVideoGenInputs,
} from '../nodeInputResolvers'
import type { CanvasNodeData } from '../nodeTypes'

describe('nodeInputResolvers', () => {
  describe('getImageGenInputs', () => {
    it('should return empty values when no upstream connections', () => {
      const result = getImageGenInputs(
        'node1',
        [] as Node<CanvasNodeData>[],
        [] as Edge[],
        ''
      )

      expect(result.prompt).toBe('')
      expect(result.negativePrompt).toBe('')
      expect(result.referenceImages).toEqual([])
      expect(result.connectedPromptNodeCount).toBe(0)
      expect(result.connectedReferenceImageNodeCount).toBe(0)
    })

    it('should collect single prompt from connected text node', () => {
      const nodes: Node<CanvasNodeData>[] = [
        {
          id: 'text1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'text',
            title: 'Prompt',
            textKind: 'prompt',
            content: 'a beautiful sunset',
            language: 'en',
            updatedAt: 1,
          },
        },
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'text1', target: 'node1', sourceHandle: 'prompt', targetHandle: 'prompt' },
      ]

      const result = getImageGenInputs('node1', nodes, edges, '')

      expect(result.prompt).toBe('a beautiful sunset')
      expect(result.connectedPromptNodeCount).toBe(1)
    })

    it('should collect multiple prompts from multiple text nodes', () => {
      const nodes: Node<CanvasNodeData>[] = [
        {
          id: 'text1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'text',
            title: 'Main',
            textKind: 'prompt',
            content: 'sunset',
            language: 'en',
            updatedAt: 1,
          },
        },
        {
          id: 'text2',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'text',
            title: 'Style',
            textKind: 'style_prompt',
            content: 'oil painting',
            language: 'en',
            updatedAt: 1,
          },
        },
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'text1', target: 'node1', sourceHandle: 'prompt', targetHandle: 'prompt' },
        { id: 'e2', source: 'text2', target: 'node1', sourceHandle: 'prompt', targetHandle: 'prompt' },
      ]

      const result = getImageGenInputs('node1', nodes, edges, 'own text')

      expect(result.prompt.includes('sunset')).toBe(true)
      expect(result.prompt.includes('oil painting')).toBe(true)
      expect(result.prompt.includes('own text')).toBe(true)
      expect(result.connectedPromptNodeCount).toBe(2)
    })

    it('should collect reference images from image_asset nodes', () => {
      const nodes: Node<CanvasNodeData>[] = [
        {
          id: 'img1',
          type: 'image_asset',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'image_asset',
            title: 'Ref',
            imageUrl: 'https://example.com/ref1.png',
            role: 'reference',
            createdAt: 1,
            updatedAt: 1,
          },
        },
        {
          id: 'img2',
          type: 'image_asset',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'image_asset',
            title: 'Ref2',
            imageUrl: 'https://example.com/ref2.png',
            role: 'reference',
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'img1', target: 'node1', sourceHandle: 'reference_image', targetHandle: 'reference_image' },
        { id: 'e2', source: 'img2', target: 'node1', sourceHandle: 'reference_image', targetHandle: 'reference_image' },
      ]

      const result = getImageGenInputs('node1', nodes, edges, '')

      expect(result.referenceImages.length).toBe(2)
      expect(result.referenceImages).toContain('https://example.com/ref1.png')
      expect(result.referenceImages).toContain('https://example.com/ref2.png')
      expect(result.connectedReferenceImageNodeCount).toBe(2)
    })

    it('should handle negative prompts correctly', () => {
      const nodes: Node<CanvasNodeData>[] = [
        {
          id: 'text1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'text',
            title: 'Negative',
            textKind: 'negative_prompt',
            content: 'blurry, low quality',
            language: 'en',
            updatedAt: 1,
          },
        },
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'text1', target: 'node1', sourceHandle: 'negative_prompt', targetHandle: 'negative_prompt' },
      ]

      const result = getImageGenInputs('node1', nodes, edges, '')

      expect(result.negativePrompt).toBe('blurry, low quality')
    })
  })

  describe('getLLMInputs', () => {
    it('should return empty values when no upstream connections', () => {
      const result = getLLMInputs(
        'node1',
        [] as Node<CanvasNodeData>[],
        [] as Edge[],
        ''
      )

      expect(result.inputText).toBe('')
      expect(result.imageInputs).toEqual([])
      expect(result.connectedTextNodeCount).toBe(0)
      expect(result.connectedImageNodeCount).toBe(0)
    })

    it('should collect single text input from connected text node', () => {
      const nodes: Node<CanvasNodeData>[] = [
        {
          id: 'text1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'text',
            title: 'Input',
            textKind: 'prompt',
            content: 'analyze this',
            language: 'en',
            updatedAt: 1,
          },
        },
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'text1', target: 'node1', sourceHandle: 'main_output', targetHandle: 'text_input' },
      ]

      const result = getLLMInputs('node1', nodes, edges, '')

      expect(result.inputText).toBe('analyze this')
      expect(result.connectedTextNodeCount).toBe(1)
    })

    it('should collect multiple text inputs from multiple nodes', () => {
      const nodes: Node<CanvasNodeData>[] = [
        {
          id: 'text1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'text',
            title: 'Input1',
            textKind: 'prompt',
            content: 'part one',
            language: 'en',
            updatedAt: 1,
          },
        },
        {
          id: 'text2',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'text',
            title: 'Input2',
            textKind: 'prompt',
            content: 'part two',
            language: 'en',
            updatedAt: 1,
          },
        },
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'text1', target: 'node1', sourceHandle: 'main_output', targetHandle: 'text_input' },
        { id: 'e2', source: 'text2', target: 'node1', sourceHandle: 'main_output', targetHandle: 'text_input' },
      ]

      const result = getLLMInputs('node1', nodes, edges, 'user input')

      expect(result.inputText.includes('part one')).toBe(true)
      expect(result.inputText.includes('part two')).toBe(true)
      expect(result.inputText.includes('user input')).toBe(true)
      expect(result.connectedTextNodeCount).toBe(2)
    })

    it('should collect images from image_asset nodes', () => {
      const nodes: Node<CanvasNodeData>[] = [
        {
          id: 'img1',
          type: 'image_asset',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'image_asset',
            title: 'Image',
            imageUrl: 'https://example.com/img1.png',
            role: 'reference',
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'img1', target: 'node1', sourceHandle: 'image_output', targetHandle: 'image_input' },
      ]

      const result = getLLMInputs('node1', nodes, edges, '')

      expect(result.imageInputs.length).toBe(1)
      expect(result.imageInputs[0]).toBe('https://example.com/img1.png')
      expect(result.connectedImageNodeCount).toBe(1)
    })
  })

  describe('getProductAnalysisInputs', () => {
    it('should return empty values when no upstream connections', () => {
      const result = getProductAnalysisInputs(
        'node1',
        [] as Node<CanvasNodeData>[],
        [] as Edge[]
      )

      expect(result.inputText).toBe('')
      expect(result.imageInputs).toEqual([])
      expect(result.connectedInputTextNodeCount).toBe(0)
      expect(result.connectedInputImageNodeCount).toBe(0)
    })

    it('should collect product description from text node', () => {
      const nodes: Node<CanvasNodeData>[] = [
        {
          id: 'text1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'text',
            title: 'Description',
            textKind: 'product_description',
            content: 'Premium coffee maker',
            language: 'en',
            updatedAt: 1,
          },
        },
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'text1', target: 'node1', sourceHandle: 'main_output', targetHandle: 'product_info_input' },
      ]

      const result = getProductAnalysisInputs('node1', nodes, edges)

      expect(result.inputText).toBe('Premium coffee maker')
      expect(result.connectedInputTextNodeCount).toBe(1)
    })

    it('should collect product images from image_asset nodes', () => {
      const nodes: Node<CanvasNodeData>[] = [
        {
          id: 'img1',
          type: 'image_asset',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'image_asset',
            title: 'Product',
            imageUrl: 'https://example.com/product1.png',
            role: 'product',
            createdAt: 1,
            updatedAt: 1,
          },
        },
        {
          id: 'img2',
          type: 'image_asset',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'image_asset',
            title: 'Product2',
            imageUrl: 'https://example.com/product2.png',
            role: 'product',
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'img1', target: 'node1', sourceHandle: 'image_output', targetHandle: 'product_image_input' },
        { id: 'e2', source: 'img2', target: 'node1', sourceHandle: 'image_output', targetHandle: 'product_image_input' },
      ]

      const result = getProductAnalysisInputs('node1', nodes, edges)

      expect(result.imageInputs.length).toBe(2)
      expect(result.connectedInputImageNodeCount).toBe(2)
    })
  })

  describe('getVideoGenInputs', () => {
    it('should return empty values when no upstream connections', () => {
      const result = getVideoGenInputs(
        'node1',
        [] as Node<CanvasNodeData>[],
        [] as Edge[],
        ''
      )

      expect(result.prompt).toBe('')
      expect(result.imageUrl).toBeUndefined()
      expect(result.connectedPromptNodeCount).toBe(0)
      expect(result.connectedImageNodeCount).toBe(0)
    })

    it('should collect prompt from text node', () => {
      const nodes: Node<CanvasNodeData>[] = [
        {
          id: 'text1',
          type: 'text',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'text',
            title: 'Prompt',
            textKind: 'prompt',
            content: 'flying birds',
            language: 'en',
            updatedAt: 1,
          },
        },
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'text1', target: 'node1', sourceHandle: 'prompt', targetHandle: 'prompt' },
      ]

      const result = getVideoGenInputs('node1', nodes, edges, 'node prompt')

      expect(result.prompt.includes('flying birds')).toBe(true)
      expect(result.prompt.includes('node prompt')).toBe(true)
      expect(result.connectedPromptNodeCount).toBe(1)
    })

    it('should collect first frame image from image_asset node', () => {
      const nodes: Node<CanvasNodeData>[] = [
        {
          id: 'img1',
          type: 'image_asset',
          position: { x: 0, y: 0 },
          data: {
            nodeType: 'image_asset',
            title: 'First Frame',
            imageUrl: 'https://example.com/frame.png',
            role: 'source',
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ]

      const edges: Edge[] = [
        { id: 'e1', source: 'img1', target: 'node1', sourceHandle: 'image_output', targetHandle: 'first_frame_image' },
      ]

      const result = getVideoGenInputs('node1', nodes, edges, '')

      expect(result.imageUrl).toBe('https://example.com/frame.png')
      expect(result.connectedImageNodeCount).toBe(1)
    })
  })
})

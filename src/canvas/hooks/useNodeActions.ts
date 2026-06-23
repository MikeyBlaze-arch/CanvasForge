import { useCallback } from 'react'
import { useNodeStore, createNodeId } from '../../store/nodeStore'
import { useEdgeStore } from '../../store/edgeStore'
import { useUndoRedoStore } from '../../store/undoRedoStore'
import { useProjectStore } from '../../store/projectStore'
import type {
  TextNodeData,
  ProductAnalysisNodeData,
  ImageGenNodeData,
  LLMNodeData,
  ImageAssetNodeData,
  GroupNodeData,
  VideoAssetNodeData,
  MotionTransferNodeData,
  VideoGenNodeData,
} from '../nodeTypes'
import { DEFAULT_VIDEO_MODEL_ID, getVideoModelById } from '../../generation/videoModelRegistry'
import { DEFAULT_LLM_MODEL_ID } from '../../generation/llmModelRegistry'
import { t } from '../../i18n/useI18n'
import { createDefaultProductAnalysisNodeData } from '../productAnalysisPrompt'

export function useNodeActions() {
  const addNode = useNodeStore((s) => s.addNode)
  const removeNode = useNodeStore((s) => s.removeNode)
  const cloneNode = useNodeStore((s) => s.cloneNode)
  const removeEdgesByNode = useEdgeStore((s) => s.removeEdgesByNode)

  const addTextNode = useCallback(
    (position: { x: number; y: number }) => {
      const id = createNodeId()
      addNode({
        id,
        type: 'text',
        position,
        data: {
          nodeType: 'text',
          title: t('node.text'),
          textKind: 'prompt',
          content: '',
          language: 'mixed',
          updatedAt: Date.now(),
        } satisfies TextNodeData,
      })
      return id
    },
    [addNode]
  )

  const addProductAnalysisNode = useCallback(
    (position: { x: number; y: number }) => {
      const id = createNodeId()
      addNode({
        id,
        type: 'product_analysis',
        position,
        data: createDefaultProductAnalysisNodeData() satisfies ProductAnalysisNodeData,
      })
      return id
    },
    [addNode]
  )

  const addImageAssetNode = useCallback(
    (position: { x: number; y: number }) => {
      const id = createNodeId()
      addNode({
        id,
        type: 'image_asset',
        position,
        data: {
          nodeType: 'image_asset',
          title: t('node.image'),
          imageUrl: '',
          role: 'reference',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } satisfies ImageAssetNodeData,
      })
      return id
    },
    [addNode]
  )

  const addImageGenNode = useCallback(
    (position: { x: number; y: number }) => {
      const id = createNodeId()
      addNode({
        id,
        type: 'image_gen',
        position,
        data: {
          nodeType: 'image_gen',
          title: t('node.imageGen'),
          modelSeries: 'G',
          modelId: 'g-gpt-image-2',
          aspectRatio: '1:1',
          resolution: '2K',
          batchSize: 1,
          referenceImageOrder: [],
          promptInput: '',
          status: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } satisfies ImageGenNodeData,
      })
      return id
    },
    [addNode]
  )

  const addLLMNode = useCallback(
    (position: { x: number; y: number }) => {
      const id = createNodeId()
      addNode({
        id,
        type: 'llm',
        position,
        data: {
          nodeType: 'llm',
          title: t('node.llm'),
          llmProvider: 'openai_compatible',
          llmModelId: DEFAULT_LLM_MODEL_ID,
          mode: 'chat',
          userInput: '',
          conversation: [],
          status: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } satisfies LLMNodeData,
      })
      return id
    },
    [addNode]
  )

  const addGroupNode = useCallback(
    (position: { x: number; y: number }, name?: string) => {
      useUndoRedoStore.getState().capture('New group')
      const id = createNodeId()
      addNode({
        id,
        type: 'group',
        position,
        data: {
          nodeType: 'group',
          title: name || '',
          childNodeIds: [],
          width: 560,
          height: 430,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } satisfies GroupNodeData,
      })
      useProjectStore.getState().markDirty()
      return id
    },
    [addNode]
  )

  const addVideoAssetNode = useCallback(
    (position: { x: number; y: number }) => {
      const id = createNodeId()
      addNode({
        id,
        type: 'video_asset',
        position,
        data: {
          nodeType: 'video_asset',
          title: t('node.videoAsset'),
          videoUrl: '',
          role: 'source',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } satisfies VideoAssetNodeData,
      })
      return id
    },
    [addNode]
  )

  const addMotionTransferNode = useCallback(
    (position: { x: number; y: number }) => {
      const id = createNodeId()
      addNode({
        id,
        type: 'motion_transfer',
        position,
        data: {
          nodeType: 'motion_transfer',
          title: t('node.motionTransfer'),
          mode: 1,
          resolution: 720,
          status: 'idle',
          param265: 1.0000000000000002,
          param266: 0.20000000000000004,
          param271: false,
          param297: 1.0000000000000002,
          param300: 840,
          param361: 1.0000000000000002,
          param370: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } satisfies MotionTransferNodeData,
      })
      return id
    },
    [addNode]
  )

  const addVideoGenNode = useCallback(
    (position: { x: number; y: number }) => {
      const id = createNodeId()
      const model = getVideoModelById(DEFAULT_VIDEO_MODEL_ID)
      addNode({
        id,
        type: 'video_gen',
        position,
        data: {
          nodeType: 'video_gen',
          title: t('node.videoGen'),
          modelId: model?.id ?? DEFAULT_VIDEO_MODEL_ID,
          backendModel: model?.backendModel,
          modelLabel: model?.label,
          aspectRatio: model?.defaultAspectRatio ?? '16:9',
          size: model?.defaultSize ?? '720p',
          duration: model?.defaultDuration ?? 5,
          fps: 24,
          status: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } satisfies VideoGenNodeData,
      })
      return id
    },
    [addNode]
  )

  const deleteNode = useCallback(
    (id: string) => {
      useUndoRedoStore.getState().capture('Delete node')
      removeEdgesByNode(id)
      removeNode(id)
    },
    [removeNode, removeEdgesByNode]
  )

  const duplicateNode = useCallback(
    (id: string) => {
      cloneNode(id)
    },
    [cloneNode]
  )

  return {
    addTextNode,
    addProductAnalysisNode,
    addImageAssetNode,
    addImageGenNode,
    addLLMNode,
    addGroupNode,
    addVideoAssetNode,
    addMotionTransferNode,
    addVideoGenNode,
    deleteNode,
    duplicateNode,
  }
}

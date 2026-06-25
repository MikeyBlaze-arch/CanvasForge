import { useCallback, useState } from 'react'
import type { Node, Edge, ReactFlowInstance } from '@xyflow/react'
import { useNodeStore, createNodeId } from '../../store/nodeStore'
import { createCanvasEdgeId, isDuplicateEdge, normalizeCanvasEdge } from '../../store/edgeStore'
import { normalizeConnection } from '../connectionNormalizer'
import { isValidConnection } from '../edgeRules'
import { getReferenceMenuRule } from '../referenceMenuRules'
import type { ReferenceMenuItem } from '../referenceMenuRules'
import type { CanvasNodeData, TextNodeData, ImageAssetNodeData, ImageGenNodeData, LLMNodeData, VideoAssetNodeData, MotionTransferNodeData, VideoGenNodeData } from '../nodeTypes'
import { createDefaultProductAnalysisNodeData } from '../productAnalysisPrompt'
import { DEFAULT_LLM_MODEL_ID } from '../../generation/llmModelRegistry'
import { DEFAULT_VIDEO_MODEL_ID, getVideoModelById } from '../../generation/videoModelRegistry'

type ReferenceMenuState = {
  x: number
  y: number
  sourceNodeId: string
  sourceHandle: string | null
  sourceNodeType: string
} | null

export function useReferenceCreateMenu(
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  setEdges: (edges: Edge[]) => void,
  reactFlow: ReactFlowInstance,
  markDirty: () => void,
  t: (key: string, vars?: Record<string, string | number>) => string
) {
  const [referenceMenu, setReferenceMenu] = useState<ReferenceMenuState>(null)

  const handleReferenceMenuSelect = useCallback((
    nodeType: ReferenceMenuItem['nodeType']
  ) => {
    if (!referenceMenu) return

    const { sourceNodeId, sourceHandle } = referenceMenu
    const sourceNode = nodes.find((n) => n.id === sourceNodeId)
    if (!sourceNode) return
    const addNode = useNodeStore.getState().addNode

    // Calculate position for new node
    let flowPos = reactFlow.screenToFlowPosition({
      x: referenceMenu.x,
      y: referenceMenu.y,
    })

    // Avoid overlap by offsetting if too close
    const dx = flowPos.x - sourceNode.position.x
    const dy = flowPos.y - sourceNode.position.y
    if (Math.abs(dx) < 50 && Math.abs(dy) < 50) {
      flowPos.x += 320
    }

    // Create new node based on type
    const newNodeId = createNodeId()
    let newNodeData: CanvasNodeData
    let newNodeWidth = 260

    switch (nodeType) {
      case 'text': {
        const textData: TextNodeData = {
          nodeType: 'text',
          title: t('node.text'),
          textKind: 'prompt',
          content: '',
          language: 'mixed',
          updatedAt: Date.now(),
        }
        newNodeData = textData as CanvasNodeData
        newNodeWidth = 260
        break
      }
      case 'product_analysis': {
        newNodeData = createDefaultProductAnalysisNodeData() as CanvasNodeData
        newNodeWidth = 330
        break
      }
      case 'image_asset': {
        const imageData: ImageAssetNodeData = {
          nodeType: 'image_asset',
          title: t('node.image'),
          imageUrl: '',
          role: 'reference',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        newNodeData = imageData as CanvasNodeData
        newNodeWidth = 220
        break
      }
      case 'image_gen': {
        const genData: ImageGenNodeData = {
          nodeType: 'image_gen',
          title: t('node.imageGen'),
          modelSeries: 'G',
          modelId: 'g-gpt-image-2',
          aspectRatio: '1:1',
          resolution: '2K',
          batchSize: 1,
          referenceImageOrder: [],
          status: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        newNodeData = genData as CanvasNodeData
        newNodeWidth = 260
        break
      }
      case 'llm': {
        const llmData: LLMNodeData = {
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
        }
        newNodeData = llmData as CanvasNodeData
        newNodeWidth = 280
        break
      }
      case 'video_asset': {
        const videoData: VideoAssetNodeData = {
          nodeType: 'video_asset',
          title: t('node.videoAsset'),
          videoUrl: '',
          role: 'source',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        newNodeData = videoData as CanvasNodeData
        newNodeWidth = 320
        break
      }
      case 'motion_transfer': {
        const mtData: MotionTransferNodeData = {
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
        }
        newNodeData = mtData as CanvasNodeData
        newNodeWidth = 300
        break
      }
      case 'video_gen': {
        const vgModel = getVideoModelById(DEFAULT_VIDEO_MODEL_ID)
        const vgData: VideoGenNodeData = {
          nodeType: 'video_gen',
          title: t('node.videoGen'),
          modelId: vgModel?.id ?? DEFAULT_VIDEO_MODEL_ID,
          backendModel: vgModel?.backendModel,
          modelLabel: vgModel?.label,
          aspectRatio: vgModel?.defaultAspectRatio ?? '16:9',
          size: vgModel?.defaultSize ?? '720p',
          duration: vgModel?.defaultDuration ?? 5,
          fps: 24,
          status: 'idle',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        newNodeData = vgData as CanvasNodeData
        newNodeWidth = 290
        break
      }
      default:
        return
    }

    // Add the new node
    const newNode: Node<CanvasNodeData> = {
      id: newNodeId,
      type: nodeType,
      position: flowPos,
      data: newNodeData,
    }
    const nextNodes = [...nodes, newNode]
    addNode(newNode)

    // Create connection with normalized handles — use nextNodes so normalizeConnection can find the new node
    const normalizedConnection = normalizeConnection({
      source: sourceNodeId,
      target: newNodeId,
      sourceHandle: sourceHandle || 'main_output',
      targetHandle: 'main_input',
    }, nextNodes, edges)

    if (normalizedConnection && isValidConnection(normalizedConnection, nextNodes, edges) && !isDuplicateEdge(edges, normalizedConnection)) {
      const newEdge = {
        ...normalizedConnection,
        id: createCanvasEdgeId(normalizedConnection),
        type: 'canvas' as const,
      }
      setEdges([...edges, newEdge] as Edge[])
    }

    markDirty()
    setReferenceMenu(null)
  }, [referenceMenu, nodes, reactFlow, edges, setEdges, markDirty, t])

  return {
    referenceMenu,
    setReferenceMenu,
    handleReferenceMenuSelect,
    getReferenceMenuRule,
  }
}

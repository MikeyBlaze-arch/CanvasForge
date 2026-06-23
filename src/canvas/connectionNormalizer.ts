import type { Connection, Node, Edge } from '@xyflow/react'
import type { CanvasNodeData } from './nodeTypes'

type HandleMapping = {
  sourceType: string
  targetType: string
  mainSourceHandle: string
  mainTargetHandle: string
  realSourceHandle: string
  realTargetHandle: string
}

const HANDLE_MAPPINGS: HandleMapping[] = [
  { sourceType: 'image_asset', targetType: 'image_gen', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'image_output', realTargetHandle: 'reference_image' },
  { sourceType: 'image_asset', targetType: 'image_gen', mainSourceHandle: 'reference_image', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'reference_image' },
  { sourceType: 'image_asset', targetType: 'image_gen', mainSourceHandle: 'source_image', mainTargetHandle: 'main_input', realSourceHandle: 'source_image', realTargetHandle: 'reference_image' },
  { sourceType: 'image_asset', targetType: 'image_gen', mainSourceHandle: 'image_output', mainTargetHandle: 'main_input', realSourceHandle: 'image_output', realTargetHandle: 'reference_image' },
  { sourceType: 'group', targetType: 'image_gen', mainSourceHandle: 'image_collection_output', mainTargetHandle: 'main_input', realSourceHandle: 'image_collection_output', realTargetHandle: 'reference_image' },
  { sourceType: 'group', targetType: 'image_gen', mainSourceHandle: 'image_collection_output', mainTargetHandle: 'reference_image', realSourceHandle: 'image_collection_output', realTargetHandle: 'reference_image' },

  { sourceType: 'llm', targetType: 'image_gen', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'llm_output', realTargetHandle: 'prompt' },
  { sourceType: 'llm', targetType: 'image_gen', mainSourceHandle: 'text', mainTargetHandle: 'main_input', realSourceHandle: 'text', realTargetHandle: 'prompt' },
  { sourceType: 'text', targetType: 'image_gen', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'prompt', realTargetHandle: 'prompt' },
  { sourceType: 'text', targetType: 'image_gen', mainSourceHandle: 'text', mainTargetHandle: 'main_input', realSourceHandle: 'text', realTargetHandle: 'prompt' },
  { sourceType: 'text', targetType: 'image_gen', mainSourceHandle: 'style_prompt', mainTargetHandle: 'main_input', realSourceHandle: 'style_prompt', realTargetHandle: 'prompt' },
  { sourceType: 'text', targetType: 'image_gen', mainSourceHandle: 'negative_prompt', mainTargetHandle: 'main_input', realSourceHandle: 'negative_prompt', realTargetHandle: 'negative_prompt' },

  { sourceType: 'image_gen', targetType: 'image_asset', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'generated_image', realTargetHandle: 'image_input' },
  { sourceType: 'image_gen', targetType: 'image_asset', mainSourceHandle: 'output', mainTargetHandle: 'main_input', realSourceHandle: 'output', realTargetHandle: 'image_input' },
  { sourceType: 'image_gen', targetType: 'result_image', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'generated_image', realTargetHandle: 'generated_image' },
  { sourceType: 'image_gen', targetType: 'result_image', mainSourceHandle: 'output', mainTargetHandle: 'main_input', realSourceHandle: 'output', realTargetHandle: 'generated_image' },

  { sourceType: 'image_asset', targetType: 'llm', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'image_output', realTargetHandle: 'image_input' },
  { sourceType: 'image_asset', targetType: 'llm', mainSourceHandle: 'reference_image', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'image_input' },
  { sourceType: 'image_asset', targetType: 'llm', mainSourceHandle: 'source_image', mainTargetHandle: 'main_input', realSourceHandle: 'source_image', realTargetHandle: 'image_input' },
  { sourceType: 'image_asset', targetType: 'llm', mainSourceHandle: 'mask_image', mainTargetHandle: 'main_input', realSourceHandle: 'mask_image', realTargetHandle: 'image_input' },
  { sourceType: 'group', targetType: 'llm', mainSourceHandle: 'image_collection_output', mainTargetHandle: 'main_input', realSourceHandle: 'image_collection_output', realTargetHandle: 'image_input' },
  { sourceType: 'group', targetType: 'llm', mainSourceHandle: 'image_collection_output', mainTargetHandle: 'image_input', realSourceHandle: 'image_collection_output', realTargetHandle: 'image_input' },
  { sourceType: 'result_image', targetType: 'llm', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'image_input' },
  { sourceType: 'result_image', targetType: 'llm', mainSourceHandle: 'reference_image', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'image_input' },
  { sourceType: 'result_image', targetType: 'llm', mainSourceHandle: 'source_image', mainTargetHandle: 'main_input', realSourceHandle: 'source_image', realTargetHandle: 'image_input' },

  { sourceType: 'result_image', targetType: 'image_gen', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'reference_image' },
  { sourceType: 'result_image', targetType: 'image_gen', mainSourceHandle: 'reference_image', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'reference_image' },
  { sourceType: 'result_image', targetType: 'image_gen', mainSourceHandle: 'source_image', mainTargetHandle: 'main_input', realSourceHandle: 'source_image', realTargetHandle: 'reference_image' },

  { sourceType: 'llm', targetType: 'text', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'llm_output', realTargetHandle: 'llm_input' },
  { sourceType: 'llm', targetType: 'text', mainSourceHandle: 'text', mainTargetHandle: 'main_input', realSourceHandle: 'text', realTargetHandle: 'llm_input' },
  { sourceType: 'text', targetType: 'product_analysis', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'prompt', realTargetHandle: 'product_info_input' },
  { sourceType: 'text', targetType: 'product_analysis', mainSourceHandle: 'text', mainTargetHandle: 'main_input', realSourceHandle: 'text', realTargetHandle: 'product_info_input' },
  { sourceType: 'llm', targetType: 'product_analysis', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'llm_output', realTargetHandle: 'product_info_input' },
  { sourceType: 'llm', targetType: 'product_analysis', mainSourceHandle: 'text', mainTargetHandle: 'main_input', realSourceHandle: 'text', realTargetHandle: 'product_info_input' },
  { sourceType: 'image_asset', targetType: 'product_analysis', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'image_output', realTargetHandle: 'image_input' },
  { sourceType: 'image_asset', targetType: 'product_analysis', mainSourceHandle: 'reference_image', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'image_input' },
  { sourceType: 'image_asset', targetType: 'product_analysis', mainSourceHandle: 'source_image', mainTargetHandle: 'main_input', realSourceHandle: 'source_image', realTargetHandle: 'image_input' },
  { sourceType: 'image_gen', targetType: 'product_analysis', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'generated_image', realTargetHandle: 'image_input' },
  { sourceType: 'image_gen', targetType: 'product_analysis', mainSourceHandle: 'output', mainTargetHandle: 'main_input', realSourceHandle: 'output', realTargetHandle: 'image_input' },
  { sourceType: 'result_image', targetType: 'product_analysis', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'image_input' },
  { sourceType: 'result_image', targetType: 'product_analysis', mainSourceHandle: 'reference_image', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'image_input' },
  { sourceType: 'result_image', targetType: 'product_analysis', mainSourceHandle: 'source_image', mainTargetHandle: 'main_input', realSourceHandle: 'source_image', realTargetHandle: 'image_input' },
  { sourceType: 'group', targetType: 'product_analysis', mainSourceHandle: 'image_collection_output', mainTargetHandle: 'main_input', realSourceHandle: 'image_collection_output', realTargetHandle: 'image_input' },
  { sourceType: 'product_analysis', targetType: 'llm', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'analysis_result_output', realTargetHandle: 'text_input' },
  { sourceType: 'product_analysis', targetType: 'llm', mainSourceHandle: 'text_output', mainTargetHandle: 'main_input', realSourceHandle: 'analysis_result_output', realTargetHandle: 'text_input' },
  { sourceType: 'product_analysis', targetType: 'llm', mainSourceHandle: 'text_output', mainTargetHandle: 'text_input', realSourceHandle: 'analysis_result_output', realTargetHandle: 'text_input' },
  { sourceType: 'product_analysis', targetType: 'text', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'analysis_result_output', realTargetHandle: 'llm_input' },
  { sourceType: 'product_analysis', targetType: 'text', mainSourceHandle: 'text_output', mainTargetHandle: 'main_input', realSourceHandle: 'analysis_result_output', realTargetHandle: 'llm_input' },
  { sourceType: 'product_analysis', targetType: 'text', mainSourceHandle: 'text_output', mainTargetHandle: 'llm_input', realSourceHandle: 'analysis_result_output', realTargetHandle: 'llm_input' },
  { sourceType: 'text', targetType: 'llm', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'prompt', realTargetHandle: 'text_input' },
  { sourceType: 'text', targetType: 'llm', mainSourceHandle: 'text', mainTargetHandle: 'main_input', realSourceHandle: 'text', realTargetHandle: 'text_input' },
  { sourceType: 'text', targetType: 'llm', mainSourceHandle: 'style_prompt', mainTargetHandle: 'main_input', realSourceHandle: 'style_prompt', realTargetHandle: 'text_input' },

  { sourceType: 'video_asset', targetType: 'motion_transfer', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'video_output', realTargetHandle: 'motion_video' },
  { sourceType: 'video_asset', targetType: 'motion_transfer', mainSourceHandle: 'video_output', mainTargetHandle: 'main_input', realSourceHandle: 'video_output', realTargetHandle: 'motion_video' },
  { sourceType: 'motion_transfer', targetType: 'video_asset', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'output_video', realTargetHandle: 'video_input' },

  { sourceType: 'image_asset', targetType: 'motion_transfer', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'image_output', realTargetHandle: 'source_image' },
  { sourceType: 'image_asset', targetType: 'motion_transfer', mainSourceHandle: 'reference_image', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'source_image' },
  { sourceType: 'image_asset', targetType: 'motion_transfer', mainSourceHandle: 'source_image', mainTargetHandle: 'main_input', realSourceHandle: 'source_image', realTargetHandle: 'source_image' },
  { sourceType: 'image_gen', targetType: 'motion_transfer', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'generated_image', realTargetHandle: 'source_image' },
  { sourceType: 'result_image', targetType: 'motion_transfer', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'source_image' },

  { sourceType: 'text', targetType: 'video_gen', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'prompt', realTargetHandle: 'prompt' },
  { sourceType: 'text', targetType: 'video_gen', mainSourceHandle: 'text', mainTargetHandle: 'main_input', realSourceHandle: 'text', realTargetHandle: 'prompt' },
  { sourceType: 'text', targetType: 'video_gen', mainSourceHandle: 'style_prompt', mainTargetHandle: 'main_input', realSourceHandle: 'style_prompt', realTargetHandle: 'prompt' },
  { sourceType: 'llm', targetType: 'video_gen', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'llm_output', realTargetHandle: 'prompt' },
  { sourceType: 'llm', targetType: 'video_gen', mainSourceHandle: 'text', mainTargetHandle: 'main_input', realSourceHandle: 'text', realTargetHandle: 'prompt' },

  { sourceType: 'image_asset', targetType: 'video_gen', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'image_output', realTargetHandle: 'image' },
  { sourceType: 'image_asset', targetType: 'video_gen', mainSourceHandle: 'reference_image', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'image' },
  { sourceType: 'image_asset', targetType: 'video_gen', mainSourceHandle: 'source_image', mainTargetHandle: 'main_input', realSourceHandle: 'source_image', realTargetHandle: 'image' },
  { sourceType: 'image_gen', targetType: 'video_gen', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'generated_image', realTargetHandle: 'image' },
  { sourceType: 'image_gen', targetType: 'video_gen', mainSourceHandle: 'output', mainTargetHandle: 'main_input', realSourceHandle: 'output', realTargetHandle: 'image' },
  { sourceType: 'result_image', targetType: 'video_gen', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'image' },
  { sourceType: 'result_image', targetType: 'video_gen', mainSourceHandle: 'reference_image', mainTargetHandle: 'main_input', realSourceHandle: 'reference_image', realTargetHandle: 'image' },
  { sourceType: 'result_image', targetType: 'video_gen', mainSourceHandle: 'source_image', mainTargetHandle: 'main_input', realSourceHandle: 'source_image', realTargetHandle: 'image' },
  { sourceType: 'video_gen', targetType: 'video_asset', mainSourceHandle: 'main_output', mainTargetHandle: 'main_input', realSourceHandle: 'video', realTargetHandle: 'video_input' },
  { sourceType: 'video_gen', targetType: 'video_asset', mainSourceHandle: 'video', mainTargetHandle: 'main_input', realSourceHandle: 'video', realTargetHandle: 'video_input' },
]

function getNodeType(nodes: Node<CanvasNodeData>[], id: string | null | undefined): string | undefined {
  if (!id) return undefined
  return (nodes.find((node) => node.id === id)?.data as { nodeType?: string } | undefined)?.nodeType
}

export function normalizeConnection(
  connection: Connection,
  nodes: Node<CanvasNodeData>[],
  _edges?: Edge[]
): Connection | null {
  const { source, target, sourceHandle, targetHandle } = connection
  if (!source || !target) return null

  const sourceType = getNodeType(nodes, source)
  const targetType = getNodeType(nodes, target)
  if (!sourceType || !targetType) return null

  const directMapping = HANDLE_MAPPINGS.find(
    (m) => m.sourceType === sourceType &&
      m.targetType === targetType &&
      m.mainSourceHandle === (sourceHandle ?? null) &&
      m.mainTargetHandle === (targetHandle ?? null)
  )

  if (directMapping) {
    return {
      source,
      target,
      sourceHandle: directMapping.realSourceHandle,
      targetHandle: directMapping.realTargetHandle,
    }
  }

  if (!targetHandle) {
    const fallbackMapping = HANDLE_MAPPINGS.find(
      (m) => m.sourceType === sourceType &&
        m.targetType === targetType &&
        m.mainSourceHandle === (sourceHandle ?? null) &&
        m.mainTargetHandle === 'main_input'
    )
    if (fallbackMapping) {
      return {
        source,
        target,
        sourceHandle: fallbackMapping.realSourceHandle,
        targetHandle: fallbackMapping.realTargetHandle,
      }
    }
  }

  const reverseMapping = HANDLE_MAPPINGS.find(
    (m) => m.sourceType === targetType &&
      m.targetType === sourceType &&
      m.mainSourceHandle === (targetHandle ?? null) &&
      m.mainTargetHandle === (sourceHandle ?? null)
  )

  if (reverseMapping) {
    return {
      source: target,
      target: source,
      sourceHandle: reverseMapping.realSourceHandle,
      targetHandle: reverseMapping.realTargetHandle,
    }
  }

  if (!sourceHandle) {
    const fallbackReverseMapping = HANDLE_MAPPINGS.find(
      (m) => m.sourceType === targetType &&
        m.targetType === sourceType &&
        m.mainSourceHandle === (targetHandle ?? null) &&
        m.mainTargetHandle === 'main_input'
    )
    if (fallbackReverseMapping) {
      return {
        source: target,
        target: source,
        sourceHandle: fallbackReverseMapping.realSourceHandle,
        targetHandle: fallbackReverseMapping.realTargetHandle,
      }
    }
  }

  return connection
}

export function migrateEdges(edges: Edge[], nodes: Node<CanvasNodeData>[]): Edge[] {
  return edges.map((edge) => {
    const normalized = normalizeConnection({
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
    }, nodes)
    return normalized ? { ...edge, ...normalized } : edge
  })
}

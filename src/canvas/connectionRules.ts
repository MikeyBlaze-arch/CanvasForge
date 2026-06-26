/**
 * Centralized connection rules for CanvasForge node system.
 */

import type { Edge } from '@xyflow/react'

export type NodeConnectionRule = {
  sourceType: string
  sourceHandle: string
  targetType: string
  targetHandle: string
}

export const LEGACY_HANDLE_MAP: Record<string, Record<string, string>> = {
  text: {
    llm_output: 'llm_input',
  },
  llm: {
    optimized_prompt: 'llm_output',
    text: 'text_input',
  },
  image_asset: {},
  product_analysis: {
    text_output: 'analysis_result_output',
  },
  image_compare: {},
}

export function resolveHandleId(nodeType: string, handleId: string | null | undefined): string | null {
  if (!handleId) return null
  const legacy = LEGACY_HANDLE_MAP[nodeType]
  if (legacy && legacy[handleId]) return legacy[handleId]
  return handleId
}

export const CONNECTION_RULES: NodeConnectionRule[] = [
  { sourceType: 'text', sourceHandle: 'main_output', targetType: 'product_analysis', targetHandle: 'main_input' },
  { sourceType: 'image_asset', sourceHandle: 'main_output', targetType: 'product_analysis', targetHandle: 'main_input' },
  { sourceType: 'image_gen', sourceHandle: 'main_output', targetType: 'product_analysis', targetHandle: 'main_input' },
  { sourceType: 'result_image', sourceHandle: 'main_output', targetType: 'product_analysis', targetHandle: 'main_input' },
  { sourceType: 'text', sourceHandle: 'prompt', targetType: 'product_analysis', targetHandle: 'product_info_input' },
  { sourceType: 'text', sourceHandle: 'text', targetType: 'product_analysis', targetHandle: 'product_info_input' },
  { sourceType: 'text', sourceHandle: 'style_prompt', targetType: 'product_analysis', targetHandle: 'product_info_input' },
  { sourceType: 'llm', sourceHandle: 'main_output', targetType: 'product_analysis', targetHandle: 'main_input' },
  { sourceType: 'llm', sourceHandle: 'llm_output', targetType: 'product_analysis', targetHandle: 'product_info_input' },
  { sourceType: 'llm', sourceHandle: 'text', targetType: 'product_analysis', targetHandle: 'product_info_input' },
  { sourceType: 'image_asset', sourceHandle: 'image_output', targetType: 'product_analysis', targetHandle: 'image_input' },
  { sourceType: 'image_asset', sourceHandle: 'reference_image', targetType: 'product_analysis', targetHandle: 'image_input' },
  { sourceType: 'image_asset', sourceHandle: 'source_image', targetType: 'product_analysis', targetHandle: 'image_input' },
  { sourceType: 'image_gen', sourceHandle: 'generated_image', targetType: 'product_analysis', targetHandle: 'image_input' },
  { sourceType: 'image_gen', sourceHandle: 'output', targetType: 'product_analysis', targetHandle: 'image_input' },
  { sourceType: 'result_image', sourceHandle: 'reference_image', targetType: 'product_analysis', targetHandle: 'image_input' },
  { sourceType: 'result_image', sourceHandle: 'source_image', targetType: 'product_analysis', targetHandle: 'image_input' },
  { sourceType: 'group', sourceHandle: 'image_collection_output', targetType: 'product_analysis', targetHandle: 'image_input' },
  { sourceType: 'product_analysis', sourceHandle: 'main_output', targetType: 'text', targetHandle: 'main_input' },
  { sourceType: 'product_analysis', sourceHandle: 'analysis_result_output', targetType: 'text', targetHandle: 'llm_input' },
  { sourceType: 'product_analysis', sourceHandle: 'main_output', targetType: 'llm', targetHandle: 'main_input' },
  { sourceType: 'product_analysis', sourceHandle: 'analysis_result_output', targetType: 'llm', targetHandle: 'text_input' },

  { sourceType: 'text', sourceHandle: 'main_output', targetType: 'image_gen', targetHandle: 'main_input' },
  { sourceType: 'image_asset', sourceHandle: 'main_output', targetType: 'image_gen', targetHandle: 'main_input' },
  { sourceType: 'image_asset', sourceHandle: 'main_output', targetType: 'llm', targetHandle: 'main_input' },
  { sourceType: 'llm', sourceHandle: 'main_output', targetType: 'image_gen', targetHandle: 'main_input' },
  { sourceType: 'llm', sourceHandle: 'main_output', targetType: 'text', targetHandle: 'main_input' },
  { sourceType: 'text', sourceHandle: 'main_output', targetType: 'llm', targetHandle: 'main_input' },
  { sourceType: 'image_gen', sourceHandle: 'main_output', targetType: 'image_asset', targetHandle: 'main_input' },
  { sourceType: 'image_gen', sourceHandle: 'main_output', targetType: 'result_image', targetHandle: 'main_input' },
  { sourceType: 'result_image', sourceHandle: 'main_output', targetType: 'llm', targetHandle: 'main_input' },

  { sourceType: 'text', sourceHandle: 'prompt', targetType: 'image_gen', targetHandle: 'prompt' },
  { sourceType: 'text', sourceHandle: 'text', targetType: 'image_gen', targetHandle: 'prompt' },
  { sourceType: 'text', sourceHandle: 'style_prompt', targetType: 'image_gen', targetHandle: 'prompt' },
  { sourceType: 'text', sourceHandle: 'negative_prompt', targetType: 'image_gen', targetHandle: 'negative_prompt' },

  { sourceType: 'image_asset', sourceHandle: 'image_output', targetType: 'image_gen', targetHandle: 'reference_image' },
  { sourceType: 'image_asset', sourceHandle: 'reference_image', targetType: 'image_gen', targetHandle: 'reference_image' },
  { sourceType: 'image_asset', sourceHandle: 'source_image', targetType: 'image_gen', targetHandle: 'reference_image' },

  { sourceType: 'image_gen', sourceHandle: 'generated_image', targetType: 'image_asset', targetHandle: 'image_input' },
  { sourceType: 'image_gen', sourceHandle: 'output', targetType: 'image_asset', targetHandle: 'image_input' },
  { sourceType: 'image_gen', sourceHandle: 'generated_image', targetType: 'result_image', targetHandle: 'generated_image' },
  { sourceType: 'image_gen', sourceHandle: 'output', targetType: 'result_image', targetHandle: 'generated_image' },

  { sourceType: 'image_asset', sourceHandle: 'image_output', targetType: 'llm', targetHandle: 'image_input' },
  { sourceType: 'image_asset', sourceHandle: 'reference_image', targetType: 'llm', targetHandle: 'image_input' },
  { sourceType: 'image_asset', sourceHandle: 'source_image', targetType: 'llm', targetHandle: 'image_input' },
  { sourceType: 'image_asset', sourceHandle: 'mask_image', targetType: 'llm', targetHandle: 'image_input' },
  { sourceType: 'result_image', sourceHandle: 'reference_image', targetType: 'llm', targetHandle: 'image_input' },
  { sourceType: 'result_image', sourceHandle: 'source_image', targetType: 'llm', targetHandle: 'image_input' },
  { sourceType: 'image_gen', sourceHandle: 'generated_image', targetType: 'llm', targetHandle: 'image_input' },
  { sourceType: 'image_gen', sourceHandle: 'output', targetType: 'llm', targetHandle: 'image_input' },
  { sourceType: 'group', sourceHandle: 'image_collection_output', targetType: 'llm', targetHandle: 'image_input' },

  { sourceType: 'llm', sourceHandle: 'llm_output', targetType: 'text', targetHandle: 'llm_input' },
  { sourceType: 'llm', sourceHandle: 'text', targetType: 'text', targetHandle: 'llm_input' },
  { sourceType: 'llm', sourceHandle: 'llm_output', targetType: 'image_gen', targetHandle: 'prompt' },
  { sourceType: 'llm', sourceHandle: 'text', targetType: 'image_gen', targetHandle: 'prompt' },

  { sourceType: 'text', sourceHandle: 'prompt', targetType: 'llm', targetHandle: 'text_input' },
  { sourceType: 'text', sourceHandle: 'text', targetType: 'llm', targetHandle: 'text_input' },
  { sourceType: 'text', sourceHandle: 'style_prompt', targetType: 'llm', targetHandle: 'text_input' },

  { sourceType: 'result_image', sourceHandle: 'reference_image', targetType: 'image_gen', targetHandle: 'reference_image' },
  { sourceType: 'result_image', sourceHandle: 'source_image', targetType: 'image_gen', targetHandle: 'reference_image' },
  { sourceType: 'image_gen', sourceHandle: 'generated_image', targetType: 'image_gen', targetHandle: 'reference_image' },
  { sourceType: 'image_gen', sourceHandle: 'output', targetType: 'image_gen', targetHandle: 'reference_image' },
  { sourceType: 'group', sourceHandle: 'image_collection_output', targetType: 'image_gen', targetHandle: 'reference_image' },

  { sourceType: 'video_asset', sourceHandle: 'main_output', targetType: 'motion_transfer', targetHandle: 'main_input' },
  { sourceType: 'video_asset', sourceHandle: 'video_output', targetType: 'motion_transfer', targetHandle: 'motion_video' },
  { sourceType: 'video_asset', sourceHandle: 'motion_video', targetType: 'motion_transfer', targetHandle: 'motion_video' },
  { sourceType: 'motion_transfer', sourceHandle: 'main_output', targetType: 'video_asset', targetHandle: 'main_input' },
  { sourceType: 'motion_transfer', sourceHandle: 'output_video', targetType: 'video_asset', targetHandle: 'video_input' },

  { sourceType: 'image_asset', sourceHandle: 'main_output', targetType: 'motion_transfer', targetHandle: 'main_input' },
  { sourceType: 'image_asset', sourceHandle: 'image_output', targetType: 'motion_transfer', targetHandle: 'source_image' },
  { sourceType: 'image_asset', sourceHandle: 'source_image', targetType: 'motion_transfer', targetHandle: 'source_image' },
  { sourceType: 'image_gen', sourceHandle: 'main_output', targetType: 'motion_transfer', targetHandle: 'main_input' },
  { sourceType: 'image_gen', sourceHandle: 'generated_image', targetType: 'motion_transfer', targetHandle: 'source_image' },
  { sourceType: 'result_image', sourceHandle: 'main_output', targetType: 'motion_transfer', targetHandle: 'main_input' },
  { sourceType: 'result_image', sourceHandle: 'reference_image', targetType: 'motion_transfer', targetHandle: 'source_image' },

  { sourceType: 'text', sourceHandle: 'main_output', targetType: 'video_gen', targetHandle: 'main_input' },
  { sourceType: 'text', sourceHandle: 'prompt', targetType: 'video_gen', targetHandle: 'prompt' },
  { sourceType: 'text', sourceHandle: 'text', targetType: 'video_gen', targetHandle: 'prompt' },
  { sourceType: 'text', sourceHandle: 'style_prompt', targetType: 'video_gen', targetHandle: 'prompt' },
  { sourceType: 'llm', sourceHandle: 'main_output', targetType: 'video_gen', targetHandle: 'main_input' },
  { sourceType: 'llm', sourceHandle: 'llm_output', targetType: 'video_gen', targetHandle: 'prompt' },
  { sourceType: 'llm', sourceHandle: 'text', targetType: 'video_gen', targetHandle: 'prompt' },

  { sourceType: 'image_asset', sourceHandle: 'main_output', targetType: 'video_gen', targetHandle: 'main_input' },
  { sourceType: 'image_asset', sourceHandle: 'image_output', targetType: 'video_gen', targetHandle: 'image' },
  { sourceType: 'image_asset', sourceHandle: 'reference_image', targetType: 'video_gen', targetHandle: 'image' },
  { sourceType: 'image_asset', sourceHandle: 'source_image', targetType: 'video_gen', targetHandle: 'image' },
  { sourceType: 'image_gen', sourceHandle: 'main_output', targetType: 'video_gen', targetHandle: 'main_input' },
  { sourceType: 'image_gen', sourceHandle: 'generated_image', targetType: 'video_gen', targetHandle: 'image' },
  { sourceType: 'image_gen', sourceHandle: 'output', targetType: 'video_gen', targetHandle: 'image' },
  { sourceType: 'result_image', sourceHandle: 'main_output', targetType: 'video_gen', targetHandle: 'main_input' },
  { sourceType: 'result_image', sourceHandle: 'reference_image', targetType: 'video_gen', targetHandle: 'image' },
  { sourceType: 'result_image', sourceHandle: 'source_image', targetType: 'video_gen', targetHandle: 'image' },

  { sourceType: 'video_gen', sourceHandle: 'main_output', targetType: 'video_asset', targetHandle: 'main_input' },
  { sourceType: 'video_gen', sourceHandle: 'video', targetType: 'video_asset', targetHandle: 'video_input' },

  { sourceType: 'image_asset', sourceHandle: 'main_output', targetType: 'image_compare', targetHandle: 'main_input' },
  { sourceType: 'image_asset', sourceHandle: 'image_output', targetType: 'image_compare', targetHandle: 'compare_image' },
  { sourceType: 'image_asset', sourceHandle: 'reference_image', targetType: 'image_compare', targetHandle: 'compare_image' },
  { sourceType: 'image_asset', sourceHandle: 'source_image', targetType: 'image_compare', targetHandle: 'compare_image' },

  { sourceType: 'result_image', sourceHandle: 'main_output', targetType: 'image_compare', targetHandle: 'main_input' },
  { sourceType: 'result_image', sourceHandle: 'reference_image', targetType: 'image_compare', targetHandle: 'compare_image' },
  { sourceType: 'result_image', sourceHandle: 'source_image', targetType: 'image_compare', targetHandle: 'compare_image' },

  { sourceType: 'image_gen', sourceHandle: 'main_output', targetType: 'image_compare', targetHandle: 'main_input' },
  { sourceType: 'image_gen', sourceHandle: 'generated_image', targetType: 'image_compare', targetHandle: 'compare_image' },
  { sourceType: 'image_gen', sourceHandle: 'output', targetType: 'image_compare', targetHandle: 'compare_image' },

  { sourceType: 'group', sourceHandle: 'image_collection_output', targetType: 'image_compare', targetHandle: 'compare_image' },
]

export function isConnectionAllowed(params: {
  sourceType: string
  sourceHandle: string | null | undefined
  targetType: string
  targetHandle: string | null | undefined
  sourceId?: string
  targetId?: string
  edges?: Edge[]
}): boolean {
  const { sourceType, sourceHandle, targetType, targetHandle, sourceId, targetId } = params
  if (!sourceType || !targetType) return false
  if (sourceId && targetId && sourceId === targetId) return false

  const resolvedSourceHandle = resolveHandleId(sourceType, sourceHandle)
  const resolvedTargetHandle = resolveHandleId(targetType, targetHandle)

  return CONNECTION_RULES.some((rule) => {
    if (rule.sourceType !== sourceType) return false
    if (rule.targetType !== targetType) return false
    if (resolvedSourceHandle && rule.sourceHandle !== resolvedSourceHandle) return false
    if (resolvedTargetHandle && rule.targetHandle !== resolvedTargetHandle) return false
    return true
  })
}

export function getConnectionErrorMessage(): string {
  return 'Cannot create this connection.'
}

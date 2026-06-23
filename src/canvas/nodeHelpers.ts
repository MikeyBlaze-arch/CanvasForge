/**
 * Node helper functions shared by canvas node implementations.
 */

import type { ImageAssetNodeData, CanvasNodeData, TextNodeData } from './nodeTypes'
import { getImageModelConfig, type ImageModelSeries } from '../generation/imageModelRegistry'
import type { TranslateFn } from '../i18n/types'

export {
  getImageGenInputs,
  getLLMInputs,
  getProductAnalysisInputs,
  getVideoGenInputs,
  type ImageGenInputs,
  type LLMInputs,
  type ProductAnalysisInputs,
  type VideoGenInputs,
} from './nodeInputResolvers'

export function createImageAssetNodeData(
  t: TranslateFn,
  overrides?: Partial<ImageAssetNodeData>
): ImageAssetNodeData {
  return {
    nodeType: 'image_asset',
    title: t('node.image'),
    imageUrl: '',
    role: 'unknown',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } satisfies ImageAssetNodeData
}

export function createTextNodeData(
  t: TranslateFn,
  overrides?: Partial<TextNodeData>
): TextNodeData {
  return {
    nodeType: 'text',
    title: t('node.text'),
    textKind: 'prompt',
    content: '',
    language: 'mixed',
    updatedAt: Date.now(),
    ...overrides,
  } satisfies TextNodeData
}

export function buildImageGenOutputMetadata(
  imageGenNodeId: string,
  imageGenData: CanvasNodeData,
  prompt: string,
  negativePrompt: string,
  width: number,
  height: number
): Partial<ImageAssetNodeData> {
  const genData = imageGenData as { modelSeries?: string; modelId?: string; aspectRatio?: string; resolution?: string }
  const modelConfig = 'modelSeries' in imageGenData && 'modelId' in imageGenData
    ? getImageModelConfig(
        (imageGenData as { modelSeries: ImageModelSeries }).modelSeries,
        (imageGenData as { modelId: string }).modelId
      )
    : undefined

  return {
    sourceNodeId: imageGenNodeId,
    sourceType: 'image_gen',
    modelSeries: genData.modelSeries as 'G' | 'R' | 'C' | undefined,
    modelId: genData.modelId,
    modelLabel: modelConfig?.label,
    backendModel: modelConfig?.backendModel,
    engineType: modelConfig?.engineType,
    sizeMode: modelConfig?.sizeMode,
    aspectRatio: genData.aspectRatio,
    resolution: genData.resolution,
    finalSize: `${width}×${height}`,
    prompt,
    negativePrompt: negativePrompt || undefined,
    realWidth: width,
    realHeight: height,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

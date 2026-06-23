import { createNodeId } from '../store/nodeStore'
import type { CanvasNodeData, TextNodeData, ImageAssetNodeData, ImageGenNodeData, VideoAssetNodeData, MotionTransferNodeData } from '../canvas/nodeTypes'
import { t } from '../i18n/useI18n'
import { DEFAULT_LLM_MODEL_ID } from '../generation/llmModelRegistry'

export type WorkflowTemplate = {
  id: string
  /** i18n key for the template name */
  nameKey: string
  /** i18n key for the template description */
  descriptionKey: string
  icon: string
  /** i18n key for the template category */
  categoryKey: string
  /** Generator that creates fresh node IDs each time */
  create: () => {
    nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: CanvasNodeData }>
    edges: Array<{ source: string; sourceHandle: string; target: string; targetHandle: string; type: string }>
  }
}

export const TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'flat-lay',
    nameKey: 'templates.flatLay.name',
    descriptionKey: 'templates.flatLay.desc',
    icon: 'image_gen',
    categoryKey: 'templates.category.imageGeneration',
    create: () => {
      const tId = createNodeId(); const gId = createNodeId(); const aId = createNodeId()
      return {
        nodes: [
          { id: tId, type: 'text', position: { x: 200, y: 200 }, data: { nodeType: 'text', title: t('node.prompt'), textKind: 'prompt', content: '', language: 'mixed', updatedAt: Date.now() } as TextNodeData },
          { id: gId, type: 'image_gen', position: { x: 500, y: 200 }, data: { nodeType: 'image_gen', title: t('node.imageGen'), modelSeries: 'G', modelId: 'g-gpt-image-2', aspectRatio: '1:1', resolution: '2K', batchSize: 1, promptInput: '', status: 'idle', createdAt: Date.now(), updatedAt: Date.now() } as ImageGenNodeData },
          { id: aId, type: 'image_asset', position: { x: 800, y: 200 }, data: { nodeType: 'image_asset', title: t('node.output'), imageUrl: '', role: 'unknown', createdAt: Date.now(), updatedAt: Date.now() } as ImageAssetNodeData },
        ],
        edges: [
          { source: tId, sourceHandle: 'prompt', target: gId, targetHandle: 'prompt', type: 'canvas' },
          { source: gId, sourceHandle: 'generated_image', target: aId, targetHandle: 'image_input', type: 'canvas' },
        ],
      }
    },
  },
  {
    id: 'model-tryon',
    nameKey: 'templates.modelTryon.name',
    descriptionKey: 'templates.modelTryon.desc',
    icon: 'image_gen',
    categoryKey: 'templates.category.imageGeneration',
    create: () => {
      const rId = createNodeId(); const gId = createNodeId(); const oId = createNodeId()
      return {
        nodes: [
          { id: rId, type: 'image_asset', position: { x: 200, y: 200 }, data: { nodeType: 'image_asset', title: t('node.reference'), imageUrl: '', role: 'reference', createdAt: Date.now(), updatedAt: Date.now() } as ImageAssetNodeData },
          { id: gId, type: 'image_gen', position: { x: 520, y: 200 }, data: { nodeType: 'image_gen', title: t('node.imageGen'), modelSeries: 'G', modelId: 'g-gpt-image-2', aspectRatio: '3:4', resolution: '2K', batchSize: 1, promptInput: 'fashion model full body, studio lighting', status: 'idle', createdAt: Date.now(), updatedAt: Date.now() } as ImageGenNodeData },
          { id: oId, type: 'image_asset', position: { x: 840, y: 200 }, data: { nodeType: 'image_asset', title: t('node.result'), imageUrl: '', role: 'unknown', createdAt: Date.now(), updatedAt: Date.now() } as ImageAssetNodeData },
        ],
        edges: [
          { source: rId, sourceHandle: 'image_output', target: gId, targetHandle: 'reference_image', type: 'canvas' },
          { source: gId, sourceHandle: 'generated_image', target: oId, targetHandle: 'image_input', type: 'canvas' },
        ],
      }
    },
  },
  {
    id: 'recolor',
    nameKey: 'templates.recolor.name',
    descriptionKey: 'templates.recolor.desc',
    icon: 'image_gen',
    categoryKey: 'templates.category.imageGeneration',
    create: () => {
      const rId = createNodeId(); const tId = createNodeId(); const gId = createNodeId(); const oId = createNodeId()
      return {
        nodes: [
          { id: rId, type: 'image_asset', position: { x: 200, y: 100 }, data: { nodeType: 'image_asset', title: t('node.reference'), imageUrl: '', role: 'reference', createdAt: Date.now(), updatedAt: Date.now() } as ImageAssetNodeData },
          { id: tId, type: 'text', position: { x: 200, y: 320 }, data: { nodeType: 'text', title: t('node.color'), textKind: 'prompt', content: '', language: 'mixed', updatedAt: Date.now() } as TextNodeData },
          { id: gId, type: 'image_gen', position: { x: 520, y: 200 }, data: { nodeType: 'image_gen', title: t('node.imageGen'), modelSeries: 'G', modelId: 'g-gpt-image-2', aspectRatio: 'auto', resolution: '2K', batchSize: 1, promptInput: '', status: 'idle', createdAt: Date.now(), updatedAt: Date.now() } as ImageGenNodeData },
          { id: oId, type: 'image_asset', position: { x: 840, y: 200 }, data: { nodeType: 'image_asset', title: t('node.result'), imageUrl: '', role: 'unknown', createdAt: Date.now(), updatedAt: Date.now() } as ImageAssetNodeData },
        ],
        edges: [
          { source: rId, sourceHandle: 'image_output', target: gId, targetHandle: 'reference_image', type: 'canvas' },
          { source: tId, sourceHandle: 'prompt', target: gId, targetHandle: 'prompt', type: 'canvas' },
          { source: gId, sourceHandle: 'generated_image', target: oId, targetHandle: 'image_input', type: 'canvas' },
        ],
      }
    },
  },
  {
    id: 'llm-prompt-gen',
    nameKey: 'templates.llmPromptGen.name',
    descriptionKey: 'templates.llmPromptGen.desc',
    icon: 'llm',
    categoryKey: 'templates.category.imageGeneration',
    create: () => {
      const t1 = createNodeId(); const llm = createNodeId(); const t2 = createNodeId(); const gen = createNodeId(); const out = createNodeId()
      return {
        nodes: [
          { id: t1, type: 'text', position: { x: 200, y: 80 }, data: { nodeType: 'text', title: t('node.idea'), textKind: 'prompt', content: '', language: 'mixed', updatedAt: Date.now() } as TextNodeData },
          { id: llm, type: 'llm', position: { x: 500, y: 80 }, data: { nodeType: 'llm', title: t('node.llm'), llmProvider: 'openai_compatible', llmModelId: DEFAULT_LLM_MODEL_ID, mode: 'chat', userInput: 'Expand into detailed image prompt:', conversation: [], status: 'idle', createdAt: Date.now(), updatedAt: Date.now() } },
          { id: t2, type: 'text', position: { x: 800, y: 80 }, data: { nodeType: 'text', title: t('node.enhanced'), textKind: 'prompt', content: '', language: 'mixed', updatedAt: Date.now() } as TextNodeData },
          { id: gen, type: 'image_gen', position: { x: 500, y: 360 }, data: { nodeType: 'image_gen', title: t('node.imageGen'), modelSeries: 'G', modelId: 'g-gpt-image-2', aspectRatio: '16:9', resolution: '2K', batchSize: 1, promptInput: '', status: 'idle', createdAt: Date.now(), updatedAt: Date.now() } as ImageGenNodeData },
          { id: out, type: 'image_asset', position: { x: 800, y: 360 }, data: { nodeType: 'image_asset', title: t('node.output'), imageUrl: '', role: 'unknown', createdAt: Date.now(), updatedAt: Date.now() } as ImageAssetNodeData },
        ],
        edges: [
          { source: t1, sourceHandle: 'prompt', target: llm, targetHandle: 'text_input', type: 'canvas' },
          { source: llm, sourceHandle: 'llm_output', target: t2, targetHandle: 'llm_input', type: 'canvas' },
          { source: t2, sourceHandle: 'prompt', target: gen, targetHandle: 'prompt', type: 'canvas' },
          { source: gen, sourceHandle: 'generated_image', target: out, targetHandle: 'image_input', type: 'canvas' },
        ],
      }
    },
  },
  {
    id: 'motion-transfer',
    nameKey: 'templates.motionTransfer.name',
    descriptionKey: 'templates.motionTransfer.desc',
    icon: 'motion_transfer',
    categoryKey: 'templates.category.tools',
    create: () => {
      const vid = createNodeId(); const img = createNodeId(); const mt = createNodeId(); const out = createNodeId()
      return {
        nodes: [
          { id: vid, type: 'video_asset', position: { x: 200, y: 100 }, data: { nodeType: 'video_asset', title: t('node.sourceVideo'), videoUrl: '', role: 'source', createdAt: Date.now(), updatedAt: Date.now() } as VideoAssetNodeData },
          { id: img, type: 'image_asset', position: { x: 200, y: 320 }, data: { nodeType: 'image_asset', title: t('node.targetImage'), imageUrl: '', role: 'reference', createdAt: Date.now(), updatedAt: Date.now() } as ImageAssetNodeData },
          { id: mt, type: 'motion_transfer', position: { x: 520, y: 200 }, data: { nodeType: 'motion_transfer', title: t('node.motionTransfer'), mode: 1, resolution: 720, status: 'idle', param265: 1.0, param266: 0.2, param271: false, param297: 1.0, createdAt: Date.now(), updatedAt: Date.now() } as MotionTransferNodeData },
          { id: out, type: 'video_asset', position: { x: 840, y: 200 }, data: { nodeType: 'video_asset', title: t('node.result'), videoUrl: '', role: 'output', createdAt: Date.now(), updatedAt: Date.now() } as VideoAssetNodeData },
        ],
        edges: [
          { source: vid, sourceHandle: 'video_output', target: mt, targetHandle: 'motion_video', type: 'canvas' },
          { source: img, sourceHandle: 'image_output', target: mt, targetHandle: 'source_image', type: 'canvas' },
          { source: mt, sourceHandle: 'output_video', target: out, targetHandle: 'video_input', type: 'canvas' },
        ],
      }
    },
  },
]

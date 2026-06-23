export type NodeType =
  | 'text'
  | 'product_analysis'
  | 'image_asset'
  | 'image_gen'
  | 'llm'
  | 'group'
  | 'result_image'
  | 'video_asset'
  | 'motion_transfer'
  | 'video_gen'

export type ReferenceMenuItem = {
  nodeType: NodeType
  /** i18n key for the item title */
  titleKey: string
  /** i18n key for the item description */
  descriptionKey: string
  icon: string
}

export type ReferenceMenuRule = {
  sourceType: NodeType
  /** i18n key for the menu title */
  menuTitleKey: string
  items: ReferenceMenuItem[]
}

const MENU_RULES: ReferenceMenuRule[] = [
  {
    sourceType: 'text',
    menuTitleKey: 'reference.menu.useText',
    items: [
      { nodeType: 'image_gen', titleKey: 'reference.create.imageGen', descriptionKey: 'reference.desc.textToImage', icon: 'image_gen' },
      { nodeType: 'llm', titleKey: 'reference.create.llm', descriptionKey: 'reference.desc.llmContinue', icon: 'llm' },
      { nodeType: 'video_gen', titleKey: 'reference.create.videoGen', descriptionKey: 'reference.desc.textToVideo', icon: 'video_gen' },
    ],
  },
  {
    sourceType: 'product_analysis',
    menuTitleKey: 'reference.menu.useProductAnalysis',
    items: [
      { nodeType: 'text', titleKey: 'reference.create.textNode', descriptionKey: 'reference.desc.productAnalysisToText', icon: 'text' },
      { nodeType: 'llm', titleKey: 'reference.create.llm', descriptionKey: 'reference.desc.productAnalysisToLLM', icon: 'llm' },
    ],
  },
  {
    sourceType: 'image_asset',
    menuTitleKey: 'reference.menu.useImage',
    items: [
      { nodeType: 'image_gen', titleKey: 'reference.create.imageGen', descriptionKey: 'reference.desc.imageAsReference', icon: 'image_gen' },
      { nodeType: 'video_gen', titleKey: 'reference.create.videoGen', descriptionKey: 'reference.desc.imageAsFirstFrame', icon: 'video_gen' },
      { nodeType: 'llm', titleKey: 'reference.create.llm', descriptionKey: 'reference.desc.llmAnalyzeImage', icon: 'llm' },
      { nodeType: 'motion_transfer', titleKey: 'reference.create.motionTransfer', descriptionKey: 'reference.desc.motionTarget', icon: 'motion_transfer' },
    ],
  },
  {
    sourceType: 'llm',
    menuTitleKey: 'reference.menu.useLLMOutput',
    items: [
      { nodeType: 'text', titleKey: 'reference.create.textNode', descriptionKey: 'reference.desc.saveLLMOutput', icon: 'text' },
      { nodeType: 'image_gen', titleKey: 'reference.create.imageGen', descriptionKey: 'reference.desc.textToImage', icon: 'image_gen' },
      { nodeType: 'video_gen', titleKey: 'reference.create.videoGen', descriptionKey: 'reference.desc.textToVideo', icon: 'video_gen' },
    ],
  },
  {
    sourceType: 'image_gen',
    menuTitleKey: 'reference.menu.useResult',
    items: [
      { nodeType: 'image_gen', titleKey: 'reference.create.imageGen', descriptionKey: 'reference.desc.resultAsReference', icon: 'image_gen' },
      { nodeType: 'image_asset', titleKey: 'reference.create.imageAsset', descriptionKey: 'reference.desc.saveAsAsset', icon: 'image' },
      { nodeType: 'llm', titleKey: 'reference.create.llm', descriptionKey: 'reference.desc.llmAnalyzeResult', icon: 'llm' },
      { nodeType: 'video_gen', titleKey: 'reference.create.videoGen', descriptionKey: 'reference.desc.animateResult', icon: 'video_gen' },
    ],
  },
  {
    sourceType: 'result_image',
    menuTitleKey: 'reference.menu.useResultImage',
    items: [
      { nodeType: 'image_gen', titleKey: 'reference.create.imageGen', descriptionKey: 'reference.desc.imageAsReference', icon: 'image_gen' },
      { nodeType: 'llm', titleKey: 'reference.create.llm', descriptionKey: 'reference.desc.llmAnalyzeImage', icon: 'llm' },
      { nodeType: 'motion_transfer', titleKey: 'reference.create.motionTransfer', descriptionKey: 'reference.desc.motionTarget', icon: 'motion_transfer' },
      { nodeType: 'video_gen', titleKey: 'reference.create.videoGen', descriptionKey: 'reference.desc.imageAsFirstFrame', icon: 'video_gen' },
    ],
  },
  {
    sourceType: 'video_asset',
    menuTitleKey: 'reference.menu.useVideo',
    items: [
      { nodeType: 'motion_transfer', titleKey: 'reference.create.motionTransfer', descriptionKey: 'reference.desc.transferMotion', icon: 'motion_transfer' },
    ],
  },
  {
    sourceType: 'motion_transfer',
    menuTitleKey: 'reference.menu.useMotionResult',
    items: [
      { nodeType: 'video_asset', titleKey: 'reference.create.videoAsset', descriptionKey: 'reference.desc.saveMotionOutput', icon: 'video' },
    ],
  },
  {
    sourceType: 'video_gen',
    menuTitleKey: 'reference.menu.useGenVideo',
    items: [
      { nodeType: 'video_asset', titleKey: 'reference.create.videoAsset', descriptionKey: 'reference.desc.saveVideo', icon: 'video' },
    ],
  },
]

export function getReferenceMenuRule(sourceType: string): ReferenceMenuRule | null {
  return MENU_RULES.find((rule) => rule.sourceType === sourceType) || null
}

export function shouldShowReferenceMenu(sourceType: string): boolean {
  return MENU_RULES.some((rule) => rule.sourceType === sourceType)
}

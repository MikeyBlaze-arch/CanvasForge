import { LLM_MODEL_REGISTRY } from '../generation/llmModelRegistry'
import type { ProductAnalysisNodeData } from './nodeTypes'

export const DEFAULT_PRODUCT_ANALYSIS_OUTPUT_REQUIREMENT =
  '请提炼适合电商主图、详情页首屏、广告图和社媒营销图使用的核心卖点，并生成一段可直接用于图片生成节点的中文提示词。'

export function getDefaultAnalysisModel(): string {
  return LLM_MODEL_REGISTRY[0]?.id ?? ''
}

export function createDefaultProductAnalysisNodeData(now = Date.now()): ProductAnalysisNodeData {
  return {
    nodeType: 'product_analysis',
    title: '产品卖点分析',
    productName: '',
    productCategory: '',
    material: '',
    colorStyle: '',
    coreFunction: '',
    scene: '',
    targetAudience: '',
    outputRequirement: '',
    analysisModel: getDefaultAnalysisModel(),
    inputText: '',
    generatedPrompt: '',
    analysisResult: '',
    isRunning: false,
    error: '',
    updatedAt: now,
  }
}

export function buildProductAnalysisPrompt(data: ProductAnalysisNodeData, inputText = data.inputText): string {
  const normalizedInputText = inputText.trim() || '无'
  const outputRequirement = data.outputRequirement.trim() || DEFAULT_PRODUCT_ANALYSIS_OUTPUT_REQUIREMENT

  return [
    '你是一个电商产品卖点分析和图片生成提示词专家。',
    '',
    '请根据以下产品信息，分析该产品适合用于电商主图、详情页首屏、广告图、社媒营销图的核心卖点，并输出可继续用于图片生成节点的中文提示词。',
    '',
    '【上游输入信息】',
    normalizedInputText,
    '',
    '【产品基础信息】',
    `产品名称：${data.productName}`,
    `产品类别：${data.productCategory}`,
    `材质 / 工艺：${data.material}`,
    `颜色 / 风格：${data.colorStyle}`,
    `核心功能：${data.coreFunction}`,
    `使用场景：${data.scene}`,
    `目标人群：${data.targetAudience}`,
    '',
    '【输出要求】',
    outputRequirement,
    '',
    '请按照以下结构输出：',
    '',
    '1. 核心卖点',
    '提炼 5 个核心卖点，每个卖点用简洁标题表达。',
    '',
    '2. 卖点解释',
    '说明每个卖点对消费者的价值。',
    '',
    '3. 画面表现建议',
    '说明每个卖点适合如何在电商图片或营销图片中视觉化表现。',
    '',
    '4. 图片生成提示词',
    '输出一段完整中文提示词，可直接复制到图片生成节点使用。',
    '',
    '5. 负面提示词',
    '输出一段简短负面提示词，避免低质、变形、杂乱、文字错误、比例异常等问题。',
    '',
    '要求：',
    '- 使用中文输出',
    '- 不要输出 Markdown 表格',
    '- 不要输出无关解释',
    '- 不要编造不存在的品牌信息',
    '- 如果产品信息不足，请根据已提供信息进行合理泛化，但不要虚构具体参数',
  ].join('\n')
}

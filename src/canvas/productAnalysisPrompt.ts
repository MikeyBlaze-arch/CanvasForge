import { DEFAULT_LLM_MODEL_ID } from '../generation/llmModelRegistry'
import type {
  ProductAnalysisCommerceStyle,
  ProductAnalysisNodeData,
  ProductAnalysisStructuredOutput,
} from './nodeTypes'

export const PRODUCT_ANALYSIS_PAGE_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12] as const

export const PRODUCT_ANALYSIS_STYLE_LABELS: Record<ProductAnalysisCommerceStyle, string> = {
  domestic: '国内电商风格',
  overseas: '海外电商风格',
}

export const PRODUCT_ANALYSIS_INVALID_JSON_ERROR = '分析失败，模型返回格式不正确，请重试或更换分析模型'

export function getDefaultAnalysisModel(): string {
  return DEFAULT_LLM_MODEL_ID
}

export function normalizeProductAnalysisCommerceStyle(value: unknown): ProductAnalysisCommerceStyle {
  return value === 'overseas' ? 'overseas' : 'domestic'
}

export function normalizeProductAnalysisPageCount(value: unknown): number {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return PRODUCT_ANALYSIS_PAGE_COUNT_OPTIONS.includes(numberValue as typeof PRODUCT_ANALYSIS_PAGE_COUNT_OPTIONS[number])
    ? numberValue
    : 5
}

export function createDefaultProductAnalysisNodeData(now = Date.now()): ProductAnalysisNodeData {
  return {
    nodeType: 'product_analysis',
    title: '产品卖点分析',
    commerceStyle: 'domestic',
    analysisModel: getDefaultAnalysisModel(),
    pageCount: 5,
    productName: '',
    productCategory: '',
    material: '',
    colorStyle: '',
    coreFunction: '',
    scene: '',
    targetAudience: '',
    inputText: '',
    generatedPrompt: '',
    structuredOutput: undefined,
    isRunning: false,
    error: '',
    updatedAt: now,
  }
}

export function buildProductAnalysisPrompt(data: ProductAnalysisNodeData, inputText = data.inputText): string {
  const commerceStyle = normalizeProductAnalysisCommerceStyle(data.commerceStyle)
  const commerceStyleLabel = PRODUCT_ANALYSIS_STYLE_LABELS[commerceStyle]
  const pageCount = normalizeProductAnalysisPageCount(data.pageCount)
  const normalizedInputText = inputText.trim() || '无'

  return `你是一个专业电商产品卖点分析师和图片生成提示词设计师。

请根据我提供的产品信息，自动分析并提取产品结构化信息，用于电商主图、详情页、营销图和图片生成提示词设计。

你必须只返回一个 JSON 对象。
不要返回 Markdown。
不要返回代码块。
不要返回解释。
不要返回推理过程。
不要返回 <think> 或 </think>。

【电商风格】
${commerceStyleLabel}

【页数】
${pageCount}

【上游产品信息】
${normalizedInputText}

【当前已填写信息】
产品名称：${data.productName}
产品类别：${data.productCategory}
材质 / 工艺：${data.material}
颜色 / 风格：${data.colorStyle}
核心功能：${data.coreFunction}
使用场景：${data.scene}
目标人群：${data.targetAudience}

请返回以下 JSON 结构：

{
  "productName": "根据产品信息提取或概括的产品名称",
  "productCategory": "产品类别",
  "material": "材质 / 工艺",
  "colorStyle": "颜色 / 风格",
  "coreFunction": "核心功能，使用简洁中文描述",
  "scene": "使用场景，使用简洁中文描述",
  "targetAudience": "目标人群，使用简洁中文描述",
  "pagePlan": [
    "第1页页面规划",
    "第2页页面规划"
  ],
  "finalPrompt": "可直接用于图片生成节点的完整中文提示词"
}

要求：
1. pagePlan 数量必须等于 ${pageCount}
2. 如果无法确定产品名称，请根据产品类别和功能概括，不要编造品牌
3. 如果无法确定材质，请写“未明确，可根据产品视觉合理表现”
4. 如果无法确定颜色风格，请根据输入图片或文本概括视觉风格
5. 国内电商风格应偏重卖点明确、信息清晰、转化导向、适合中文电商页面
6. 海外电商风格应偏重品牌感、生活方式、干净画面、高级感、适合 Amazon / Shopify / 独立站
7. finalPrompt 需要适合图片生成节点使用
8. finalPrompt 不要包含无关解释
9. 不要输出任何 JSON 以外的内容`
}

export function cleanModelJsonResponse(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()
}

export function extractJsonObject(raw: string): string {
  const cleaned = cleanModelJsonResponse(raw)
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(PRODUCT_ANALYSIS_INVALID_JSON_ERROR)
  }
  return cleaned.slice(start, end + 1)
}

function stringifyValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePagePlan(value: unknown, pageCount: number): string[] {
  const rawPlan = Array.isArray(value)
    ? value.map((item) => stringifyValue(item)).filter(Boolean)
    : []
  const normalized = rawPlan.slice(0, pageCount)
  while (normalized.length < pageCount) {
    normalized.push(`第${normalized.length + 1}页：围绕产品核心卖点补充页面规划`)
  }
  return normalized
}

export function parseProductAnalysisStructuredOutput(
  raw: string,
  pageCount: number,
): ProductAnalysisStructuredOutput {
  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonObject(raw))
  } catch {
    throw new Error(PRODUCT_ANALYSIS_INVALID_JSON_ERROR)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(PRODUCT_ANALYSIS_INVALID_JSON_ERROR)
  }

  const record = parsed as Record<string, unknown>
  const normalizedPageCount = normalizeProductAnalysisPageCount(pageCount)
  return {
    productName: stringifyValue(record.productName),
    productCategory: stringifyValue(record.productCategory),
    material: stringifyValue(record.material),
    colorStyle: stringifyValue(record.colorStyle),
    coreFunction: stringifyValue(record.coreFunction),
    scene: stringifyValue(record.scene),
    targetAudience: stringifyValue(record.targetAudience),
    pagePlan: normalizePagePlan(record.pagePlan, normalizedPageCount),
    finalPrompt: stringifyValue(record.finalPrompt),
  }
}

export function formatProductAnalysisOutput(
  output: ProductAnalysisStructuredOutput,
  pageCount: number,
): string {
  const normalizedPageCount = normalizeProductAnalysisPageCount(pageCount)
  const pagePlan = normalizePagePlan(output.pagePlan, normalizedPageCount)
    .map((item, index) => {
      const trimmed = item.trim()
      return trimmed.startsWith(`第${index + 1}页`) ? trimmed : `第${index + 1}页：${trimmed}`
    })
    .join('\n')

  return `【产品卖点分析】

产品名称：${output.productName}
产品类别：${output.productCategory}
材质 / 工艺：${output.material}
颜色 / 风格：${output.colorStyle}
核心功能：${output.coreFunction}
使用场景：${output.scene}
目标人群：${output.targetAudience}

【${normalizedPageCount}页页面规划】
${pagePlan}

【图片生成提示词】
${output.finalPrompt}`.trim()
}

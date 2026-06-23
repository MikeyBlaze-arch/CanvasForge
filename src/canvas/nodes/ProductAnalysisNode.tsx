import React, { useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeShell } from '../../components/NodeShell'
import { PortLabel } from '../../components/PortLabel'
import { CompactSelect } from '../../components/Select'
import { useEdgeStore } from '../../store/edgeStore'
import { useNodeStore } from '../../store/nodeStore'
import { LLM_MODEL_REGISTRY, normalizeLLMModelId } from '../../generation/llmModelRegistry'
import { callLLM } from '../../generation/llmApi'
import { useI18n } from '../../i18n/useI18n'
import type { ProductAnalysisCommerceStyle, ProductAnalysisNodeData, TextNodeData } from '../nodeTypes'
import {
  PRODUCT_ANALYSIS_INVALID_JSON_ERROR,
  PRODUCT_ANALYSIS_PAGE_COUNT_OPTIONS,
  buildProductAnalysisPrompt,
  formatProductAnalysisOutput,
  getDefaultAnalysisModel,
  normalizeProductAnalysisCommerceStyle,
  normalizeProductAnalysisPageCount,
  parseProductAnalysisStructuredOutput,
} from '../productAnalysisPrompt'
import { getProductAnalysisInputs } from '../nodeHelpers'

type ProductAnalysisField = keyof Pick<
  ProductAnalysisNodeData,
  | 'productName'
  | 'productCategory'
  | 'material'
  | 'colorStyle'
  | 'coreFunction'
  | 'scene'
  | 'targetAudience'
>

const FIELD_KEYS: Array<{ field: ProductAnalysisField; labelKey: string; multiline?: boolean }> = [
  { field: 'productName', labelKey: 'productAnalysis.productName' },
  { field: 'productCategory', labelKey: 'productAnalysis.productCategory' },
  { field: 'material', labelKey: 'productAnalysis.material' },
  { field: 'colorStyle', labelKey: 'productAnalysis.colorStyle' },
  { field: 'coreFunction', labelKey: 'productAnalysis.coreFunction', multiline: true },
  { field: 'scene', labelKey: 'productAnalysis.scene', multiline: true },
  { field: 'targetAudience', labelKey: 'productAnalysis.targetAudience' },
]

export const ProductAnalysisNodeComponent = React.memo(function ProductAnalysisNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as ProductAnalysisNodeData
  const updateNodeData = useNodeStore((s) => s.updateNodeData)
  const nodes = useNodeStore((s) => s.nodes)
  const edges = useEdgeStore((s) => s.edges)
  const { t } = useI18n()

  const setField = useCallback(
    (field: ProductAnalysisField, value: string) => {
      updateNodeData(id, { [field]: value, updatedAt: Date.now() } as Partial<ProductAnalysisNodeData>)
    },
    [id, updateNodeData],
  )

  const setAnalysisModel = useCallback(
    (analysisModel: string) => {
      updateNodeData(id, { analysisModel, updatedAt: Date.now() } as Partial<ProductAnalysisNodeData>)
    },
    [id, updateNodeData],
  )

  const setCommerceStyle = useCallback(
    (commerceStyle: ProductAnalysisCommerceStyle) => {
      updateNodeData(id, { commerceStyle, updatedAt: Date.now() } as Partial<ProductAnalysisNodeData>)
    },
    [id, updateNodeData],
  )

  const setPageCount = useCallback(
    (value: string) => {
      updateNodeData(id, {
        pageCount: normalizeProductAnalysisPageCount(value),
        updatedAt: Date.now(),
      } as Partial<ProductAnalysisNodeData>)
    },
    [id, updateNodeData],
  )

  const writeResultToConnectedTextNodes = useCallback(
    (
      formattedOutput: string,
      analysisModel: string,
      commerceStyle: ProductAnalysisCommerceStyle,
      pageCount: number,
    ) => {
      const latestNodes = useNodeStore.getState().nodes
      const latestEdges = useEdgeStore.getState().edges
      const inputs = getProductAnalysisInputs(id, latestNodes, latestEdges)

      for (const { nodeId } of inputs.connectedOutputTextNodes) {
        updateNodeData(nodeId, {
          content: formattedOutput,
          sourceNodeId: id,
          sourceType: 'product_analysis',
          metadata: {
            source: 'product_analysis',
            analysisModel,
            commerceStyle,
            pageCount,
            createdAt: Date.now(),
          },
          updatedAt: Date.now(),
        } as Partial<TextNodeData>)
      }
    },
    [id, updateNodeData],
  )

  const handleRunAnalysis = useCallback(async () => {
    if (d.isRunning) return

    const inputs = getProductAnalysisInputs(id, nodes, edges)
    const inputText = inputs.inputText
    const imageInputs = inputs.imageInputs
    const analysisModel = normalizeLLMModelId(d.analysisModel || getDefaultAnalysisModel())
    const commerceStyle = normalizeProductAnalysisCommerceStyle(d.commerceStyle)
    const pageCount = normalizeProductAnalysisPageCount(d.pageCount)
    const hasCurrentFields = FIELD_KEYS.some((item) => String(d[item.field] || '').trim())

    if (!inputText.trim() && imageInputs.length === 0 && !hasCurrentFields) {
      updateNodeData(id, {
        analysisModel,
        commerceStyle,
        pageCount,
        isRunning: false,
        error: t('productAnalysis.error.missingInput'),
        updatedAt: Date.now(),
      } as Partial<ProductAnalysisNodeData>)
      return
    }

    const generatedPrompt = buildProductAnalysisPrompt(
      { ...d, analysisModel, commerceStyle, pageCount, inputText },
      inputText,
    )
    const requestPrompt = imageInputs.length > 0
      ? `${generatedPrompt}\n\n【已连接产品图片】\n请结合随消息提供的 ${imageInputs.length} 张产品图片进行卖点分析。仍然只能返回 JSON 对象，不要返回 JSON 以外的内容。`
      : generatedPrompt

    updateNodeData(id, {
      analysisModel,
      commerceStyle,
      pageCount,
      inputText,
      generatedPrompt: requestPrompt,
      isRunning: true,
      error: '',
      updatedAt: Date.now(),
    } as Partial<ProductAnalysisNodeData>)

    try {
      const rawResponse = await callLLM({
        modelId: analysisModel,
        messages: [{ role: 'user', content: requestPrompt }],
        imageUrls: imageInputs,
      })

      const structuredOutput = parseProductAnalysisStructuredOutput(rawResponse, pageCount)
      const formattedOutput = formatProductAnalysisOutput(structuredOutput, pageCount)

      updateNodeData(id, {
        productName: structuredOutput.productName,
        productCategory: structuredOutput.productCategory,
        material: structuredOutput.material,
        colorStyle: structuredOutput.colorStyle,
        coreFunction: structuredOutput.coreFunction,
        scene: structuredOutput.scene,
        targetAudience: structuredOutput.targetAudience,
        structuredOutput,
        analysisResult: formattedOutput,
        isRunning: false,
        error: '',
        updatedAt: Date.now(),
      } as Partial<ProductAnalysisNodeData>)
      writeResultToConnectedTextNodes(formattedOutput, analysisModel, commerceStyle, pageCount)
    } catch (error) {
      updateNodeData(id, {
        isRunning: false,
        error: error instanceof Error && error.message === PRODUCT_ANALYSIS_INVALID_JSON_ERROR
          ? PRODUCT_ANALYSIS_INVALID_JSON_ERROR
          : t('productAnalysis.error'),
        updatedAt: Date.now(),
      } as Partial<ProductAnalysisNodeData>)
    }
  }, [id, d, nodes, edges, updateNodeData, t, writeResultToConnectedTextNodes])

  const analysisModel = normalizeLLMModelId(d.analysisModel || getDefaultAnalysisModel())
  const commerceStyle = normalizeProductAnalysisCommerceStyle(d.commerceStyle)
  const pageCount = normalizeProductAnalysisPageCount(d.pageCount)
  const inputs = getProductAnalysisInputs(id, nodes, edges)
  const hasInput = inputs.connectedInputTextNodeCount + inputs.connectedInputImageNodeCount > 0
  const actionLabel = d.isRunning
    ? t('productAnalysis.running')
    : d.error
      ? t('productAnalysis.failed')
      : d.structuredOutput
        ? t('productAnalysis.done')
        : t('productAnalysis.run')

  return (
    <NodeShell
      nodeType="product_analysis"
      title={d.title || t('node.productAnalysis')}
      selected={!!selected}
      status={d.isRunning ? 'running' : d.error ? 'failed' : undefined}
      width={330}
      actions={
        <button
          type="button"
          className={`node-btn primary ${d.error ? 'node-btn-failed' : ''}`}
          onClick={handleRunAnalysis}
          disabled={d.isRunning}
        >
          {actionLabel}
        </button>
      }
    >
      <div className="product-analysis-controls nodrag nopan nowheel">
        <div className="product-analysis-control">
          <span className="node-field-label">{t('productAnalysis.commerceStyle')}</span>
          <div className="product-analysis-style-toggle">
            {(['domestic', 'overseas'] as ProductAnalysisCommerceStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                className={`product-analysis-style-button ${commerceStyle === style ? 'selected' : ''}`}
                onClick={() => setCommerceStyle(style)}
                onMouseDown={(event) => event.stopPropagation()}
              >
                {style === 'domestic' ? t('productAnalysis.domesticStyle') : t('productAnalysis.overseasStyle')}
              </button>
            ))}
          </div>
        </div>
        <div className="product-analysis-control">
          <span className="node-field-label">{t('productAnalysis.analysisModel')}</span>
          <CompactSelect
            value={analysisModel}
            onChange={setAnalysisModel}
            options={LLM_MODEL_REGISTRY.map((model) => ({ value: model.id, label: model.label }))}
          />
        </div>
      </div>

      <div className="product-analysis-page-row nodrag nopan nowheel">
        <span className="node-field-label">{t('productAnalysis.pageCount')}</span>
        <CompactSelect
          value={String(pageCount)}
          onChange={setPageCount}
          options={PRODUCT_ANALYSIS_PAGE_COUNT_OPTIONS.map((count) => ({
            value: String(count),
            label: `${count}${t('productAnalysis.pageUnit')}`,
          }))}
        />
      </div>

      <div className={`node-input-status ${hasInput ? 'connected' : 'disconnected'}`}>
        {hasInput ? t('status.connected') : t('status.optional')}
      </div>

      <div className="product-analysis-fields nodrag nopan nowheel">
        {FIELD_KEYS.map((item) => (
          <label key={item.field} className="product-analysis-field">
            <span className="node-field-label">{t(item.labelKey)}</span>
            {item.multiline ? (
              <textarea
                rows={2}
                value={d[item.field] ?? ''}
                onChange={(event) => setField(item.field, event.target.value)}
                className="cf-textarea product-analysis-input"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <input
                value={d[item.field] ?? ''}
                onChange={(event) => setField(item.field, event.target.value)}
                className="product-analysis-input"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              />
            )}
          </label>
        ))}
      </div>

      {d.error && <div className="product-analysis-error">{d.error}</div>}

      <div className="node-ports">
        <div className="node-port-group">
          <PortLabel type="target" id="main_input" mode="main" />
          <PortLabel type="target" id="product_info_input" mode="semantic" />
          <PortLabel type="target" id="image_input" mode="semantic" />
        </div>
        <div className="node-port-group">
          <PortLabel type="source" id="main_output" mode="main" />
          <PortLabel type="source" id="analysis_result_output" mode="semantic" />
        </div>
      </div>
    </NodeShell>
  )
})

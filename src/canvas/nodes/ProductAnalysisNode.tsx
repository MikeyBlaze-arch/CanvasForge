import React, { useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeShell } from '../../components/NodeShell'
import { PortLabel } from '../../components/PortLabel'
import { CompactSelect } from '../../components/Select'
import { useEdgeStore } from '../../store/edgeStore'
import { useNodeStore } from '../../store/nodeStore'
import { LLM_MODEL_REGISTRY } from '../../generation/llmModelRegistry'
import { callLLM } from '../../generation/llmApi'
import { useI18n } from '../../i18n/useI18n'
import type { ProductAnalysisNodeData, TextNodeData } from '../nodeTypes'
import { buildProductAnalysisPrompt, getDefaultAnalysisModel } from '../productAnalysisPrompt'
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
  | 'outputRequirement'
>

const FIELD_KEYS: Array<{ field: ProductAnalysisField; labelKey: string; multiline?: boolean }> = [
  { field: 'productName', labelKey: 'productAnalysis.productName' },
  { field: 'productCategory', labelKey: 'productAnalysis.productCategory' },
  { field: 'material', labelKey: 'productAnalysis.material' },
  { field: 'colorStyle', labelKey: 'productAnalysis.colorStyle' },
  { field: 'coreFunction', labelKey: 'productAnalysis.coreFunction', multiline: true },
  { field: 'scene', labelKey: 'productAnalysis.scene', multiline: true },
  { field: 'targetAudience', labelKey: 'productAnalysis.targetAudience' },
  { field: 'outputRequirement', labelKey: 'productAnalysis.outputRequirement', multiline: true },
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

  const writeResultToConnectedTextNodes = useCallback(
    (analysisResult: string, analysisModel: string) => {
      const inputs = getProductAnalysisInputs(id, nodes, edges)

      for (const { nodeId } of inputs.connectedOutputTextNodes) {
        updateNodeData(nodeId, {
          content: analysisResult,
          sourceNodeId: id,
          sourceType: 'product_analysis',
          metadata: {
            source: 'product_analysis',
            analysisModel,
            createdAt: Date.now(),
          },
          updatedAt: Date.now(),
        } as Partial<TextNodeData>)
      }
    },
    [id, nodes, edges, updateNodeData],
  )

  const handleRunAnalysis = useCallback(async () => {
    if (d.isRunning) return

    const inputs = getProductAnalysisInputs(id, nodes, edges)
    const inputText = inputs.inputText
    const imageInputs = inputs.imageInputs
    const analysisModel = d.analysisModel || getDefaultAnalysisModel()
    const generatedPrompt = buildProductAnalysisPrompt(
      { ...d, analysisModel, inputText },
      inputText,
    )
    const requestPrompt = imageInputs.length > 0
      ? `${generatedPrompt}\n\n【已连接产品图片】\n请结合随消息提供的 ${imageInputs.length} 张产品图片进行卖点分析。`
      : generatedPrompt

    updateNodeData(id, {
      analysisModel,
      inputText,
      generatedPrompt: requestPrompt,
      isRunning: true,
      error: '',
      updatedAt: Date.now(),
    } as Partial<ProductAnalysisNodeData>)

    try {
      const analysisResult = await callLLM({
        modelId: analysisModel,
        messages: [{ role: 'user', content: requestPrompt }],
        imageUrls: imageInputs,
      })

      updateNodeData(id, {
        analysisResult,
        isRunning: false,
        error: '',
        updatedAt: Date.now(),
      } as Partial<ProductAnalysisNodeData>)
      writeResultToConnectedTextNodes(analysisResult, analysisModel)
    } catch {
      updateNodeData(id, {
        isRunning: false,
        error: t('productAnalysis.error'),
        updatedAt: Date.now(),
      } as Partial<ProductAnalysisNodeData>)
    }
  }, [id, d, nodes, edges, updateNodeData, t, writeResultToConnectedTextNodes])

  const analysisModel = d.analysisModel || getDefaultAnalysisModel()
  const inputs = getProductAnalysisInputs(id, nodes, edges)
  const hasInput = inputs.connectedInputTextNodeCount + inputs.connectedInputImageNodeCount > 0

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
          {d.isRunning ? t('productAnalysis.running') : t('productAnalysis.run')}
        </button>
      }
    >
      <div className="product-analysis-model nodrag nopan nowheel">
        <span className="node-field-label">{t('productAnalysis.analysisModel')}</span>
        <CompactSelect
          value={analysisModel}
          onChange={setAnalysisModel}
          options={LLM_MODEL_REGISTRY.map((model) => ({ value: model.id, label: model.label }))}
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
                rows={item.field === 'outputRequirement' ? 3 : 2}
                value={d[item.field]}
                onChange={(event) => setField(item.field, event.target.value)}
                className="cf-textarea product-analysis-input"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <input
                value={d[item.field]}
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

      <div className="product-analysis-output">
        <div className="product-analysis-output-title">{t('productAnalysis.analysisResult')}</div>
        <textarea
          value={d.analysisResult}
          readOnly
          rows={6}
          className="cf-textarea product-analysis-output-text nodrag nopan nowheel"
          placeholder={t('productAnalysis.resultPlaceholder')}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        />
      </div>

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

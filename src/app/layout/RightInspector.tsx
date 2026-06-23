import React from 'react'
import { useNodeStore } from '../../store/nodeStore'
import type { CanvasNodeData, TextNodeData, ImageGenNodeData, LLMNodeData, ImageAssetNodeData, TextKind } from '../../canvas/nodeTypes'
import { DEFAULT_MODEL_BY_SERIES, getModelsForSeries, getModelsGroupedByCategory, IMAGE_SERIES, getModelSupportedResolutions, getModelSupportedAspectRatios, type ImageModelDefinition, type ImageModelSeries } from '../../generation/imageModelRegistry'
import { resolveGptImage2FixedSize } from '../../generation/sizeRegistry'
import { LLM_MODEL_REGISTRY, normalizeLLMModelId } from '../../generation/llmModelRegistry'
import { useI18n } from '../../i18n/useI18n'

export function RightInspector() {
  const nodes = useNodeStore((s) => s.nodes)
  const updateNodeData = useNodeStore((s) => s.updateNodeData)
  const selected = nodes.find((n) => n.selected)
  const { t } = useI18n()

  if (!selected) {
    return <div className="empty-state">{t('panel.emptySelection')}</div>
  }

  const d = selected.data as unknown as CanvasNodeData

  const TYPE_LABELS: Record<string, string> = {
    text: t('inspector.type.text'),
    product_analysis: t('inspector.type.productAnalysis'),
    image_asset: t('inspector.type.imageAsset'),
    image_gen: t('inspector.type.imageGen'),
    llm: t('inspector.type.llm'),
    result_image: t('inspector.type.resultImage'),
    group: t('inspector.type.group'),
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 4 }}>
        <span className={`node-type-badge ${d.nodeType}`}>{d.nodeType === 'product_analysis' ? t('node.productAnalysis') : d.nodeType.toUpperCase()}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{TYPE_LABELS[d.nodeType] ?? d.nodeType}</div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>{selected.id}</div>

      <div className="inspector-section">
        <div className="inspector-section-header">{t('panel.basic')}</div>
        <div className="inspector-field">
          <label className="inspector-field-label">{t('inspector.title')}</label>
          <input value={(d as any).title ?? ''} onChange={(e) => updateNodeData(selected.id, { title: e.target.value } as Partial<CanvasNodeData>)} />
        </div>
      </div>

      {d.nodeType === 'text' && <TextInspectorSections id={selected.id} data={d as TextNodeData} onUpdate={updateNodeData} />}
      {d.nodeType === 'image_gen' && <ImageGenInspectorSections id={selected.id} data={d as ImageGenNodeData} onUpdate={updateNodeData} />}
      {d.nodeType === 'llm' && <LLMInspectorSections id={selected.id} data={d as LLMNodeData} onUpdate={updateNodeData} />}
      {d.nodeType === 'image_asset' && <ImageAssetInspectorSections data={d as ImageAssetNodeData} />}
    </div>
  )
}

function TextInspectorSections({ id, data, onUpdate }: { id: string; data: TextNodeData; onUpdate: (id: string, patch: Partial<CanvasNodeData>) => void }) {
  const { t } = useI18n()

  return (
    <>
      <div className="inspector-section">
        <div className="inspector-section-header">{t('inspector.content')}</div>
        <div className="inspector-field">
          <label className="inspector-field-label">{t('inspector.textType')}</label>
          <select value={data.textKind} onChange={(e) => onUpdate(id, { textKind: e.target.value as TextNodeData['textKind'] } as Partial<TextNodeData>)}>
            {([
              'prompt', 'negative_prompt', 'style_prompt', 'product_description', 'reference_note', 'system_note',
            ] as TextKind[]).map((k) => <option key={k} value={k}>{t(`textKind.${k}`)}</option>)}
          </select>
        </div>
        <div className="inspector-field">
          <label className="inspector-field-label">{t('inspector.content')}</label>
          <textarea rows={6} value={data.content} onChange={(e) => onUpdate(id, { content: e.target.value } as Partial<TextNodeData>)} className="cf-textarea" />
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'right' }}>{data.content.length} {t('inspector.chars')}</div>
      </div>
    </>
  )
}

function ImageGenInspectorSections({ id, data, onUpdate }: { id: string; data: ImageGenNodeData; onUpdate: (id: string, patch: Partial<CanvasNodeData>) => void }) {
  const models = getModelsForSeries(data.modelSeries)
  const currentModel = models.find((m) => m.id === data.modelId)
  const ratios = getModelSupportedAspectRatios(data.modelId)
  const supportedResolutions = getModelSupportedResolutions(data.modelId)
  const resolutions = supportedResolutions
  const { t } = useI18n()

  const getAspectRatioLabel = (model: ImageModelDefinition | undefined, ratio: string, resolution: string) => {
    if (ratio === 'auto') return 'auto'
    if (model?.sizeMode === 'fixed_size') {
      return `${ratio} / ${resolveGptImage2FixedSize(ratio, resolution).replace('x', '×')}`
    }
    return ratio
  }

  const handleModelChange = (newModelId: string) => {
    const newSupportedRes = getModelSupportedResolutions(newModelId)
    let newRes = data.resolution
    if (!newSupportedRes.includes(data.resolution)) {
      const newModel = models.find((m) => m.id === newModelId)
      newRes = newModel?.defaultResolution ?? newSupportedRes[newSupportedRes.length - 1] ?? '2K'
      console.warn('[RightInspector] Resolution downgraded:', data.resolution, '->', newRes,
        'because model', newModelId, 'does not support', data.resolution)
    }
    onUpdate(id, { modelId: newModelId, resolution: newRes } as Partial<ImageGenNodeData>)
  }

  return (
    <>
      <div className="inspector-section">
        <div className="inspector-section-header">{t('panel.model')}</div>
        <div className="inspector-field">
          <label className="inspector-field-label">{t('inspector.series')}</label>
          <div className="segmented-control">
            {IMAGE_SERIES.map((s) => (
              <button key={s} className={`segmented-btn ${data.modelSeries === s ? 'active' : ''}`} onClick={() => {
                const nextModelId = DEFAULT_MODEL_BY_SERIES[s]
                const nextModel = getModelsForSeries(s).find((m) => m.id === nextModelId)
                onUpdate(id, {
                  modelSeries: s,
                  modelId: nextModelId,
                  aspectRatio: nextModel?.defaultAspectRatio ?? '1:1',
                  resolution: nextModel?.defaultResolution ?? '2K',
                } as Partial<ImageGenNodeData>)
              }}>{s}</button>
            ))}
          </div>
        </div>
        <div className="inspector-field">
          <label className="inspector-field-label">{t('inspector.model')}</label>
          <select value={data.modelId} onChange={(e) => handleModelChange(e.target.value)}>
            {getModelsGroupedByCategory(data.modelSeries).map((group) => (
              <optgroup key={group.category} label={group.group}>
                {group.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      <div className="inspector-section">
        <div className="inspector-section-header">{t('panel.outputs')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="inspector-field" style={{ flex: 1 }}>
            <label className="inspector-field-label">{t('inspector.ratio')}</label>
            <select value={data.aspectRatio} onChange={(e) => onUpdate(id, { aspectRatio: e.target.value } as Partial<ImageGenNodeData>)}>
              {ratios.map((r) => <option key={r} value={r}>{getAspectRatioLabel(currentModel, r, data.resolution)}</option>)}
            </select>
          </div>
          <div className="inspector-field" style={{ flex: 1 }}>
            <label className="inspector-field-label">{t('inspector.resolution')}</label>
            <select value={data.resolution} onChange={(e) => onUpdate(id, { resolution: e.target.value } as Partial<ImageGenNodeData>)}>
              {resolutions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="inspector-field">
          <label className="inspector-field-label">{t('inspector.seed')}</label>
          <input type="number" value={data.seed ?? ''} onChange={(e) => onUpdate(id, { seed: e.target.value ? Number(e.target.value) : undefined } as Partial<ImageGenNodeData>)} placeholder={t('inspector.random')} />
        </div>
      </div>
    </>
  )
}

function LLMInspectorSections({ id, data, onUpdate }: { id: string; data: LLMNodeData; onUpdate: (id: string, patch: Partial<CanvasNodeData>) => void }) {
  const { t } = useI18n()
  const llmModelId = normalizeLLMModelId(data.llmModelId)

  return (
    <>
      <div className="inspector-section">
        <div className="inspector-section-header">{t('panel.model')}</div>
        <div className="inspector-field">
          <label className="inspector-field-label">{t('inspector.llm')}</label>
          <select value={llmModelId} onChange={(e) => onUpdate(id, { llmModelId: e.target.value } as Partial<LLMNodeData>)}>
            {LLM_MODEL_REGISTRY.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div className="inspector-field">
          <label className="inspector-field-label">{t('inspector.systemPrompt')}</label>
          <textarea rows={4} value={data.systemPrompt ?? ''} onChange={(e) => onUpdate(id, { systemPrompt: e.target.value } as Partial<LLMNodeData>)} className="cf-textarea" />
        </div>
      </div>
    </>
  )
}

function ImageAssetInspectorSections({ data }: { data: ImageAssetNodeData }) {
  const { t } = useI18n()

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">{t('inspector.assetInfo')}</div>
      {data.imageUrl && <img src={data.imageUrl} style={{ width: '100%', borderRadius: 6, marginBottom: 8, border: '1px solid var(--border-primary)' }} alt="" />}
      <div className="inspector-field">
        <label className="inspector-field-label">{t('inspector.dimensions')}</label>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{data.naturalWidth ?? '-'} x {data.naturalHeight ?? '-'}</span>
      </div>
      <div className="inspector-field">
        <label className="inspector-field-label">{t('inspector.filename')}</label>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{data.fileName ?? '-'}</span>
      </div>
    </div>
  )
}

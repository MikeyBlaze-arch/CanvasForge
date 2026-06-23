import React, { useCallback, useState } from 'react'
import { ChevronDown, ChevronRight, Bug, Copy } from 'lucide-react'
import { useNodeStore } from '../../store/nodeStore'
import type { ImageGenNodeData } from '../../canvas/nodeTypes'
import { useI18n } from '../../i18n/useI18n'
import { getImageModelById } from '../../generation/imageModelRegistry'

function sanitizeDebugValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) return `[dataURL ${value.length} chars]`
    if (value.length > 600 && /^[A-Za-z0-9+/=\r\n]+$/.test(value)) return `[base64 ${value.length} chars]`
    return value.length > 1200 ? `${value.slice(0, 1200)}... [truncated ${value.length} chars]` : value
  }
  if (Array.isArray(value)) return value.map(sanitizeDebugValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, sanitizeDebugValue(child)])
    )
  }
  return value
}

function debugRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

type Translate = (key: string) => string

const DEBUG_STATUS_KEYS: Record<string, string> = {
  idle: 'status.idle',
  generating: 'status.generating',
  success: 'status.success',
  failed: 'status.failed',
}

function getDebugStatusLabel(status: string | undefined, t: Translate) {
  const key = status ? DEBUG_STATUS_KEYS[status] : undefined
  return key ? t(key) : String(status ?? '')
}

export function ImageGenDebugPanel() {
  const nodes = useNodeStore((s) => s.nodes)
  const updateNodeData = useNodeStore((s) => s.updateNodeData)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [jsonExpanded, setJsonExpanded] = useState<Set<string>>(new Set())
  const { t } = useI18n()

  const imageGenNodes = nodes.filter(
    (n) => (n.data as unknown as { nodeType?: string }).nodeType === 'image_gen'
  )

  const toggleNode = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleJson = useCallback((id: string) => {
    setJsonExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const copyPayload = useCallback((payload: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(sanitizeDebugValue(payload ?? {}), null, 2)).catch(() => {})
  }, [])

  if (imageGenNodes.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        <Bug size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
        <div>{t('debug.noNodes')}</div>
      </div>
    )
  }

  const renderNodeInfo = (data: ImageGenNodeData, nodeId: string) => {
    const model = getImageModelById(data.modelId)
    const modelLabel = model?.label ?? data.modelId
    const debug = debugRecord(data.lastDebugInfo)
    const payloadAndDebug = {
      payload: data.lastRequestPayload,
      debug: data.lastDebugInfo,
    }
    return (
      <div style={{ fontSize: 10 }}>
        <div><b>{t('debug.model')}:</b> {modelLabel}</div>
        {model?.backendModel && <div><b>{t('debug.backend')}:</b> {model.backendModel}</div>}
        <div><b>{t('debug.selectedLabel')}:</b> {String(debug.selectedLabel ?? modelLabel)}</div>
        <div><b>{t('debug.requestModel')}:</b> {String(debug.requestModel ?? model?.backendModel ?? '')}</div>
        <div><b>{t('debug.engineType')}:</b> {String(debug.engineType ?? model?.engineType ?? '')}</div>
        <div><b>{t('debug.sizeMode')}:</b> {String(debug.sizeMode ?? model?.sizeMode ?? '')}</div>
        <div><b>{t('debug.endpoint')}:</b> {String(debug.endpoint ?? '')}</div>
        <div><b>{t('debug.method')}:</b> {String(debug.method ?? '')}</div>
        <div><b>{t('debug.contentType')}:</b> {String(debug.contentType ?? '')}</div>
        <div><b>{t('debug.hasReferenceImages')}:</b> {String(debug.hasReferenceImages ?? false)}</div>
        <div><b>{t('debug.referenceImageCount')}:</b> {String(debug.referenceImageCount ?? data.lastReferenceImages?.length ?? 0)}</div>
        <div><b>{t('debug.payloadKeys')}:</b> {Array.isArray(debug.payloadKeys) ? debug.payloadKeys.join(', ') : ''}</div>
        <div><b>{t('debug.responseStatus')}:</b> {String(debug.responseStatus ?? '')}</div>
        <div><b>{t('debug.responseParserMatchedField')}:</b> {String(debug.responseParserMatchedField ?? '')}</div>
        {debug.rawResponsePreview != null && (
          <div style={{ wordBreak: 'break-all', maxHeight: 80, overflow: 'auto' }}>
            <b>{t('debug.rawResponsePreview')}:</b> {String(debug.rawResponsePreview)}
          </div>
        )}
        <div><b>{t('debug.ratio')}:</b> {data.aspectRatio} @ {data.resolution}</div>
        <div><b>{t('debug.seed')}:</b> {String(data.seed ?? t('debug.random'))}</div>
        <div><b>{t('debug.prompt')}:</b> {String(data.lastPrompt ?? t('debug.none'))}</div>
        <div><b>{t('debug.status')}:</b> {getDebugStatusLabel(data.status, t)}</div>
        <div><b>{t('debug.refs')}:</b> {String(data.lastReferenceImages?.length ?? 0)}</div>
        {data.error && <div style={{ color: 'var(--accent-red)' }}><b>{t('debug.error')}:</b> {data.error}</div>}
        {(data.lastRequestPayload != null || data.lastDebugInfo != null) && (
          <div>
            <div onClick={() => toggleJson(nodeId)} style={{ cursor: 'pointer', marginTop: 8 }}>
              {jsonExpanded.has(nodeId) ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              {' '}{t('debug.details')} <button onClick={(e) => { e.stopPropagation(); copyPayload(payloadAndDebug) }} style={{ fontSize: 9 }}><Copy size={10} /> {t('debug.copy')}</button>
            </div>
            {jsonExpanded.has(nodeId) && (
              <pre style={{ fontSize: 9, background: 'var(--field-bg)', padding: 6, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
                {JSON.stringify(sanitizeDebugValue(payloadAndDebug), null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-primary)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Bug size={14} /> {t('debug.title')} ({imageGenNodes.length})
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {imageGenNodes.map((node) => {
          const data = node.data as unknown as ImageGenNodeData
          const model = getImageModelById(data.modelId)
          const isExpanded = expandedNodes.has(node.id)
          return (
            <div key={node.id} style={{ border: '1px solid var(--border-primary)', borderRadius: 8, marginBottom: 6, overflow: 'hidden', background: 'var(--bg-node)' }}>
              <div onClick={() => toggleNode(node.id)} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', cursor: 'pointer', gap: 6, fontSize: 11, fontWeight: 500 }}>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span style={{ color: data.status === 'success' ? 'var(--accent-green)' : data.status === 'failed' ? 'var(--accent-red)' : 'var(--text-muted)', fontSize: 10 }}>
                  [{getDebugStatusLabel(data.status, t)}]
                </span>
                {node.id}
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)' }}>{model?.label ?? data.modelId}</span>
              </div>
              {isExpanded && <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-primary)' }}>{renderNodeInfo(data, node.id)}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

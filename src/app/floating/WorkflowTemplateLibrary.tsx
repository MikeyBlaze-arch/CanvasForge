import React, { useCallback } from 'react'
import { LayoutTemplate, Play, Wand2, Image, Type, Move } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { useNodeStore } from '../../store/nodeStore'
import { useEdgeStore } from '../../store/edgeStore'
import { useUndoRedoStore } from '../../store/undoRedoStore'
import { TEMPLATES, type WorkflowTemplate } from '../../templates/workflowTemplates'
import { useI18n } from '../../i18n/useI18n'

const ICONS: Record<string, React.ReactNode> = {
  image_gen: <Wand2 size={16} />,
  image: <Image size={16} />,
  llm: <Type size={16} />,
  motion_transfer: <Move size={16} />,
}

export function WorkflowTemplateLibrary() {
  const reactFlow = useReactFlow()
  const addNode = useNodeStore((s) => s.addNode)
  const setEdges = useEdgeStore((s) => s.setEdges)
  const edges = useEdgeStore((s) => s.edges)
  const { t } = useI18n()

  const handleSelect = useCallback((template: WorkflowTemplate) => {
    const { nodes: newNodes, edges: newEdges } = template.create()

    useUndoRedoStore.getState().capture(t('templates.useTemplate'))

    const center = reactFlow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })

    const offsetX = center.x - 350
    const offsetY = center.y - 200

    for (const node of newNodes) {
      node.position.x += offsetX
      node.position.y += offsetY
      addNode(node as Parameters<typeof addNode>[0])
    }

    const canvasEdges = newEdges.map((e, i) => ({
      ...e,
      id: `${template.id}-e${i}-${Date.now().toString(36)}`,
    }))
    setEdges([...edges, ...canvasEdges])
  }, [reactFlow, addNode, setEdges, edges, t])

  const categoryKeys = Array.from(new Set(TEMPLATES.map((tpl) => tpl.categoryKey)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-primary)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
        <LayoutTemplate size={14} /> {t('templates.title')} ({TEMPLATES.length})
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {categoryKeys.map((catKey) => (
          <div key={catKey}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{t(catKey)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TEMPLATES.filter((tpl) => tpl.categoryKey === catKey).map((tpl) => (
                <div key={tpl.id} onClick={() => handleSelect(tpl)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
                    border: '1px solid var(--border-primary)', background: 'var(--bg-node)', cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary)' }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--control-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {ICONS[tpl.icon] || <LayoutTemplate size={16} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{t(tpl.nameKey)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{t(tpl.descriptionKey)}</div>
                  </div>
                  <Play size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

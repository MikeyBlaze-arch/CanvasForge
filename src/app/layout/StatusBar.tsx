import React from 'react'
import { useNodeStore } from '../../store/nodeStore'
import { useEdgeStore } from '../../store/edgeStore'
import { useProjectStore } from '../../store/projectStore'
import { useI18n } from '../../i18n/useI18n'

export function StatusBar() {
  const nodeCount = useNodeStore((s) => s.nodes.length)
  const edgeCount = useEdgeStore((s) => s.edges.length)
  const lastSaved = useProjectStore((s) => s.lastSavedAt)
  const isDirty = useProjectStore((s) => s.isDirty)
  const { t, locale } = useI18n()

  return (
    <div className="statusbar">
      <span>{t('statusBar.nodes')}: {nodeCount}</span>
      <span>{t('statusBar.edges')}: {edgeCount}</span>
      {isDirty && (
        <>
          <div className="statusbar-dot dirty" />
          <span>{t('project.unsaved')}</span>
        </>
      )}
      {!isDirty && lastSaved && (
        <>
          <div className="statusbar-dot saved" />
          <span>{t('statusBar.savedAt', { time: new Date(lastSaved).toLocaleTimeString(locale) })}</span>
        </>
      )}
      <div style={{ flex: 1 }} />
      <span style={{ color: 'var(--text-muted)' }}>{t('statusBar.version')}</span>
    </div>
  )
}

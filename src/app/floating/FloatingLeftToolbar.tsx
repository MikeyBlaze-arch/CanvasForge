import React from 'react'
import { Plus, History, Settings, LayoutTemplate, Bug } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useApiSettingsStore } from '../../store/apiSettingsStore'
import { useI18n } from '../../i18n/useI18n'

export function FloatingLeftToolbar() {
  const toggleAddNodeMenu = useUIStore((s) => s.toggleAddNodeMenu)
  const activeRightPanel = useUIStore((s) => s.activeRightPanel)
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel)
  const openApiSettings = useApiSettingsStore((s) => s.openSettings)
  const { t } = useI18n()

  return (
    <div className="floating-left-toolbar">
      <button className="toolbar-btn-add" onClick={toggleAddNodeMenu} title={t('addNode.title')}>
        <Plus size={18} strokeWidth={2.5} />
      </button>

      <div className="toolbar-separator" />

      <button
        className={`toolbar-btn panel-trigger nodrag nopan nowheel ${activeRightPanel === 'history' ? 'active' : ''}`}
        onClick={() => toggleRightPanel('history')}
        title={t('panels.history')}
      >
        <History size={16} />
        {activeRightPanel === 'history' && <span className="toolbar-active-dot" />}
      </button>

      <button
        className={`toolbar-btn panel-trigger nodrag nopan nowheel ${activeRightPanel === 'imageGenDebug' ? 'active' : ''}`}
        onClick={() => toggleRightPanel('imageGenDebug')}
        title={t('panels.imageGenDebug')}
      >
        <Bug size={16} />
        {activeRightPanel === 'imageGenDebug' && <span className="toolbar-active-dot" />}
      </button>

      <button
        className={`toolbar-btn panel-trigger nodrag nopan nowheel ${activeRightPanel === 'workflowTemplates' ? 'active' : ''}`}
        onClick={() => toggleRightPanel('workflowTemplates')}
        title={t('panels.workflowTemplates')}
      >
        <LayoutTemplate size={16} />
        {activeRightPanel === 'workflowTemplates' && <span className="toolbar-active-dot" />}
      </button>

      <button className="toolbar-btn" onClick={openApiSettings} title={t('common.settings')}>
        <Settings size={16} />
      </button>
    </div>
  )
}

import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { RightInspector } from '../layout/RightInspector'
import { RightHistory } from '../layout/RightHistory'
import { ImageGenDebugPanel } from './ImageGenDebugPanel'
import { WorkflowTemplateLibrary } from './WorkflowTemplateLibrary'
import { useI18n } from '../../i18n/useI18n'

export function FloatingPanelDrawer() {
  const activeRightPanel = useUIStore((s) => s.activeRightPanel)
  const closeRightPanel = useUIStore((s) => s.closeRightPanel)
  const { t } = useI18n()

  useEffect(() => {
    if (!activeRightPanel) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRightPanel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeRightPanel, closeRightPanel])

  if (!activeRightPanel) return null

  const headerTitle: Record<string, string> = {
    inspector: t('panel.inspector'),
    history: t('panels.history'),
    imageGenDebug: t('panels.imageGenDebug'),
    workflowTemplates: t('panels.workflowTemplates'),
  }

  const renderContent = () => {
    switch (activeRightPanel) {
      case 'inspector': return <RightInspector />
      case 'history': return <RightHistory />
      case 'imageGenDebug': return <ImageGenDebugPanel />
      case 'workflowTemplates': return <WorkflowTemplateLibrary />
      default: return null
    }
  }

  return (
    <div
      className="floating-panel-drawer right-panel nodrag nopan nowheel"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="floating-panel-header">
        <span>{headerTitle[activeRightPanel] ?? ''}</span>
        <button className="floating-panel-close" onClick={closeRightPanel}>
          <X size={14} />
        </button>
      </div>
      <div className="floating-panel-body">
        {renderContent()}
      </div>
    </div>
  )
}

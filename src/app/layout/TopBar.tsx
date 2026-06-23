import React from 'react'
import { saveProject, exportProjectJSON, importProjectJSON } from '../../persistence/projectSerializer'
import { useProjectStore } from '../../store/projectStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useI18n } from '../../i18n/useI18n'

const toolItems = [
  { icon: 'V', labelKey: 'tool.select', active: true },
  { icon: 'H', labelKey: 'tool.hand' },
  { icon: 'L', labelKey: 'tool.connect' },
]

export function TopBar() {
  const { t } = useI18n()
  const projectName = useProjectStore((s) => s.currentProject?.name ?? t('project.untitled'))
  const isDirty = useProjectStore((s) => s.isDirty)
  const updateProjectName = useProjectStore((s) => s.updateProjectName)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)

  const handleSave = () => saveProject()

  const handleExport = () => {
    const json = exportProjectJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        importProjectJSON(reader.result as string)
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <div className="topbar">
      {/* Left */}
      <div className="topbar-left">
        <img className="app-project-icon" src="/icons/canvasforge/icon-32.png" alt="CanvasForge" />
        <span className="topbar-brand">CanvasForge</span>
        <div className="topbar-divider" />
        <input
          className="topbar-project-name"
          value={projectName}
          onChange={(e) => updateProjectName(e.target.value)}
        />
        {isDirty && <span className="topbar-dirty-dot" />}
      </div>

      {/* Center - tools */}
      <div className="topbar-center">
        {toolItems.map((tool) => (
          <button key={tool.labelKey} className={`topbar-tool-btn ${tool.active ? 'active' : ''}`} title={t(tool.labelKey)}>
            {tool.icon}
          </button>
        ))}
      </div>

      {/* Right */}
      <div className="topbar-right">
        <button className="topbar-action-btn" onClick={undo} title={t('topBar.undo')}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 7l3-3M4 7l3 3M4 7h6a3 3 0 110 6H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <button className="topbar-action-btn" onClick={redo} title={t('topBar.redo')}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M12 7L9 4M12 7L9 10M12 7H6a3 3 0 100 6h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="topbar-divider" />
        <button className="cf-btn cf-btn-primary cf-btn-sm" onClick={handleSave}>
          {t('common.save')}
        </button>
        <button className="cf-btn cf-btn-outline cf-btn-sm" onClick={handleExport}>
          {t('common.export')}
        </button>
        <button className="cf-btn cf-btn-outline cf-btn-sm" onClick={handleImport}>
          {t('topBar.import')}
        </button>
      </div>
    </div>
  )
}

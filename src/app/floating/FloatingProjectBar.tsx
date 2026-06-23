import React, { useCallback, useRef, useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useI18n } from '../../i18n/useI18n'

export function FloatingProjectBar() {
  const projectName = useProjectStore((s) => s.currentProject?.name ?? 'CanvasForge')
  const updateProjectName = useProjectStore((s) => s.updateProjectName)
  const isDirty = useProjectStore((s) => s.isDirty)
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt)
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const statusText = isDirty ? t('project.unsaved') : lastSavedAt ? t('project.saved') : t('project.savedLocal')

  const startEdit = useCallback(() => {
    setEditValue(projectName)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [projectName])

  const commitEdit = useCallback(() => {
    const name = editValue.trim() || t('project.untitled')
    updateProjectName(name)
    setEditing(false)
  }, [editValue, updateProjectName])

  const cancelEdit = useCallback(() => {
    setEditing(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { commitEdit() }
    if (e.key === 'Escape') { cancelEdit() }
  }, [commitEdit, cancelEdit])

  return (
    <div className="floating-project-bar">
      <div className="floating-project-logo">
        <img className="app-project-icon" src="/icons/canvasforge/icon-32.png" alt="CanvasForge" />
      </div>
      <div className="floating-project-info">
        {editing ? (
          <input
            ref={inputRef}
            className="floating-project-name-input nodrag nopan nowheel"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            maxLength={60}
          />
        ) : (
          <div className="floating-project-name" onClick={startEdit} style={{ cursor: 'text' }}>{projectName}</div>
        )}
        <div className="floating-project-status">
          <span style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: isDirty ? 'var(--accent-yellow)' : 'var(--accent-green)',
            flexShrink: 0,
          }} />
          {statusText}
        </div>
      </div>
    </div>
  )
}

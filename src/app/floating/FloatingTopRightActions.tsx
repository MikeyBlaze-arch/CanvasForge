import React from 'react'
import { Share2, Download, Languages, Moon, Sun } from 'lucide-react'
import { useNodeStore } from '../../store/nodeStore'
import { useUIStore } from '../../store/uiStore'
import { exportProjectJSON, importProjectJSON } from '../../persistence/projectSerializer'
import { useI18n } from '../../i18n/useI18n'

export function FloatingTopRightActions() {
  const nodeCount = useNodeStore((s) => s.nodes.length)
  const themeMode = useUIStore((s) => s.themeMode)
  const toggleThemeMode = useUIStore((s) => s.toggleThemeMode)
  const projectName = 'CanvasForge'
  const { toggleLocale, t } = useI18n()

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
    <div className="floating-top-right">
      <button className="floating-pill-btn" onClick={toggleThemeMode} title={t('settings.theme')}>
        {themeMode === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
        <span className="language-toggle-label">
          {themeMode === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}
        </span>
      </button>
      <button className="floating-pill-btn language-toggle-btn" onClick={toggleLocale} title={t('lang.toggle')}>
        <Languages size={14} />
        <span className="language-toggle-label">{t('lang.label')}</span>
      </button>
      <button className="floating-pill-btn" onClick={handleExport}>
        {nodeCount} {t('topBar.nodes')}
      </button>
      <button className="floating-pill-btn" onClick={handleImport}>
        <Download size={14} />
        {t('topBar.import')}
      </button>
      <button className="floating-circle-btn" onClick={handleExport} title={t('topBar.shareExport')}>
        <Share2 size={15} />
      </button>
    </div>
  )
}

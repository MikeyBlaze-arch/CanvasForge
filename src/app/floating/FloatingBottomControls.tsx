import React, { useCallback, useState } from 'react'
import { Maximize2, Grid3x3, HelpCircle, Map, SlidersHorizontal } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { type EdgeStyle, useUIStore } from '../../store/uiStore'
import { useI18n } from '../../i18n/useI18n'

export function FloatingBottomControls() {
  const reactFlow = useReactFlow()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const gridVisible = useUIStore((s) => s.gridVisible)
  const toggleGrid = useUIStore((s) => s.toggleGrid)
  const edgeStyle = useUIStore((s) => s.edgeStyle)
  const edgeCurvature = useUIStore((s) => s.edgeCurvature)
  const setEdgeStyle = useUIStore((s) => s.setEdgeStyle)
  const setEdgeCurvature = useUIStore((s) => s.setEdgeCurvature)
  const themeMode = useUIStore((s) => s.themeMode)
  const setThemeMode = useUIStore((s) => s.setThemeMode)
  const zoom = useUIStore((s) => s.viewportZoom)
  const setViewportZoom = useUIStore((s) => s.setViewportZoom)
  const { t } = useI18n()

  const handleFitView = useCallback(() => {
    reactFlow.fitView({ duration: 300, padding: 0.1 })
  }, [reactFlow])

  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = Number(e.target.value)
    setViewportZoom(newZoom)
    reactFlow.zoomTo(newZoom, { duration: 100 })
  }, [reactFlow, setViewportZoom])

  const handleResetView = useCallback(() => {
    setViewportZoom(1)
    reactFlow.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 })
  }, [reactFlow, setViewportZoom])

  return (
    <>
      <div className="floating-bottom-left">
        <button className="bottom-ctrl-btn" onClick={handleResetView} title={t('bottom.resetView')}>
          <Map size={14} />
        </button>
        <button className={`bottom-ctrl-btn ${gridVisible ? 'active' : ''}`} onClick={toggleGrid} title={t('bottom.toggleGrid')}>
          <Grid3x3 size={14} />
        </button>
        <button className="bottom-ctrl-btn" onClick={handleFitView} title={t('bottom.fitAll')}>
          <Maximize2 size={14} />
        </button>
        <input
          type="range"
          className="bottom-zoom-slider"
          min={0.1}
          max={2}
          step={0.05}
          value={zoom}
          onChange={handleZoomChange}
        />
        <span className="bottom-zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          className={`bottom-ctrl-btn ${settingsOpen ? 'active' : ''}`}
          onClick={() => setSettingsOpen((open) => !open)}
          title={t('settings.title')}
        >
          <SlidersHorizontal size={14} />
        </button>
        <button className="bottom-ctrl-btn" title={t('bottom.help')}>
          <HelpCircle size={14} />
        </button>
      </div>

      {settingsOpen && (
        <div className="floating-settings-popover">
          <div className="floating-settings-title">{t('settings.title')}</div>

          <div className="floating-settings-section">
            <label className="floating-settings-label">{t('settings.edgeStyle')}</label>
            <div className="settings-segmented">
              {([
                ['bezier', t('settings.edgeBezier')],
                ['straight', t('settings.edgeStraight')],
                ['step', t('settings.edgeStep')],
              ] as Array<[EdgeStyle, string]>).map(([style, label]) => (
                <button
                  key={style}
                  className={`settings-segment ${edgeStyle === style ? 'active' : ''}`}
                  onClick={() => setEdgeStyle(style)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="floating-settings-section">
            <div className="settings-slider-label-row">
              <label className="floating-settings-label">{t('settings.edgeCurvature')}</label>
              <span>{edgeCurvature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              className="settings-range"
              min={0}
              max={1}
              step={0.05}
              value={edgeCurvature}
              onChange={(event) => setEdgeCurvature(Number(event.target.value))}
              disabled={edgeStyle !== 'bezier'}
            />
          </div>

          <div className="floating-settings-section">
            <label className="floating-settings-label">{t('settings.theme')}</label>
            <div className="settings-segmented two">
              <button
                className={`settings-segment ${themeMode === 'dark' ? 'active' : ''}`}
                onClick={() => setThemeMode('dark')}
              >
                {t('settings.themeDark')}
              </button>
              <button
                className={`settings-segment ${themeMode === 'light' ? 'active' : ''}`}
                onClick={() => setThemeMode('light')}
              >
                {t('settings.themeLight')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

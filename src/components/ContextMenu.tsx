import React from 'react'

export type CtxMenuItem = {
  label: string
  icon?: string
  shortcut?: string
  action: () => void
  danger?: boolean
  disabled?: boolean
  featured?: boolean
}

type Props = {
  x: number
  y: number
  items: CtxMenuItem[]
  sections?: Array<{ label?: string; items: CtxMenuItem[] }>
  onClose: () => void
}

export function ContextMenu({ x, y, items, sections, onClose }: Props) {
  const allSections = sections ?? [{ items }]

  const left = typeof window === 'undefined' ? x : Math.max(12, Math.min(x, window.innerWidth - 260))
  const top = typeof window === 'undefined' ? y : Math.max(12, Math.min(y, window.innerHeight - 420))

  return (
    <div className="canvas-context-menu" style={{ left, top }} onClick={onClose}>
      {allSections.map((sec, si) => (
        <React.Fragment key={si}>
          {si > 0 && <div className="ctx-menu-separator" />}
          {sec.label && <div className="ctx-menu-label">{sec.label}</div>}
          {sec.items.map((item, i) => (
            <div
              key={i}
              className={`ctx-menu-item ${item.danger ? 'danger' : ''} ${item.featured ? 'featured' : ''}`}
              onClick={item.disabled ? undefined : item.action}
              style={item.disabled ? { opacity: 0.35, pointerEvents: 'none' } : undefined}
            >
              {item.icon && <span className="ctx-menu-item-icon">{item.icon}</span>}
              <span>{item.label}</span>
              {item.shortcut && <span className="ctx-menu-shortcut">{item.shortcut}</span>}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  )
}

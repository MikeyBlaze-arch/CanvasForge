import React, { useCallback, useEffect, useRef } from 'react'
import { Wand2, Type, ImageIcon, Bot, Image, Video, Move, Film } from 'lucide-react'
import type { ReferenceMenuItem } from '../canvas/referenceMenuRules'
import { useI18n } from '../i18n/useI18n'

type Props = {
  x: number
  y: number
  menuTitleKey: string
  items: ReferenceMenuItem[]
  onSelect: (nodeType: ReferenceMenuItem['nodeType']) => void
  onClose: () => void
}

const ICON_MAP: Record<string, React.ReactNode> = {
  text: <Type size={16} />,
  image_asset: <ImageIcon size={16} />,
  image_gen: <Wand2 size={16} />,
  llm: <Bot size={16} />,
  image: <Image size={16} />,
  video_asset: <Video size={16} />,
  motion_transfer: <Move size={16} />,
  video_gen: <Film size={16} />,
}

export function ReferenceCreateMenu({ x, y, menuTitleKey, items, onSelect, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Position menu to avoid viewport overflow
  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return

    const rect = menu.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let adjustedX = x
    let adjustedY = y

    // Adjust if menu would overflow right edge
    if (x + rect.width > viewportWidth - 20) {
      adjustedX = viewportWidth - rect.width - 20
    }

    // Adjust if menu would overflow bottom edge
    if (y + rect.height > viewportHeight - 20) {
      adjustedY = viewportHeight - rect.height - 20
    }

    // Adjust if menu would overflow left edge
    if (adjustedX < 20) {
      adjustedX = 20
    }

    // Adjust if menu would overflow top edge
    if (adjustedY < 20) {
      adjustedY = 20
    }
  }, [x, y])

  const handleClick = useCallback((nodeType: ReferenceMenuItem['nodeType']) => {
    onSelect(nodeType)
    onClose()
  }, [onSelect, onClose])

  return (
    <div
      ref={menuRef}
      className="reference-menu-overlay"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
    >
      <div
        className="reference-menu"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: `${x}px`,
          top: `${y}px`,
        }}
      >
        <div className="reference-menu-title">{t(menuTitleKey)}</div>
        <div className="reference-menu-list">
          {items.map((item) => (
            <button
              key={item.nodeType}
              type="button"
              className="reference-menu-item"
              onClick={() => handleClick(item.nodeType)}
            >
              <span className="reference-menu-icon">
                {ICON_MAP[item.icon] || ICON_MAP[item.nodeType]}
              </span>
              <div className="reference-menu-item-title">{t(item.titleKey)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

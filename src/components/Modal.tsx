import React from 'react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: Props) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="cf-modal-overlay" onClick={onClose}>
      <div className={['cf-modal', className].filter(Boolean).join(' ')} onClick={(event) => event.stopPropagation()}>
        {title && (
          <div className="cf-modal-header">
            <span>{title}</span>
            <button type="button" className="cf-modal-close" onClick={onClose}>x</button>
          </div>
        )}
        <div className="cf-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

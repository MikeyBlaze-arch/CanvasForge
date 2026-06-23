import React, { useEffect, useRef, useState } from 'react'

type Props = {
  open: boolean
  title: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function NameDialog({
  open,
  title,
  placeholder = '',
  defaultValue = '',
  confirmText = 'Create',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(defaultValue)
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 0)
    }
  }, [open, defaultValue])

  if (!open) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      onConfirm(value)
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onCancel()
  }

  const handleDialogClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div className="name-dialog-overlay nodrag nopan nowheel" onMouseDown={handleOverlayClick}>
      <div className="name-dialog nodrag nopan nowheel" onClick={handleDialogClick} onMouseDown={handleDialogClick}>
        <div className="name-dialog-title">{title}</div>
        <input
          ref={inputRef}
          className="name-dialog-input nodrag nopan nowheel"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={120}
        />
        <div className="name-dialog-actions">
          <button className="name-dialog-btn name-dialog-btn-cancel" onClick={() => onCancel()}>
            {cancelText}
          </button>
          <button className="name-dialog-btn name-dialog-btn-confirm" onClick={() => onConfirm(value)}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

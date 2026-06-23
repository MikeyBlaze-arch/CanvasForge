import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Maximize2, X } from 'lucide-react'
import { NodeShell } from '../../components/NodeShell'
import { PortLabel } from '../../components/PortLabel'
import { useNodeStore } from '../../store/nodeStore'
import type { TextNodeData } from '../nodeTypes'
import { useI18n } from '../../i18n/useI18n'

type TextEditModalProps = {
  value: string
  onChange: (value: string) => void
  onCancel: () => void
  onSave: () => void
}

function TextEditModal({ value, onChange, onCancel, onSave }: TextEditModalProps) {
  const { t } = useI18n()
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.setTimeout(() => modalTextareaRef.current?.focus(), 0)
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        onSave()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    },
    [onCancel, onSave],
  )

  return (
    <div className="cf-modal-overlay text-edit-modal-overlay" onMouseDown={onCancel}>
      <div className="cf-modal text-edit-modal nodrag nopan nowheel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="text-edit-modal-header">
          <span className="text-edit-modal-title">{t('textNode.modalTitle')}</span>
          <button
            type="button"
            className="text-edit-modal-close nodrag nopan"
            onClick={onCancel}
            aria-label={t('common.cancel')}
            title={t('common.cancel')}
          >
            <X size={16} />
          </button>
        </div>
        <div className="text-edit-modal-body">
          <textarea
            ref={modalTextareaRef}
            className="text-edit-modal-textarea"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('textNode.placeholder')}
          />
        </div>
        <div className="text-edit-modal-actions">
          <button type="button" className="cf-btn cf-btn-sm" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="cf-btn cf-btn-sm cf-btn-primary" onClick={onSave}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

const TEXT_NODE_MIN_WIDTH = 160
const TEXT_NODE_MIN_HEIGHT = 90
const TEXT_NODE_MAX_WIDTH = 800
const TEXT_NODE_MAX_HEIGHT = 600
const TEXT_NODE_DEFAULT_SIZE = { width: 300, height: 240 } as const

export const TextNodeComponent = React.memo(function TextNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as TextNodeData
  const updateNodeData = useNodeStore((s) => s.updateNodeData)
  const [editValue, setEditValue] = useState(d.content)
  const [isEditing, setIsEditing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalValue, setModalValue] = useState(d.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isComposingRef = useRef(false)
  const { t } = useI18n()

  // Free resize (width + height, no aspect lock). Live preview via local
  // dragSize; the final size is committed to node data on pointer-up so it
  // survives save / reload / project restore.
  const sizeFromData = d.size ?? TEXT_NODE_DEFAULT_SIZE
  const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null)
  const dragSizeRef = useRef<{ width: number; height: number } | null>(null)
  const activeSize = dragSize ?? sizeFromData

  const startResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startY = event.clientY
    const startWidth = activeSize.width
    const startHeight = activeSize.height
    const onMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(
        TEXT_NODE_MAX_WIDTH,
        Math.max(TEXT_NODE_MIN_WIDTH, Math.round(startWidth + moveEvent.clientX - startX)),
      )
      const nextHeight = Math.min(
        TEXT_NODE_MAX_HEIGHT,
        Math.max(TEXT_NODE_MIN_HEIGHT, Math.round(startHeight + moveEvent.clientY - startY)),
      )
      const next = { width: nextWidth, height: nextHeight }
      dragSizeRef.current = next
      setDragSize(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const finalSize = dragSizeRef.current
      dragSizeRef.current = null
      setDragSize(null)
      if (finalSize) {
        updateNodeData(id, { size: finalSize, updatedAt: Date.now() } as Partial<TextNodeData>)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [activeSize.width, activeSize.height, id, updateNodeData])

  useEffect(() => {
    if (isComposingRef.current) return
    setEditValue(d.content)
    setModalValue(d.content)
  }, [d.content])

  const commitText = useCallback((value = editValue) => {
    updateNodeData(id, { content: value, updatedAt: Date.now() } as Partial<TextNodeData>)
    setEditValue(value)
  }, [id, editValue, updateNodeData])

  const startEditing = useCallback(() => {
    setEditValue(d.content)
    setIsEditing(true)
    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }, [d.content])

  const saveInline = useCallback(() => {
    commitText()
    setIsEditing(false)
    textareaRef.current?.blur()
  }, [commitText])

  const cancelInline = useCallback(() => {
    setEditValue(d.content)
    setIsEditing(false)
    textareaRef.current?.blur()
  }, [d.content])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        saveInline()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelInline()
      }
    },
    [cancelInline, saveInline]
  )

  const openModal = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setModalValue(isEditing ? editValue : d.content)
    setModalOpen(true)
  }, [d.content, editValue, isEditing])

  const saveModal = useCallback(() => {
    commitText(modalValue)
    setIsEditing(false)
    setModalOpen(false)
  }, [commitText, modalValue])

  return (
    <NodeShell
      nodeType="text"
      title={t('node.text')}
      selected={!!selected}
      width={activeSize.width}
    >
      <div
        className={`text-node-surface ${isEditing ? 'editing' : ''}`}
        style={{ height: activeSize.height }}
        onDoubleClick={startEditing}
      >
        <textarea
          ref={textareaRef}
          className={`text-node-editor ${isEditing ? 'nodrag nopan nowheel' : ''}`}
          value={editValue}
          readOnly={!isEditing}
          onChange={(event) => setEditValue(event.target.value)}
          onBlur={() => {
            if (isEditing && !isComposingRef.current) saveInline()
          }}
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={(event) => {
            isComposingRef.current = false
            setEditValue(event.currentTarget.value)
          }}
          onKeyDown={handleKeyDown}
          onMouseDown={(event) => {
            if (isEditing) event.stopPropagation()
          }}
          onClick={(event) => {
            if (isEditing) event.stopPropagation()
          }}
          placeholder={t('textNode.doubleClickEdit')}
          rows={6}
        />
        <button
          type="button"
          className="text-node-expand-btn nodrag nopan"
          onClick={openModal}
          title={t('textNode.modalTitle')}
          aria-label={t('textNode.modalTitle')}
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {selected && (
        <div
          className="text-node-resize-handle nodrag nopan"
          onMouseDown={startResize}
          title={t('textNode.resize')}
          aria-label={t('textNode.resize')}
        />
      )}

      {/* Handles - main handles visible, semantic handles invisible */}
      <div className="node-ports">
        <div className="node-port-group">
          <PortLabel type="target" id="main_input" mode="main" />
          <PortLabel type="target" id="llm_input" mode="semantic" />
        </div>
        <div className="node-port-group">
          <PortLabel type="source" id="main_output" mode="main" />
          <PortLabel type="source" id="prompt" mode="semantic" />
          <PortLabel type="source" id="negative_prompt" mode="semantic" />
          <PortLabel type="source" id="style_prompt" mode="semantic" />
          <PortLabel type="source" id="text" mode="semantic" />
        </div>
      </div>
      {modalOpen && (
        <TextEditModal
          value={modalValue}
          onChange={setModalValue}
          onCancel={() => setModalOpen(false)}
          onSave={saveModal}
        />
      )}
    </NodeShell>
  )
})

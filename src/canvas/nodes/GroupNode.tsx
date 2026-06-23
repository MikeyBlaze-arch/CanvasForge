import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { GroupNodeData } from '../nodeTypes'
import { useI18n } from '../../i18n/useI18n'
import { useNodeStore } from '../../store/nodeStore'
import { useEdgeStore } from '../../store/edgeStore'
import { useUndoRedoStore } from '../../store/undoRedoStore'
import { useProjectStore } from '../../store/projectStore'
import { IMAGE_COLLECTION_OUTPUT_HANDLE, resolveGroupImageOutputs } from '../groupImageOutputs'

function resolveTitle(data: GroupNodeData, fallback: string): string {
  if (typeof data.title === 'string' && data.title.trim()) return data.title
  const d = data as Record<string, unknown>
  if (typeof d.label === 'string' && (d.label as string).trim()) return d.label as string
  if (typeof d.name === 'string' && (d.name as string).trim()) return d.name as string
  return fallback
}

export const GroupNodeComponent = React.memo(function GroupNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as GroupNodeData
  const { t } = useI18n()
  const updateNodeData = useNodeStore((s) => s.updateNodeData)
  const nodes = useNodeStore((s) => s.nodes)
  const edges = useEdgeStore((s) => s.edges)
  const width = d.width ?? 560
  const height = d.height ?? 430
  const imageOutputCount = useMemo(
    () => resolveGroupImageOutputs(id, nodes, edges).length,
    [id, nodes, edges]
  )

  const displayTitle = resolveTitle(d, t('group.untitled'))
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(displayTitle)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) {
      setDraftTitle(displayTitle)
    }
  }, [displayTitle, editing])

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing])

  const startRename = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setDraftTitle(displayTitle)
    setEditing(true)
  }, [displayTitle])

  const saveRename = useCallback(() => {
    setEditing(false)
    const nextTitle = draftTitle.trim() || t('group.untitled')
    if (nextTitle === displayTitle) return

    useUndoRedoStore.getState().capture(t('group.rename'))
    updateNodeData(id, { title: nextTitle, label: nextTitle, updatedAt: Date.now() } as Partial<GroupNodeData>)
    useProjectStore.getState().markDirty()
  }, [draftTitle, displayTitle, id, updateNodeData, t])

  const cancelRename = useCallback(() => {
    setDraftTitle(displayTitle)
    setEditing(false)
  }, [displayTitle])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      saveRename()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelRename()
    }
  }, [saveRename, cancelRename])

  return (
    <div
      className={`group-node-frame${selected ? ' selected' : ''}`}
      style={{ width, height }}
      aria-label={displayTitle}
      data-node-id={id}
    >
      <div
        className="group-node-title nodrag nopan nowheel"
        onDoubleClick={startRename}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="group-node-title-input nodrag nopan nowheel"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveRename}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            placeholder={t('group.namePlaceholder')}
            maxLength={120}
          />
        ) : (
          <span>{displayTitle}</span>
        )}
      </div>
      <div className="group-node-surface">
        <div className="group-node-grid" />
      </div>
      {imageOutputCount > 0 && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id={IMAGE_COLLECTION_OUTPUT_HANDLE}
            isConnectable={true}
            className="react-flow__handle port-dot source visible group-image-output-handle"
          />
          <div className="group-image-output-label">
            图片 x{imageOutputCount}
          </div>
        </>
      )}
    </div>
  )
})

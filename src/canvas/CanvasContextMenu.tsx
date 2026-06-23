import React, { useEffect, useRef } from 'react'
import { ContextMenu, type CtxMenuItem } from '../components/ContextMenu'
import { useUIStore } from '../store/uiStore'
import { useNodeActions } from './hooks/useNodeActions'
import { useReactFlow } from '@xyflow/react'
import { useNodeStore } from '../store/nodeStore'
import type { CanvasNodeData } from './nodeTypes'
import { useI18n } from '../i18n/useI18n'

export function CanvasContextMenu() {
  const ctx = useUIStore((s) => s.contextMenu)
  const hideContextMenu = useUIStore((s) => s.hideContextMenu)
  const showAddNodeMenuAt = useUIStore((s) => s.showAddNodeMenuAt)
  const { addImageAssetNode, deleteNode, duplicateNode } = useNodeActions()
  const reactFlow = useReactFlow()
  const nodes = useNodeStore((s) => s.nodes)
  const menuRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    if (!ctx.visible) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideContextMenu()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctx.visible, hideContextMenu])

  if (!ctx.visible) return null

  const flowPos = reactFlow.screenToFlowPosition({ x: ctx.x, y: ctx.y })

  const nodeData = ctx.nodeId
    ? (nodes.find((n) => n.id === ctx.nodeId)?.data as unknown as CanvasNodeData)
    : null

  const canvasSections = [
    {
      items: [
        { label: t('context.upload'), featured: true, action: () => { addImageAssetNode(flowPos); hideContextMenu() } },
      ] as CtxMenuItem[],
    },
    {
      items: [
        { label: t('context.addAsset'), action: () => { addImageAssetNode(flowPos); hideContextMenu() } },
        { label: t('context.addNode'), action: () => { hideContextMenu(); showAddNodeMenuAt({ x: ctx.x, y: ctx.y }, flowPos) } },
        { label: t('context.addGroup'), action: () => { hideContextMenu(); useUIStore.getState().openGroupDialog({ open: true, mode: 'empty', position: flowPos }) } },
      ] as CtxMenuItem[],
    },
    {
      items: [
        { label: t('context.undo'), shortcut: 'CtrlZ', disabled: true, action: () => {} },
        { label: t('context.redo'), shortcut: 'ShiftCtrlZ', disabled: true, action: () => {} },
        { label: t('context.paste'), shortcut: 'CtrlV', disabled: true, action: () => {} },
      ] as CtxMenuItem[],
    },
  ]

  const imageGenExtra: Array<{ label?: string; items: CtxMenuItem[] }> = [
    {
      label: t('context.section.generation'),
      items: [
        { label: t('context.generateImage'), icon: '>', action: () => { hideContextMenu() } },
        { label: t('context.regenerate'), icon: 'R', action: () => { hideContextMenu() } },
        { label: t('context.copyConfig'), icon: 'C', action: () => { hideContextMenu() } },
      ],
    },
  ]

  const imageAssetExtra: Array<{ label?: string; items: CtxMenuItem[] }> = [
    {
      label: t('context.section.imageAsset'),
      items: [
        { label: t('context.setAsReferenceImg'), icon: 'R', action: () => { hideContextMenu() } },
        { label: t('context.connectToLLM'), icon: 'L', action: () => { hideContextMenu() } },
        { label: t('context.exportImg'), icon: 'E', action: () => { hideContextMenu() } },
      ],
    },
  ]

  const llmExtra: Array<{ label?: string; items: CtxMenuItem[] }> = [
    {
      label: t('context.section.llm'),
      items: [
        { label: t('context.runLLM'), icon: '>', action: () => { hideContextMenu() } },
        { label: t('context.outputToTextNode'), icon: 'T', action: () => { hideContextMenu() } },
        { label: t('context.clearOutput'), icon: 'C', action: () => { hideContextMenu() } },
      ],
    },
  ]

  const textExtra: Array<{ label?: string; items: CtxMenuItem[] }> = [
    {
      label: t('context.section.textNode'),
      items: [
        { label: t('context.copyText'), icon: 'C', action: () => { hideContextMenu() } },
        { label: t('context.clearText'), icon: 'X', action: () => { hideContextMenu() } },
      ],
    },
  ]

  const resultExtra: Array<{ label?: string; items: CtxMenuItem[] }> = [
    {
      label: t('context.section.result'),
      items: [
        { label: t('context.setAsReference'), icon: 'R', action: () => { hideContextMenu() } },
        { label: t('context.exportImage'), icon: 'E', action: () => { hideContextMenu() } },
        { label: t('context.copyPrompt'), icon: 'C', action: () => { hideContextMenu() } },
      ],
    },
  ]

  const commonNodeSections: Array<{ label?: string; items: CtxMenuItem[] }> = [
    {
      items: [
        { label: t('context.runNode'), icon: '>', shortcut: 'Ctrl+Enter', action: () => { hideContextMenu() } },
      ],
    },
    {
      label: t('context.section.edit'),
      items: [
        { label: t('context.copy'), icon: 'C', shortcut: 'Ctrl+C', action: () => { if (ctx.nodeId) duplicateNode(ctx.nodeId); hideContextMenu() } },
        { label: t('context.clone'), icon: 'D', shortcut: 'Ctrl+D', action: () => { if (ctx.nodeId) duplicateNode(ctx.nodeId); hideContextMenu() } },
      ],
    },
    {
      label: t('context.section.actions'),
      items: [
        { label: t('context.disconnect'), icon: 'X', action: () => { hideContextMenu() } },
      ],
    },
    {
      items: [
        { label: t('context.delete'), icon: 'Del', danger: true, shortcut: 'Del', action: () => { if (ctx.nodeId) deleteNode(ctx.nodeId); hideContextMenu() } },
      ],
    },
  ]

  let sections: Array<{ label?: string; items: CtxMenuItem[] }>

  if (!ctx.nodeId) {
    sections = canvasSections
  } else {
    sections = [...commonNodeSections]
    if (nodeData?.nodeType === 'image_gen') {
      sections = [...imageGenExtra, ...sections]
    }
    if (nodeData?.nodeType === 'image_asset') {
      sections = [...imageAssetExtra, ...sections]
    }
    if (nodeData?.nodeType === 'llm') {
      sections = [...llmExtra, ...sections]
    }
    if (nodeData?.nodeType === 'text') {
      sections = [...textExtra, ...sections]
    }
    if (nodeData?.nodeType === 'result_image') {
      sections = [...resultExtra, ...sections]
    }
  }

  return (
    <div ref={menuRef}>
      <ContextMenu
        x={ctx.x}
        y={ctx.y}
        items={[]}
        sections={sections}
        onClose={hideContextMenu}
      />
    </div>
  )
}

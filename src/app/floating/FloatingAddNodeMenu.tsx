import React, { useEffect, useRef } from 'react'
import { Type, ImageIcon, Wand2, Bot, FolderPlus, Upload, Video, Move, Film, ClipboardList } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useNodeActions } from '../../canvas/hooks/useNodeActions'
import { useReactFlow } from '@xyflow/react'
import { useI18n } from '../../i18n/useI18n'

export function FloatingAddNodeMenu() {
  const open = useUIStore((s) => s.addNodeMenuOpen)
  const setOpen = useUIStore((s) => s.setAddNodeMenuOpen)
  const menuPosition = useUIStore((s) => s.addNodeMenuPosition)
  const menuFlowPosition = useUIStore((s) => s.addNodeMenuFlowPosition)
  const menuRef = useRef<HTMLDivElement>(null)
  const { addTextNode, addProductAnalysisNode, addImageAssetNode, addImageGenNode, addLLMNode, addVideoAssetNode, addMotionTransferNode, addVideoGenNode, addImageCompareNode } = useNodeActions()
  const reactFlow = useReactFlow()
  const { t } = useI18n()

  const NODE_ITEMS = [
    {
      group: t('addNode.group.basic'),
      items: [
        { id: 'text', icon: Type, label: t('addNode.text'), desc: t('addNode.text.desc') },
        { id: 'product_analysis', icon: ClipboardList, label: t('addNode.productAnalysis'), desc: t('addNode.productAnalysis.desc') },
        { id: 'image_asset', icon: ImageIcon, label: t('addNode.image'), desc: t('addNode.image.desc') },
        { id: 'image_compare', icon: ImageIcon, label: t('addNode.imageCompare'), desc: t('addNode.imageCompare.desc') },
        { id: 'video_asset', icon: Video, label: t('addNode.videoAsset'), desc: t('addNode.videoAsset.desc') },
      ],
    },
    {
      group: t('addNode.group.generation'),
      items: [
        { id: 'image_gen', icon: Wand2, label: t('addNode.imageGen'), desc: t('addNode.imageGen.desc') },
        { id: 'video_gen', icon: Film, label: t('addNode.videoGen'), desc: t('addNode.videoGen.desc') },
        { id: 'motion_transfer', icon: Move, label: t('addNode.motionTransfer'), desc: t('addNode.motionTransfer.desc') },
      ],
    },
    {
      group: t('addNode.group.aiAgent'),
      items: [
        { id: 'llm', icon: Bot, label: t('addNode.llm'), desc: t('addNode.llm.desc') },
      ],
    },
    {
      group: t('addNode.group.organize'),
      items: [
        { id: 'group', icon: FolderPlus, label: t('addNode.groupNode'), desc: t('addNode.groupNode.desc') },
      ],
    },
    {
      group: t('addNode.group.resources'),
      items: [
        { id: 'upload', icon: Upload, label: t('addNode.upload'), desc: t('addNode.upload.desc') },
      ],
    },
  ]

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, setOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [setOpen])

  if (!open) return null

  const center = reactFlow.getViewport()
  const fallbackPos = {
    x: -center.x / center.zoom + 300,
    y: -center.y / center.zoom + 200,
  }
  const basePos = menuFlowPosition ?? fallbackPos

  const menuStyle = menuPosition
    ? {
        left: Math.max(12, Math.min(menuPosition.x, window.innerWidth - 326)),
        top: Math.max(12, Math.min(menuPosition.y, window.innerHeight - 560)),
        transform: 'none',
      }
    : undefined

  const handleAdd = (id: string) => {
    if (id === 'group') {
      useUIStore.getState().openGroupDialog({
        open: true,
        mode: 'empty',
        position: basePos,
      })
      setOpen(false)
      return
    }
    switch (id) {
      case 'text': addTextNode(basePos); break
      case 'product_analysis': addProductAnalysisNode(basePos); break
      case 'image_asset': addImageAssetNode(basePos); break
      case 'image_gen': addImageGenNode(basePos); break
      case 'llm': addLLMNode(basePos); break
      case 'video_asset': addVideoAssetNode(basePos); break
      case 'video_gen': addVideoGenNode(basePos); break
      case 'motion_transfer': addMotionTransferNode(basePos); break
      case 'image_compare': addImageCompareNode(basePos); break
      case 'upload': addImageAssetNode(basePos); break
    }
    setOpen(false)
  }

  return (
    <div
      className={`floating-add-menu ${menuPosition ? 'from-canvas' : ''}`}
      ref={menuRef}
      style={menuStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="floating-add-menu-title">{t('addNode.title')}</div>
      {NODE_ITEMS.map((group, gi) => (
        <div key={gi} className="floating-add-menu-group">
          <div className="floating-add-menu-group-label">{group.group}</div>
          {group.items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`floating-add-menu-item ${item.id === 'text' ? 'featured' : ''}`}
                onClick={() => handleAdd(item.id)}
              >
                <div className="floating-add-menu-icon">
                  <Icon size={16} />
                </div>
                <div className="floating-add-menu-name">
                  {item.label}
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

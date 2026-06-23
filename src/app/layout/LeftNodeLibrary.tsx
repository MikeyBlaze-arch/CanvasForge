import React, { useState } from 'react'
import { useNodeActions } from '../../canvas/hooks/useNodeActions'
import { useReactFlow } from '@xyflow/react'
import { useI18n } from '../../i18n/useI18n'

type NodeItem = {
  type: string
  labelKey: string
  descKey: string
  color: string
}

type NodeGroup = {
  labelKey: string
  items: NodeItem[]
}

const NODE_GROUPS: NodeGroup[] = [
  {
    labelKey: 'addNode.group.basic',
    items: [
      { type: 'text', labelKey: 'addNode.text', descKey: 'addNode.text.desc', color: 'var(--node-text)' },
      { type: 'product_analysis', labelKey: 'addNode.productAnalysis', descKey: 'addNode.productAnalysis.desc', color: '#14b8a6' },
      { type: 'image_asset', labelKey: 'addNode.image', descKey: 'addNode.image.desc', color: 'var(--node-image)' },
      { type: 'video_asset', labelKey: 'addNode.videoAsset', descKey: 'addNode.videoAsset.desc', color: '#8b5cf6' },
    ],
  },
  {
    labelKey: 'addNode.group.generation',
    items: [
      { type: 'image_gen', labelKey: 'addNode.imageGen', descKey: 'addNode.imageGen.desc', color: 'var(--node-gen)' },
      { type: 'video_gen', labelKey: 'addNode.videoGen', descKey: 'addNode.videoGen.desc', color: '#8b5cf6' },
      { type: 'motion_transfer', labelKey: 'addNode.motionTransfer', descKey: 'addNode.motionTransfer.desc', color: '#f59e0b' },
    ],
  },
  {
    labelKey: 'addNode.group.aiAgent',
    items: [
      { type: 'llm', labelKey: 'addNode.llm', descKey: 'addNode.llm.desc', color: 'var(--node-llm)' },
    ],
  },
  {
    labelKey: 'addNode.group.organize',
    items: [
      { type: 'group', labelKey: 'addNode.groupNode', descKey: 'addNode.groupNode.desc', color: 'var(--node-group)' },
    ],
  },
]

export function LeftNodeLibrary() {
  const { addTextNode, addProductAnalysisNode, addImageAssetNode, addImageGenNode, addLLMNode, addGroupNode, addVideoAssetNode, addMotionTransferNode, addVideoGenNode } = useNodeActions()
  const reactFlow = useReactFlow()
  const { t } = useI18n()
  const [search, setSearch] = useState('')

  const addNode = (type: string) => {
    const center = reactFlow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    switch (type) {
      case 'text': addTextNode(center); break
      case 'product_analysis': addProductAnalysisNode(center); break
      case 'image_asset': addImageAssetNode(center); break
      case 'image_gen': addImageGenNode(center); break
      case 'llm': addLLMNode(center); break
      case 'group': addGroupNode(center); break
      case 'video_asset': addVideoAssetNode(center); break
      case 'video_gen': addVideoGenNode(center); break
      case 'motion_transfer': addMotionTransferNode(center); break
    }
  }

  const filtered = NODE_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      const q = search.toLowerCase()
      return t(i.labelKey).toLowerCase().includes(q) || t(i.descKey).toLowerCase().includes(q)
    }),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="left-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">CanvasForge</div>
        <div className="sidebar-subtitle">{t('addNode.canvasSubtitle')}</div>
      </div>

      <div className="sidebar-search">
        <input
          className="sidebar-search-input"
          placeholder={t('addNode.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.map((group) => (
        <div key={group.labelKey} className="sidebar-group">
          <div className="sidebar-group-title">{t(group.labelKey)}</div>
          {group.items.map((item) => (
            <div
              key={item.type}
              className="sidebar-node-item"
              title={t(item.descKey)}
              onClick={() => addNode(item.type)}
            >
              <div className="sidebar-node-color" style={{ background: item.color }} />
              <div className="sidebar-node-name">{t(item.labelKey)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

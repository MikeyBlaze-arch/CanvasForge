import React from 'react'
import { Type, ImageIcon, Wand2, Bot, Image, Layers, Move, Video, Film, ClipboardList } from 'lucide-react'
import { useI18n } from '../i18n/useI18n'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  text: <Type size={12} />,
  product_analysis: <ClipboardList size={12} />,
  image_asset: <ImageIcon size={12} />,
  image_gen: <Wand2 size={12} />,
  llm: <Bot size={12} />,
  result_image: <Image size={12} />,
  group: <Layers size={12} />,
  motion_transfer: <Move size={12} />,
  video_asset: <Video size={12} />,
  video_gen: <Film size={12} />,
  image_compare: <ImageIcon size={12} />,
}

const TYPE_LABEL_KEYS: Record<string, string> = {
  text: 'node.text',
  product_analysis: 'node.productAnalysis',
  image_asset: 'node.image',
  image_gen: 'node.imageGen',
  llm: 'node.llm',
  result_image: 'node.result',
  group: 'node.group',
  motion_transfer: 'motion.title',
  video_asset: 'video.title',
  video_gen: 'node.videoGen',
  image_compare: 'node.imageCompare',
}

type Props = {
  nodeType: string
  title: string
  selected?: boolean
  children: React.ReactNode
  status?: string
  actions?: React.ReactNode
  width?: number
}

export function NodeShell({ nodeType, title, selected, children, status, actions, width }: Props) {
  const { t } = useI18n()
  const defaultLabel = TYPE_LABEL_KEYS[nodeType] ? t(TYPE_LABEL_KEYS[nodeType]) : nodeType

  return (
    <div className="node-frame">
      <div className="node-floating-title">
        <span className="node-floating-title-icon">{TYPE_ICONS[nodeType] ?? null}</span>
        <span>{title || defaultLabel}</span>
        {status && (
          <span className="node-floating-title-status">
            <span className={`status-dot ${status}`} />
          </span>
        )}
      </div>
      <div
        className={`node-card ${selected ? 'selected' : ''}`}
        data-node-type={nodeType}
        style={width ? { width } : undefined}
      >
        <div className="node-card-body">{children}</div>
        {actions && <div className="node-actions">{actions}</div>}
      </div>
    </div>
  )
}

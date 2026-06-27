import React, { useCallback, useMemo, useState, useRef } from 'react'
import type { NodeProps, Node, Edge } from '@xyflow/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NodeShell } from '../../components/NodeShell'
import { PortLabel } from '../../components/PortLabel'
import { useNodeStore } from '../../store/nodeStore'
import { useEdgeStore } from '../../store/edgeStore'
import type { ImageCompareNodeData, CanvasNodeData, ImageAssetNodeData, ImageGenNodeData, ResultImageNodeData } from '../nodeTypes'
import { useI18n } from '../../i18n/useI18n'
import { resolveGroupImageOutputs, IMAGE_COLLECTION_OUTPUT_HANDLE } from '../groupImageOutputs'
import { getImageSourceSet } from '../imageSourceUtils'

type InputImage = {
  imageUrl: string
  thumbnailUrl: string
  sourceNodeId: string
  edgeIndex: number
  naturalWidth?: number
  naturalHeight?: number
}

function getImageUrl(data: CanvasNodeData): string | undefined {
  return getImageSourceSet(data).payloadUrl
}

function getThumbnailUrl(data: CanvasNodeData): string | undefined {
  return getImageSourceSet(data).thumbnailUrl
}

function resolveInputImages(
  nodeId: string,
  nodes: Node<CanvasNodeData>[],
  edges: Edge[]
): InputImage[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const results: InputImage[] = []

  const inputEdges = edges
    .map((edge, edgeIndex) => ({ edge, edgeIndex }))
    .filter(({ edge }) => edge.target === nodeId)
    .filter(({ edge }) => edge.targetHandle === 'compare_image' || edge.targetHandle === 'main_input')
    .sort((a, b) => a.edgeIndex - b.edgeIndex)

  for (const { edge, edgeIndex } of inputEdges) {
    const sourceNode = nodeById.get(edge.source)
    if (!sourceNode) continue

    const sourceData = sourceNode.data as CanvasNodeData

    if (
      sourceData.nodeType === 'image_asset' ||
      sourceData.nodeType === 'result_image' ||
      sourceData.nodeType === 'image_gen'
    ) {
      const imageUrl = getImageUrl(sourceData)
      if (imageUrl) {
        const thumbnailUrl = getThumbnailUrl(sourceData) ?? imageUrl
        let naturalWidth: number | undefined
        let naturalHeight: number | undefined

        if (sourceData.nodeType === 'image_asset') {
          const d = sourceData as ImageAssetNodeData
          naturalWidth = d.naturalWidth
          naturalHeight = d.naturalHeight
        } else if (sourceData.nodeType === 'result_image') {
          const d = sourceData as ResultImageNodeData
          naturalWidth = d.naturalWidth
          naturalHeight = d.naturalHeight
        } else if (sourceData.nodeType === 'image_gen') {
          const d = sourceData as ImageGenNodeData
          naturalWidth = d.lastOutputWidth
          naturalHeight = d.lastOutputHeight
        }

        results.push({
          imageUrl,
          thumbnailUrl,
          sourceNodeId: sourceNode.id,
          edgeIndex,
          naturalWidth,
          naturalHeight,
        })
      }
    } else if (sourceData.nodeType === 'group' && edge.sourceHandle === IMAGE_COLLECTION_OUTPUT_HANDLE) {
      const groupImages = resolveGroupImageOutputs(sourceNode.id, nodes, edges)
      for (const image of groupImages) {
        results.push({
          imageUrl: image.displayUrl ?? image.payloadUrl ?? image.imageUrl,
          thumbnailUrl: image.thumbnailUrl ?? image.imageUrl,
          sourceNodeId: image.sourceNodeId,
          edgeIndex,
          naturalWidth: image.width,
          naturalHeight: image.height,
        })
      }
    }
  }

  return results
}

export const ImageCompareNodeComponent = React.memo(function ImageCompareNodeComponent({
  id,
  data,
  selected,
}: NodeProps) {
  const d = data as unknown as ImageCompareNodeData
  const updateNodeData = useNodeStore((s) => s.updateNodeData)
  const nodes = useNodeStore((s) => s.nodes)
  const edges = useEdgeStore((s) => s.edges)
  const { t } = useI18n()

  const [localSliderPercent, setLocalSliderPercent] = useState<number | null>(null)
  const isDraggingRef = useRef(false)
  const stageRef = useRef<HTMLDivElement>(null)

  const inputImages = useMemo(() => {
    return resolveInputImages(id, nodes, edges)
  }, [id, nodes, edges])

  const sliderPercent = localSliderPercent ?? d.sliderPercent ?? 50

  const leftIndex = useMemo(() => {
    if (inputImages.length < 3) return 0
    if (!d.activeLeftSourceId) return 0
    const idx = inputImages.findIndex((img) => img.sourceNodeId === d.activeLeftSourceId)
    return idx >= 0 ? idx : 0
  }, [inputImages, d.activeLeftSourceId])

  const rightIndex = useMemo(() => {
    if (inputImages.length < 3) return 1
    if (!d.activeRightSourceId) return 1
    const idx = inputImages.findIndex((img) => img.sourceNodeId === d.activeRightSourceId)
    return idx >= 0 ? idx : 1
  }, [inputImages, d.activeRightSourceId])

  const leftImage = inputImages[leftIndex]
  const rightImage = inputImages[rightIndex]

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    isDraggingRef.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !stageRef.current) return
      const rect = stageRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percent = Math.max(5, Math.min(95, (x / rect.width) * 100))
      setLocalSliderPercent(percent)
    },
    []
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

      if (localSliderPercent !== null) {
        updateNodeData(id, {
          sliderPercent: localSliderPercent,
          updatedAt: Date.now(),
        } as Partial<ImageCompareNodeData>)
        setLocalSliderPercent(null)
      }
    },
    [id, localSliderPercent, updateNodeData]
  )

  const handleThumbClick = useCallback(
    (index: number, isAltClick: boolean) => {
      if (inputImages.length < 3) return

      const sourceNodeId = inputImages[index].sourceNodeId

      if (isAltClick) {
        updateNodeData(id, {
          activeLeftSourceId: sourceNodeId,
          updatedAt: Date.now(),
        } as Partial<ImageCompareNodeData>)
      } else {
        updateNodeData(id, {
          activeRightSourceId: sourceNodeId,
          updatedAt: Date.now(),
        } as Partial<ImageCompareNodeData>)
      }
    },
    [id, inputImages, updateNodeData]
  )

  const renderContent = () => {
    if (inputImages.length === 0) {
      return (
        <div className="image-compare-empty">
          {t('imageCompare.empty')}
        </div>
      )
    }

    if (inputImages.length === 1) {
      return (
        <>
          <div className="image-compare-stage" ref={stageRef}>
            <img
              src={inputImages[0].imageUrl}
              alt="single"
              className="image-compare-img"
            />
          </div>
          <div className="image-compare-footer">
            <span>1 / 1</span>
          </div>
        </>
      )
    }

    return (
      <>
        <div
          className="image-compare-stage"
          ref={stageRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {rightImage && (
            <img
              src={rightImage.imageUrl}
              alt="right"
              className="image-compare-img"
            />
          )}
          {leftImage && (
            <img
              src={leftImage.imageUrl}
              alt="left"
              className="image-compare-img top"
              style={{
                clipPath: `inset(0 ${100 - sliderPercent}% 0 0)`,
              }}
            />
          )}
          <div
            className="image-compare-divider"
            style={{ left: `${sliderPercent}%` }}
          />
          <div
            className="image-compare-handle image-compare-handle-arrow"
            style={{ left: `${sliderPercent}%` }}
            aria-label="拖动对比图片"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(sliderPercent)}
          >
            <ChevronLeft size={15} strokeWidth={2.2} />
            <ChevronRight size={15} strokeWidth={2.2} />
          </div>
        </div>
        {inputImages.length >= 3 && (
          <div className="image-compare-footer">
            <div className="image-compare-thumbs">
              {inputImages.map((img, index) => {
                const isLeft = index === leftIndex
                const isRight = index === rightIndex
                return (
                  <div
                    key={index}
                    className="image-compare-thumb"
                    onClick={(e) => handleThumbClick(index, e.altKey)}
                    title={t('imageCompare.tip')}
                  >
                    <img src={img.thumbnailUrl} alt={`thumb-${index}`} />
                    {isLeft && (
                      <div className="image-compare-thumb-badge">A</div>
                    )}
                    {isRight && (
                      <div className="image-compare-thumb-badge" style={{ left: 'auto', right: '3px' }}>
                        B
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {inputImages.length === 2 && (
          <div className="image-compare-footer">
            <span>{inputImages.length} {t('common.images')}</span>
          </div>
        )}
      </>
    )
  }

  return (
    <NodeShell
      nodeType="image_compare"
      title={d.title}
      selected={!!selected}
      width={560}
    >
      {renderContent()}

      <div className="node-ports">
        <div className="node-port-group">
          <PortLabel type="target" id="main_input" mode="main" />
          <PortLabel type="target" id="compare_image" mode="semantic" />
        </div>
      </div>
    </NodeShell>
  )
})

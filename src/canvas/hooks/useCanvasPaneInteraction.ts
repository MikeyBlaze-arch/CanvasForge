import { useCallback, useRef, useState } from 'react'
import type { ReactFlowInstance } from '@xyflow/react'
import { useCanvasStore } from '../../store/canvasStore'

export function useCanvasPaneInteraction(reactFlow: ReactFlowInstance) {
  const rightDragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const leftDragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [interactionClass, setInteractionClass] = useState('')

  const onPaneMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button === 0) {
      leftDragRef.current = { x: event.clientX, y: event.clientY, moved: false }
    }
    if (event.button === 2) {
      rightDragRef.current = { x: event.clientX, y: event.clientY, moved: false }
    }
  }, [])

  const onPaneMouseMove = useCallback((event: React.MouseEvent) => {
    useCanvasStore.getState().setLastMouseFlowPosition(
      reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    )

    const leftDrag = leftDragRef.current
    if (leftDrag && Math.hypot(event.clientX - leftDrag.x, event.clientY - leftDrag.y) > 6) {
      leftDrag.moved = true
      if (interactionClass !== 'canvas-dragging') {
        setInteractionClass('canvas-dragging')
      }
    }

    const rightDrag = rightDragRef.current
    if (rightDrag && Math.hypot(event.clientX - rightDrag.x, event.clientY - rightDrag.y) > 6) {
      rightDrag.moved = true
      if (interactionClass !== 'canvas-dragging') {
        setInteractionClass('canvas-dragging')
      }
    }
  }, [interactionClass, reactFlow])

  const onPaneMouseUp = useCallback(() => {
    setTimeout(() => {
      leftDragRef.current = null
      rightDragRef.current = null
    }, 0)
    if (interactionClass !== '') {
      setInteractionClass('')
    }
  }, [interactionClass])

  return {
    interactionClass,
    setInteractionClass,
    onPaneMouseDown,
    onPaneMouseMove,
    onPaneMouseUp,
    leftDragRef,
    rightDragRef,
  }
}

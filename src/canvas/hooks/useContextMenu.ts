import { useCallback } from 'react'
import { useUIStore } from '../../store/uiStore'

export function useContextMenu() {
  const showContextMenu = useUIStore((s) => s.showContextMenu)
  const hideContextMenu = useUIStore((s) => s.hideContextMenu)

  const onCanvasContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      showContextMenu(e.clientX, e.clientY)
    },
    [showContextMenu]
  )

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, nodeId: string, nodeType: string) => {
      e.preventDefault()
      e.stopPropagation()
      showContextMenu(e.clientX, e.clientY, nodeId, nodeType)
    },
    [showContextMenu]
  )

  return { onCanvasContextMenu, onNodeContextMenu, hideContextMenu }
}

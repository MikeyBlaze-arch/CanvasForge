import { useEffect, useCallback, useRef } from 'react'
import { useNodeStore } from '../../store/nodeStore'
import { useEdgeStore } from '../../store/edgeStore'
import { useNodeActions } from './useNodeActions'
import { useProjectStore } from '../../store/projectStore'
import { useUndoRedoStore } from '../../store/undoRedoStore'
import { useUIStore } from '../../store/uiStore'
import { useCanvasStore } from '../../store/canvasStore'
import { saveProject } from '../../persistence/projectSerializer'
import { createCanvasEdgeId, normalizeCanvasEdge } from '../../store/edgeStore'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]'))
}

export function useCanvasShortcuts() {
  const pasteSequenceRef = useRef(0)
  const nodes = useNodeStore((s) => s.nodes)
  const setNodes = useNodeStore((s) => s.setNodes)
  const cloneNode = useNodeStore((s) => s.cloneNode)
  const copyBuffer = useNodeStore((s) => s.copyBuffer)
  const setCopyBuffer = useNodeStore((s) => s.setCopyBuffer)
  const edges = useEdgeStore((s) => s.edges)
  const setEdges = useEdgeStore((s) => s.setEdges)
  const markDirty = useProjectStore((s) => s.markDirty)
  const { deleteNode } = useNodeActions()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const inInput = isTypingTarget(e.target)

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (inInput) return
        e.preventDefault()
        useUndoRedoStore.getState().undo()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        if (inInput) return
        e.preventDefault()
        useUndoRedoStore.getState().redo()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (inInput) return
        e.preventDefault()
        useUndoRedoStore.getState().redo()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveProject()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (inInput) return
        const selectedNodes = nodes.filter((n) => n.selected)
        if (selectedNodes.length > 0) {
          e.preventDefault()
          const selectedIds = new Set(selectedNodes.map((node) => node.id))
          const selectedEdges = edges.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
          setCopyBuffer({
            nodes: selectedNodes.map((node) => ({
              ...node,
              data: { ...node.data },
              selected: false,
            })),
            edges: selectedEdges.map((edge) => ({ ...edge, selected: false })),
          })
          pasteSequenceRef.current = 0
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (inInput) return
        if (copyBuffer && copyBuffer.nodes.length > 0) {
          e.preventDefault()
          useUndoRedoStore.getState().capture('Paste nodes')

          const { viewport, lastMouseFlowPosition } = useCanvasStore.getState()
          const viewportCenter = {
            x: (window.innerWidth / 2 - viewport.x) / viewport.zoom,
            y: (window.innerHeight / 2 - viewport.y) / viewport.zoom,
          }
          const anchor = lastMouseFlowPosition ?? viewportCenter
          const minX = Math.min(...copyBuffer.nodes.map((node) => node.position.x))
          const minY = Math.min(...copyBuffer.nodes.map((node) => node.position.y))
          const offset = pasteSequenceRef.current * 28
          const idMap = new Map<string, string>()

          const pastedNodes = copyBuffer.nodes.map((node) => {
            const newId = 'n_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
            idMap.set(node.id, newId)
            return {
              ...node,
              id: newId,
              position: {
                x: anchor.x + (node.position.x - minX) + offset,
                y: anchor.y + (node.position.y - minY) + offset,
              },
              data: { ...node.data },
              selected: true,
            }
          })

          const pastedEdges = copyBuffer.edges
            .map((edge) => {
              const source = idMap.get(edge.source)
              const target = idMap.get(edge.target)
              if (!source || !target) return null
              return normalizeCanvasEdge({
                ...edge,
                id: createCanvasEdgeId({ ...edge, source, target }),
                source,
                target,
                selected: false,
              })
            })
            .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge))

          setNodes([
            ...nodes.map((node) => ({ ...node, selected: false })),
            ...pastedNodes,
          ])
          setEdges([
            ...edges.map((edge) => ({ ...edge, selected: false })),
            ...pastedEdges,
          ])
          pasteSequenceRef.current += 1
          markDirty()
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        const selected = nodes.find((n) => n.selected)
        if (selected) {
          useUndoRedoStore.getState().capture('Clone node')
          cloneNode(selected.id)
          markDirty()
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (inInput) return

        const selectedNodes = nodes.filter((n) => n.selected)
        const selectedEdges = edges.filter((edge) => edge.selected)
        if (selectedNodes.length > 0) {
          useUndoRedoStore.getState().capture('Delete nodes')
          const ids = new Set(selectedNodes.map((n) => n.id))
          setNodes(nodes.filter((n) => !ids.has(n.id)))
          setEdges(edges.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target)))
          markDirty()
        } else if (selectedEdges.length > 0) {
          useUndoRedoStore.getState().capture('Delete edges')
          setEdges(edges.filter((edge) => !edge.selected))
          markDirty()
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        if (inInput) return
        e.preventDefault()
        const selectedNodes = nodes.filter((n) => n.selected && (n.data as { nodeType?: string }).nodeType !== 'group')
        if (selectedNodes.length >= 2) {
          let minX = Infinity
          let minY = Infinity
          let maxX = -Infinity
          let maxY = -Infinity
          const NODE_SIZE_FALLBACK: Record<string, { width: number; height: number }> = {
            text: { width: 210, height: 184 },
            product_analysis: { width: 330, height: 620 },
            image_asset: { width: 210, height: 178 },
            image_gen: { width: 260, height: 262 },
            llm: { width: 280, height: 292 },
            result_image: { width: 220, height: 214 },
            video_asset: { width: 320, height: 200 },
            motion_transfer: { width: 300, height: 260 },
            video_gen: { width: 290, height: 300 },
          }
          for (const node of selectedNodes) {
            const nodeType = (node.data as { nodeType?: string }).nodeType ?? ''
            const measured = (node as typeof node & { measured?: { width?: number; height?: number } }).measured
            const fallback = NODE_SIZE_FALLBACK[nodeType] ?? { width: 220, height: 180 }
            const w = measured?.width ?? node.width ?? fallback.width
            const h = measured?.height ?? node.height ?? fallback.height
            minX = Math.min(minX, node.position.x)
            minY = Math.min(minY, node.position.y)
            maxX = Math.max(maxX, node.position.x + w)
            maxY = Math.max(maxY, node.position.y + h)
          }
          useUIStore.getState().openGroupDialog({
            open: true,
            mode: 'selection',
            nodeIds: selectedNodes.map((n) => n.id),
            bounds: { minX, minY, maxX, maxY },
          })
        }
        return
      }

      if (e.key === 'Escape') {
        setNodes(nodes.map((n) => ({ ...n, selected: false })))
        setEdges(edges.map((edge) => ({ ...edge, selected: false })))
      }
    },
    [nodes, setNodes, edges, setEdges, copyBuffer, setCopyBuffer, cloneNode, markDirty]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

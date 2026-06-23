import { memo } from 'react'
import { useViewport } from '@xyflow/react'

/**
 * Responsive starry-dot canvas background.
 *
 * Uses CSS background-image with radial-gradient so dot *size* stays constant
 * while *spacing* scales with zoom — matching FigJam / Freeform behaviour.
 *
 * Placed inside <ReactFlow> so `useViewport()` gives live x / y / zoom.
 */
export const StarryCanvasBackground = memo(function StarryCanvasBackground() {
  const { x, y, zoom } = useViewport()

  // ── constants ──────────────────────────────────────────────
  const BASE_SPACING = 28 // px at zoom === 1
  const DOT_SIZE = 1 // px – never multiplied by zoom

  // ── derived ────────────────────────────────────────────────
  const spacing = Math.max(6, BASE_SPACING * zoom)
  const px = ((x % spacing) + spacing) % spacing
  const py = ((y % spacing) + spacing) % spacing

  // Secondary (dimmer) dots at 2× spacing for a star-field depth effect
  const spacing2 = Math.max(12, BASE_SPACING * 2 * zoom)
  const px2 = ((x % spacing2) + spacing2) % spacing2
  const py2 = ((y % spacing2) + spacing2) % spacing2

  return (
    <div
      className="starry-canvas-bg"
      style={{
        '--dot-spacing': `${spacing}px`,
        '--dot-x': `${px}px`,
        '--dot-y': `${py}px`,
        '--dot-size': `${DOT_SIZE}px`,
        '--dot2-spacing': `${spacing2}px`,
        '--dot2-x': `${px2}px`,
        '--dot2-y': `${py2}px`,
      } as React.CSSProperties}
    />
  )
})

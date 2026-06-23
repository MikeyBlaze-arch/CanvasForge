import React from 'react'
import { MiniMap } from '@xyflow/react'

export function CanvasMiniMap() {
  return (
    <MiniMap
      nodeStrokeWidth={3}
      nodeColor={() => 'rgba(255,255,255,0.15)'}
      maskColor="rgba(9, 10, 12, 0.85)"
      zoomable
      pannable
      style={{ bottom: 12, right: 12 }}
    />
  )
}

import { useEffect, useState } from 'react'

export type ViewportSize = {
  width: number
  height: number
}

function readViewportSize(): ViewportSize {
  if (typeof window === 'undefined') return { width: 1024, height: 768 }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => readViewportSize())

  useEffect(() => {
    if (typeof window === 'undefined') return

    let frame = 0
    const handleResize = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        setSize(readViewportSize())
      })
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return size
}

// Video dimension mapping: aspect ratio + size preset -> pixel width/height.
// Used both for the API payload (width/height) and for node display sizing.

import type { VideoAspectRatio, VideoSizePreset } from './videoModelRegistry'

const DIMENSION_TABLE: Record<VideoSizePreset, Record<VideoAspectRatio, { width: number; height: number }>> = {
  '720p': {
    '16:9': { width: 1280, height: 720 },
    '9:16': { width: 720, height: 1280 },
    '1:1': { width: 720, height: 720 },
  },
  '1080p': {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
  },
}

export function resolveVideoDimensions(
  aspectRatio: string,
  size: '720p' | '1080p',
): { width: number; height: number } {
  const sizeKey: VideoSizePreset = size === '1080p' ? '1080p' : '720p'
  const ratioKey = (aspectRatio === '9:16' || aspectRatio === '1:1' ? aspectRatio : '16:9') as VideoAspectRatio
  return DIMENSION_TABLE[sizeKey][ratioKey] ?? DIMENSION_TABLE['720p']['16:9']
}

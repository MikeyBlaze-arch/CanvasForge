// Builds the New API `/v1/video/generations` request payload.
// model is ALWAYS the backendModel verbatim — size/duration/aspect are sent as
// dedicated fields, never concatenated onto the model name.

import type { VideoModelDefinition } from './videoModelRegistry'
import { resolveVideoDimensions } from './videoSizeRegistry'

export type BuildVideoPayloadInput = {
  model: VideoModelDefinition
  prompt: string
  image?: string
  aspectRatio: string
  size: '720p' | '1080p'
  duration: number
  fps?: number
  seed?: number
}

export function buildVideoGenerationPayload(input: BuildVideoPayloadInput): Record<string, unknown> {
  const { model, prompt, image, aspectRatio, size, duration, fps, seed } = input
  const { width, height } = resolveVideoDimensions(aspectRatio, size)

  const payload: Record<string, unknown> = {
    model: model.backendModel,
    prompt,
    duration,
    width,
    height,
    fps: fps ?? 24,
    n: 1,
    metadata: {
      aspect_ratio: aspectRatio,
      size,
    },
  }

  if (image) payload.image = image
  if (seed != null && Number.isFinite(seed)) payload.seed = seed

  console.info('[video-generation-payload]', {
    modelId: model.id,
    requestModel: payload.model,
    aspectRatio,
    size,
    duration,
    width,
    height,
    hasImage: Boolean(image),
    payloadKeys: Object.keys(payload).sort(),
  })

  return payload
}

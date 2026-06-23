import type { ImageModelCategory, ImageModelSeries } from './imageModelRegistry'

export type ResolutionKey = '1K' | '2K' | '4K'
export type SizePreset = { width: number; height: number }

export const SUPPORTED_ASPECT_RATIOS = [
  'auto',
  '1:1',
  '3:2',
  '2:3',
  '4:3',
  '3:4',
  '4:5',
  '5:4',
  '16:9',
  '9:16',
  '21:9',
  '9:21',
] as const

export const SUPPORTED_RESOLUTIONS = ['1K', '2K', '4K'] as const

export const GPT_IMAGE_2_FIXED_SIZE_MAP = {
  '1K': {
    '1:1': '1024x1024',
    '16:9': '1280x720',
    '9:16': '720x1280',
    '4:3': '1152x864',
    '3:4': '864x1152',
    '3:2': '1536x1024',
    '2:3': '1024x1536',
    '5:4': '1120x896',
    '4:5': '896x1120',
    '21:9': '1456x624',
    '9:21': '624x1456',
  },
  '2K': {
    '1:1': '2048x2048',
    '16:9': '2048x1152',
    '9:16': '1152x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '3:2': '2048x1360',
    '2:3': '1360x2048',
    '5:4': '2240x1792',
    '4:5': '1792x2240',
    '21:9': '2912x1248',
    '9:21': '1248x2912',
  },
  '4K': {
    '1:1': '2880x2880',
    '16:9': '3840x2160',
    '9:16': '2160x3840',
    '4:3': '3264x2448',
    '3:4': '2448x3264',
    '3:2': '3504x2336',
    '2:3': '2336x3504',
    '5:4': '3200x2560',
    '4:5': '2560x3200',
    '21:9': '3840x1648',
    '9:21': '1648x3840',
  },
} as const

export const GPT_IMAGE_SIZE_MAP = Object.fromEntries(
  Object.keys(GPT_IMAGE_2_FIXED_SIZE_MAP['2K']).map((ratio) => [
    ratio,
    {
      '1K': GPT_IMAGE_2_FIXED_SIZE_MAP['1K'][ratio as keyof typeof GPT_IMAGE_2_FIXED_SIZE_MAP['1K']],
      '2K': GPT_IMAGE_2_FIXED_SIZE_MAP['2K'][ratio as keyof typeof GPT_IMAGE_2_FIXED_SIZE_MAP['2K']],
      '4K': GPT_IMAGE_2_FIXED_SIZE_MAP['4K'][ratio as keyof typeof GPT_IMAGE_2_FIXED_SIZE_MAP['4K']],
    },
  ]),
) as Record<string, Record<ResolutionKey, string>>

export const NANO_BANANA_SUPPORTED_RATIOS: string[] = SUPPORTED_ASPECT_RATIOS.filter((ratio) => ratio !== 'auto')

export function normalizeAspectRatioOptionValue(ratio?: unknown) {
  const raw = String(ratio || '').trim()
  if (!raw || raw.toLowerCase() === 'auto') return 'auto'

  const value = raw
    .replace(/\u00d7/g, 'x')
    .replace(/\u8103/g, 'x')
    .replace(/\u9474/g, 'x')
    .trim()

  const knownRatio = SUPPORTED_ASPECT_RATIOS.find((option) => option !== 'auto' && value.includes(option))
  if (knownRatio) return knownRatio

  const pixelMatch = /^(\d+)\s*[x\u00d7\u8103\u9474]\s*(\d+)$/i.exec(value)
  if (pixelMatch) {
    const width = Number(pixelMatch[1])
    const height = Number(pixelMatch[2])
    const match = Object.keys(GPT_IMAGE_SIZE_MAP).find((aspectRatio) =>
      Object.values(GPT_IMAGE_SIZE_MAP[aspectRatio]).includes(`${width}x${height}`),
    )
    if (match) return match
  }

  return 'auto'
}

export function formatAspectRatioLabel(ratio?: unknown) {
  const normalized = normalizeAspectRatioOptionValue(ratio)
  return normalized === 'auto' ? 'Auto' : normalized
}

export function normalizeAspectRatio(ratio?: string) {
  const value = normalizeAspectRatioOptionValue(ratio)
  if (value === 'auto') return '1:1'
  return NANO_BANANA_SUPPORTED_RATIOS.includes(value) || GPT_IMAGE_SIZE_MAP[value] ? value : '1:1'
}

export function normalizeResolution(resolution?: unknown): ResolutionKey {
  const value = String(resolution || '2K').trim().toUpperCase()
  if (value === '1K' || value === '2K' || value === '4K') return value

  const pixelMatch = /^(\d+)\s*[x\u00d7\u8103\u9474]\s*(\d+)$/i.exec(value)
  if (pixelMatch) {
    const width = Number(pixelMatch[1])
    const height = Number(pixelMatch[2])
    const maxEdge = Math.max(width, height)
    if (maxEdge >= 3600) return '4K'
    if (maxEdge >= 1400) return '2K'
    return '1K'
  }

  return '2K'
}

export function resolveGptImage2FixedSize(aspectRatio?: string, resolution?: unknown) {
  const ratio = normalizeAspectRatio(aspectRatio)
  const quality = normalizeResolution(resolution)
  return GPT_IMAGE_2_FIXED_SIZE_MAP[quality][ratio as keyof typeof GPT_IMAGE_2_FIXED_SIZE_MAP['2K']] || GPT_IMAGE_2_FIXED_SIZE_MAP[quality]['1:1']
}

export function parseAspectRatioValue(aspectRatio: string): number | null {
  const normalized = normalizeAspectRatio(aspectRatio)
  const match = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(normalized)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!width || !height) return null
  return width / height
}

function findClosestAspectRatio(ratioNumber: number, ratios: string[]): string {
  if (!ratioNumber || !Number.isFinite(ratioNumber)) return '1:1'
  let bestKey = '1:1'
  let bestDiff = Math.abs((parseAspectRatioValue('1:1') ?? 1) - ratioNumber)
  for (const key of ratios) {
    const parsed = parseAspectRatioValue(key)
    if (parsed === null) continue
    const diff = Math.abs(parsed - ratioNumber)
    if (diff < bestDiff) {
      bestDiff = diff
      bestKey = key
    }
  }
  return bestKey
}

export function findClosestGptImageAspectRatio(ratioNumber: number): string {
  return findClosestAspectRatio(ratioNumber, Object.keys(GPT_IMAGE_SIZE_MAP))
}

export function findClosestNanoBananaAspectRatio(ratioNumber: number): string {
  return findClosestAspectRatio(ratioNumber, NANO_BANANA_SUPPORTED_RATIOS)
}

export function resolveGptImageRatio(aspectRatio: string): string {
  return normalizeAspectRatio(aspectRatio)
}

export function resolveNanoBananaRatio(aspectRatio: string): string {
  return normalizeAspectRatio(aspectRatio)
}

export function resolveGptImageSize(aspectRatio: string, resolution: ResolutionKey): string {
  return resolveGptImage2FixedSize(aspectRatio, resolution)
}

export function parseSizeToDimensions(size: string): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/.exec(String(size || ''))
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null
}

export function getExpectedImageDimensions(_modelId: string, aspectRatio: string, resolution: ResolutionKey, sizeMode?: string): { width: number; height: number } | null {
  if (sizeMode === 'aspect_ratio_image_size') return null
  return parseSizeToDimensions(resolveGptImage2FixedSize(aspectRatio, resolution))
}

export function getNanoBananaResolution(resolution: ResolutionKey): ResolutionKey {
  return normalizeResolution(resolution)
}

export function getAspectRatiosForSeries(_series: ImageModelSeries, _modelCategory?: ImageModelCategory): string[] {
  return [...SUPPORTED_ASPECT_RATIOS]
}

export function getResolutionsForAspectRatio(_series: ImageModelSeries, _aspectRatio: string, _modelCategory?: ImageModelCategory): ResolutionKey[] {
  return [...SUPPORTED_RESOLUTIONS]
}

function toPresetRegistry() {
  return Object.fromEntries(
    Object.entries(GPT_IMAGE_SIZE_MAP).map(([ratio, resMap]) => [
      ratio,
      Object.fromEntries(
        Object.entries(resMap).map(([res, sizeStr]) => {
          const [width, height] = sizeStr.split('x').map(Number)
          return [res, { width, height }]
        }),
      ),
    ]),
  ) as Record<string, Partial<Record<ResolutionKey, SizePreset>>>
}

export const IMAGE_SIZE_REGISTRY: Record<ImageModelSeries, Record<string, Partial<Record<ResolutionKey, SizePreset>>>> = {
  G: toPresetRegistry(),
  R: toPresetRegistry(),
  C: toPresetRegistry(),
}

export function getSizePreset(series: ImageModelSeries, aspectRatio: string, resolution: ResolutionKey): SizePreset {
  const sizeStr = resolveGptImage2FixedSize(aspectRatio, resolution)
  const [width, height] = sizeStr.split('x').map(Number)
  return IMAGE_SIZE_REGISTRY[series]?.[normalizeAspectRatio(aspectRatio)]?.[normalizeResolution(resolution)] ?? { width, height }
}

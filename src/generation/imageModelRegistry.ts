// Image model registry: single source of truth for CanvasForge image generation.

import { normalizeAspectRatio, normalizeResolution, type ResolutionKey } from './sizeRegistry'

export type ImageModelSeries = 'G' | 'R' | 'C'
export type ImageModelCategory = 'smart' | 'all_in_one'
export type ImageEngineType = 'gpt-image-2' | 'nano-banana'
export type ImageSizeMode = 'fixed_size' | 'aspect_ratio_image_size'

export interface ImageModelDefinition {
  id: string
  label: string
  series: ImageModelSeries
  group: '智能出图模型' | '全能出图模型'
  category: ImageModelCategory
  backendModel: string
  engineType: ImageEngineType
  sizeMode: ImageSizeMode
  tag?: string
  supportsTextToImage: boolean
  supportsImageInput: boolean
  supportsMask: boolean
  supportsInpaint: boolean
  supportsOutpaint: boolean
  supports1K: boolean
  supports2K: boolean
  supports4K: boolean
  defaultAspectRatio: string
  defaultResolution: ResolutionKey
}

export type ImageModelConfig = ImageModelDefinition

const smartGroup = '智能出图模型' as const
const allInOneGroup = '全能出图模型' as const

export const IMAGE_MODEL_REGISTRY: ImageModelDefinition[] = [
  {
    id: 'g-gpt-image-2',
    label: 'G 智能出图 V2',
    series: 'G',
    group: smartGroup,
    category: 'smart',
    backendModel: 'A-gpt-image-2',
    engineType: 'gpt-image-2',
    sizeMode: 'fixed_size',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: false,
    supportsInpaint: false,
    supportsOutpaint: false,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'g-gpt-image-2-vip',
    label: 'G 智能出图 V2 VIP',
    series: 'G',
    group: smartGroup,
    category: 'smart',
    backendModel: 'A-gpt-image-2-vip',
    engineType: 'gpt-image-2',
    sizeMode: 'fixed_size',
    tag: 'VIP',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: false,
    supportsInpaint: false,
    supportsOutpaint: false,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'g-nano-banana',
    label: 'G 全能出图',
    series: 'G',
    group: allInOneGroup,
    category: 'all_in_one',
    backendModel: 'G-nano-banana',
    engineType: 'nano-banana',
    sizeMode: 'aspect_ratio_image_size',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: false,
    supportsInpaint: false,
    supportsOutpaint: false,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'g-nano-banana-2',
    label: 'G 全能出图 V2',
    series: 'G',
    group: allInOneGroup,
    category: 'all_in_one',
    backendModel: 'G-nano-banana-2',
    engineType: 'nano-banana',
    sizeMode: 'aspect_ratio_image_size',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: false,
    supportsInpaint: false,
    supportsOutpaint: false,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'g-nano-banana-2-cl',
    label: 'G 全能出图 V2 CL',
    series: 'G',
    group: allInOneGroup,
    category: 'all_in_one',
    backendModel: 'G-nano-banana-2-cl',
    engineType: 'nano-banana',
    sizeMode: 'aspect_ratio_image_size',
    tag: 'CL',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: false,
    supportsInpaint: false,
    supportsOutpaint: false,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'g-nano-banana-pro',
    label: 'G 全能出图 Pro',
    series: 'G',
    group: allInOneGroup,
    category: 'all_in_one',
    backendModel: 'G-nano-banana-pro',
    engineType: 'nano-banana',
    sizeMode: 'aspect_ratio_image_size',
    tag: 'PRO',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: false,
    supportsInpaint: false,
    supportsOutpaint: false,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'g-nano-banana-pro-cl',
    label: 'G 全能出图 Pro CL',
    series: 'G',
    group: allInOneGroup,
    category: 'all_in_one',
    backendModel: 'G-nano-banana-pro-cl',
    engineType: 'nano-banana',
    sizeMode: 'aspect_ratio_image_size',
    tag: 'PRO CL',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: false,
    supportsInpaint: false,
    supportsOutpaint: false,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'g-nano-banana-pro-vt',
    label: 'G 全能出图 Pro VT',
    series: 'G',
    group: allInOneGroup,
    category: 'all_in_one',
    backendModel: 'G-nano-banana-pro-vt',
    engineType: 'nano-banana',
    sizeMode: 'aspect_ratio_image_size',
    tag: 'VT',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: false,
    supportsInpaint: false,
    supportsOutpaint: false,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'r-gpt-image-2',
    label: 'R 智能出图 V2',
    series: 'R',
    group: smartGroup,
    category: 'smart',
    backendModel: 'R-gpt-image-2',
    engineType: 'gpt-image-2',
    sizeMode: 'fixed_size',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: true,
    supportsInpaint: true,
    supportsOutpaint: true,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'r-gpt-image-2-vip',
    label: 'R 智能出图 V2 VIP',
    series: 'R',
    group: smartGroup,
    category: 'smart',
    backendModel: 'R-gpt-image-2-vip',
    engineType: 'gpt-image-2',
    sizeMode: 'fixed_size',
    tag: 'VIP',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: true,
    supportsInpaint: true,
    supportsOutpaint: true,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'r-nano-banana-pro',
    label: 'R 全能出图 Pro',
    series: 'R',
    group: allInOneGroup,
    category: 'all_in_one',
    backendModel: 'R-nano-banana-pro',
    engineType: 'nano-banana',
    sizeMode: 'aspect_ratio_image_size',
    tag: 'PRO',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: false,
    supportsInpaint: false,
    supportsOutpaint: false,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'r-nano-banana-2',
    label: 'R 全能出图 V2',
    series: 'R',
    group: allInOneGroup,
    category: 'all_in_one',
    backendModel: 'R-nano-banana-2',
    engineType: 'nano-banana',
    sizeMode: 'aspect_ratio_image_size',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: false,
    supportsInpaint: false,
    supportsOutpaint: false,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'c-gpt-image-2',
    label: 'C 智能出图 V2',
    series: 'C',
    group: smartGroup,
    category: 'smart',
    backendModel: 'C-gpt-image-2',
    engineType: 'gpt-image-2',
    sizeMode: 'fixed_size',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: true,
    supportsInpaint: true,
    supportsOutpaint: true,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'c-gpt-image-2-all',
    label: 'C 智能出图 V2 all',
    series: 'C',
    group: smartGroup,
    category: 'smart',
    backendModel: 'C-gpt-image-2-all',
    engineType: 'gpt-image-2',
    sizeMode: 'fixed_size',
    tag: 'ALL',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: true,
    supportsInpaint: true,
    supportsOutpaint: true,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'c-gpt-image-2-vip',
    label: 'C 智能出图 V2 VIP',
    series: 'C',
    group: smartGroup,
    category: 'smart',
    backendModel: 'C-gpt-image-2-vip',
    engineType: 'gpt-image-2',
    sizeMode: 'fixed_size',
    tag: 'VIP',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: true,
    supportsInpaint: true,
    supportsOutpaint: true,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'c-nano-banana-2',
    label: 'C 全能出图 V2',
    series: 'C',
    group: allInOneGroup,
    category: 'all_in_one',
    backendModel: 'C-nano-banana-2',
    engineType: 'nano-banana',
    sizeMode: 'aspect_ratio_image_size',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: false,
    supportsInpaint: false,
    supportsOutpaint: false,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
  {
    id: 'c-nano-banana-pro',
    label: 'C 全能出图 Pro',
    series: 'C',
    group: allInOneGroup,
    category: 'all_in_one',
    backendModel: 'C-nano-banana-pro',
    engineType: 'nano-banana',
    sizeMode: 'aspect_ratio_image_size',
    tag: 'PRO',
    supportsTextToImage: true,
    supportsImageInput: true,
    supportsMask: false,
    supportsInpaint: false,
    supportsOutpaint: false,
    supports1K: true,
    supports2K: true,
    supports4K: true,
    defaultAspectRatio: '1:1',
    defaultResolution: '2K',
  },
]

export const IMAGE_SERIES = ['G', 'R', 'C'] as const satisfies readonly ImageModelSeries[]

export const DEFAULT_MODEL_BY_SERIES: Record<ImageModelSeries, string> = {
  G: 'g-gpt-image-2',
  R: 'r-gpt-image-2',
  C: 'c-gpt-image-2',
}

const MODEL_BY_ID = new Map(IMAGE_MODEL_REGISTRY.map((m) => [m.id, m]))
const MODEL_BY_BACKEND = new Map(IMAGE_MODEL_REGISTRY.map((m) => [m.backendModel.toLowerCase(), m]))

export function getImageModelById(id?: string | null) {
  return id ? MODEL_BY_ID.get(id) : undefined
}

export function getImageModelByBackendModel(backendModel?: string | null) {
  return backendModel ? MODEL_BY_BACKEND.get(backendModel.toLowerCase()) : undefined
}

export function getImageModelsBySeries(series: ImageModelSeries) {
  return IMAGE_MODEL_REGISTRY.filter((model) => model.series === series)
}

export function getImageModelGroupsBySeries(series: ImageModelSeries) {
  const models = getImageModelsBySeries(series)
  return [
    { category: 'smart' as const, group: smartGroup, models: models.filter((m) => m.category === 'smart') },
    { category: 'all_in_one' as const, group: allInOneGroup, models: models.filter((m) => m.category === 'all_in_one') },
  ].filter((group) => group.models.length > 0)
}

export function getImageModelConfig(series: ImageModelSeries | string, modelId: string): ImageModelConfig | undefined {
  const model = getImageModelById(modelId)
  if (!model) return undefined
  return model.series === series ? model : model
}

export function getModelById(modelId: string): ImageModelConfig | undefined {
  return getImageModelById(modelId)
}

export function findModelByBackendModel(backendModel: string): ImageModelConfig | undefined {
  return getImageModelByBackendModel(backendModel)
}

export function isKnownBackendModel(backendModel: string): boolean {
  return Boolean(getImageModelByBackendModel(backendModel))
}

export function getModelsForSeries(series: ImageModelSeries | string): ImageModelConfig[] {
  return IMAGE_MODEL_REGISTRY.filter((model) => model.series === series)
}

export function getModelsGroupedByCategory(series: ImageModelSeries | string) {
  return getImageModelGroupsBySeries(normalizeImageSeries(series))
}

export function getMaxResolution(_modelId: string): ResolutionKey {
  return '4K'
}

export function getModelSupportedResolutions(_modelId: string): ResolutionKey[] {
  return ['1K', '2K', '4K']
}

export function getModelSupportedAspectRatios(_modelId: string): string[] {
  return ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '4:5', '5:4', '16:9', '9:16', '21:9', '9:21']
}

export function assertCleanBackendModel(model: string) {
  if (/-[124]k$/i.test(model)) {
    throw new Error(`非法模型名：${model}。分辨率必须通过 size / image_size 字段传递，不允许拼接到 model 后面。`)
  }
}

/**
 * Strip a trailing resolution suffix (`-1k/-2k/-4k`, dash or underscore, any
 * case) from a backend model name. Used when loading old projects / history
 * and before any registry lookup, so legacy suffixed names never reach the
 * payload. Only the trailing suffix is removed — the model body is untouched.
 */
export function normalizeBackendModelName(model: string): string {
  return String(model || '')
    .replace(/-(1k|2k|4k)$/i, '')
    .replace(/_(1k|2k|4k)$/i, '')
}

export function normalizeLegacyBackendModel(model: string, data?: Record<string, unknown>) {
  const raw = String(model || '').trim()
  const lower = raw.toLowerCase()

  let forcedResolution: ResolutionKey | undefined
  let base = raw

  for (const suffix of ['-1k', '-2k', '-4k']) {
    if (lower.endsWith(suffix)) {
      forcedResolution = suffix.slice(1).toUpperCase() as ResolutionKey
      base = raw.slice(0, -suffix.length)
      break
    }
  }

  const mapping: Record<string, string> = {
    'gpt-image-2': 'C-gpt-image-2',
    'gpt-image-2-all': 'C-gpt-image-2-all',
    'gpt-image-2-vip': 'C-gpt-image-2-vip',
    'g-gpt-image-2': 'A-gpt-image-2',
    'g-gpt-image-2-vip': 'A-gpt-image-2-vip',
    'g-nano-banana-fast': 'G-nano-banana',
    'r-gpt-image-2': 'R-gpt-image-2',
    'c-gpt-image-2': 'C-gpt-image-2',
    'c-gpt-image-2-all': 'C-gpt-image-2-all',
    'c-gpt-image-2-vip': 'C-gpt-image-2-vip',
    'r-gpt-image-2-vip': 'R-gpt-image-2-vip',
    'r-nano-banana-pro-vip': 'R-nano-banana-pro',
  }

  const normalized = mapping[base.toLowerCase()] || base || raw
  return {
    model: normalized,
    resolution: forcedResolution || normalizeResolution(String(data?.resolution || data?.image_size || data?.quality || '2K')),
    changed: normalized !== raw || Boolean(forcedResolution),
  }
}

const LEGACY_MODEL_ID_MAP: Record<string, string> = {
  'gpt-image-2': 'c-gpt-image-2',
  'gpt-image-2-all': 'c-gpt-image-2-all',
  'gpt-image-2-vip': 'c-gpt-image-2-vip',
  'g 智能出图 v2 pro': 'g-gpt-image-2',
  'g 智能出图 v2 vip': 'g-gpt-image-2-vip',
  'c-gpt-image-2': 'c-gpt-image-2',
  'c-gpt-image-2-all': 'c-gpt-image-2-all',
  'c-gpt-image-2-vip': 'c-gpt-image-2-vip',
  'g-gpt-image-2': 'g-gpt-image-2',
  'g-gpt-image-2-vip': 'g-gpt-image-2-vip',
  'g-nano-banana': 'g-nano-banana',
  'g 全能出图 fast': 'g-nano-banana',
  'g-nano-banana-fast': 'g-nano-banana',
  'g-nano-banana-2': 'g-nano-banana-2',
  'g-nano-banana-2-cl': 'g-nano-banana-2-cl',
  'g-nano-banana-2-4k-cl': 'g-nano-banana-2-cl',
  'g-nano-banana-pro': 'g-nano-banana-pro',
  'g-nano-banana-pro-vt': 'g-nano-banana-pro-vt',
  'g-nano-banana-pro-cl': 'g-nano-banana-pro-cl',
  'r-gpt-image-2': 'r-gpt-image-2',
  'r-gpt-image-2-vip': 'r-gpt-image-2-vip',
  'r 全能出图 pro vip': 'r-nano-banana-pro',
  'r 全能模型 pro vip': 'r-nano-banana-pro',
  'r-nano-banana-pro': 'r-nano-banana-pro',
  'r-nano-banana-2': 'r-nano-banana-2',
  'r-nano-banana-pro-2k': 'r-nano-banana-pro',
  'r-nano-banana-pro-4k': 'r-nano-banana-pro',
  'r-nano-banana-pro-vip': 'r-nano-banana-pro',
  'r-nano-banana-pro-2k-vip': 'r-nano-banana-pro',
  'r-nano-banana-pro-4k-vip': 'r-nano-banana-pro',
  'c全能出图 v2': 'c-nano-banana-2',
  'c 全能出图 pro': 'c-nano-banana-pro',
  'c-nano-banana-2': 'c-nano-banana-2',
  'c-nano-banana-pro': 'c-nano-banana-pro',
}

export function resolveModelIdFromLegacy(value?: string | null) {
  if (!value) return DEFAULT_IMAGE_GEN_MODEL_ID

  const clean = normalizeBackendModelName(String(value).trim()).toLowerCase()
  const mapped = LEGACY_MODEL_ID_MAP[clean]
  if (mapped && MODEL_BY_ID.has(mapped)) return mapped

  const byBackend = getImageModelByBackendModel(clean)
  if (byBackend) return byBackend.id

  return DEFAULT_IMAGE_GEN_MODEL_ID
}

export function resolveSeriesFromModelId(modelId: string): ImageModelSeries {
  return getImageModelById(modelId)?.series || 'G'
}

export function normalizeImageModel(modelId: string | undefined | null): string {
  return resolveModelIdFromLegacy(modelId)
}

export function normalizeImageSeries(series: string | undefined | null): ImageModelSeries {
  if (series === 'G' || series === 'R' || series === 'C') return series
  return 'G'
}

export function normalizeImageGenSelection(data: Record<string, unknown>) {
  const rawModel = String(data.modelId || data.model || data.backendModel || '')
  const backend = normalizeLegacyBackendModel(rawModel, data)
  const modelId = resolveModelIdFromLegacy(rawModel || backend.model)
  const model = getImageModelById(modelId)

  return {
    modelId,
    modelSeries: model?.series || 'G',
    aspectRatio: normalizeAspectRatio(String(data.aspectRatio || '1:1')),
    resolution: backend.resolution,
  }
}

export const DEFAULT_IMAGE_GEN_MODEL_ID = 'g-gpt-image-2'
export const DEFAULT_ALL_IN_ONE_MODEL_ID = 'g-nano-banana'

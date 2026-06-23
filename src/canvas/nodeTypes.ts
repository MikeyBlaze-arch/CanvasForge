export type TextKind =
  | 'prompt'
  | 'negative_prompt'
  | 'style_prompt'
  | 'product_description'
  | 'reference_note'
  | 'system_note'

export type TextNodeData = {
  nodeType: 'text'
  title: string
  textKind: TextKind
  content: string
  language: 'zh' | 'en' | 'mixed'
  /** Free-resize size (px). When absent the node uses its default size, so old
      projects keep working. Persisted with the rest of node data. */
  size?: { width: number; height: number }
  /** ID of the node that wrote content into this text node (e.g. LLM) */
  sourceNodeId?: string
  /** Type of source: 'llm' | 'image_gen' | 'manual' */
  sourceType?: string
  metadata?: Record<string, unknown>
  updatedAt: number
}

export type ProductAnalysisCommerceStyle = 'domestic' | 'overseas'

export type ProductAnalysisStructuredOutput = {
  productName: string
  productCategory: string
  material: string
  colorStyle: string
  coreFunction: string
  scene: string
  targetAudience: string
  pagePlan: string[]
  finalPrompt: string
}

export type ProductAnalysisNodeData = {
  nodeType: 'product_analysis'
  title: string
  commerceStyle: ProductAnalysisCommerceStyle
  analysisModel: string
  pageCount: number
  productName: string
  productCategory: string
  material: string
  colorStyle: string
  coreFunction: string
  scene: string
  targetAudience: string
  inputText: string
  generatedPrompt: string
  structuredOutput?: ProductAnalysisStructuredOutput
  outputRequirement?: string
  analysisResult?: string
  isRunning: boolean
  error?: string
  updatedAt: number
}

export type UploadedMediaCache = {
  uploaded?: boolean
  remoteName?: string
  uploadedName?: string
  uploadedType?: string
  uploadedSubfolder?: string
  uploadedBaseUrl?: string
  uploadedAt?: number
}

export type LocalImageOutput = UploadedMediaCache & {
  type: 'image'
  file?: File
  blob?: Blob
  url: string
  previewUrl: string
  name?: string
  mimeType?: string
  size?: number
  width?: number
  height?: number
  source: 'local' | 'remote' | 'generated'
}

export type LocalVideoOutput = UploadedMediaCache & {
  type: 'video'
  file?: File
  blob?: Blob
  url: string
  previewUrl: string
  filename?: string
  name?: string
  mimeType?: string
  size?: number
  width?: number
  height?: number
  duration?: number
  promptId?: string
  workflowId?: string
  raw?: unknown
  source: 'local' | 'remote' | 'generated'
}

export type ImageAssetNodeData = {
  nodeType: 'image_asset'
  title: string
  imageUrl: string
  image?: LocalImageOutput
  output?: LocalImageOutput
  /** Original/full-resolution image URL (for download, may differ from preview imageUrl) */
  originalImageUrl?: string
  /** Explicit download URL (takes priority over imageUrl for download button) */
  downloadUrl?: string
  /** True when naturalWidth/naturalHeight are estimates rather than measured */
  widthEstimated?: boolean
  fileName?: string
  mimeType?: string
  naturalWidth?: number
  naturalHeight?: number
  /** Thumbnail display width for node card (≤360, calculated at upload/generation time) */
  previewWidth?: number
  /** Thumbnail display height for node card (≤280, calculated at upload/generation time) */
  previewHeight?: number
  role: 'reference' | 'source' | 'background' | 'product' | 'person' | 'mask_source' | 'unknown'
  /** ID of the node that produced this image */
  sourceNodeId?: string
  /** Type of source: 'image_gen' | 'upload' | 'result_convert' */
  sourceType?: string
  /** Model series if generated */
  modelSeries?: 'G' | 'R' | 'C'
  /** Model ID if generated */
  modelId?: string
  /** Human-readable model label */
  modelLabel?: string
  /** Exact backend model value sent to the API */
  backendModel?: string
  /** Image engine used for generation */
  engineType?: 'gpt-image-2' | 'nano-banana'
  /** Size parameter mode used for generation */
  sizeMode?: 'fixed_size' | 'aspect_ratio_image_size'
  /** Aspect ratio if generated */
  aspectRatio?: string
  /** Resolution if generated */
  resolution?: string
  /** Prompt used for generation */
  prompt?: string
  /** Negative prompt used for generation */
  negativePrompt?: string
  /** Real pixel width of generated image */
  realWidth?: number
  /** Real pixel height of generated image */
  realHeight?: number
  /** Final requested size: fixed pixels for GPT, image_size tier for Nano Banana */
  finalSize?: string
  /** Extra origin metadata, e.g. restored from history */
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export type ImageGenStatus = 'idle' | 'queued' | 'generating' | 'success' | 'failed'

export type ImageBatchSize = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export function normalizeImageBatchSize(value: unknown): ImageBatchSize {
  const n = Math.floor(Number(value))
  if (n >= 1 && n <= 12) return n as ImageBatchSize
  return 1
}

export type ImageGenNodeData = {
  nodeType: 'image_gen'
  title: string
  modelSeries: 'G' | 'R' | 'C'
  modelId: string
  aspectRatio: string
  resolution: '1K' | '2K' | '4K'
  batchSize?: ImageBatchSize
  referenceImageOrder?: string[]
  seed?: number
  promptInput?: string
  referenceStrength?: number
  styleStrength?: number
  keepComposition?: boolean
  keepPersonIdentity?: boolean
  keepProductStructure?: boolean
  status: ImageGenStatus
  error?: string
  lastRequestPayload?: unknown
  lastOutputImageUrls?: string[]
  lastOutputWidth?: number
  lastOutputHeight?: number
  /** URL of the last generated image (single image convenience) */
  lastGeneratedImageUrl?: string
  /** Prompt used for last generation */
  lastPrompt?: string
  /** Reference images used for last generation */
  lastReferenceImages?: string[]
  generationProgress?: {
    current: number
    total: number
    completed: number
    failed: number
    status: 'queued' | 'running' | 'partial' | 'completed' | 'failed' | 'cancelled'
  }
  /** Debug info captured from the image generation request/response adapter */
  lastDebugInfo?: unknown
  createdAt: number
  updatedAt: number
}

export type LLMMode = 'chat'

export type LLMConversationMsg = {
  role: 'system' | 'user' | 'assistant'
  content: string
  createdAt: number
}

export type LLMNodeData = {
  nodeType: 'llm'
  title: string
  llmProvider: 'openai_compatible' | 'gemini_compatible' | 'custom'
  llmModelId: string
  mode: LLMMode
  systemPrompt?: string
  userInput: string
  conversation: LLMConversationMsg[]
  outputText?: string
  /** URLs of connected image inputs */
  imageInputs?: string[]
  status: 'idle' | 'running' | 'success' | 'failed'
  error?: string
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export type ResultImageNodeData = {
  nodeType: 'result_image'
  title: string
  imageUrl: string
  /** Original/full-resolution image URL for download */
  originalImageUrl?: string
  /** Explicit download URL */
  downloadUrl?: string
  /** True when naturalWidth/naturalHeight are estimates */
  widthEstimated?: boolean
  naturalWidth: number
  naturalHeight: number
  sourceImageGenNodeId: string
  sourceTextNodeIds: string[]
  sourceImageAssetNodeIds: string[]
  modelSeries: 'G' | 'R' | 'C'
  modelId: string
  backendModel?: string
  modelLabel?: string
  engineType?: 'gpt-image-2' | 'nano-banana'
  sizeMode?: 'fixed_size' | 'aspect_ratio_image_size'
  aspectRatio: string
  resolution: '1K' | '2K' | '4K'
  finalSize?: string
  promptSnapshot: string
  negativePromptSnapshot?: string
  taskId?: string
  seed?: number
  createdAt: number
}

export type GroupNodeData = {
  nodeType: 'group'
  title: string
  childNodeIds: string[]
  width?: number
  height?: number
  outputMode?: 'auto' | 'image_collection'
  imageOutputOrder?: string[]
  createdAt: number
  updatedAt: number
}

export type VideoAssetNodeData = {
  nodeType: 'video_asset'
  title: string
  videoUrl: string
  video?: LocalVideoOutput
  output?: LocalVideoOutput
  originalVideoUrl?: string
  downloadUrl?: string
  fileName?: string
  mimeType?: string
  naturalWidth?: number
  naturalHeight?: number
  duration?: number
  previewWidth?: number
  previewHeight?: number
  role: 'source' | 'output' | 'motion_source' | 'unknown'
  sourceType?: 'upload' | 'generated'
  sourceNodeId?: string
  createdAt: number
  updatedAt: number
}

export type MotionTransferPhase =
  | 'idle'
  | 'checking'
  | 'startingComfy'
  | 'uploading'
  | 'submitting'
  | 'polling'
  | 'parsing'
  | 'loadingVideo'
  | 'success'
  | 'error'

export type ServiceStatusCache = {
  panelOk?: boolean | null
  gpuHas?: boolean | null
  gpuName?: string
  comfyRunning?: boolean | null
  comfyStarting?: boolean | null
  workflowFound?: boolean | null
  checkedAt?: number
}

export type MotionTransferNodeData = {
  nodeType: 'motion_transfer'
  title: string
  mode: number
  resolution: number
  status: 'idle' | 'queued' | 'running' | 'success' | 'failed'
  phase?: MotionTransferPhase
  phaseLabel?: string
  error?: string
  outputVideoUrl?: string
  output?: LocalVideoOutput
  outputWidth?: number
  outputHeight?: number
  inputVideoUrl?: string
  inputImageUrl?: string
  param265: number
  param266: number
  param271: boolean
  param297: number
  param300: number
  param361: number
  param370: boolean
  lastRequestPayload?: unknown
  promptId?: string
  /** Auto-start ComfyUI before generation */
  autoStartComfy?: boolean
  /** Cached remote service status */
  serviceStatus?: ServiceStatusCache
  /** Debug: baseUrl used */
  debugBaseUrl?: string
  /** Debug: generate response */
  debugGenerateResponse?: unknown
  /** Debug: result response */
  debugResultResponse?: unknown
  /** Debug: history response */
  debugHistoryResponse?: unknown
  debugRawVideoInput?: unknown
  debugRawVideoInputType?: string
  debugRawVideoInputKeys?: string[]
  debugRawVideoHasFile?: boolean
  debugRawVideoUrl?: string
  debugRawVideoMessage?: string
  debugVideoUploadResponse?: unknown
  debugResolvedVideo?: string
  debugRawImageInput?: unknown
  debugRawImageInputType?: string
  debugRawImageInputKeys?: string[]
  debugRawImageHasFile?: boolean
  debugRawImageUrl?: string
  debugRawImageMessage?: string
  debugImageUploadResponse?: unknown
  debugResolvedImage?: string
  /** Debug: input values */
  debugInputValues?: unknown
  /** Debug: extracted video */
  debugExtractedVideo?: unknown
  /** Debug: final video URL */
  debugVideoUrl?: string
  /** Debug: error */
  debugError?: string
  createdAt: number
  updatedAt: number
}

export type VideoGenStatus =
  | 'idle'
  | 'queued'
  | 'submitting'
  | 'polling'
  | 'success'
  | 'failed'

export type VideoGenNodeData = {
  nodeType: 'video_gen'
  title: string

  modelId: string
  backendModel?: string
  modelLabel?: string

  promptInput?: string
  aspectRatio: '16:9' | '9:16' | '1:1'
  size: '720p' | '1080p'
  duration: number
  fps?: number
  seed?: number

  status: VideoGenStatus
  taskId?: string
  progress?: number
  error?: string

  inputImageUrl?: string
  inputImageData?: string
  lastPrompt?: string
  lastRequestPayload?: unknown
  lastStatusResponse?: unknown
  lastGeneratedVideoUrl?: string
  lastOutputWidth?: number
  lastOutputHeight?: number
  lastOutputDuration?: number

  createdAt: number
  updatedAt: number
}

export type CanvasNodeData =
  | TextNodeData
  | ProductAnalysisNodeData
  | ImageAssetNodeData
  | ImageGenNodeData
  | LLMNodeData
  | ResultImageNodeData
  | GroupNodeData
  | VideoAssetNodeData
  | MotionTransferNodeData
  | VideoGenNodeData

export type HistoryRecord = {
  id: string
  schemaVersion?: number
  type: 'image' | 'video'
  status?: 'success' | 'failed'
  sourceNodeId: string
  modelSeries: 'G' | 'R' | string
  modelId: string
  modelLabel?: string
  backendModel?: string
  engineType?: 'gpt-image-2' | 'nano-banana'
  sizeMode?: 'fixed_size' | 'aspect_ratio_image_size'
  promptSnapshot: string
  prompt?: string
  negativePromptSnapshot?: string
  negativePrompt?: string
  imageUrl?: string
  url?: string
  originalUrl?: string
  thumbnailBlobKey?: string
  videoUrl?: string
  thumbnailUrl?: string
  naturalWidth: number
  naturalHeight: number
  width?: number
  height?: number
  duration?: number
  aspectRatio?: string
  resolution?: string
  finalSize?: string
  createdAt: number
  timeUnknown?: boolean
  requestPayload?: unknown
  error?: string
  errorMessage?: string
  imageUrls?: string[]
  outputs?: Array<{
    type: 'image'
    index: number
    status?: 'completed' | 'failed' | 'cancelled'
    url?: string
    imageUrl?: string
    thumbnailUrl?: string
    naturalWidth?: number
    naturalHeight?: number
    width?: number
    height?: number
    error?: string
  }>
  batchSize?: number
  returnedBatchSize?: number
  batchId?: string
  batchIndex?: number
  batchTotal?: number
  requestedCount?: number
  completedCount?: number
  failedCount?: number
  batchStatus?: 'partial' | 'completed' | 'failed' | 'cancelled'
}

export const TEXT_KIND_LABELS: Record<TextKind, string> = {
  prompt: '正向提示词',
  negative_prompt: '反向提示词',
  style_prompt: '风格词',
  product_description: '商品描述',
  reference_note: '参考说明',
  system_note: '系统说明',
}

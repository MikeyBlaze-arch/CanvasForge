import type { Edge, Node } from '@xyflow/react'
import {
  IMAGE_MODEL_REGISTRY,
  getImageModelById,
  getImageModelByBackendModel,
  normalizeBackendModelName,
  resolveModelIdFromLegacy,
} from '../imageModelRegistry.ts'
import { buildImageGenerationPayload } from '../imagePayloadBuilder.ts'
import { buildImageGenerationRequest } from '../imageRequestAdapter.ts'
import { parseImageGenerationResponse } from '../imageResponseParser.ts'
import { buildSingleImagePayload } from '../scheduler/imageGenerationQueue.ts'
import { formatAspectRatioLabel, normalizeAspectRatio, normalizeAspectRatioOptionValue } from '../sizeRegistry.ts'
import { migrateHistoryItems } from '../../history/historyMigration.ts'
import { getImageGenInputs, getLLMInputs, getProductAnalysisInputs } from '../../canvas/nodeInputResolvers.ts'
import { resolveGroupImageOutputs } from '../../canvas/groupImageOutputs.ts'
import { isConnectionAllowed } from '../../canvas/connectionRules.ts'
import { buildProductAnalysisPrompt, createDefaultProductAnalysisNodeData } from '../../canvas/productAnalysisPrompt.ts'
import type { CanvasNodeData } from '../../canvas/nodeTypes.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}`)
  }
}

const countBySeries = (series: 'G' | 'R' | 'C') => IMAGE_MODEL_REGISTRY.filter((model) => model.series === series).length

assertEqual(countBySeries('G'), 8, 'G series model count')
assertEqual(countBySeries('R'), 4, 'R series model count')
assertEqual(countBySeries('C'), 5, 'C series model count')
assertEqual(getImageModelById('g-gpt-image-2')?.label, 'G 智能出图 V2', 'G GPT label')
assertEqual(getImageModelById('g-gpt-image-2')?.backendModel, 'A-gpt-image-2', 'G GPT backendModel')
assert(getImageModelById('g-gpt-image-2-vip'), 'G GPT VIP model exists')
assertEqual(getImageModelById('g-gpt-image-2-vip')?.backendModel, 'A-gpt-image-2-vip', 'G GPT VIP backendModel')
assertEqual(getImageModelById('r-gpt-image-2')?.backendModel, 'R-gpt-image-2', 'R GPT backendModel')
assertEqual(getImageModelById('r-gpt-image-2-vip')?.backendModel, 'R-gpt-image-2-vip', 'R VIP backendModel')
assertEqual(getImageModelById('c-gpt-image-2-all')?.backendModel, 'C-gpt-image-2-all', 'C all backendModel')
assertEqual(getImageModelById('g-nano-banana-pro-vt')?.backendModel, 'G-nano-banana-pro-vt', 'G Pro VT backendModel')
assertEqual(getImageModelById('r-nano-banana-2')?.backendModel, 'R-nano-banana-2', 'R Nano V2 backendModel')
assert(!getImageModelById('g-nano-banana-fast'), 'Deleted G Fast model must not exist')
assert(!getImageModelById('r-nano-banana-pro-vip'), 'Deleted R Pro VIP model must not exist')
assert(IMAGE_MODEL_REGISTRY.every((model) => model.supports4K), 'All image models must support 4K')
assert(IMAGE_MODEL_REGISTRY.every((model) => model.label && model.backendModel && model.engineType && model.sizeMode), 'All image models must have required fields')

const gpt2k = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2',
  prompt: 'test',
  aspectRatio: '16:9',
  resolution: '2K',
})
assertEqual(gpt2k.model, 'A-gpt-image-2', 'GPT 2K model')
assertEqual(gpt2k.size, '2048x1152', 'GPT 16:9 2K fixed size')
assertEqual(gpt2k.n, 1, 'GPT n')

const gptBatch4 = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2',
  prompt: 'test',
  aspectRatio: '1:1',
  resolution: '2K',
  batchSize: 4,
})
assertEqual(gptBatch4.n, 4, 'GPT batchSize 4 maps to n=4')
assertEqual(gptBatch4.size, '2048x2048', 'GPT 1:1 2K fixed size')

const gptQueuedSingle = buildSingleImagePayload(gptBatch4, 2)
assertEqual(gptQueuedSingle.n, 1, 'queued GPT task forces n=1')
assertEqual(gptQueuedSingle.size, '2048x2048', 'queued GPT task keeps fixed size')

const gptBatch12 = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2',
  prompt: 'test',
  aspectRatio: '1:1',
  resolution: '2K',
  batchSize: 12,
})
assertEqual(gptBatch12.n, 12, 'GPT batchSize 12 maps to n=12')

const gptBatch0 = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2',
  prompt: 'test',
  aspectRatio: '1:1',
  resolution: '2K',
  batchSize: 0,
})
assertEqual(gptBatch0.n, 1, 'GPT batchSize 0 normalizes to 1')

const gptBatch99 = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2',
  prompt: 'test',
  aspectRatio: '1:1',
  resolution: '2K',
  batchSize: 99,
})
assertEqual(gptBatch99.n, 1, 'GPT batchSize 99 normalizes to 1')

const gpt4k = buildImageGenerationPayload({
  modelId: 'r-gpt-image-2',
  prompt: 'test',
  aspectRatio: '16:9',
  resolution: '4K',
})
assertEqual(gpt4k.model, 'R-gpt-image-2', 'R GPT 4K model')
assertEqual(gpt4k.size, '3840x2160', 'GPT 16:9 4K fixed size')

// ── G/R smart V2 + VIP fixed-size acceptance ──
const gVip4k = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2-vip',
  prompt: 'test',
  aspectRatio: '16:9',
  resolution: '4K',
})
assertEqual(gVip4k.model, 'A-gpt-image-2-vip', 'G VIP 4K model')
assertEqual(gVip4k.size, '3840x2160', 'G VIP 16:9 4K fixed size')

const rGpt2k = buildImageGenerationPayload({
  modelId: 'r-gpt-image-2',
  prompt: 'test',
  aspectRatio: '1:1',
  resolution: '2K',
})
assertEqual(rGpt2k.model, 'R-gpt-image-2', 'R GPT 2K model')
assertEqual(rGpt2k.size, '2048x2048', 'R GPT 1:1 2K fixed size')

const rVip4k = buildImageGenerationPayload({
  modelId: 'r-gpt-image-2-vip',
  prompt: 'test',
  aspectRatio: '16:9',
  resolution: '4K',
})
assertEqual(rVip4k.model, 'R-gpt-image-2-vip', 'R VIP 4K model')
assertEqual(rVip4k.size, '3840x2160', 'R VIP 16:9 4K fixed size')

const gpt34 = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2',
  prompt: 'test',
  aspectRatio: '3:4',
  resolution: '2K',
})
assertEqual(gpt34.size, '1728x2304', 'GPT 3:4 2K fixed size')

assertEqual(formatAspectRatioLabel('auto'), 'Auto', 'Auto label only')
assertEqual(formatAspectRatioLabel('1:1'), '1:1', 'ratio label only')
assertEqual(formatAspectRatioLabel('1:1 / 2048x2048'), '1:1', 'legacy ratio/size label normalizes')
assertEqual(normalizeAspectRatioOptionValue('16:9 / 3840\u00d72160'), '16:9', 'legacy unicode multiply ratio normalizes')
assertEqual(normalizeAspectRatioOptionValue('3:4 / 1728\u81032304'), '3:4', 'legacy mojibake ratio normalizes')
assertEqual(normalizeAspectRatio('2048\u00d72048'), '1:1', 'legacy pixel size normalizes to ratio')

for (const forbiddenKey of ['aspect_ratio', 'image_size', 'imageSize', 'quality', 'return_full_resolution']) {
  assert(!(forbiddenKey in gpt2k), `GPT payload must not contain ${forbiddenKey}`)
  assert(!(forbiddenKey in gpt4k), `GPT payload must not contain ${forbiddenKey}`)
}

const nano4k = buildImageGenerationPayload({
  modelId: 'g-nano-banana-pro-vt',
  prompt: 'test',
  aspectRatio: '16:9',
  resolution: '2K',
  batchSize: 4,
})
assertEqual(nano4k.model, 'G-nano-banana-pro-vt', 'Nano model')
assertEqual(nano4k.n, 4, 'Nano batchSize 4 maps to n=4')
const nanoQueuedSingle = buildSingleImagePayload(nano4k, 3)
assertEqual(nanoQueuedSingle.n, 1, 'queued Nano task forces n=1')
assertEqual(nanoQueuedSingle.aspect_ratio, '16:9', 'queued Nano task keeps aspect_ratio')
assertEqual(nano4k.aspect_ratio, '16:9', 'Nano aspect_ratio')
assertEqual(nano4k.image_size, '2K', 'Nano image_size')
assert(!('size' in nano4k), 'Nano payload must not send size by default')
assert(!('quality' in nano4k), 'Nano payload must not send quality by default')
assert(!('resolution' in nano4k), 'Nano payload must not send resolution by default')
assert(!('ratio' in nano4k), 'Nano payload must not send ratio alias by default')
assert(!('imageSize' in nano4k), 'Nano payload must not send imageSize alias by default')
assert(!('return_original' in nano4k), 'Nano payload must not send return_original by default')
assert(!('return_full_resolution' in nano4k), 'Nano payload must not send return_full_resolution by default')
assert(!String(nano4k.model).endsWith('-4k') && !String(nano4k.model).endsWith('-2k'), 'Nano model must not include resolution suffix')

// ── Backend model name normalization (strip -1k/-2k/-4k suffixes) ───────
assertEqual(normalizeBackendModelName('C-nano-banana-pro-2k'), 'C-nano-banana-pro', 'strip -2k suffix')
assertEqual(normalizeBackendModelName('G-nano-banana-pro-4k'), 'G-nano-banana-pro', 'strip -4k suffix')
assertEqual(normalizeBackendModelName('R-nano-banana-2-1k'), 'R-nano-banana-2', 'strip -1k suffix')
assertEqual(normalizeBackendModelName('c-nano-banana-pro-2K'), 'c-nano-banana-pro', 'strip uppercase -2K suffix')
assertEqual(normalizeBackendModelName('foo_4k'), 'foo', 'strip underscore _4k suffix')
assertEqual(normalizeBackendModelName('G-nano-banana-pro'), 'G-nano-banana-pro', 'no suffix untouched')
assertEqual(normalizeBackendModelName('g-nano-banana-2-cl'), 'g-nano-banana-2-cl', 'body chars (-cl) not stripped')

// ── Legacy model migration (old project / history names → current registry) ──
assertEqual(resolveModelIdFromLegacy('C-nano-banana-pro-2k'), 'c-nano-banana-pro', 'legacy C-pro-2k migration')
assertEqual(resolveModelIdFromLegacy('G-nano-banana-pro-4k'), 'g-nano-banana-pro', 'legacy G-pro-4k migration')
assertEqual(getImageModelById(resolveModelIdFromLegacy('R-gpt-image-2'))?.backendModel, 'R-gpt-image-2', 'legacy R-gpt-image-2 → R-gpt-image-2')
assertEqual(getImageModelById(resolveModelIdFromLegacy('R-gpt-image-2-vip'))?.backendModel, 'R-gpt-image-2-vip', 'legacy R-gpt-image-2-vip → R-gpt-image-2-vip')
assertEqual(resolveModelIdFromLegacy('g 全能出图 fast'), 'g-nano-banana', 'legacy G Fast → g-nano-banana')
assertEqual(resolveModelIdFromLegacy('c全能出图 v2'), 'c-nano-banana-2', 'legacy C 全能出图 v2 → c-nano-banana-2')
assertEqual(resolveModelIdFromLegacy('deleted-model-xyz'), 'g-gpt-image-2', 'unknown model falls back to default')

// No registry backend model carries a resolution suffix
assert(IMAGE_MODEL_REGISTRY.every((m) => !/-[124]k$/i.test(m.backendModel)), 'No registry backendModel has a resolution suffix')

const authHeaders = { Authorization: 'Bearer test' }
const gptModel = getImageModelById('r-gpt-image-2-vip')
assert(gptModel, 'R VIP model exists')
const gptRoute = await buildImageGenerationRequest({
  payload: {
    model: 'A-gpt-image-2-vip',
    prompt: 'test',
    size: '2048x1152',
    n: 1,
    image_size: '2K',
    aspect_ratio: '16:9',
  },
  model: gptModel,
  baseUrl: 'https://relay.example',
  authHeaders,
})
assertEqual(gptRoute.endpoint, 'https://relay.example/v1/images/generations', 'GPT text endpoint')
assertEqual(gptRoute.debugInfo.contentType, 'application/json', 'GPT text content type')
assertEqual(gptRoute.debugInfo.payloadKeys.join(','), 'model,n,prompt,size', 'GPT text payload keys must be clean')

const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
const gptEditRoute = await buildImageGenerationRequest({
  payload: {
    model: 'A-gpt-image-2-vip',
    prompt: 'test',
    size: '2048x1152',
    n: 1,
    images: [png1x1],
    image_size: '2K',
  },
  model: gptModel,
  baseUrl: 'https://relay.example',
  authHeaders,
})
assertEqual(gptEditRoute.endpoint, 'https://relay.example/v1/images/edits', 'GPT image endpoint')
assertEqual(gptEditRoute.debugInfo.contentType, 'multipart/form-data', 'GPT image content type')
assertEqual(gptEditRoute.debugInfo.payloadKeys.join(','), 'image,model,n,prompt,size', 'GPT image payload keys must be clean')

const nanoModel = getImageModelById('g-nano-banana-pro-vt')
assert(nanoModel, 'Nano model exists')
const nanoRoute = await buildImageGenerationRequest({
  payload: nano4k,
  model: nanoModel,
  baseUrl: 'https://relay.example',
  authHeaders,
})
assertEqual(nanoRoute.endpoint, 'https://relay.example/v1/images/generations', 'Nano text endpoint')
assertEqual(nanoRoute.debugInfo.contentType, 'application/json', 'Nano text content type')
assertEqual(String(nanoRoute.debugInfo.payloadKeys.includes('image_size')), 'true', 'Nano payload includes image_size')
assertEqual(String(nanoRoute.debugInfo.payloadKeys.includes('size')), 'false', 'Nano payload must not include size by default')

const nanoRefRoute = await buildImageGenerationRequest({
  payload: { ...nano4k, images: [png1x1] },
  model: nanoModel,
  baseUrl: 'https://relay.example',
  authHeaders,
})
assertEqual(nanoRefRoute.endpoint, 'https://relay.example/v1beta/models/G-nano-banana-pro-vt:generateContent', 'Nano image endpoint')
assertEqual(nanoRefRoute.debugInfo.payloadKeys.join(','), 'contents,generationConfig', 'Nano image payload follows Gemini-style PixelForge path')

const parsedMultiUrl = parseImageGenerationResponse({ data: [{ url: 'https://example.com/a.png' }, { url: 'https://example.com/b.png' }] })
assertEqual(parsedMultiUrl.images.length, 2, 'parser data[] url count')
assertEqual(parsedMultiUrl.imageUrl, 'https://example.com/a.png', 'parser first url compatibility')
assertEqual(parsedMultiUrl.matchedField, 'data[0].url', 'parser data[0].url')

const parsedMultiBase64 = parseImageGenerationResponse({ data: [{ b64_json: 'a'.repeat(128) }, { b64_json: 'b'.repeat(128) }] })
assertEqual(parsedMultiBase64.images.length, 2, 'parser data[] b64 count')
assertEqual(parsedMultiBase64.matchedField, 'data[0].b64_json', 'parser data[0].b64_json')
assert(Boolean(parsedMultiBase64.dataUrl), 'parser first b64 compatibility')

assertEqual(parseImageGenerationResponse({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'a'.repeat(128) } }] } }] }).matchedField, 'candidates[0].content.parts[0].inlineData', 'parser inlineData')
assertEqual(parseImageGenerationResponse({ output_url: 'https://example.com/out.png' }).matchedField, 'output_url', 'parser output_url')
assertEqual(parseImageGenerationResponse('![x](https://example.com/md.png)').matchedField, '.markdown_image', 'parser markdown image')
assertEqual(parseImageGenerationResponse({ output_url: 'https://example.com/out.png' }).images.length, 1, 'parser single image wraps in images[]')

const migratedBatchHistory = migrateHistoryItems([{
  id: 'legacy_batch',
  type: 'image',
  status: 'success',
  sourceNodeId: 'node_1',
  modelSeries: 'G',
  modelId: 'g-gpt-image-2',
  promptSnapshot: 'test',
  imageUrl: 'https://example.com/1.png',
  url: 'https://example.com/1.png',
  thumbnailUrl: 'https://example.com/1.png',
  imageUrls: [
    'https://example.com/1.png',
    'https://example.com/2.png',
    'https://example.com/3.png',
  ],
  naturalWidth: 1024,
  naturalHeight: 1024,
  createdAt: 1000,
}])
assertEqual(migratedBatchHistory.length, 3, 'legacy aggregate history splits into single-image records')
assertEqual(migratedBatchHistory[0].batchId, 'legacy_batch', 'split history keeps shared batchId')
assertEqual(migratedBatchHistory[0].batchIndex, 1, 'split history first index is 1-based')
assertEqual(migratedBatchHistory[1].imageUrl, 'https://example.com/2.png', 'split history second image is standalone')
assertEqual(migratedBatchHistory[2].batchTotal, 3, 'split history stores batchTotal')

const sortedReferenceInputs = getImageGenInputs(
  'gen',
  [
    {
      id: 'gen',
      type: 'image_gen',
      position: { x: 0, y: 0 },
      data: {
        nodeType: 'image_gen',
        title: 'gen',
        modelSeries: 'G',
        modelId: 'g-gpt-image-2',
        aspectRatio: '1:1',
        resolution: '2K',
        referenceImageOrder: ['img3', 'img1'],
        status: 'idle',
        createdAt: 1,
        updatedAt: 1,
      },
    },
    { id: 'img1', type: 'image_asset', position: { x: 0, y: 0 }, data: { nodeType: 'image_asset', title: '1', imageUrl: 'url-1', role: 'reference', createdAt: 1, updatedAt: 1 } },
    { id: 'img2', type: 'image_asset', position: { x: 0, y: 0 }, data: { nodeType: 'image_asset', title: '2', imageUrl: 'url-2', role: 'reference', createdAt: 1, updatedAt: 1 } },
    { id: 'img3', type: 'image_asset', position: { x: 0, y: 0 }, data: { nodeType: 'image_asset', title: '3', imageUrl: 'url-3', role: 'reference', createdAt: 1, updatedAt: 1 } },
  ] as never,
  [
    { id: 'e1', source: 'img1', target: 'gen' },
    { id: 'e2', source: 'img2', target: 'gen' },
    { id: 'e3', source: 'img3', target: 'gen' },
  ] as never,
)
assertEqual(sortedReferenceInputs.referenceImages.join(','), 'url-3,url-1,url-2', 'referenceImageOrder controls generation reference order')
assertEqual(sortedReferenceInputs.normalizedReferenceImageOrder.join(','), 'img3,img1,img2', 'new connected reference appends to normalized order')
assertEqual(sortedReferenceInputs.referenceImageNodes[0].label, '图1', 'reference labels follow current preview position')

const cleanedReferenceInputs = getImageGenInputs(
  'gen',
  [
    {
      id: 'gen',
      type: 'image_gen',
      position: { x: 0, y: 0 },
      data: {
        nodeType: 'image_gen',
        title: 'gen',
        modelSeries: 'G',
        modelId: 'g-gpt-image-2',
        aspectRatio: '1:1',
        resolution: '2K',
        referenceImageOrder: ['missing', 'empty', 'valid'],
        status: 'idle',
        createdAt: 1,
        updatedAt: 1,
      },
    },
    { id: 'empty', type: 'image_asset', position: { x: 0, y: 0 }, data: { nodeType: 'image_asset', title: 'empty', imageUrl: '', role: 'reference', createdAt: 1, updatedAt: 1 } },
    { id: 'valid', type: 'image_asset', position: { x: 0, y: 0 }, data: { nodeType: 'image_asset', title: 'valid', imageUrl: 'url-valid', role: 'reference', createdAt: 1, updatedAt: 1 } },
  ] as never,
  [
    { id: 'e1', source: 'empty', target: 'gen' },
    { id: 'e2', source: 'valid', target: 'gen' },
  ] as never,
)
assertEqual(cleanedReferenceInputs.referenceImageNodes.length, 1, 'invalid connected image nodes do not enter preview items')
assertEqual(cleanedReferenceInputs.normalizedReferenceImageOrder.join(','), 'valid', 'dirty referenceImageOrder keeps only valid connected image nodes')

const groupImageNodes: Node<CanvasNodeData>[] = [
  {
    id: 'group1',
    type: 'group',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'group',
      title: 'group',
      childNodeIds: ['group-img-right', 'group-img-left', 'group-gen', 'group-empty'],
      createdAt: 1,
      updatedAt: 1,
    },
  },
  { id: 'group-img-right', type: 'image_asset', position: { x: 200, y: 0 }, data: { nodeType: 'image_asset', title: 'right', imageUrl: 'url-group-right', role: 'reference', createdAt: 1, updatedAt: 1 } },
  { id: 'group-img-left', type: 'image_asset', position: { x: 0, y: 0 }, data: { nodeType: 'image_asset', title: 'left', imageUrl: 'url-group-left', role: 'reference', createdAt: 1, updatedAt: 1 } },
  {
    id: 'group-gen',
    type: 'image_gen',
    position: { x: 0, y: 120 },
    data: {
      nodeType: 'image_gen',
      title: 'generated',
      modelSeries: 'G',
      modelId: 'g-gpt-image-2',
      aspectRatio: '1:1',
      resolution: '2K',
      lastOutputImageUrls: ['url-group-gen-1', 'url-group-gen-2'],
      status: 'idle',
      createdAt: 1,
      updatedAt: 1,
    },
  },
  { id: 'group-empty', type: 'image_asset', position: { x: 0, y: 240 }, data: { nodeType: 'image_asset', title: 'empty', imageUrl: '', role: 'reference', createdAt: 1, updatedAt: 1 } },
] as Node<CanvasNodeData>[]

const resolvedGroupImages = resolveGroupImageOutputs('group1', groupImageNodes, [] as Edge[])
assertEqual(
  resolvedGroupImages.map((image) => image.imageUrl).join(','),
  'url-group-left,url-group-right,url-group-gen-1,url-group-gen-2',
  'group image resolver sorts top-to-bottom then left-to-right and expands generated images'
)

const mixedGroupImageInputs = getImageGenInputs(
  'gen-target',
  [
    ...groupImageNodes,
    {
      id: 'gen-target',
      type: 'image_gen',
      position: { x: 500, y: 0 },
      data: {
        nodeType: 'image_gen',
        title: 'target',
        modelSeries: 'G',
        modelId: 'g-gpt-image-2',
        aspectRatio: '1:1',
        resolution: '2K',
        referenceImageOrder: [],
        status: 'idle',
        createdAt: 1,
        updatedAt: 1,
      },
    },
    { id: 'normal-before', type: 'image_asset', position: { x: -300, y: 0 }, data: { nodeType: 'image_asset', title: 'before', imageUrl: 'url-before', role: 'reference', createdAt: 1, updatedAt: 1 } },
    { id: 'normal-after', type: 'image_asset', position: { x: 800, y: 0 }, data: { nodeType: 'image_asset', title: 'after', imageUrl: 'url-after', role: 'reference', createdAt: 1, updatedAt: 1 } },
  ] as never,
  [
    { id: 'e-before', source: 'normal-before', sourceHandle: 'image_output', target: 'gen-target', targetHandle: 'reference_image' },
    { id: 'e-group', source: 'group1', sourceHandle: 'image_collection_output', target: 'gen-target', targetHandle: 'reference_image' },
    { id: 'e-after', source: 'normal-after', sourceHandle: 'image_output', target: 'gen-target', targetHandle: 'reference_image' },
  ] as never,
)
assertEqual(
  mixedGroupImageInputs.referenceImages.join(','),
  'url-before,url-group-left,url-group-right,url-group-gen-1,url-group-gen-2,url-after',
  'image_gen expands group image collections in edge order alongside normal images'
)
assertEqual(
  mixedGroupImageInputs.normalizedReferenceImageOrder.join(','),
  'normal-before,group1:group-img-left,group1:group-img-right,group1:group-gen,group1:group-gen:1,normal-after',
  'group expanded images receive independent reference order keys'
)

const groupLLMInputs = getLLMInputs(
  'llm-target',
  [
    ...groupImageNodes,
    {
      id: 'llm-target',
      type: 'llm',
      position: { x: 500, y: 0 },
      data: {
        nodeType: 'llm',
        title: 'llm',
        llmProvider: 'openai_compatible',
        llmModelId: 'gpt-4o',
        mode: 'chat',
        userInput: '',
        conversation: [],
        status: 'idle',
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ] as never,
  [
    { id: 'e-group-llm', source: 'group1', sourceHandle: 'image_collection_output', target: 'llm-target', targetHandle: 'image_input' },
  ] as never,
  ''
)
assertEqual(
  groupLLMInputs.imageInputs.join(','),
  'url-group-left,url-group-right,url-group-gen-1,url-group-gen-2',
  'llm expands group image collections into image inputs'
)

const productAnalysisData = {
  ...createDefaultProductAnalysisNodeData(1),
  productName: '恒温杯',
  productCategory: '智能家居',
  material: '陶瓷内胆 / 恒温底座',
  colorStyle: '奶白色 / 极简风',
  coreFunction: '长时间保持饮品温热',
  scene: '办公室、书房、床头',
  targetAudience: '上班族、学生、夜间阅读人群',
}
const productAnalysisPrompt = buildProductAnalysisPrompt(productAnalysisData, '上游信息：支持一机多用')
assert(productAnalysisPrompt.includes('你是一个电商产品卖点分析和图片生成提示词专家。'), 'product analysis prompt includes role')
assert(productAnalysisPrompt.includes('【上游输入信息】'), 'product analysis prompt includes upstream section')
assert(productAnalysisPrompt.includes('上游信息：支持一机多用'), 'product analysis prompt includes upstream text')
assert(productAnalysisPrompt.includes('产品名称：恒温杯'), 'product analysis prompt includes product name')
assert(productAnalysisPrompt.includes('请提炼适合电商主图、详情页首屏、广告图和社媒营销图使用的核心卖点'), 'product analysis prompt uses default output requirement')
assert(productAnalysisPrompt.includes('5. 负面提示词'), 'product analysis prompt keeps required output structure')
assert(
  isConnectionAllowed({
    sourceType: 'text',
    sourceHandle: 'prompt',
    targetType: 'product_analysis',
    targetHandle: 'product_info_input',
  }),
  'text output can connect to product analysis input'
)
assert(
  isConnectionAllowed({
    sourceType: 'llm',
    sourceHandle: 'llm_output',
    targetType: 'product_analysis',
    targetHandle: 'product_info_input',
  }),
  'llm output can connect to product analysis input'
)
assert(
  isConnectionAllowed({
    sourceType: 'image_asset',
    sourceHandle: 'image_output',
    targetType: 'product_analysis',
    targetHandle: 'image_input',
  }),
  'image output can connect to product analysis image input'
)
assert(
  isConnectionAllowed({
    sourceType: 'product_analysis',
    sourceHandle: 'analysis_result_output',
    targetType: 'llm',
    targetHandle: 'text_input',
  }),
  'product analysis result output can connect to llm text input'
)
assert(
  isConnectionAllowed({
    sourceType: 'product_analysis',
    sourceHandle: 'analysis_result_output',
    targetType: 'text',
    targetHandle: 'llm_input',
  }),
  'product analysis result output can connect to text input'
)
assert(
  !isConnectionAllowed({
    sourceType: 'product_analysis',
    sourceHandle: 'analysis_result_output',
    targetType: 'image_gen',
    targetHandle: 'prompt',
  }),
  'product analysis must not connect directly to image generation'
)

const productAnalysisInputs = getProductAnalysisInputs(
  'analysis',
  [
    {
      id: 'source-text',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {
        nodeType: 'text',
        title: 'text',
        content: '补充说明：适合送礼',
        sourceNodeId: '',
        sourceType: 'manual',
        createdAt: 1,
        updatedAt: 1,
      },
    },
    {
      id: 'source-llm',
      type: 'llm',
      position: { x: 0, y: 220 },
      data: {
        nodeType: 'llm',
        title: 'llm',
        llmProvider: 'openai_compatible',
        llmModelId: 'gpt-4o',
        mode: 'chat',
        userInput: '',
        outputText: '竞品洞察：强调恒温稳定',
        conversation: [],
        status: 'success',
        createdAt: 1,
        updatedAt: 1,
      },
    },
    {
      id: 'analysis',
      type: 'product_analysis',
      position: { x: 500, y: 0 },
      data: productAnalysisData,
    },
    { id: 'source-image', type: 'image_asset', position: { x: 0, y: 440 }, data: { nodeType: 'image_asset', title: 'image', imageUrl: 'url-product-image', role: 'product', createdAt: 1, updatedAt: 1 } },
    {
      id: 'analysis-output-text',
      type: 'text',
      position: { x: 900, y: 0 },
      data: {
        nodeType: 'text',
        title: 'text',
        content: '',
        sourceNodeId: '',
        sourceType: 'manual',
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ] as never,
  [
    { id: 'e-text-analysis', source: 'source-text', sourceHandle: 'prompt', target: 'analysis', targetHandle: 'product_info_input' },
    { id: 'e-llm-analysis', source: 'source-llm', sourceHandle: 'llm_output', target: 'analysis', targetHandle: 'product_info_input' },
    { id: 'e-image-analysis', source: 'source-image', sourceHandle: 'image_output', target: 'analysis', targetHandle: 'image_input' },
    { id: 'e-analysis-text', source: 'analysis', sourceHandle: 'analysis_result_output', target: 'analysis-output-text', targetHandle: 'llm_input' },
  ] as never
)
assertEqual(productAnalysisInputs.connectedInputTextNodeCount, 2, 'product analysis counts connected upstream text inputs')
assertEqual(productAnalysisInputs.connectedInputImageNodeCount, 1, 'product analysis counts connected upstream image inputs')
assertEqual(productAnalysisInputs.imageInputs.join(','), 'url-product-image', 'product analysis reads connected image node input')
assert(productAnalysisInputs.inputText.includes('补充说明：适合送礼'), 'product analysis reads text node input')
assert(productAnalysisInputs.inputText.includes('竞品洞察：强调恒温稳定'), 'product analysis reads llm node output')
assertEqual(productAnalysisInputs.connectedOutputTextNodeIds.join(','), 'analysis-output-text', 'product analysis detects downstream text nodes')

const productAnalysisLLMInputs = getLLMInputs(
  'llm-product',
  [
    {
      id: 'analysis',
      type: 'product_analysis',
      position: { x: 0, y: 0 },
      data: {
        ...productAnalysisData,
        analysisResult: '图片生成提示词：奶白色恒温杯置于办公桌上',
      },
    },
    {
      id: 'llm-product',
      type: 'llm',
      position: { x: 500, y: 0 },
      data: {
        nodeType: 'llm',
        title: 'llm',
        llmProvider: 'openai_compatible',
        llmModelId: 'gpt-4o',
        mode: 'chat',
        userInput: '',
        conversation: [],
        status: 'idle',
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ] as never,
  [
    { id: 'e-product-llm', source: 'analysis', sourceHandle: 'analysis_result_output', target: 'llm-product', targetHandle: 'text_input' },
  ] as never,
  ''
)
assertEqual(productAnalysisLLMInputs.connectedTextNodeCount, 1, 'llm counts connected product analysis as text input')
assertEqual(productAnalysisLLMInputs.inputText, '图片生成提示词：奶白色恒温杯置于办公桌上', 'llm reads analysis result from product analysis')

console.info('[image-model-system-test] all assertions passed')

import { describe, it, expect } from 'vitest'
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
import { extractLLMResponseContent } from '../llmApi.ts'
import { buildLLMPayload } from '../llmPayloadBuilder.ts'
import { parseImageGenerationResponse } from '../imageResponseParser.ts'
import { buildSingleImagePayload } from '../scheduler/imageGenerationQueue.ts'
import { formatAspectRatioLabel, normalizeAspectRatio, normalizeAspectRatioOptionValue } from '../sizeRegistry.ts'
import { migrateHistoryItems } from '../../history/historyMigration.ts'
import { getImageGenInputs, getLLMInputs, getProductAnalysisInputs } from '../../canvas/nodeInputResolvers.ts'
import { resolveGroupImageOutputs } from '../../canvas/groupImageOutputs.ts'
import { isConnectionAllowed } from '../../canvas/connectionRules.ts'
import {
  buildProductAnalysisPrompt,
  createDefaultProductAnalysisNodeData,
  formatProductAnalysisOutput,
  parseProductAnalysisStructuredOutput,
} from '../../canvas/productAnalysisPrompt.ts'
import { DEFAULT_LLM_MODEL_ID, normalizeLLMModelId } from '../llmModelRegistry.ts'
import type { CanvasNodeData } from '../../canvas/nodeTypes.ts'

const countBySeries = (series: 'G' | 'R' | 'C') => IMAGE_MODEL_REGISTRY.filter((model) => model.series === series).length

describe('Image Model System Tests', () => {
  it('should pass all model system tests', async () => {
const countBySeries = (series: 'G' | 'R' | 'C') => IMAGE_MODEL_REGISTRY.filter((model) => model.series === series).length

    expect(countBySeries('G')).toBe(8) // G series model count
    expect(countBySeries('R')).toBe(4) // R series model count
    expect(countBySeries('C')).toBe(5) // C series model count
    expect(getImageModelById('g-gpt-image-2')?.label).toBe('G 智能出图 V2') // G GPT label
    expect(getImageModelById('g-gpt-image-2')?.backendModel).toBe('A-gpt-image-2') // G GPT backendModel
    expect(getImageModelById('g-gpt-image-2-vip')).toBeTruthy() // G GPT VIP model exists
    expect(getImageModelById('g-gpt-image-2-vip')?.backendModel).toBe('A-gpt-image-2-vip') // G GPT VIP backendModel
    expect(getImageModelById('r-gpt-image-2')?.backendModel).toBe('R-gpt-image-2') // R GPT backendModel
    expect(getImageModelById('r-gpt-image-2-vip')?.backendModel).toBe('R-gpt-image-2-vip') // R VIP backendModel
    expect(getImageModelById('c-gpt-image-2-all')?.backendModel).toBe('C-gpt-image-2-all') // C all backendModel
    expect(getImageModelById('g-nano-banana-pro-vt')?.backendModel).toBe('G-nano-banana-pro-vt') // G Pro VT backendModel
    expect(getImageModelById('r-nano-banana-2')?.backendModel).toBe('R-nano-banana-2') // R Nano V2 backendModel
    expect(getImageModelById('g-nano-banana-fast')).toBeFalsy() // Deleted G Fast model must not exist
    expect(getImageModelById('r-nano-banana-pro-vip')).toBeFalsy() // Deleted R Pro VIP model must not exist
    expect(IMAGE_MODEL_REGISTRY.every((model) => model.supports4K)).toBeTruthy() // All image models must support 4K
    expect(IMAGE_MODEL_REGISTRY.every((model) => model.label && model.backendModel && model.engineType && model.sizeMode)).toBeTruthy() // All image models must have required fields

    const gpt2k = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2',
  prompt: 'test',
  aspectRatio: '16:9',
  resolution: '2K',
    })
    expect(gpt2k.model).toBe('A-gpt-image-2') // GPT 2K model
    expect(gpt2k.size).toBe('2048x1152') // GPT 16:9 2K fixed size
    expect(gpt2k.n).toBe(1) // GPT n

    const gptBatch4 = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2',
  prompt: 'test',
  aspectRatio: '1:1',
  resolution: '2K',
  batchSize: 4,
    })
    expect(gptBatch4.n).toBe(4) // GPT batchSize 4 maps to n=4
    expect(gptBatch4.size).toBe('2048x2048') // GPT 1:1 2K fixed size

    const gptQueuedSingle = buildSingleImagePayload(gptBatch4, 2)
    expect(gptQueuedSingle.n).toBe(1) // queued GPT task forces n=1
    expect(gptQueuedSingle.size).toBe('2048x2048') // queued GPT task keeps fixed size

    const gptBatch12 = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2',
  prompt: 'test',
  aspectRatio: '1:1',
  resolution: '2K',
  batchSize: 12,
    })
    expect(gptBatch12.n).toBe(12) // GPT batchSize 12 maps to n=12

    const gptBatch0 = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2',
  prompt: 'test',
  aspectRatio: '1:1',
  resolution: '2K',
  batchSize: 0,
    })
    expect(gptBatch0.n).toBe(1) // GPT batchSize 0 normalizes to 1

    const gptBatch99 = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2',
  prompt: 'test',
  aspectRatio: '1:1',
  resolution: '2K',
  batchSize: 99,
    })
    expect(gptBatch99.n).toBe(1) // GPT batchSize 99 normalizes to 1

    const gpt4k = buildImageGenerationPayload({
  modelId: 'r-gpt-image-2',
  prompt: 'test',
  aspectRatio: '16:9',
  resolution: '4K',
    })
    expect(gpt4k.model).toBe('R-gpt-image-2') // R GPT 4K model
    expect(gpt4k.size).toBe('3840x2160') // GPT 16:9 4K fixed size

    // ── G/R smart V2 + VIP fixed-size acceptance ──
    const gVip4k = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2-vip',
  prompt: 'test',
  aspectRatio: '16:9',
  resolution: '4K',
    })
    expect(gVip4k.model).toBe('A-gpt-image-2-vip') // G VIP 4K model
    expect(gVip4k.size).toBe('3840x2160') // G VIP 16:9 4K fixed size

    const rGpt2k = buildImageGenerationPayload({
  modelId: 'r-gpt-image-2',
  prompt: 'test',
  aspectRatio: '1:1',
  resolution: '2K',
    })
    expect(rGpt2k.model).toBe('R-gpt-image-2') // R GPT 2K model
    expect(rGpt2k.size).toBe('2048x2048') // R GPT 1:1 2K fixed size

    const rVip4k = buildImageGenerationPayload({
  modelId: 'r-gpt-image-2-vip',
  prompt: 'test',
  aspectRatio: '16:9',
  resolution: '4K',
    })
    expect(rVip4k.model).toBe('R-gpt-image-2-vip') // R VIP 4K model
    expect(rVip4k.size).toBe('3840x2160') // R VIP 16:9 4K fixed size

    const gpt34 = buildImageGenerationPayload({
  modelId: 'g-gpt-image-2',
  prompt: 'test',
  aspectRatio: '3:4',
  resolution: '2K',
    })
    expect(gpt34.size).toBe('1728x2304') // GPT 3:4 2K fixed size

    expect(formatAspectRatioLabel('auto')).toBe('Auto') // Auto label only
    expect(formatAspectRatioLabel('1:1')).toBe('1:1') // ratio label only
    expect(formatAspectRatioLabel('1:1 / 2048x2048')).toBe('1:1') // legacy ratio/size label normalizes
    expect(normalizeAspectRatioOptionValue('16:9 / 3840\u00d72160')).toBe('16:9') // legacy unicode multiply ratio normalizes
    expect(normalizeAspectRatioOptionValue('3:4 / 1728\u81032304')).toBe('3:4') // legacy mojibake ratio normalizes
    expect(normalizeAspectRatio('2048\u00d72048')).toBe('1:1') // legacy pixel size normalizes to ratio

    for (const forbiddenKey of ['aspect_ratio', 'image_size', 'imageSize', 'quality', 'return_full_resolution']) {
  expect(!(forbiddenKey in gpt2k), `GPT payload must not contain ${forbiddenKey}`)
  expect(!(forbiddenKey in gpt4k), `GPT payload must not contain ${forbiddenKey}`)
    }

    const nano4k = buildImageGenerationPayload({
  modelId: 'g-nano-banana-pro-vt',
  prompt: 'test',
  aspectRatio: '16:9',
  resolution: '2K',
  batchSize: 4,
    })
    expect(nano4k.model).toBe('G-nano-banana-pro-vt') // Nano model
    expect(nano4k.n).toBe(4) // Nano batchSize 4 maps to n=4
    const nanoQueuedSingle = buildSingleImagePayload(nano4k, 3)
    expect(nanoQueuedSingle.n).toBe(1) // queued Nano task forces n=1
    expect(nanoQueuedSingle.aspect_ratio).toBe('16:9') // queued Nano task keeps aspect_ratio
    expect(nano4k.aspect_ratio).toBe('16:9') // Nano aspect_ratio
    expect(nano4k.image_size).toBe('2K') // Nano image_size
    expect('size' in nano4k).toBeFalsy() // Nano payload must not send size by default
    expect('quality' in nano4k).toBeFalsy() // Nano payload must not send quality by default
    expect('resolution' in nano4k).toBeFalsy() // Nano payload must not send resolution by default
    expect('ratio' in nano4k).toBeFalsy() // Nano payload must not send ratio alias by default
    expect('imageSize' in nano4k).toBeFalsy() // Nano payload must not send imageSize alias by default
    expect('return_original' in nano4k).toBeFalsy() // Nano payload must not send return_original by default
    expect('return_full_resolution' in nano4k).toBeFalsy() // Nano payload must not send return_full_resolution by default
    expect(String(nano4k.model).endsWith('-4k') && !String(nano4k.model).endsWith('-2k')).toBeFalsy() // Nano model must not include resolution suffix

    // ── Backend model name normalization (strip -1k/-2k/-4k suffixes) ───────
    expect(normalizeBackendModelName('C-nano-banana-pro-2k')).toBe('C-nano-banana-pro') // strip -2k suffix
    expect(normalizeBackendModelName('G-nano-banana-pro-4k')).toBe('G-nano-banana-pro') // strip -4k suffix
    expect(normalizeBackendModelName('R-nano-banana-2-1k')).toBe('R-nano-banana-2') // strip -1k suffix
    expect(normalizeBackendModelName('c-nano-banana-pro-2K')).toBe('c-nano-banana-pro') // strip uppercase -2K suffix
    expect(normalizeBackendModelName('foo_4k')).toBe('foo') // strip underscore _4k suffix
    expect(normalizeBackendModelName('G-nano-banana-pro')).toBe('G-nano-banana-pro') // no suffix untouched
    expect(normalizeBackendModelName('g-nano-banana-2-cl')).toBe('g-nano-banana-2-cl') // body chars (-cl) not stripped

    // ── Legacy model migration (old project / history names → current registry) ──
    expect(resolveModelIdFromLegacy('C-nano-banana-pro-2k')).toBe('c-nano-banana-pro') // legacy C-pro-2k migration
    expect(resolveModelIdFromLegacy('G-nano-banana-pro-4k')).toBe('g-nano-banana-pro') // legacy G-pro-4k migration
    expect(getImageModelById(resolveModelIdFromLegacy('R-gpt-image-2'))?.backendModel).toBe('R-gpt-image-2') // legacy R-gpt-image-2 → R-gpt-image-2
    expect(getImageModelById(resolveModelIdFromLegacy('R-gpt-image-2-vip'))?.backendModel).toBe('R-gpt-image-2-vip') // legacy R-gpt-image-2-vip → R-gpt-image-2-vip
    expect(resolveModelIdFromLegacy('g 全能出图 fast')).toBe('g-nano-banana') // legacy G Fast → g-nano-banana
    expect(resolveModelIdFromLegacy('c全能出图 v2')).toBe('c-nano-banana-2') // legacy C 全能出图 v2 → c-nano-banana-2
    expect(resolveModelIdFromLegacy('deleted-model-xyz')).toBe('g-gpt-image-2') // unknown model falls back to default

    // No registry backend model carries a resolution suffix
    expect(IMAGE_MODEL_REGISTRY.every((m) => !/-[124]k$/i.test(m.backendModel))).toBeTruthy() // No registry backendModel has a resolution suffix

    const authHeaders = { Authorization: 'Bearer test' }
    const gptModel = getImageModelById('r-gpt-image-2-vip')
    expect(gptModel).toBeTruthy() // R VIP model exists
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
    expect(gptRoute.endpoint).toBe('https://relay.example/v1/images/generations') // GPT text endpoint
    expect(gptRoute.debugInfo.contentType).toBe('application/json') // GPT text content type
    expect(gptRoute.debugInfo.payloadKeys.join(','), 'model,n,prompt,size', 'GPT text payload keys must be clean')

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
    expect(gptEditRoute.endpoint).toBe('https://relay.example/v1/images/edits') // GPT image endpoint
    expect(gptEditRoute.debugInfo.contentType).toBe('multipart/form-data') // GPT image content type
    expect(gptEditRoute.debugInfo.payloadKeys.join(','), 'image,model,n,prompt,size', 'GPT image payload keys must be clean')

    const nanoModel = getImageModelById('g-nano-banana-pro-vt')
    expect(nanoModel).toBeTruthy() // Nano model exists
    const nanoRoute = await buildImageGenerationRequest({
  payload: nano4k,
  model: nanoModel,
  baseUrl: 'https://relay.example',
  authHeaders,
    })
    expect(nanoRoute.endpoint).toBe('https://relay.example/v1/images/generations') // Nano text endpoint
    expect(nanoRoute.debugInfo.contentType).toBe('application/json') // Nano text content type
    expect(String(nanoRoute.debugInfo.payloadKeys.includes('image_size'))).toBe('true') // Nano payload includes image_size
    expect(String(nanoRoute.debugInfo.payloadKeys.includes('size'))).toBe('false') // Nano payload must not include size by default

    const nanoRefRoute = await buildImageGenerationRequest({
  payload: { ...nano4k, images: [png1x1] },
  model: nanoModel,
  baseUrl: 'https://relay.example',
  authHeaders,
    })
    expect(nanoRefRoute.endpoint).toBe('https://relay.example/v1beta/models/G-nano-banana-pro-vt:generateContent') // Nano image endpoint
    expect(nanoRefRoute.debugInfo.payloadKeys.join(','), 'contents,generationConfig', 'Nano image payload follows Gemini-style PixelForge path')

    const parsedMultiUrl = parseImageGenerationResponse({ data: [{ url: 'https://example.com/a.png' }, { url: 'https://example.com/b.png' }] })
    expect(parsedMultiUrl.images.length).toBe(2) // parser data[] url count
    expect(parsedMultiUrl.imageUrl).toBe('https://example.com/a.png') // parser first url compatibility
    expect(parsedMultiUrl.matchedField).toBe('data[0].url') // parser data[0].url

    const parsedMultiBase64 = parseImageGenerationResponse({ data: [{ b64_json: 'a'.repeat(128) }, { b64_json: 'b'.repeat(128) }] })
    expect(parsedMultiBase64.images.length).toBe(2) // parser data[] b64 count
    expect(parsedMultiBase64.matchedField).toBe('data[0].b64_json') // parser data[0].b64_json
    expect(Boolean(parsedMultiBase64.dataUrl)).toBeTruthy() // parser first b64 compatibility

    expect(parseImageGenerationResponse({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'a'.repeat(128) } }] } }] }).matchedField, 'candidates[0].content.parts[0].inlineData', 'parser inlineData')
    expect(parseImageGenerationResponse({ output_url: 'https://example.com/out.png' }).matchedField).toBe('output_url') // parser output_url
    expect(parseImageGenerationResponse('![x](https://example.com/md.png)').matchedField).toBe('.markdown_image') // parser markdown image
    expect(parseImageGenerationResponse({ output_url: 'https://example.com/out.png' }).images.length).toBe(1) // parser single image wraps in images[]

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
    expect(migratedBatchHistory.length).toBe(3) // legacy aggregate history splits into single-image records
    expect(migratedBatchHistory[0].batchId).toBe('legacy_batch') // split history keeps shared batchId
    expect(migratedBatchHistory[0].batchIndex).toBe(1) // split history first index is 1-based
    expect(migratedBatchHistory[1].imageUrl).toBe('https://example.com/2.png') // split history second image is standalone
    expect(migratedBatchHistory[2].batchTotal).toBe(3) // split history stores batchTotal

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
    expect(sortedReferenceInputs.referenceImages.join(','), 'url-3,url-1,url-2', 'referenceImageOrder controls generation reference order')
    expect(sortedReferenceInputs.normalizedReferenceImageOrder.join(','), 'img3,img1,img2', 'new connected reference appends to normalized order')
    expect(sortedReferenceInputs.referenceImageNodes[0].label).toBe('图1') // reference labels follow current preview position

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
    expect(cleanedReferenceInputs.referenceImageNodes.length).toBe(1) // invalid connected image nodes do not enter preview items
    expect(cleanedReferenceInputs.normalizedReferenceImageOrder.join(','), 'valid', 'dirty referenceImageOrder keeps only valid connected image nodes')

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
    expect(
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
    expect(
  mixedGroupImageInputs.referenceImages.join(','),
  'url-before,url-group-left,url-group-right,url-group-gen-1,url-group-gen-2,url-after',
  'image_gen expands group image collections in edge order alongside normal images'
    )
    expect(
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
    expect(
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
    expect(productAnalysisData.analysisModel).toBe(DEFAULT_LLM_MODEL_ID) // product analysis uses the same default model as llm nodes
    expect(productAnalysisData.commerceStyle).toBe('domestic') // product analysis defaults to domestic commerce style
    expect(productAnalysisData.pageCount).toBe(5) // product analysis defaults to five pages
    expect(normalizeLLMModelId('legacy-missing-model')).toBe(DEFAULT_LLM_MODEL_ID) // unknown llm model ids fall back to the shared default
    const gptLLMPayload = buildLLMPayload({
  modelId: 'gpt-5-5',
  messages: [{ role: 'user', content: 'hello' }],
    })
    expect(gptLLMPayload.model).toBe('G-gpt-5.5') // GPT LLM backend model must use G-gpt-5.5
    const geminiLLMPayload = buildLLMPayload({
  modelId: 'gemini-3-1-pro',
  messages: [{ role: 'user', content: 'hello' }],
    })
    expect(geminiLLMPayload.model).toBe('G-gemini-3.1-pro') // Gemini LLM backend model must use G-gemini-3.1-pro
    expect(
  extractLLMResponseContent({ choices: [{ message: { content: [{ type: 'text', text: 'content parts text' }] } }] }),
  'content parts text',
  'llm parser reads OpenAI content parts arrays'
    )
    expect(
  extractLLMResponseContent({ choices: [{ text: 'legacy choice text' }] }),
  'legacy choice text',
  'llm parser reads choices[0].text fallback'
    )
    expect(
  extractLLMResponseContent({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'responses output text' }] }] }),
  'responses output text',
  'llm parser reads responses-style output content'
    )
    expect(
  extractLLMResponseContent({ candidates: [{ content: { parts: [{ text: 'gemini candidate text' }] } }] }),
  'gemini candidate text',
  'llm parser reads gemini candidate text'
    )
    const productAnalysisPrompt = buildProductAnalysisPrompt(productAnalysisData, '上游信息：支持一机多用')
    expect(productAnalysisPrompt.includes('你必须只返回一个 JSON 对象。')).toBeTruthy() // product analysis prompt requires json-only output
    expect(productAnalysisPrompt.includes('【电商风格】')).toBeTruthy() // product analysis prompt includes commerce style section
    expect(productAnalysisPrompt.includes('国内电商风格')).toBeTruthy() // product analysis prompt uses the default domestic commerce style
    expect(productAnalysisPrompt.includes('【页数】\n5')).toBeTruthy() // product analysis prompt includes default page count
    expect(productAnalysisPrompt.includes('上游信息：支持一机多用')).toBeTruthy() // product analysis prompt includes upstream text
    expect(productAnalysisPrompt.includes('产品名称：恒温杯')).toBeTruthy() // product analysis prompt includes product name
    expect(productAnalysisPrompt.includes('"pagePlan"')).toBeTruthy() // product analysis prompt asks for pagePlan json
    expect(productAnalysisPrompt.includes('"finalPrompt"')).toBeTruthy() // product analysis prompt asks for finalPrompt json

    const parsedProductAnalysis = parseProductAnalysisStructuredOutput(
  `<think>先分析，但这段应该被清理</think>
    \`\`\`json
    {
  "productName": "恒温杯",
  "productCategory": "智能家居",
  "material": "陶瓷内胆 / 恒温底座",
  "colorStyle": "奶白色 / 极简风",
  "coreFunction": "长时间保持饮品温热",
  "scene": "办公室、书房、床头",
  "targetAudience": "上班族、学生、夜间阅读人群",
  "pagePlan": ["主视觉核心卖点", "功能展示"],
  "finalPrompt": "奶白色恒温杯置于办公桌上，干净电商主图"
    }
    \`\`\``,
  5,
    )
    expect(parsedProductAnalysis.pagePlan.length).toBe(5) // product analysis parser pads pagePlan to selected page count
    expect(parsedProductAnalysis.productName).toBe('恒温杯') // product analysis parser extracts productName
    const formattedProductAnalysis = formatProductAnalysisOutput(parsedProductAnalysis, 5)
    expect(formattedProductAnalysis.includes('【产品卖点分析】')).toBeTruthy() // product analysis formatter includes title
    expect(formattedProductAnalysis.includes('【5页页面规划】')).toBeTruthy() // product analysis formatter includes selected page count
    expect(formattedProductAnalysis.includes('【图片生成提示词】')).toBeTruthy() // product analysis formatter includes image prompt section
    expect(
  isConnectionAllowed({
    sourceType: 'text',
    sourceHandle: 'prompt',
    targetType: 'product_analysis',
    targetHandle: 'product_info_input',
  }),
  'text output can connect to product analysis input'
    )
    expect(
  isConnectionAllowed({
    sourceType: 'llm',
    sourceHandle: 'llm_output',
    targetType: 'product_analysis',
    targetHandle: 'product_info_input',
  }),
  'llm output can connect to product analysis input'
    )
    expect(
  isConnectionAllowed({
    sourceType: 'image_asset',
    sourceHandle: 'image_output',
    targetType: 'product_analysis',
    targetHandle: 'image_input',
  }),
  'image output can connect to product analysis image input'
    )
    expect(
  isConnectionAllowed({
    sourceType: 'product_analysis',
    sourceHandle: 'analysis_result_output',
    targetType: 'llm',
    targetHandle: 'text_input',
  }),
  'product analysis result output can connect to llm text input'
    )
    expect(
  isConnectionAllowed({
    sourceType: 'product_analysis',
    sourceHandle: 'analysis_result_output',
    targetType: 'text',
    targetHandle: 'llm_input',
  }),
  'product analysis result output can connect to text input'
    )
    expect(
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
    expect(productAnalysisInputs.connectedInputTextNodeCount).toBe(2) // product analysis counts connected upstream text inputs
    expect(productAnalysisInputs.connectedInputImageNodeCount).toBe(1) // product analysis counts connected upstream image inputs
    expect(productAnalysisInputs.imageInputs.join(','), 'url-product-image', 'product analysis reads connected image node input')
    expect(productAnalysisInputs.inputText.includes('补充说明：适合送礼')).toBeTruthy() // product analysis reads text node input
    expect(productAnalysisInputs.inputText.includes('竞品洞察：强调恒温稳定')).toBeTruthy() // product analysis reads llm node output
    expect(productAnalysisInputs.connectedOutputTextNodeIds.join(','), 'analysis-output-text', 'product analysis detects downstream text nodes')

    const productAnalysisLLMInputs = getLLMInputs(
  'llm-product',
  [
    {
      id: 'analysis',
      type: 'product_analysis',
      position: { x: 0, y: 0 },
      data: {
        ...productAnalysisData,
        structuredOutput: parsedProductAnalysis,
        analysisResult: '旧版分析结果不应优先输出',
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
    expect(productAnalysisLLMInputs.connectedTextNodeCount).toBe(1) // llm counts connected product analysis as text input
    expect(productAnalysisLLMInputs.inputText).toBe(formattedProductAnalysis) // llm reads formatted structured output from product analysis

    console.info('[image-model-system-test] all assertions passed')

  })
})

console.info('[image-model-system-test] all assertions passed')

import type { Node, Edge, Viewport } from '@xyflow/react'
import type { CanvasNodeData, HistoryRecord } from '../canvas/nodeTypes'
import { useNodeStore } from '../store/nodeStore'
import { useEdgeStore } from '../store/edgeStore'
import { useHistoryStore } from '../store/historyStore'
import { useProjectStore } from '../store/projectStore'
import { useCanvasStore } from '../store/canvasStore'
import { useUIStore } from '../store/uiStore'
import { normalizeCanvasEdge } from '../store/edgeStore'
import { getImageModelById, normalizeImageGenSelection } from '../generation/imageModelRegistry'
import { migrateEdges } from '../canvas/connectionNormalizer'
import { createDefaultProductAnalysisNodeData } from '../canvas/productAnalysisPrompt'
import { db } from './db'
import type { ProjectData } from '../store/projectStore'

const DEPRECATED_NODE_TYPES = new Set(['prompt_merge', 'camera_control'])

export function serializeProject(): ProjectData {
  const project = useProjectStore.getState().currentProject
  const nodes = useNodeStore.getState().nodes
  const edges = useEdgeStore.getState().edges
  const history = useHistoryStore.getState().records
  const viewport = useCanvasStore.getState().viewport

  return {
    id: project?.id ?? 'proj_default',
    name: project?.name ?? '未命名项目',
    createdAt: project?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    viewport,
    nodes,
    edges,
    history,
  }
}

export function deserializeProject(data: ProjectData): void {
  // Normalize image-gen/result-image nodes and migrate legacy model ids/backend names.
  const filteredNodes = data.nodes.filter((node) => {
    const nodeType = (node.data as { nodeType?: string }).nodeType
    return !nodeType || !DEPRECATED_NODE_TYPES.has(nodeType)
  })
  const validNodeIds = new Set(filteredNodes.map((node) => node.id))
  const filteredEdges = data.edges.filter((edge) => validNodeIds.has(edge.source) && validNodeIds.has(edge.target))

  const normalizedNodes = filteredNodes.map((node): Node<CanvasNodeData> => {
    const d = node.data as Record<string, unknown>
    if (d.nodeType === 'product_brief') {
      const defaults = createDefaultProductAnalysisNodeData()
      return {
        ...node,
        type: 'product_analysis',
        data: {
          ...defaults,
          productName: typeof d.productName === 'string' ? d.productName : '',
          productCategory: typeof d.productCategory === 'string' ? d.productCategory : '',
          material: typeof d.material === 'string' ? d.material : '',
          colorStyle: typeof d.colorStyle === 'string' ? d.colorStyle : '',
          coreFunction: typeof d.coreFunction === 'string' ? d.coreFunction : '',
          scene: typeof d.scene === 'string' ? d.scene : '',
          targetAudience: typeof d.targetAudience === 'string' ? d.targetAudience : '',
          outputRequirement: typeof d.outputRequirement === 'string' ? d.outputRequirement : '',
          generatedPrompt: typeof d.generatedPrompt === 'string' ? d.generatedPrompt : '',
          updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
        } as CanvasNodeData,
      }
    }
    if (d.nodeType === 'product_analysis') {
      const defaults = createDefaultProductAnalysisNodeData()
      return {
        ...node,
        type: 'product_analysis',
        data: {
          ...defaults,
          ...node.data,
          nodeType: 'product_analysis',
          title: typeof d.title === 'string' && d.title ? d.title : defaults.title,
          analysisModel: typeof d.analysisModel === 'string' && d.analysisModel ? d.analysisModel : defaults.analysisModel,
          inputText: typeof d.inputText === 'string' ? d.inputText : '',
          generatedPrompt: typeof d.generatedPrompt === 'string' ? d.generatedPrompt : '',
          analysisResult: typeof d.analysisResult === 'string' ? d.analysisResult : '',
          isRunning: false,
          error: typeof d.error === 'string' ? d.error : '',
          updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
        } as CanvasNodeData,
      }
    }
    if (d.nodeType === 'image_gen' || d.nodeType === 'result_image') {
      const selection = normalizeImageGenSelection(d)
      const model = getImageModelById(selection.modelId)
      return {
        ...node,
        data: {
          ...node.data,
          modelSeries: selection.modelSeries,
          modelId: selection.modelId,
          modelLabel: model?.label,
          backendModel: model?.backendModel,
          engineType: model?.engineType,
          sizeMode: model?.sizeMode,
          aspectRatio: selection.aspectRatio,
          resolution: selection.resolution,
        } as CanvasNodeData,
      }
    }
    return node
  })

  const normalizedHistory = (data.history ?? []).map((rec: HistoryRecord) => {
    if ((rec.type || (rec.videoUrl ? 'video' : 'image')) !== 'image') {
      return { ...rec, type: rec.type || 'video' as const }
    }

    const selection = normalizeImageGenSelection(rec as unknown as Record<string, unknown>)
    const model = getImageModelById(selection.modelId)

    return {
      ...rec,
      type: 'image' as const,
      modelSeries: selection.modelSeries,
      modelId: selection.modelId,
      modelLabel: model?.label ?? rec.modelLabel,
      backendModel: model?.backendModel ?? rec.backendModel,
      engineType: model?.engineType ?? rec.engineType,
      sizeMode: model?.sizeMode ?? rec.sizeMode,
      aspectRatio: selection.aspectRatio,
      resolution: selection.resolution,
      finalSize: rec.finalSize,
    }
  })

  useNodeStore.getState().setNodes(normalizedNodes)
  // Migrate edges with main_input/main_output to real business handles
  const migratedEdges = migrateEdges(filteredEdges, normalizedNodes as Node<CanvasNodeData>[])
  useEdgeStore.getState().setEdges(migratedEdges.map(normalizeCanvasEdge))
  useHistoryStore.getState().setRecords(normalizedHistory)
  useCanvasStore.getState().setViewport(data.viewport)
  useUIStore.getState().setViewportZoom(data.viewport?.zoom ?? 1)
  useProjectStore.getState().loadProject(data)
}

export async function saveProject(): Promise<void> {
  const data = serializeProject()
  await db.projects.put({
    id: data.id,
    name: data.name,
    data: JSON.stringify(data),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  })
  useProjectStore.getState().markSaved()
}

export async function loadProject(id: string): Promise<ProjectData | null> {
  const row = await db.projects.get(id)
  if (!row) return null
  return JSON.parse(row.data) as ProjectData
}

export async function loadLatestProject(): Promise<ProjectData | null> {
  const row = await db.projects.orderBy('updatedAt').last()
  if (!row) return null
  return JSON.parse(row.data) as ProjectData
}

export function exportProjectJSON(): string {
  const data = serializeProject()
  return JSON.stringify(data, null, 2)
}

export function importProjectJSON(json: string): void {
  const data = JSON.parse(json) as ProjectData
  deserializeProject(data)
}

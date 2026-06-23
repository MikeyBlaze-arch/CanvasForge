import { create } from 'zustand'
import type { Locale } from '../i18n/types'

type RightPanelTab = 'inspector' | 'history' | 'queue' | 'project'
export type EdgeStyle = 'bezier' | 'straight' | 'step'
export type ThemeMode = 'dark' | 'light'
export type RightPanelType = 'history' | 'imageGenDebug' | 'workflowTemplates' | 'inspector' | null

export type PendingGroupDialog =
  | {
      open: true
      mode: 'empty'
      position: { x: number; y: number }
    }
  | {
      open: true
      mode: 'selection'
      nodeIds: string[]
      bounds: { minX: number; minY: number; maxX: number; maxY: number }
    }
  | { open: false }

const savedLocale = (typeof localStorage !== 'undefined'
  ? localStorage.getItem('canvasforge_locale')
  : null) as Locale | null
const savedEdgeStyle = (typeof localStorage !== 'undefined'
  ? localStorage.getItem('canvasforge_edge_style')
  : null) as EdgeStyle | null
const savedEdgeCurvature = typeof localStorage !== 'undefined'
  ? Number(localStorage.getItem('canvasforge_edge_curvature'))
  : Number.NaN
const savedThemeMode = (typeof localStorage !== 'undefined'
  ? localStorage.getItem('canvasforge_theme_mode')
  : null) as ThemeMode | null

function resolveThemeMode(mode: ThemeMode | null): ThemeMode {
  return mode === 'light' ? 'light' : 'dark'
}

function applyThemeMode(mode: ThemeMode) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = mode
  }
}

const initialThemeMode = resolveThemeMode(savedThemeMode)
applyThemeMode(initialThemeMode)

interface UIState {
  viewportZoom: number
  setViewportZoom: (zoom: number) => void
  activeRightPanel: RightPanelType
  setActiveRightPanel: (panel: RightPanelType) => void
  toggleRightPanel: (panel: Exclude<RightPanelType, null>) => void
  closeRightPanel: () => void
  rightPanelTab: RightPanelTab
  contextMenu: {
    visible: boolean
    x: number
    y: number
    nodeId?: string
    nodeType?: string
  }
  addNodeMenuOpen: boolean
  addNodeMenuPosition?: { x: number; y: number }
  addNodeMenuFlowPosition?: { x: number; y: number }
  gridVisible: boolean
  locale: Locale
  edgeStyle: EdgeStyle
  edgeCurvature: number
  themeMode: ThemeMode
  setRightPanelTab: (tab: RightPanelTab) => void
  showContextMenu: (x: number, y: number, nodeId?: string, nodeType?: string) => void
  hideContextMenu: () => void
  toggleAddNodeMenu: () => void
  setAddNodeMenuOpen: (open: boolean) => void
  showAddNodeMenuAt: (screen: { x: number; y: number }, flow: { x: number; y: number }) => void
  toggleInspector: () => void
  setInspectorOpen: (open: boolean) => void
  toggleHistory: () => void
  setHistoryOpen: (open: boolean) => void
  toggleDebugPanel: () => void
  setDebugPanelOpen: (open: boolean) => void
  toggleTemplateLibrary: () => void
  setTemplateLibraryOpen: (open: boolean) => void
  toggleGrid: () => void
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
  setEdgeStyle: (style: EdgeStyle) => void
  setEdgeCurvature: (curvature: number) => void
  setThemeMode: (mode: ThemeMode) => void
  toggleThemeMode: () => void
  pendingGroupDialog: PendingGroupDialog
  openGroupDialog: (dialog: Exclude<PendingGroupDialog, { open: false }>) => void
  closeGroupDialog: () => void
}

export const useUIStore = create<UIState>((set) => ({
  viewportZoom: 1,
  setViewportZoom: (viewportZoom) => set({ viewportZoom }),
  activeRightPanel: null,
  setActiveRightPanel: (panel) => set({ activeRightPanel: panel }),
  toggleRightPanel: (panel) =>
    set((state) => ({
      activeRightPanel: state.activeRightPanel === panel ? null : panel,
    })),
  closeRightPanel: () => set({ activeRightPanel: null }),
  rightPanelTab: 'inspector',
  contextMenu: { visible: false, x: 0, y: 0 },
  addNodeMenuOpen: false,
  addNodeMenuPosition: undefined,
  addNodeMenuFlowPosition: undefined,
  gridVisible: true,
  locale: savedLocale === 'en-US' ? 'en-US' : 'zh-CN',
  edgeStyle: savedEdgeStyle === 'straight' || savedEdgeStyle === 'step' ? savedEdgeStyle : 'bezier',
  edgeCurvature: Number.isFinite(savedEdgeCurvature)
    ? Math.min(1, Math.max(0, savedEdgeCurvature))
    : 0.35,
  themeMode: initialThemeMode,
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  showContextMenu: (x, y, nodeId, nodeType) =>
    set({ contextMenu: { visible: true, x, y, nodeId, nodeType } }),
  hideContextMenu: () =>
    set({ contextMenu: { visible: false, x: 0, y: 0, nodeId: undefined, nodeType: undefined } }),
  toggleAddNodeMenu: () => set((s) => ({
    addNodeMenuOpen: !s.addNodeMenuOpen,
    addNodeMenuPosition: undefined,
    addNodeMenuFlowPosition: undefined,
  })),
  setAddNodeMenuOpen: (open) => set((s) => ({
    addNodeMenuOpen: open,
    addNodeMenuPosition: open ? s.addNodeMenuPosition : undefined,
    addNodeMenuFlowPosition: open ? s.addNodeMenuFlowPosition : undefined,
  })),
  showAddNodeMenuAt: (screen, flow) => set({
    addNodeMenuOpen: true,
    addNodeMenuPosition: screen,
    addNodeMenuFlowPosition: flow,
  }),
  toggleInspector: () => set((s) => {
    const next = s.activeRightPanel !== 'inspector'
    return { activeRightPanel: next ? 'inspector' : null }
  }),
  setInspectorOpen: (open) => set({ activeRightPanel: open ? 'inspector' : null }),
  toggleHistory: () => set((s) => {
    const next = s.activeRightPanel !== 'history'
    return { activeRightPanel: next ? 'history' : null }
  }),
  setHistoryOpen: (open) => set({ activeRightPanel: open ? 'history' : null }),
  toggleDebugPanel: () => set((s) => {
    const next = s.activeRightPanel !== 'imageGenDebug'
    return { activeRightPanel: next ? 'imageGenDebug' : null }
  }),
  setDebugPanelOpen: (open) => set({ activeRightPanel: open ? 'imageGenDebug' : null }),
  toggleTemplateLibrary: () => set((s) => {
    const next = s.activeRightPanel !== 'workflowTemplates'
    return { activeRightPanel: next ? 'workflowTemplates' : null }
  }),
  setTemplateLibraryOpen: (open) => set({ activeRightPanel: open ? 'workflowTemplates' : null }),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  setLocale: (locale) => {
    localStorage.setItem('canvasforge_locale', locale)
    set({ locale })
  },
  toggleLocale: () => set((s) => {
    const next = s.locale === 'zh-CN' ? 'en-US' : 'zh-CN'
    localStorage.setItem('canvasforge_locale', next)
    return { locale: next }
  }),
  setEdgeStyle: (edgeStyle) => {
    localStorage.setItem('canvasforge_edge_style', edgeStyle)
    set({ edgeStyle })
  },
  setEdgeCurvature: (curvature) => {
    const edgeCurvature = Math.min(1, Math.max(0, curvature))
    localStorage.setItem('canvasforge_edge_curvature', String(edgeCurvature))
    set({ edgeCurvature })
  },
  setThemeMode: (themeMode) => {
    localStorage.setItem('canvasforge_theme_mode', themeMode)
    applyThemeMode(themeMode)
    set({ themeMode })
  },
  toggleThemeMode: () => set((s) => {
    const themeMode = s.themeMode === 'dark' ? 'light' : 'dark'
    localStorage.setItem('canvasforge_theme_mode', themeMode)
    applyThemeMode(themeMode)
    return { themeMode }
  }),
  pendingGroupDialog: { open: false },
  openGroupDialog: (dialog) => set({ pendingGroupDialog: dialog }),
  closeGroupDialog: () => set({ pendingGroupDialog: { open: false } }),
}))

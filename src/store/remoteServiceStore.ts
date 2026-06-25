import { create } from 'zustand'
import type { ServiceStatusSnapshot } from '../services/zealmanClient'

const LS_KEY_ZEALMAN_URL = 'canvasforge.zealman.baseUrl'
const LS_KEY_AUTODL_HOST = 'canvasforge.autodl.host'
const LS_KEY_AUTODL_TOKEN = 'canvasforge.autodl.token'
const LS_KEY_AUTODL_UUID = 'canvasforge.autodl.instanceUuid'
const LS_KEY_AUTODL_START_CMD = 'canvasforge.autodl.startCommand'
const LS_KEY_AUTODL_USE_TURBO = 'canvasforge.autodl.useNetworkTurbo'
const LS_KEY_AUTO_START_COMFY = 'canvasforge.motion.autoStartComfy'

function readLS(key: string, fallback: string): string {
  try { const v = localStorage.getItem(key); return v !== null ? v : fallback } catch { return fallback }
}
function writeLS(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export interface RemoteServiceState {
  // Zealman
  zealmanBaseUrl: string
  setZealmanBaseUrl: (url: string) => void

  // AutoDL
  autodlHost: string
  autodlToken: string
  autodlInstanceUuid: string
  autodlStartCommand: string
  autodlUseNetworkTurbo: boolean

  setAutodlHost: (v: string) => void
  setAutodlToken: (v: string) => void
  setAutodlInstanceUuid: (v: string) => void
  setAutodlStartCommand: (v: string) => void
  setAutodlUseNetworkTurbo: (v: boolean) => void

  // Auto-start ComfyUI before generation
  autoStartComfy: boolean
  setAutoStartComfy: (v: boolean) => void

  // Cached service status (for UI display)
  serviceStatus: ServiceStatusSnapshot | null
  setServiceStatus: (s: ServiceStatusSnapshot | null) => void

  // Save all AutoDL settings at once
  saveAutodlSettings: (patch: {
    host?: string; token?: string; instanceUuid?: string
    startCommand?: string; useNetworkTurbo?: boolean
  }) => void
}

export const useRemoteServiceStore = create<RemoteServiceState>((set) => ({
  zealmanBaseUrl: readLS(LS_KEY_ZEALMAN_URL, ''),
  setZealmanBaseUrl: (url) => {
    const normalized = url.trim().replace(/\/+$/, '')
    writeLS(LS_KEY_ZEALMAN_URL, normalized)
    set({ zealmanBaseUrl: normalized })
  },

  autodlHost: readLS(LS_KEY_AUTODL_HOST, 'https://www.autodl.art'),
  autodlToken: readLS(LS_KEY_AUTODL_TOKEN, ''),
  autodlInstanceUuid: readLS(LS_KEY_AUTODL_UUID, ''),
  autodlStartCommand: readLS(LS_KEY_AUTODL_START_CMD, 'bash /path/to/your-startup-script.sh'),
  autodlUseNetworkTurbo: readLS(LS_KEY_AUTODL_USE_TURBO, 'true') === 'true',

  setAutodlHost: (v) => { writeLS(LS_KEY_AUTODL_HOST, v); set({ autodlHost: v }) },
  setAutodlToken: (v) => { writeLS(LS_KEY_AUTODL_TOKEN, v); set({ autodlToken: v }) },
  setAutodlInstanceUuid: (v) => { writeLS(LS_KEY_AUTODL_UUID, v); set({ autodlInstanceUuid: v }) },
  setAutodlStartCommand: (v) => { writeLS(LS_KEY_AUTODL_START_CMD, v); set({ autodlStartCommand: v }) },
  setAutodlUseNetworkTurbo: (v) => { writeLS(LS_KEY_AUTODL_USE_TURBO, String(v)); set({ autodlUseNetworkTurbo: v }) },

  autoStartComfy: readLS(LS_KEY_AUTO_START_COMFY, 'true') === 'true',
  setAutoStartComfy: (v) => { writeLS(LS_KEY_AUTO_START_COMFY, String(v)); set({ autoStartComfy: v }) },

  serviceStatus: null,
  setServiceStatus: (s) => set({ serviceStatus: s }),

  saveAutodlSettings: (patch) => {
    const state: Partial<RemoteServiceState> = {}
    if (patch.host !== undefined) { writeLS(LS_KEY_AUTODL_HOST, patch.host); state.autodlHost = patch.host }
    if (patch.token !== undefined) { writeLS(LS_KEY_AUTODL_TOKEN, patch.token); state.autodlToken = patch.token }
    if (patch.instanceUuid !== undefined) { writeLS(LS_KEY_AUTODL_UUID, patch.instanceUuid); state.autodlInstanceUuid = patch.instanceUuid }
    if (patch.startCommand !== undefined) { writeLS(LS_KEY_AUTODL_START_CMD, patch.startCommand); state.autodlStartCommand = patch.startCommand }
    if (patch.useNetworkTurbo !== undefined) { writeLS(LS_KEY_AUTODL_USE_TURBO, String(patch.useNetworkTurbo)); state.autodlUseNetworkTurbo = patch.useNetworkTurbo }
    set(state)
  },
}))

/** Get zealman base URL from store (for non-React code). */
export function getZealmanBaseUrlFromStore(): string {
  return useRemoteServiceStore.getState().zealmanBaseUrl
}

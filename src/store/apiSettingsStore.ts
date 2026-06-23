import { create } from 'zustand'

// ── Constants ────────────────────────────────────────────────────────────

const LS_KEY_BASE_URL = 'canvasforge.api.baseUrl'
const LS_KEY_API_KEY = 'canvasforge.api.apiKey'
const LS_KEY_AVAILABLE_MODELS = 'canvasforge.api.availableModels'

/**
 * Default API base URL — derived from the page origin so the app talks to
 * whatever host/IP it was served from (e.g. http://123.56.42.223).
 * Falls back to an empty string in non-browser contexts (SSR/tests).
 */
function resolveDefaultApiBaseUrl(): string {
  const envUrl = normalizeBaseUrl(import.meta.env?.VITE_API_BASE_URL || '')
  if (isValidBaseUrl(envUrl)) {
    return envUrl
  }

  if (
    typeof window !== 'undefined'
    && window.location?.origin
    && /^https?:\/\//i.test(window.location.origin)
  ) {
    return normalizeBaseUrl(window.location.origin)
  }
  return ''
}

export const DEFAULT_API_BASE_URL = resolveDefaultApiBaseUrl()

// ── Helpers ──────────────────────────────────────────────────────────────

/** Strip trailing slashes and whitespace. */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/** Validate URL starts with http:// or https:// */
export function isValidBaseUrl(url: string): boolean {
  const trimmed = url.trim()
  return /^https?:\/\/.+/.test(trimmed)
}

// ── Safe localStorage read ───────────────────────────────────────────────

function readLS(key: string, fallback: string): string {
  try {
    const v = localStorage.getItem(key)
    return v !== null ? v : fallback
  } catch {
    return fallback
  }
}

function writeLS(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // localStorage unavailable (SSR, privacy mode, etc.)
  }
}

function removeLS(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

// ── Model registry version & cache invalidation ──────────────────────────

/**
 * Bumped whenever the model registry changes meaningfully. When the cached
 * version differs from this value, the stale `availableModels` cache is wiped
 * automatically on startup — users never have to clear localStorage by hand
 * after an update (important for packaged installer users).
 */
export const MODEL_REGISTRY_VERSION = 'canvasforge-model-registry-2026-06-v4'

const LS_KEY_AVAILABLE_MODELS_VERSION = 'canvasforge.api.availableModels.version'
const LS_KEY_AVAILABLE_MODELS_UPDATED_AT = 'canvasforge.api.availableModels.updatedAt'

/** Read the cached available-model list safely (never throws). */
function readAvailableModelsCache(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY_AVAILABLE_MODELS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((m) => typeof m === 'string') : []
  } catch {
    return []
  }
}

/** Persist the model list together with the current registry version + timestamp. */
function saveAvailableModelsCache(models: string[]): void {
  writeLS(LS_KEY_AVAILABLE_MODELS, JSON.stringify(models))
  writeLS(LS_KEY_AVAILABLE_MODELS_VERSION, MODEL_REGISTRY_VERSION)
  writeLS(LS_KEY_AVAILABLE_MODELS_UPDATED_AT, String(Date.now()))
}

/**
 * Wipe the stale `availableModels` cache when the model registry version no
 * longer matches. Runs on startup (store init) and before every fetch. Safe in
 * non-browser / SSR contexts.
 */
export function invalidateAvailableModelsCacheIfNeeded(): void {
  if (typeof window === 'undefined') return
  const cachedVersion = readLS(LS_KEY_AVAILABLE_MODELS_VERSION, '')
  if (cachedVersion !== MODEL_REGISTRY_VERSION) {
    removeLS(LS_KEY_AVAILABLE_MODELS)
    removeLS(LS_KEY_AVAILABLE_MODELS_UPDATED_AT)
    writeLS(LS_KEY_AVAILABLE_MODELS_VERSION, MODEL_REGISTRY_VERSION)
  }
}

// ── Store ────────────────────────────────────────────────────────────────

interface ApiSettingsState {
  apiKey: string
  baseUrl: string
  isSettingsOpen: boolean
  availableModels: string[]

  openSettings: () => void
  closeSettings: () => void

  /** Persist current apiKey + baseUrl to localStorage. */
  saveSettings: (apiKey: string, baseUrl: string) => void

  /** Persist available model IDs after test connection. */
  setAvailableModels: (models: string[]) => void

  /** Reset baseUrl to default (does NOT clear apiKey unless explicit). */
  resetBaseUrl: () => void

  /** Reset everything to defaults. */
  resetAll: () => void
}

export const useApiSettingsStore = create<ApiSettingsState>((set) => {
  // Drop a stale availableModels cache first (version mismatch), then read the
  // (now possibly empty) initial value. This runs at store creation = app start.
  invalidateAvailableModelsCacheIfNeeded()

  // Load initial values from localStorage on store creation
  const initialBaseUrl = normalizeBaseUrl(readLS(LS_KEY_BASE_URL, DEFAULT_API_BASE_URL))
  const initialApiKey = readLS(LS_KEY_API_KEY, '')
  const initialAvailableModels = readAvailableModelsCache()

  return {
    apiKey: initialApiKey,
    baseUrl: initialBaseUrl,
    isSettingsOpen: false,
    availableModels: initialAvailableModels,

    openSettings: () => set({ isSettingsOpen: true }),
    closeSettings: () => set({ isSettingsOpen: false }),

    saveSettings: (apiKey, baseUrl) => {
      const normalized = normalizeBaseUrl(baseUrl)
      writeLS(LS_KEY_API_KEY, apiKey)
      writeLS(LS_KEY_BASE_URL, normalized)
      set({ apiKey, baseUrl: normalized })
    },

    setAvailableModels: (models) => {
      // Persist list + current registry version + timestamp in one place.
      saveAvailableModelsCache(models)
      set({ availableModels: models })
    },

    resetBaseUrl: () => {
      writeLS(LS_KEY_BASE_URL, DEFAULT_API_BASE_URL)
      set({ baseUrl: DEFAULT_API_BASE_URL })
    },

    resetAll: () => {
      removeLS(LS_KEY_API_KEY)
      writeLS(LS_KEY_BASE_URL, DEFAULT_API_BASE_URL)
      set({ apiKey: '', baseUrl: DEFAULT_API_BASE_URL })
    },
  }
})

// ── Convenience getters (for non-React code like API clients) ────────────

/** Get the current API base URL (for fetch calls outside React). */
export function getApiBaseUrl(): string {
  return useApiSettingsStore.getState().baseUrl
}

/** Build a full API URL and reject file:// or missing bases in desktop builds. */
export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path

  const baseUrl = getApiBaseUrl()
  if (!isValidBaseUrl(baseUrl)) {
    throw new Error('MISSING_API_BASE_URL')
  }

  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

/** Get the current API key (may be empty string). */
export function getApiKey(): string {
  return useApiSettingsStore.getState().apiKey
}

/** Build full API URL for image generation. */
export function getImageApiUrl(): string {
  return resolveApiUrl('/v1/images/generations')
}

/** Build full API URL for LLM chat completions. */
export function getLlmApiUrl(): string {
  return resolveApiUrl('/v1/chat/completions')
}

/** Build Authorization headers object (empty if no key set). */
export function getAuthHeaders(): Record<string, string> {
  const key = getApiKey()
  if (!key) return {}
  return { Authorization: `Bearer ${key}` }
}

/** Get available model IDs (for pre-generation validation). */
export function getAvailableModels(): string[] {
  return useApiSettingsStore.getState().availableModels
}

// ── /v1/models fetching & soft availability check ────────────────────────

/** Parse a `/v1/models` response body into a list of model id strings. */
export function parseModelIds(body: unknown): string[] {
  if (!body || typeof body !== 'object') return []
  const obj = body as Record<string, unknown>
  const collect = (arr: unknown): string[] => {
    const ids: string[] = []
    if (!Array.isArray(arr)) return ids
    for (const item of arr) {
      if (typeof item === 'string') {
        ids.push(item)
      } else if (item && typeof item === 'object') {
        const id = (item as Record<string, unknown>).id
        if (typeof id === 'string') ids.push(id)
      }
    }
    return ids
  }
  if (Array.isArray(obj.data)) return collect(obj.data)
  if (Array.isArray(obj.models)) return collect(obj.models)
  if (Array.isArray(body)) return collect(body)
  return []
}

export interface FetchAvailableModelsOptions {
  /** Skip the cache and hit `/v1/models` directly (used by Test Connection). */
  forceRefresh?: boolean
  /** Override the saved base URL (e.g. unsaved form value during a test). */
  baseUrl?: string
  /** Override the saved API key (e.g. unsaved form value during a test). */
  apiKey?: string
}

// Auto-refresh (cache miss) is attempted at most once per session so that a
// relay which doesn't implement `/v1/models` can't stall every generation.
let autoFetchAttempted = false

/**
 * Fetch the available model list from `/v1/models`. Returns the cache unless
 * `forceRefresh` is set. A cache miss triggers a single auto-refresh per
 * session. Always throws on a real failure so callers (e.g. Test Connection)
 * can surface it; generation logic wraps this in a soft check that never lets
 * the failure block the real request.
 */
export async function fetchAvailableModels(options: FetchAvailableModelsOptions = {}): Promise<string[]> {
  invalidateAvailableModelsCacheIfNeeded()

  if (!options.forceRefresh) {
    const cached = readAvailableModelsCache()
    if (cached.length > 0) return cached
    if (autoFetchAttempted) return []
  }
  autoFetchAttempted = true

  const base = normalizeBaseUrl(options.baseUrl ?? getApiBaseUrl())
  if (!isValidBaseUrl(base)) {
    throw new Error('MISSING_API_BASE_URL')
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = options.apiKey ?? getApiKey()
  if (key) headers.Authorization = `Bearer ${key}`

  const resp = await fetch(`${base}/v1/models`, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(8000),
  })
  if (!resp.ok) {
    throw new Error(`[/v1/models ${resp.status}] ${resp.statusText}`)
  }

  const ids = parseModelIds(await resp.json())
  // Overwrite the cache with the freshly confirmed list + stamp the version.
  useApiSettingsStore.getState().setAvailableModels(ids)
  return ids
}

export type ModelAvailabilityStatus = 'supported' | 'not_listed' | 'unknown'

export interface ModelAvailability {
  status: ModelAvailabilityStatus
  availableModels?: string[]
}

/**
 * Soft pre-generation model check. NEVER blocks generation:
 * - `supported`    → model is in the relay list
 * - `not_listed`   → model not in the list → warning only, request still sent
 * - `unknown`      → list empty or `/v1/models` failed → proceed regardless
 * Only the real generation response decides success/failure.
 */
export async function checkModelAvailabilitySoft(model: string): Promise<ModelAvailability> {
  const normalized = String(model || '').trim().toLowerCase()
  if (!normalized) return { status: 'unknown' }
  try {
    const models = await fetchAvailableModels()
    if (!models || models.length === 0) return { status: 'unknown' }
    if (models.some((m) => String(m).toLowerCase() === normalized)) {
      return { status: 'supported' }
    }
    return { status: 'not_listed', availableModels: models }
  } catch {
    return { status: 'unknown' }
  }
}

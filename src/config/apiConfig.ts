/**
 * API configuration — now delegates to apiSettingsStore for dynamic
 * baseURL and apiKey.  Kept for backward-compat with any importers.
 */

import {
  getImageApiUrl,
  getLlmApiUrl,
  getApiBaseUrl,
  getApiKey,
  getAuthHeaders,
  DEFAULT_API_BASE_URL,
} from '../store/apiSettingsStore'

export {
  getImageApiUrl,
  getLlmApiUrl,
  getApiBaseUrl,
  getApiKey,
  getAuthHeaders,
  DEFAULT_API_BASE_URL,
}

/** Legacy compat — prefer getImageApiUrl() directly. */
export const API_CONFIG = {
  get imageApiBaseUrl() { return getApiBaseUrl() },
  imageApiPath: '/v1/images/generations',
  get llmApiBaseUrl() { return getApiBaseUrl() },
  llmApiPath: '/v1/chat/completions',
} as const

import type { TranslateFn } from '../i18n/types'

export function formatLLMError(error: unknown, t: TranslateFn, fallbackKey: string): string {
  if (!(error instanceof Error)) return t(fallbackKey)

  if (error.message === 'MISSING_API_KEY') return t('llm.error.missingApiKey')
  if (error.message === 'MISSING_API_BASE_URL') return t('llm.error.missingApiBaseUrl')
  if (error.message === 'LLM_TIMEOUT') return t('llm.error.timeout')
  if (error.message === 'LLM_NETWORK_ERROR') return t('llm.error.network')
  if (error.message === 'LLM_INVALID_RESPONSE') return t('llm.error.invalidResponse')
  if (error.message === 'LLM_EMPTY_RESPONSE') return t('llm.error.emptyResponse')

  if (error.message.startsWith('LLM_HTTP_ERROR:')) {
    const [, status = '', ...detailParts] = error.message.split(':')
    const detail = detailParts.join(':').trim()
    return detail
      ? t('llm.error.httpWithDetail', { status, detail })
      : t('llm.error.http', { status })
  }

  return t(fallbackKey)
}

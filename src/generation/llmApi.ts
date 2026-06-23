import { getLlmApiUrl, getApiKey, getAuthHeaders } from '../store/apiSettingsStore'
import { buildLLMPayload } from './llmPayloadBuilder'
import { normalizeLLMModelId } from './llmModelRegistry'

type SimpleMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type CallInput = {
  modelId: string
  messages: SimpleMessage[]
  systemPrompt?: string
  /** URLs of images to include in the last user message */
  imageUrls?: string[]
}

export async function callLLM(input: CallInput): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('MISSING_API_KEY')
  }

  const url = getLlmApiUrl()
  const payload = buildLLMPayload({
    ...input,
    modelId: normalizeLLMModelId(input.modelId),
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    throw new Error(`LLM call failed: ${resp.status}`)
  }

  const data = await resp.json()

  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content
  }

  throw new Error('No content in LLM response')
}

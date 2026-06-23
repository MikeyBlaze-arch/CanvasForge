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
  timeoutMs?: number
}

const DEFAULT_LLM_TIMEOUT_MS = 120_000

async function readResponseText(resp: Response): Promise<string> {
  try {
    return await resp.text()
  } catch {
    return ''
  }
}

function extractErrorMessage(rawBody: string): string {
  if (!rawBody.trim()) return ''
  try {
    const data = JSON.parse(rawBody) as Record<string, unknown>
    const error = data.error
    if (typeof error === 'string') return error
    if (error && typeof error === 'object') {
      const message = (error as Record<string, unknown>).message
      if (typeof message === 'string') return message
    }
    const message = data.message
    if (typeof message === 'string') return message
  } catch {
    return rawBody.slice(0, 240)
  }
  return ''
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

function extractTextContent(value: unknown): string {
  if (typeof value === 'string') return value.trim()

  if (Array.isArray(value)) {
    return value
      .map((item) => extractTextContent(item))
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  const record = asRecord(value)
  if (!record) return ''

  for (const key of ['text', 'output_text', 'content']) {
    const extracted = extractTextContent(record[key])
    if (extracted) return extracted
  }

  return extractTextContent(record.parts)
}

export function extractLLMResponseContent(data: unknown): string {
  const root = asRecord(data)
  if (!root) return ''

  const choices = root.choices
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const choiceRecord = asRecord(choice)
      if (!choiceRecord) continue

      const message = asRecord(choiceRecord.message)
      const messageContent = extractTextContent(message?.content)
      if (messageContent) return messageContent

      const delta = asRecord(choiceRecord.delta)
      const deltaContent = extractTextContent(delta?.content)
      if (deltaContent) return deltaContent

      const choiceText = extractTextContent(choiceRecord.text)
      if (choiceText) return choiceText
    }
  }

  for (const key of ['output_text', 'content', 'message', 'response', 'text']) {
    const extracted = extractTextContent(root[key])
    if (extracted) return extracted
  }

  const output = root.output
  if (Array.isArray(output)) {
    const extracted = extractTextContent(output)
    if (extracted) return extracted
  }

  const candidates = root.candidates
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const candidateRecord = asRecord(candidate)
      const content = asRecord(candidateRecord?.content)
      const extracted = extractTextContent(content?.parts ?? candidateRecord?.content)
      if (extracted) return extracted
    }
  }

  return ''
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

  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS)
  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (error) {
    if (
      error instanceof DOMException
      && error.name === 'AbortError'
    ) {
      throw new Error('LLM_TIMEOUT')
    }
    if (error instanceof TypeError) {
      throw new Error('LLM_NETWORK_ERROR')
    }
    throw error
  } finally {
    globalThis.clearTimeout(timer)
  }

  if (!resp.ok) {
    const rawBody = await readResponseText(resp)
    const detail = extractErrorMessage(rawBody)
    throw new Error(detail ? `LLM_HTTP_ERROR:${resp.status}:${detail}` : `LLM_HTTP_ERROR:${resp.status}`)
  }

  const rawBody = await readResponseText(resp)
  let data: Record<string, unknown>
  try {
    data = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    throw new Error('LLM_INVALID_RESPONSE')
  }

  const content = extractLLMResponseContent(data)
  if (content) return content

  throw new Error('LLM_EMPTY_RESPONSE')
}

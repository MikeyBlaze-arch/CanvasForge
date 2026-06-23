import { getLLMModelConfig } from './llmModelRegistry'

type SimpleMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type BuildInput = {
  modelId: string
  messages: SimpleMessage[]
  systemPrompt?: string
  /** URLs of images to include in the last user message */
  imageUrls?: string[]
}

/**
 * Build an OpenAI-compatible LLM payload.
 * Supports vision models by including image URLs as content parts.
 */
export function buildLLMPayload(input: BuildInput): Record<string, unknown> {
  const model = getLLMModelConfig(input.modelId)
  if (!model) throw new Error('LLM model not found')

  const messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }> = []

  if (input.systemPrompt && model.supportsSystemPrompt) {
    messages.push({ role: 'system', content: input.systemPrompt })
  }

  const imageUrls = input.imageUrls?.filter(Boolean) ?? []
  const hasImages = imageUrls.length > 0 && model.supportsVision

  for (let i = 0; i < input.messages.length; i++) {
    const msg = input.messages[i]

    // If this is the last user message and we have images, use multimodal content
    if (i === input.messages.length - 1 && msg.role === 'user' && hasImages) {
      const contentParts: Array<Record<string, unknown>> = []

      // Add text part
      if (msg.content.trim()) {
        contentParts.push({ type: 'text', text: msg.content })
      }

      // Add image parts
      for (const imgUrl of imageUrls) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: imgUrl },
        })
      }

      messages.push({ role: msg.role, content: contentParts })
    } else {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  const payload: Record<string, unknown> = {
    model: model.backendModel,
    messages,
    temperature: model.defaultTemperature,
    stream: false,
    imageInputs: imageUrls,
    image_urls: imageUrls,
  }

  return payload
}

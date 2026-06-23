export type LLMModelConfig = {
  id: string
  label: string
  backendModel: string
  provider: 'openai_compatible' | 'gemini_compatible' | 'custom'
  supportsVision: boolean
  supportsSystemPrompt: boolean
  defaultTemperature: number
}

export const LLM_MODEL_REGISTRY: LLMModelConfig[] = [
  {
    id: 'gpt-5-5',
    label: 'GPT-5.5',
    backendModel: 'R-gpt-5.5',
    provider: 'openai_compatible',
    supportsVision: true,
    supportsSystemPrompt: true,
    defaultTemperature: 0.7,
  },
  {
    id: 'gemini-3-1-pro',
    label: 'Gemini 3.1 Pro',
    backendModel: 'G-gemini-3.1-pro',
    provider: 'gemini_compatible',
    supportsVision: true,
    supportsSystemPrompt: true,
    defaultTemperature: 0.7,
  },
]

export function getLLMModelConfig(modelId: string): LLMModelConfig | undefined {
  return LLM_MODEL_REGISTRY.find(m => m.id === modelId)
}

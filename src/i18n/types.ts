export type Locale = 'zh-CN' | 'en-US'

export type Dictionary = Record<string, string>

export type TranslateVars = Record<string, string | number>

export type TranslateFn = (key: string, vars?: TranslateVars) => string

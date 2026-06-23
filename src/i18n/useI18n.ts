import { useUIStore } from '../store/uiStore'
import { zhCN } from './dictionaries'
import { enUS } from './dictionaries'
import type { Locale, Dictionary, TranslateFn, TranslateVars } from './types'

const dicts: Record<Locale, Dictionary> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

export function format(template: string, vars?: TranslateVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const value = vars[name]
    return value == null ? `{${name}}` : String(value)
  })
}

export function t(key: string, vars?: TranslateVars): string {
  const locale = useUIStore.getState().locale
  const dict = dicts[locale] ?? dicts['zh-CN']
  return format(dict[key] ?? key, vars)
}

export function useI18n() {
  const locale = useUIStore((s) => s.locale)
  const setLocale = useUIStore((s) => s.setLocale)
  const toggleLocale = useUIStore((s) => s.toggleLocale)

  const dict = dicts[locale] ?? dicts['zh-CN']

  const translate: TranslateFn = (key, vars) => format(dict[key] ?? key, vars)

  return { locale, setLocale, toggleLocale, t: translate }
}

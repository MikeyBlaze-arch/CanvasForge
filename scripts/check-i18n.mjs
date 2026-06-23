#!/usr/bin/env node
/**
 * CanvasForge i18n integrity check.
 *
 * Verifies:
 *   1. enUS and zhCN dictionaries declare exactly the same set of keys.
 *   2. No zhCN value is left as untranslated English residue (with an allowlist
 *      for brand / technical terms that are intentionally kept in English).
 *   3. Curated user-facing components do not embed hardcoded English UI strings
 *      (tooltips, placeholders, aria-labels, JSX text) that bypass t().
 *
 * Exit code is 1 when any problem is found, so this can gate CI / npm scripts.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DICT_PATH = join(ROOT, 'src', 'i18n', 'dictionaries.ts')

let problems = 0
function report(message) {
  console.error(`  ✗ ${message}`)
  problems++
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Extract keys from the dictionary source by brace matching.
//    We parse the source text directly so the script works with plain `node`
//    (no TypeScript loader / flag required).
// ───────────────────────────────────────────────────────────────────────────

function extractBlock(name, text) {
  const header = new RegExp(`\\b${name}\\s*:\\s*Dictionary\\s*=\\s*\\{`)
  const start = header.exec(text)
  if (!start) throw new Error(`Could not locate dictionary block "${name}"`)
  let i = start.index + start[0].length
  let depth = 1
  while (i < text.length && depth > 0) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    i++
  }
  return text.slice(start.index + start[0].length, i - 1)
}

function extractKeys(block) {
  // Each entry is on its own line: `  'some.key': <value>,`
  // Keys only contain [A-Za-z0-9_.] and are always followed by `:`. Values that
  // are strings never start with a bare key token, so the first quoted token
  // followed by a colon on a line is reliably the key.
  const keys = []
  const lineRe = /^\s*'([A-Za-z0-9_.]+)'\s*:/gm
  let m
  while ((m = lineRe.exec(block)) !== null) {
    keys.push(m[1])
  }
  return keys
}

function extractEntries(block) {
  // Map of key -> raw value text (best-effort, for residue inspection).
  const entries = {}
  const re = /^\s*'([A-Za-z0-9_.]+)'\s*:\s*'((?:[^'\\]|\\.)*)'/gm
  let m
  while ((m = re.exec(block)) !== null) {
    entries[m[1]] = m[2]
  }
  return entries
}

const dictSource = readFileSync(DICT_PATH, 'utf8')
const enBlock = extractBlock('enUS', dictSource)
const zhBlock = extractBlock('zhCN', dictSource)
const enKeys = new Set(extractKeys(enBlock))
const zhKeys = new Set(extractKeys(zhBlock))
const zhEntries = extractEntries(zhBlock)

console.log('i18n check')
console.log(`  enUS keys: ${enKeys.size}`)
console.log(`  zhCN keys: ${zhKeys.size}`)

// ───────────────────────────────────────────────────────────────────────────
// 2. Key parity between enUS and zhCN.
// ───────────────────────────────────────────────────────────────────────────
const missingInZh = [...enKeys].filter((k) => !zhKeys.has(k)).sort()
const missingInEn = [...zhKeys].filter((k) => !enKeys.has(k)).sort()

if (missingInZh.length === 0 && missingInEn.length === 0) {
  console.log('  ✓ enUS and zhCN key sets match')
} else {
  if (missingInZh.length) {
    report(`zhCN is missing ${missingInZh.length} key(s):\n${missingInZh.map((k) => `      - ${k}`).join('\n')}`)
  }
  if (missingInEn.length) {
    report(`enUS is missing ${missingInEn.length} key(s):\n${missingInEn.map((k) => `      - ${k}`).join('\n')}`)
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 3. zhCN English-residue check.
//    Flag values that contain no CJK characters but do contain an ASCII word,
//    unless the value is a recognised brand / technical term.
// ───────────────────────────────────────────────────────────────────────────
const BRAND_ALLOW = new Set([
  'CanvasForge',
  'CanvasForge v1.0',
  'API',
  'API Key',
  'Base URL',
  'ComfyUI',
  'AutoDL',
  'AutoDL Token',
  'Zealman',
  'GPT',
  'Gemini',
  'Grok',
  'Veo',
  'Seedance',
  'Omni',
  'LLM',
  'UUID',
  'Token',
])

function hasCjk(text) {
  return /[一-鿿]/.test(text)
}

function isResidue(value) {
  if (value == null) return false
  if (hasCjk(value)) return false
  // Template placeholders like "{count}" alone are not residue.
  if (!/[A-Za-z]/.test(value)) return false
  if (BRAND_ALLOW.has(value.trim())) return false
  return true
}

const residue = Object.entries(zhEntries).filter(([, v]) => isResidue(v))
if (residue.length === 0) {
  console.log('  ✓ no untranslated English residue in zhCN')
} else {
  report(`zhCN has ${residue.length} value(s) that look like untranslated English:\n${residue.map(([k, v]) => `      - ${k}: ${v}`).join('\n')}`)
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Hardcoded-English UI scan over curated user-facing components.
//    Catches literal English in tooltip / placeholder / aria-label attributes
//    and English JSX text children that bypass t().
// ───────────────────────────────────────────────────────────────────────────
const SCAN_DIRS = [
  join(ROOT, 'src', 'app', 'layout'),
  join(ROOT, 'src', 'app', 'floating'),
  join(ROOT, 'src', 'components'),
]
const SCAN_GLOBS = [/\.tsx$/]
// Files that intentionally contain English (diagnostics, data seeds, etc.)
const SCAN_SKIP = new Set([
  'MotionTransferNode.tsx', // contains dev/error-only diagnostics panel
  'WorkflowTemplatesPanel.tsx',
].map((f) => f.toLowerCase()))

// Brand / technical terms ignored inside scanned English phrases.
const PHRASE_ALLOW = new Set([
  'CanvasForge', 'API', 'Base', 'URL', 'Key', 'ComfyUI', 'AutoDL', 'Zealman',
  'GPT', 'Gemini', 'Grok', 'Veo', 'Seedance', 'Omni', 'LLM', 'UUID', 'Token',
  'Ctrl', 'Enter', 'Esc', 'JSON', 'HTTP', 'HTTPS', 'ID', 'OK', 'on', 'off',
  'v1.0',
])

function walk(dir, acc) {
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(full, acc)
    else if (SCAN_GLOBS.some((re) => re.test(name))) acc.push(full)
  }
  return acc
}

const scanFiles = SCAN_DIRS.flatMap((d) => walk(d, [])).filter(
  (f) => !SCAN_SKIP.has((f.split(/[\\/]/).pop() || '').toLowerCase())
)

function looksLikeEnglishPhrase(text) {
  // Strip template placeholders and surrounding whitespace.
  const cleaned = text.replace(/\{[^}]*\}/g, '').trim()
  if (!cleaned) return false
  if (hasCjk(cleaned)) return false
  // Skip i18n keys (contain dots) and identifier-like / single tokens.
  if (/[.{}]/.test(cleaned)) return false
  const words = cleaned.split(/[\s/]+/).filter(Boolean)
  if (words.length === 0) return false
  // Need at least one alphabetic word of length >= 3 to avoid flagging symbols.
  const meaningful = words.filter((w) => /^[A-Za-z]{3,}$/.test(w.replace(/[^A-Za-z]/g, '')))
  if (meaningful.length === 0) return false
  // If every word is allowlisted, ignore.
  if (words.every((w) => PHRASE_ALLOW.has(w))) return false
  return true
}

let scanIssues = 0
const attrRe = /\b(?:title|placeholder|aria-label|alt)\s*=\s*"([^"]*)"/g
const jsxTextRe = />\s*([^<>{}\n]{1,80}?)\s*</g

for (const file of scanFiles) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  const lines = src.split(/\r?\n/)
  lines.forEach((line, idx) => {
    // Skip lines already using the translation helper.
    if (/\bt\(|useI18n/.test(line)) return
    // Skip comments.
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/')

    let m
    attrRe.lastIndex = 0
    while ((m = attrRe.exec(line)) !== null) {
      const val = m[1]
      if (val && !hasCjk(val) && /[A-Za-z]{2,}/.test(val) && !PHRASE_ALLOW.has(val.trim())) {
        // Ignore attribute values that are identifiers / keys / paths / ratios.
        if (/[.{}]/.test(val)) continue
        const words = val.trim().split(/[\s/]+/).filter(Boolean)
        if (words.length && words.every((w) => PHRASE_ALLOW.has(w))) continue
        report(`${rel}:${idx + 1} hardcoded attribute text "${val}" — use t()`)
        scanIssues++
      }
    }
    jsxTextRe.lastIndex = 0
    while ((m = jsxTextRe.exec(line)) !== null) {
      const val = m[1]
      if (looksLikeEnglishPhrase(val)) {
        report(`${rel}:${idx + 1} hardcoded JSX text "${val.trim()}" — use t()`)
        scanIssues++
      }
    }
  })
}

if (scanIssues === 0) {
  console.log(`  ✓ no hardcoded English UI text in ${scanFiles.length} scanned component file(s)`)
}

// ───────────────────────────────────────────────────────────────────────────
console.log()
if (problems === 0) {
  console.log('i18n check passed ✓')
  process.exit(0)
} else {
  console.log(`i18n check failed with ${problems} problem(s)`)
  process.exit(1)
}

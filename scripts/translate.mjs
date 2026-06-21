#!/usr/bin/env node
// AI-assisted Swedish → English translation for CloudPortal Docs.
//
// Canonical source is content/sv/**. This script (re)generates the English
// counterpart for pages that are missing or marked `translationStatus: stale`,
// using the Anthropic API. Output is written with `translationStatus:
// ai-translated` and `reviewed: false` — it MUST be reviewed by a human before
// being merged/published.
//
// Trigger: maintainer only (workflow_dispatch or the `ai-translate` label).
// Never run on untrusted fork code with secrets — see docs-translate.yml.
//
// Usage:
//   ANTHROPIC_API_KEY=... node scripts/translate.mjs            # stale/missing only
//   ANTHROPIC_API_KEY=... node scripts/translate.mjs --all      # force all pages
//   node scripts/translate.mjs --dry-run                        # list work, no API calls

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CONTENT = join(ROOT, 'content')
const MODEL = process.env.TRANSLATE_MODEL || 'claude-sonnet-4-6'
const ALL = process.argv.includes('--all')
const DRY = process.argv.includes('--dry-run')

// Maps canonical (sv) section directory -> English section directory.
// Keep in sync when adding sections.
const SECTION_MAP = {
  '1.kom-igang': '1.getting-started',
  '2.organisation': '2.organization',
  '3.domaner-och-dns': '3.domains-and-dns',
  '4.e-postsakerhet': '4.email-security',
  '5.certifikat': '5.certificates',
  '6.app-hosting': '6.app-hosting',
  '7.partner': '7.partner',
  '8.support': '8.support',
}

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(full))
    else if (entry.name.endsWith('.md')) out.push(full)
  }
  return out
}

function getFrontmatterField(src, field) {
  const m = src.match(new RegExp(`^${field}:\\s*(.*)$`, 'm'))
  return m ? m[1].replace(/^["']|["']$/g, '').trim() : undefined
}

// Build an index of existing en pages by translationKey -> path
async function enIndexByKey() {
  const idx = new Map()
  const enDir = join(CONTENT, 'en')
  try {
    for (const file of await walk(enDir)) {
      const key = getFrontmatterField(await readFile(file, 'utf8'), 'translationKey')
      if (key) idx.set(key, file)
    }
  } catch { /* en dir may not exist yet */ }
  return idx
}

// Map an sv file path to its conventional en path (used for NEW pages).
function svToEnPath(svFile) {
  let rel = relative(join(CONTENT, 'sv'), svFile)
  const seg = rel.split(/[\\/]/)
  if (seg.length > 1 && SECTION_MAP[seg[0]]) seg[0] = SECTION_MAP[seg[0]]
  return join(CONTENT, 'en', ...seg)
}

const SYSTEM = `You are a professional technical translator for SaaS product documentation.
Translate Swedish documentation Markdown into natural, professional English.
Rules:
- Preserve ALL frontmatter keys and structure. Translate only the human-facing values of "title" and "description". Keep all other frontmatter values unchanged.
- Preserve every MDC component (::name ... ::), all link URLs, code blocks, and Markdown structure exactly. Translate link TEXT but never the URL.
- For internal doc links, rewrite the "/sv/" prefix to "/en/" and translate the slug to its English equivalent where an obvious one exists; otherwise keep the path.
- Do not add or remove content. Do not add explanatory notes.
- Output ONLY the translated Markdown file content, nothing else.`

async function translate(svContent) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: svContent }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.content.map(b => b.text || '').join('')
}

// Ensure en frontmatter carries translation provenance/status.
function stampMetadata(enContent, commit) {
  let c = enContent
  const set = (field, value) => {
    if (new RegExp(`^${field}:`, 'm').test(c)) c = c.replace(new RegExp(`^${field}:.*$`, 'm'), `${field}: ${value}`)
    else c = c.replace(/^---\n/, `---\nsourceLocale: sv\n${field}: ${value}\n`)
  }
  set('locale', 'en')
  set('translationStatus', 'ai-translated')
  set('reviewed', 'false')
  set('translatedFromCommit', commit)
  return c
}

const commit = process.env.GITHUB_SHA?.slice(0, 7) || 'local'
const enIdx = await enIndexByKey()
const svFiles = await walk(join(CONTENT, 'sv'))
const work = []

for (const sv of svFiles) {
  const src = await readFile(sv, 'utf8')
  const key = getFrontmatterField(src, 'translationKey')
  if (!key && !sv.endsWith('index.md')) continue
  const enPath = (key && enIdx.get(key)) || svToEnPath(sv)
  let needs = ALL
  let reason = ALL ? 'forced (--all)' : ''
  if (!ALL) {
    // An en page exists if matched by translationKey, or (for index/keyless
    // pages) if the conventional mirror path already exists on disk.
    const existing = (key && enIdx.get(key)) || (existsSync(enPath) ? enPath : null)
    if (!existing) { needs = true; reason = 'missing en page' }
    else if (getFrontmatterField(await readFile(existing, 'utf8'), 'translationStatus') === 'stale') {
      needs = true; reason = 'en marked stale'
    }
  }
  if (needs) work.push({ sv, enPath, src, reason })
}

console.log(`${work.length} page(s) to translate (model: ${MODEL}).`)
for (const w of work) console.log(`  - ${relative(ROOT, w.sv)} → ${relative(ROOT, w.enPath)}  [${w.reason}]`)

if (DRY) process.exit(0)
if (!work.length) process.exit(0)
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\nANTHROPIC_API_KEY is required to translate. Re-run with the key set, or use --dry-run.')
  process.exit(1)
}

for (const w of work) {
  process.stdout.write(`Translating ${relative(ROOT, w.sv)} ... `)
  const en = stampMetadata(await translate(w.src), commit)
  await mkdir(dirname(w.enPath), { recursive: true })
  await writeFile(w.enPath, en, 'utf8')
  console.log('done')
}
console.log('\n✅ Translation complete. Review en pages (reviewed: false) before publishing.')

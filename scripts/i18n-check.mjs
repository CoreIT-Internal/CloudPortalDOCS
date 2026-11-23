#!/usr/bin/env node
// i18n parity + safety-gate check for CloudPortal Docs.
//
// Verifies, for content under content/<locale>/:
//   1. Every page in the canonical locale (sv) has a counterpart in every
//      other locale, matched by the `translationKey` frontmatter field.
//   2. Every page has `title` and `description` frontmatter.
//   3. No page contains a forbidden internal term (safety gate).
//   4. No translated page is marked `translationStatus: stale`.
//   5. No page has a `# Heading` (H1) in its body. Docus renders the frontmatter
//      `title` as the page heading, so an H1 shows the title twice on the page,
//      and the search lists every page twice: once for the title, once for the
//      H1.
//
// Exit code 1 on any error. Warnings (forbidden words, stale) do not fail the
// build by default but are surfaced; pass --strict to fail on warnings too.

import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CONTENT = join(ROOT, 'content')
const CANONICAL = 'sv'
const STRICT = process.argv.includes('--strict')

// Safety gate: internal terms that must never appear in public docs.
// A hit flags the page for manual review (warning), it is not auto-failed
// unless --strict is set.
// Internal terms that should never appear in public docs. A hit is a warning
// (manual review), not an auto-fail unless --strict. Note: generic phrases that
// legitimately appear in secrets/security guidance (e.g. "secret key") are
// intentionally NOT listed here to avoid false positives.
const FORBIDDEN = [
  'COREID', 'service role', 'marker-record', 'super-admin', 'system tenant',
  'tenant_id null', 'managed identity', 'database schema',
  'Cloudflare custom hostname ID', 'BullMQ', 'workflow internals',
]

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(full))
    else if (entry.name.endsWith('.md')) out.push(full)
  }
  return out
}

// The body's H1 headings, outside fenced code (a `# comment` in a shell block
// is not a heading).
function bodyH1s(src) {
  const body = src.replace(/^---\n[\s\S]*?\n---\n/, '')
  const found = []
  let fence = null
  for (const line of body.split('\n')) {
    const f = line.match(/^\s*(`{3,}|~{3,})/)
    if (f) {
      if (!fence) fence = f[1][0]
      else if (f[1][0] === fence) fence = null
      continue
    }
    if (!fence && /^#\s/.test(line)) found.push(line.slice(1).trim())
  }
  return found
}

function parseFrontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const fm = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim()
  }
  return fm
}

const errors = []
const warnings = []

const localeDirs = (await readdir(CONTENT, { withFileTypes: true }))
  .filter(d => d.isDirectory())
  .map(d => d.name)

if (!localeDirs.includes(CANONICAL)) {
  errors.push(`Canonical locale "${CANONICAL}" missing under content/`)
}

// Map: locale -> Set of translationKeys (and collect issues per file)
const keysByLocale = {}
for (const locale of localeDirs) {
  keysByLocale[locale] = new Map()
  const files = await walk(join(CONTENT, locale))
  for (const file of files) {
    const rel = relative(ROOT, file)
    // A Windows checkout (core.autocrlf) has CRLF; the parsers below want \n.
    const src = (await readFile(file, 'utf8')).replace(/\r\n/g, '\n')
    const fm = parseFrontmatter(src)

    for (const h1 of bodyH1s(src)) {
      errors.push(`${rel}: "# ${h1}" is an H1 in the body. The frontmatter title is the page heading: remove the H1`)
    }

    // index.md landing pages are exempt from translationKey requirement
    const isIndex = file.endsWith(`${locale}/index.md`) || file.endsWith(`${locale}\\index.md`)

    if (!isIndex) {
      if (!fm.title) errors.push(`${rel}: missing frontmatter "title"`)
      if (!fm.description) errors.push(`${rel}: missing frontmatter "description"`)
      if (!fm.translationKey) errors.push(`${rel}: missing frontmatter "translationKey"`)
      else keysByLocale[locale].set(fm.translationKey, rel)
    }

    if (fm.translationStatus === 'stale') {
      warnings.push(`${rel}: translationStatus is "stale" — needs re-translation`)
    }

    const lower = src.toLowerCase()
    for (const term of FORBIDDEN) {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (re.test(lower)) warnings.push(`${rel}: contains forbidden term "${term}" — manual review required`)
    }
  }
}

// Parity: every canonical key must exist in every other locale
const canonicalKeys = keysByLocale[CANONICAL] ?? new Map()
for (const locale of localeDirs) {
  if (locale === CANONICAL) continue
  for (const [key, relFile] of canonicalKeys) {
    if (!keysByLocale[locale].has(key)) {
      errors.push(`Missing ${locale} translation for "${key}" (canonical: ${relFile})`)
    }
  }
}

if (warnings.length) {
  console.log('\n⚠️  Warnings:')
  for (const w of warnings) console.log('   - ' + w)
}
if (errors.length) {
  console.log('\n❌ Errors:')
  for (const e of errors) console.log('   - ' + e)
}

const failed = errors.length > 0 || (STRICT && warnings.length > 0)
if (!failed) console.log(`\n✅ i18n check passed (${canonicalKeys.size} canonical pages, locales: ${localeDirs.join(', ')})`)
process.exit(failed ? 1 : 0)

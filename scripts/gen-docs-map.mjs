#!/usr/bin/env node
// Generates public/docs-map.json — the single source of truth that lets the
// main app deep-link its "Docs" icon to the matching docs section, without any
// hardcoded slugs in the app.
//
// The map is built from the `portalRoute` frontmatter on each section overview
// page (e.g. portalRoute: /security/certificates). The app does a longest-prefix
// match of the user's current route against `routes` and opens the locale URL.
//
//   node scripts/gen-docs-map.mjs           # write public/docs-map.json
//   node scripts/gen-docs-map.mjs --check   # validate only, non-zero exit on problems
//
// Drift protection: --check (run in CI) fails if an overview declares a
// portalRoute but is missing an English counterpart, if two pages claim the same
// route, or if a mapped URL has no underlying content file.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CONTENT = join(ROOT, 'content')
const OUT = join(ROOT, 'public', 'docs-map.json')
const CHECK = process.argv.includes('--check')

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...await walk(full))
    else if (e.name.endsWith('.md')) out.push(full)
  }
  return out
}

function field(src, name) {
  const m = src.match(new RegExp(`^${name}:\\s*(.*)$`, 'm'))
  return m ? m[1].replace(/^["']|["']$/g, '').trim() : undefined
}

// content/sv/3.domaner-och-dns/1.oversikt.md -> /sv/domaner-och-dns/oversikt
function toUrl(absFile) {
  const rel = relative(CONTENT, absFile).replace(/\\/g, '/').replace(/\.md$/, '')
  const segs = rel.split('/').map(s => s.replace(/^\d+\./, ''))
  if (segs[segs.length - 1] === 'index') segs.pop()
  return '/' + segs.join('/')
}

const files = await walk(CONTENT)
const pages = []
for (const f of files) {
  const src = await readFile(f, 'utf8')
  pages.push({
    file: f,
    url: toUrl(f),
    locale: relative(CONTENT, f).replace(/\\/g, '/').split('/')[0],
    translationKey: field(src, 'translationKey'),
    portalRoute: field(src, 'portalRoute'),
    module: field(src, 'module'),
  })
}

const enByKey = new Map(pages.filter(p => p.locale === 'en' && p.translationKey).map(p => [p.translationKey, p.url]))

const errors = []
const routes = []
const seenRoute = new Map()

for (const p of pages.filter(p => p.locale === 'sv' && p.portalRoute)) {
  const en = p.translationKey ? enByKey.get(p.translationKey) : undefined
  if (!en) errors.push(`${relative(ROOT, p.file)}: portalRoute "${p.portalRoute}" has no English counterpart (translationKey ${p.translationKey})`)
  if (seenRoute.has(p.portalRoute)) errors.push(`Duplicate portalRoute "${p.portalRoute}" in ${relative(ROOT, p.file)} and ${seenRoute.get(p.portalRoute)}`)
  seenRoute.set(p.portalRoute, relative(ROOT, p.file))
  routes.push({ route: p.portalRoute, module: p.module ?? null, sv: p.url, en: en ?? `/en` })
}

// Longest-prefix-first so the app picks the most specific match.
routes.sort((a, b) => b.route.length - a.route.length)

// Full sv↔en page map (every page paired by translationKey). Powers the docs
// site's locale switcher, which otherwise 404s because slugs are translated
// (e.g. /sv/certifikat/oversikt ↔ /en/certificates/overview).
const pagePairs = pages
  .filter(p => p.locale === 'sv' && p.translationKey)
  .map(p => ({ key: p.translationKey, sv: p.url, en: enByKey.get(p.translationKey) || '/en' }))
pagePairs.unshift({ key: 'index', sv: '/sv', en: '/en' })

if (errors.length) {
  console.log('❌ docs-map problems:')
  for (const e of errors) console.log('   - ' + e)
  process.exit(1)
}

if (CHECK) {
  console.log(`✅ docs-map check passed (${routes.length} routes, ${pagePairs.length} page pairs)`)
  process.exit(0)
}

const map = { version: 1, routes, pages: pagePairs }
await mkdir(join(ROOT, 'public'), { recursive: true })
await writeFile(OUT, JSON.stringify(map, null, 2) + '\n', 'utf8')
console.log(`✅ Wrote ${relative(ROOT, OUT)} (${routes.length} routes, ${pagePairs.length} page pairs)`)

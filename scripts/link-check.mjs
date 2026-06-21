#!/usr/bin/env node
// Verifies that every internal documentation link (/sv/... or /en/...) resolves
// to a page that actually exists. Catches dangling cross-links — e.g. an
// overview linking to a detail page whose slug was renamed. Run in CI.
//
//   node scripts/link-check.mjs

import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CONTENT = join(ROOT, 'content')

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...await walk(full))
    else if (e.name.endsWith('.md')) out.push(full)
  }
  return out
}

// content/sv/3.domaner-och-dns/1.oversikt.md -> /sv/domaner-och-dns/oversikt
function toUrl(absFile) {
  const rel = relative(CONTENT, absFile).replace(/\\/g, '/').replace(/\.md$/, '')
  const segs = rel.split('/').map(s => s.replace(/^\d+\./, ''))
  if (segs[segs.length - 1] === 'index') segs.pop()
  return '/' + segs.join('/')
}

const norm = (p) => (p !== '/' && p.endsWith('/') ? p.slice(0, -1) : p)

const files = await walk(CONTENT)
const validUrls = new Set(files.map(f => norm(toUrl(f))))

// Markdown links [text](/sv/...) or [text](/en/...). Ignore external/anchors.
const linkRe = /\]\((\/(?:sv|en)\/[^)\s#]*)(?:#[^)\s]*)?\)/g

const problems = []
for (const file of files) {
  const src = await readFile(file, 'utf8')
  let m
  while ((m = linkRe.exec(src)) !== null) {
    const target = norm(m[1])
    if (!validUrls.has(target)) {
      problems.push(`${relative(ROOT, file)} → ${m[1]}`)
    }
  }
}

if (problems.length) {
  console.log('❌ Dangling internal links:')
  for (const p of problems) console.log('   - ' + p)
  process.exit(1)
}
console.log(`✅ link-check passed (${validUrls.size} pages, all internal links resolve)`)

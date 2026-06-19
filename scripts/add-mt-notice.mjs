#!/usr/bin/env node
// Inserts a "machine-translated, pending review" notice into English pages that
// are AI-translated and not yet reviewed (translationStatus: ai-translated).
// Idempotent: skips files that already contain the marker. When a page is
// reviewed (set reviewed: true / translationStatus: approved), remove the
// marked block so the notice disappears.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const EN = join(ROOT, 'content', 'en')
const MARKER = '<!-- mt-notice -->'
const NOTICE = `${MARKER}
::caution{icon="i-lucide-languages"}
This page was machine-translated from Swedish and has not been reviewed yet — it may contain inaccuracies. The Swedish version is authoritative.
::
`

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...await walk(full))
    else if (e.name.endsWith('.md')) out.push(full)
  }
  return out
}

const field = (src, f) => (src.match(new RegExp(`^${f}:\\s*(.*)$`, 'm'))?.[1] ?? '').replace(/^["']|["']$/g, '').trim()

let added = 0, skipped = 0
for (const file of await walk(EN)) {
  const src = await readFile(file, 'utf8')
  if (field(src, 'translationStatus') !== 'ai-translated') { skipped++; continue }
  if (src.includes(MARKER)) { skipped++; continue }
  const m = src.match(/^---\n[\s\S]*?\n---\n/)
  if (!m) { skipped++; continue }
  const out = src.slice(0, m[0].length) + '\n' + NOTICE + src.slice(m[0].length)
  await writeFile(file, out, 'utf8')
  added++
}
console.log(`mt-notice: added to ${added} page(s), skipped ${skipped}.`)

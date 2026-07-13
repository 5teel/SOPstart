/**
 * Lint guard — every `var(--token)` referenced in src/ must actually be DEFINED.
 *
 * Why this exists: `--accent-ok` and `--accent-step` were referenced bare by six
 * builder components but never defined in any stylesheet. CSS resolves an
 * undefined custom property to nothing, so `background: var(--accent-ok)` on the
 * review surface's PRIMARY "verify step" button produced white text on a
 * transparent background — the most important control on the page, invisible.
 * It shipped because an undefined token is not a build error, not a type error,
 * and not a runtime error: it just quietly renders wrong.
 *
 * Same class as the 30-07 undefined `--brand-yellow` publish-CTA bug. That one
 * was caught by eye; this guard catches the next one mechanically.
 *
 * A reference WITH a fallback — `var(--x, #fff)` — is fine by construction and
 * is not required to be defined.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SRC_DIR = path.join(REPO_ROOT, 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(full, out)
    } else if (/\.(tsx?|css)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

test('every var(--token) used without a fallback is defined in a stylesheet', () => {
  const files = walk(SRC_DIR)

  // 1. Collect every custom property DEFINED anywhere in src (any selector).
  const defined = new Set<string>()
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8')
    for (const m of src.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
      defined.add(m[1])
    }
  }

  // 2. Collect every custom property REFERENCED via var() with NO fallback.
  //    `var(--x, #fff)` is safe by construction — a fallback is a definition.
  //    Test files are skipped: they quote token names in prose/assertions
  //    (e.g. a comment saying "node fills use var(--accent-) tokens"), which
  //    is documentation, not a style that can render wrong.
  const referenced = new Map<string, string>() // token -> first file that uses it
  for (const file of files) {
    if (/(__tests__|\.spec\.|\.test\.)/.test(file)) continue
    const src = fs.readFileSync(file, 'utf-8')
    for (const m of src.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)) {
      const token = m[1]
      if (!referenced.has(token)) {
        referenced.set(token, path.relative(REPO_ROOT, file))
      }
    }
  }

  const undefinedTokens = [...referenced.entries()]
    .filter(([token]) => !defined.has(token))
    .map(([token, file]) => `${token} (first used in ${file})`)

  expect(
    undefinedTokens,
    `These CSS custom properties are used via var(--x) with no fallback but are never defined. ` +
      `CSS resolves them to nothing, which silently renders the element wrong (invisible buttons, ` +
      `missing borders). Either define the token in src/styles/blueprint-theme.css or supply a ` +
      `fallback: var(--x, <value>).`,
  ).toEqual([])
})

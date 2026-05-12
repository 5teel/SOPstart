/**
 * Phase 15 / Wave 0 — Static-import leak guard (Pitfall 5, guards SB-LINE-06).
 *
 * Ensures that DesktopWalkthrough and WalkthroughVoiceModal are NEVER
 * statically imported. The ONLY allowed reference site is
 * `src/components/sop/walkthrough/WalkthroughSwitcher.tsx`, and only via
 * `next/dynamic`. Any other import path would pull the desktop / voice
 * code into the mobile worker bundle and bust SB-LINE-06 bundle isolation.
 *
 * Runs LIVE (no `test.fixme`). At Phase-14-head the components don't exist
 * yet, so the regex finds zero matches and the test passes vacuously.
 * Once Wave 2 adds the dynamic import inside WalkthroughSwitcher.tsx the
 * test will continue passing because that single permitted reference
 * uses `next/dynamic`. Any future regression where a developer adds
 * `import { DesktopWalkthrough } from '...'` outside the switcher will
 * make this test fail.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SRC_DIR = path.join(REPO_ROOT, 'src')
const ALLOWED_FILE = path.join(
  'src',
  'components',
  'sop',
  'walkthrough',
  'WalkthroughSwitcher.tsx'
)

type Hit = { file: string; line: number; text: string; usesDynamic: boolean }

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(full, out)
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
    ) {
      out.push(full)
    }
  }
}

function findImports(symbol: string): Hit[] {
  const hits: Hit[] = []
  const files: string[] = []
  walk(SRC_DIR, files)
  // Match either:
  //   import ... DesktopWalkthrough ... from '...'   (static import)
  //   const X = dynamic(() => import('...DesktopWalkthrough...'))  (dynamic — allowed)
  // We collect any line that references the symbol AND is import-like, then
  // decide allowance per file.
  const importLine = new RegExp(
    `(import\\s+[^;]*${symbol}[^;]*from|dynamic\\s*\\(\\s*\\(\\s*\\)\\s*=>\\s*import\\([^)]*${symbol}[^)]*\\))`,
    'i'
  )
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
    const text = fs.readFileSync(file, 'utf-8')
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.includes(symbol)) continue
      // Only count lines that look like import sites — `from '...'` OR `dynamic(`
      if (!importLine.test(line) && !/\b(import|dynamic)\b/.test(line)) continue
      // Skip type-only file paths inside comments
      if (/^\s*(\*|\/\/)/.test(line)) continue
      // Skip declarations of the component itself (export function / class)
      if (/^\s*export\s+(default\s+)?(function|class|const)\s+/.test(line))
        continue
      // Skip JSX usage `<DesktopWalkthrough ...>` — only flag import-shape lines
      if (line.trim().startsWith('<') || line.trim().startsWith('{/* ')) continue
      const usesDynamic = /dynamic\s*\(/.test(line) || /next\/dynamic/.test(text)
      hits.push({ file: rel, line: i + 1, text: line.trim(), usesDynamic })
    }
  }
  return hits
}

test('SB-LINE-06: no static import of DesktopWalkthrough outside WalkthroughSwitcher.tsx', () => {
  const hits = findImports('DesktopWalkthrough')
  const violations = hits.filter((h) => {
    const allowedPath = ALLOWED_FILE.replace(/\\/g, '/')
    if (h.file !== allowedPath) return true
    return !h.usesDynamic
  })
  if (violations.length > 0) {
    console.error(
      'DesktopWalkthrough import-leak violations:\n' +
        violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`).join('\n')
    )
  }
  expect(violations).toEqual([])
})

test('SB-LINE-06: no static import of WalkthroughVoiceModal outside WalkthroughSwitcher.tsx', () => {
  const hits = findImports('WalkthroughVoiceModal')
  const violations = hits.filter((h) => {
    const allowedPath = ALLOWED_FILE.replace(/\\/g, '/')
    if (h.file !== allowedPath) return true
    return !h.usesDynamic
  })
  if (violations.length > 0) {
    console.error(
      'WalkthroughVoiceModal import-leak violations:\n' +
        violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`).join('\n')
    )
  }
  expect(violations).toEqual([])
})

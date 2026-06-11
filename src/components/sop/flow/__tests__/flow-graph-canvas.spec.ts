/**
 * Phase 24 Plan 01 — FLOW-01/03/04 source-contract stubs.
 *
 * These assertions go live when Plans 02/03 implement the features.
 * Per CLAUDE.md 2026-06-05 learning: assert handler IS WIRED
 * (onClick references the function), not merely that a token exists.
 *
 * Registered in playwright.config.ts under project phase24-stubs.
 * CLAUDE.md 2026-05-25: a spec file not in any project regex NEVER runs.
 *
 * TODO(24-03): un-fixme assertion (c) when useViewport desktop-default lands.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

const CANVAS_FILE = join(process.cwd(), 'src/components/sop/flow/FlowGraphCanvas.tsx')
const FLOW_TAB_FILE = join(process.cwd(), 'src/components/sop/tabs/FlowTab.tsx')

// (a) FLOW-03: fitToView defined AND wired to Fit button onClick
// Un-fixme: Plan 02 implemented real fitToView (replaces scrollTo stub)
test('FlowGraphCanvas defines fitToView and wires it to Fit button onClick', () => {
  const content = readFileSync(CANVAS_FILE, 'utf8')
  // Function definition: useCallback-based fitToView
  expect(content).toMatch(/fitToView\s*=\s*useCallback/)
  // onClick handler wiring — must reference fitToView, not the stub scrollTo
  expect(content).toMatch(/onClick=\{fitToView\}|onClick=\{\s*\(\)\s*=>\s*fitToView\(\)\s*\}/)
  // Must NOT still use the scrollTo stub
  expect(content).not.toMatch(/scrollRef\.current\?\.scrollTo/)
})

// (b) FLOW-04: exportPng defined, calls canvas.toBlob, Export button wired
// Un-fixme: Plan 02 implemented exportPng
test('FlowGraphCanvas defines exportPng with canvas.toBlob and Export button onClick', () => {
  const content = readFileSync(CANVAS_FILE, 'utf8')
  // Function definition
  expect(content).toMatch(/exportPng\s*=\s*useCallback/)
  // canvas.toBlob is the canonical canvas rasterisation pattern (photo-compress.ts analog)
  expect(content).toMatch(/canvas\.toBlob/)
  // Export button wired — onClick references exportPng
  expect(content).toMatch(/onClick=\{exportPng\}|onClick=\{\s*\(\)\s*=>\s*exportPng\(\)\s*\}|onClick=\{\s*\(\)\s*=>\s*void exportPng\(\)\s*\}/)
})

// (c) FLOW-01: FlowTab imports useViewport AND seeds useState with 'list' (SSR-safe)
//     AND has useEffect that sets view to 'graph' when viewport === 'desktop'
// Un-fixme: Plan 03 implemented desktop-default auto-switch (FLOW-04)
test('FlowTab imports useViewport and uses SSR-safe initial state with desktop useEffect', () => {
  const content = readFileSync(FLOW_TAB_FILE, 'utf8')
  // import present
  expect(content).toMatch(/import.*useViewport.*from.*@\/hooks\/useViewport/)
  // SSR-safe initial state: seed 'list' not 'graph' (avoid hydration mismatch #418)
  expect(content).toMatch(/useState<'list'\s*\|\s*'graph'>\(['"]list['"]\)/)
  // useEffect reconciles to 'graph' on desktop (CLAUDE.md 2026-06-08: never read navigator/window at render)
  // Use [\s\S] instead of /s flag — TS1501 per CLAUDE.md 2026-06-02 learning
  expect(content).toMatch(/useEffect\([\s\S]*?viewport[\s\S]*?===[\s\S]*?desktop[\s\S]*?setView[\s\S]*?graph/)
})

// (d) FLOW colour token unification: node fills use var(--accent-) tokens, NOT #db2777
// Un-fixme: Plan 02 unified FlowGraphCanvas NODE colours to match FlowTab TYPE_COLORS
test('FlowGraphCanvas node fills reference var(--accent-) tokens and contain no #db2777', () => {
  const content = readFileSync(CANVAS_FILE, 'utf8')
  // At least one var(--accent- token present in NODE colour map
  expect(content).toMatch(/var\(--accent-/)
  // The old divergent decision-node hex must be gone
  expect(content).not.toMatch(/#db2777/)
})

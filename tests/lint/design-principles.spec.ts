import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

// ADR-0004: the brand, motion and library-area values live in ONE file.
// A component that needs a fuse duration or an area colour reads the token;
// this guard keeps the tokens from being deleted or renamed out from under it.
const theme = fs.readFileSync(path.join(process.cwd(), 'src/styles/blueprint-theme.css'), 'utf8')

const REQUIRED = [
  '--wm-ink', '--wm-accent', '--wm-size-hero', '--wm-size-header', '--wm-size-phone',
  '--ease-fuse', '--dur-fuse-meet', '--dur-fuse-hold', '--dur-fuse-rise', '--dur-fuse-short',
  '--dur-map-zoom', '--dur-hover-lift',
  ...Array.from({ length: 8 }, (_, i) => `--area-${i + 1}`),
]

test('ADR-0004 tokens are defined in blueprint-theme.css', () => {
  const missing = REQUIRED.filter((t) => !new RegExp(`${t}\\s*:`).test(theme))
  expect(missing).toEqual([])
})

test('ADR-0004 is in the ADR index', () => {
  const index = fs.readFileSync(path.join(process.cwd(), 'docs/adr/README.md'), 'utf8')
  expect(index).toContain('0004-design-principles.md')
})

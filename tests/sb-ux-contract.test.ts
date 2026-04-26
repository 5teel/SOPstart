import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')

test('SB-UX-04 (contract): three-place contract script exits 0', () => {
  try {
    const out = execSync('npx tsx scripts/contract-check.ts', {
      encoding: 'utf8',
      cwd: ROOT,
    })
    expect(out).toContain('OK. Three-place contract intact.')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Contract check failed:\n${message}`)
  }
})

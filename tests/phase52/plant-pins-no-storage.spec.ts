/**
 * Phase 52 -- HOM-02, D-05, SC-2. Pins are derived, never stored — no new
 * table, column, store or Dexie table backs the count. One classifier only.
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

function listFiles(dir: string, out: string[] = []): string[] {
  const full = path.join(ROOT, dir)
  if (!fs.existsSync(full)) return out
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      listFiles(entryPath, out)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(entryPath)
    }
  }
  return out
}

test('(a) no migration adds a pin/plant table or column', () => {
  const migrationsDir = path.join(ROOT, 'supabase', 'migrations')
  const pinPattern = /\bpins?\b|pin_count|plant_/i
  const ddlPattern = /create\s+table|add\s+column/i
  const violations: string[] = []
  for (const file of fs.readdirSync(migrationsDir)) {
    if (!file.endsWith('.sql')) continue
    const text = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    for (const line of text.split(/\r?\n/)) {
      if (ddlPattern.test(line) && pinPattern.test(line)) violations.push(`${file}: ${line.trim()}`)
    }
  }
  expect(violations).toEqual([])
})

test('(b) no file under src/stores/ mentions pin or plant', () => {
  // Word-boundary match -- a substring hit inside an unrelated identifier
  // (e.g. markStepIncomplete contains "...tepIncomplete", which is NOT the
  // word "pin") is not a violation.
  const files = listFiles('src/stores')
  const violations = files.filter((f) => /\bpins?\b|\bplant\w*/i.test(read(f)))
  expect(violations).toEqual([])
})

test('(d) worker-signal.ts has no I/O -- no supabase, no localStorage, no create(', () => {
  const src = read('src/lib/sop/worker-signal.ts')
  expect(src.includes('supabase')).toBe(false)
  expect(src.includes('localStorage')).toBe(false)
  expect(src.includes('create(')).toBe(false)
})

test('(e) one classifier: worker-signal.ts owns plantRelState (and topSignal while it has a consumer); no other src/ file redefines either', () => {
  const workerSignalSrc = read('src/lib/sop/worker-signal.ts')
  expect(workerSignalSrc).toContain('export function plantRelState')

  const files = listFiles('src').filter((f) => f.split(path.sep).join('/') !== 'src/lib/sop/worker-signal.ts')
  const violations = files.filter((f) => /function\s+(topSignal|plantRelState)\b/.test(read(f)))
  expect(violations).toEqual([])
})

test('(f) the plant directory renders what worker-signal classifies -- it never classifies or stores', () => {
  const plantDir = path.join(ROOT, 'src', 'components', 'sop', 'plant')
  if (!fs.existsSync(plantDir)) {
    test.skip(true, 'src/components/sop/plant/ does not exist yet beyond RelBadge.tsx (full surface lands in 52-02+)')
    return
  }
  const files = listFiles('src/components/sop/plant')
  const bannedPattern = /isRefresherDue|isRefresherOverdue|hasNewerVersion|localStorage|sessionStorage|zustand|\.put\(|\.bulkPut\(|\.add\(|\.delete\(/
  const violations: string[] = []
  for (const f of files) {
    const text = read(f)
    if (bannedPattern.test(text)) violations.push(f)
  }
  expect(violations).toEqual([])
})

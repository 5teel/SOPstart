/**
 * Phase 22 — VDW-LIT-03: TTS route source-contract assertions.
 *
 * Turns GREEN when Plan 02 ships `src/app/api/voice/tts/route.ts`.
 * At Wave-0 head these specs FAIL (clean assertion red — the file does not exist yet).
 *
 * CLAUDE.md 2026-06-05: assert WIRING, not just token presence.
 * Asserts:
 *   - Route file exists
 *   - Auth gate: `supabase.auth.getUser()` present (workers are authed)
 *   - TTS model: imported from shared constant (`@/lib/voice/tts-constants` or `TTS_MODEL`)
 *     OR references `gpt-4o-mini-tts` but NOT as a bare hardcoded string literal in the route body
 *   - Concurrency cap: `inFlight` Set present (per-user concurrency guard, mirror query/route.ts)
 *   - Input bound: `max(500)` or `length > 500` (TTS DoS mitigation, T-22-01-02)
 *
 * Pattern: fs.readFileSync + toContain (source-contract file-walk).
 * Registration: phase22-stubs project in playwright.config.ts
 * (CLAUDE.md 2026-05-25: unregistered specs never run).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')
const TTS_ROUTE_PATH = path.join(REPO_ROOT, 'src', 'app', 'api', 'voice', 'tts', 'route.ts')

function readTtsRoute(): string {
  return fs.readFileSync(TTS_ROUTE_PATH, 'utf-8')
}

test('VDW-LIT-03: TTS route file exists', () => {
  expect(
    fs.existsSync(TTS_ROUTE_PATH),
    `TTS route not found at ${TTS_ROUTE_PATH} — create it in Plan 02`,
  ).toBe(true)
})

test('VDW-LIT-03: TTS route is auth-gated (supabase.auth.getUser)', () => {
  const text = readTtsRoute()
  expect(text).toContain('supabase.auth.getUser()')
})

test('VDW-LIT-03: TTS route references TTS_MODEL constant or shared tts-constants import (not bare hardcoded model string in route body)', () => {
  const text = readTtsRoute()
  // Accept either: imported from tts-constants module, OR uses a named TTS_MODEL constant.
  // Reject: bare `'gpt-4o-mini-tts'` string literal directly in the route handler body
  // without going through a named constant (encourages DRY model ID per CLAUDE.md learning 2026-06-02).
  const hasConstantImport =
    text.includes('@/lib/voice/tts-constants') || text.includes('TTS_MODEL')
  const hasBareHardcode =
    // A bare hardcoded string in the route body (not inside a constants file)
    text.includes("'gpt-4o-mini-tts'") && !hasConstantImport
  expect(
    hasConstantImport || !hasBareHardcode,
    'TTS route should use TTS_MODEL constant or import from tts-constants — avoid bare hardcoded model string (CLAUDE.md 2026-06-02: hardcoded model IDs silently rot)',
  ).toBe(true)
})

test('VDW-LIT-03: TTS route has inFlight concurrency cap', () => {
  const text = readTtsRoute()
  expect(text).toContain('inFlight')
})

test('VDW-LIT-03: TTS route enforces 500-char input bound', () => {
  const text = readTtsRoute()
  // Accept Zod max(500) or inline length > 500 guard
  const hasZodMax = text.includes('max(500)')
  const hasInlineCheck = text.includes('length > 500') || text.includes('length >= 500') || text.includes('.length>500') || text.includes('.length>=500')
  expect(
    hasZodMax || hasInlineCheck,
    'TTS route must enforce 500-char input bound (DoS mitigation T-22-01-02)',
  ).toBe(true)
})

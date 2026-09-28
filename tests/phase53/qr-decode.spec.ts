/**
 * Phase 53 -- PHN-03. Unit tests for the plate URL builder and the
 * "is this our plate" scanned-URL validator.
 *
 * Registration: playwright.config.ts `phase53` project
 *   testDir: '.', testMatch: /tests\/phase53\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase53`
 *
 * Static @/ imports only -- CLAUDE.md 2026-06-24.
 */
import { test, expect } from '@playwright/test'
import { normaliseMachineCode, plateUrl, extractMachineCode, isOurPlateUrl } from '@/lib/site/qr-decode'
import { newMachineCode } from '@/lib/site/scene'

const O = 'https://sopstart.com'

test.describe('qr-decode', () => {
  test('normaliseMachineCode trims and upper-cases valid codes, rejects invalid shapes', () => {
    expect(normaliseMachineCode(' ab12cd ')).toBe('AB12CD')
    expect(normaliseMachineCode('ABCDEI')).toBeNull() // I is not in the alphabet
    expect(normaliseMachineCode('AB12C')).toBeNull()
    expect(normaliseMachineCode('AB12CDE')).toBeNull()
    expect(normaliseMachineCode('')).toBeNull()
  })

  test('plateUrl builds an absolute /m/<code> URL, normalising the code and origin', () => {
    expect(plateUrl(O, 'AB12CD')).toBe('https://sopstart.com/m/AB12CD')
    expect(plateUrl(O + '/', 'ab12cd')).toBe('https://sopstart.com/m/AB12CD')
    expect(() => plateUrl(O, 'nope!')).toThrow()
  })

  test('extractMachineCode returns the code for a same-origin /m/<code> URL, dropping query/hash', () => {
    expect(extractMachineCode('https://sopstart.com/m/AB12CD', O)).toBe('AB12CD')
    expect(extractMachineCode('https://sopstart.com/m/AB12CD/', O)).toBe('AB12CD')
    expect(extractMachineCode('https://sopstart.com/m/ab12cd', O)).toBe('AB12CD')
    expect(extractMachineCode('https://sopstart.com/m/AB12CD?x=1#h', O)).toBe('AB12CD')
  })

  test('extractMachineCode returns null for foreign origins, schemes, path shapes and non-URLs', () => {
    expect(extractMachineCode('https://evil.com/m/AB12CD', O)).toBeNull()
    expect(extractMachineCode('https://sopstart.com.evil.com/m/AB12CD', O)).toBeNull()
    expect(extractMachineCode('http://sopstart.com/m/AB12CD', O)).toBeNull()
    expect(extractMachineCode('https://sopstart.com/m/AB12CD/extra', O)).toBeNull()
    expect(extractMachineCode('https://sopstart.com/sops/AB12CD', O)).toBeNull()
    expect(extractMachineCode('https://sopstart.com/m/ABCDEI', O)).toBeNull()
    expect(extractMachineCode('javascript:alert(1)', O)).toBeNull()
    expect(extractMachineCode('//sopstart.com/m/AB12CD', O)).toBeNull()
    expect(extractMachineCode('AB12CD', O)).toBeNull()
    expect(extractMachineCode('', O)).toBeNull()
  })

  test('isOurPlateUrl agrees exactly with extractMachineCode !== null', () => {
    const cases = [
      'https://sopstart.com/m/AB12CD',
      'https://sopstart.com/m/AB12CD/',
      'https://sopstart.com/m/ab12cd',
      'https://sopstart.com/m/AB12CD?x=1#h',
      'https://evil.com/m/AB12CD',
      'https://sopstart.com.evil.com/m/AB12CD',
      'http://sopstart.com/m/AB12CD',
      'https://sopstart.com/m/AB12CD/extra',
      'https://sopstart.com/sops/AB12CD',
      'https://sopstart.com/m/ABCDEI',
      'javascript:alert(1)',
      '//sopstart.com/m/AB12CD',
      'AB12CD',
      '',
    ]
    for (const c of cases) {
      expect(isOurPlateUrl(c, O)).toBe(extractMachineCode(c, O) !== null)
    }
  })

  test('round trip: plateUrl then extractMachineCode returns the original code, for 50 generated codes', () => {
    for (let i = 0; i < 50; i++) {
      const code = newMachineCode()
      expect(extractMachineCode(plateUrl(O, code), O)).toBe(code)
    }
  })
})

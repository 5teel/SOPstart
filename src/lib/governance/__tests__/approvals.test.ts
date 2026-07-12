import { test, expect } from '@playwright/test'
import { resolveNextStepIndex, stepMatchesCaller, isChainComplete } from '@/lib/governance/approvals'

test.describe('resolveNextStepIndex', () => {
  test('returns first unapproved index', () => {
    expect(resolveNextStepIndex(3, new Set([0, 1]))).toBe(2)
  })

  test('returns -1 when every step approved', () => {
    expect(resolveNextStepIndex(3, new Set([0, 1, 2]))).toBe(-1)
  })

  test('returns 0 when nothing approved yet', () => {
    expect(resolveNextStepIndex(3, new Set())).toBe(0)
  })

  test('only counts indexes explicitly present in the approved set (changes_requested rows must be excluded by the caller before calling this)', () => {
    // Contract: approvedStepIndexes must be built from action='approved' rows
    // ONLY. A changes_requested row must never appear in this set.
    expect(resolveNextStepIndex(2, new Set([0]))).toBe(1)
  })
})

test.describe('stepMatchesCaller', () => {
  test('matches on userId', () => {
    expect(stepMatchesCaller({ userId: 'u1', label: 'Step' }, { userId: 'u1', role: 'admin' })).toBe(true)
  })

  test('matches on role', () => {
    expect(stepMatchesCaller({ role: 'safety_manager', label: 'Step' }, { userId: 'u2', role: 'safety_manager' })).toBe(true)
  })

  test('rejects when neither userId nor role matches', () => {
    expect(stepMatchesCaller({ userId: 'u1', label: 'Step' }, { userId: 'u2', role: 'admin' })).toBe(false)
    expect(stepMatchesCaller({ role: 'safety_manager', label: 'Step' }, { userId: 'u2', role: 'admin' })).toBe(false)
  })
})

test.describe('isChainComplete', () => {
  test('true iff resolveNextStepIndex is -1', () => {
    expect(isChainComplete(2, new Set([0, 1]))).toBe(true)
    expect(isChainComplete(2, new Set([0]))).toBe(false)
  })
})

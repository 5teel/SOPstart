import { test, expect } from '@playwright/test'
import { classifyCompetency, type CompetencyEvidence } from '@/lib/competency/classify'

const base: CompetencyEvidence = {
  hasCompletion: false,
  hasPerformedToSopObservation: false,
  hasSignOff: false,
  latestNeedsSupportAt: null,
  latestPositiveEvidenceAt: null,
}

test.describe('classifyCompetency', () => {
  test('no evidence -> not_started', () => {
    const result = classifyCompetency(base)
    expect(result.state).toBe('not_started')
    expect(result.needsSupportFlag).toBe(false)
    expect(result.awaitingSignOff).toBe(false)
  })

  test('completion only -> read + awaitingSignOff true', () => {
    const result = classifyCompetency({ ...base, hasCompletion: true })
    expect(result.state).toBe('read')
    expect(result.awaitingSignOff).toBe(true)
  })

  test('performed_to_sop only -> supervised', () => {
    const result = classifyCompetency({ ...base, hasPerformedToSopObservation: true })
    expect(result.state).toBe('supervised')
    expect(result.awaitingSignOff).toBe(false)
  })

  test('sign-off only -> competent_signed_off (D-01, no observation prerequisite)', () => {
    const result = classifyCompetency({ ...base, hasSignOff: true })
    expect(result.state).toBe('competent_signed_off')
  })

  test('sign-off + newer needs_support -> read + needsSupportFlag true (D-02)', () => {
    const result = classifyCompetency({
      ...base,
      hasCompletion: true,
      hasSignOff: true,
      latestPositiveEvidenceAt: '2026-01-01T00:00:00.000Z',
      latestNeedsSupportAt: '2026-02-01T00:00:00.000Z',
    })
    expect(result.state).toBe('read')
    expect(result.needsSupportFlag).toBe(true)
    expect(result.awaitingSignOff).toBe(false)
  })

  test('needs_support OLDER than latest positive -> stays competent_signed_off, no flag', () => {
    const result = classifyCompetency({
      ...base,
      hasCompletion: true,
      hasSignOff: true,
      latestPositiveEvidenceAt: '2026-02-01T00:00:00.000Z',
      latestNeedsSupportAt: '2026-01-01T00:00:00.000Z',
    })
    expect(result.state).toBe('competent_signed_off')
    expect(result.needsSupportFlag).toBe(false)
  })

  test('observation-only (no completion) + newer needs_support -> not_started + flag (never fabricates read)', () => {
    const result = classifyCompetency({
      ...base,
      hasPerformedToSopObservation: true,
      latestPositiveEvidenceAt: '2026-01-01T00:00:00.000Z',
      latestNeedsSupportAt: '2026-02-01T00:00:00.000Z',
    })
    expect(result.state).toBe('not_started')
    expect(result.needsSupportFlag).toBe(true)
    expect(result.awaitingSignOff).toBe(false)
  })

  test('completion + observation + newer needs_support -> read + flag (floor stays at read when the completion happened)', () => {
    const result = classifyCompetency({
      ...base,
      hasCompletion: true,
      hasPerformedToSopObservation: true,
      latestPositiveEvidenceAt: '2026-01-01T00:00:00.000Z',
      latestNeedsSupportAt: '2026-02-01T00:00:00.000Z',
    })
    expect(result.state).toBe('read')
    expect(result.needsSupportFlag).toBe(true)
    expect(result.awaitingSignOff).toBe(false)
  })

  test('not_started + needs_support -> stays not_started, no flag (never demotes below read)', () => {
    const result = classifyCompetency({
      ...base,
      latestNeedsSupportAt: '2026-01-01T00:00:00.000Z',
    })
    expect(result.state).toBe('not_started')
    expect(result.needsSupportFlag).toBe(false)
  })
})

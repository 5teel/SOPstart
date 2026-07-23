import { test, expect } from '@playwright/test'
import { generateTrainingCsv, csvField, type TrainingCsvRow } from '@/lib/competency/csv'

const row: TrainingCsvRow = {
  workerEmail: 'worker@example.com',
  workerName: null,
  sopIdentifier: 'A-1',
  sopTitle: 'Lockout Tagout',
  sopVersion: 3,
  completionDate: '2026-01-01T00:00:00.000Z',
  signoffStatus: 'approved',
  signoffBy: 'supervisor@example.com',
  signoffDate: '2026-01-02T00:00:00.000Z',
}

test.describe('generateTrainingCsv', () => {
  test('emits a header row then one row per completion', () => {
    const csv = generateTrainingCsv([row, { ...row, sopIdentifier: 'A-2' }])
    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'worker_email,worker_name,sop_identifier,sop_title,sop_version,completion_date,signoff_status,signoff_by,signoff_date',
    )
    expect(lines).toHaveLength(3)
  })

  test('worker_name falls back to worker_email when no name supplied (A1)', () => {
    const csv = generateTrainingCsv([row])
    const dataLine = csv.split('\n')[1]
    expect(dataLine).toContain('worker@example.com,worker@example.com')
  })

  test('a comma-bearing SOP title is wrapped in double quotes (RFC-4180)', () => {
    const csv = generateTrainingCsv([{ ...row, sopTitle: 'Lockout, Tagout' }])
    expect(csv).toContain('"Lockout, Tagout"')
  })

  test('csvField doubles embedded quotes', () => {
    expect(csvField('He said "go"')).toBe('"He said ""go"""')
  })

  test('csvField leaves plain values unquoted', () => {
    expect(csvField('plain-value')).toBe('plain-value')
  })
})

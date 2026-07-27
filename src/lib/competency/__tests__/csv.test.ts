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
  onCurrentVersion: true,
  refresherDueDate: null,
}

test.describe('generateTrainingCsv', () => {
  test('emits a header row then one row per completion', () => {
    const csv = generateTrainingCsv([row, { ...row, sopIdentifier: 'A-2' }])
    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'worker_email,worker_name,sop_identifier,sop_title,sop_version,completion_date,signoff_status,signoff_by,signoff_date,on_current_version,refresher_due_date',
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

  test('csvField neutralizes formula triggers with a leading apostrophe (CSV injection)', () => {
    expect(csvField('=HYPERLINK("http://evil.example","click")')).toBe(
      '"\'=HYPERLINK(""http://evil.example"",""click"")"',
    )
    expect(csvField('+worker@example.com')).toBe("'+worker@example.com")
    expect(csvField('-2 handed lift')).toBe("'-2 handed lift")
    expect(csvField('@sheet')).toBe("'@sheet")
  })

  test('csvField force-quotes a bare CR (RFC 4180)', () => {
    expect(csvField('line one\rline two')).toBe('"line one\rline two"')
  })

  // Phase 36 (D-05/D-07) ----------------------------------------------------

  test('onCurrentVersion true emits yes; false emits no (D-05)', () => {
    const csvYes = generateTrainingCsv([{ ...row, onCurrentVersion: true }])
    expect(csvYes.split('\n')[1].endsWith(',yes,')).toBe(true)

    const csvNo = generateTrainingCsv([{ ...row, onCurrentVersion: false }])
    expect(csvNo.split('\n')[1].endsWith(',no,')).toBe(true)
  })

  test('refresherDueDate null emits an empty trailing field, never the string "null" (D-02)', () => {
    const csv = generateTrainingCsv([{ ...row, refresherDueDate: null }])
    const dataLine = csv.split('\n')[1]
    expect(dataLine.endsWith(',')).toBe(true)
    expect(dataLine).not.toContain('null')
  })

  test('refresherDueDate set is emitted verbatim through csvField', () => {
    const csv = generateTrainingCsv([{ ...row, refresherDueDate: '2026-07-01T00:00:00.000Z' }])
    const dataLine = csv.split('\n')[1]
    expect(dataLine.endsWith(',2026-07-01T00:00:00.000Z')).toBe(true)
  })
})

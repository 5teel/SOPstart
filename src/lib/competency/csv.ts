// ------------------------------------------------------------
// generateTrainingCsv
// Pure generator — rows in, RFC-4180-safe CSV string out. No I/O, no
// server-action directive, no Supabase client import. One row per completion
// event (D-14,
// SuccessFactors Learning-History-shaped LEARNING EVENTS, not state
// snapshots).
//
// Columns are a defensible GENERIC training-events shape — the exact SF
// Learning History column names/order are UNVERIFIED (RESEARCH Assumption
// A2: SAP gates the real connector template behind a live tenant's Admin
// Console). worker_name falls back to worker_email because no full-name
// field exists anywhere in this codebase (RESEARCH Assumption A1) — do not
// invent a full_name source.
// ------------------------------------------------------------

export interface TrainingCsvRow {
  workerEmail: string
  workerName: string | null
  sopIdentifier: string
  sopTitle: string
  sopVersion: number | null
  completionDate: string
  signoffStatus: string | null
  signoffBy: string | null
  signoffDate: string | null
}

const HEADER = [
  'worker_email',
  'worker_name',
  'sop_identifier',
  'sop_title',
  'sop_version',
  'completion_date',
  'signoff_status',
  'signoff_by',
  'signoff_date',
]

export function csvField(val: string | number | null): string {
  const str = val === null || val === undefined ? '' : String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function generateTrainingCsv(rows: TrainingCsvRow[]): string {
  const lines = [HEADER.join(',')]
  for (const row of rows) {
    lines.push(
      [
        csvField(row.workerEmail),
        csvField(row.workerName ?? row.workerEmail),
        csvField(row.sopIdentifier),
        csvField(row.sopTitle),
        csvField(row.sopVersion),
        csvField(row.completionDate),
        csvField(row.signoffStatus),
        csvField(row.signoffBy),
        csvField(row.signoffDate),
      ].join(','),
    )
  }
  return lines.join('\n')
}

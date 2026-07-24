/**
 * Phase 35 Plan 03 Task 4 — client-side Blob download helper (D-16).
 * Forks the FlowGraphCanvas PNG-export idiom verbatim (src/components/sop/
 * flow/FlowGraphCanvas.tsx) — one shared helper so the Blob dance isn't
 * inlined twice across the matrix header export and the per-worker record
 * export. Plain client module, no server directive.
 */

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

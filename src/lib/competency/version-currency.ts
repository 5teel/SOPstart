// ------------------------------------------------------------
// isOutdatedVersion
// Pure helper — compares a worker's latest completion version against the
// SOP's current version (CMP-03/D-06). No server-action directive, no I/O —
// sync export so it stays directly unit-testable (2026-06-27 learning: a
// sync export inside a server-action module breaks `next build`). Mirrors
// the extraction discipline of src/lib/governance/cadences.ts.
//
// D-06: no completion is "not started", never "outdated" — null latest
// version never renders an outdated chip. An unknown current version
// (null) also never fabricates a chip. Compares the monotonic `version`
// INTEGER on sops, never sop UUIDs.
//
// Consumers: src/lib/competency/matrix.ts, src/actions/competency.ts,
// src/app/(protected)/sops/page.tsx.
// ------------------------------------------------------------

export function isOutdatedVersion(
  latestCompletionVersion: number | null,
  currentVersion: number | null
): boolean {
  if (latestCompletionVersion === null || currentVersion === null) return false
  return latestCompletionVersion < currentVersion
}

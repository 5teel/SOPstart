/**
 * Phase 63 -- search text helpers. Plain module. The term goes into a PostgREST
 * `.or()` filter (T-63-11), so the characters that filter syntax reserves are
 * removed before it ever leaves the browser.
 */
const MAX = 60

/** Trimmed, reserved characters stripped, capped at 60; null under 2 characters. */
export function sanitizeSearch(q: string): string | null {
  // , ( ) split or group a filter; * % are wildcards; \ " quote; { } would break the tools array literal.
  const clean = q.replace(/[,()*%\\"{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX).trim()
  return clean.length < 2 ? null : clean
}

/** Case-insensitive match over what the row itself says. */
export function matchesTitle(row: { title: string; areaName: string; type: string }, q: string): boolean {
  const needle = q.trim().toLowerCase()
  return !needle || `${row.title} ${row.areaName} ${row.type}`.toLowerCase().includes(needle)
}

/**
 * Phase 57 (D-22): department helpers shared by the server actions and the
 * strip. Plain module -- a 'use server' file may only export async functions.
 */

/**
 * Allowed department colours (V5 -- z.enum prevents CSS injection).
 * Exactly the 8 hex values from 25-UI-SPEC.md colour table.
 */
export const DEPT_COLOURS = [
  '#f97316', // orange  -- slot 1
  '#3b82f6', // blue    -- slot 2
  '#06b6d4', // cyan    -- slot 3
  '#10b981', // green   -- slot 4
  '#ec4899', // pink    -- slot 5
  '#ef4444', // red     -- slot 6
  '#fbbf24', // amber   -- slot 7
  '#8b5cf6', // violet  -- slot 8
] as const

const CODE_MAX = 6

/**
 * A short upper-case code from a name: initials for two or more words, the
 * first three letters/digits of a single word, 'D' when nothing usable.
 * A code already in `taken` (case-insensitive) gets a numeric suffix (FOR2,
 * FOR3 ...), trimming the base so the result stays at most 6 characters.
 */
export function deriveDepartmentCode(name: string, taken: ReadonlyArray<string>): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean)
  const base =
    words.length >= 2
      ? words.map((w) => w[0]).join('').slice(0, CODE_MAX)
      : (words[0] ?? '').slice(0, 3)
  const root = (base || 'D').toUpperCase()

  const used = new Set(taken.map((c) => c.toUpperCase()))
  if (!used.has(root)) return root
  for (let n = 2; n < 100; n++) {
    const suffix = String(n)
    const candidate = root.slice(0, CODE_MAX - suffix.length) + suffix
    if (!used.has(candidate)) return candidate
  }
  // ponytail: 98 same-prefix departments in one org is not a real case; the
  // DB unique constraint would reject a clash and surface the error.
  return root
}

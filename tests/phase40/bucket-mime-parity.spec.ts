import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Phase 40 UAT test-3 gap closure — the third accept list.
 *
 * DUP-01 unified the client validator (file-intake.ts) and the server zod
 * schema (validators/sop.ts). It missed a third list one layer lower: the
 * sop-documents bucket's own `allowed_mime_types`, fixed at bucket creation in
 * 00005 and never updated, so xlsx/pptx/txt/webp cleared both code checks and
 * were rejected by storage with a generic "Upload failed".
 *
 * This spec pins the two lists together. It reads the source of truth
 * (ACCEPTED_MIME_TYPES) and the migration that configures the bucket, so adding
 * a format to the code accept list without adding it to the bucket fails here
 * rather than in production.
 *
 * Two exclusions are deliberate and asserted as such, not merely tolerated:
 *   - video/*      — uploads to sop-videos, never to sop-documents
 *   - image/heic|heif — converted to JPEG client-side before upload
 */

const ROOT = process.cwd()
const INTAKE = join(ROOT, 'src/lib/upload/file-intake.ts')
const MIGRATION = join(ROOT, 'supabase/migrations/00060_sop_documents_mime_parity.sql')

/** Types accepted by code but deliberately absent from the sop-documents bucket. */
const EXCLUDED = ['video/mp4', 'video/quicktime', 'image/heic', 'image/heif']

function read(path: string): string {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

/** Pull the string literals out of the ACCEPTED_MIME_TYPES array. */
function acceptedMimeTypes(): string[] {
  const src = read(INTAKE)
  const block = src.match(/export const ACCEPTED_MIME_TYPES = \[([\s\S]*?)\] as const/)
  expect(block, 'ACCEPTED_MIME_TYPES array not found in file-intake.ts').not.toBeNull()
  return [...block![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

/** Pull the string literals out of 00060's array, ignoring -- comments. */
function bucketMimeTypes(): string[] {
  const sql = read(MIGRATION)
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n')
  const block = sql.match(/set allowed_mime_types = array\[([\s\S]*?)\]/)
  expect(block, 'allowed_mime_types array not found in 00060').not.toBeNull()
  return [...block![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

test('00060 targets the sop-documents bucket and only updates its MIME list', () => {
  const sql = read(MIGRATION)
  expect(sql).toContain("where id = 'sop-documents'")
  expect(sql).toContain('update storage.buckets')
  // A MIME-parity migration must not quietly carry schema or policy changes.
  expect(sql.toLowerCase()).not.toContain('drop policy')
  expect(sql.toLowerCase()).not.toContain('create table')
  expect(sql.toLowerCase()).not.toContain('drop column')
  expect(sql.toLowerCase()).not.toContain('security definer')
})

test('every code-accepted type is storable, except the documented exclusions', () => {
  const accepted = acceptedMimeTypes()
  const bucket = bucketMimeTypes()

  expect(accepted.length, 'ACCEPTED_MIME_TYPES should not be empty').toBeGreaterThan(0)

  const shouldStore = accepted.filter((t) => !EXCLUDED.includes(t))
  const missing = shouldStore.filter((t) => !bucket.includes(t))

  expect(
    missing,
    `These types are accepted by file-intake.ts but the sop-documents bucket ` +
      `would reject them, so the upload dies at uploadToSignedUrl with a generic ` +
      `"Upload failed": ${missing.join(', ')}. Add them to 00060 (or a later ` +
      `migration) and apply it live.`
  ).toEqual([])
})

test('the bucket grants nothing the code accept list does not', () => {
  const accepted = acceptedMimeTypes()
  const extra = bucketMimeTypes().filter((t) => !accepted.includes(t))

  expect(
    extra,
    `The sop-documents bucket allows types the app never accepts: ${extra.join(', ')}. ` +
      `Storage scope should not exceed what the intake module admits.`
  ).toEqual([])
})

test('the deliberate exclusions are genuinely excluded', () => {
  const bucket = bucketMimeTypes()
  for (const t of EXCLUDED) {
    expect(
      bucket.includes(t),
      `${t} is excluded on purpose — video routes to the sop-videos bucket, and ` +
        `HEIC is converted to JPEG client-side before upload. Granting it here ` +
        `widens storage scope beyond any real upload path.`
    ).toBe(false)
  }
})

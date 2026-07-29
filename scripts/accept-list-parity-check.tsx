/**
 * Phase 40 -- DUP-01 gap closure (40-10 Task 2 / 40-REVIEW.md IN-03).
 *
 * Runnable parity proof between the shared intake module's accept/blocked
 * lists and the REAL server-side zod schemas in src/lib/validators/sop.ts --
 * not a grep/substring match. For every MIME type the shared module
 * advertises as accepted, this proves the real uploadFileSchema (or
 * uploadVideoFileSchema, for video types) actually accepts it, and that
 * getSourceFileType does not throw. For every blocked MIME type, it proves
 * uploadFileSchema actually rejects it.
 *
 * tsx subprocess harness, modelled on scripts/ai-overlay-check.tsx -- no
 * React needed here, so no module-extension shims.
 * CLI: npx tsx scripts/accept-list-parity-check.tsx
 */
/* eslint-disable @typescript-eslint/no-require-imports */
export {} // isolate module scope from sibling *-check.tsx harnesses

const {
  ACCEPTED_MIME_TYPES,
  BLOCKED_MIME_TYPES,
  VIDEO_MIME_TYPES,
} = require('../src/lib/upload/file-intake') as typeof import('../src/lib/upload/file-intake')

const {
  uploadFileSchema,
  uploadVideoFileSchema,
  getSourceFileType,
} = require('../src/lib/validators/sop') as typeof import('../src/lib/validators/sop')

const failures: string[] = []
const check = (cond: boolean, msg: string) => {
  if (!cond) failures.push(msg)
}

let checkedCount = 0

for (const mime of ACCEPTED_MIME_TYPES) {
  checkedCount++

  let threw = false
  try {
    getSourceFileType(mime)
  } catch {
    threw = true
  }
  check(!threw, `getSourceFileType(${mime}) threw for an accepted MIME type`)

  const isVideo = (VIDEO_MIME_TYPES as readonly string[]).includes(mime)
  if (isVideo) {
    const result = uploadVideoFileSchema.safeParse({ name: 'f.mp4', size: 1024, type: mime })
    check(result.success, `uploadVideoFileSchema rejected accepted video type ${mime}`)
  } else {
    const result = uploadFileSchema.safeParse({ name: 'f.bin', size: 1024, type: mime })
    check(result.success, `uploadFileSchema rejected accepted type ${mime}`)
  }
}

for (const mime of BLOCKED_MIME_TYPES) {
  checkedCount++
  const result = uploadFileSchema.safeParse({ name: 'f.xlsx', size: 1024, type: mime })
  check(!result.success, `uploadFileSchema ACCEPTED a blocked macro MIME type ${mime}`)
}

if (failures.length > 0) {
  console.error('ACCEPT-LIST PARITY FAILED:')
  for (const f of failures) console.error('  -', f)
  process.exit(1)
}

console.log(`ACCEPT-LIST PARITY OK (${checkedCount} types)`)

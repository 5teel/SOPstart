/**
 * Phase 40 -- DUP-01 (D-04/D-05): the single shared file-intake module.
 *
 * Owns the accept list, blocked-extension list, size limits and HEIC->JPEG
 * conversion used by every creation-side upload surface (UploadDropzone,
 * VideoFormatSelectionModal, and eventually the versions re-upload flow --
 * see plan 40-07). One list, no per-context profiles (D-05).
 *
 * Plain module, no 'use client' -- imported by client components only.
 */

// D-04: canonical accept list. `application/msword` (.doc) is deliberately
// ABSENT -- mammoth cannot parse .doc, and the old new-version page's
// acceptance of it was a silent accept-then-fail bug.
export const ACCEPTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain', // .txt
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime', // .mov
] as const

// ASVS V5 security control, not a UX nicety -- copied verbatim from
// UploadDropzone.tsx:40. Checked FIRST in validateIntakeFile, before any
// parser or conversion library reads the file.
export const BLOCKED_EXTENSIONS = ['.xlsm', '.xlsb', '.xltm', '.pptm', '.potm', '.ppam'] as const

// Macro-enabled Office formats — blocked for security (cannot be safely parsed).
// Checked alongside BLOCKED_EXTENSIONS so a macro workbook renamed to .xlsx
// (extension check bypassed) is still caught by its declared MIME type.
export const BLOCKED_MIME_TYPES = [
  'application/vnd.ms-excel.sheet.macroEnabled.12', // xlsm
  'application/vnd.ms-powerpoint.presentation.macroEnabled.12', // pptm
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12', // xlsb
] as const

export const HEIC_MIME_TYPES = ['image/heic', 'image/heif'] as const
export const HEIC_EXTENSIONS = ['.heic', '.heif'] as const

export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
export const MAX_VIDEO_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2GB

export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime'] as const

export function isVideoFile(file: File | { type: string }): boolean {
  return (VIDEO_MIME_TYPES as readonly string[]).includes(file.type)
}

// Single accept attribute value for every <input type="file" accept=...> in
// the app (D-05). Extension aliases are included for the Office types since
// some browsers/OSes only match on extension for those.
export const ACCEPT_ATTR = [
  '.docx',
  '.pdf',
  '.xlsx',
  '.pptx',
  '.txt',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
].join(',')

export const INTAKE_HINT =
  'Word (.docx), PDF, Excel (.xlsx), PowerPoint (.pptx), plain text (.txt), photos (JPEG/PNG/WebP/HEIC), or MP4/MOV video up to 2GB'

export function isHeicFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return (
    (HEIC_MIME_TYPES as readonly string[]).includes(file.type) ||
    (HEIC_EXTENSIONS as readonly string[]).some((ext) => lower.endsWith(ext))
  )
}

/**
 * Converts a HEIC/HEIF file to JPEG client-side via heic2any (the sole
 * conversion implementation already installed -- do not add a new library).
 * Returns null on failure; never throws past the caller.
 */
export async function convertHeicToJpeg(file: File): Promise<File | null> {
  try {
    const heic2any = (await import('heic2any')).default
    const blob = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })) as Blob
    const jpgName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
    return new File([blob], jpgName, { type: 'image/jpeg' })
  } catch {
    return null
  }
}

export type IntakeResult =
  | { ok: true; file: File; isVideo: boolean }
  | {
      ok: false
      reason: 'blocked-macro' | 'too-large' | 'unsupported-type' | 'heic-conversion-failed'
      message: string
    }

/**
 * Validates + (when needed) HEIC-converts a picked/dropped file.
 *
 * Evaluation order is load-bearing:
 *   1. blocked-extension check (security control -- before anything reads the file)
 *   2. size check against the video-aware limit
 *   3. HEIC conversion (a HEIC file's MIME isn't always reported by the browser,
 *      so the type check below must run AFTER conversion)
 *   4. accepted-MIME-type check on the post-conversion file
 */
export async function validateIntakeFile(file: File): Promise<IntakeResult> {
  const lowerName = file.name.toLowerCase()

  if (
    (BLOCKED_EXTENSIONS as readonly string[]).some((ext) => lowerName.endsWith(ext)) ||
    (BLOCKED_MIME_TYPES as readonly string[]).includes(file.type)
  ) {
    return {
      ok: false,
      reason: 'blocked-macro',
      message: `${file.name} is not supported -- macro-enabled Office files are blocked for security. Save as .xlsx or .pptx and try again.`,
    }
  }

  const isVideo = isVideoFile(file)
  const maxSize = isVideo ? MAX_VIDEO_FILE_SIZE : MAX_FILE_SIZE
  if (file.size > maxSize) {
    return {
      ok: false,
      reason: 'too-large',
      message: isVideo
        ? `${file.name} is over 2GB. Please compress the video or split into shorter clips.`
        : `${file.name} is over 50MB and cannot be uploaded.`,
    }
  }

  let workingFile = file
  if (isHeicFile(file)) {
    const converted = await convertHeicToJpeg(file)
    if (!converted) {
      return {
        ok: false,
        reason: 'heic-conversion-failed',
        message: `Failed to convert ${file.name}. Please try a different format.`,
      }
    }
    workingFile = converted
  }

  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(workingFile.type)) {
    return {
      ok: false,
      reason: 'unsupported-type',
      message: `${file.name} is not a supported format. Use ${INTAKE_HINT}.`,
    }
  }

  return { ok: true, file: workingFile, isVideo }
}

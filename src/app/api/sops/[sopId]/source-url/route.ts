/**
 * Phase 21 (Plan 21-02, Task 1) — Signed-URL endpoint for the original
 * uploaded source document. Consumed by the admin-only `SourceViewerPane`.
 *
 * GET /api/sops/[sopId]/source-url
 *   Response shape: { url, expires_at, source_type }
 *   - url:         5-min signed URL into the private `sop-documents` /
 *                  `sop-videos` bucket (video SOPs use the videos bucket per
 *                  existing review-page pattern).
 *   - expires_at:  ISO 8601 timestamp for the URL expiry.
 *   - source_type: 'pdf' | 'docx' | 'scan' | 'video' | null. Derived from
 *                  `sops.source_file_type`. `null` when the SOP has no
 *                  source file (pre-Phase-20 SOPs or AI-prompt SOPs).
 *
 * Errors:
 *   - 401 if unauthenticated.
 *   - 403 if user is not admin / safety_manager for the SOP's organisation.
 *   - 404 if the SOP row is not visible to the caller (RLS gate).
 *   - 410 if the SOP row exists but its source file is missing from
 *         storage — viewer renders "source unavailable" placeholder.
 *
 * Trust boundary: untrusted browser → signed-URL mint. RLS on `sops` is the
 * primary gate; the `requireAdminRole` check is defence-in-depth (we don't
 * want a worker to be able to fish out the admin's source files even within
 * their own org).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/auth/session-context'
import type { SourcePaneKind, SourceUrlResponse } from '@/components/admin/source-viewer/types'

const SIGNED_URL_TTL_SECONDS = 300 // 5 minutes — short enough to bound leak risk

/**
 * Map `sops.source_file_type` (DB enum-ish text) to the discriminated
 * union the source viewer understands. Returns null for AI-prompt SOPs
 * (CONV-12 — no viewer) and for any unrecognised value.
 */
function deriveSourcePaneKind(rawType: string | null): SourcePaneKind | null {
  if (!rawType) return null
  const v = rawType.toLowerCase()
  if (v === 'pdf') return 'pdf'
  if (v === 'docx' || v === 'doc') return 'docx'
  if (v === 'image' || v === 'scan' || v === 'jpg' || v === 'jpeg' || v === 'png') return 'scan'
  if (v === 'video' || v === 'mp4' || v === 'mov' || v === 'youtube') return 'video'
  return null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
): Promise<NextResponse<SourceUrlResponse | { error: string }>> {
  const { sopId } = await params

  // 1. Auth gate.
  const { supabase, userId, role } = await getSessionContext()
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // 2. Role gate (defence-in-depth on top of RLS).
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 3. RLS-gated SOP fetch. `.single()` returns 404 path naturally if RLS
  //    denies the row to this user (different org, etc.).
  const { data: sop, error: sopError } = await supabase
    .from('sops')
    .select('source_file_path, source_file_type')
    .eq('id', sopId)
    .maybeSingle()
  if (sopError || !sop) {
    return NextResponse.json({ error: 'sop not found' }, { status: 404 })
  }

  const sourceType = deriveSourcePaneKind(sop.source_file_type ?? null)

  // 4. Pre-Phase-20 / AI-prompt SOPs: no source file path. Return 200 with
  //    null fields so the pane renders the "no source available" placeholder
  //    without throwing.
  if (!sop.source_file_path || !sourceType) {
    return NextResponse.json({ url: null, expires_at: null, source_type: sourceType }, { status: 200 })
  }

  // 5. Mint signed URL. Video SOPs live in `sop-videos`, everything else in
  //    `sop-documents` — mirrors the existing review-page bucket routing.
  const bucket = sourceType === 'video' ? 'sop-videos' : 'sop-documents'
  const { data: urlData, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(sop.source_file_path, SIGNED_URL_TTL_SECONDS)

  if (signError || !urlData?.signedUrl) {
    // Source file missing from storage — graceful 410 so the pane can show
    // a "source unavailable" placeholder (e.g. file was purged).
    return NextResponse.json({ error: 'source file missing' }, { status: 410 })
  }

  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString()
  return NextResponse.json(
    { url: urlData.signedUrl, expires_at: expiresAt, source_type: sourceType },
    { status: 200 }
  )
}

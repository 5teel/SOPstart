import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * Streams a generated video to authorised users by generating a fresh
 * signed URL for the MP4 in the private sop-generated-videos bucket.
 *
 * Storage bucket is private (RLS-protected), so direct URLs don't work.
 * This route:
 *   1. Checks the user is authenticated
 *   2. Verifies they belong to the SOP's organisation
 *   3. Generates a 1-hour signed URL
 *   4. Redirects (307) the browser to it
 *
 * The browser caches the redirect briefly — long enough for a single
 * video playback session.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params

  // 1. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 2. Look up the job and verify the user's organisation
  const { data: job, error: jobError } = await admin
    .from('video_generation_jobs')
    .select('id, video_url, organisation_id, status')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 })
  }

  if (job.status !== 'ready' || !job.video_url) {
    return NextResponse.json({ error: 'Video not ready' }, { status: 409 })
  }

  // 3. Verify user is in the same org as the video
  const { data: member } = await admin
    .from('organisation_members')
    .select('organisation_id')
    .eq('user_id', user.id)
    .eq('organisation_id', job.organisation_id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4. video_url stores the storage path. Generate a fresh signed URL.
  //    Older jobs may have stored a full public URL — extract path if so.
  const storedValue = job.video_url
  let path = storedValue
  if (storedValue.startsWith('http')) {
    // Legacy format — extract path after bucket name
    const match = storedValue.match(/sop-generated-videos\/(.+?)(\?|$)/)
    path = match ? match[1] : storedValue
  }

  const { data: signed, error: signedError } = await admin.storage
    .from('sop-generated-videos')
    .createSignedUrl(path, 3600)

  if (signedError || !signed) {
    console.error('[video-stream] signed URL error:', signedError)
    return NextResponse.json({ error: 'Failed to generate video URL' }, { status: 500 })
  }

  // 5. Redirect browser to the signed URL
  return NextResponse.redirect(signed.signedUrl, 307)
}

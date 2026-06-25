/**
 * GET /api/roster
 *
 * Returns the worker roster for the kiosk login D-11 flow.
 * Called by RosterSelector client component to fetch display names for name-select.
 *
 * Auth: requires an active session (the kiosk account session established by the admin).
 * Org scoping: the kiosk account's JWT org claim gates which members are returned.
 *
 * Returns: { members: Array<{ user_id: string; display_name: string }> }
 *
 * Security: only returns workers in the authenticated kiosk session's organisation.
 * Uses the admin auth API to read user email addresses (no user_profiles table exists —
 * CLAUDE.md 2026-04-04 pattern: names derived from email via admin.auth.admin.listUsers).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json(
      { error: 'Not authenticated. The kiosk account must be signed in.' },
      { status: 401 },
    )
  }

  // Extract organisation_id from JWT custom claims
  const { data: { session } } = await supabase.auth.getSession()
  const jwtClaims = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  if (!organisationId) {
    return NextResponse.json(
      { error: 'No organisation associated with this session.' },
      { status: 403 },
    )
  }

  const admin = createAdminClient()

  // Fetch all worker-role members in this org using admin client
  // (workers may not have SELECT on all organisation_members rows via RLS)
  const { data: members, error } = await admin
    .from('organisation_members')
    .select('user_id, role')
    .eq('organisation_id', organisationId)
    .eq('role', 'worker')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('roster GET members error:', error)
    return NextResponse.json({ error: 'Failed to load roster.' }, { status: 500 })
  }

  if (!members || members.length === 0) {
    return NextResponse.json({ members: [] })
  }

  // Fetch display names from auth.users email (no user_profiles table — CLAUDE.md pattern)
  const userIds = members.map((m) => m.user_id)
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of authUsers) {
    if (userIds.includes(u.id) && u.email) {
      emailMap[u.id] = u.email
    }
  }

  // Build display name: prefer email local-part (before @), fall back to abbreviated uid
  const rosterMembers = members.map((m) => {
    const email = emailMap[m.user_id]
    let displayName: string
    if (email) {
      // Derive readable name from email local-part (e.g. "john.smith@..." → "John Smith")
      const localPart = email.split('@')[0]
      displayName = localPart
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    } else {
      displayName = `Worker ${m.user_id.slice(0, 8)}`
    }
    return { user_id: m.user_id, display_name: displayName }
  })

  return NextResponse.json({ members: rosterMembers })
}

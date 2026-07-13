import { NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/auth/session-context'
import { UAT_TESTS, type UatFeedbackRow } from '@/lib/uat/tests'

/**
 * GET /api/uat/export
 *
 * Auth-gated, org-scoped structured export of every UAT test joined with the
 * team's feedback — the surface an AI agent reads to record & analyse results.
 * RLS on uat_feedback scopes the rows to the caller's organisation.
 */
export async function GET() {
  const { supabase, userId } = await getSessionContext()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from('uat_feedback')
    .select(
      'id, test_id, user_id, user_email, criteria_responses, preferred_direction, overall_verdict, rating, notes, created_at, updated_at'
    )
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 })
  }

  const feedback = (data ?? []) as UatFeedbackRow[]
  const byTest = new Map<string, UatFeedbackRow[]>()
  for (const row of feedback) {
    const list = byTest.get(row.test_id) ?? []
    list.push(row)
    byTest.set(row.test_id, list)
  }

  const tests = UAT_TESTS.map((t) => {
    const rows = byTest.get(t.id) ?? []
    const verdicts = rows.reduce<Record<string, number>>((acc, r) => {
      const v = r.overall_verdict ?? 'unset'
      acc[v] = (acc[v] ?? 0) + 1
      return acc
    }, {})
    return {
      ...t,
      summary: {
        responseCount: rows.length,
        verdicts,
        averageRating:
          rows.filter((r) => r.rating != null).length > 0
            ? rows.reduce((s, r) => s + (r.rating ?? 0), 0) /
              rows.filter((r) => r.rating != null).length
            : null,
      },
      feedback: rows.map((r) => ({
        reviewer: r.user_email ?? r.user_id,
        criteriaResponses: r.criteria_responses,
        preferredDirection: r.preferred_direction,
        overallVerdict: r.overall_verdict,
        rating: r.rating,
        notes: r.notes,
        updatedAt: r.updated_at,
      })),
    }
  })

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    testCount: tests.length,
    totalResponses: feedback.length,
    tests,
  })
}

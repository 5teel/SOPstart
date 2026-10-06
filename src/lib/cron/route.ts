import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { isCronAuthorized } from '@/lib/cron/auth'

const Body = z.object({ organisationId: z.string().uuid() }).strict()

/**
 * Shared POST shape for the cron routes: bearer first (401 before any read),
 * then an optional strict `{ organisationId }` body that narrows the run to one
 * organisation. The body is parsed only after auth.
 */
export async function handleCron(
  request: NextRequest,
  run: (organisationId: string | undefined) => Promise<Record<string, number>>,
) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const text = await request.text()
  let organisationId: string | undefined
  if (text.trim()) {
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'bad_body' }, { status: 400 })
    }
    const parsed = Body.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: 'bad_body' }, { status: 400 })
    organisationId = parsed.data.organisationId
  }
  return NextResponse.json(await run(organisationId))
}

import { NextRequest, NextResponse } from 'next/server'
import { createSection } from '@/actions/sections'

/**
 * POST /api/sops/[sopId]/sections
 *
 * Creates a new section on the given SOP. Used by admin clients that prefer
 * fetch() over server actions (e.g. SectionEditor.tsx already uses fetch for
 * PATCH on /api/sops/[sopId]/sections/[sectionId]).
 *
 * Delegates to the createSection server action which handles Zod validation,
 * RLS-scoped kind lookup, and next-sort-order computation.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
) {
  const { sopId } = await params
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const section = await createSection({
      sopId,
      sectionKindId: String(body.sectionKindId ?? ''),
      title: String(body.title ?? ''),
      content:
        body.content === null || body.content === undefined
          ? null
          : String(body.content),
    })
    return NextResponse.json(section, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

import { NextResponse } from 'next/server'
import { describeSopSchema } from '@/actions/introspection'

/**
 * GET /api/schema — canonical SOP data-model description for AI agents.
 *
 * Returns block types + their props schemas, string enums, layout_data
 * envelope schema, completion schema, storage conventions, and RLS notes.
 * No auth required (returns schema metadata only, not tenant data).
 * Cached at the edge for 5 minutes since the shape changes only on code
 * deploys.
 */
export async function GET() {
  const schema = await describeSopSchema()
  return NextResponse.json(schema, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  })
}

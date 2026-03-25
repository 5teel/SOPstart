import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  assignSopToRole,
  assignSopToUser,
  removeAssignment,
  getAssignments,
} from '@/actions/assignments'

// ─── Schemas ────────────────────────────────────────────────────────────────

const APP_ROLES = ['worker', 'supervisor', 'admin', 'safety_manager'] as const

const postRoleSchema = z.object({
  assignment_type: z.literal('role'),
  role: z.enum(APP_ROLES),
})

const postUserSchema = z.object({
  assignment_type: z.literal('individual'),
  user_id: z.string().uuid('user_id must be a valid UUID'),
})

const postSchema = z.discriminatedUnion('assignment_type', [postRoleSchema, postUserSchema])

const deleteSchema = z.object({
  assignment_id: z.string().uuid('assignment_id must be a valid UUID'),
})

// ─── Handlers ───────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
) {
  const { sopId } = await params
  const result = await getAssignments(sopId)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ assignments: result.assignments }, { status: 200 })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sopId: string }> }
) {
  const { sopId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
      { status: 400 }
    )
  }

  let result: { success: true; id: string } | { success: false; error: string }

  if (parsed.data.assignment_type === 'role') {
    result = await assignSopToRole(sopId, parsed.data.role)
  } else {
    result = await assignSopToUser(sopId, parsed.data.user_id)
  }

  if (!result.success) {
    const status = result.error.includes('admin access') ? 403 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ id: result.id }, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  _context: { params: Promise<{ sopId: string }> }
) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request body' },
      { status: 400 }
    )
  }

  const result = await removeAssignment(parsed.data.assignment_id)
  if (!result.success) {
    const status = result.error.includes('admin access') ? 403 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}

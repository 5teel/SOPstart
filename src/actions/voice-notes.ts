'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const Input = z.object({
  sopId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  completionId: z.string().uuid().optional(),
  blockType: z.enum(['measurement', 'note']),
  transcript: z.string().min(1).max(5000),
  confidence: z.number().min(0).max(1).optional(),
  language: z.enum(['en-NZ', 'en-AU', 'en-US']),
  audioStoragePath: z.string().min(1), // caller already uploaded blob via signed URL
})

export async function saveVoiceNote(input: z.infer<typeof Input>) {
  const parsed = Input.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Extract organisation_id from JWT claims
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const claims = session?.access_token
    ? (JSON.parse(
        Buffer.from(session.access_token.split('.')[1], 'base64url').toString()
      ) as { organisation_id?: string })
    : {}
  const orgId = claims.organisation_id
  if (!orgId) return { error: 'Missing organisation_id claim' }

  const id = crypto.randomUUID()
  const { error } = await supabase.from('sop_voice_notes').insert({
    id,
    organisation_id: orgId,
    sop_id: parsed.data.sopId,
    section_id: parsed.data.sectionId ?? null,
    step_id: parsed.data.stepId ?? null,
    completion_id: parsed.data.completionId ?? null,
    block_type: parsed.data.blockType,
    transcript: parsed.data.transcript,
    audio_storage_path: parsed.data.audioStoragePath,
    confidence: parsed.data.confidence ?? null,
    language: parsed.data.language,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  return { success: true as const, id }
}

'use server'
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'

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

  const { supabase, userId, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'Missing organisation_id claim' }

  const id = crypto.randomUUID()
  const { error } = await supabase.from('sop_voice_notes').insert({
    id,
    organisation_id: organisationId,
    sop_id: parsed.data.sopId,
    section_id: parsed.data.sectionId ?? null,
    step_id: parsed.data.stepId ?? null,
    completion_id: parsed.data.completionId ?? null,
    block_type: parsed.data.blockType,
    transcript: parsed.data.transcript,
    audio_storage_path: parsed.data.audioStoragePath,
    confidence: parsed.data.confidence ?? null,
    language: parsed.data.language,
    created_by: userId,
  })
  if (error) return { error: error.message }
  return { success: true as const, id }
}

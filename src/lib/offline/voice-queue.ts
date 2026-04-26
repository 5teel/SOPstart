'use client'
import { db } from './db'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface FlushVoiceResult {
  flushed: number
  errors: unknown[]
}

export async function flushVoiceNoteQueue(supabase: SupabaseClient): Promise<FlushVoiceResult> {
  const dirty = await db.voiceNotesQueue.where('syncState').equals('dirty').toArray()
  const errors: unknown[] = []
  let flushed = 0

  for (const note of dirty) {
    try {
      // 1. Mint fresh ephemeral Deepgram token (server-side, auth-gated)
      const tokenRes = await fetch('/api/voice/token', { method: 'POST' })
      if (!tokenRes.ok) throw new Error('token_grant_failed')
      const { access_token } = (await tokenRes.json()) as { access_token: string }

      // 2. Transcribe via Deepgram REST (offline blobs: batch, not streaming)
      const dgParams = new URLSearchParams({
        model: 'nova-3',
        language: note.language,
        smart_format: 'true',
        punctuate: 'true',
      })
      if (note.block_type === 'measurement') dgParams.set('numerals', 'true')

      const dgRes = await fetch(`https://api.deepgram.com/v1/listen?${dgParams}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Content-Type': note.audio_mime,
        },
        body: note.audio_blob,
      })
      if (!dgRes.ok) throw new Error(`Deepgram REST ${dgRes.status}`)
      const dgJson = (await dgRes.json()) as {
        results?: {
          channels?: Array<{ alternatives?: Array<{ transcript?: string; confidence?: number }> }>
        }
      }
      const alt = dgJson.results?.channels?.[0]?.alternatives?.[0]
      const transcript = alt?.transcript ?? note.transcript ?? ''
      const confidence = alt?.confidence ?? note.confidence

      // 3. Upload blob to Supabase Storage sop-voice-notes bucket
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('not_authenticated')

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const claims = session?.access_token
        ? (() => {
            // JWTs use base64url (no padding, URL-safe chars) — atob() requires standard base64
            const raw = session.access_token.split('.')[1]
            const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((raw.length + 3) % 4)
            return JSON.parse(atob(padded)) as { organisation_id?: string }
          })()
        : {}
      const orgId = claims.organisation_id
      if (!orgId) throw new Error('no_org_claim')

      const storagePath = `${orgId}/voice/${note.sop_id}/${note.id}.${note.audio_ext}`
      const { error: uploadErr } = await supabase.storage
        .from('sop-voice-notes')
        .upload(storagePath, note.audio_blob, { contentType: note.audio_mime })
      if (uploadErr) throw uploadErr

      // 4. Persist to sop_voice_notes via server action
      if (transcript) {
        const { saveVoiceNote } = await import('@/actions/voice-notes')
        const saveResult = await saveVoiceNote({
          sopId: note.sop_id,
          sectionId: note.section_id,
          stepId: note.step_id,
          completionId: note.completion_id,
          blockType: note.block_type,
          transcript,
          confidence,
          language: note.language,
          audioStoragePath: storagePath,
        })
        if ('error' in saveResult) throw new Error(saveResult.error)
      }

      // 5. Mark synced
      await db.voiceNotesQueue.update(note.id, { syncState: 'synced', transcript, confidence })
      flushed++
    } catch (err) {
      errors.push(err)
      // leave dirty — retry on next reconnect flush
    }
  }

  return { flushed, errors }
}

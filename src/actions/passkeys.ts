'use server'

import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordDecision } from '@/lib/decisions/record'

// Phase 65 / ADR-0027. The WebAuthn ceremony runs in the browser (it has to); the server
// never takes the browser's word for it. Every claim is checked against Supabase's own list
// of the session user's passkeys, read with the admin API, and the passkey's name comes from
// that list too. Org and actor come from the session inside recordDecision.

const changeSchema = z.object({
  kind: z.enum(['added', 'removed']),
  passkeyId: z.string().uuid(),
})

async function passkeysOf(userId: string) {
  const { data, error } = await createAdminClient().auth.admin.passkey.listPasskeys({ userId })
  return error ? null : (data ?? [])
}

/**
 * kind 'added': called after registerPasskey() in the browser; the passkey must now be listed.
 * kind 'removed': the removal itself runs here, through the admin API, so a removal row can
 * only ever follow a real removal of one of the caller's own passkeys.
 */
export async function recordPasskeyChange(input: { kind: 'added' | 'removed'; passkeyId: string }): Promise<{ error?: string }> {
  const parsed = changeSchema.safeParse(input)
  if (!parsed.success) return { error: 'Unknown passkey.' }
  const { kind, passkeyId } = parsed.data
  const { userId } = await getSessionContext()
  if (!userId) return { error: 'Sign in again.' }

  const before = await passkeysOf(userId)
  if (!before) return { error: "Couldn't check your passkeys. Try again." }
  const found = before.find((p) => p.id === passkeyId)
  if (!found) return { error: 'That passkey is not on your account.' }

  if (kind === 'removed') {
    const { error } = await createAdminClient().auth.admin.passkey.deletePasskey({ userId, passkeyId })
    if (error) return { error: "That passkey wasn't removed. Try again." }
    const after = await passkeysOf(userId)
    if (!after || after.some((p) => p.id === passkeyId)) return { error: "That passkey wasn't removed. Try again." }
  }

  await recordDecision({
    kind: kind === 'added' ? 'passkey_added' : 'passkey_removed',
    subject: { kind: 'passkey', id: passkeyId },
    summary: kind === 'added' ? 'Added a passkey' : 'Removed a passkey',
    details: { name: found.friendly_name ?? null },
  })
  return {}
}

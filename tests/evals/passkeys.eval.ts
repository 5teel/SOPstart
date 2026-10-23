/**
 * Deployed-site eval -- Phase 65 "Passkeys" (ADR-0027).
 *
 * On sopstart.com, with a Chromium virtual authenticator (CDP WebAuthn: internal transport,
 * resident key, user verification), eval-worker:
 *  1. adds a passkey on Profile; Supabase lists it and the ledger has "Added a passkey" (passkey_added,
 *     subject = that passkey, actor = eval-worker);
 *  2. signs out and signs back in with the passkey alone, landing on the home;
 *  3. removes it on Profile (asks first); the ledger has "Removed a passkey";
 *  4. signs out, and a passkey sign-in now fails with a plain sentence and stays on the login screen.
 * Screenshots at desktop 1440 and phone 390.
 *
 * OTP spend: one minted session (eval-worker). Do not loop this file.
 * It deletes eval-worker's leftover passkeys first (a failed earlier run), through the admin API.
 * Self-skips without EVAL_BASE_URL.
 */
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { EVAL_BASE_URL, EVAL_ENV_READY, EVAL_USERS, signInAs } from './lib/session'
import { shot, watchConsole } from './lib/plant-fixture'
import { KIND_WORDS } from '@/lib/decisions/read'

const SLOW = { timeout: 30_000 }
const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

test.describe('Phase 65 -- passkeys (deployed)', () => {
  test.skip(!EVAL_ENV_READY, 'EVAL_BASE_URL/Supabase env not configured -- self-skipping')

  test('add a passkey, sign in with it, remove it, and it no longer signs in', async ({ browser }) => {
    test.setTimeout(180_000)
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const ctx = await browser.newContext({ viewport: DESKTOP, baseURL: EVAL_BASE_URL })
    const session = await signInAs(ctx, 'worker')
    const userId = session.user.id
    expect(session.user.email).toBe(EVAL_USERS.worker)

    // Leftovers from an earlier failed run would make the list and the sign-in ambiguous.
    const { data: old } = await db.auth.admin.passkey.listPasskeys({ userId })
    for (const p of old ?? []) await db.auth.admin.passkey.deletePasskey({ userId, passkeyId: p.id })

    const page = await ctx.newPage()
    const errors = watchConsole(page)
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })

    const since = new Date().toISOString()
    const ledgerRow = async (kind: 'passkey_added' | 'passkey_removed', passkeyId: string) => {
      const { data } = await db
        .from('decisions')
        .select('kind, summary, actor_id, subject_kind')
        .eq('kind', kind)
        .eq('subject_id', passkeyId)
        .gte('created_at', since)
      return data ?? []
    }

    // 1. Add a passkey on Profile.
    await page.goto('/profile')
    const section = page.getByTestId('passkeys-section')
    await expect(section.getByRole('heading', { name: 'Passkeys' })).toBeVisible(SLOW)
    await expect(section.getByText('No passkeys yet.')).toBeVisible(SLOW)
    await expect(section.getByRole('button', { name: 'Add a passkey' })).toHaveCount(1)
    await section.getByRole('button', { name: 'Add a passkey' }).click()
    await expect(section.getByTestId('passkey-row')).toHaveCount(1, SLOW)
    await expect(section.getByTestId('passkey-row')).toContainText('Added ')
    await expect(section.getByRole('alert')).toHaveCount(0)
    await shot(page, '65-passkey-added-desktop')

    const { data: listed } = await db.auth.admin.passkey.listPasskeys({ userId })
    expect(listed?.length).toBe(1)
    const passkeyId = listed![0].id
    await expect.poll(async () => (await ledgerRow('passkey_added', passkeyId)).length, SLOW).toBe(1)
    const [added] = await ledgerRow('passkey_added', passkeyId)
    expect(added).toMatchObject({ summary: 'Added a passkey', actor_id: userId, subject_kind: 'passkey' })
    expect(KIND_WORDS.passkey_added).toBe('Added a passkey')

    // 2. Sign out, then sign in with the passkey alone.
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL(/\/login/, SLOW)
    const passkeyButton = page.getByRole('button', { name: 'Sign in with a passkey' })
    await expect(passkeyButton).toHaveCount(1, SLOW)
    await shot(page, '65-login-desktop')
    await passkeyButton.click()
    await page.waitForURL((u) => u.pathname === '/', SLOW)
    await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toHaveCount(0)
    await shot(page, '65-home-after-passkey-desktop')

    // 3. Remove it on Profile, at phone width.
    await page.setViewportSize(PHONE)
    await page.goto('/profile')
    await expect(section.getByTestId('passkey-row')).toHaveCount(1, SLOW)
    await shot(page, '65-passkey-listed-phone')
    await section.getByRole('button', { name: 'Remove' }).click()
    await expect(section.getByText('Remove this passkey?')).toBeVisible()
    await shot(page, '65-passkey-remove-ask-phone')
    await section.getByRole('button', { name: 'Remove' }).click()
    await expect(section.getByTestId('passkey-row')).toHaveCount(0, SLOW)
    await expect(section.getByText('No passkeys yet.')).toBeVisible()
    const { data: after } = await db.auth.admin.passkey.listPasskeys({ userId })
    expect(after ?? []).toHaveLength(0)
    await expect.poll(async () => (await ledgerRow('passkey_removed', passkeyId)).length, SLOW).toBe(1)
    const [removed] = await ledgerRow('passkey_removed', passkeyId)
    expect(removed).toMatchObject({ summary: 'Removed a passkey', actor_id: userId, subject_kind: 'passkey' })

    // 4. The removed passkey no longer signs in; the message is a plain sentence.
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL(/\/login/, SLOW)
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
    await expect(page.getByRole('alert')).toHaveText(
      "That passkey didn't sign you in. Use your password, or try another passkey.",
      SLOW,
    )
    expect(new URL(page.url()).pathname).toBe('/login')
    await expect(page.getByLabel('Password')).toBeVisible()
    await shot(page, '65-passkey-refused-phone')

    // No horizontal scroll at phone width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    expect(errors).toEqual([])
    await ctx.close()
  })
})

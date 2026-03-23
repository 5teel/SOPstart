import { test } from '@playwright/test'

test.describe('Auth Flows', () => {
  test.describe('Organisation Registration (AUTH-01)', () => {
    test.fixme('Admin can register a new organisation with company name and email', async () => {
      // Fill org sign-up form, submit
      // Verify org created in DB, user has admin role
    })

    test.fixme('Registration creates 14-day trial', async () => {
      // After registration, org.trial_ends_at is ~14 days from now
    })
  })

  test.describe('User Sign-up and Login (AUTH-02)', () => {
    test.fixme('Worker can join org via invite code and gets worker role', async () => {
      // Sign up, enter invite code
      // Verify org_members row with role=worker
    })

    test.fixme('Worker can accept email invite link and set password', async () => {
      // Admin sends invite, worker follows link
      // Worker sets password, lands in correct org
    })

    test.fixme('User who is already in an org cannot join a second org', async () => {
      // Try to join via invite code when already a member
      // Expect error: "already a member"
    })
  })

  test.describe('Session Persistence (AUTH-03)', () => {
    test.fixme('Logged-in user stays logged in after page refresh', async () => {
      // Log in, refresh page
      // Verify still on protected route, not redirected to login
    })
  })

  test.describe('Role Assignment (AUTH-04)', () => {
    test.fixme('Admin can change a member role to supervisor', async () => {
      // Log in as admin, go to team page
      // Change worker role to supervisor
      // Verify org_members row updated
    })

    test.fixme('Non-admin cannot access role assignment page', async () => {
      // Log in as worker
      // Navigate to /admin/team — should redirect to dashboard
    })
  })
})

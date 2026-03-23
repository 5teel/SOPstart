import { test } from '@playwright/test'

test.describe('RLS Tenant Isolation (AUTH-05, AUTH-06)', () => {
  test.describe('Cross-tenant data isolation', () => {
    test.fixme('Org A admin cannot read Org B organisation row', async () => {
      // Seed two orgs with members via Supabase admin client
      // Authenticate as Org A admin
      // Query organisations table — should only see Org A
    })

    test.fixme('Org A member cannot read Org B organisation_members', async () => {
      // Authenticate as Org A member
      // Query organisation_members — should only see Org A members
    })

    test.fixme('Org A admin cannot read Org B supervisor_assignments', async () => {
      // Authenticate as Org A admin
      // Query supervisor_assignments — should only see Org A assignments
    })

    test.fixme('Custom Access Token Hook injects correct organisation_id into JWT', async () => {
      // Sign in as Org A member
      // Decode JWT — organisation_id should match Org A id
    })

    test.fixme('Custom Access Token Hook injects correct user_role into JWT', async () => {
      // Sign in as Org A admin
      // Decode JWT — user_role should be "admin"
    })

    test.fixme('User with no org gets null organisation_id and pending role in JWT', async () => {
      // Create user with no org membership
      // Sign in — JWT should have organisation_id: null, user_role: "pending"
    })
  })
})

import { test, expect } from '@playwright/test'

test.describe('SOP Review and Publish (PARSE-05, PARSE-06, PARSE-07)', () => {
  test.fixme('PARSE-05: admin sees parsed output alongside original document', async ({ page }) => {
    // Navigate to review page for a parsed SOP
    // Verify left pane shows original document
    // Verify right pane shows parsed section cards
  })

  test.fixme('PARSE-06: admin can edit a parsed section inline', async ({ page }) => {
    // Navigate to review page
    // Click "Edit section" on a section card
    // Modify text in the textarea
    // Click "Save changes"
    // Verify updated text persists
  })

  test.fixme('PARSE-06: editing a section resets its approval status', async ({ page }) => {
    // Approve a section
    // Edit the same section
    // Verify approval is reset to pending
  })

  test.fixme('PARSE-07: parsed SOP starts in draft state', async ({ page }) => {
    // Upload and parse a document
    // Navigate to SOP library
    // Verify the SOP shows "Draft" badge
  })

  test.fixme('PARSE-07: admin must approve all sections before publishing', async ({ page }) => {
    // Navigate to review page
    // Verify Publish button is disabled
    // Approve all sections
    // Verify Publish button becomes enabled
  })

  test.fixme('PARSE-07: admin can publish a fully-approved SOP', async ({ page }) => {
    // Approve all sections
    // Click Publish SOP
    // Confirm inline
    // Verify status changes to "Published"
  })

  test.fixme('PARSE-05: admin can re-parse a document', async ({ page }) => {
    // Navigate to review page
    // Click Re-parse
    // Confirm inline
    // Verify parsing state resumes
  })

  test.fixme('PARSE-07: admin can delete a draft SOP', async ({ page }) => {
    // Navigate to review page
    // Click Delete draft
    // Confirm inline
    // Verify redirect to SOP library
    // Verify SOP no longer listed
  })
})

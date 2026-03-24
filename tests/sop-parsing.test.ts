import { test, expect } from '@playwright/test'

test.describe('SOP AI Parsing (PARSE-03, PARSE-04)', () => {
  test.fixme('PARSE-03: uploaded document is automatically parsed into structured sections', async ({ page }) => {
    // Upload a .docx file
    // Wait for parse job to complete (Realtime or poll)
    // Navigate to review page
    // Verify sections exist (Hazards, PPE, Steps, etc.)
  })

  test.fixme('PARSE-03: parsed sections include flexible types detected by AI', async ({ page }) => {
    // Upload a document with unusual sections
    // Verify AI extracts all sections, not just a fixed set
  })

  test.fixme('PARSE-04: embedded images are extracted from .docx files', async ({ page }) => {
    // Upload a .docx with embedded images
    // Navigate to review page
    // Verify images appear inline within sections
  })

  test.fixme('PARSE-03: parse job status updates in real-time', async ({ page }) => {
    // Upload a file
    // Navigate to SOP library
    // Verify status shows "Parsing..." with spinner
    // Wait for completion
    // Verify status changes to "Parsed and ready to review"
  })

  test.fixme('PARSE-03: failed parse shows error and retry option', async ({ page }) => {
    // Trigger a parse failure (e.g., corrupted file)
    // Verify error card appears with "Try again" button
  })
})

import { test, expect } from '@playwright/test'

test.describe('SOP Upload (PARSE-01, PARSE-02)', () => {
  test.fixme('PARSE-01: admin can upload a .docx file via file browser', async ({ page }) => {
    // Navigate to /admin/sops/upload
    // Select a .docx file via the file input
    // Verify file appears in upload queue
    // Click Upload, verify success status
  })

  test.fixme('PARSE-01: admin can upload a .docx file via drag and drop', async ({ page }) => {
    // Navigate to /admin/sops/upload
    // Simulate drag-and-drop of a .docx file
    // Verify file appears in upload queue
  })

  test.fixme('PARSE-02: admin can upload a PDF file', async ({ page }) => {
    // Navigate to /admin/sops/upload
    // Select a .pdf file
    // Verify file appears in upload queue
    // Click Upload, verify success status
  })

  test.fixme('PARSE-01/02: admin can batch upload multiple files', async ({ page }) => {
    // Navigate to /admin/sops/upload
    // Select multiple files (.docx and .pdf)
    // Verify all files appear in queue
    // Click Upload All, verify all succeed
  })

  test.fixme('PARSE-01/02: rejects files over 50MB', async ({ page }) => {
    // Navigate to /admin/sops/upload
    // Attempt to add a file >50MB
    // Verify error toast appears
  })

  test.fixme('PARSE-01/02: rejects unsupported file types', async ({ page }) => {
    // Navigate to /admin/sops/upload
    // Attempt to add a .exe or .txt file
    // Verify error toast appears
  })
})

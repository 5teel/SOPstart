import { test, expect } from '@playwright/test'

test.describe('File-to-video pipeline entry (PATH-01)', () => {
  test.fixme('UploadDropzone shows "Generate video SOP" button next to Browse video', async ({ page }) => {})
  test.fixme('clicking "Generate video SOP" opens the format selection modal', async ({ page }) => {})
  test.fixme('modal lists Narrated slideshow and Screen-recording style options', async ({ page }) => {})
  test.fixme('"Start pipeline" CTA is disabled until a format is selected', async ({ page }) => {})
  test.fixme('confirming format dispatches upload and navigates to /admin/sops/pipeline/[pipelineId]', async ({ page }) => {})
  test.fixme('Discard button dismisses modal without creating a pipeline', async ({ page }) => {})
})

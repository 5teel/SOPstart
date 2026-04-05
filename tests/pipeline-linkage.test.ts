import { test, expect } from '@playwright/test'

test.describe('Pipeline state linkage (PATH-02)', () => {
  test.fixme('starting a pipeline creates a sop_pipeline_runs row with requested_video_format', async ({ page }) => {})
  test.fixme('the created parse_jobs row references the pipeline_run_id', async ({ page }) => {})
  test.fixme('the created sops row references the pipeline_run_id', async ({ page }) => {})
  test.fixme('video_generation_jobs row created by auto-queue references the same pipeline_run_id', async ({ page }) => {})
  test.fixme('pipeline_run_id is scoped to the uploading user organisation', async ({ page }) => {})
})

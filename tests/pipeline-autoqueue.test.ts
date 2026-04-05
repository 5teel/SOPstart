import { test, expect } from '@playwright/test'

test.describe('Publish auto-queues video generation (PATH-03)', () => {
  test.fixme('publishing a pipeline-linked SOP enqueues a video_generation_jobs row', async ({ page }) => {})
  test.fixme('enqueued job uses the pipeline format (narrated_slideshow or screen_recording)', async ({ page }) => {})
  test.fixme('enqueued job carries the pipeline_run_id from the parse job', async ({ page }) => {})
  test.fixme('publishing a non-pipeline SOP does NOT auto-queue a video job', async ({ page }) => {})
  test.fixme('publish succeeds even if enqueue path has internal error — SOP publish is not rolled back', async ({ page }) => {})
})

import { test, expect } from '@playwright/test'

test.describe('Video file upload (VID-01)', () => {
  test.fixme('admin can upload an MP4 file and see it queued', async ({ page }) => {})
  test.fixme('admin can upload a MOV file and see it queued', async ({ page }) => {})
  test.fixme('video files over 2GB are rejected with error message', async ({ page }) => {})
  test.fixme('non-video non-document files are rejected', async ({ page }) => {})
  test.fixme('video file shows purple Video icon in queue', async ({ page }) => {})
})

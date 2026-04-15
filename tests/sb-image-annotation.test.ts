import { test, expect } from '@playwright/test'

test.describe('Image and diagram annotation (SB-ANNOT)', () => {
  test.fixme('SB-ANNOT-01 admin can annotate any photo or diagram with arrows, rectangles, ellipses, text labels, numbered callouts', async ({ page }) => {})
  test.fixme('SB-ANNOT-02 annotations are non-destructive — original image preserved, admin can re-edit later without re-uploading', async ({ page }) => {})
  test.fixme('SB-ANNOT-03 on publish, client bakes a flattened PNG to Supabase Storage at a version-bumped path; workers load via <img> with zero Konva bytes', async ({ page }) => {})
  test.fixme('SB-ANNOT-04 admin can use Apple Pencil / stylus for freehand sketching with palm rejection when a pen is detected', async ({ page }) => {})
  test.fixme('SB-ANNOT-05 annotations survive photo replacement — coordinates preserved if similar dimensions, admin prompted to review placement', async ({ page }) => {})
})

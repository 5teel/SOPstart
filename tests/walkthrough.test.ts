import { test, expect } from '@playwright/test'

test.describe('SOP Walkthrough (WORK-01, WORK-02, WORK-05, WORK-06, WORK-09, WORK-10)', () => {
  test.fixme('WORK-01: worker can walk through SOP step-by-step with progress indication', async ({ page }) => {
    // Navigate to walkthrough page for a published SOP
    // Verify step counter shows "Step 1 of N"
    // Mark first step complete, verify counter advances to "Step 2 of N"
    // Continue through all steps, verify final step shows completion UI
    // Verify overall progress bar or percentage updates at each step
  })

  test.fixme('WORK-02: worker can navigate back to previous steps during walkthrough', async ({ page }) => {
    // Navigate to walkthrough page and advance to step 3
    // Click "Back" or previous-step affordance
    // Verify step counter returns to step 2
    // Verify previously entered data (notes, photos) on step 2 is preserved
    // Navigate back to step 1, verify all prior steps accessible
  })

  test.fixme('WORK-05: hazard and PPE information displayed before procedure steps', async ({ page }) => {
    // Navigate to walkthrough page for a SOP with hazard and PPE sections
    // Verify hazard warnings section is shown before the first numbered step
    // Verify PPE requirements section is shown before the first numbered step
    // Verify worker must scroll past or acknowledge hazards before reaching Step 1
  })

  test.fixme('WORK-06: images display inline within SOP steps with zoom capability', async ({ page }) => {
    // Navigate to walkthrough page for a SOP that has embedded images in steps
    // Verify image appears inline within the step card
    // Tap/click the image to trigger zoom/lightbox
    // Verify zoomed view fills screen and can be dismissed
  })

  test.fixme('WORK-09: all primary actions use 72px+ tap targets', async ({ page }) => {
    // Navigate to walkthrough page
    // Query bounding rects of primary action buttons: Next Step, Complete Step, Back, tabs
    // Verify each button's height and width are >= 72px
    // Check on mobile viewport (375x812) to confirm sizing holds
  })

  test.fixme('WORK-10: walkthrough uses full-screen interface optimised for one-handed use', async ({ page }) => {
    // Set viewport to mobile dimensions (375x812)
    // Navigate to walkthrough page
    // Verify the walkthrough fills 100% of the viewport (no visible browser chrome overlap)
    // Verify primary action buttons are anchored to the bottom of the screen
    // Verify no horizontal scrolling is required
  })
})

// Legacy shim: this slot is now driven by WalkthroughSwitcher (Phase 15).
// Wave 4 (final cleanup) deletes this file after a demo-prep grep confirms
// no remaining imports outside the protected route page (which itself was
// updated in Plan 15-02 Task 4 to import WalkthroughSwitcher directly).
export { MobileWalkthrough as WalkthroughTab } from '../walkthrough/MobileWalkthrough'

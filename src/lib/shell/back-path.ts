/**
 * Phase 63 -- where a bridged page's Back goes. null = no Back bar.
 *
 * Plain module, no imports: the protected layout's Back bar imports this alone, so
 * the home address module stays in the page chunk (bundle gate). The targets are
 * the formatHome strings of the three sections; tests/phase63/home-state.spec.ts
 * pins them against formatHome.
 */
export function backForPath(pathname: string): string | null {
  if (pathname === '/pending' || pathname.startsWith('/sops/')) return null
  if (pathname === '/activity' || pathname.startsWith('/activity/')) return '/?s=record'
  if (pathname === '/admin/training') return '/?s=training'
  if (pathname === '/admin/settings' || pathname === '/admin/sops/new' || pathname.startsWith('/admin/sops/new/') || pathname === '/admin/sops/upload') {
    return '/?s=manage'
  }
  return '/'
}

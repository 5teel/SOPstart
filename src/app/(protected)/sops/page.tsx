'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ClipboardList, ChevronDown, RefreshCw } from 'lucide-react'
import { useAssignedSops } from '@/hooks/useAssignedSops'
import { useSopSync } from '@/hooks/useSopSync'
import { db } from '@/lib/offline/db'
import { SopLibraryCard } from '@/components/sop/SopLibraryCard'
import { SopSearchInput } from '@/components/sop/SopSearchInput'
import { CategoryBottomSheet, CategorySidebar } from '@/components/sop/CategoryBottomSheet'
import { PRODUCT_NAME } from '@/lib/constants'

function getRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function SopsPage() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)

  // Trigger sync on mount / online
  const { syncing } = useSopSync()

  // Main SOP list with category filter
  const { data: sops = [], isLoading } = useAssignedSops({ category: activeCategory ?? undefined })

  // Search results (separate query so main list isn't disrupted)
  const { data: searchResults = [] } = useAssignedSops({ search: searchTerm || undefined })

  // All SOPs for category computation
  const { data: allSops = [] } = useAssignedSops()

  // Derive categories from full list
  const categories = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const sop of allSops) {
      if (sop.category) {
        counts[sop.category] = (counts[sop.category] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allSops])

  // Last sync time
  const { data: lastSyncMeta } = useQuery({
    queryKey: ['sync-meta-last-sync'],
    queryFn: async () => db.syncMeta.get('lastSync'),
    networkMode: 'offlineFirst',
  })
  const lastSyncLabel = lastSyncMeta?.value
    ? `Synced ${getRelativeTime(lastSyncMeta.value)}`
    : syncing
      ? 'Syncing...'
      : 'Not yet synced'

  const activeCategoryLabel = activeCategory ?? 'All categories'

  return (
    <div className="flex flex-col min-h-screen bg-steel-900">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-steel-900 border-b border-steel-700 px-4 flex items-center justify-between h-[56px]">
        <span className="text-sm font-semibold text-steel-100">{PRODUCT_NAME}</span>
        <button
          type="button"
          onClick={() => { setSearchTerm(''); setSearchOpen(true) }}
          aria-label="Search SOPs"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-steel-800 transition-colors"
        >
          {syncing ? (
            <RefreshCw size={22} className="text-brand-yellow animate-spin" />
          ) : (
            <Search size={22} className="text-steel-400 hover:text-steel-100" />
          )}
        </button>
      </header>

      {/* Desktop layout: sidebar + content */}
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <CategorySidebar
            categories={categories}
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 px-4 py-6 pb-[80px] max-w-2xl mx-auto w-full lg:max-w-none lg:mx-0">
          {/* Page heading */}
          <h1 className="text-2xl font-bold text-steel-100 mb-1">Your SOPs</h1>
          <p className="text-sm text-steel-400 mb-4">
            {isLoading
              ? 'Loading...'
              : `${sops.length} procedure${sops.length !== 1 ? 's' : ''} assigned to your role`}
            {' · '}
            {lastSyncLabel}
          </p>

          {/* Category filter pill — mobile only */}
          <div className="lg:hidden mb-4">
            <button
              type="button"
              onClick={() => setCategorySheetOpen(true)}
              className="inline-flex items-center gap-2 px-4 h-[44px] bg-steel-800 rounded-xl text-sm font-medium text-steel-100 hover:bg-steel-700 transition-colors border border-steel-700"
            >
              <span>{activeCategoryLabel}</span>
              <ChevronDown size={16} className="text-steel-400" />
            </button>
          </div>

          {/* SOP list */}
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-[88px] bg-steel-800 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : sops.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 px-8 text-center">
              <ClipboardList size={48} className="text-steel-600" />
              <div>
                <p className="text-xl font-semibold text-steel-100">No SOPs assigned yet</p>
                <p className="text-sm text-steel-400 max-w-xs mx-auto mt-2">
                  Your admin hasn&apos;t assigned any SOPs to you yet. Give them a nudge.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sops.map((sop) => (
                <SopLibraryCard key={sop.id} sop={sop} isCached={true} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile category bottom sheet */}
      <CategoryBottomSheet
        categories={categories}
        activeCategory={activeCategory}
        onSelect={setActiveCategory}
        open={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
      />

      {/* Search overlay */}
      {searchOpen && (
        <SopSearchInput
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
          onClose={() => { setSearchOpen(false); setSearchTerm('') }}
          results={searchResults}
        />
      )}
    </div>
  )
}

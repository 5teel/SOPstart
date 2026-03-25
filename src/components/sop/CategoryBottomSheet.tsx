'use client'
import { Check } from 'lucide-react'

interface CategoryItem {
  name: string
  count: number
}

interface CategoryBottomSheetProps {
  categories: CategoryItem[]
  activeCategory: string | null
  onSelect: (category: string | null) => void
  open: boolean
  onClose: () => void
}

function CategoryRow({
  name,
  count,
  isActive,
  onSelect,
  height,
}: {
  name: string
  count: number
  isActive: boolean
  onSelect: () => void
  height: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex items-center justify-between px-4 rounded-xl transition-colors cursor-pointer w-full text-left',
        height,
        isActive
          ? 'bg-brand-yellow/15 border border-brand-yellow/30'
          : 'hover:bg-steel-700',
      ].join(' ')}
    >
      <span className="flex items-center gap-2">
        {isActive && <Check size={16} className="text-brand-yellow flex-shrink-0" />}
        <span className={`text-base font-medium ${isActive ? 'text-brand-yellow' : 'text-steel-100'}`}>
          {name}
        </span>
      </span>
      <span className="text-xs text-steel-400 tabular-nums">{count} SOPs</span>
    </button>
  )
}

export function CategoryBottomSheet({
  categories,
  activeCategory,
  onSelect,
  open,
  onClose,
}: CategoryBottomSheetProps) {
  if (!open) return null

  return (
    <>
      {/* Mobile bottom sheet */}
      <div className="lg:hidden">
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Sheet panel */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-steel-800 rounded-t-2xl shadow-2xl max-h-[70vh] overflow-hidden flex flex-col">
          {/* Handle */}
          <div className="mx-auto mt-3 mb-0 w-10 h-1 bg-steel-600 rounded-full flex-shrink-0" />

          {/* Header */}
          <div className="px-4 py-4 border-b border-steel-700 flex items-center justify-between flex-shrink-0">
            <h2 className="text-base font-semibold text-steel-100">Filter by category</h2>
            {activeCategory && (
              <button
                type="button"
                onClick={() => { onSelect(null); onClose() }}
                className="text-sm text-brand-yellow hover:text-amber-400"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1">
            {/* All categories row */}
            <CategoryRow
              name="All categories"
              count={categories.reduce((sum, c) => sum + c.count, 0)}
              isActive={activeCategory === null}
              onSelect={() => { onSelect(null); onClose() }}
              height="h-[56px]"
            />
            {categories.map((cat) => (
              <CategoryRow
                key={cat.name}
                name={cat.name}
                count={cat.count}
                isActive={activeCategory === cat.name}
                onSelect={() => { onSelect(cat.name); onClose() }}
                height="h-[56px]"
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// Desktop sidebar variant — rendered separately in the page layout
export function CategorySidebar({
  categories,
  activeCategory,
  onSelect,
}: Pick<CategoryBottomSheetProps, 'categories' | 'activeCategory' | 'onSelect'>) {
  return (
    <aside className="w-[240px] flex-shrink-0 sticky top-0 h-screen overflow-y-auto py-6 px-3 border-r border-steel-700 bg-steel-900">
      <p className="text-xs font-semibold text-steel-400 uppercase tracking-widest px-3 mb-3">
        Categories
      </p>
      <div className="flex flex-col gap-1">
        {/* All categories row */}
        <CategoryRow
          name="All categories"
          count={categories.reduce((sum, c) => sum + c.count, 0)}
          isActive={activeCategory === null}
          onSelect={() => onSelect(null)}
          height="h-[44px]"
        />
        {categories.map((cat) => (
          <CategoryRow
            key={cat.name}
            name={cat.name}
            count={cat.count}
            isActive={activeCategory === cat.name}
            onSelect={() => onSelect(cat.name)}
            height="h-[44px]"
          />
        ))}
      </div>
    </aside>
  )
}

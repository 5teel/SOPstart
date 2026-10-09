'use client'
/**
 * Phase 63 -- the phone's key under the whole-site map: numbered areas as a two-column grid of
 * tap targets (the markers on the plates carry the same numbers). Hidden while an area is open.
 */
export interface MapKeyItem {
  id: string
  name: string
  index: number
  colourVar: string
  count: number
}

export function MapKey({ items, area, onArea }: { items: MapKeyItem[]; area: string | null; onArea(id: string | null): void }) {
  if (area !== null || items.length === 0) return null
  return (
    <div data-testid="map-key" className="grid max-h-2/5 shrink-0 grid-cols-2 gap-1.5 overflow-y-auto border-t border-ink-200 p-3 lg:hidden">
      {items.map((a) => (
        <button
          key={a.id}
          type="button"
          data-testid="map-key-item"
          data-area-id={a.id}
          onClick={() => onArea(a.id)}
          className="flex min-h-tap items-center gap-2 rounded-lg border border-ink-200 bg-paper-1 px-2.5 text-left text-ui text-ink-900"
        >
          <span className="w-4 shrink-0 text-center font-bold" style={{ color: a.colourVar }}>
            {a.index}
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold">{a.name}</span>
          <span className="font-label text-meta text-ink-600">{a.count}</span>
        </button>
      ))}
    </div>
  )
}

'use client'

import { useThemeStore, THEMES, type SiteTheme } from '@/stores/theme'
import { Check } from 'lucide-react'

export function ThemePicker() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {THEMES.map((t) => {
        const active = theme === t.id
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id as SiteTheme)}
            className={[
              'relative flex flex-col rounded-xl p-3 text-left transition-all min-h-[140px]',
              'border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow',
              active
                ? 'border-brand-yellow ring-1 ring-brand-yellow/30'
                : 'border-steel-700 hover:border-steel-600',
            ].join(' ')}
            style={{ backgroundColor: t.preview.bg }}
            aria-pressed={active}
            aria-label={`${t.name} theme`}
          >
            {/* Mini preview */}
            <div className="mb-3 flex gap-2">
              <div
                className="h-8 w-8 rounded-lg"
                style={{
                  backgroundColor: t.preview.panel,
                  boxShadow: '4px 4px 8px rgba(0,0,0,0.3), -2px -2px 6px rgba(255,255,255,0.02)',
                  border: `1px solid ${t.preview.accent}20`,
                }}
              />
              <div className="flex flex-col gap-1.5 flex-1">
                <div
                  className="h-2 rounded-full w-3/4"
                  style={{ backgroundColor: t.preview.accent, opacity: 0.7 }}
                />
                <div
                  className="h-1.5 rounded-full w-1/2"
                  style={{ backgroundColor: t.preview.panel }}
                />
              </div>
            </div>

            {/* Label */}
            <span
              className="text-sm font-semibold"
              style={{ color: t.preview.accent }}
            >
              {t.name}
            </span>
            <span className="text-xs mt-0.5" style={{ color: `${t.preview.accent}99` }}>
              {t.description}
            </span>

            {/* Active check */}
            {active && (
              <div
                className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full"
                style={{ backgroundColor: t.preview.accent }}
              >
                <Check className="h-3.5 w-3.5" style={{ color: t.preview.bg }} />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

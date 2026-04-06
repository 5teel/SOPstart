'use client'

import { useThemeStore, THEMES, type SiteTheme, type ThemeConfig } from '@/stores/theme'
import { Check, Layers, Sparkles } from 'lucide-react'

function ThemeCard({ t, active, onSelect }: { t: ThemeConfig; active: boolean; onSelect: () => void }) {
  const isMorphism = t.group === 'morphism'

  return (
    <button
      onClick={onSelect}
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
            backgroundColor: isMorphism ? `${t.preview.panel}cc` : t.preview.panel,
            boxShadow: isMorphism
              ? `6px 6px 12px rgba(0,0,0,0.5), -3px -3px 8px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)`
              : '4px 4px 8px rgba(0,0,0,0.3), -2px -2px 6px rgba(255,255,255,0.02)',
            border: `1px solid ${t.preview.accent}${isMorphism ? '30' : '20'}`,
            backdropFilter: isMorphism ? 'blur(8px)' : undefined,
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
          {isMorphism && (
            <div
              className="h-1 rounded-full w-2/3 mt-0.5"
              style={{ backgroundColor: t.preview.accent, opacity: 0.25 }}
            />
          )}
        </div>
      </div>

      {/* Label */}
      <span className="text-sm font-semibold" style={{ color: t.preview.accent }}>
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
}

export function ThemePicker() {
  const { theme, setTheme } = useThemeStore()

  const minimalThemes = THEMES.filter((t) => t.group === 'minimal')
  const morphismThemes = THEMES.filter((t) => t.group === 'morphism')

  return (
    <div className="space-y-6">
      {/* Minimal */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Layers size={14} className="text-steel-400" />
          <h3 className="text-xs font-semibold text-steel-400 uppercase tracking-wider">
            Minimal
          </h3>
          <span className="text-xs text-steel-600">CSS patterns</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {minimalThemes.map((t) => (
            <ThemeCard
              key={t.id}
              t={t}
              active={theme === t.id}
              onSelect={() => setTheme(t.id as SiteTheme)}
            />
          ))}
        </div>
      </div>

      {/* Morphism */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-brand-yellow" />
          <h3 className="text-xs font-semibold text-steel-400 uppercase tracking-wider">
            Morphism
          </h3>
          <span className="text-xs text-steel-600">Textured + glassmorphic panels</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {morphismThemes.map((t) => (
            <ThemeCard
              key={t.id}
              t={t}
              active={theme === t.id}
              onSelect={() => setTheme(t.id as SiteTheme)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

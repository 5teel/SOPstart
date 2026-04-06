import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SiteTheme =
  | 'steel-forge'
  | 'blueprint'
  | 'riveted-metal'
  | 'circuit-board'
  | 'concrete-plant'
  | 'dark-ops'
  | 'steel-forge-morphism'
  | 'blueprint-morphism'
  | 'riveted-metal-morphism'
  | 'circuit-board-morphism'
  | 'concrete-plant-morphism'
  | 'dark-ops-morphism'

export interface ThemeConfig {
  id: SiteTheme
  name: string
  description: string
  group: 'minimal' | 'morphism'
  preview: {
    bg: string
    accent: string
    panel: string
  }
}

export const THEMES: ThemeConfig[] = [
  // ─── Minimal (CSS-only) ───────────────────────────────────────────
  {
    id: 'steel-forge',
    name: 'Steel Forge',
    description: 'Dark steel with amber highlights',
    group: 'minimal',
    preview: { bg: '#111827', accent: '#f59e0b', panel: '#1f2937' },
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    description: 'Engineering blue with grid overlay',
    group: 'minimal',
    preview: { bg: '#0c1929', accent: '#38bdf8', panel: '#132f4c' },
  },
  {
    id: 'riveted-metal',
    name: 'Riveted Metal',
    description: 'Brushed steel with neumorphic panels',
    group: 'minimal',
    preview: { bg: '#1a1a2e', accent: '#e2a03f', panel: '#25254a' },
  },
  {
    id: 'circuit-board',
    name: 'Circuit Board',
    description: 'PCB traces on dark substrate',
    group: 'minimal',
    preview: { bg: '#0a1a0a', accent: '#4ade80', panel: '#132613' },
  },
  {
    id: 'concrete-plant',
    name: 'Concrete Plant',
    description: 'Industrial grey with safety orange',
    group: 'minimal',
    preview: { bg: '#1c1c1e', accent: '#fb923c', panel: '#2c2c2e' },
  },
  {
    id: 'dark-ops',
    name: 'Dark Ops',
    description: 'Tactical black with red accents',
    group: 'minimal',
    preview: { bg: '#0a0a0a', accent: '#ef4444', panel: '#161616' },
  },
  // ─���─ Morphism (textured backgrounds + enhanced effects) ───────────
  {
    id: 'steel-forge-morphism',
    name: 'Steel Forge Morphism',
    description: 'Brushed metal texture with deep neumorphic shadows',
    group: 'morphism',
    preview: { bg: '#0f1520', accent: '#f59e0b', panel: '#1a2332' },
  },
  {
    id: 'blueprint-morphism',
    name: 'Blueprint Morphism',
    description: 'Technical paper texture with glassmorphic panels',
    group: 'morphism',
    preview: { bg: '#091622', accent: '#38bdf8', panel: '#0f2640' },
  },
  {
    id: 'riveted-metal-morphism',
    name: 'Riveted Metal Morphism',
    description: 'Diamond plate texture with raised panel effects',
    group: 'morphism',
    preview: { bg: '#151528', accent: '#e2a03f', panel: '#1e1e40' },
  },
  {
    id: 'circuit-board-morphism',
    name: 'Circuit Board Morphism',
    description: 'PCB close-up texture with glowing trace accents',
    group: 'morphism',
    preview: { bg: '#081508', accent: '#4ade80', panel: '#0f200f' },
  },
  {
    id: 'concrete-plant-morphism',
    name: 'Concrete Plant Morphism',
    description: 'Raw concrete texture with brutalist panel styling',
    group: 'morphism',
    preview: { bg: '#181818', accent: '#fb923c', panel: '#242424' },
  },
  {
    id: 'dark-ops-morphism',
    name: 'Dark Ops Morphism',
    description: 'Carbon fiber weave with tactical glass panels',
    group: 'morphism',
    preview: { bg: '#080808', accent: '#ef4444', panel: '#121212' },
  },
]

interface ThemeState {
  theme: SiteTheme
  setTheme: (theme: SiteTheme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'steel-forge',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'safestart-site-theme' }
  )
)

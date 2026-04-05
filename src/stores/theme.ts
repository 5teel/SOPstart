import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SiteTheme =
  | 'steel-forge'
  | 'blueprint'
  | 'riveted-metal'
  | 'circuit-board'
  | 'concrete-plant'
  | 'dark-ops'

export interface ThemeConfig {
  id: SiteTheme
  name: string
  description: string
  preview: {
    bg: string
    accent: string
    panel: string
  }
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'steel-forge',
    name: 'Steel Forge',
    description: 'Dark steel with amber highlights',
    preview: { bg: '#111827', accent: '#f59e0b', panel: '#1f2937' },
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    description: 'Engineering blue with grid overlay',
    preview: { bg: '#0c1929', accent: '#38bdf8', panel: '#132f4c' },
  },
  {
    id: 'riveted-metal',
    name: 'Riveted Metal',
    description: 'Brushed steel with neumorphic panels',
    preview: { bg: '#1a1a2e', accent: '#e2a03f', panel: '#25254a' },
  },
  {
    id: 'circuit-board',
    name: 'Circuit Board',
    description: 'PCB traces on dark substrate',
    preview: { bg: '#0a1a0a', accent: '#4ade80', panel: '#132613' },
  },
  {
    id: 'concrete-plant',
    name: 'Concrete Plant',
    description: 'Industrial grey with safety orange',
    preview: { bg: '#1c1c1e', accent: '#fb923c', panel: '#2c2c2e' },
  },
  {
    id: 'dark-ops',
    name: 'Dark Ops',
    description: 'Tactical black with red accents',
    preview: { bg: '#0a0a0a', accent: '#ef4444', panel: '#161616' },
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

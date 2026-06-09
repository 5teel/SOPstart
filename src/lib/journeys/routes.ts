import 'server-only'
import fs from 'fs'
import path from 'path'

export interface AppRoute {
  route: string
  area: 'auth' | 'protected' | 'public'
}

type Area = AppRoute['area']

/**
 * Live inventory of the app's page routes, read from the App Router file tree
 * at request time. New screens appear here automatically; route groups like
 * (auth)/(protected) are stripped from the path but recorded as the area.
 * Returns [] if the source tree isn't readable (degrades gracefully).
 */
export function listAppRoutes(): AppRoute[] {
  try {
    const appDir = path.join(process.cwd(), 'src', 'app')
    const found = new Map<string, AppRoute>()

    const walk = (dir: string, segs: string[], area: Area) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const name = entry.name
        if (name === 'api' || name.startsWith('@') || name.startsWith('_')) continue

        let nextArea = area
        if (name === '(auth)') nextArea = 'auth'
        else if (name === '(protected)') nextArea = 'protected'

        const isGroup = name.startsWith('(') && name.endsWith(')')
        const nextSegs = isGroup ? segs : [...segs, name]
        const full = path.join(dir, name)

        if (fs.existsSync(path.join(full, 'page.tsx'))) {
          const route = '/' + nextSegs.join('/')
          if (!found.has(route)) found.set(route, { route, area: nextArea })
        }
        walk(full, nextSegs, nextArea)
      }
    }

    walk(appDir, [], 'public')
    return Array.from(found.values()).sort((a, b) => a.route.localeCompare(b.route))
  } catch {
    return []
  }
}

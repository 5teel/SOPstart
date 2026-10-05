'use client'

import type { ReactNode } from 'react'

const bar = 'animate-pulse rounded bg-ink-100 motion-reduce:animate-none'

/**
 * The editor frame before there is anything to edit: a skeleton rail (three
 * sections) and, in the column, whatever is passed (the parse-progress card)
 * above three skeleton step cards. The frame shows it while the lazy editor
 * chunk loads, and the editor shows it while a SOP is still being read, so the
 * screen is never empty. Nothing editable, no bottom bar.
 */
export function EditorSkeleton({ children }: { children?: ReactNode }) {
  return (
    <>
      <nav
        data-testid="edit-rail-skeleton"
        aria-label="Steps"
        className="hidden w-75 shrink-0 flex-col gap-6 overflow-y-auto border-r border-ink-200 bg-paper-2 p-4 lg:flex"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className={`h-3 w-2/3 ${bar}`} />
            <div className={`h-5 w-full ${bar}`} />
            <div className={`h-5 w-5/6 ${bar}`} />
          </div>
        ))}
      </nav>
      <main data-testid="focus-column" className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-205 flex-col gap-6 px-4 py-8 lg:px-8">
          {children}
          {[0, 1, 2].map((i) => (
            <div key={i} data-testid="edit-skeleton-card" className={`h-28 rounded-lg ${bar}`} />
          ))}
        </div>
      </main>
    </>
  )
}

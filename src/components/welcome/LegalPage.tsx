import Link from 'next/link'
import type { ReactNode } from 'react'
import { Wordmark } from '@/components/brand/Wordmark'
import { ENQUIRIES_EMAIL } from '@/lib/contact'

/** The public privacy and terms pages: one column of plain sections. */
export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: [string, ReactNode][] }) {
  return (
    <div className="min-h-dvh bg-paper px-4 py-10 text-ink-900">
      <article className="mx-auto max-w-2xl">
        <Link href="/welcome" aria-label="SOPstart home">
          <Wordmark />
        </Link>
        <h1 className="mt-10 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-meta text-ink-500">Last updated {updated}</p>
        {sections.map(([heading, body]) => (
          <section key={heading} className="mt-8">
            <h2 className="text-xl font-semibold">{heading}</h2>
            <div className="mt-2 flex flex-col gap-3 text-reading text-ink-600">{body}</div>
          </section>
        ))}
        <p className="mt-10 border-t border-ink-200 pt-6 text-reading text-ink-600">
          Questions: <a href={`mailto:${ENQUIRIES_EMAIL}`} className="font-semibold text-ink-900 underline">{ENQUIRIES_EMAIL}</a>
        </p>
      </article>
    </div>
  )
}

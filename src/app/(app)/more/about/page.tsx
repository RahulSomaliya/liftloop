import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { SCHEMA_VERSION } from '@/db/schema-version'

export default function AboutPage() {
  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center gap-2">
        <Link href="/more" aria-label="Back" className="-ml-3 flex size-11 items-center justify-center text-muted-foreground">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-[17px] font-bold">About</h1>
      </header>
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-[14px] text-muted-foreground">
        <p>
          <span className="text-[17px] font-bold text-foreground">
            Lift<span className="text-primary">Loop</span>
          </span>{' '}
          — a personal, single-user workout logger. One goal per exercise, one tap per set.
        </p>
        <p>Public code, private data. MIT licensed. Runs on Vercel + Neon free tiers.</p>
        <p className="text-[12px] text-muted-foreground/70">Schema {SCHEMA_VERSION}</p>
      </section>
    </main>
  )
}

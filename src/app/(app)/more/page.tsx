import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { PROGRAM_V2 } from '@/db/seed/program-v2'

function Row({ title, sub, href }: { title: string; sub: string; href?: string }) {
  const inner = (
    <>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className={href ? 'text-[15px] font-semibold' : 'text-[15px] font-semibold text-muted-foreground/60'}>{title}</span>
        <span className="text-[13px] text-muted-foreground/70">{sub}</span>
      </span>
      <ChevronRight size={18} className="text-muted-foreground/70" />
    </>
  )
  const cls = 'flex h-15 items-center gap-3 border-t border-border px-4 first:border-t-0'
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls} aria-disabled>
      {inner}
    </div>
  )
}

export default function MorePage() {
  return (
    <main className="flex flex-col gap-5 px-5 pt-2">
      <header className="flex h-14 items-center">
        <h1 className="text-[20px] font-bold tracking-[-0.02em]">More</h1>
      </header>
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <Row title="Progress" sub="Adherence, weekly sets, exercise charts" href="/progress" />
        <Row title="Coach export" sub="Markdown report for any range" href="/more/export" />
        <Row title="Import from notes" sub="Paste your shorthand" href="/more/import" />
        <Row title="Backup" sub="JSON export and restore" href="/more/backup" />
      </section>
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <Row title="Program" sub={`v${PROGRAM_V2.program.version} · ${PROGRAM_V2.templates.length} templates · ${PROGRAM_V2.exercises.length} exercises`} href="/more/program" />
        <Row title="Settings" sub="Rest timers, gym config" href="/more/settings" />
        <Row title="About" sub="LiftLoop · single user · MIT" href="/more/about" />
      </section>
    </main>
  )
}

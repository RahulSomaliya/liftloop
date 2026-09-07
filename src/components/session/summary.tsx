import Link from 'next/link'
import type { SessionSummary } from '@/actions/session'

export function Summary({ summary }: { summary: SessionSummary }) {
  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center justify-between">
        <h1 className="text-[15px] font-bold">{summary.templateName ?? 'Session'} done</h1>
        <span className="text-[13px] tabular-nums text-muted-foreground">{summary.durationMin} min</span>
      </header>
      <div className="grid grid-cols-3 gap-2.5">
        {[
          [summary.setCount, 'sets'],
          [summary.beatCount, 'beat'],
          [summary.prs.length, 'PR'],
        ].map(([n, l]) => (
          <div key={l} className="flex flex-col items-center gap-0.5 rounded-2xl border border-border bg-card py-3.5">
            <span className="text-[26px] font-bold tabular-nums tracking-[-0.02em]">{n}</span>
            <span className="text-[12px] font-medium text-muted-foreground/70">{l}</span>
          </div>
        ))}
      </div>
      {summary.prs.map((pr) => (
        <div key={pr} className="flex items-center gap-2.5 rounded-2xl border border-success/30 bg-success/15 px-3.5 py-3">
          <span className="rounded-md border border-success px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-success">PR</span>
          <span className="text-[14px] tabular-nums">{pr}</span>
        </div>
      ))}
      <ul className="flex flex-col">
        {summary.exercises.map((e) => (
          <li key={e.name} className="flex flex-col gap-0.5 border-b border-border py-2.5">
            <span className="text-[14px] font-semibold">{e.name}</span>
            <span className="text-[13px] tabular-nums text-muted-foreground">{e.collapsed ?? 'not logged'}</span>
          </li>
        ))}
      </ul>
      {summary.shorthand && <pre className="overflow-x-auto rounded-2xl border border-border bg-card p-3.5 font-mono text-[12px] leading-relaxed text-muted-foreground">{summary.shorthand}</pre>}
      <div className="flex flex-col items-center gap-1 pb-2">
        <span className="text-[13px] text-muted-foreground/70">Next up</span>
        <span className="text-[22px] font-bold tracking-[-0.02em]">{summary.nextTemplateName}</span>
      </div>
      <Link href="/" className="flex h-13 items-center justify-center rounded-2xl border border-border bg-secondary text-[16px] font-semibold">
        Back to Home
      </Link>
    </main>
  )
}

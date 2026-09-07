import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { getDb } from '@/db/client'
import { loadGym } from '@/db/queries/session'
import { PROGRAM_V2 } from '@/db/seed/program-v2'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const gym = await loadGym(await getDb())
  const rows: [string, string][] = [
    ['Rest, first exercise', `${PROGRAM_V2.restSecondsFirstExercise} s`],
    ['Rest, other exercises', `${PROGRAM_V2.restSecondsDefault} s`],
    ['Stacks', `kg, ${gym.stackStepKg} kg steps (odd values allowed)`],
    ['Free weights', 'lb'],
    ['Plates (lb, per side)', gym.platesLb.join(' · ')],
    ['Dumbbell rack (lb)', `${gym.dumbbellRackLb.join(' · ')}, then +5`],
    ['Body weight', 'kg · waist cm'],
    ['Time zone', 'Asia/Kolkata (weeks start Monday)'],
  ]
  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center gap-2">
        <Link href="/more" aria-label="Back" className="-ml-3 flex size-11 items-center justify-center text-muted-foreground">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-[17px] font-bold">Settings</h1>
      </header>
      <section className="flex flex-col rounded-2xl border border-border bg-card">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 border-t border-border px-4 py-3 text-[14px] first:border-t-0">
            <span className="text-muted-foreground">{k}</span>
            <span className="text-right tabular-nums">{v}</span>
          </div>
        ))}
      </section>
      <p className="text-[13px] text-muted-foreground/70">Read-only in v1. The gym config and rest defaults become editable with the program editor (v1.1).</p>
    </main>
  )
}

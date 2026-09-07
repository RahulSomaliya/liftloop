import { Moon } from 'lucide-react'
import Link from 'next/link'
import { templateExerciseNames } from '@/actions/session'
import { DiscardButton } from '@/components/home/discard-button'
import { HomeMenu } from '@/components/home/home-menu'
import { QuickEntry } from '@/components/home/quick-entry'
import { StartButton } from '@/components/home/start-button'
import { getDb } from '@/db/client'
import { getHomeData } from '@/db/queries/home'
import { SHOULDER_BANNER } from '@/lib/domain/flags'
import { todayIST, tzDate } from '@/lib/domain/time'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

function fmtDay(date: string): string {
  return format(tzDate(date), 'EEE d MMM')
}

function fmtRange(from: string, to: string): string {
  return `${format(tzDate(from), 'd')}–${format(tzDate(to), 'd MMM')}`
}

export default async function HomePage() {
  const today = todayIST()
  const db = await getDb()
  const data = await getHomeData(db, today)
  const exerciseNames = data.inProgress ? [] : await templateExerciseNames(data.nextTemplate.id)
  const phaseLabel =
    data.phase.name === 'Easy' && data.phase.source === 'manual'
      ? 'Easy week (manual)'
      : `${data.phase.name} · week ${data.phase.week}${data.phase.name === 'Ramp' ? ' of 2' : data.phase.name === 'Build 1' ? ' of 6' : ''}`
  const rule = `${data.phase.setsRule === 'as written' ? 'Sets as written' : data.phase.setsRule[0].toUpperCase() + data.phase.setsRule.slice(1)} · ${data.phase.rirRule === '4 RIR' ? 'stop with 4 reps left' : `${data.phase.rirRule.replace(' RIR', '')} reps in reserve`}`

  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center justify-between">
        <span className="text-[17px] font-bold tracking-[-0.02em]">
          Lift<span className="text-primary">Loop</span>
        </span>
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span>{fmtDay(today)}</span>
          <HomeMenu
            templates={data.program.templates.map((t) => ({ id: t.id, name: t.name }))}
            nextTemplateId={data.nextTemplate.id}
            hasLiveSession={data.inProgress !== null}
            manualEasy={data.phase.isEasyWeek && data.phase.source === 'manual'}
          />
        </div>
      </header>

      {data.shoulderFlag && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3.5 text-[14px]">
          <span className="mt-2 size-2 shrink-0 rounded-full bg-destructive" aria-hidden />
          <span>{SHOULDER_BANNER}</span>
        </div>
      )}

      <section className="flex flex-col gap-3.5 rounded-[18px] border border-border bg-card px-5 pb-5 pt-5">
        {data.inProgress ? (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-[13px] font-semibold tracking-wide text-muted-foreground">IN PROGRESS</h1>
              <span className="text-[13px] tabular-nums text-muted-foreground/70">started {fmtElapsed(data.inProgress.startedAt)}</span>
            </div>
            <p className="text-[40px] font-bold leading-none tracking-[-0.03em]">{data.inProgress.templateName}</p>
            <Link href={`/session/${data.inProgress.id}`} className="flex h-14 items-center justify-center rounded-2xl bg-primary text-[17px] font-bold text-primary-foreground">
              Resume {data.inProgress.templateName}
            </Link>
            <DiscardButton sessionId={data.inProgress.id} />
          </>
        ) : (
          <>
            <h1 className="text-[13px] font-semibold tracking-wide text-muted-foreground">NEXT UP</h1>
            <p className="text-[40px] font-bold leading-none tracking-[-0.03em]">{data.nextTemplate.name}</p>
            <p className="text-[14px] text-muted-foreground">{exerciseNames.join(' · ')}</p>
            <StartButton templateId={data.nextTemplate.id} templateName={data.nextTemplate.name} />
          </>
        )}
      </section>

      <div className="flex items-center gap-2.5" aria-label={`${data.week.done} of ${data.week.target} sessions this week`}>
        <div className="flex gap-2">
          {Array.from({ length: data.week.target }, (_, i) => (
            <span key={i} className={`size-3.5 rounded-full ${i < data.week.done ? 'bg-primary' : 'bg-accent'}`} />
          ))}
        </div>
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {data.week.done}/{data.week.target} this week{data.week.walks ? ` · +${data.week.walks} walk` : ''}
        </span>
      </div>

      <section className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">{phaseLabel}</h2>
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[12px] font-semibold text-primary">{data.weekPhase.targetDays} days/week</span>
        </div>
        <p className="text-[14px] text-muted-foreground">{rule}</p>
        <div className="flex flex-wrap items-center gap-2">
          {data.sleepGateOpen && (
            <span className="flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[12px] font-semibold text-success">
              <Moon size={14} aria-hidden /> 6th day OK this week
            </span>
          )}
          <span className="text-[13px] text-muted-foreground/70">
            {data.phase.isEasyWeek ? `Easy week until ${fmtDay(data.phase.weekEnd)}` : `Easy week ${fmtRange(data.nextEasy.from, data.nextEasy.to)}`}
          </span>
        </div>
      </section>

      {data.exportNudge.kind !== 'none' && (
        <Link href="/more/export" className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-[14px]">
          <span className="text-muted-foreground">{data.exportNudge.kind === 'never' ? 'Never exported for your coach' : `${data.exportNudge.days} days since last coach export`}</span>
          <span className="font-semibold text-primary">Export</span>
        </Link>
      )}

      <QuickEntry weightKg={data.today.weightKg} sleepGood={data.today.sleepGood} />
    </main>
  )
}

function fmtElapsed(startedAtIso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(startedAtIso).getTime()) / 60000))
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return `${h} h ${min % 60} min ago`
}

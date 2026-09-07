'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { importNotes } from '@/actions/import'
import { Button } from '@/components/ui/button'
import { groupByDate, planImport, type PlannedBlock } from '@/lib/domain/import-plan'
import { serializeSessionLine, type ExerciseNameRef } from '@/lib/domain/shorthand'
import { cn } from '@/lib/utils'

const SAMPLE = `Machine Chest Press 8-12 x 3
25.12.12.12
27.12.9.8

Reverse pec deck 15-20 x 2
20.18.17
20.20.20`

export function ImportView({ exercises, today }: { exercises: ExerciseNameRef[]; today: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [date, setDate] = useState(today)
  const [blocks, setBlocks] = useState<PlannedBlock[] | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [fromReport, setFromReport] = useState(false)
  const [pending, start] = useTransition()

  function preview() {
    const plan = planImport(text, exercises, date)
    setBlocks(plan.blocks)
    setErrors(plan.errors.map((e) => `Line ${e.lineNumber}: ${e.message}`))
    setFromReport(plan.fromReport)
  }

  function setBlock(i: number, patch: Partial<PlannedBlock>) {
    setBlocks((prev) => prev?.map((b, j) => (j === i ? { ...b, ...patch } : b)) ?? null)
  }

  function save() {
    if (!blocks) return
    const groups = groupByDate(blocks)
    if (groups.length === 0) {
      toast.error('Nothing to import — map or skip the unresolved exercises')
      return
    }
    start(async () => {
      try {
        const r = await importNotes({ groups })
        toast.success(`Imported ${r.created} session${r.created === 1 ? '' : 's'}`)
        router.push('/history')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Import failed')
      }
    })
  }

  const kept = blocks ? groupByDate(blocks) : []

  return (
    <div className="flex flex-col gap-3.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={SAMPLE}
        rows={9}
        spellCheck={false}
        aria-label="Shorthand notes"
        className="w-full rounded-2xl border border-border bg-card p-3.5 font-mono text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-[12px] text-muted-foreground">
          Most recent line is from
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl border border-border bg-card px-3 text-[14px] text-foreground" />
        </label>
        <Button variant="secondary" onClick={preview} disabled={!text.trim()} className="h-11 rounded-xl px-5 font-semibold">
          Preview
        </Button>
      </div>
      <p className="text-[12px] text-muted-foreground/70">Each block keeps its last two lines: the last line gets this date, the one above gets the week before. A pasted coach report uses its own dates.</p>

      {errors.length > 0 && (
        <ul className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px]">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {blocks && (
        <section className="flex flex-col gap-3">
          {fromReport && <p className="text-[13px] text-muted-foreground">Coach report detected — using its Sessions section.</p>}
          {blocks.length === 0 && <p className="text-[14px] text-muted-foreground/70">No exercise blocks found.</p>}
          {blocks.map((b, i) => (
            <div key={`${b.lineNumber}-${b.rawName}`} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[14px] font-semibold">{b.rawName}</span>
                {b.exerciseId ? (
                  <span className="text-[12px] text-success">{exercises.find((e) => e.id === b.exerciseId)?.name === b.rawName ? 'matched' : `→ ${exercises.find((e) => e.id === b.exerciseId)?.name}`}</span>
                ) : (
                  <span className="text-[12px] text-destructive">unknown</span>
                )}
              </div>
              {!b.exerciseId && (
                <select value="" onChange={(e) => setBlock(i, { exerciseId: e.target.value || null })} aria-label={`Map ${b.rawName}`} className="h-11 rounded-xl border border-border bg-secondary px-3 text-[14px]">
                  <option value="">Skip this block</option>
                  {exercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              )}
              {b.lines.map((l, li) => (
                <div key={l.lineNumber} className={cn('flex items-center gap-2', !l.keep && 'opacity-40')}>
                  <input
                    type="date"
                    value={l.date}
                    max={today}
                    disabled={!l.keep}
                    onChange={(e) => setBlock(i, { lines: b.lines.map((x, k) => (k === li ? { ...x, date: e.target.value } : x)) })}
                    aria-label={`Date for ${b.rawName} line ${li + 1}`}
                    className="h-10 w-36 rounded-lg border border-border bg-secondary px-2 text-[13px] text-foreground"
                  />
                  <span className="font-mono text-[13px] tabular-nums">{serializeSessionLine(l.segments)}</span>
                  {!l.keep && <span className="text-[11px]">skipped</span>}
                </div>
              ))}
            </div>
          ))}
          {blocks.length > 0 && (
            <>
              <p className="text-[13px] text-muted-foreground">
                Will create {kept.length} session{kept.length === 1 ? '' : 's'}: {kept.map((g) => `${g.date} (${g.entries.length})`).join(', ') || '—'}
              </p>
              <Button onClick={save} disabled={pending || kept.length === 0} className="h-14 rounded-2xl text-[16px] font-bold">
                {pending ? 'Importing…' : 'Import'}
              </Button>
            </>
          )}
        </section>
      )}
    </div>
  )
}

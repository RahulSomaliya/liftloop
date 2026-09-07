'use client'

import { Copy, Share } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { recordExport } from '@/actions/export'
import { cn } from '@/lib/utils'

const PRESETS: { key: string; label: string }[] = [
  { key: '14d', label: 'Last 14 days' },
  { key: '7d', label: 'Last 7' },
  { key: 'week', label: 'This week' },
  { key: 'custom', label: 'Custom' },
]

export function ExportView({ text, from, to, preset, sessions, walks }: { text: string; from: string; to: string; preset: string; sessions: number; walks: number }) {
  const router = useRouter()
  const [customOpen, setCustomOpen] = useState(preset === 'custom')
  const [cFrom, setCFrom] = useState(from)
  const [cTo, setCTo] = useState(to)
  const [busy, setBusy] = useState(false)
  // false on the server and during hydration, the real answer after — without an effect/setState.
  const canShare = useSyncExternalStore(
    () => () => undefined,
    () => typeof navigator.share === 'function',
    () => false,
  )

  async function share() {
    setBusy(true)
    try {
      await navigator.share({ title: 'LiftLoop report', text })
      await recordExport({ from, to })
      router.refresh()
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) toast.error('Could not share — use Copy instead')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    setBusy(true)
    try {
      await navigator.clipboard.writeText(text)
      await recordExport({ from, to })
      toast.success('Copied — paste it into your coach chat')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error && e.name !== 'NotAllowedError' ? e.message : 'Could not copy — select the text and copy it manually')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PRESETS.map((p) =>
          p.key === 'custom' ? (
            <button key={p.key} type="button" onClick={() => setCustomOpen((o) => !o)} className={cn('h-10 shrink-0 rounded-full border px-3 text-[13px] font-semibold', preset === 'custom' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground')}>
              {p.label}
            </button>
          ) : (
            <Link key={p.key} href={`/more/export?preset=${p.key}`} className={cn('flex h-10 shrink-0 items-center rounded-full border px-3 text-[13px] font-semibold', preset === p.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground')}>
              {p.label}
            </Link>
          ),
        )}
      </div>
      {customOpen && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            router.push(`/more/export?from=${cFrom}&to=${cTo}`)
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-[12px] text-muted-foreground">
            From
            <input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)} className="h-11 rounded-xl border border-border bg-card px-3 text-[14px] text-foreground" />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-[12px] text-muted-foreground">
            To
            <input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)} className="h-11 rounded-xl border border-border bg-card px-3 text-[14px] text-foreground" />
          </label>
          <button type="submit" className="h-11 rounded-xl border border-border bg-secondary px-4 text-[14px] font-semibold">
            Go
          </button>
        </form>
      )}
      <p className="text-[13px] tabular-nums text-muted-foreground/70">
        {from} → {to} · {sessions} session{sessions === 1 ? '' : 's'} · {walks} walk{walks === 1 ? '' : 's'}
      </p>
      <pre className="max-h-[52dvh] overflow-auto rounded-2xl border border-border bg-card p-3.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground">{text}</pre>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={copy} disabled={busy} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground disabled:opacity-60">
          <Copy size={18} /> Copy
        </button>
        <button type="button" onClick={share} disabled={busy || !canShare} title={canShare ? undefined : 'Sharing is not available in this browser'} className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-secondary text-[16px] font-semibold disabled:text-muted-foreground/60">
          <Share size={18} /> Share
        </button>
      </div>
    </div>
  )
}

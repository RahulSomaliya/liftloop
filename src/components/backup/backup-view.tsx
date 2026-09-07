'use client'

import { Download, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { restoreFromBackup } from '@/actions/backup'
import { Button } from '@/components/ui/button'

export function BackupView({ hasData, schemaVersion }: { hasData: boolean; schemaVersion: string }) {
  const router = useRouter()
  const [file, setFile] = useState<{ name: string; json: unknown } | null>(null)
  const [confirm, setConfirm] = useState('')
  const [pending, start] = useTransition()

  async function onPick(f: File | undefined) {
    if (!f) return
    try {
      const json: unknown = JSON.parse(await f.text())
      setFile({ name: f.name, json })
    } catch {
      toast.error('That file is not valid JSON')
    }
  }

  function doRestore() {
    if (!file) return
    start(async () => {
      try {
        const r = await restoreFromBackup({ file: file.json, confirm })
        toast.success(`Restored ${r.restored.session} sessions, ${r.restored.set_log} sets`)
        setFile(null)
        setConfirm('')
        router.push('/')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Restore failed')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-[15px] font-semibold">Download a backup</h2>
        <p className="text-[13px] text-muted-foreground">Every table as JSON, including deleted rows. Keep it somewhere safe; it is your whole training history.</p>
        <a href="/api/backup" download className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground">
          <Download size={18} /> Download backup
        </a>
        <p className="text-[11px] text-muted-foreground/60">Schema {schemaVersion}</p>
      </section>
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-[15px] font-semibold">Restore</h2>
        <p className="text-[13px] text-muted-foreground">{hasData ? 'This replaces everything in the app with the backup. Type RESTORE to confirm.' : 'The app is empty, so a restore runs straight away.'}</p>
        <label className="flex h-13 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-secondary text-[15px] font-semibold">
          <Upload size={18} /> {file ? file.name : 'Choose backup file'}
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
        {hasData && file && <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type RESTORE" aria-label="Type RESTORE to confirm" className="h-12 rounded-xl border border-destructive/50 bg-secondary px-4 text-[15px] tracking-wider outline-none" />}
        <Button variant="destructive" disabled={!file || pending || (hasData && confirm !== 'RESTORE')} onClick={doRestore} className="h-13 rounded-2xl text-[15px] font-bold">
          {pending ? 'Restoring…' : 'Restore backup'}
        </Button>
      </section>
    </div>
  )
}

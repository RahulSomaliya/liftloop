'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function CopyButton({ text, label = 'Copy', onCopied, className }: { text: string; label?: string; onCopied?: () => Promise<void> | void; className?: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
      await onCopied?.()
      toast.success('Copied')
    } catch {
      toast.error('Could not copy — select the text and copy it manually')
    }
  }
  return (
    <button type="button" onClick={copy} className={cn('flex h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-primary', className)}>
      {done ? <Check size={18} /> : <Copy size={18} />} {label}
    </button>
  )
}

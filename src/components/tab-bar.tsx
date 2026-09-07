'use client'

import { CalendarDays, Ellipsis, House } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/', label: 'Home', icon: House },
  { href: '/history', label: 'History', icon: CalendarDays },
  { href: '/more', label: 'More', icon: Ellipsis },
] as const

export function TabBar() {
  const pathname = usePathname()
  // The logging screen is full-screen (spec §6.3: nothing else on it); the header carries Back.
  if (pathname.startsWith('/session/')) return null
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 gap-1 border-t border-border bg-card px-2 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]"
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn('flex h-13 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium', active ? 'text-foreground' : 'text-muted-foreground/70')}
          >
            <Icon size={22} strokeWidth={1.8} aria-hidden />
            <span className={cn(active && 'font-semibold')}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

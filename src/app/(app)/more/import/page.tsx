import { asc } from 'drizzle-orm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { ImportView } from '@/components/import/import-view'
import { getDb } from '@/db/client'
import { exercise } from '@/db/schema'
import { todayIST } from '@/lib/domain/time'

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
  const db = await getDb()
  const exercises = await db.select({ id: exercise.id, name: exercise.name, aliases: exercise.aliases }).from(exercise).orderBy(asc(exercise.name))
  return (
    <main className="flex flex-col gap-3.5 px-5 pt-2">
      <header className="flex h-14 items-center gap-2">
        <Link href="/more" aria-label="Back" className="-ml-3 flex size-11 items-center justify-center text-muted-foreground">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-[17px] font-bold">Import from notes</h1>
      </header>
      <ImportView exercises={exercises} today={todayIST()} />
    </main>
  )
}

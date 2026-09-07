import { asc, eq } from 'drizzle-orm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExerciseForm } from '@/components/editor/exercise-form'
import { getDb } from '@/db/client'
import { rowToExerciseCfg } from '@/db/queries/session'
import { exercise } from '@/db/schema'

export const dynamic = 'force-dynamic'

export default async function ExerciseEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const db = await getDb()
  const [row] = await db.select().from(exercise).where(eq(exercise.id, id)).limit(1)
  if (!row) notFound()
  const library = await db.select({ id: exercise.id, name: exercise.name }).from(exercise).orderBy(asc(exercise.name))
  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center gap-2">
        <Link href={`/exercise/${id}`} aria-label="Back" className="-ml-3 flex size-11 items-center justify-center text-muted-foreground">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="truncate text-[17px] font-bold">Edit {row.name}</h1>
      </header>
      <ExerciseForm exercise={{ ...rowToExerciseCfg(row), archived: row.archived, defaultLo: row.defaultLo, defaultHi: row.defaultHi, defaultSets: row.defaultSets }} library={library} />
    </main>
  )
}

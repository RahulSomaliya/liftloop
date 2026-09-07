import { asc } from 'drizzle-orm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { ExerciseForm } from '@/components/editor/exercise-form'
import { getDb } from '@/db/client'
import { exercise } from '@/db/schema'

export const dynamic = 'force-dynamic'

export default async function NewExercisePage() {
  const db = await getDb()
  const library = await db.select({ id: exercise.id, name: exercise.name }).from(exercise).orderBy(asc(exercise.name))
  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center gap-2">
        <Link href="/more/program?edit=1" aria-label="Back" className="-ml-3 flex size-11 items-center justify-center text-muted-foreground">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-[17px] font-bold">New exercise</h1>
      </header>
      <ExerciseForm exercise={null} library={library} />
    </main>
  )
}

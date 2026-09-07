import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { BackupView } from '@/components/backup/backup-view'
import { hasUserData } from '@/db/backup'
import { getDb } from '@/db/client'
import { SCHEMA_VERSION } from '@/db/schema-version'

export const dynamic = 'force-dynamic'

export default async function BackupPage() {
  const hasData = await hasUserData(await getDb())
  return (
    <main className="flex flex-col gap-3.5 px-5 pt-2">
      <header className="flex h-14 items-center gap-2">
        <Link href="/more" aria-label="Back" className="-ml-3 flex size-11 items-center justify-center text-muted-foreground">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-[17px] font-bold">Backup</h1>
      </header>
      <BackupView hasData={hasData} schemaVersion={SCHEMA_VERSION} />
    </main>
  )
}

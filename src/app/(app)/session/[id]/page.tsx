import { notFound } from 'next/navigation'
import { loadSessionView } from '@/actions/session'
import { SessionScreen } from '@/components/session/session-screen'
import { Summary } from '@/components/session/summary'
import { getDb } from '@/db/client'
import { buildSummary } from '@/db/queries/summary'

export const dynamic = 'force-dynamic'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const view = await loadSessionView(id)
  if (!view) notFound()
  if (view.finishedAt) {
    // Finished: show the summary (the finish action's revalidation re-renders this page, so a
    // redirect here would replace the client-side summary before the user sees it).
    const summary = await buildSummary(await getDb(), id)
    if (!summary) notFound()
    return <Summary summary={summary} />
  }
  return <SessionScreen view={view} />
}

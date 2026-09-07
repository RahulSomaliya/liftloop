import { notFound, redirect } from 'next/navigation'
import { loadSessionView } from '@/actions/session'
import { SessionScreen } from '@/components/session/session-screen'

export const dynamic = 'force-dynamic'

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const view = await loadSessionView(id)
  if (!view) notFound()
  if (view.finishedAt) redirect(`/history/${id}`)
  return <SessionScreen view={view} />
}

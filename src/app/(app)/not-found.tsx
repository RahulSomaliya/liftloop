import { NotFoundView } from '@/components/not-found-view'

// Catches notFound() from /session/[id], /history/[id], /exercise/[id] — keeps the tab bar.
export default function AppNotFound() {
  return <NotFoundView />
}

import { NotFoundView } from '@/components/not-found-view'

// Unknown URLs outside the (app) group (no tab bar; the proxy still requires sign-in first).
export default function RootNotFound() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 pt-[var(--safe-top)] md:max-w-2xl">
      <NotFoundView />
    </div>
  )
}

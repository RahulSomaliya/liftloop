import { TabBar } from '@/components/tab-bar'
import { Toaster } from '@/components/ui/sonner'
import { QueueProvider } from '@/lib/queue/provider'

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <QueueProvider>
      <div className="mx-auto w-full max-w-md flex-1 pt-[var(--safe-top)] pb-28 md:max-w-2xl">{children}</div>
      <TabBar />
      <Toaster position="bottom-center" offset={104} mobileOffset={{ bottom: 'calc(var(--safe-bottom) + 96px)' }} />
    </QueueProvider>
  )
}

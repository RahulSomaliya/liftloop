import { TabBar } from '@/components/tab-bar'
import { Toaster } from '@/components/ui/sonner'

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <div className="mx-auto w-full max-w-md flex-1 pb-28 md:max-w-2xl">{children}</div>
      <TabBar />
      <Toaster position="bottom-center" offset={104} />
    </>
  )
}

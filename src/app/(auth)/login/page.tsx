import type { Metadata } from 'next'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in · LiftLoop' }

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-10 px-7 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.03em]">
          Lift<span className="text-primary">Loop</span>
        </h1>
        <p className="text-muted-foreground">Personal workout logger. One goal per exercise, one tap per set.</p>
      </div>
      <LoginForm />
      <p className="text-center text-[13px] text-muted-foreground/70">Single user · private data · public code</p>
    </main>
  )
}

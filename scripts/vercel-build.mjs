// Vercel build entry (see vercel.json). Production deploys migrate + seed before `next build`
// so a fresh deploy is complete without manual steps; previews and local builds stay pure.
// WHY a script and not "vercel-build" in package.json: Vercel's precedence for that name is
// undocumented, while vercel.json `buildCommand` is (spec §10.3).
import { execSync } from 'node:child_process'

const isProd = process.env.VERCEL_ENV === 'production'
const steps = isProd ? ['pnpm db:migrate', 'pnpm db:seed', 'pnpm build'] : ['pnpm build']
for (const cmd of steps) {
  console.log(`\n▶ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', env: process.env })
}

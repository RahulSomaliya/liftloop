# LiftLoop

A personal, single-user, mobile-first workout logger. The app tells you **one goal per exercise**, you do the set, you tap once. History, comparisons, progression, phases and the coach report happen behind that.

- The code is public; the data is private. One passcode, one owner, no accounts.
- Runs on free tiers: Vercel Hobby + Neon Postgres Free. Locally it runs on an embedded Postgres (PGlite) — no Docker, no cloud account needed.
- Spec: [`docs/superpowers/specs/2026-09-07-liftloop-design.md`](docs/superpowers/specs/2026-09-07-liftloop-design.md). Build plan: [`docs/superpowers/plans/`](docs/superpowers/plans/). Screen mockups: [`design/`](design/).

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript strict · Tailwind 4 + shadcn/ui · Drizzle ORM · PGlite (dev/test) / `@neondatabase/serverless` (prod) · `jose` · Zod · date-fns + `@date-fns/tz` · Vitest.

## Local development

```bash
pnpm install
cp .env.example .env        # set APP_PASSCODE (≥ 8 chars) and SESSION_SECRET (openssl rand -base64 32)
pnpm db:reset               # creates ./.pglite, runs migrations, seeds the program
pnpm dev                    # http://localhost:3000 → sign in with APP_PASSCODE
```

Leave `DATABASE_URL` unset locally and the app uses the embedded PGlite database in `./.pglite` (gitignored — it is your personal data). Point `DATABASE_URL` at any Postgres to use that instead.

```bash
pnpm test        # Vitest: domain logic + DB tests on in-memory PGlite
pnpm typecheck   # tsc --noEmit
pnpm lint
pnpm build       # next build
```

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `APP_PASSCODE` | yes | ≥ 8 characters. The only credential. |
| `SESSION_SECRET` | yes | ≥ 32 characters (`openssl rand -base64 32`). Signs the 90-day sign-in cookie; rotate it to sign out everywhere. |
| `DATABASE_URL` | prod | Pooled Neon connection string. Set automatically by the Neon Vercel integration. Unset locally → PGlite. |
| `DATABASE_URL_UNPOOLED` | prod | Direct Neon connection string, used for migrations. Also set by the integration. |
| `REPORT_OWNER_NAME` | optional | Name printed in the coach report title. Omit on a fork. |
| `COACH_EXPORT_TOKEN` | optional | ≥ 32 chars. Enables `GET /api/coach-export?token=<it>&days=14` so your coach can fetch the markdown by URL. Unset = route disabled. |

## Deploy (Vercel + Neon, both free)

1. Push this repo to GitHub and **import it in the Vercel dashboard** (Hobby plan). Framework preset: Next.js. Leave the build command alone — `vercel.json` sets it.
2. In the Vercel project → **Storage → Create Database → Neon** (Marketplace). This provisions a Neon Free project and injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED` into the project.
3. **Settings → Environment Variables**: add `APP_PASSCODE`, `SESSION_SECRET` and optionally `REPORT_OWNER_NAME` / `COACH_EXPORT_TOKEN` (Production; add Preview too if you want preview deploys to sign in). Do not add `TZ` — Vercel reserves that name, and the app zones every date to Asia/Kolkata in code anyway.
4. **Deploy** (or push to `main`). Production builds run `pnpm db:migrate && pnpm db:seed && next build` (see `scripts/vercel-build.mjs`), so the schema and the program are in place on the first deploy. Preview and local builds are a plain `next build`.
5. Open the project domain (`<project>.vercel.app`, e.g. `liftloop-mu.vercel.app`) on your phone, sign in, add it to the home screen. Use that domain for the coach export link too. The team-scoped URLs (`liftloop-<team>.vercel.app`, `liftloop-git-main-…`) sit behind Vercel's own SSO under the default "Standard" deployment protection and only open for a browser signed in to Vercel.

Every push to `main` is a production deploy; migrations are additive (expand/contract) so a deploy never breaks the still-serving previous build.

## Database

- Schema: `src/db/schema.ts`. After changing it: `pnpm db:generate` (writes `drizzle/*.sql`), then `pnpm db:migrate`.
- Seed: `src/db/seed/program-v2.ts` is the program (templates, exercise library, gym config). `pnpm db:seed` is safe to re-run at any time: it upserts the program definition and **never** touches sessions, set logs, the loop pointer, easy-week overrides, or any row you edited in the app (More → Program → Edit, Exercise → Edit, Settings).
- Local reset: `pnpm db:reset` wipes `./.pglite` and re-creates it.

## The shorthand

Sessions render (and, in Phase 2, import) as a compact text format — the same one the coach report uses:

```
Machine Chest Press 8-12 x 3
25.12.12.12
27.12.9.8
```

Header: `<name> <lo>-<hi> x <sets>` (also `<reps> x <sets>` or `failure x <sets>`, with an optional `/arm` or `/leg`). Each following line is one session: load first, then one number per set; `f` = to failure; `12,5` = 12.5; a load change mid-exercise is a second space-separated block (`25.12.12 27.10`). Stacks are kg, free weights lb; the unit comes from the exercise, never from the text.

## Deploy your own

Fork the repo, do the Deploy steps above with your own Vercel + Neon + passcode, and edit `src/db/seed/program-v2.ts` for your program (templates, rep ranges, exercise units and increments, dumbbell rack). The app is deliberately single-user: one deployment = one lifter.

## Security notes

- Sign-in is a single passcode compared in constant time, rate-limited to 5 failed attempts per 15 minutes (global, DB-backed).
- Changing `APP_PASSCODE` does not revoke existing sign-in cookies; rotate `SESSION_SECRET` to sign out everywhere.
- Never commit `.env*` (except `.env.example`), `exports/`, `*.dump.json` or `.pglite/`.

## Status

- **Phase 1 (core)** — done: sign-in, seeded program, Home (loop, phase, week dots, sleep + weight quick entry), goal-first session logging with a durable write queue, History, coach export.
- **Phase 2** — done: Body screen, walk days, start a different template, manual easy weeks, discard/undo, swap, "type it instead", PR badges, wake lock, History calendar + set editing + session delete, Exercise detail, notes-text import, JSON backup/restore, PWA (manifest, icons, service worker), Share, Program/Settings/About.
- **Phase 3 (v1.1)** — done: Progress (12-week adherence heatmap, weekly hard sets vs target, per-exercise load/e1RM/volume charts), in-app program + exercise + gym-config editor (archive, never delete; edited rows survive re-seeding), offline session screen (service worker), optional `GET /api/coach-export?token=…&days=14` endpoint.

## License

MIT — see `LICENSE`.

# QA

Headless-Chrome QA for handovers. `qa/shots/` and the gallery HTML are gitignored (they contain screenshots of personal data).

```bash
# once, outside the repo (puppeteer-core is not a project dependency)
mkdir -p /tmp/ll-pp && cd /tmp/ll-pp && npm i puppeteer-core
# from the repo, with `pnpm dev` running on :3000 against a fresh `pnpm db:reset`
cp qa/shots.mjs /tmp/ll-pp/ && node /tmp/ll-pp/shots.mjs qa/shots liftloop-dev
python3 ~/.claude/scripts/qa-gallery.py --manifest qa/shots/manifest.json -o qa/qa-YYYY-MM-DD-phase1.html
```

## Loading skeletons, error and 404 screens

`qa/loaders-qa.mjs` photographs every `loading.tsx` fallback plus the 404 screens. The dev server must run with the slow-DB hook, otherwise PGlite answers in a few ms and the skeleton never shows:

```bash
pnpm db:reset && LIFTLOOP_QA_SLOW_MS=2500 pnpm dev     # hook lives in src/db/client.ts, ignored in production
cp qa/loaders-qa.mjs /tmp/ll-pp/ && node /tmp/ll-pp/loaders-qa.mjs qa/loaders-shots liftloop-dev
python3 ~/.claude/scripts/qa-gallery.py --manifest qa/loaders-shots/manifest.json -o qa/qa-YYYY-MM-DD-loaders.html
```

Traps (2026-09-07): delaying the RSC *request* in puppeteer does not show the skeleton — React keeps the old page until the payload's head arrives, so the wait has to be inside the page's data access. The Next dev-tools bubble sits over the Home tab in headless Chrome; click tab links with a JS `.click()`, not coordinates.

## Session focus mode (v1.2) at iPhone 15 size

`qa/focus-qa.mjs` drives the focus-mode session (one exercise on screen), the lineup sheet, postpone + undo, the rest ping (custom 15 s rest set in Settings), the check-in sheet and the Home/Program pages — emulating an iPhone 15 (393×852, touch) with its standalone safe areas simulated by overriding `--safe-top` / `--safe-bottom` (59 / 34 px, drawn as hatched zones in the shots). Real-phone finding (2026-09-08): plain 390 px headless shots report zero insets and hid every safe-area collision.

```bash
pnpm db:reset && pnpm dev
cp qa/focus-qa.mjs /tmp/ll-pp/ && node /tmp/ll-pp/focus-qa.mjs qa/focus-shots liftloop-dev
python3 ~/.claude/scripts/qa-gallery.py --manifest qa/focus-shots/manifest.json -o qa/qa-YYYY-MM-DD-session-focus.html
```

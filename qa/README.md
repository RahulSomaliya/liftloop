# QA

Headless-Chrome QA for handovers. `qa/shots/` and the gallery HTML are gitignored (they contain screenshots of personal data).

```bash
# once, outside the repo (puppeteer-core is not a project dependency)
mkdir -p /tmp/ll-pp && cd /tmp/ll-pp && npm i puppeteer-core
# from the repo, with `pnpm dev` running on :3000 against a fresh `pnpm db:reset`
cp qa/shots.mjs /tmp/ll-pp/ && node /tmp/ll-pp/shots.mjs qa/shots liftloop-dev
python3 ~/.claude/scripts/qa-gallery.py --manifest qa/shots/manifest.json -o qa/qa-YYYY-MM-DD-phase1.html
```

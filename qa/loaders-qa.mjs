// Headless-Chrome QA for the route loading skeletons, error/404 screens.
// Skeletons are transient, so RSC navigation responses are delayed via request interception:
// click a tab → the loading.tsx fallback is on screen for the delay → screenshot it.
// Run: node loaders-qa.mjs <outDir> <passcode>   (dev server on :3000)
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.QA_BASE ?? 'http://localhost:3000'
const OUT = process.argv[2]
const PASS = process.argv[3] ?? 'liftloop-dev'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
mkdirSync(OUT, { recursive: true })

const groups = []
let current = null
const group = (name) => groups.push((current = { name, shots: [] }))
let consoleErrors = []
let expect404 = false
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
page.on('console', (m) => m.type() === 'error' && !(expect404 && /404/.test(m.text())) && consoleErrors.push(m.text()))
page.on('response', (r) => r.status() >= 400 && !(expect404 && r.status() === 404) && consoleErrors.push(`${r.status()} ${new URL(r.url()).pathname}`))
page.on('pageerror', (e) => consoleErrors.push(String(e)))

// The dev server must run with LIFTLOOP_QA_SLOW_MS=2500 (see src/db/client.ts): delaying the RSC
// request itself keeps the OLD page on screen (React transition) — the fallback only shows once the
// payload's head has arrived and the page's own data is still pending.

async function setSize(w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
}

async function shot(name, caption, { w = 390, h = 844, note = '', checks = [] } = {}) {
  await setSize(w, h)
  await sleep(120)
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  const file = join(OUT, `${name}.png`)
  await page.screenshot({ path: file, captureBeyondViewport: false })
  const errs = consoleErrors.splice(0)
  const failedChecks = []
  for (const [label, fn] of checks) {
    const ok = await page.evaluate(fn)
    if (!ok) failedChecks.push(label)
  }
  const check = errs.length || overflowX || failedChecks.length ? 'fail' : 'pass'
  const notes = [note, overflowX ? 'horizontal overflow!' : '', ...failedChecks.map((c) => `check failed: ${c}`), ...errs.map((e) => `console: ${e.slice(0, 160)}`)].filter(Boolean).join(' · ')
  current.shots.push({ file, caption: `${caption} (${w}px)`, check, note: notes })
  console.log(`${check === 'pass' ? '✓' : '✗'} ${name} ${notes}`)
}

const hasSkeleton = ['skeleton visible (aria-busy main + pulse blocks)', () => !!document.querySelector('[aria-busy="true"]') && document.querySelectorAll('[aria-busy="true"] .animate-pulse').length >= 3]
const noSkeleton = ['skeleton gone after load', () => !document.querySelector('[aria-busy="true"]')]

// JS click, not a coordinate click: the Next dev-tools bubble sits over the Home tab in headless
// Chrome and a coordinate click opened its menu instead of navigating.
async function clickTab(label) {
  await page.evaluate((t) => [...document.querySelectorAll('nav a')].find((a) => a.textContent.trim() === t).click(), label)
}

// Hide the dev-tools bubble in screenshots (it is dev-only chrome, not the app).
await page.evaluateOnNewDocument(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style')
    s.textContent = 'nextjs-portal{display:none!important}'
    document.head.appendChild(s)
  })
})

async function navSkeleton(name, caption, go, { w = 390, h = 844 } = {}) {
  await go()
  await page.waitForSelector('[aria-busy="true"]', { timeout: 10000 }).catch(() => {})
  await sleep(300)
  await shot(name, caption, { w, h, checks: [hasSkeleton] })
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), { timeout: 15000 })
  await shot(`${name}-loaded`, `${caption.split(':')[0]}: content in place after the skeleton (same layout)`, { w, h, checks: [noSkeleton] })
}

// ---------- Sign in ----------
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
await page.type('#passcode', PASS)
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type=submit]')])

// ---------- Tab skeletons ----------
group('Tab navigation skeletons (RSC payload delayed 2.5 s)')
await navSkeleton('01-history-skel', 'History: title, list rows appear instantly on tap', () => clickTab('History'))
await navSkeleton('02-body-skel', 'Body: entry card, sparkline, 7 rows', () => clickTab('Body'))
await navSkeleton('03-more-progress-skel', 'Progress (from More): heatmap, chart, exercise list', async () => {
  await clickTab('More')
  await page.waitForSelector('a[href="/progress"]', { visible: true })
  await page.click('a[href="/progress"]')
})
await navSkeleton('04-home-skel', 'Home: wordmark stays, hero card + dots + phase cards', () => clickTab('Home'))
await page.goto(`${BASE}/history`, { waitUntil: 'networkidle0' })
await navSkeleton('05-home-skel-desktop', 'Home skeleton on desktop width', () => clickTab('Home'), { w: 1440, h: 900 })

// ---------- Session + detail skeletons ----------
group('Session, detail and sub-page skeletons')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.startsWith('Start ')), { timeout: 20000 })
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Start ')).click())
await sleep(600)
await shot('06a-start-pending', 'Start button: "Starting…" + disabled while the action runs', { checks: [['button reads Starting…', () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Starting…' && b.disabled)]] })
await page.waitForFunction(() => location.pathname.startsWith('/session/'), { timeout: 15000 })
await page.waitForSelector('[aria-busy="true"]', { timeout: 10000 }).catch(() => {})
await sleep(300)
await shot('06-session-skel', 'Session: sticky header (back, title, timer pill) + collapsed cards while the session loads', { checks: [hasSkeleton] })
await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), { timeout: 15000 })
await shot('06-session-skel-loaded', 'Session: real screen in place', { checks: [noSkeleton] })

await page.goto(`${BASE}/more`, { waitUntil: 'networkidle0' })
await navSkeleton('07-export-skel', 'Coach export (More sub-page): back header + two cards', async () => {
  await page.click('a[href="/more/export"]')
})
await page.goto(`${BASE}/progress`, { waitUntil: 'networkidle0' })
await navSkeleton('08-exercise-skel', 'Exercise detail: back header, chart block, settings card', async () => {
  await page.click('a[href^="/exercise/"]')
})
// A finished session is needed for /history/[id] (the live one redirects to /session): log a walk.
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await page.waitForSelector('button[aria-label="More actions"]', { visible: true })
await page.evaluate(() => document.querySelector('button[aria-label="More actions"]').click())
await page.waitForSelector('button::-p-text(Log a walk day)', { visible: true })
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Log a walk day').click())
await page.waitForSelector('button::-p-text(Save walk)', { visible: true })
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Save walk').click())
await page.waitForFunction(() => ![...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Save walk'), { timeout: 20000 })
await page.goto(`${BASE}/history`, { waitUntil: 'networkidle0' })
await page.waitForSelector('a[href^="/history/"]', { visible: true })
await navSkeleton('09-history-detail-skel', 'Session detail (finished walk): back header, chips, shorthand block, set rows', async () => {
  await page.evaluate(() => document.querySelector('a[href^="/history/"]').click())
})

// ---------- Not found ----------
group('Not found')
expect404 = true
await page.goto(`${BASE}/history/00000000-0000-4000-8000-000000000000`, { waitUntil: 'networkidle0' })
await shot('10-not-found-session', 'Unknown session id → in-app 404 with tab bar (expected 404 response)', { checks: [['heading says Not found', () => document.querySelector('h1')?.textContent === 'Not found'], ['tab bar present', () => !!document.querySelector('nav[aria-label="Main"]')]] })
await page.goto(`${BASE}/no-such-page`, { waitUntil: 'networkidle0' })
await shot('11-not-found-root', 'Unknown URL → root 404 (expected 404 response)', { checks: [['heading says Not found', () => document.querySelector('h1')?.textContent === 'Not found']] })
expect404 = false

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ title: 'LiftLoop · route loaders, error & 404 screens', groups }, null, 2))
await browser.close()
const failed = groups.flatMap((g) => g.shots).filter((s) => s.check === 'fail')
console.log(`\n${groups.flatMap((g) => g.shots).length} shots, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)

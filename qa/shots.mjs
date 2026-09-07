// Headless-Chrome QA for Phase 1 (spec §10.1 "browser verification"). Drives the real app on
// http://localhost:3000 with puppeteer-core + system Chrome, asserts console errors and page
// overflow, and writes screenshots + a manifest for ~/.claude/scripts/qa-gallery.py.
// Run: node qa/shots.mjs <outDir> <passcode>   (needs puppeteer-core resolvable — see qa/README)
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
let expect401 = false
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`${BASE}/login`)
      if (r.ok) return
    } catch {}
    await sleep(1000)
  }
  throw new Error('dev server not reachable')
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
page.on('console', (m) => m.type() === 'error' && !(expect401 && /401/.test(m.text())) && consoleErrors.push(m.text()))
page.on('response', (r) => r.status() >= 400 && !(expect401 && r.status() === 401) && consoleErrors.push(`${r.status()} ${new URL(r.url()).pathname}`))
page.on('pageerror', (e) => consoleErrors.push(String(e)))

async function setSize(w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 })
}

async function shot(name, caption, { w = 390, h = 844, note = '' } = {}) {
  await setSize(w, h)
  await sleep(250)
  const docH = await page.evaluate(() => document.documentElement.scrollHeight)
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  await setSize(w, Math.max(h, Math.min(docH, 4000)))
  await sleep(150)
  const file = join(OUT, `${name}.png`)
  await page.screenshot({ path: file, captureBeyondViewport: false })
  const errs = consoleErrors.splice(0)
  const check = errs.length || overflowX ? 'fail' : 'pass'
  const notes = [note, overflowX ? 'horizontal overflow!' : '', ...errs.map((e) => `console: ${e.slice(0, 160)}`)].filter(Boolean).join(' · ')
  current.shots.push({ file, caption: `${caption} (${w}px)`, check, note: notes })
  await setSize(w, h)
  console.log(`${check === 'pass' ? '✓' : '✗'} ${name} ${notes}`)
}

async function click(selector) {
  await page.waitForSelector(selector, { visible: true, timeout: 10000 })
  await page.click(selector)
}

async function clickText(text, tag = 'button') {
  const handle = await page.evaluateHandle((t, tg) => [...document.querySelectorAll(tg)].find((b) => b.textContent.trim() === t), text, tag)
  const el = handle.asElement()
  if (!el) throw new Error(`no ${tag} with text "${text}"`)
  await el.click()
}

await waitForServer()

// ---------- Sign in ----------
group('Sign in')
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
await shot('01-login', 'Sign-in screen, empty')
expect401 = true
await page.type('#passcode', 'wrong-pass')
await page.click('button[type=submit]')
await page.waitForSelector('[role=alert]', { visible: true })
await shot('02-login-error', 'Wrong passcode → inline error (expected 401), still on /login')
expect401 = false
await page.evaluate(() => (document.querySelector('#passcode').value = ''))
await page.type('#passcode', PASS)
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type=submit]')])
if (!page.url().endsWith('/')) throw new Error(`expected Home after sign-in, got ${page.url()}`)

// ---------- Home ----------
group('Home')
await shot('03-home', 'Home in Ramp week 1: Next up Push A, 0/4 dots, phase card, quick entry')
await shot('04-home-desktop', 'Home on desktop width', { w: 1440, h: 900 })
await page.type('input[aria-label="Body weight in kilograms"]', '73.6')
await page.keyboard.press('Enter')
await sleep(800)
await clickText('Good')
await sleep(800)
await shot('05-home-quick-entry', 'Weight 73.6 saved (toast) and sleep Good selected')

// ---------- Session ----------
group('Session logging')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), clickText('Start Push A')])
if (!page.url().includes('/session/')) throw new Error(`expected session page, got ${page.url()}`)
await shot('06-session-open', 'First card open: first_time goal, 2 sets (Ramp), empty weight chip')

async function logOpenSet(weight) {
  const btn = await page.$('button[aria-label^="Log set"]')
  if (!btn) return false
  await btn.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await sleep(100)
  await btn.click()
  await sleep(300)
  const keypad = await page.$('input[aria-label$="— weight"]')
  if (keypad) {
    await keypad.click({ clickCount: 3 })
    await keypad.type(String(weight))
    await clickText('Done')
    await sleep(300)
    const again = await page.$('button[aria-label^="Log set"]')
    if (again) {
      await again.evaluate((el) => el.scrollIntoView({ block: 'center' }))
      await sleep(100)
      await again.click()
    }
  }
  await sleep(400)
  return true
}

await logOpenSet(25)
await shot('07-session-set-logged', 'Set 1 logged: compact row, rest timer running (120 s), undo toast')
// reps stepper on set 2
const repsChip = (await page.$$('button.tabular-nums.w-\\[72px\\]'))[0]
if (repsChip) {
  await repsChip.click()
  await sleep(200)
  await shot('08-session-stepper', 'Reps chip tapped → inline −/+ stepper')
  await click('button[aria-label="increase"]')
  await sleep(150)
}
await logOpenSet(25)
await sleep(500)
await shot('09-session-collapsed', 'Card collapsed with verdict line; next card auto-opened')

let guard = 0
while (guard < 40) {
  guard += 1
  const finish = await page.$('button::-p-text(Finish session)')
  if (finish) break
  const ok = await logOpenSet(20)
  if (!ok) break
}
await shot('10-session-all-done', 'Every card collapsed; Finish session button visible')
await shot('11-session-desktop', 'Session on desktop width', { w: 1440, h: 900 })
await clickText('Finish session')
await page.waitForSelector('button::-p-text(Save & finish)', { visible: true })
await clickText('Good')
await click('button[aria-label="Left shoulder more"]')
await sleep(200)
await shot('12-checkin', 'Check-in sheet: sleep prefilled Good, shoulder 1, elbow 0')
await page.waitForFunction(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save & finish')
  return b && !b.disabled
})
await clickText('Save & finish')
await page.waitForSelector('h1::-p-text(done)', { visible: true, timeout: 15000 })
await shot('13-summary', 'Summary: sets, verdict lines, shorthand, Next up Pull A')

// ---------- Home after ----------
group('After the session')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await shot('14-home-after', 'Home: Next up Pull A, 1/4 dots, sleep Good kept')

// ---------- History ----------
group('History')
await page.goto(`${BASE}/history`, { waitUntil: 'networkidle0' })
await shot('15-history', 'History list: one Push A session with sets count')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('a[href^="/history/"]')])
await shot('16-history-detail', 'Session detail: chips, shorthand block, set table')
await shot('17-history-detail-desktop', 'Session detail on desktop', { w: 1440, h: 900 })

// ---------- More / Export ----------
group('Coach export')
await page.goto(`${BASE}/more`, { waitUntil: 'networkidle0' })
await shot('18-more', 'More menu (Phase 2 items greyed)')
await page.goto(`${BASE}/more/export`, { waitUntil: 'networkidle0' })
await shot('19-export', 'Coach export: presets, range, markdown preview, Copy')
await shot('20-export-desktop', 'Coach export on desktop', { w: 1440, h: 900 })
const reportText = await page.$eval('pre', (el) => el.textContent)
const reportOk = reportText.startsWith('# LiftLoop report') && reportText.includes('## Sessions') && reportText.includes('Machine Chest Press 8-12 x 2')
current.shots[current.shots.length - 1].note += reportOk ? ' · report text verified' : ' · REPORT TEXT WRONG'
if (!reportOk) current.shots[current.shots.length - 1].check = 'fail'

// ---------- Auth guard ----------
group('Auth guard')
const client = await page.createCDPSession()
await client.send('Network.clearBrowserCookies')
await page.goto(`${BASE}/history`, { waitUntil: 'networkidle0' })
const redirected = page.url().includes('/login')
await shot('21-signed-out', redirected ? 'Cookie cleared → /history redirects to /login' : 'AUTH GUARD FAILED', { note: redirected ? '' : 'expected redirect to /login' })
if (!redirected) current.shots[current.shots.length - 1].check = 'fail'

await browser.close()

const manifest = {
  title: 'LiftLoop Phase 1 QA',
  subtitle: 'Headless Chrome against next dev + seeded PGlite. Dark theme, 390 and 1440 px. Every shot checks console errors and horizontal overflow.',
  meta: { Base: BASE, Date: new Date().toISOString().slice(0, 10) },
  groups,
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
const fails = groups.flatMap((g) => g.shots).filter((s) => s.check === 'fail')
console.log(`\n${groups.flatMap((g) => g.shots).length} shots, ${fails.length} failing`)
process.exit(fails.length ? 1 : 0)

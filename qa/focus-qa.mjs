// Headless-Chrome QA for the v1.2 session focus mode (spec §6.3 v1.2): one exercise on screen,
// lineup strip + sheet, postpone (+ undo), rest ping, Settings → Rest timer, iPhone safe areas.
// Emulates an iPhone 15 (393×852, touch) and simulates its standalone safe areas by overriding the
// --safe-top / --safe-bottom variables (59 / 34 px) — env() cannot be faked in headless Chrome.
// Run: node qa/focus-qa.mjs <outDir> <passcode>   (dev server on :3000 after `pnpm db:reset`)
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('response', (r) => r.status() >= 400 && consoleErrors.push(`${r.status()} ${new URL(r.url()).pathname}`))
page.on('pageerror', (e) => consoleErrors.push(String(e)))
// iPhone 15 standalone: simulate the safe areas + draw the Dynamic Island / home indicator zones so a
// collision is visible in the shot. Also hide the Next dev-tools bubble.
await page.evaluateOnNewDocument(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style')
    s.textContent = `:root{--safe-top:59px;--safe-bottom:34px} nextjs-portal{display:none!important}
      body::before{content:"";position:fixed;left:0;right:0;top:0;height:59px;background:repeating-linear-gradient(135deg,rgba(255,0,80,.18) 0 6px,transparent 6px 12px);pointer-events:none;z-index:9999}
      body::after{content:"";position:fixed;left:0;right:0;bottom:0;height:34px;background:repeating-linear-gradient(135deg,rgba(255,0,80,.18) 0 6px,transparent 6px 12px);pointer-events:none;z-index:9999}`
    document.head.appendChild(s)
  })
})

async function setSize(w, h) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
}
await setSize(393, 852)

async function shot(name, caption, { w = 393, h = 852, note = '', checks = [] } = {}) {
  await setSize(w, h)
  await sleep(150)
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  const file = join(OUT, `${name}.png`)
  await page.screenshot({ path: file, captureBeyondViewport: false })
  const errs = consoleErrors.splice(0)
  const failed = []
  for (const [label, fn] of checks) if (!(await page.evaluate(fn))) failed.push(label)
  const check = errs.length || overflowX || failed.length ? 'fail' : 'pass'
  const notes = [note, overflowX ? 'horizontal overflow!' : '', ...failed.map((c) => `check failed: ${c}`), ...errs.map((e) => `console: ${e.slice(0, 160)}`)].filter(Boolean).join(' · ')
  current.shots.push({ file, caption: `${caption} (${w}px)`, check, note: notes })
  console.log(`${check === 'pass' ? '✓' : '✗'} ${name} ${notes}`)
}

const byText = (tag, text) => `[...document.querySelectorAll('${tag}')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`
async function clickText(text, tag = 'button') {
  await page.waitForFunction(`!!${byText(tag, text)}`, { timeout: 10000 })
  await page.evaluate(`${byText(tag, text)}.click()`)
}
const has = (tag, text) => [`"${text}" visible`, `() => !!${byText(tag, text)}`]
const headerClearsIsland = ['sticky header content starts below the 59 px inset', () => {
  const t = document.querySelector('header span, header h1')
  return !!t && t.getBoundingClientRect().top >= 59
}]

// ---------- Sign in + settings ----------
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' })
await page.type('#passcode', PASS)
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type=submit]')])

group('Settings · rest timer (iPhone 15 safe areas simulated)')
await page.goto(`${BASE}/more/settings`, { waitUntil: 'networkidle0' })
await shot('01-settings-rest', 'Rest timer card: Program selected, ping on; header clears the Dynamic Island zone', { checks: [headerClearsIsland, has('button', 'Program')] })
await page.click('input[aria-label="Custom rest in seconds"]')
await page.type('input[aria-label="Custom rest in seconds"]', '15')
await page.keyboard.press('Enter')
await page.waitForFunction(() => [...document.querySelectorAll('[role=status], [data-sonner-toast]')].some((t) => /Rest: 15 s/.test(t.textContent)), { timeout: 10000 })
await shot('02-settings-custom', 'Custom rest 15 s (the minimum) saved (toast), chip highlighted', { checks: [['custom chip pressed', () => document.querySelector('input[aria-label="Custom rest in seconds"]')?.value === '15']] })

// ---------- Session focus ----------
group('Session focus mode')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.startsWith('Start ')), { timeout: 20000 })
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('Start ')).click())
await page.waitForFunction(() => location.pathname.startsWith('/session/') && !!document.querySelector('button[aria-label^="Log set"]'), { timeout: 20000 })
await sleep(300)
await shot('03-focus-first', 'Only the first exercise on screen: strip 1 of 6, warm-up row, card with ONE set row, "Up next", "Wrap up early"', {
  checks: [headerClearsIsland, ['exactly one exercise card', () => document.querySelectorAll('main section[aria-label]').length === 1], has('button', 'Lineup, exercise 1 of 6'.replace('Lineup, exercise 1 of 6', '1 of 6 Lineup')), ['postpone action present', () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'postpone')]],
})

async function logSet(weight) {
  const btn = await page.$('button[aria-label^="Log set"]')
  if (!btn) return false
  await btn.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await btn.evaluate((el) => el.click())
  await sleep(300)
  // v1.3: ✓ with no weight opens the in-app keypad; confirming logs the set in the same go.
  if (await page.$('[data-keypad-display]')) {
    for (const ch of String(weight)) await page.evaluate((c) => document.querySelector(`button[aria-label="digit ${c}"]`).click(), ch)
    await page.evaluate(() => document.querySelector('button[aria-label="Confirm value"]').click())
    await sleep(500)
  }
  await sleep(400)
  return true
}

await logSet(25)
await shot('04-rest-running', 'Set 1 logged → rest pill counts down (15 s), amber line under the header fills', {
  checks: [['pill running', () => /Rest \d+:\d\d/.test(document.querySelector('header button[aria-label^="Rest"]')?.getAttribute('aria-label') ?? '')]],
})
// v1.3: tapping a chip opens the in-app keypad (no iOS keyboard); only the current set is an input row
await page.evaluate(() => document.querySelector('button[aria-label^="Weight for set"]').click())
await page.waitForSelector('[data-keypad-display]', { visible: true })
await sleep(400)
await shot('05-keypad', 'Weight chip → in-app keypad: big display, ± by the stepping rule, digits, one Set button, exercise-settings link', {
  checks: [['keypad visible', () => !!document.querySelector('[data-keypad-display]')], ['no native input focused', () => !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '')]],
})
await page.keyboard.press('Escape')
await page.waitForFunction(() => !document.querySelector('[data-keypad-display]'))
await sleep(200)
await shot('05b-one-set-row', 'Only the current set is an input row; set 1 sits above as a logged row', {
  checks: [['one input row', () => document.querySelectorAll('main button[aria-label^="Log set"]').length === 1], ['logged row present', () => [...document.querySelectorAll('main button')].some((b) => /Set 1/.test(b.textContent) && /edit|logged/.test(b.textContent))]],
})
await page.waitForFunction(() => document.querySelector('header button[aria-label="Rest over, go"]'), { timeout: 25000 })
await sleep(200)
await shot('06-rest-over', 'Rest over: pill turns green "go" and pulses, line under the header is full green (beep + buzz fired)', {
  checks: [['green go pill', () => !!document.querySelector('header button[aria-label="Rest over, go"]')]],
})

// ---------- Lineup + postpone ----------
group('Lineup sheet and postpone')
await clickText('1 of 6 Lineup')
await page.waitForSelector('[role=dialog]', { visible: true })
await sleep(500)
await shot('07-lineup', 'Lineup sheet: current ● now with "1 of 2 sets", upcoming with goal lines, superset "+", short-session link; sheet clears the home indicator', {
  checks: [['6 rows', () => document.querySelectorAll('[role=dialog] button[aria-current], [role=dialog] .rounded-2xl > button').length >= 6], ['sheet padding clears 34 px', () => {
    const d = document.querySelector('[role=dialog]')
    const last = [...d.querySelectorAll('button')].at(-1)
    return d.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom >= 34
  }]],
})
await page.keyboard.press('Escape')
await sleep(400)
// finish exercise 1 (2 sets in Ramp), then postpone exercise 2
await logSet(25)
await page.waitForFunction(() => document.querySelectorAll('main section[aria-label]').length === 1 && [...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith('2 of 6')), { timeout: 10000 })
await sleep(300)
const secondName = await page.evaluate(() => document.querySelector('main section[aria-label]')?.getAttribute('aria-label'))
await clickText('postpone')
await page.waitForFunction((n) => document.querySelector('main section[aria-label]')?.getAttribute('aria-label') !== n, { timeout: 10000 }, secondName)
await sleep(400)
await shot('08-postponed', `Postponed "${secondName}": the next exercise is current, "Up next" shows it with a postponed tag, undo toast`, {
  checks: [['up next carries postponed tag', () => [...document.querySelectorAll('button')].some((b) => /Up next/.test(b.textContent) && /postponed/.test(b.textContent))], ['still 2 of 6', () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim().startsWith('2 of 6'))]],
})
// Undo within the toast's 5 s, then postpone again for the lineup shot.
await clickText('Undo')
await page.waitForFunction((n) => document.querySelector('main section[aria-label]')?.getAttribute('aria-label') === n, { timeout: 10000 }, secondName)
await sleep(300)
await shot('09-undo', `Undo: "${secondName}" is current again, tag gone`, {
  checks: [['no postponed tag', () => ![...document.querySelectorAll('button')].some((b) => /postponed/.test(b.textContent))]],
})
await clickText('postpone')
await page.waitForFunction((n) => document.querySelector('main section[aria-label]')?.getAttribute('aria-label') !== n, { timeout: 10000 }, secondName)
await sleep(600)
await clickText('2 of 6 Lineup')
await page.waitForSelector('[role=dialog]', { visible: true })
await sleep(500)
await shot('10-lineup-after-postpone', 'Lineup after postpone: ✓ done, ● now, then the postponed one (tagged) one place behind', {
  checks: [['postponed tag in sheet', () => /postponed/.test(document.querySelector('[role=dialog]')?.textContent ?? '')]],
})
await page.keyboard.press('Escape')
await sleep(300)

// ---------- All done ----------
group('All done + finish')
let guard = 0
while (guard < 40) {
  guard += 1
  const finish = (await page.evaluateHandle(() => [...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === "I'm done") ?? null)).asElement()
  if (finish) break
  const ok = await logSet(20)
  if (!ok) break
}
await page.evaluate(() => window.scrollTo(0, 0))
await sleep(300)
await shot('11-all-done', 'Every exercise done: strip 6 of 6, recap list with verdict lines, one "I\'m done" button', {
  checks: [has('button', "I'm done"), ['6 recap rows', () => document.querySelectorAll('main .rounded-2xl > div').length >= 6]],
})
await shot('12-all-done-desktop', 'Same on desktop width', { w: 1440, h: 900 })
await setSize(393, 852)
await clickText("I'm done")
await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog] button')].some((b) => b.textContent.trim() === "I'm done"), { timeout: 10000 })
await sleep(500)
await shot('13-checkin', '"Nice work." check-in: sleep, shoulder, elbow, note, one "I\'m done" button; clears the home indicator', {
  checks: [['sheet padding clears 34 px', () => {
    const d = document.querySelector('[role=dialog]')
    const last = [...d.querySelectorAll('button')].at(-1)
    return d.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom >= 34
  }]],
})
await page.waitForFunction(() => {
  const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === "I'm done")
  return b && !b.disabled
})
await page.evaluate(() => [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === "I'm done").click())
await page.waitForSelector('h1::-p-text(done)', { visible: true, timeout: 15000 })
await shot('14-summary', 'Summary after finish')

// ---------- Other screens under the safe areas ----------
group('Other screens with iPhone safe areas')
await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
await shot('15-home-safe', 'Home: wordmark row starts below the island zone; tab bar clears the home indicator', {
  checks: [headerClearsIsland, ['tab bar padding ≥ 34', () => {
    const nav = document.querySelector('nav[aria-label="Main"]')
    return parseFloat(getComputedStyle(nav).paddingBottom) >= 34
  }]],
})
await page.goto(`${BASE}/more/program`, { waitUntil: 'networkidle0' })
await shot('16-program-no-suffix', 'Program list: reps ranges without /arm /leg suffixes', {
  checks: [['no /arm or /leg text', () => !/\/(arm|leg)\b/.test(document.querySelector('main')?.textContent ?? '')]],
})

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ title: 'LiftLoop · session focus, postpone, rest ping (iPhone 15)', groups }, null, 2))
await browser.close()
const failed = groups.flatMap((g) => g.shots).filter((s) => s.check === 'fail')
console.log(`\n${groups.flatMap((g) => g.shots).length} shots, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)

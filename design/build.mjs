// Generates the LiftLoop design artboards (*.dc.html) + canvas.json.
// Run: node design/build.mjs   (from the repo root)
// Design tokens mirror src/app/globals.css (shadcn neutral dark) + one amber accent.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const T = {
  bg: '#0a0a0a', s1: '#171717', s2: '#262626', s3: '#333333',
  border: 'rgba(255,255,255,0.10)', text: '#fafafa', text2: '#a3a3a3', text3: '#737373',
  accent: '#f2b134', accentFg: '#1a1200', accentSoft: 'rgba(242,177,52,0.14)',
  ok: '#5fd38a', okSoft: 'rgba(95,211,138,0.14)', bad: '#ff6b6b',
  push: '#f2b134', pull: '#6fb1ff', legs: '#b58cff', walk: '#8b8b8b',
}

const helmet = `<helmet>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&amp;family=Geist+Mono:wght@500;600&amp;display=swap" rel="stylesheet">
  <style>
    body { margin: 0; background: ${T.bg}; color: ${T.text}; font-family: Geist, system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 15px; line-height: 1.4; -webkit-font-smoothing: antialiased; }
    a { color: ${T.accent}; text-decoration: none; } a:hover { color: #ffd070; }
    .mono { font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
    .num { font-variant-numeric: tabular-nums; }
    svg { display: block; }
  </style>
</helmet>`

const icon = {
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  history: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  body: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M12 12v5"/></svg>',
  more: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg>',
  check: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  down: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  timer: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>',
  copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  dots: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5h.01M12 12h.01M12 19h.01"/></svg>',
  minus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 12h12"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>',
  up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  eq: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 9h12M6 15h12"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
}

function page(body, { tab = null, height = 844 } = {}) {
  const tabs = tab === null ? '' : `
  <nav style="position: absolute; left: 0; right: 0; bottom: 0; height: 84px; padding: 8px 8px 24px; box-sizing: border-box; background: ${T.s1}; border-top: 1px solid ${T.border}; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px;">
    ${['Home', 'History', 'Body', 'More'].map((n) => {
      const on = n === tab
      return `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; height: 52px; border-radius: 10px; color: ${on ? T.text : T.text3};">${icon[n.toLowerCase()]}<span style="font-size: 11px; font-weight: ${on ? 600 : 500};">${n}</span></div>`
    }).join('\n    ')}
  </nav>`
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
${helmet}
<div style="position: relative; width: 390px; height: ${height}px; overflow: hidden; background: ${T.bg}; box-sizing: border-box;">
${body}${tabs}
</div>
</x-dc>
</body>
</html>
`
}

// ---------- shared pieces ----------
const topbar = (left, right = '') => `
  <header style="display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 20px; box-sizing: border-box;">
    <div style="display: flex; align-items: center; gap: 8px;">${left}</div>
    <div style="display: flex; align-items: center; gap: 8px; color: ${T.text2};">${right}</div>
  </header>`
const wordmark = `<span style="font-weight: 700; font-size: 17px; letter-spacing: -0.02em;">Lift<span style="color: ${T.accent};">Loop</span></span>`
const btnPrimary = (label, extra = '') => `<button style="width: 100%; height: 56px; border: 0; border-radius: 14px; background: ${T.accent}; color: ${T.accentFg}; font: inherit; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; ${extra}">${label}</button>`
const btnSecondary = (label, extra = '') => `<button style="width: 100%; height: 52px; border: 1px solid ${T.border}; border-radius: 14px; background: ${T.s2}; color: ${T.text}; font: inherit; font-size: 16px; font-weight: 600; ${extra}">${label}</button>`
const chip = (txt, w = 96) => `<div class="num" style="display: flex; align-items: center; justify-content: center; width: ${w}px; height: 48px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; font-size: 20px; font-weight: 600; letter-spacing: -0.01em;">${txt}</div>`
const checkBtn = `<div style="display: flex; align-items: center; justify-content: center; width: 56px; height: 48px; border-radius: 12px; background: ${T.accent}; color: ${T.accentFg};">${icon.check}</div>`
const setRow = (n, w, r, ghostW = '', ghostR = '') => `
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 44px; color: ${T.text3}; font-size: 13px; font-weight: 500;">Set ${n}</div>
          ${chip(w, 108)}${chip(r, 72)}
          <div style="flex-grow: 1;"></div>
          ${checkBtn}
        </div>
        ${ghostW ? `<div style="display: flex; gap: 10px; padding-left: 54px; color: ${T.text3}; font-size: 12px;"><span style="width: 108px; text-align: center;">last ${ghostW}</span><span style="width: 72px; text-align: center;">last ${ghostR}</span></div>` : ''}
      </div>`
const loggedRow = (n, txt, mark) => `
      <div style="display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 12px; border-radius: 12px; background: ${T.bg};">
        <div style="width: 44px; color: ${T.text3}; font-size: 13px; font-weight: 500;">Set ${n}</div>
        <div class="num" style="font-size: 17px; font-weight: 600;">${txt}</div>
        <div style="display: flex; align-items: center; gap: 4px; color: ${mark === 'up' ? T.ok : T.text2};">${mark === 'up' ? icon.up : icon.eq}</div>
        <div style="flex-grow: 1;"></div>
        <div style="color: ${T.text3}; font-size: 13px;">edit</div>
      </div>`
const collapsedCard = (name, line, opts = {}) => `
    <div style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 14px; background: ${T.s1}; border: 1px solid ${T.border}; ${opts.style || ''}">
      <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex-grow: 1;">
        <div style="font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
        <div class="num" style="font-size: 13px; color: ${opts.done ? T.text2 : T.text3}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${line}</div>
      </div>
      <div style="color: ${opts.done ? T.ok : T.text3};">${opts.done ? icon.check : icon.down}</div>
    </div>`
const thenConnector = `<div style="display: flex; align-items: center; gap: 8px; padding: 0 16px; margin: -4px 0; color: ${T.text3}; font-size: 12px; font-weight: 500;"><div style="width: 1px; height: 14px; background: ${T.border}; margin-left: 8px;"></div>then</div>`

// ---------- Login ----------
const Login = page(`
  <div style="display: flex; flex-direction: column; justify-content: center; gap: 40px; height: 844px; padding: 0 28px 80px; box-sizing: border-box;">
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="font-size: 34px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.05;">Lift<span style="color: ${T.accent};">Loop</span></div>
      <div style="color: ${T.text2}; font-size: 15px;">Personal workout logger. One goal per exercise, one tap per set.</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <label style="font-size: 13px; font-weight: 600; color: ${T.text2}; letter-spacing: 0.02em;">PASSCODE</label>
      <div class="num" style="display: flex; align-items: center; height: 56px; padding: 0 18px; border-radius: 14px; background: ${T.s1}; border: 1px solid ${T.border}; font-size: 22px; letter-spacing: 0.3em; color: ${T.text};">••••••••</div>
      ${btnPrimary('Sign in')}
    </div>
    <div style="color: ${T.text3}; font-size: 13px; text-align: center;">Single user · private data · public code</div>
  </div>`)

// ---------- Home ----------
const weekDots = (done, total, walks) => `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="display: flex; gap: 8px;">${Array.from({ length: total }, (_, i) => `<div style="width: 14px; height: 14px; border-radius: 999px; background: ${i < done ? T.accent : T.s3};"></div>`).join('')}</div>
        <div class="num" style="font-size: 13px; color: ${T.text2};">${done}/${total} this week${walks ? ` · +${walks} walk` : ''}</div>
      </div>`
const Home = page(`
  ${topbar(wordmark, `<span style="font-size: 13px;">Mon 7 Sep</span>${icon.dots}`)}
  <div style="display: flex; flex-direction: column; gap: 20px; padding: 8px 20px 0; box-sizing: border-box;">
    <section style="display: flex; flex-direction: column; gap: 14px; padding: 22px 20px 20px; border-radius: 18px; background: ${T.s1}; border: 1px solid ${T.border};">
      <div style="font-size: 13px; font-weight: 600; color: ${T.text2}; letter-spacing: 0.02em;">NEXT UP</div>
      <div style="font-size: 40px; font-weight: 700; letter-spacing: -0.03em; line-height: 1;">Legs A</div>
      <div style="color: ${T.text2}; font-size: 14px;">Leg Press · Lying Leg Curl · Single-Leg Leg Press · Leg Extension · Seated Calf Raise</div>
      ${btnPrimary('Start Legs A')}
    </section>
    ${weekDots(2, 4, 1)}
    <section style="display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border-radius: 16px; background: ${T.s1}; border: 1px solid ${T.border};">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="font-size: 16px; font-weight: 600;">Ramp · week 1 of 2</div>
        <div style="font-size: 12px; font-weight: 600; color: ${T.accent}; background: ${T.accentSoft}; padding: 4px 10px; border-radius: 999px;">4 days/week</div>
      </div>
      <div style="color: ${T.text2}; font-size: 14px;">2 sets on every exercise · stop with 4 reps left</div>
      <div style="color: ${T.text3}; font-size: 13px;">Easy week 19–25 Oct</div>
    </section>
    <section style="display: flex; flex-direction: column; gap: 12px; padding: 16px 18px; border-radius: 16px; background: ${T.s1}; border: 1px solid ${T.border};">
      <div style="font-size: 13px; font-weight: 600; color: ${T.text2}; letter-spacing: 0.02em;">TODAY</div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 13px; color: ${T.text2};">Weight</div>
          <div class="num" style="display: flex; align-items: baseline; gap: 6px; height: 48px; padding: 0 14px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; font-size: 20px; font-weight: 600;"><span style="align-self: center;">73.6</span><span style="align-self: center; font-size: 13px; color: ${T.text3}; font-weight: 500;">kg</span></div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 13px; color: ${T.text2};">Slept well?</div>
          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; height: 48px; padding: 4px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; box-sizing: border-box;">
            <div style="display: flex; align-items: center; justify-content: center; border-radius: 9px; background: ${T.s3}; font-size: 14px; font-weight: 600;">Good</div>
            <div style="display: flex; align-items: center; justify-content: center; border-radius: 9px; font-size: 14px; font-weight: 500; color: ${T.text2};">Bad</div>
          </div>
        </div>
      </div>
    </section>
  </div>`, { tab: 'Home' })

// ---------- Home with alerts (Build phase, banner + badge + nudge) ----------
const HomeAlerts = page(`
  ${topbar(wordmark, `<span style="font-size: 13px;">Wed 30 Sep</span>${icon.dots}`)}
  <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 20px 0; box-sizing: border-box;">
    <div style="display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 14px; background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.35);">
      <div style="width: 8px; height: 8px; border-radius: 999px; background: ${T.bad}; margin-top: 7px; flex-shrink: 0;"></div>
      <div style="font-size: 14px; line-height: 1.4;"><span style="font-weight: 600;">Shoulder &gt; 2 three sessions in a row</span> — tell your coach.</div>
    </div>
    <section style="display: flex; flex-direction: column; gap: 14px; padding: 22px 20px 20px; border-radius: 18px; background: ${T.s1}; border: 1px solid ${T.border};">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="font-size: 13px; font-weight: 600; color: ${T.text2}; letter-spacing: 0.02em;">IN PROGRESS</div>
        <div class="num" style="font-size: 13px; color: ${T.text3};">started 12 min ago</div>
      </div>
      <div style="font-size: 40px; font-weight: 700; letter-spacing: -0.03em; line-height: 1;">Pull B</div>
      ${btnPrimary('Resume Pull B')}
      <div style="text-align: center; color: ${T.text3}; font-size: 14px; font-weight: 500;">Discard</div>
    </section>
    ${weekDots(3, 5, 0)}
    <section style="display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border-radius: 16px; background: ${T.s1}; border: 1px solid ${T.border};">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="font-size: 16px; font-weight: 600;">Build 1 · week 4 of 6</div>
        <div style="font-size: 12px; font-weight: 600; color: ${T.accent}; background: ${T.accentSoft}; padding: 4px 10px; border-radius: 999px;">5 days/week</div>
      </div>
      <div style="color: ${T.text2}; font-size: 14px;">Sets as written · 2–3 reps in reserve</div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: ${T.ok}; background: ${T.okSoft}; padding: 4px 10px; border-radius: 999px;">${icon.moon} 6th day OK this week</div>
        <div style="color: ${T.text3}; font-size: 13px;">Easy week 19–25 Oct</div>
      </div>
    </section>
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-radius: 14px; background: ${T.s1}; border: 1px solid ${T.border};">
      <div style="font-size: 14px; color: ${T.text2};">16 days since last coach export</div>
      <div style="font-size: 14px; font-weight: 600; color: ${T.accent};">Export</div>
    </div>
  </div>`, { tab: 'Home' })

// ---------- Session: open card ----------
const sessionHeader = (rest, unsaved = 0) => `
  <header style="display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 16px 0 12px; box-sizing: border-box; background: ${T.s1}; border-bottom: 1px solid ${T.border};">
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="color: ${T.text2};">${icon.back}</div>
      <div style="display: flex; flex-direction: column;">
        <div style="font-size: 15px; font-weight: 700;">Push A</div>
        <div class="num" style="font-size: 12px; color: ${T.text3};">12:34 elapsed</div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      ${unsaved ? `<div style="font-size: 12px; font-weight: 600; color: ${T.accent}; background: ${T.accentSoft}; padding: 4px 10px; border-radius: 999px;">${unsaved} unsaved</div>` : ''}
      <div class="num" style="display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border-radius: 999px; background: ${rest ? T.accent : T.s2}; color: ${rest ? T.accentFg : T.text2}; font-size: 15px; font-weight: 700;">${icon.timer}${rest || '—'}</div>
      <div style="font-size: 14px; font-weight: 600; color: ${T.text2};">Finish</div>
    </div>
  </header>`
const openCardHeader = (name, range) => `
      <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px;">
        <div style="font-size: 17px; font-weight: 700; letter-spacing: -0.01em;">${name}</div>
        <div class="num" style="font-size: 13px; color: ${T.text3}; white-space: nowrap;">${range}</div>
      </div>`
const cardFooter = `<div style="display: flex; gap: 18px; padding-top: 4px; font-size: 14px; font-weight: 500; color: ${T.text2};"><span>type it instead</span><span>swap</span><span>note</span></div>`

const SessionOpen = page(`
  ${sessionHeader('')}
  <div style="display: flex; flex-direction: column; gap: 12px; padding: 12px 12px 0; box-sizing: border-box;">
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-radius: 12px; border: 1px dashed ${T.border}; color: ${T.text3}; font-size: 13px; font-weight: 500;"><span>Warm-up checklist</span>${icon.down}</div>
    <div style="display: flex; flex-direction: column; gap: 14px; padding: 16px; border-radius: 16px; background: ${T.s1}; border: 1px solid ${T.accent};">
      ${openCardHeader('Machine Chest Press', '8–12 × 3')}
      <div class="num" style="font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15;">Beat 27 kg × 12 · 9 · 8</div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${setRow(1, '27 kg', '12', '27', '12')}
        ${setRow(2, '27 kg', '10', '27', '9')}
        ${setRow(3, '27 kg', '9', '27', '8')}
      </div>
      ${cardFooter}
    </div>
    ${collapsedCard('Half-Kneeling Landmine Press', 'Beat 10 lb × 10 · 10 · 10')}
    ${collapsedCard('Pec Fly Machine', 'New weight 25 kg × 10+ each set')}
    ${collapsedCard('Cable Lateral Raise', 'Beat 10 kg × 15 · 14 · 12')}
    ${collapsedCard('Single-Arm Cable Overhead Triceps (rope)', 'Beat 15 kg × 15 · 13')}
    ${thenConnector}
    ${collapsedCard('Sidelying DB External Rotation', 'Beat 5 lb × 11 · 11')}
    <div style="text-align: center; padding: 6px 0 12px; color: ${T.text3}; font-size: 14px; font-weight: 500;">Finish as short session</div>
  </div>`, { height: 1010 })

// ---------- Session: mid-session ----------
const SessionMid = page(`
  ${sessionHeader('1:12', 1)}
  <div style="display: flex; flex-direction: column; gap: 12px; padding: 12px 12px 0; box-sizing: border-box;">
    ${collapsedCard('Machine Chest Press', '27 kg × 12·10·9 — beat it · same weight next time', { done: true })}
    <div style="display: flex; flex-direction: column; gap: 14px; padding: 16px; border-radius: 16px; background: ${T.s1}; border: 1px solid ${T.accent};">
      ${openCardHeader('Half-Kneeling Landmine Press', '8–12/arm × 3')}
      <div class="num" style="font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15;">Beat 10 lb × 10 · 10 · 10</div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${loggedRow(1, '10 lb × 11/arm', 'up')}
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 44px; color: ${T.text3}; font-size: 13px; font-weight: 500;">Set 2</div>
            ${chip('10 lb', 108)}
            <div style="display: flex; align-items: center; gap: 4px;">
              <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 48px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; color: ${T.text2};">${icon.minus}</div>
              ${chip('11/arm', 88)}
              <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 48px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; color: ${T.text2};">${icon.plus}</div>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end;">${checkBtn}</div>
        </div>
        ${setRow(3, '10 lb', '11/arm', '10', '10')}
      </div>
      ${cardFooter}
    </div>
    ${collapsedCard('Pec Fly Machine', 'New weight 25 kg × 10+ each set')}
    ${collapsedCard('Cable Lateral Raise', 'Beat 10 kg × 15 · 14 · 12')}
    ${collapsedCard('Single-Arm Cable Overhead Triceps (rope)', 'Beat 15 kg × 15 · 13')}
    ${thenConnector}
    ${collapsedCard('Sidelying DB External Rotation', 'Beat 5 lb × 11 · 11')}
  </div>
  <div style="position: absolute; left: 12px; right: 12px; bottom: 20px; display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-radius: 14px; background: ${T.s3}; border: 1px solid ${T.border}; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
    <div class="num" style="font-size: 14px;">Set 1 logged · 10 lb × 11/arm</div>
    <div style="font-size: 14px; font-weight: 700; color: ${T.accent};">Undo</div>
  </div>`, { height: 950 })

// ---------- Check-in sheet ----------
const stepper = (label, val) => `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; flex-direction: column; gap: 2px;"><div style="font-size: 15px; font-weight: 600;">${label}</div><div style="font-size: 12px; color: ${T.text3};">0 = none · 10 = worst</div></div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; color: ${T.text2};">${icon.minus}</div>
          <div class="num" style="display: flex; align-items: center; justify-content: center; width: 56px; height: 48px; font-size: 22px; font-weight: 700;">${val}</div>
          <div style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; color: ${T.text2};">${icon.plus}</div>
        </div>
      </div>`
const CheckIn = page(`
  ${sessionHeader('')}
  <div style="display: flex; flex-direction: column; gap: 12px; padding: 12px 12px 0; box-sizing: border-box; opacity: 0.35;">
    ${collapsedCard('Machine Chest Press', '27 kg × 12·10·9 — beat it · same weight next time', { done: true })}
    ${collapsedCard('Half-Kneeling Landmine Press', '10 lb × 11·11·10 — beat it · same weight next time', { done: true })}
    ${collapsedCard('Pec Fly Machine', '25 kg × 10·10 — matched · same weight next time', { done: true })}
    ${collapsedCard('Cable Lateral Raise', '10 kg × 15·15·15 — beat it · next time: 15 kg', { done: true })}
  </div>
  <div style="position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 18px; padding: 12px 20px 28px; box-sizing: border-box; border-radius: 22px 22px 0 0; background: ${T.s1}; border-top: 1px solid ${T.border}; box-shadow: 0 -12px 40px rgba(0,0,0,0.6);">
    <div style="width: 40px; height: 4px; border-radius: 999px; background: ${T.s3}; align-self: center;"></div>
    <div style="display: flex; align-items: baseline; justify-content: space-between;">
      <div style="font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Check-in</div>
      <div class="num" style="font-size: 13px; color: ${T.text3};">Push A · 41 min</div>
    </div>
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <div style="font-size: 15px; font-weight: 600;">Slept well?</div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; width: 160px; height: 48px; padding: 4px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; box-sizing: border-box;">
        <div style="display: flex; align-items: center; justify-content: center; border-radius: 9px; background: ${T.s3}; font-size: 14px; font-weight: 600;">Good</div>
        <div style="display: flex; align-items: center; justify-content: center; border-radius: 9px; font-size: 14px; font-weight: 500; color: ${T.text2};">Bad</div>
      </div>
    </div>
    ${stepper('Left shoulder', '0')}
    ${stepper('Elbow', '0')}
    <div style="display: flex; align-items: center; height: 48px; padding: 0 14px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; color: ${T.text3}; font-size: 15px;">Note (optional)</div>
    ${btnPrimary('Save & finish')}
  </div>`)

// ---------- Summary ----------
const Summary = page(`
  ${topbar(`<span style="font-size: 15px; font-weight: 700;">Push A done</span>`, `<span class="num" style="font-size: 13px;">41 min</span>`)}
  <div style="display: flex; flex-direction: column; gap: 16px; padding: 8px 20px 0; box-sizing: border-box;">
    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;">
      ${[['15', 'sets'], ['4', 'beat'], ['1', 'PR']].map(([n, l]) => `<div style="display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 14px 0; border-radius: 14px; background: ${T.s1}; border: 1px solid ${T.border};"><div class="num" style="font-size: 26px; font-weight: 700; letter-spacing: -0.02em;">${n}</div><div style="font-size: 12px; color: ${T.text3}; font-weight: 500;">${l}</div></div>`).join('')}
    </div>
    <div style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px; background: ${T.okSoft}; border: 1px solid rgba(95,211,138,0.3);">
      <div style="font-size: 11px; font-weight: 700; color: ${T.ok}; letter-spacing: 0.06em; padding: 2px 6px; border-radius: 6px; border: 1px solid ${T.ok};">PR</div>
      <div class="num" style="font-size: 14px;">Cable Lateral Raise 10 kg × 15</div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 6px;">
      ${['Machine Chest Press|27 kg × 12·10·9 — beat it · same weight next time', 'Half-Kneeling Landmine Press|10 lb × 11·11·10 — beat it · same weight next time', 'Pec Fly Machine|25 kg × 10·10 — matched · same weight next time', 'Cable Lateral Raise|10 kg × 15·15·15 — beat it · next time: 15 kg', 'Single-Arm Cable Overhead Triceps (rope)|15 kg × 15·13 — matched', 'Sidelying DB External Rotation|5 lb × 12·11 — beat it'].map((s) => { const [n, l] = s.split('|'); return `<div style="display: flex; flex-direction: column; gap: 1px; padding: 10px 0; border-bottom: 1px solid ${T.border};"><div style="font-size: 14px; font-weight: 600;">${n}</div><div class="num" style="font-size: 13px; color: ${T.text2};">${l}</div></div>` }).join('')}
    </div>
    <pre class="mono" style="margin: 0; padding: 14px; border-radius: 14px; background: ${T.s1}; border: 1px solid ${T.border}; font-size: 12px; line-height: 1.5; color: ${T.text2}; white-space: pre; overflow: hidden;">Machine Chest Press 8-12 x 3
27.12.10.9

Half-Kneeling Landmine Press 8-12/arm x 3
10.11.11.10</pre>
    <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; padding-bottom: 8px;">
      <div style="font-size: 13px; color: ${T.text3};">Next up</div>
      <div style="font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">Pull A</div>
    </div>
    ${btnSecondary('Back to Home')}
  </div>`, { height: 930 })

// ---------- History list ----------
const kindDot = (c) => `<div style="width: 10px; height: 10px; border-radius: 999px; background: ${c}; flex-shrink: 0;"></div>`
const histRow = (dot, day, name, meta, tag = '') => `
      <div style="display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 4px; border-bottom: 1px solid ${T.border};">
        ${kindDot(dot)}
        <div class="num" style="width: 56px; font-size: 13px; color: ${T.text3};">${day}</div>
        <div style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 15px; font-weight: 600;">${name}</span>${tag ? `<span style="font-size: 11px; font-weight: 600; color: ${T.text3}; border: 1px solid ${T.border}; padding: 1px 6px; border-radius: 6px;">${tag}</span>` : ''}</div>
          <div class="num" style="font-size: 13px; color: ${T.text3};">${meta}</div>
        </div>
        <div style="color: ${T.text3};">${icon.chev}</div>
      </div>`
const HistoryList = page(`
  ${topbar(`<span style="font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">History</span>`, `<span style="font-size: 13px;">Calendar</span>`)}
  <div style="display: flex; flex-direction: column; gap: 4px; padding: 4px 16px 0; box-sizing: border-box;">
    <div style="font-size: 13px; font-weight: 600; color: ${T.text2}; letter-spacing: 0.02em; padding: 8px 4px;">SEPTEMBER 2026</div>
    ${histRow(T.pull, 'Tue 15', 'Pull B', 'in progress · started 12 min ago', 'live')}
    ${histRow(T.push, 'Mon 14', 'Push B', '38 min · 13 sets · shoulder 1')}
    ${histRow(T.walk, 'Sun 13', 'Walk', '22 min')}
    ${histRow(T.legs, 'Sat 12', 'Legs A', '44 min · 13 sets')}
    ${histRow(T.pull, 'Thu 10', 'Pull A', '40 min · 15 sets')}
    ${histRow(T.push, 'Tue 8', 'Push A', '41 min · 15 sets · 1 PR')}
    ${histRow(T.push, 'Mon 7', 'Push A', '27 min · 6 sets', 'short')}
    <div style="font-size: 13px; font-weight: 600; color: ${T.text2}; letter-spacing: 0.02em; padding: 16px 4px 8px;">AUGUST 2026</div>
    ${histRow(T.walk, 'Sun 30', 'Imported', '7 exercises', 'imported')}
    ${histRow(T.walk, 'Sun 23', 'Imported', '7 exercises', 'imported')}
  </div>`, { tab: 'History' })

// ---------- History detail ----------
const HistoryDetail = page(`
  ${topbar(`<div style="color: ${T.text2};">${icon.back}</div><span style="font-size: 17px; font-weight: 700;">Push A</span>`, `<span style="font-size: 13px;">Edit</span>`)}
  <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 20px 0; box-sizing: border-box;">
    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      ${['Tue 8 Sep', '41 min', 'sleep: good', 'shoulder 0', 'elbow 0'].map((t) => `<div class="num" style="font-size: 12px; font-weight: 500; color: ${T.text2}; background: ${T.s1}; border: 1px solid ${T.border}; padding: 6px 10px; border-radius: 999px;">${t}</div>`).join('')}
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; align-items: center; justify-content: space-between;"><div style="font-size: 13px; font-weight: 600; color: ${T.text2}; letter-spacing: 0.02em;">SHORTHAND</div><div style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: ${T.accent};">${icon.copy} Copy</div></div>
      <pre class="mono" style="margin: 0; padding: 14px; border-radius: 14px; background: ${T.s1}; border: 1px solid ${T.border}; font-size: 12px; line-height: 1.5; color: ${T.text2}; white-space: pre; overflow: hidden;">Machine Chest Press 8-12 x 3
27.12.10.9

Half-Kneeling Landmine Press 8-12/arm x 3
10.11.11.10

Pec Fly Machine 10-12 x 2
25.10.10

Cable Lateral Raise 12-15/arm x 3
10.15.15.15

Single-Arm Cable Overhead Triceps (rope) 12-15/arm x 2
15.15.13

Sidelying DB External Rotation 15/arm x 2
5.12.11</pre>
    </div>
    <div style="display: flex; flex-direction: column;">
      <div style="display: grid; grid-template-columns: 1.6fr 0.5fr 0.8fr 0.6fr 0.5fr; gap: 8px; padding: 6px 4px; font-size: 11px; font-weight: 600; color: ${T.text3}; letter-spacing: 0.04em;"><div>EXERCISE</div><div>SET</div><div>LOAD</div><div>REPS</div><div></div></div>
      ${[['Machine Chest Press', '1', '27 kg', '12', '='], ['', '2', '27 kg', '10', '↑'], ['', '3', '27 kg', '9', '↑'], ['Landmine Press', '1', '10 lb', '11/arm', '↑'], ['', '2', '10 lb', '11/arm', '↑'], ['', '3', '10 lb', '10/arm', '='], ['Cable Lateral Raise', '3', '10 kg', '15/arm', 'PR']].map(([e, s, l, r, m]) => `<div class="num" style="display: grid; grid-template-columns: 1.6fr 0.5fr 0.8fr 0.6fr 0.5fr; gap: 8px; align-items: center; height: 40px; padding: 0 4px; border-top: 1px solid ${T.border}; font-size: 14px;"><div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e}</div><div style="color: ${T.text3};">${s}</div><div>${l}</div><div>${r}</div><div style="color: ${m === 'PR' || m === '↑' ? T.ok : T.text3}; font-weight: 700; font-size: 12px;">${m}</div></div>`).join('')}
    </div>
  </div>`)

// ---------- Body ----------
const Body = page(`
  ${topbar(`<span style="font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Body</span>`, `<span class="num" style="font-size: 13px;">Mon 7 Sep</span>`)}
  <div style="display: flex; flex-direction: column; gap: 16px; padding: 4px 20px 0; box-sizing: border-box;">
    <section style="display: flex; flex-direction: column; gap: 14px; padding: 18px; border-radius: 16px; background: ${T.s1}; border: 1px solid ${T.border};">
      <div style="display: flex; align-items: baseline; justify-content: space-between;">
        <div style="display: flex; align-items: baseline; gap: 6px;"><span class="num" style="font-size: 40px; font-weight: 700; letter-spacing: -0.03em; line-height: 1;">73.6</span><span style="font-size: 15px; color: ${T.text3};">kg</span></div>
        <div class="num" style="font-size: 13px; color: ${T.text2};">7-day avg <span style="color: ${T.text}; font-weight: 600;">73.4</span></div>
      </div>
      <svg width="314" height="56" viewBox="0 0 314 56" fill="none"><polyline points="0,40 45,36 90,38 135,30 180,28 225,24 270,20 314,18" stroke="${T.accent}" stroke-width="2" stroke-linejoin="round"/><polyline points="0,44 45,34 90,42 135,26 180,32 225,20 270,24 314,14" stroke="${T.text3}" stroke-width="1.5" stroke-dasharray="3 4"/></svg>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;">
        <div class="num" style="display: flex; align-items: center; justify-content: space-between; height: 48px; padding: 0 14px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border};"><span style="font-size: 13px; color: ${T.text2};">Waist</span><span style="font-size: 17px; font-weight: 600;">84.0 <span style="font-size: 12px; color: ${T.text3}; font-weight: 500;">cm</span></span></div>
        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; height: 48px; padding: 4px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; box-sizing: border-box;">
          <div style="display: flex; align-items: center; justify-content: center; border-radius: 9px; background: ${T.s3}; font-size: 13px; font-weight: 600;">Slept</div>
          <div style="display: flex; align-items: center; justify-content: center; border-radius: 9px; font-size: 13px; font-weight: 500; color: ${T.text2};">Bad</div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; height: 48px; padding: 0 14px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border};"><span style="font-size: 13px; color: ${T.text2};">Protein ≥140 g</span><div style="width: 22px; height: 22px; border-radius: 6px; background: ${T.accent}; color: ${T.accentFg}; display: flex; align-items: center; justify-content: center;">${icon.check}</div></div>
        <div class="num" style="display: flex; align-items: center; justify-content: space-between; height: 48px; padding: 0 14px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border};"><span style="font-size: 13px; color: ${T.text2};">Cardio</span><span style="font-size: 14px; font-weight: 600;">Walk · 22 min</span></div>
      </div>
    </section>
    <div style="display: flex; flex-direction: column;">
      <div style="font-size: 13px; font-weight: 600; color: ${T.text2}; letter-spacing: 0.02em; padding: 4px 4px 10px;">LAST 7 DAYS</div>
      ${[['Sun 6', '73.8', 'good', '—'], ['Sat 5', '73.5', 'good', 'Walk 20'], ['Fri 4', '—', 'bad', '—'], ['Thu 3', '73.3', 'good', '—'], ['Wed 2', '73.9', 'good', 'Walk 25'], ['Tue 1', '73.1', '—', '—']].map(([d, w, s, c]) => `<div class="num" style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; align-items: center; height: 40px; padding: 0 4px; border-top: 1px solid ${T.border}; font-size: 14px;"><div style="color: ${T.text3};">${d}</div><div style="font-weight: 600;">${w}</div><div style="color: ${s === 'good' ? T.ok : s === 'bad' ? T.bad : T.text3};">${s}</div><div style="color: ${T.text2};">${c}</div></div>`).join('')}
    </div>
  </div>`, { tab: 'Body' })

// ---------- Export ----------
const Export = page(`
  ${topbar(`<div style="color: ${T.text2};">${icon.back}</div><span style="font-size: 17px; font-weight: 700;">Coach export</span>`)}
  <div style="display: flex; flex-direction: column; gap: 14px; padding: 4px 20px 0; box-sizing: border-box;">
    <div style="display: flex; gap: 8px;">
      ${['Last 14 days', 'Last 7', 'This week', 'Custom'].map((t, i) => `<div style="font-size: 13px; font-weight: 600; padding: 8px 12px; border-radius: 999px; background: ${i === 0 ? T.accent : T.s1}; color: ${i === 0 ? T.accentFg : T.text2}; border: 1px solid ${i === 0 ? T.accent : T.border}; white-space: nowrap;">${t}</div>`).join('')}
    </div>
    <div class="num" style="font-size: 13px; color: ${T.text3};">2026-09-07 → 2026-09-20 · 8 sessions · 1 walk</div>
    <pre class="mono" style="margin: 0; height: 520px; padding: 14px; border-radius: 14px; background: ${T.s1}; border: 1px solid ${T.border}; font-size: 11.5px; line-height: 1.5; color: ${T.text2}; white-space: pre; overflow: hidden;"># LiftLoop report — 2026-09-07 → 2026-09-20 (Rahul)

## Summary
- Phase: Ramp (W1–W2). Target 4 days/week. Sessions: 8/8 (W1: 4, W2: 4). Short sessions: 1. Walk days: 1.
- Loop next: Legs A
- Units: stacks kg, free weights lb, body weight kg
- Sleep: good nights 10/14 (2 unrecorded)
- Shoulder (0–10): avg 0.8, max 2 (2026-09-15, Push B)
- Elbow (0–10): avg 0, max 0
- Body weight: 7-day avg 73.4 → 73.6 kg (+0.2). Waist: 84.0 cm (2026-09-07)
- Protein ≥140 g: 9/14 days
- Verdicts: easy 42
- PRs: Pull-Ups BW × 9 (2026-09-18), Leg Press 180 lb/side × 15 (2026-09-16)
- Flags: none

## Sessions
### 2026-09-07 Mon — Push A — 41 min — sleep: good — shoulder: 0 — elbow: 0
Machine Chest Press 8-12 x 2
25.12.12

Half-Kneeling Landmine Press 8-12/arm x 2
10.10.10
…</pre>
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;">
      <button style="display: flex; align-items: center; justify-content: center; gap: 8px; height: 56px; border: 0; border-radius: 14px; background: ${T.accent}; color: ${T.accentFg}; font: inherit; font-size: 16px; font-weight: 700;">${icon.copy} Copy</button>
      <button style="display: flex; align-items: center; justify-content: center; gap: 8px; height: 56px; border: 1px solid ${T.border}; border-radius: 14px; background: ${T.s2}; color: ${T.text}; font: inherit; font-size: 16px; font-weight: 600;">${icon.share} Share</button>
    </div>
  </div>`)

// ---------- More ----------
const More = page(`
  ${topbar(`<span style="font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">More</span>`)}
  <div style="display: flex; flex-direction: column; gap: 20px; padding: 4px 20px 0; box-sizing: border-box;">
    <div style="display: flex; flex-direction: column; border-radius: 16px; background: ${T.s1}; border: 1px solid ${T.border}; overflow: hidden;">
      ${[['Coach export', 'Last export 2 days ago'], ['Import from notes', 'Paste your shorthand'], ['Backup', 'JSON export and restore']].map(([t, s], i) => `<div style="display: flex; align-items: center; gap: 12px; height: 60px; padding: 0 16px; ${i ? `border-top: 1px solid ${T.border};` : ''}"><div style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1;"><div style="font-size: 15px; font-weight: 600;">${t}</div><div style="font-size: 13px; color: ${T.text3};">${s}</div></div><div style="color: ${T.text3};">${icon.chev}</div></div>`).join('')}
    </div>
    <div style="display: flex; flex-direction: column; border-radius: 16px; background: ${T.s1}; border: 1px solid ${T.border}; overflow: hidden;">
      ${[['Program', 'v2 · 6 templates · 30 exercises'], ['Settings', 'Rest timers, gym config'], ['About', 'LiftLoop 0.1 · MIT']].map(([t, s], i) => `<div style="display: flex; align-items: center; gap: 12px; height: 60px; padding: 0 16px; ${i ? `border-top: 1px solid ${T.border};` : ''}"><div style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1;"><div style="font-size: 15px; font-weight: 600;">${t}</div><div style="font-size: 13px; color: ${T.text3};">${s}</div></div><div style="color: ${T.text3};">${icon.chev}</div></div>`).join('')}
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <div style="font-size: 13px; font-weight: 600; color: ${T.text2}; letter-spacing: 0.02em; padding: 0 4px;">QUICK ACTIONS</div>
      ${btnSecondary('Log a walk day')}
      ${btnSecondary('Start easy week now')}
      ${btnSecondary('Start a different template')}
    </div>
  </div>`, { tab: 'More' })

// ---------- Low-fi alternates (Home) ----------
const lofi = (title, body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    body { margin: 0; background: #111; color: #ddd; font-family: Geist, system-ui, sans-serif; }
    a { color: #ddd; } a:hover { color: #fff; }
  </style>
</helmet>
<div style="position: relative; width: 390px; height: 844px; overflow: hidden; background: #111; box-sizing: border-box; padding: 24px 20px; display: flex; flex-direction: column; gap: 16px;">
  <div style="font-size: 12px; letter-spacing: 0.08em; color: #777;">${title}</div>
${body}
</div>
</x-dc>
</body>
</html>
`
const box = (h, txt, extra = '') => `<div style="display: flex; align-items: center; justify-content: center; height: ${h}px; border: 1.5px dashed #555; border-radius: 12px; color: #999; font-size: 14px; text-align: center; ${extra}">${txt}</div>`
const AltEditorial = lofi('ALT A · BIG NUMERALS', `
  <div style="font-size: 88px; font-weight: 800; letter-spacing: -0.06em; line-height: 0.9; color: #eee;">Legs<br>A</div>
  <div style="font-size: 14px; color: #888;">Next in the loop · Ramp week 1</div>
  ${box(64, 'START', 'border-style: solid; border-color: #eee; color: #eee; font-weight: 700; font-size: 18px;')}
  <div style="display: flex; gap: 8px;">${Array.from({ length: 4 }, (_, i) => `<div style="width: 18px; height: 18px; border-radius: 999px; border: 1.5px solid #777; background: ${i < 2 ? '#ddd' : 'transparent'};"></div>`).join('')}</div>
  ${box(120, 'Phase card: huge week number, rule as one line')}
  ${box(96, 'Today: weight + sleep as two big tiles')}
  <div style="margin-top: auto; color: #666; font-size: 12px;">Motivation: template name is the only thing you need at a glance. Tradeoff: less room for the phase rule and week dots.</div>`)
const AltConsole = lofi('ALT B · DENSE CONSOLE', `
  <div style="font-family: ui-monospace, Menlo, monospace; font-size: 13px; line-height: 1.7; color: #bbb; border: 1.5px dashed #555; border-radius: 10px; padding: 12px;">
next      LEGS A<br>phase     RAMP · W1/2 · 4d/wk · 2 sets · 4 RIR<br>week      ●● ○○  +1 walk<br>easy      19–25 Oct<br>weight    73.6 kg  avg 73.4<br>sleep     good ▣  bad ▢<br>export    2d ago</div>
  ${box(56, '> start legs a', 'font-family: ui-monospace, Menlo, monospace; border-style: solid; border-color: #ddd; color: #eee; justify-content: flex-start; padding: 0 16px;')}
  ${box(220, 'Session cards as compact mono rows:\nname · goal · [27 kg][12] ✓', 'white-space: pre-line; font-family: ui-monospace, Menlo, monospace;')}
  <div style="margin-top: auto; color: #666; font-size: 12px;">Motivation: everything on one screen, zero decoration, fast to scan. Tradeoff: small type in gym lighting, no clear primary action.</div>`)

// ---------- write ----------
const files = {
  'Main.dc.html': Home,
  'Login.dc.html': Login,
  'HomeAlerts.dc.html': HomeAlerts,
  'SessionOpen.dc.html': SessionOpen,
  'SessionMid.dc.html': SessionMid,
  'CheckIn.dc.html': CheckIn,
  'Summary.dc.html': Summary,
  'HistoryList.dc.html': HistoryList,
  'HistoryDetail.dc.html': HistoryDetail,
  'Body.dc.html': Body,
  'Export.dc.html': Export,
  'More.dc.html': More,
  'AltEditorial.dc.html': AltEditorial,
  'AltConsole.dc.html': AltConsole,
}
for (const [name, html] of Object.entries(files)) writeFileSync(join(here, name), html)

const W = 390, H = 844, GX = 100, GY = 160
const HEIGHTS = { 'SessionOpen.dc.html': 1010, 'SessionMid.dc.html': 950, 'Summary.dc.html': 930 }
const row = (y, names) => names.map((file, i) => ({ file, x: i * (W + GX), y, w: W, h: HEIGHTS[file] || H }))
const canvas = {
  pages: [{ id: 'flow', name: 'Screens' }, { id: 'alts', name: 'Direction alternates' }],
  artboards: [
    ...row(0, ['Login.dc.html', 'Main.dc.html', 'HomeAlerts.dc.html', 'SessionOpen.dc.html', 'SessionMid.dc.html']).map((a) => ({ ...a, page: 'flow' })),
    ...row(1010 + GY, ['CheckIn.dc.html', 'Summary.dc.html', 'HistoryList.dc.html', 'HistoryDetail.dc.html', 'Body.dc.html']).map((a) => ({ ...a, page: 'flow' })),
    ...row(1010 + GY + 930 + GY, ['Export.dc.html', 'More.dc.html']).map((a) => ({ ...a, page: 'flow' })),
    ...row(0, ['AltEditorial.dc.html', 'AltConsole.dc.html']).map((a) => ({ ...a, page: 'alts' })),
  ].map((a) => ({ ...a, title: a.file.replace('.dc.html', '').replace('Main', 'Home') })),
  annotations: [
    { id: 'direction', x: 0, y: -140, w: 560, page: 'flow', text: 'LiftLoop — gym-floor console. Dark neutral surfaces (shadcn tokens from the app), elevation by lightness, one amber accent for the single primary action per screen, tabular numerals for every load and rep. Row 1: sign in → home → home with alerts → session. Row 2: check-in → summary → history → body. Row 3: coach export → more.' },
    { id: 'alts-note', x: 0, y: -120, w: 480, page: 'alts', text: 'Two low-fi alternates for the Home direction, in case the main direction feels off. Pick one and I rebuild every screen in it.' },
  ],
  launch: { view: 'canvas', page: 'flow' },
}
writeFileSync(join(here, 'canvas.json'), JSON.stringify(canvas, null, 2))
console.log('wrote', Object.keys(files).length, 'artboards + canvas.json')

// =====================================================================================
// v1.2 — Session focus: one exercise at a time, postpone, rest ping (design/focus/*)
// Separate canvas so the review stays small; shares every token and piece above.
// =====================================================================================
icon.list = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>'
icon.skip = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h12M11 7l5 5-5 5M20 6v12"/></svg>'
icon.chevSm = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
icon.checkSm = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>'

const restPill = (state, txt) => {
  const bg = state === 'running' ? T.accent : state === 'done' ? T.okSoft : T.s2
  const fg = state === 'running' ? T.accentFg : state === 'done' ? T.ok : T.text2
  return `<div class="num" style="display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border-radius: 999px; background: ${bg}; color: ${fg}; font-size: 15px; font-weight: 700;">${icon.timer}${txt}</div>`
}
// Header as today + a 2 px rest progress line along its bottom edge (fills while resting, green at 0).
const focusHeader = (elapsed, state, txt, restPct = null) => `
  <header style="position: relative; display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 16px 0 12px; box-sizing: border-box; background: ${T.s1}; border-bottom: 1px solid ${T.border};">
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="color: ${T.text2};">${icon.back}</div>
      <div style="display: flex; flex-direction: column;">
        <div style="font-size: 15px; font-weight: 700;">Push A</div>
        <div class="num" style="font-size: 12px; color: ${T.text3};">${elapsed} elapsed</div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      ${restPill(state, txt)}
      <div style="font-size: 14px; font-weight: 600; color: ${T.text2};">Finish</div>
    </div>
    ${restPct === null ? '' : `<div style="position: absolute; left: 0; bottom: -1px; height: 2px; width: ${restPct}%; background: ${state === 'done' ? T.ok : T.accent};"></div>`}
  </header>`
// Progress strip: position in the lineup + one segment per exercise; "Lineup" opens the sheet.
const progressStrip = (states) => {
  const now = states.indexOf('now')
  const seg = (st) => `<div style="flex-grow: 1; height: 4px; border-radius: 999px; background: ${st === 'done' ? T.accent : st === 'now' ? T.accentSoft : T.s3}; ${st === 'now' ? `box-shadow: inset 0 0 0 1px ${T.accent};` : ''}"></div>`
  return `
  <div style="display: flex; align-items: center; gap: 12px; height: 44px; padding: 0 16px; box-sizing: border-box;">
    <div class="num" style="font-size: 13px; font-weight: 600; color: ${T.text2}; white-space: nowrap;">${now === -1 ? states.length : now + 1} of ${states.length}</div>
    <div style="display: flex; gap: 4px; flex-grow: 1;">${states.map(seg).join('')}</div>
    <div style="display: flex; align-items: center; gap: 5px; height: 44px; padding: 0 4px; font-size: 13px; font-weight: 600; color: ${T.text2};">${icon.list}Lineup</div>
  </div>`
}
const focusCard = (inner) => `<div style="display: flex; flex-direction: column; gap: 14px; padding: 16px; border-radius: 16px; background: ${T.s1}; border: 1px solid ${T.border};">${inner}</div>`
const focusFooter = (postpone = true) => `<div style="display: flex; align-items: center; gap: 18px; padding-top: 4px; font-size: 14px; font-weight: 500; color: ${T.text2};"><span>type it instead</span><span>swap</span><span>note</span><div style="flex-grow: 1;"></div>${postpone ? `<span style="display: flex; align-items: center; gap: 5px; color: ${T.text2};">postpone ${icon.skip}</span>` : ''}</div>`
const nextLine = (name, tag = '') => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 16px 0; font-size: 13px; color: ${T.text3};">
      <div style="display: flex; align-items: center; gap: 6px; min-width: 0;"><span style="white-space: nowrap;">Up next ·</span><span style="color: ${T.text2}; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</span>${tag ? `<span style="font-size: 11px; font-weight: 600; padding: 1px 6px; border: 1px solid ${T.border}; border-radius: 6px; color: ${T.text3}; white-space: nowrap;">${tag}</span>` : ''}</div>
      ${icon.chevSm}
    </div>`
const undoToast = (txt) => `
  <div style="position: absolute; left: 12px; right: 12px; bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-radius: 14px; background: ${T.s3}; border: 1px solid ${T.border}; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
    <div class="num" style="font-size: 14px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${txt}</div>
    <div style="font-size: 14px; font-weight: 700; color: ${T.accent};">Undo</div>
  </div>`
const landmineCard = (mid) => focusCard(`
      ${openCardHeader('Half-Kneeling Landmine Press', '8–12/arm × 3')}
      <div class="num" style="font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15;">Beat 10 lb × 10 · 10 · 10</div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${loggedRow(1, '10 lb × 11/arm', 'up')}
        ${mid ? `<div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 44px; color: ${T.text3}; font-size: 13px; font-weight: 500;">Set 2</div>
            ${chip('10 lb', 108)}
            <div style="display: flex; align-items: center; gap: 4px;">
              <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 48px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; color: ${T.text2};">${icon.minus}</div>
              ${chip('11/arm', 88)}
              <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 48px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; color: ${T.text2};">${icon.plus}</div>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end;">${checkBtn}</div>
        </div>` : setRow(2, '10 lb', '11/arm', '10', '10')}
        ${setRow(3, '10 lb', '11/arm', '10', '10')}
      </div>
      ${focusFooter()}`)

// 1. Focus — mid-session, resting after set 1 of the second exercise.
const Focus = page(`
  ${focusHeader('12:34', 'running', '1:12', 38)}
  ${progressStrip(['done', 'now', 'todo', 'todo', 'todo', 'todo'])}
  <div style="display: flex; flex-direction: column; gap: 12px; padding: 0 12px; box-sizing: border-box;">
    ${landmineCard(true)}
    ${nextLine('Pec Fly Machine')}
  </div>
  ${undoToast('Set 1 logged · 10 lb × 11/arm')}`)

// 2. Rest over — the ping moment: pill flips green, the line under the header is full.
const RestDone = page(`
  ${focusHeader('13:46', 'done', 'go', 100)}
  ${progressStrip(['done', 'now', 'todo', 'todo', 'todo', 'todo'])}
  <div style="display: flex; flex-direction: column; gap: 12px; padding: 0 12px; box-sizing: border-box;">
    ${landmineCard(false)}
    ${nextLine('Pec Fly Machine')}
  </div>`)

// 3. Lineup sheet over the focus screen: every exercise with its state; tap one to do it now.
const lineupRow = (n, name, sub, state, tag = '') => {
  const lead = state === 'done' ? `<div style="color: ${T.ok};">${icon.checkSm}</div>` : state === 'now' ? `<div style="width: 10px; height: 10px; border-radius: 999px; background: ${T.accent};"></div>` : `<div class="num" style="font-size: 13px; font-weight: 600; color: ${T.text3};">${n}</div>`
  return `
        <div style="display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 12px 0 4px; border-top: 1px solid ${T.border};">
          <div style="display: flex; align-items: center; justify-content: center; width: 28px;">${lead}</div>
          <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex-grow: 1;">
            <div style="display: flex; align-items: center; gap: 6px;"><span style="font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${state === 'done' ? T.text2 : T.text};">${name}</span>${tag ? `<span style="font-size: 11px; font-weight: 600; padding: 1px 6px; border: 1px solid ${T.border}; border-radius: 6px; color: ${T.text3}; white-space: nowrap;">${tag}</span>` : ''}</div>
            <div class="num" style="font-size: 13px; color: ${T.text3}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sub}</div>
          </div>
          ${state === 'now' ? `<div style="font-size: 12px; font-weight: 700; color: ${T.accent};">now</div>` : state === 'todo' ? `<div style="color: ${T.text3};">${icon.chevSm}</div>` : ''}
        </div>`
}
const Lineup = page(`
  ${focusHeader('12:34', 'running', '0:48', 62)}
  ${progressStrip(['done', 'now', 'todo', 'todo', 'todo', 'todo'])}
  <div style="display: flex; flex-direction: column; gap: 12px; padding: 0 12px; box-sizing: border-box;">
    ${landmineCard(false)}
  </div>
  <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.55);"></div>
  <div style="position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 12px; padding: 16px 16px 32px; box-sizing: border-box; background: ${T.s1}; border-top: 1px solid ${T.border}; border-radius: 24px 24px 0 0;">
    <div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 8px;">
      <div style="font-size: 17px; font-weight: 700;">Lineup</div>
      <div class="num" style="font-size: 13px; color: ${T.text3};">1 of 6 done · 12:34</div>
    </div>
    <div style="padding: 0 8px; font-size: 13px; color: ${T.text2};">Tap an exercise to do it now. Postponed ones wait one place behind the current one.</div>
    <div style="display: flex; flex-direction: column; border: 1px solid ${T.border}; border-radius: 16px; padding: 0 4px;">
      <div style="margin-top: -1px;">
        ${lineupRow(1, 'Machine Chest Press', '27 kg × 12·10·9 — beat it · same weight next time', 'done')}
        ${lineupRow(2, 'Half-Kneeling Landmine Press', '1 of 3 sets · Beat 10 lb × 10 · 10 · 10', 'now')}
        ${lineupRow(3, 'Pec Fly Machine', 'New weight 25 kg × 10+ each set', 'todo')}
        ${lineupRow(4, 'Cable Lateral Raise', 'Beat 10 kg × 15 · 14 · 12', 'todo')}
        ${lineupRow(5, 'Single-Arm Cable Overhead Triceps (rope)', 'Beat 15 kg × 15 · 13', 'todo')}
        ${lineupRow('+', 'Sidelying DB External Rotation', 'then · Beat 5 lb × 11 · 11', 'todo')}
      </div>
    </div>
    <div style="text-align: center; padding-top: 4px; color: ${T.text3}; font-size: 14px; font-weight: 500;">Finish as short session</div>
  </div>`)

// 4. Postponed — Pec Fly's machine was busy: it now waits behind Cable Lateral Raise.
const Postponed = page(`
  ${focusHeader('19:02', 'idle', '—')}
  ${progressStrip(['done', 'done', 'now', 'todo', 'todo', 'todo'])}
  <div style="display: flex; flex-direction: column; gap: 12px; padding: 0 12px; box-sizing: border-box;">
    ${focusCard(`
      ${openCardHeader('Cable Lateral Raise', '12–15 × 3')}
      <div class="num" style="font-size: 24px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15;">Beat 10 kg × 15 · 14 · 12</div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${setRow(1, '10 kg', '15', '10', '15')}
        ${setRow(2, '10 kg', '14', '10', '14')}
        ${setRow(3, '10 kg', '12', '10', '12')}
      </div>
      ${focusFooter()}`)}
    ${nextLine('Pec Fly Machine', 'postponed')}
  </div>
  ${undoToast('Pec Fly Machine moved after this one')}`)

// 5. All done — the lineup as a recap, one primary action.
const AllDone = page(`
  ${focusHeader('41:10', 'idle', '—')}
  ${progressStrip(['done', 'done', 'done', 'done', 'done', 'done'])}
  <div style="display: flex; flex-direction: column; gap: 12px; padding: 0 12px; box-sizing: border-box;">
    <div style="display: flex; flex-direction: column; border: 1px solid ${T.border}; border-radius: 16px; background: ${T.s1}; padding: 0 8px;">
      <div style="margin-top: -1px;">
        ${lineupRow(1, 'Machine Chest Press', '27 kg × 12·10·9 — beat it · same weight next time', 'done')}
        ${lineupRow(2, 'Half-Kneeling Landmine Press', '10 lb × 11·11·10 — beat it · same weight next time', 'done')}
        ${lineupRow(3, 'Cable Lateral Raise', '10 kg × 15·15·14 — beat it · next time: 12.5 kg', 'done')}
        ${lineupRow(4, 'Pec Fly Machine', '25 kg × 10·10·9 — done · same weight next time', 'done', 'postponed')}
        ${lineupRow(5, 'Single-Arm Cable Overhead Triceps (rope)', '15 kg × 15·14 — beat it · same weight next time', 'done')}
        ${lineupRow('+', 'Sidelying DB External Rotation', '5 lb × 12·11 — beat it · next time: 7 lb', 'done')}
      </div>
    </div>
    ${btnPrimary('Finish session')}
  </div>`)

// 6. Settings — rest timer card (duration + ping) above the gym config.
const settingRow = (k, v) => `<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 12px 16px; border-top: 1px solid ${T.border}; font-size: 14px;"><span style="color: ${T.text2};">${k}</span><span class="num" style="text-align: right;">${v}</span></div>`
const restChip = (txt, on) => `<div class="num" style="display: flex; align-items: center; justify-content: center; height: 40px; padding: 0 14px; border-radius: 10px; background: ${on ? T.accent : T.s2}; color: ${on ? T.accentFg : T.text}; border: 1px solid ${on ? T.accent : T.border}; font-size: 14px; font-weight: 600; white-space: nowrap;">${txt}</div>`
const SettingsRest = page(`
  ${topbar(`<div style="color: ${T.text2}; margin-left: -8px;">${icon.back}</div><span style="font-size: 17px; font-weight: 700;">Settings</span>`)}
  <div style="display: flex; flex-direction: column; gap: 16px; padding: 0 20px; box-sizing: border-box;">
    <div style="display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 16px; background: ${T.s1}; border: 1px solid ${T.border};">
      <div style="font-size: 13px; font-weight: 600; color: ${T.text2}; letter-spacing: 0.02em;">REST TIMER</div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 15px; font-weight: 600;">Rest between sets</div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">${restChip('Program', true)}${restChip('60 s', false)}${restChip('90 s', false)}${restChip('120 s', false)}${restChip('180 s', false)}</div>
        <div style="font-size: 13px; color: ${T.text3};">Program: 120 s on the first exercise, 90 s after. Per-exercise values live under Program → Edit.</div>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 12px; border-top: 1px solid ${T.border};">
        <div style="display: flex; flex-direction: column; gap: 2px;"><div style="font-size: 15px; font-weight: 600;">Ping when rest ends</div><div style="font-size: 13px; color: ${T.text3};">Beep and buzz while LiftLoop is open — even on silent.</div></div>
        <div style="position: relative; width: 51px; height: 31px; border-radius: 999px; background: ${T.accent}; flex-shrink: 0;"><div style="position: absolute; top: 2px; left: 22px; width: 27px; height: 27px; border-radius: 999px; background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div></div>
      </div>
    </div>
    <div style="display: flex; flex-direction: column; border-radius: 16px; background: ${T.s1}; border: 1px solid ${T.border};">
      <div style="margin-top: -1px;">
        ${settingRow('Stacks', 'kg, 2.5 kg steps (odd values allowed)')}
        ${settingRow('Free weights', 'lb')}
        ${settingRow('Plates (lb, per side)', '2.5 · 5 · 10 · 25 · 45')}
        ${settingRow('Dumbbell rack (lb)', '5 · 7.5 · 10 · 15 · 20 · 25 · 30, then +5')}
        ${settingRow('Time zone', 'Asia/Kolkata (weeks start Monday)')}
      </div>
    </div>
    <div style="display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 16px; background: ${T.s1}; border: 1px solid ${T.border};">
      <div style="font-size: 12px; color: ${T.text2};">Plates (lb, per side)</div>
      <div class="num" style="display: flex; align-items: center; height: 44px; padding: 0 12px; border-radius: 12px; background: ${T.s2}; border: 1px solid ${T.border}; font-size: 14px;">2.5, 5, 10, 25, 45</div>
    </div>
  </div>`)

const focusFiles = {
  'Main.dc.html': Focus,
  'RestDone.dc.html': RestDone,
  'Lineup.dc.html': Lineup,
  'Postponed.dc.html': Postponed,
  'AllDone.dc.html': AllDone,
  'SettingsRest.dc.html': SettingsRest,
}
mkdirSync(join(here, 'focus'), { recursive: true })
for (const [name, html] of Object.entries(focusFiles)) writeFileSync(join(here, 'focus', name), html)
const focusTitles = { 'Main.dc.html': 'Focus · resting', 'RestDone.dc.html': 'Rest over (ping)', 'Lineup.dc.html': 'Lineup sheet', 'Postponed.dc.html': 'After postpone', 'AllDone.dc.html': 'All done', 'SettingsRest.dc.html': 'Settings · rest timer' }
const focusCanvas = {
  artboards: Object.keys(focusFiles).map((file, i) => ({ file, x: i * (W + GX), y: 0, w: W, h: H, title: focusTitles[file] })),
  annotations: [
    { id: 'focus-brief', x: 0, y: -170, w: 640, text: 'Session focus (v1.2): only the current exercise is on screen. A 4 px strip under the header shows where you are; "Lineup" opens the full order as a sheet (tap to jump). "postpone" in the card footer moves the current exercise one place back — 1·2·3·4·5 with 3 postponed becomes 1·2·4·3·5, so it comes back after the next one and can be postponed again if the machine is still busy. Rest: the 2 px line under the header fills while resting; at zero the pill turns green and the phone beeps + buzzes (audio session set to playback so iPhone silent mode does not mute it; only while the app is open — iOS gives web apps no background timers). Duration + ping live in Settings.' },
  ],
  launch: { view: 'canvas' },
}
writeFileSync(join(here, 'focus', 'canvas.json'), JSON.stringify(focusCanvas, null, 2))
console.log('wrote', Object.keys(focusFiles).length, 'focus artboards + focus/canvas.json')

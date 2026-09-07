# LiftLoop — design spec (v1)

Date: 2026-09-07. Status: approved design, pre-implementation.

This document is the source of truth for LiftLoop. It consolidates the original build brief with every clarification agreed on 2026-09-07 (see §16). Where this spec and the brief differ, this spec wins.

## 1. Purpose and constraints

LiftLoop is a personal, single-user, mobile-first web app for logging gym workouts against a fixed six-template training loop. The owner trains 4–6 days a week on a program their coach revises every two weeks from the logged data.

The core design goal: **in the gym the user should not have to think.** No mental math, no comparing numbers, no remembering rules. The app shows one goal per exercise, the user does the set and taps once. History, comparisons, progression, phases and reports happen behind that.

Hard constraints:

- Single user. Private data, public code. Free to run (Vercel Hobby + Neon Free). No monetisation, multi-user, social features or notifications, ever.
- Anyone else who wants it (e.g. a family member on Android) forks the repo and deploys their own instance with their own passcode and database. The README carries a "deploy your own" section for this.
- Never lose a logged set. Data safety beats features.
- Prefer boring, well-known libraries. Small bundle, few dependencies.
- Tests for all pure logic (parser/serializer, loop, phase calculator, goal engine, verdicts, PRs, weekly sets, sleep gate, report generator). UI tests optional.
- Timezone for all "today"/"this week" logic: `Asia/Kolkata`. Never rely on server local time.

## 2. The training system

### 2.1 The loop

Six templates in a fixed cycle, independent of the calendar:

`Push A → Pull A → Legs A → Push B → Pull B → Legs B → (back to Push A)`

- The program has an ordered template list and a `next_index` pointer.
- Missing a day skips nothing; the pointer waits.
- Finishing a `normal` or `short` session sets `next_index = (index of finished template + 1) % 6`.
- `walk` sessions never touch the pointer.
- Starting a non-next template asks "advance the loop as if this was the next one?" (default yes). Yes → same rule as above on finish; no → pointer unchanged (`session.advanced_loop = false`).

### 2.2 Phases (program start 2026-09-07, a Monday)

Weeks are Monday–Sunday in `Asia/Kolkata`. Week 1 starts on the program start date's Monday.

| Phase | Weeks | Target days/week | Sets rule | Effort rule (RIR) | Load |
|---|---|---|---|---|---|
| Ramp | 1–2 | 4 | 2 sets on every exercise | 4 RIR | last load |
| Build 1 | 3–6 | 5 (6 if the sleep gate is open, §7.9) | as written | 2–3 RIR | progression |
| Easy | 7 | 4 | 2 sets | 4 RIR | last load × 0.8 |
| Build 2 | 8+ | 5 (6 if the sleep gate is open) | as written | 1–3 RIR | progression |

- After week 8, every 6th week is an easy week: weeks 13, 19, 25, … (i.e. `week ≥ 8 && (week − 7) % 6 === 0`). That is 5 build weeks + 1 easy week per cycle.
- The user can start an easy week manually at any time and end it early. Manual easy weeks are stored as `program.easy_week_overrides: [{from, to}]` (IST dates, inclusive). A date inside an override is an Easy phase regardless of the schedule. "End early" sets `to` to yesterday.
- Dates before the start date are treated as Ramp week 1.
- Week dots on Home always use the base target (5 in Build phases); the sleep gate only adds a badge.

### 2.3 Rules the app enforces

1. **Double progression.** Each template entry has a rep range `[lo, hi]` and set count `n`. If the last session of that exercise (from ANY template) hit `≥ hi` reps on all `n` sets, the next goal is the next load up; otherwise the next goal is the same load, beat last time's reps. Load stepping is per exercise (§4). Never suggest training to failure.
2. **Shoulder rule.** Post-session check-in records left-shoulder pain 0–10. Three finished sessions in a row with pain > 2 show a persistent banner on Home: "Shoulder > 2 three sessions in a row — tell your coach." It clears when the most recent session is ≤ 2.
3. **Tired rule.** A session can be finished as `short` (first two exercises only). It counts and advances the loop.
4. **Walk day.** A `walk` session (cardio only, minutes + note) is logged but does not advance the loop.
5. **Easy week / Ramp.** The session shows 2 sets per exercise and the goal is "match, stop with 4 left". No "beat" language, no ↑/↓ marks, verdict is always `done`.
6. **No-change rule.** Program edits are rare. Editing (v1.1) must never rewrite or lose history: template entries reference exercises by id; sessions snapshot the goal they showed.

## 3. The shorthand (import/export format, and fallback entry)

Example (real notes data; stacks are kg, free weights lb):

```
Barbell RDL 8-10 x 3
25.10.10.10
50.8.8.8

Machine Chest Press 8-12 x 3
25.12.12.12
27.12.9.8

Machine Chest-Supported Row 10-12 x 3
60.12.12.12
62.10.9.10

Lying Leg Curl 10-15 x 2
35.15.15
40.15.13

Reverse pec deck 15-20 x 2
20.18.17
20.20.20

External Rotation (L arm first) 15 x 2
5.11.11
5.10.7

Standing bw Calf Raise failure x 2
.f.f
```

Grammar:

- Header line: `<exercise name> <lo>-<hi> x <sets>`, or `<reps> x <sets>` (lo = hi), or `failure x <sets>`. An optional `/arm` or `/leg` after the reps marks a unilateral entry (`8-12/arm x 3`). Exercise name resolves by exact name, then alias, case-insensitive, whitespace-collapsed.
- Each following non-empty line is **one session** for that exercise: `<load>.<reps>.<reps>…` — first number is the load, every later number is one set's reps. `27.12.9.8` = load 27, sets 12, 9, 8.
- Load meaning depends on the exercise's `loadType` (§4). The unit is the exercise's unit; it is never written in the shorthand.
- `bw` is accepted as load `0` for bodyweight exercises. A missing load (`.f.f`) means `0`.
- Negative loads are accepted (assistance) for compatibility; in-app assisted work uses the Assisted Pull-Up Machine exercise instead.
- `f` = set taken to failure, reps not counted (`reps = null, to_failure = true`). The UI nudges to count reps.
- Load change mid-exercise: space-separated blocks, `25.12.12 27.10`.
- Fractional loads use a comma as the decimal mark (`12,5.10.10` = 12.5) because the dot is the separator.
- Parser is strict about structure, lenient about whitespace (tabs/multiple spaces collapse; trailing whitespace ignored; blank lines separate exercises).
- **Round-trip must be exact**: `serialize(parse(text)) === normalize(text)` for every example above, and any logged session serializes back into this format. It is the coach-export format (§8) and the notes-import format.

In the session UI the shorthand is a fallback behind a "type it instead" toggle on each card (§6.3). The primary UI is goal-first tapping.

## 4. Units, load types and the gym config

The gym is hybrid: free weights in lb, every machine/cable stack in kg.

| loadType | Meaning of `load` | Unit | Stepping |
|---|---|---|---|
| `stack` | the number on a machine/cable stack | kg | `increment` (default 5 kg); odd values like 27 or 62 accepted (add-on weights) |
| `per_side` | plate weight on EACH side of a bar/sled; total = `bar_weight + 2 × load` (bar_weight null → `2 × load`) | lb | `increment` per exercise |
| `dumbbell` | weight of one dumbbell | lb | next/previous entry in the dumbbell rack |
| `bodyweight` | `0` = bodyweight; positive = added weight (a dumbbell held); negative = assistance | lb | dumbbell rack for added weight |

Exceptions carried in seed data, not in code: the Half-Kneeling Landmine Press is `stack` with unit `lb` (load = plates on the sleeve, bar ignored).

Progression direction is per exercise: `progression = 'load_up'` (default) or `'assist_down'` (Assisted Pull-Up Machine: lower load is better).

Gym config (one row, `gym_config`), seeded and editable in Settings (Phase 2):

- `plates_lb`: `[2.5, 5, 10, 22, 25, 35, 45]` (informational; used by the per-side plate hint in v1.1)
- `dumbbell_rack_lb`: `[2.5, 5, 7, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 60]`; above the last entry, steps of 5 lb
- `stack_step_kg`: `5`

Rack stepping (`lib/domain/rack.ts`):

- `nextRack(load, rack)`: smallest rack entry `> load`; if none, `load + 5`.
- `prevRack(load, rack)`: largest rack entry `< load`; if none (load ≤ min), `null`; if `load > max`, `load − 5` (e.g. 62 → 60 is fine because 60 is the largest entry < 62).
- `roundDownToRack(load, rack)`: largest entry `≤ load`, else `null`.

Loads are stored exactly as typed, with their unit (`set_log.unit`). Every weight chip shows its unit (`27 kg`, `25 lb`, `BW`, `BW +10 lb`, `20 kg assist`). Nothing is ever silently converted.

## 5. Scope

### v1 (must ship, in this order)

1. Repo + auth (single passcode) + DB + seed of the program (§13).
2. Home: what's next in the loop, phase status, this week's sessions vs target, one big Start button, daily sleep toggle + body-weight quick entry.
3. Session logging (goal-first, §6.3): one goal line per exercise, pre-filled set rows, one-tap ✓ per set, inline adjust, rest timer, superset grouping, swap, short session, finish → check-in (sleep good/bad, shoulder 0–10, elbow 0–10, minutes auto, note) → loop advances → summary.
4. History: calendar + list, session detail (rendered as shorthand + table), edit/delete sets.
5. Body: weight (kg, 1 decimal) with 7-day rolling average, waist (cm), sleep good/bad, cardio note per day (type + minutes), optional "protein ≥ 140 g" yes/no.
6. Coach export (markdown, copy + Web Share API) and full JSON export/import (backup/restore).
7. Import from notes text: paste shorthand blocks, assign a date → creates sessions (backfills the last two sessions per exercise).
8. PWA: manifest, installable, standalone, dark theme, keep screen awake during a session (Wake Lock API), rest-timer vibration (Android) + beep (all).

### v1.1 (after v1 is deployed and used for a week)

- Progress screens: per-exercise chart (load and e1RM over time, volume), weekly hard sets per muscle vs target, adherence heatmap.
- In-app program editor (templates, exercises, swaps, gym config). Until then the program lives in a versioned seed with an idempotent "re-seed program (keeps history)" script.
- Offline mode (service-worker cache of the session screen). v1 already must not lose sets on flaky network (§10).
- Optional read-only export endpoint `GET /api/coach-export?token=<long-secret>&days=14`.

### Non-goals

Multi-user, social, nutrition tracking beyond the protein yes/no, AI features inside the app, native apps, notifications/reminders, cardio programming.

## 6. Screens and UX (mobile-first, one thumb)

Global: dark theme by default (gym lighting), high contrast, ≥ 44 px tap targets, `inputmode="decimal"` keypads, no modals in the logging flow (bottom sheets only), undo toast on every destructive or accidental action, bottom tab bar Home · History · Body · More (Body tab lands in Phase 2). Desktop is a responsive wider layout of the same screens. All colours come from theme tokens.

### 6.1 Login

Passcode field only. Wrong passcode → inline error. After 5 failures in 15 minutes → "Too many attempts, try again in N min".

### 6.2 Home

- "Next: Legs A" + big Start button. If a session is in progress: "Resume Legs A · started 12 min ago" replaces Start; a secondary "Discard" (soft-deletes, undo toast).
- Phase card: phase name, week number, target days/week, one-line sets/effort rule, easy-week dates (next scheduled easy week; or "Easy week until <date>" during a manual one). "6th day OK this week" badge when the sleep gate is open (§7.9) in a Build phase.
- This week: dots = finished `normal`/`short` sessions vs target (Mon–Sun IST). Walk days shown as a footnote ("+1 walk").
- Shoulder banner when the shoulder rule fires (§2.3).
- "14 days since last coach export" nudge at 14+ days (from `export_log`); "never exported" after 14 days of data.
- Quick entry row for today: body weight (kg, 1 decimal) and a sleep toggle (good / bad). Both upsert today's `body_metric`.
- "…" menu: start a different template (asks about advancing the loop), log a walk day, start easy week now / end easy week.

### 6.3 Session — goal-first logging (the heart of the app)

Sticky header: template name, elapsed time, rest timer, "n unsaved" pill when the write queue is non-empty. Exercise cards in template order; superset partners grouped with a "then" connector. One card open at a time; others collapsed to one line.

Open card layout:

```
┌────────────────────────────────────────────┐
│ Machine Chest Press                8–12 × 3│
│                                            │
│ Beat 27 kg × 12 · 9 · 8                    │  ← the ONE goal line, large type
│                                            │
│  Set 1   [ 27 kg ]   [ 12 ]      ( ✓ )     │  ← chips pre-filled from the goal
│  Set 2   [ 27 kg ]   [ 10 ]      ( ✓ )     │
│  Set 3   [ 27 kg ]   [  9 ]      ( ✓ )     │
│           last 27      last 9              │  ← faint ghost text under chips
│                                            │
│  type it instead · swap · note             │
└────────────────────────────────────────────┘
```

Rules:

- **✓ = "I did exactly what the chips say."** One tap per set. That is the default action.
- Reps chip pre-fill per mode (§7.4). Ghost text under each chip shows last time's number.
- Tap a reps chip → inline −/+ stepper (big buttons) right there; long-press → numeric keypad sheet. Tap the weight chip → −/+ by the exercise's stepping rule (§4); long-press → keypad accepting any value. A weight change on a set cascades to the remaining unlogged sets.
- After ✓ the row becomes a compact logged row `27 kg × 10` with a small mark: ↑ above goal reps, = matched, ↓ under (none in easy mode). Tap the row to edit. Undo toast for 5 s. Rest timer auto-starts (exercise `rest_seconds`; seed: 120 s for the first exercise of a template, 90 s otherwise). Timer runs off an end timestamp so it survives backgrounding; vibrate (where available) + WebAudio beep at 0.
- When all sets are logged the card collapses to one line with the verdict and what happens next, e.g. `27 kg × 12·10·9 — beat it · same weight next time` or `27 kg × 12·12·12 — beat it · next time: 32 kg`. The next card opens automatically.
- Bodyweight exercises: weight chip shows `BW`, `BW +10 lb`, or `−20 lb` (assist). Assisted Pull-Up Machine: `20 kg assist`. Unilateral: reps chip reads `12/arm` or `12/leg`.
- "type it instead" reveals a one-line shorthand box for this exercise (§3); Enter logs all sets at once (replacing any already-logged sets, with undo).
- Swap: picks from the exercise's swap list; the card re-computes its goal for the swapped exercise and records `swapped_from_exercise_id`.
- Note: free text per exercise. Optional warm-up checklist at the top (shown, not logged).
- Pull-up cards surface the special rules (§13).
- "Finish as short session" available from the first card. Finish → check-in sheet (sleep prefilled from today's `body_metric`, shoulder 0–10, elbow 0–10, minutes auto, note) → save → summary (sets, PRs, session shorthand, "Next: Push B").
- Finish is disabled while the write queue is non-empty ("saving 2 sets…").

Nothing else on this screen. No "best", no e1RM, no charts, no history list.

### 6.4 Exercise detail

History (each session as one shorthand line with date + template), best set, chart (v1.1), settings (unit, load type, bar weight, increment/stepping, rest, default rep range, muscles, aliases, swaps, progression).

### 6.5 History

Month calendar (dot per session, coloured by push/pull/legs/walk) + list; tap → session detail (shorthand + table) with edit/delete sets (undo toast) and delete session (soft).

### 6.6 Body

Weight entry + 7-day average line; waist; sleep good/bad; cardio notes; protein yes/no. One row per IST date.

### 6.7 More

Coach export (range picker, preview, Copy, Share), JSON export/import, Import from notes text, Program (view templates; edit in v1.1), Settings (rest defaults, gym config), About.

## 7. Business logic (pure, tested functions in `src/lib/domain/`)

All functions are pure, take plain objects, and have Vitest coverage.

### 7.1 Shorthand parser / serializer (`shorthand.ts`)

- `parseNotes(text, exercises) → { blocks: ParsedExerciseBlock[], errors: ParseError[] }` where a block is `{ exerciseId | unresolvedName, lo, hi, sets, unilateral, sessions: ParsedSession[] }` and a session is `{ segments: [{ load: number, sets: [{ reps: number | null, toFailure: boolean }] }] }`.
- `parseExerciseLine(line) → { segments, errors }` for the in-card "type it instead" box.
- `serializeExercise(header, sessions)` and `serializeSession(session)` produce exactly the §3 format (comma decimals, `.f` for failure sets, `bw`→`0` written as `0`; a session whose every set is failure with load 0 serializes as `.f.f`, matching the notes).
- Errors carry line numbers and a message; nothing is guessed.

### 7.2 Loop pointer (`loop.ts`)

`advanceLoop(program, finishedTemplateIndex) → nextIndex`. `sessionAdvances(type, advancedLoopFlag) → boolean`.

### 7.3 Phase calculator (`phase.ts`)

`getPhase(dateIST, program) → { name: 'Ramp' | 'Build 1' | 'Easy' | 'Build 2', week, targetDays, setsRule, rirRule, isEasyWeek, loadMultiplier: 1 | 0.8, setsOverride: 2 | null, weekStart, weekEnd, source: 'schedule' | 'manual' }` implementing §2.2 including manual overrides. `nextEasyWeek(dateIST, program) → { from, to }`.

### 7.4 Goal engine (`goal.ts`)

```
getGoal({ exercise, entry: { sets, lo, hi }, last: LastExerciseSession | null, phase, gym })
  → { mode, load, unit, sets, repsPerSet, prefillRepsPerSet, line, ghost, nextLoad }
```

`last` is the most recent finished `session_exercise` of this exercise from ANY template, with its set logs.

Goal load from `last`: the best load used in that session (`load_up`: highest; `assist_down`: lowest). Goal reps = reps of the sets at that load, in order; if fewer than `sets`, the remaining sets repeat the last of those reps. Sets with `reps = null` (failure) display as `f`, prefill `hi`, and are excluded from the "all sets ≥ hi" test; if no counted sets exist, the test is false.

Modes and the exact `line` copy:

- `first_time` — no history: `"First time — pick a weight you can do {hi} with 4 left"`. Weight chip empty (tap to set), reps prefilled `hi`. In Ramp/Easy, sets = 2.
- `beat` — normal weeks, last session did NOT hit `hi` on all sets: `"Beat {load} {unit} × {r1} · {r2} · {r3}"`. Prefill `min(r_i + 1, hi)`. Assist: `"Beat 20 kg assist × 8 · 7 · 6"`.
- `new_weight` — last session hit `≥ hi` on all `sets` counted sets: `"New weight {nextLoad} {unit} × {lo}+ each set"`. Prefill `lo`. Assist: `"Less assist: {nextLoad} kg assist × {lo}+ each set"`; when `nextLoad` would be 0: `"Try Pull-Ups — no assist"`.
- `easy` — Ramp weeks or easy week (and history exists): `"Easy day — {load} {unit} × {r1} · {r2}, stop with 4 left"`. Sets = 2. Load = last load (Ramp) or last load × 0.8 rounded to the exercise's step (Easy week; stack → nearest 5 kg, per_side → nearest increment, dumbbell/bodyweight-added → `roundDownToRack`, assist → × 1.2 rounded up to 5 kg). Prefill = goal reps. No ↑/↓ marks; verdict `done`.
- If the entry's set count differs from last session, the goal uses the current set count (extra sets repeat the last set's reps).

`nextLoad` by stepping: stack/per_side → `load + increment`; dumbbell/bodyweight → `nextRack(load)`; assist_down → `max(load − increment, 0)`. Bodyweight negative loads progress toward 0 by `increment`.

### 7.5 Verdicts (`verdict.ts`)

`getVerdict(goal, loggedSets, exercise) → { verdict: 'beat' | 'matched' | 'under' | 'done', mark: ('up' | 'eq' | 'down' | null)[], nextNote, allHitHi }`

- `done` for easy mode. `nextNote`: `"back to normal next week"` if next week is not easy, else `"easy week continues"`.
- Otherwise `goalTotal = Σ goal.repsPerSet` (first_time: `hi × sets`, goal load = load of the first logged set). `beat`: total reps at the goal load > goalTotal, or any set at a better load (higher for `load_up`, lower for `assist_down`). `matched`: equal. `under`: less.
- `nextNote`: all counted logged sets ≥ `hi` and count ≥ `sets` → `"next time: {nextLoad} {unit}"` (assist: `"next time: {load − 5} kg assist"`; if `load ≤ 10` for an assist exercise: `"next time: try Pull-Ups"`), else `"same weight next time"` (assist: `"same assist next time"`).

### 7.6 PRs (`prs.ts`)

Per exercise: best load at any reps, best reps at the current load, best estimated 1RM (Epley `total × (1 + reps/30)`). `total` = `bar_weight + 2 × load` for `per_side`; body weight (kg × 2.20462 → lb) + added lb for `bodyweight` when a body weight exists in that IST week, else skip; `load` otherwise; skipped for `assist_down`. A "PR" badge shows on the logged row and in the session summary only, never in the goal line.

### 7.7 Weekly hard sets per muscle (`weekly-sets.ts`)

Each exercise maps to muscle groups with fractional credit (§13). Weekly sets = Σ over finished sessions in the week (Mon–Sun IST) of logged sets × credit. Targets: chest 8–12, back 10–14, side_delts 6–8, rear_delts_cuff 6–9, quads 8–10, hamstrings 6–8, glutes 6–10, biceps 5–8, triceps 4–8, calves 4–6, abs 3–6, front_delts no target.

### 7.8 Shoulder rule (`flags.ts`)

`shoulderFlag(lastSessions) → boolean`: the three most recent finished non-walk sessions all have `shoulder_pain > 2`. Same for elbow (`elbowFlag`), used only in the report.

### 7.9 Sleep gate (`sleep.ts`)

`sixthDayOk(bodyMetricsLast7Days) → boolean`: at least 5 of the 7 IST dates ending today have `sleep_good = true`. Shown as a badge in Build phases only. The session check-in prefills sleep from today's `body_metric.sleep_good`; saving the check-in writes both `session.sleep_good` and today's `body_metric.sleep_good`.

### 7.10 Time helpers (`time.ts`)

`todayIST()`, `istDate(instant)`, `weekBoundsIST(date)`, `programWeek(date, startDate)`. Implemented with `date-fns` v4 + `@date-fns/tz`.

## 8. Coach export — exact format

`generateCoachReport({ from, to }, data) → string` (markdown). Default range: last 14 days ending today. Dense, plain markdown, no HTML.

```
# LiftLoop report — 2026-09-07 → 2026-09-20 (Rahul)

## Summary
- Phase: Ramp (weeks 1–2). Target 4 days/week. Sessions: 8/8 (W1: 4, W2: 4). Short sessions: 1. Walk days: 1.
- Loop next: Legs A
- Units: stacks kg, free weights lb, body weight kg
- Sleep: good nights 10/14 (2 unrecorded)
- Shoulder (0–10): avg 0.8, max 2 (2026-09-15, Push B)
- Elbow (0–10): avg 0, max 0
- Body weight: 7-day avg 73.4 → 73.6 kg (+0.2). Waist: 84.0 cm (2026-09-07)
- Protein ≥140 g: 9/14 days
- Verdicts: beat 14 · matched 6 · under 2 · easy 20
- PRs: Pull-Ups BW × 9 (2026-09-18), Leg Press 180 lb/side × 15 (2026-09-16)
- Flags: none

## Sessions
### 2026-09-07 Mon — Push A — 41 min — sleep: good — shoulder: 0 — elbow: 0
Machine Chest Press 8-12 x 2
25.12.12
Half-Kneeling Landmine Press 8-12/arm x 2
10.10.10
…
Note: felt easy, as planned.

### 2026-09-13 Sat — Walk — 22 min
(cardio only, loop not advanced)

## Exercise progression (first → last in range, best, verdicts)
| Exercise | Sessions | First | Last | Best set | Verdicts |
|---|---|---|---|---|---|
| Machine Chest Press | 3 | 25 kg × 12/12 | 27 kg × 12/12/11 | 27 kg × 12 | beat, beat, matched |
| Pull-Ups | 3 | BW × 6/5/5 | BW × 8/7/6 | BW × 8 | beat, beat, beat |
…

## Weekly hard sets per muscle
| Muscle | W1 | W2 | Target |
|---|---|---|---|
| Chest | 6 | 8 | 8–12 |
…

## Body
| Date | Weight kg | 7d avg | Waist cm | Sleep | Cardio | Protein |
…

## Notes
- 2026-09-15 Push B: overhead triceps pinched at set 2, swapped to rope pushdown.
```

Details:

- Sessions x/y: x = finished `normal` + `short` sessions in range; y = Σ target days of each program week intersecting the range. `W1: 4` labels use program week numbers.
- Sleep counts every IST date in range with `body_metric.sleep_good = true`; the denominator is the number of days in range; unrecorded days are called out.
- Short sessions render as `— Push A (short)`. A swapped exercise renders under its actual name with `(swapped from Machine Chest Press)` on the header line. Session blocks are pure §3 shorthand so they re-import.
- Flags: `shoulder > 2 on 3 sessions in a row`, `elbow sore` (same rule on elbow), `< 3 sessions in week X`, `no export for 21+ days`. `none` when empty.
- Muscles in the fixed order Chest, Back, Side delts, Rear delts/cuff, Quads, Hamstrings, Glutes, Biceps, Triceps, Calves, Abs, Front delts (target `—`).
- Notes section: session notes and per-exercise notes, one bullet each, dated with the template.
- Every export writes an `export_log` row. The generator is covered by a golden-file test.

## 9. Data model (Postgres, Drizzle)

- `exercise` — id, name (unique), aliases text[], load_type (`per_side | stack | dumbbell | bodyweight`), unit (`lb | kg`), bar_weight numeric nullable, increment numeric nullable (null → rack stepping), progression (`load_up | assist_down`), default_lo, default_hi, default_sets, rest_seconds, unilateral bool, muscles jsonb `[{group, credit}]`, swap_ids uuid[], cue text nullable, notes text nullable, archived bool, created_at.
- `gym_config` — id, plates_lb jsonb, dumbbell_rack_lb jsonb, stack_step_kg numeric, updated_at. Single row.
- `program` — id, name, version, start_date (IST date), next_index, easy_week_overrides jsonb `[{from, to}]`, created_at.
- `template` — id, program_id, name, kind (`push | pull | legs`), order_index, notes.
- `template_exercise` — id, template_id, exercise_id, order_index, sets, lo, hi, superset_group smallint nullable, notes.
- `session` — id, date (IST date string), started_at, finished_at nullable (null = in progress), template_id nullable, type (`normal | short | walk`), duration_min nullable, sleep_good bool nullable, shoulder_pain smallint nullable, elbow_pain smallint nullable, advanced_loop bool, note, deleted_at nullable, created_at.
- `session_exercise` — id, session_id, exercise_id, template_exercise_id nullable, order_index, goal jsonb (the §7.4 goal as shown), verdict (`beat | matched | under | done`) nullable, next_note text nullable, swapped_from_exercise_id nullable, note, created_at.
- `set_log` — id, client_id text unique (idempotency key from the client), session_exercise_id, set_index, load numeric nullable, reps smallint nullable, to_failure bool, unit (`lb | kg`), is_pr bool, deleted_at nullable, created_at, updated_at.
- `body_metric` — id, date (IST date, unique), weight_kg numeric nullable, waist_cm numeric nullable, sleep_good bool nullable, protein_hit bool nullable, cardio_type text nullable, cardio_min smallint nullable, note.
- `export_log` — id, from_date, to_date, created_at.
- `login_attempt` — id, attempted_at, success bool, ip text nullable.

Timestamps in UTC (`timestamptz`); logical dates as IST date strings (`date` column). Indexes: `session_exercise(exercise_id, created_at)`, `set_log(session_exercise_id)`, `session(date)`, `body_metric(date)`, `login_attempt(attempted_at)`.

## 10. Tech stack and architecture

- **Next.js App Router + TypeScript strict + Tailwind + shadcn/ui**, pnpm. Versions resolve under the machine's npm `before=2026-05-06` pin (do not remove it). Server Components for reads, Server Actions for writes (Zod-validated), Route Handlers for login and exports.
- **Database: Neon Postgres Free** (verified 2026-09-07: 0.5 GB, 100 CU-hours/month, scale-to-zero after 5 min idle, no forced pause). Provisioned through the Vercel Marketplace so `DATABASE_URL` (pooled) lands in Vercel automatically. Drizzle ORM over `@neondatabase/serverless`; migrations in `drizzle/` via `drizzle-kit`. The integration sets `DATABASE_URL` (pooled, used by the app) and `DATABASE_URL_UNPOOLED` (direct, used by migrations when present). Migrations and the idempotent seed run at deploy time through `vercel.json` → `"buildCommand": "pnpm build:vercel"` (`db:migrate && db:seed && next build`) so a fresh deploy is complete without manual steps; plain `pnpm build` stays a pure `next build`.
- **Auth:** single passcode from `APP_PASSCODE`, compared with a timing-safe equality. On success set an httpOnly, secure (in production), sameSite=lax cookie `ll_session` holding an HS256 JWT (`jose`) signed with `SESSION_SECRET`, valid 90 days. The Next 16 request proxy (`src/proxy.ts`, the renamed middleware) protects everything except `/login`, `/api/login`, the manifest, icons, `sw.js`, `_next` assets, and the optional token export route. Login is rate-limited to 5 failed attempts per 15 minutes, counted in `login_attempt` (serverless instances share no memory).
- **Validation:** Zod at every boundary. **Charts:** Recharts (v1.1). **PWA:** `manifest.webmanifest` + icons + a hand-written minimal service worker (no Serwist in v1); Wake Lock API during sessions (re-requested on `visibilitychange`); `navigator.vibrate` where available, WebAudio beep everywhere.
- **Time:** `date-fns` v4 + `@date-fns/tz`; every date computation takes `Asia/Kolkata` explicitly. `TZ=Asia/Kolkata` is also set in the environment as a belt-and-braces measure.
- **Tests:** Vitest for every §7 module and the §8 golden file. Browser verification via headless Chrome screenshots (dark theme, 390 and 1440 wide) before each phase handover.
- **Layout:**

```
src/app/(auth)/login            login page + /api/login route
src/app/(app)/                  authed shell with tab bar: page (Home), session/[id], history, history/[id], exercise/[id], body, more/*
src/actions/                    server actions (zod-validated)
src/db/schema.ts, client.ts     Drizzle
src/db/seed/program-v2.ts       versioned program seed (§13); src/db/seed.ts idempotent runner
src/lib/domain/                 pure logic (§7) + tests
src/lib/queue/                  client write queue (§10)
src/components/                 UI
drizzle/                        migrations
docs/superpowers/               specs and plans
```

## 11. Data safety

- A session row is created in the DB the moment Start is tapped. Every ✓, edit and delete is a server action carrying a client-generated `client_id`; the server upserts on `client_id`, so retries are idempotent.
- The UI updates optimistically. A failed or offline write is appended to a localStorage queue (`liftloop.queue.v1`) and retried in order on `online`, on app focus, and every 10 s while non-empty. The sticky header shows an "n unsaved" pill; Finish is disabled until the queue drains.
- Reload, phone lock or tab death resumes the in-progress session from the DB (plus any queued writes). Home offers Resume.
- Soft deletes on `session` and `set_log`; undo toasts restore.
- JSON export is a full dump of every table; JSON import restores into an empty database (refuses otherwise).

## 12. Source control, hosting, secrets

- **GitHub:** public repo `git@github.com:RahulSomaliya/liftloop.git`, branch `main`. Commit early and often with conventional messages; push after every meaningful step and at the end of every phase. Never bypass hooks.
- **Vercel:** Git integration, Hobby plan. Every push to `main` is a production deploy. Env vars set in the Vercel dashboard: `APP_PASSCODE`, `SESSION_SECRET` (`openssl rand -base64 32`), `TZ=Asia/Kolkata`, optional `COACH_EXPORT_TOKEN`; `DATABASE_URL` and `DATABASE_URL_UNPOOLED` come from the Neon integration.
- **Public code, private data:** `.gitignore` excludes `.env*` (except `.env.example`), `exports/`, `*.dump.json`, DB dumps. No personal data in the repo; the program seed is fine to be public. MIT `LICENSE`. README explains single-user + passcode, env vars, Neon setup, migrations, seeding, local dev, and "deploy your own".

## 13. Seed data — program v2 (2026-09-07)

Rest: 120 s for the first exercise of a template, 90 s otherwise. `(+)` marks a superset with the previous exercise.

### Gym config

`plates_lb = [2.5, 5, 10, 22, 25, 35, 45]`, `dumbbell_rack_lb = [2.5, 5, 7, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 60]` (then 5-lb steps), `stack_step_kg = 5`.

### Exercise library

| Exercise | loadType | unit | stepping | unilateral | progression | muscles (credit) | swaps / aliases / notes |
|---|---|---|---|---|---|---|---|
| Machine Chest Press | stack | kg | +5 | no | load_up | chest 1, triceps 0.5, front_delts 0.5 | swap: Pec Fly Machine |
| Half-Kneeling Landmine Press | stack | lb | +5 | yes | load_up | chest 0.5, front_delts 0.5, triceps 0.25 | load = plates on the sleeve, bar ignored; swap: Low-Incline DB Press; alias "Landmine Press" |
| Pec Fly Machine | stack | kg | +5 | no | load_up | chest 1 | alias "Pec Deck" |
| Low-Incline DB Press (15-30°) | dumbbell | lb | rack | no | load_up | chest 1, front_delts 0.5, triceps 0.5 | swap: Machine Chest Press |
| Cable Lateral Raise | stack | kg | +5 | yes | load_up | side_delts 1 | alias "Lateral Raise" |
| Single-Arm Cable Overhead Triceps (rope) | stack | kg | +5 | yes | load_up | triceps 1 | swap: Cable Tricep Pushdown (rope) |
| Cable Tricep Pushdown (rope) | stack | kg | +5 | no | load_up | triceps 1 | — |
| Sidelying DB External Rotation | dumbbell | lb | rack | yes | load_up | rear_delts_cuff 1 | alias "External Rotation (L arm first)" |
| Pull-Ups (overhand, shoulder-width) | bodyweight | lb (added) | rack | no | load_up | back 1, biceps 0.5 | swaps: Assisted Pull-Up Machine, Lat Pulldown (Front, Medium Grip); alias "Pull ups" |
| Pull-Ups (neutral grip) | bodyweight | lb (added) | rack | no | load_up | back 1, biceps 0.5 | swaps: Assisted Pull-Up Machine, Lat Pulldown (Neutral Grip) |
| Assisted Pull-Up Machine | stack | kg | −5 | no | assist_down | back 1, biceps 0.5 | load = assist; at 10 reps on all sets with ≤ 10 kg assist → suggest Pull-Ups |
| Lat Pulldown (Front, Medium Grip) | stack | kg | +5 | no | load_up | back 1, biceps 0.5 | alias "2 Grip Lat Pulldown" |
| Lat Pulldown (Neutral Grip) | stack | kg | +5 | no | load_up | back 1, biceps 0.5 | — |
| Machine Chest-Supported Row | stack | kg | +5 | no | load_up | back 1, rear_delts_cuff 0.25, biceps 0.5 | swap: Seated Cable Row (Close Grip); alias "Chest-supported Row" |
| Seated Cable Row (Close Grip) | stack | kg | +5 | no | load_up | back 1, rear_delts_cuff 0.25, biceps 0.5 | — |
| Cable Face Pull | stack | kg | +5 | no | load_up | rear_delts_cuff 1 | — |
| Cable Reverse Fly | stack | kg | +5 | no | load_up | rear_delts_cuff 1 | alias "Reverse pec deck" (same history bucket) |
| Incline DB Curl | dumbbell | lb | rack | no | load_up | biceps 1 | — |
| Hammer Curls | dumbbell | lb | rack | no | load_up | biceps 1 | — |
| Cable Crunch | stack | kg | +5 | no | load_up | abs 1 | alias "Crunch" |
| Leg Press | per_side | lb | +10 | no | load_up | quads 1, glutes 0.5 | plate-loaded; bar_weight null |
| Single-Leg Leg Press | per_side | lb | +5 | yes | load_up | quads 1, glutes 0.5 | swap: Reverse Lunge (DB) |
| Leg Extension | stack | kg | +5 | no | load_up | quads 1 | — |
| Lying Leg Curl | stack | kg | +5 | no | load_up | hamstrings 1 | — |
| Seated Leg Curl | stack | kg | +5 | no | load_up | hamstrings 1 | — |
| Barbell RDL | per_side | lb | +2.5 | no | load_up | hamstrings 1, glutes 0.5, back 0.25 | bar 45 lb; alias "RDL" |
| Seated Calf Raise | stack | kg | +5 | no | load_up | calves 1 | — |
| Standing Calf Raise | stack | kg | +5 | no | load_up | calves 1 | swap: Standing BW Calf Raise |
| Standing BW Calf Raise | bodyweight | lb (added) | rack | no | load_up | calves 1 | alias "Standing bw Calf Raise" |
| Reverse Lunge (DB) | dumbbell | lb | rack | yes | load_up | quads 1, glutes 0.5 | — |

### Templates (loop order)

```
Push A:  Machine Chest Press 8-12 x 3 · Half-Kneeling Landmine Press 8-12/arm x 3 · Pec Fly Machine 10-12 x 2 · Cable Lateral Raise 12-15 x 3 · Single-Arm Cable Overhead Triceps (rope) 12-15 x 2 · (+) Sidelying DB External Rotation 15/arm x 2
Pull A:  Pull-Ups (overhand, shoulder-width) 6-10 x 3 · Machine Chest-Supported Row 10-12 x 3 · Lat Pulldown (Front, Medium Grip) 10-12 x 2 · Cable Face Pull 15-20 x 2 · Incline DB Curl 10-12 x 3 · (+) Cable Crunch 12-15 x 2
Legs A:  Leg Press 10-15 x 3 · Lying Leg Curl 10-15 x 3 · Single-Leg Leg Press 10-12/leg x 2 · Leg Extension 12-15 x 2 · Seated Calf Raise 15-20 x 3
Push B:  Low-Incline DB Press (15-30°) 8-12 x 3 · Pec Fly Machine 10-12 x 3 · Cable Lateral Raise 12-15 x 3 · Single-Arm Cable Overhead Triceps (rope) 12-15 x 3 · (+) Sidelying DB External Rotation 15/arm x 2
Pull B:  Seated Cable Row (Close Grip) 10-12 x 3 · Pull-Ups (neutral grip) 6-10 x 3 · Cable Reverse Fly 15-20 x 2 · Hammer Curls 10-12 x 3 · Cable Lateral Raise 12-15 x 2
Legs B:  Barbell RDL 8-10 x 3 · Leg Press 12-15 x 2 · Seated Leg Curl 10-15 x 3 · Leg Extension 12-15 x 2 · (+) Cable Crunch 12-15 x 2 · Standing Calf Raise 12-15 x 2
```

### Warm-up checklist (shown, not logged)

Bike/treadmill 2 min · Cable Face Pull very light 15 · Sidelying DB External Rotation lightest DB 12/arm · ramp-up sets of the first exercise at ~50% × 8 and ~75% × 4.

### Pull-up special rules (surfaced in the card)

Target 6–10 reps. < 6 → swap to the Assisted Pull-Up Machine. 10 on all sets → add weight (next dumbbell rack entry, held between the feet). Cue: "Shoulder blades down first. Don't hang loose at the bottom."

## 14. Build phases

1. **Phase 1 — core, pushed and deployed.** Scaffold, repo push, auth, DB + migrations, seed, Home (loop + phase + week dots + sleep/weight quick entry), Session goal-first logging (goal line, chips, ✓, stepper, cascade, rest timer, collapse/verdict, finish check-in, loop advance, write queue), History list + session detail (read-only), Coach export (markdown, copy). Tests green, headless-Chrome QA gallery, push. Hand over the Vercel import steps + env vars. Stop when it's live.
2. **Phase 2.** Body screen, notes-text import, JSON export/import, PWA install + wake lock + vibration, swap, short session, walk day, easy-week override, PR badges, undo toasts, "type it instead", history edit/delete, Share, polish.
3. **Phase 3 (v1.1).** Progress charts, weekly sets per muscle screen, adherence heatmap, program + gym-config editor, service-worker offline, optional token export endpoint.

After each phase: run tests, update README, push, list what changed, wait for feedback.

## 15. Definition of done (v1)

- On the phone, installed as a PWA, a full session can be logged one-handed with one tap per set when the goal is hit, and two taps when it isn't.
- Every exercise card shows exactly one goal line computed across all templates and the current phase.
- Finishing a session advances the loop; short sessions advance, walk days don't.
- The coach export produces the §8 report for any range, copies to clipboard, and shares via the share sheet.
- Full JSON export/import works; notes-text import backfills history.
- Code on GitHub (public, no secrets), deployed on a `*.vercel.app` URL on free tiers only; README covers env vars, Neon setup, migrations, seeding, local dev, deploy-your-own.
- Tests pass; parser/serializer round-trip is exact for every example in §3; goal engine covered for every mode, stepping rule and verdict.

## 16. Decision log (2026-09-07)

Resolutions of brief inconsistencies and open items, all confirmed by the owner:

1. Pull B `Cable Reverse Fly 15-15 x 2` → `15-20 x 2`.
2. `Standing BW Calf Raise` added to the library (bodyweight, lb for added weight); alias "Standing bw Calf Raise" moves to it.
3. The brief's §6.3 collapsed-line example contradicted the §7.4 rule; the rule wins and the example now reads `beat it · same weight next time`.
4. Sleep: recorded daily on Home (`body_metric.sleep_good`), prefilled into the check-in, and used for the 6th-day badge and the report's "good nights x/N over all days". Week dots keep target 5.
5. Easy weeks after week 8: 13, 19, 25, … (5 build + 1 easy).
6. Landmine: load = plates on the sleeve, bar ignored (`stack` semantics, unit lb).
7. Leg Press and Single-Leg Leg Press are `per_side` (plate-loaded). RDL bar 45 lb. Per-side increments: RDL 2.5 lb, Leg Press 10 lb, Single-Leg Leg Press 5 lb.
8. Report title: `# LiftLoop report`.
9. Hybrid gym units: stacks kg (5 kg steps, odd values accepted), free weights lb, dumbbell/bodyweight-added stepping by the rack, body weight kg, waist cm. Gym config table added.
10. Assisted Pull-Up Machine is its own exercise (stack, kg, `assist_down`), a swap for both pull-up variants.
11. Phone: iOS Safari primary (no vibrate → beep); Android supported for a forked deployment.
12. Picks for open items: DB-first in-progress sessions with a localStorage retry queue; `jose` JWT cookie; DB-backed login rate limit; hand-written service worker; `@date-fns/tz`; migrations + seed at Vercel build time.

# LiftLoop — design spec (v1)

Date: 2026-09-07. Status: approved design, revised after adversarial review (rev 2), pre-implementation.

This document is the source of truth for LiftLoop. It consolidates the original build brief with every clarification agreed on 2026-09-07 (§16) and the resolutions of the 47 review findings (§17). Where this spec and the brief differ, this spec wins.

## 1. Purpose and constraints

LiftLoop is a personal, single-user, mobile-first web app for logging gym workouts against a fixed six-template training loop. The owner trains 4–6 days a week on a program their coach revises every two weeks from the logged data.

The core design goal: **in the gym the user should not have to think.** No mental math, no comparing numbers, no remembering rules. The app shows one goal per exercise, the user does the set and taps once. History, comparisons, progression, phases and reports happen behind that.

Hard constraints:

- Single user. Private data, public code. Free to run (Vercel Hobby + Neon Free). No monetisation, multi-user, social features or notifications, ever.
- Anyone else who wants it (e.g. a family member on Android) forks the repo and deploys their own instance with their own passcode and database. The README carries a "deploy your own" section for this.
- Never lose a logged set. Data safety beats features.
- Prefer boring, well-known libraries. Small bundle, few dependencies.
- Tests for all pure logic (§7). UI tests optional.
- Timezone for all "today"/"this week" logic: `Asia/Kolkata`. Never rely on server local time.

## 2. The training system

### 2.1 The loop

Six templates in a fixed cycle, independent of the calendar:

`Push A → Pull A → Legs A → Push B → Pull B → Legs B → (back to Push A)`

- The program has an ordered template list and a `next_index` pointer.
- Missing a day skips nothing; the pointer waits.
- Finishing a `normal` or `short` session with `advanced_loop = true` sets `next_index = (index of finished template + 1) % 6`.
- `walk` sessions never touch the pointer.
- Starting a non-next template asks "advance the loop as if this was the next one?" (default yes). Yes → `advanced_loop = true`, same rule on finish; no → pointer unchanged (`advanced_loop = false`).

### 2.2 Phases (program start 2026-09-07, a Monday)

Weeks are Monday–Sunday in `Asia/Kolkata`. Week 1 starts on the program start date's Monday. `programWeek(date)` is 1-based.

| Phase | Weeks | Target days/week | Sets rule | Effort rule (RIR) | Load |
|---|---|---|---|---|---|
| Ramp | 1–2 | 4 | 2 sets on every exercise | 4 RIR | last load |
| Build 1 | 3–6 | 5 (6 if the sleep gate is open, §7.9) | as written | 2–3 RIR | progression |
| Easy | 7 | 4 | 2 sets | 4 RIR | last working load × 0.8 |
| Build 2 | 8+ | 5 (6 if the sleep gate is open) | as written | 1–3 RIR | progression |

- After week 8, every 6th week is an easy week: weeks 13, 19, 25, … (i.e. `week ≥ 8 && (week − 7) % 6 === 0`). That is 5 build weeks + 1 easy week per cycle.
- The user can start an easy week manually at any time and end it early. Manual easy weeks are stored as `program.easy_week_overrides: [{from, to}]` (IST dates, inclusive). A date inside an override is an Easy phase regardless of the schedule. "End early" sets `to` to yesterday.
- Dates before the start date are treated as Ramp week 1.
- **Per-date vs per-week.** `getPhase(date)` (§7.3) is per date and drives goals and verdicts. Week-granular consumers (Home week dots, report week labels and targets, weekly sets columns, the "next week is easy" note) use `weekPhase(week)` (§7.3): a program week is Easy if ANY of its Mon–Sun dates is Easy (schedule or override), otherwise its phase is `getPhase(<its Monday>)`.
- Week dots always use the base target (5 in Build phases); the sleep gate only adds a badge.

### 2.3 Rules the app enforces

1. **Double progression.** Each template entry has a rep range `[lo, hi]` and set count `n`. If the last working session of that exercise (from ANY template, §7.4) hit `≥ hi` reps on every counted set with at least `n` counted sets, the next goal is the next load up; otherwise the next goal is the same load, beat last time's reps. Load stepping is per exercise (§4). Never suggest training to failure.
2. **Shoulder rule.** Post-session check-in records left-shoulder pain 0–10. Three live finished non-walk sessions in a row with pain > 2 show a persistent banner on Home: "Shoulder > 2 three sessions in a row — tell your coach." It clears when the most recent such session is ≤ 2.
3. **Tired rule.** A session can be finished as `short` (first two exercises only). It counts and advances the loop.
4. **Walk day.** A `walk` session (cardio only, minutes + note) is logged but does not advance the loop.
5. **Easy week / Ramp.** The session shows 2 sets per exercise and the goal is "match, stop with 4 left". No "beat" language, no ↑/↓ marks, verdict is always `done` — for every mode, including `first_time`.
6. **No-change rule.** Program edits are rare. Editing (v1.1) must never rewrite or lose history: template entries reference exercises by id; every `session_exercise` snapshots the effective `sets` (`goal.sets`), the entry's `lo/hi` and the goal it showed.

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

### 3.1 Grammar

- **Header line**, matched right-anchored so exercise names may contain digits and hyphens (`Low-Incline DB Press (15-30°)`):
  `^(.+?)\s+(\d+(?:-\d+)?|failure)(?:/(arm|leg))?\s+x\s+(\d+)$`
  i.e. `<name> <lo>-<hi> x <sets>`, `<name> <reps> x <sets>` (lo = hi), or `<name> failure x <sets>` (no rep target). An optional `/arm` or `/leg` after the reps is the unilateral marker. `<sets>` is the prescription only; it is never validated against the number of rep entries on a session line.
- Exercise name resolves by exact name, then alias, case-insensitive, whitespace-collapsed. An unresolved name is a parse error for import (the importer offers "map to…" or "skip").
- A line matching the header grammar always starts a new exercise block; blank lines are optional separators.
- **Session line**: every other non-empty, non-comment line under a header is one session for that exercise: `<load>.<reps>.<reps>…` — first number is the load, every later number is one set's reps. `27.12.9.8` = load 27, sets 12, 9, 8. Any number ≥ 1 of rep entries is accepted.
- **Comment lines** are ignored by the parser and never emitted by the block serializer: a line whose first non-space character is `#` or `(`, or that starts with `Note:`.
- Load meaning depends on the exercise's `loadType` (§4). The unit is the exercise's unit; it is never written in the shorthand.
- `bw` is accepted as load `0`. A missing load (`.f.f`) means `0`.
- Negative loads are accepted (assistance, import-only for compatibility); in-app assisted work uses the Assisted Pull-Up Machine exercise.
- `f` = set taken to failure, reps not counted (`reps = null, to_failure = true`). The UI nudges to count reps.
- Load change mid-exercise: space-separated segments, `25.12.12 27.10`.
- Fractional loads use a comma as the decimal mark (`12,5.10.10` = 12.5) because the dot is the separator.
- Strict about structure, lenient about whitespace (tabs/multiple spaces collapse; trailing whitespace ignored; CRLF accepted).

### 3.2 Canonical form and round-trip

`normalize(text)` = split on `\r?\n`, trim each line, collapse internal whitespace runs to one space, collapse runs of blank lines to one, drop leading/trailing blank lines, join with `\n`. It rewrites no tokens.

Canonical text is text the serializer would emit: header written exactly as parsed (`rawName`, `<reps>` when lo = hi, `failure` when no target, `/arm|/leg` only when present); loads written with a comma decimal and no trailing zeros; `bw` and a missing load written as `0`, except a session line whose load is 0 and whose every set is a failure set, which is written `.f.f…`; consecutive sets at the same load merged into one segment.

**Round-trip rule:** `serializeBlocks(parseNotes(text).blocks) === normalize(text)` for every canonical input, and every §3 example above is canonical. This is tested per example. Text that is accepted but not canonical (`bw.8.8`, `0.f.f`, `15-15 x 2`) re-serializes to its canonical form.

There are two serialization paths that share one function: from a parsed block (header fields come from the block: `rawName`, `unilateralMarker`) and from the database (header fields come from the exercise: `name`, `unilateral`, and the `session_exercise` snapshot `lo/hi/sets`). The database path is what the coach report and History use; it emits canonical names, so a report re-imported through the parser resolves by name.

In the session UI the shorthand is a fallback behind a "type it instead" toggle on each card (§6.3). The primary UI is goal-first tapping.

## 4. Units, load types and the gym config

The gym is hybrid: free weights in lb, every machine/cable stack in kg.

| loadType | Meaning of `load` | Unit | Stepping |
|---|---|---|---|
| `stack` | the number on a machine/cable stack | kg | `increment` (seed 5 kg); odd values like 27 or 62 accepted (add-on weights) |
| `per_side` | plate weight on EACH side of a bar/sled; total = `bar_weight + 2 × load` (bar_weight null → `2 × load`) | lb | `increment` per exercise |
| `dumbbell` | weight of one dumbbell | lb | dumbbell rack ladder |
| `bodyweight` | `0` = bodyweight; positive = added weight (a dumbbell held); negative = assistance (import-only) | lb | dumbbell rack ladder for added weight; 5 lb steps toward 0 for negative loads |

Exceptions carried in seed data, not in code: the Half-Kneeling Landmine Press is `stack` with unit `lb` (load = plates on the sleeve, bar ignored).

Progression direction is per exercise: `progression = 'load_up'` (default) or `'assist_down'` (Assisted Pull-Up Machine: lower load is better). `increment` is always stored as a positive magnitude; the direction comes from `progression`.

### 4.1 Gym config

One row (`gym_config`), seeded; editable in the v1.1 program editor (§14 Phase 3), view-only in v1 Settings.

- `plates_lb`: `[2.5, 5, 10, 22, 25, 35, 45]` (informational; used by the per-side plate hint in v1.1)
- `dumbbell_rack_lb`: `[2.5, 5, 7, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 60]`
- `stack_step_kg`: `5`

### 4.2 Rack ladder (`lib/domain/rack.ts`)

The ladder is the rack sorted ascending, virtually extended above its last entry in 5 lb steps: `[…, 50, 60, 65, 70, 75, …]` (computed arithmetically, never materialized). Gaps below the max (50 → 60) are real gym data and stay. All three helpers search the ladder:

- `nextRack(load)`: smallest ladder value `> load`.
- `prevRack(load)`: largest ladder value `< load`; `null` when `load ≤ min`.
- `roundDownToRack(load)`: largest ladder value `≤ load`; `null` when `load < min`.

Examples: `nextRack(62) = 65`, `prevRack(62) = 60`, `prevRack(70) = 65`, `nextRack(65) = 70`, `roundDownToRack(56) = 50`, `roundDownToRack(2) = null`.

### 4.3 Load formatting

Loads are stored exactly as typed, with their unit (`set_log.unit`, copied from the exercise at write time). Nothing is ever silently converted. One pure `formatLoad(exercise, load) → string` is used by every goal line, chip, collapsed row, next-time note and report table:

| Case | Output |
|---|---|
| bodyweight, load = 0 | `BW` |
| bodyweight, load > 0 | `BW +10 lb` |
| bodyweight, load < 0 | `−20 lb` |
| assist_down | `20 kg assist` |
| per_side | `180 lb/side` |
| everything else | `27 kg` / `35 lb` |

## 5. Scope

### 5.1 v1 (must ship)

1. Repo + auth (single passcode) + DB + seed of the program (§13).
2. Home: what's next in the loop, phase status, this week's sessions vs target, one big Start button, daily sleep toggle + body-weight quick entry.
3. Session logging (goal-first, §6.3): one goal line per exercise, pre-filled set rows, one-tap ✓ per set, inline adjust, rest timer, superset grouping, swap, short session, finish → check-in (sleep good/bad, shoulder 0–10, elbow 0–10, minutes auto, note) → loop advances → summary.
4. History: calendar + list, session detail (rendered as shorthand + table), edit/delete sets.
5. Body: weight (kg, 1 decimal) with 7-day rolling average (§7.11), waist (cm), sleep good/bad, cardio note per day (type + minutes), optional "protein ≥ 140 g" yes/no.
6. Coach export (markdown, copy + Web Share API) and full JSON export/import (backup/restore, §11.4).
7. Import from notes text (§5.3).
8. PWA: manifest, installable, standalone, dark theme, keep screen awake during a session (Wake Lock API), rest-timer vibration (Android) + beep (all).

Phase assignment is in §14.

### 5.2 v1.1 (after v1 is deployed and used for a week)

- Progress screens: per-exercise chart (load and e1RM over time, volume), weekly hard sets per muscle vs target, adherence heatmap.
- In-app program editor (templates, exercises, swaps, gym config). Until then the program lives in a versioned seed with an idempotent "re-seed program (keeps history)" script (§10.3).
- Offline mode (service-worker cache of the session screen). v1 already must not lose sets on flaky network (§11).
- Optional read-only export endpoint `GET /api/coach-export?token=<long-secret>&days=14`.

### 5.3 Notes-text import (v1, Phase 2)

Paste shorthand blocks (§3), preview, assign dates, save.

- Lines within a block are chronological: the last line is the most recent. Only the last two lines of each block are imported (the brief's "backfill the last two sessions per exercise"); earlier lines are shown greyed out and skipped.
- Dating: the most recent line of every block defaults to the assigned date; the older line defaults to assigned date − 7 days. Every line's date is editable in the preview.
- Saving groups lines by final date: one NEW `session` per distinct date (`source = 'imported'`, `order_index` = the block's order within that date; a date that already has a live session of any kind is a preview error for that date and blocks Save until re-dated; `type = 'normal'`, `template_id = null`, `advanced_loop = false`, `started_at = finished_at = <date> 12:00 IST`, `duration_min` and check-in fields null, `note = 'Imported from notes'`), holding one `session_exercise` per block line assigned to that date (`goal = null`, `verdict = null`, `next_note = null`, `lo/hi/sets` from the header, `template_exercise_id = null`) and its set logs (`unit` from the exercise, `rev = 1`).
- Report re-import: when the paste contains a `## Sessions` heading, the importer feeds the parser only the text from that heading up to the next `## ` heading and discards the rest. A `### YYYY-MM-DD …` line (a comment to the parser, recognised by the importer) sets the default date for the blocks that follow it until the next `###`; if the text after the date names a template, `template_id` is set; walk blocks are skipped. A non-empty, non-comment line before the first header is listed as an error in the preview and skipped.
- Imported sessions are excluded from Home week dots and from the report's session counts, and are eligible as `last` for goals (§7.4), for PRs (§7.6), for exercise history (§6.4) and in the History list (tagged "imported").

### 5.4 Non-goals

Multi-user, social, nutrition tracking beyond the protein yes/no, AI features inside the app, native apps, notifications/reminders, cardio programming.

## 6. Screens and UX (mobile-first, one thumb)

Global: dark theme by default (gym lighting), high contrast, ≥ 44 px tap targets, `inputmode="decimal"` keypads, no modals in the logging flow (bottom sheets only), undo toast on every destructive or accidental action, bottom tab bar Home · History · Body · More (Body tab lands in Phase 2). Desktop is a responsive wider layout of the same screens. All colours come from theme tokens. Every load is rendered through `formatLoad` (§4.3).

### 6.1 Login

Passcode field only. Wrong passcode → inline error. After 5 failures in 15 minutes (global, §10.2) → "Too many attempts, try again in N min".

### 6.2 Home

- "Next: Legs A" + big Start button. If a live session is in progress: "Resume Legs A · started 12 min ago" replaces Start; a secondary "Discard" (soft-deletes, undo toast). Deleting a finished session from History (Edit → Delete session) soft-deletes it too; v1.2: if it advanced the loop and is still the latest session to do so, `next_index` moves back to its template (undo re-advances), so a test workout can be removed without leaving the loop one step ahead.
- Phase card: phase name, week number, target days/week, one-line sets/effort rule, easy-week dates (next scheduled easy week; or "Easy week until <date>" during a manual one). "6th day OK this week" badge when the sleep gate is open (§7.9) in a Build phase.
- This week: dots = live finished `normal`/`short` sessions with `source = 'logged'` this Mon–Sun IST week vs `weekPhase(thisWeek).targetDays`. Walk days shown as a footnote ("+1 walk").
- Shoulder banner when the shoulder rule fires (§2.3).
- Coach-export nudge: "14 days since last coach export" once `max(export_log.created_at)` is 14+ days ago; "never exported" when there is no `export_log` row and `program.start_date` is 14+ days ago.
- Quick entry row for today: body weight (kg, 1 decimal) and a sleep toggle (good / bad). Both upsert today's `body_metric`.
- "…" menu: start a different template (asks about advancing the loop), log a walk day, start easy week now / end easy week.

### 6.3 Session — goal-first logging (the heart of the app)

Sticky header: template name, elapsed time, rest timer, "n unsaved" pill when the write queue is non-empty. Exercise cards in template order; superset partners grouped with a "then" connector. One card open at a time; others collapsed to one line.

Open card layout (the header's `× sets` is `goal.sets`, so a Ramp card reads `8–12 × 2` with two rows):

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
- Weight chips bind to `goal.load` (the weight to lift this session, §7.4); reps chips to `goal.prefillRepsPerSet`. Ghost text under each chip shows last time's number (`goal.ghost`).
- Tap a reps chip → inline −/+ stepper (big buttons) right there; long-press → numeric keypad sheet. Tap the weight chip → −/+ by the exercise's stepping rule (§4); long-press → keypad accepting any value. A weight change on a set cascades to the remaining unlogged sets.
- After ✓ the row becomes a compact logged row `27 kg × 10` with a small mark: ↑ above goal reps, = matched, ↓ under (no marks when `goal.setsOverride === 2`). Tap the row to edit. Undo toast for 5 s. Rest timer auto-starts with `template_exercise.rest_seconds ?? exercise.rest_seconds` (seed: 120 s at `order_index 0`, 90 s otherwise), looked up through `session_exercise.template_exercise_id` so a swap keeps the slot's rest. The timer runs off an end timestamp so it survives backgrounding; vibrate (where available) + WebAudio beep at 0.
- When all sets are logged the card collapses to one line with the verdict and what happens next, e.g. `27 kg × 12·10·9 — beat it · same weight next time` or `27 kg × 12·12·12 — beat it · next time: 32 kg`. The next card opens automatically.
- Chip rendering follows `formatLoad`: `BW`, `BW +10 lb`, `−20 lb`, `20 kg assist`, `180 lb/side`. Unilateral exercises show plain reps (`12`, no `/arm` suffix — dropped in v1.2 for simplicity; `exercise.unilateral` still drives the shorthand header marker).
- "type it instead" reveals a one-line shorthand box for this exercise (§3); Enter logs all sets at once (replacing any already-logged sets, with undo).
- Swap: picks from the exercise's swap list. The card keeps the template entry's `sets/lo/hi` unchanged (`getGoal`'s `entry` never changes on swap); only the exercise identity (unit, loadType, stepping, progression, history) changes. The `session_exercise` row is updated in place (`exercise_id`, `swapped_from_exercise_id`, new goal snapshot); already-logged sets for that slot are deleted with undo.
- Note: free text per exercise. Optional warm-up checklist at the top (shown, not logged).
- Pull-up cards surface the special rules (§13).
- "Finish as short session" available from the first card. Finish → check-in sheet (sleep prefilled from today's `body_metric`, shoulder 0–10, elbow 0–10, minutes auto, note) → save → summary (sets, PRs, session shorthand, "Next: Push B").
- Swap, note, check-in and Finish are direct server actions, disabled while this session has queued set writes ("saving 2 sets…"); see §11.2–11.3 for the queue and the failure policy that guarantees it can always drain.

Nothing else on this screen. No "best", no e1RM, no charts, no history list.

**v1.2 — focus mode (2026-09-08).** Rahul: "when I'm doing exercise C I have no interest in what's done and what's coming up — that's UI density without value." So:

- Only the current exercise (`openIndex`) renders as an open card. Under the sticky header a 4 px **lineup strip** shows `k of n` with one segment per exercise (done = amber, current = outlined, upcoming = grey); tapping it — or the **Lineup** label, or the one-line `Up next · <name>` under the card — opens the **Lineup sheet**: every exercise with its state (✓ + verdict line, ● now + `k of n sets`, number + goal line, `+` for a superset partner, a `postponed` tag), tap to make it current ("jump"; no server write), "Finish as short session" at the bottom. The warm-up row shows only while nothing is logged. When everything is complete the recap list replaces the card with one **Finish session** button. Reps never carry a `/arm` `/leg` suffix anywhere in the UI (the shorthand data format keeps its marker).
- **Postpone** (machine busy): `postpone →|` in the card footer moves the current exercise one place later — 1·2·3·4·5 with 3 postponed becomes 1·2·4·3·5 — by trading `session_exercise.order_index` with the next row (`postponeExercise`, one transaction, parked on −1 to respect the unique index). Optimistic on the client (`postponeAt`), undo toast for 5 s (undo postpones the exercise that jumped ahead). The last exercise cannot be postponed. Postponing again pushes it one more place. Logged sets stay with the row.
- **Rest ping**: the rest line under the header fills as the rest elapses (`useRestTimer().progress`); at zero the pill turns green `go` and pulses, and the phone beeps + vibrates. `primeAudio()` sets `navigator.audioSession.type = 'playback'` (iOS 17+) so the beep sounds through the ringer switch. Only while the app is open — iOS gives web apps no background timers; that limit is stated in Settings.
- **Settings → Rest timer** (`gym_config.rest_override_seconds`, `gym_config.rest_ping`; migration 0002): "Rest between sets" = Program (per-exercise, the default) or one duration for every exercise (60/90/120/150/180 s chips or a custom 15–600 s), and "Ping when rest ends" on/off. Not seed-managed (`edited_at` untouched). `SessionView.rest` carries both; `timer.start(rest.overrideSeconds ?? slot.restSeconds)`.
- **iPhone safe areas**: the (app) shell pads `pt-[var(--safe-top)]` (status bar / Dynamic Island in standalone mode); the session screen cancels it and paints its sticky header under the inset; bottom sheets and the tab bar pad `var(--safe-bottom)`. The variables wrap `env(safe-area-inset-*)` so QA can simulate an iPhone 15 (59 / 34 px) in headless Chrome. While a −/+ stepper is open the ✓ moves to its own row (the row would overflow 393 px otherwise).

### 6.4 Exercise detail (Phase 2)

History (each live session as one shorthand line with date + template or "imported"), best set (§7.6), chart (v1.1), settings (unit, load type, bar weight, increment, rest, muscles, aliases, swaps, progression; editing in v1.1).

### 6.5 History

List (Phase 1) and month calendar (Phase 2; dot per session, coloured by push/pull/legs/walk/imported); tap → session detail (shorthand + table). Phase 2 adds edit/delete sets (undo toast) and delete session (soft, undo toast).

### 6.6 Body (Phase 2)

Weight entry + 7-day average line (§7.11); waist; sleep good/bad; cardio notes; protein yes/no. One row per IST date.

### 6.7 More

Coach export (range picker, preview, Copy, Share). Phase 2: JSON export/import, Import from notes text, Program (view templates; edit in v1.1), Settings (rest defaults; gym config view-only, edit in v1.1), About.

## 7. Business logic (pure, tested functions in `src/lib/domain/`)

All functions are pure, take plain objects, and have Vitest coverage. Every read of sessions or sets in this section means **live** rows only (§9: `deleted_at IS NULL`; `session_exercise` inherits liveness from its session).

### 7.1 Shorthand parser / serializer (`shorthand.ts`)

```
ParsedExerciseBlock = {
  rawName: string,                 // header name as written, whitespace-collapsed
  exerciseId: string | null,       // resolved by name/alias, null if unresolved
  headerKind: 'range' | 'failure',
  lo: number | null, hi: number | null,   // both null for a failure header; lo === hi for "<reps> x <sets>"
  sets: number,
  unilateralMarker: 'arm' | 'leg' | null, // exactly what the header carried
  sessions: ParsedSession[],       // chronological, last = most recent
  lineNumber: number,
}
ParsedSession = { segments: [{ load: number, sets: [{ reps: number | null, toFailure: boolean }] }], lineNumber }
```

- `parseNotes(text, exercises) → { blocks: ParsedExerciseBlock[], errors: ParseError[] }`.
- `parseExerciseLine(line) → { segments, errors }` for the in-card "type it instead" box.
- `serializeBlocks(blocks)`, `serializeHeader({ name, lo, hi, sets, marker })`, `serializeSessionLine(segments)` produce the §3.2 canonical form. The same `serializeHeader` serves the database path with `{ name: exercise.name, lo/hi/sets: session_exercise snapshot, marker: exercise.unilateral }`.
- Errors carry line numbers and a message; nothing is guessed.

### 7.2 Loop pointer (`loop.ts`)

`advanceLoop(program, finishedTemplateIndex) → nextIndex`. `sessionAdvances(type, advancedLoopFlag) → boolean`.

### 7.3 Phase calculator (`phase.ts`)

- `getPhase(dateIST, program) → { name: 'Ramp' | 'Build 1' | 'Easy' | 'Build 2', week, targetDays, setsRule, rirRule, isEasyWeek, loadMultiplier: 1 | 0.8, setsOverride: 2 | null, weekStart, weekEnd, source: 'schedule' | 'manual' }` implementing §2.2 including manual overrides. Ramp: `loadMultiplier 1, setsOverride 2`. Easy: `0.8, 2`. Build: `1, null`.
- `weekPhase(week, program) → { name, targetDays, isEasyWeek, weekStart, weekEnd }`: Easy if any date of the week is Easy, else `getPhase(weekStart)`.
- `nextEasyWeek(dateIST, program) → { from, to }`.
- `programWeek(dateIST, program) → number`.

### 7.4 Goal engine (`goal.ts`)

```
getGoal({ exercise, entry: { sets, lo, hi }, history, phase, gym }) → Goal
Goal = {
  mode: 'first_time' | 'beat' | 'new_weight' | 'easy',
  load: number | null,          // the weight to lift THIS session (chips bind here); null only in first_time
  unit: 'lb' | 'kg',
  sets: number,                 // entry.sets, or 2 when phase.setsOverride === 2
  lo: number, hi: number,       // snapshot of the entry
  repsPerSet: (number | null)[],        // goal reps per set (null = last time's set was a failure set)
  prefillRepsPerSet: number[],  // what the reps chips show
  line: string,                 // the ONE goal line
  ghost: { load: number, reps: (number | null)[] } | null,   // last time, for ghost text
  nextLoad: number | null,      // step(load): shown in the new_weight line's alternative and used by §7.5
  setsOverride: 2 | null,       // copied from phase (Ramp/Easy)
  deload: boolean,              // phase.loadMultiplier === 0.8
}
```

`history` = this exercise's live finished `session_exercise` rows from ANY template (including imported ones), newest first, with set logs, ordered by `session.date`, then `session.started_at`, then `session_exercise.created_at` (an imported row at 12:00 IST never outranks a real session on the same date). `entry` is always read from the current `template_exercise`, never from a `session_exercise` snapshot.

- **History gate:** `history.length === 0` → `first_time`, regardless of phase.
- **`last`** = the newest history row with `goal.deload !== true` (a row with `goal = null`, i.e. imported, counts as `deload = false`); skipping easy-week sessions makes progression target the pre-deload numbers. If every row is a deload row, the newest row.
- **Goal load basis** from `last`: the best load used in that session (`load_up`: highest; `assist_down`: lowest).
- **`lastReps`** = reps of `last`'s sets at that load, in logged order, truncated to `sets` or padded by repeating the last one. Failure sets keep `null`. `ghost = { load: basis, reps: lastReps }` is fixed here, before the mode is chosen; each mode below sets only `repsPerSet` / `prefillRepsPerSet` (beat and easy: `repsPerSet = lastReps`).
- **Hi-test** (`allHitHi`): every non-null entry of `lastReps` is `≥ entry.hi` (a padded entry inherits its source), at least one entry is non-null, and the count of `last`'s counted sets at the basis load is `≥ entry.sets`. Otherwise false.
- **`step(exercise, load)`**: stack/per_side → `load + increment`; dumbbell → `nextRack(load)`; bodyweight `load ≥ 0` → `nextRack(load)` (0 → 2.5); bodyweight `load < 0` → `min(load + 5, 0)`; assist_down → `max(load − increment, 0)`.

Modes and the exact `line` copy (every `{load}` rendered through `formatLoad`):

- `first_time` — `"First time — pick a weight you can do {hi} with 4 left"`. `load = null` (weight chip empty, tap to set), `prefill = [hi, …]`, `repsPerSet = [hi, …]`, `nextLoad = null`, `ghost = null`. Sets = 2 when `setsOverride === 2`.
- `easy` — `setsOverride === 2` and history exists: `"Easy day — {load} × {r1} · {r2}, stop with 4 left"`. Sets = 2. Load = basis (Ramp, multiplier 1) or `easyLoad(basis)` (Easy week, multiplier 0.8): stack and per_side → `basis × 0.8` rounded to the nearest multiple of `exercise.increment`, in the exercise's own unit; dumbbell / bodyweight-added → `roundDownToRack(basis × 0.8)`, and when that is null (below the rack minimum) → the rack minimum (2.5 lb); bodyweight `load ≤ 0` → unchanged; assist_down → `basis × 1.2` rounded up to 5 kg. `prefill = repsPerSet` with nulls replaced by `hi`. `nextLoad = null`.
- `beat` — normal phase, hi-test false: `"Beat {load} × {r1} · {r2} · {r3}"` (failure entries render `f`), `load = basis`, `prefill = min(r_i + 1, hi)` (null → `hi`), `nextLoad = step(load)`. Assist: `"Beat 20 kg assist × 8 · 7 · 6"`.
- `new_weight` — normal phase, hi-test true: `load = step(basis)`, `nextLoad = step(load)`, `prefill = [lo, …]`, `repsPerSet = [lo, …]`. Line `"New weight {load} × {lo}+ each set"`. Assist_down: `"Less assist: {load} × {lo}+ each set"`, and when `basis ≤ 10` the line is `"Try Pull-Ups — no assist (or {load} × {lo}+)"`; the chips still hold `load` (`0 kg assist` is a valid chip value at the floor).

### 7.5 Verdicts (`verdict.ts`)

```
getVerdict({ goal, loggedSets, exercise, nextWeekPhase }) →   // nextWeekPhase = weekPhase(programWeek(session.date) + 1).name
  { verdict: 'beat' | 'matched' | 'under' | 'done', mark: ('up' | 'eq' | 'down' | null)[], nextNote: string, allHitHi: boolean }
```

- **Easy/Ramp:** when `goal.setsOverride === 2` (any mode) → `verdict = 'done'`, every mark `null`, `nextNote` by `nextWeekPhase`: `'Easy'` → `"easy week continues"`; `'Ramp'` → `"2 sets again next week"`; otherwise `"back to normal next week"`.
- Otherwise, with `effectiveLoad = goal.load ?? loggedSets[0].load`:
  - `goalTotal = Σ (goal.repsPerSet[i] ?? goal.prefillRepsPerSet[i])` (a failure goal entry counts as `hi`; first_time: `hi × sets`).
  - `total` = Σ reps of counted logged sets at `effectiveLoad` (a logged set with `reps = null` contributes 0).
  - `beat` when `total > goalTotal` or any logged set is at a better load (higher for `load_up`, lower for `assist_down`); `matched` when equal; `under` when less.
  - `mark[i]`: compare logged reps at index i with `goal.repsPerSet[i] ?? goal.prefillRepsPerSet[i]` → `up` / `eq` / `down`; `null` when the logged set has `reps = null`.
  - `allHitHi`: every counted logged set `≥ hi` and count of counted sets `≥ goal.sets`; a `reps = null` set never satisfies it.
  - `nextNote`: `allHitHi` → load_up: `"next time: {formatLoad(step(effectiveLoad))}"`; assist_down: `effectiveLoad ≤ 10` → `"next time: try Pull-Ups"`, else `"next time: {formatLoad(step(effectiveLoad))}"`. Not `allHitHi` → `"same weight next time"` (assist: `"same assist next time"`).

The verdict and `next_note` are stored on `session_exercise` when its last set is logged and recomputed on any later edit of that exercise's sets.

### 7.6 PRs (`prs.ts`)

`isPrSet(set, priorSets, exercise, bodyWeightKg | null) → boolean` and `bestSet(sets, exercise) → SetLog | null`.

- A counted set (`reps` not null) is a PR when the exercise has at least one counted live set in an EARLIER session (any template, imported included; a set with no baseline is never a PR) and either (a) its load beats every earlier counted set's load (higher for `load_up`, lower for `assist_down`), or (b) some earlier counted set used the same load and this set's reps exceed every earlier counted set's reps at that load, or (c) `load_up` only: its estimated 1RM (Epley `total × (1 + reps/30)`) beats every earlier set's e1RM. Ties are not PRs.
- `total` = `bar_weight + 2 × load` for `per_side`; body weight (kg × 2.20462 → lb) + added lb for `bodyweight` when a `body_metric.weight_kg` exists in that IST week, else (c) is skipped; `load` otherwise.
- `is_pr` is computed server-side on every set write (✓, edit, "type it instead", notes import) against earlier live sets, and recomputed for the whole exercise after any edit, delete, restore or import. The "PR" badge shows on the logged row and in the session summary only (Phase 2), never in the goal line. The report's PR line (Phase 1) lists every `is_pr` set in range.
- `bestSet`: highest load, ties broken by reps (`assist_down`: lowest assist, ties by reps); failure sets excluded.

### 7.7 Weekly hard sets per muscle (`weekly-sets.ts`)

Each exercise maps to muscle groups with fractional credit (§13). Weekly sets = Σ over live finished `logged` sessions in the week (Mon–Sun IST) of logged sets (counted or failure, not deleted) × credit. Targets: chest 8–12, back 10–14, side_delts 6–8, rear_delts_cuff 6–9, quads 8–10, hamstrings 6–8, glutes 6–10, biceps 5–8, triceps 4–8, calves 4–6, abs 3–6, front_delts no target.

### 7.8 Flags (`flags.ts`)

`shoulderFlag(sessions) → boolean`: the three most recent live finished non-walk `logged` sessions all have `shoulder_pain > 2`. `elbowFlag` is the same on elbow (report only).

### 7.9 Sleep gate (`sleep.ts`)

`sixthDayOk(bodyMetricsLast7Days) → boolean`: at least 5 of the 7 IST dates ending today have `sleep_good = true`. Shown as a badge in Build phases only. The session check-in prefills sleep from today's `body_metric.sleep_good`; saving the check-in writes both `session.sleep_good` and today's `body_metric.sleep_good`.

### 7.10 Time helpers (`time.ts`)

`todayIST()`, `istDate(instant)`, `weekBoundsIST(date)`, `programWeek(date, startDate)`, `addDaysIST`. Implemented with `date-fns` v4 + `@date-fns/tz`.

### 7.11 Body metrics (`body.ts`)

`weightAvg7(dateIST, metrics) → number | null`: mean of `weight_kg` over `body_metric` rows dated in `[date − 6, date]` with non-null `weight_kg` (rows created by the sleep toggle alone have null weight and are skipped). No minimum sample count. The window may reach before a report's `from`. Rendered to 1 decimal; `null` renders `—`.

### 7.12 Coach report (`report.ts`)

`generateCoachReport({ from, to, today, ownerName }, data) → string`, pure (§8).

## 8. Coach export — exact format

Default range: last 14 days ending today. Dense, plain markdown, no HTML.

```
# LiftLoop report — 2026-09-07 → 2026-09-20 (Rahul)

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
Pec Fly Machine 8-12 x 2
(swapped from Machine Chest Press)
20.12.12

Half-Kneeling Landmine Press 8-12/arm x 2
10.10.10

…
Note: felt easy, as planned.

### 2026-09-13 Sun — Walk — 22 min
(cardio only, loop not advanced)

## Exercise progression (first → last in range, best, verdicts)
| Exercise | Sessions | First | Last | Best set | Verdicts |
|---|---|---|---|---|---|
| Machine Chest Press | 3 | 25 kg × 12/12 | 27 kg × 12/12 | 27 kg × 12 | easy, easy, easy |
| Pull-Ups (overhand, shoulder-width) | 3 | BW × 6/5 | BW × 8/7 | BW × 9 | easy, easy, easy |
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
- 2026-09-15 Push B · Single-Arm Cable Overhead Triceps (rope): pinched at set 2, swapped to rope pushdown.
```

Rendering rules:

- Title: `(ownerName)` comes from the optional `REPORT_OWNER_NAME` env var; omitted when unset.
- **Weeks.** A program week's phase and target come from `weekPhase(week)` (§7.3). Weeks whose Mon–Sun is not fully inside `[from, to]` are labelled with a trailing `*` (`W3*: 1`) and still contribute their full target to y. `Sessions: x/y`: x = live finished `normal` + `short` `logged` sessions in range; y = Σ target over program weeks intersecting the range.
- **Phase bullet** lists every phase in range in order: `Phase: Easy (W7) → Build 2 (W8). Target 4→5 days/week.` A manual easy week renders as `Easy (manual, W9)`.
- Units line is fixed text.
- Sleep counts every IST date in range with `body_metric.sleep_good = true`; the denominator is the number of days in range; `(n unrecorded)` when any date has no value.
- Shoulder / Elbow: over live finished non-walk `logged` sessions in range with a non-null value; avg to 1 decimal with a trailing `.0` dropped; `max N (date, template)` names the earliest session reaching the max; the suffix is omitted when max = 0; `—` when no value exists.
- Body weight: `d1`/`d2` = first and last dates in range with a non-null weight; renders `7-day avg {avg7(d1)} → {avg7(d2)} kg ({±delta})`, or `Body weight: —` when none. Waist: latest value in range with its date.
- Verdicts: `done` renders as `easy` throughout the report (Summary and the Verdicts column); other verdicts render as their enum value; imported sessions (no verdict) are not counted.
- PRs: every `is_pr` set in range as `{exercise} {formatLoad} × {reps} ({date})`, in date order; `none` when empty.
- Flags: `shoulder > 2 on 3 sessions in a row`, `elbow sore` (same rule on elbow), `< 3 sessions in week X` (complete weeks only, Sunday before today), `no export for 21+ days` (compares `to` with `max(export_log.created_at)` as it stood before this export; also fires when there is no export and `program.start_date` is 21+ days before `to`). `none` when empty.
- **Sessions section.** One heading per live session in range (imported sessions render as `— Imported —` with no check-in fields; short sessions as `— Push A (short)`; null check-in fields are omitted). Exercise blocks are separated by a blank line and are §3 shorthand: header from the `session_exercise` snapshot (`lo-hi x sets`, `x <sets>` from the snapshot regardless of logged-set count), a `(swapped from X)` comment line directly under the header when swapped, one session line. A session note renders as a `Note:` comment line at the end of the block list. Walk sessions render the fixed `(cardio only, loop not advanced)` line.
- Exercise progression: one row per exercise actually performed, ordered by first appearance in range (session date, then `order_index`); `First`/`Last` = `{formatLoad} × r1/r2/…` of the first and last sessions in range; `Best set` = `bestSet` over the range.
- Weekly hard sets: muscles in the fixed order Chest, Back, Side delts, Rear delts/cuff, Quads, Hamstrings, Glutes, Biceps, Triceps, Calves, Abs, Front delts (target `—`); values to 1 decimal with a trailing `.0` dropped.
- Body table: one row per date in range with any non-null metric; Sleep renders `good` / `bad` / blank.
- Notes: one bullet per `session_exercise.note`, `{date} {template} · {exercise}: {note}`.
- `generateCoachReport` is pure; rendering the preview writes nothing. Copy (after the clipboard write resolves) and Share (after `navigator.share()` resolves; an abort writes nothing) each insert one `export_log {from_date, to_date}` row; the v1.1 token endpoint inserts after generating. The generator is covered by a golden-file test.

## 9. Data model (Postgres, Drizzle)

- `exercise` — id, name (unique), aliases text[], load_type (`per_side | stack | dumbbell | bodyweight`), unit (`lb | kg`), bar_weight numeric nullable, increment numeric nullable (null → rack stepping), progression (`load_up | assist_down`), rest_seconds smallint not null, unilateral text nullable (`arm | leg | null`), muscles jsonb `[{group, credit}]`, swap_ids uuid[], cue text nullable, notes text nullable, archived bool, created_at.
- `gym_config` — id, plates_lb jsonb, dumbbell_rack_lb jsonb, stack_step_kg numeric, updated_at. Single row.
- `program` — id, name, version, start_date (IST date), next_index, easy_week_overrides jsonb `[{from, to}]`, created_at.
- `template` — id, program_id, name, kind (`push | pull | legs`), order_index, notes. Unique `(program_id, order_index)`.
- `template_exercise` — id, template_id, exercise_id, order_index, sets, lo, hi, rest_seconds smallint nullable, superset_group smallint nullable, notes. Unique `(template_id, order_index)`.
- `session` — id (client-supplied uuid for logged sessions), date (IST date string), started_at, finished_at nullable (null = in progress), template_id nullable, type (`normal | short | walk`), source (`logged | imported`), duration_min nullable, sleep_good bool nullable, shoulder_pain smallint nullable, elbow_pain smallint nullable, advanced_loop bool, note, deleted_at nullable, created_at.
- `session_exercise` — id, session_id, exercise_id, template_exercise_id nullable, order_index, sets smallint, lo smallint nullable, hi smallint nullable, goal jsonb nullable (the §7.4 Goal as shown; null for imported rows), verdict (`beat | matched | under | done`) nullable, next_note text nullable, swapped_from_exercise_id nullable, note, created_at. Unique `(session_id, order_index)`. `sets` is the effective set count the session actually prescribed: `goal.sets` for logged rows (so 2 in Ramp/Easy), the header's `<sets>` for imported rows. `lo/hi` are the entry's range (identical to `goal.lo/hi`); the report header renders `x <sets>` from this column.
- `set_log` — id, session_exercise_id, set_index, rev int not null default 1, load numeric nullable, reps smallint nullable, to_failure bool, unit (`lb | kg`), is_pr bool, deleted_at nullable, created_at, updated_at. Unique `(session_exercise_id, set_index)`.
- `body_metric` — id, date (IST date, unique), weight_kg numeric nullable, waist_cm numeric nullable, sleep_good bool nullable, protein_hit bool nullable, cardio_type text nullable, cardio_min smallint nullable, note.
- `export_log` — id, from_date, to_date, created_at.
- `login_attempt` — id, attempted_at, success bool, ip text nullable.

Timestamps in UTC (`timestamptz`); logical dates as IST date strings (`date` column). **Live** = `deleted_at IS NULL`; `session_exercise` has no `deleted_at` and inherits liveness from its session. Every read path (Home resume and week dots, §7.4 history, §7.5–§7.9, §8, History) filters live sessions and live set logs. Undo restores exactly the rows the delete touched. Indexes: `session_exercise(exercise_id, created_at)`, `set_log(session_exercise_id)`, `session(date)`, `body_metric(date)`, `login_attempt(attempted_at)`.

`exercise.default_lo/hi/sets` are NOT in the v1 schema; the v1.1 program-editor migration adds them (they prefill new template entries only).

## 10. Tech stack and architecture

### 10.1 Stack

- **Next.js 16 App Router + TypeScript strict + Tailwind 4 + shadcn/ui**, pnpm. Versions resolve under the machine's npm `before=2026-05-06` pin (do not remove it): Next 16.2.4, Drizzle 0.45, Vitest 4, Zod 4, jose 6. Server Components for reads, Server Actions for writes (Zod-validated), Route Handlers for login and exports.
- **Database: Neon Postgres Free** (verified 2026-09-07: 0.5 GB, 100 CU-hours/month, scale-to-zero after 5 min idle, no forced pause), provisioned through the Vercel Marketplace so `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) land in Vercel automatically. Drizzle ORM. Production driver: `drizzle-orm/neon-serverless` (WebSocket `Pool`, supports transactions). Local dev and tests: `drizzle-orm/pglite` over `@electric-sql/pglite` (embedded Postgres, file-backed in `.pglite/`, gitignored) selected by `DATABASE_URL` being unset or starting with `pglite:`. Both are Postgres, so migrations are shared.
- **Validation:** Zod at every boundary, including env at boot (`APP_PASSCODE` ≥ 8 chars, `SESSION_SECRET` ≥ 32 chars). **Charts:** Recharts (v1.1). **PWA:** `manifest.webmanifest` + icons + a hand-written minimal service worker (no Serwist in v1); Wake Lock API during sessions (re-requested on `visibilitychange`); `navigator.vibrate` where available, WebAudio beep everywhere.
- **Time:** `date-fns` v4 + `@date-fns/tz`; every date computation takes `Asia/Kolkata` explicitly. `TZ` is NOT set on Vercel (the platform reserves that variable name); the explicit zoning in code is the only mechanism.
- **Tests:** Vitest for every §7 module and the §8 golden file. Browser verification via headless Chrome screenshots (dark theme, 390 and 1440 wide) before each phase handover.

### 10.2 Auth

Single passcode from `APP_PASSCODE`, compared with a timing-safe equality. On success set an httpOnly, secure (in production), sameSite=lax cookie `ll_session` holding an HS256 JWT (`jose`) signed with `SESSION_SECRET`, valid 90 days. The Next 16 request proxy (`src/proxy.ts`, the renamed middleware) protects everything except `/login`, `/api/login`, the manifest, icons, `sw.js`, `_next` assets, and the optional token export route.

Rate limit: global (single user; locking the owner out during an attack is acceptable), 5 failed attempts per 15 minutes, enforced atomically in one statement that takes `pg_advisory_xact_lock(<constant>)`, counts failures in the window, and inserts the attempt row only when the count is `< 5`; the timing-safe compare runs first in JS and its result is passed in as the row's `success`. No row returned → 429 with the minutes remaining. Changing `APP_PASSCODE` does not revoke issued cookies; rotating `SESSION_SECRET` logs out everywhere (documented in README).

### 10.3 Migrations and seed

- Migrations in `drizzle/` via `drizzle-kit`, run with `DATABASE_URL_UNPOOLED` when present. Policy: additive / expand-contract — no drop or rename in the same release as the code that stops using a column, so a deploy-time migration cannot break the still-serving previous deployment.
- `pnpm db:seed` is the "re-seed program (keeps history)" script: it upserts the definitional columns of `exercise` (matched by `name`), `template` (by `(program_id, order_index)`), `template_exercise` (by `(template_id, order_index)`) and `gym_config` (singleton); it inserts `program` only if missing and never writes `next_index` or `easy_week_overrides` on an existing row. Sessions and set logs are never touched. (v1.1: rows edited in-app get `edited_at` and are skipped by the seed.)
- Deploy: `vercel.json` → `"buildCommand": "pnpm build:vercel"` where `build:vercel` = `db:migrate && db:seed && next build` when `VERCEL_ENV === 'production'`, plain `next build` otherwise. Local `pnpm build` is always a pure `next build`.

### 10.4 Layout

```
src/app/(auth)/login            login page + /api/login route
src/app/(app)/                  authed shell with tab bar: page (Home), session/[id], history, history/[id], exercise/[id], body, more/*
src/proxy.ts                    auth proxy
src/actions/                    server actions (zod-validated)
src/db/schema.ts, client.ts     Drizzle (neon-serverless in prod, pglite locally)
src/db/seed/program-v2.ts       versioned program seed (§13); src/db/seed.ts idempotent runner
src/lib/domain/                 pure logic (§7) + tests
src/lib/queue/                  client write queue (§11)
src/components/                 UI
drizzle/                        migrations
docs/superpowers/               specs and plans
```

## 11. Data safety

### 11.1 Session lifecycle

- **Start** is one server action `startSession({ id: clientUuid, templateId, advancesLoop })` that inserts the `session` row plus one `session_exercise` per template entry (the goal computed server-side; the `sets` snapshot is `goal.sets`, phase-adjusted, NOT `template_exercise.sets`; `lo/hi` from the entry) in a single transaction, `ON CONFLICT (session.id) DO NOTHING` and returning the existing rows on retry. It refuses when another live in-progress session exists. Start requires network (the session page is server-rendered); on failure the button shows a retry.
- **Swap** and **note** update the existing `session_exercise` row in place.
- **Finish** is one transaction (session fields, loop pointer, today's `body_metric.sleep_good`) and re-submittable: it writes absolute values only, and a second submit for an already-finished session is a no-op that returns the summary.

### 11.2 Set writes and the queue

- A set's identity is `(session_exercise_id, set_index)`. Every set write carries `rev = (the row's rev as last loaded from the server, or 0 when no row exists) + 1`; every read that feeds an editable set row (session page, History detail) selects `set_log.rev`. The write is an upsert `ON CONFLICT (session_exercise_id, set_index) DO UPDATE … WHERE set_log.rev < excluded.rev` whose SET list is: for ✓ / edit / "type it instead" — `load, reps, to_failure, unit, rev, updated_at, deleted_at = NULL`; for delete — `deleted_at = now(), rev, updated_at`; for restore — `deleted_at = NULL, rev, updated_at`. So a stale replay can never overwrite a newer edit and a retried write is idempotent. The action returns `{ applied, row }`; on `applied = false` the runner re-enqueues the same payload once with `rev = row.rev + 1` (the user's latest intent wins on the single device), and if that is refused too it drops the op with the §11.3 "could not be saved" toast.
- **Every set write (upsert, delete, restore) goes through one FIFO queue** (`liftloop.queue.v1` in localStorage) with a single operation in flight; no set write is sent directly while older operations exist. Everything else — Start, swap, exercise note, check-in/Finish, Discard, Home quick entries — is a direct server action; swap, note, check-in and Finish are disabled while the queue holds writes for that session, and Home quick entries are unordered with respect to it. The UI updates optimistically from the queue's view. The runner is mounted in the authed layout and runs on every authed screen; it drains on mount, on `online`, on `visibilitychange` to visible, and every 10 s while non-empty. The sticky header shows an "n unsaved" pill; Finish is disabled until the queue drains.
- Reload, phone lock or tab death resumes the in-progress session from the DB plus any queued writes (the queue view is applied over the server rows).

### 11.3 Queue failure policy

- Network error, timeout, 5xx → retry with exponential backoff (1 s → 30 s cap).
- 401 → pause the queue, redirect to `/login`, resume after login.
- 4xx validation (corrupt entry) → drop the operation, keep draining, and show a persistent "1 set could not be saved — tap to see" toast carrying the payload.
- Writes against a soft-deleted (Discarded) session are accepted normally (upsert succeeds), so Discard cannot poison the queue and Undo brings the session back with every set intact.

### 11.4 Soft deletes, export, import

- Soft deletes on `session` and `set_log`; undo toasts restore exactly the touched rows. All reads filter live rows (§9).
- JSON export is a full dump of every table except `login_attempt`, soft-deleted rows included, with metadata `{ app: 'liftloop', schema_version: <latest migration tag>, exported_at }`.
- JSON import runs straight away when the database is **empty of user data** (zero rows in `session`, `session_exercise`, `set_log`, `body_metric`, `export_log`; seeded config rows may exist); otherwise the screen requires typing `RESTORE` to confirm a wipe-and-restore. It refuses a dump whose `schema_version` is NEWER than the current migration tag; an older dump is accepted because migrations are expand-only (new columns are nullable or defaulted). It runs in one transaction: delete all rows from `set_log`, `session_exercise`, `session`, `body_metric`, `export_log`, `template_exercise`, `template`, `program`, `exercise`, `gym_config` (FK order), then insert every dump row verbatim with its original ids in the order `gym_config → exercise → program → template → template_exercise → session → session_exercise → set_log → body_metric → export_log`, then commit; any error rolls back and leaves the prior state untouched. The next deploy's seed then sees matching rows and changes nothing that matters.

## 12. Source control, hosting, secrets

- **GitHub:** public repo `git@github.com:RahulSomaliya/liftloop.git`, branch `main`. Commit early and often with conventional messages; push after every meaningful step and at the end of every phase. Never bypass hooks.
- **Vercel:** Git integration, Hobby plan. Every push to `main` is a production deploy. Env vars set in the Vercel dashboard: `APP_PASSCODE` (≥ 8 chars), `SESSION_SECRET` (`openssl rand -base64 32`), optional `REPORT_OWNER_NAME`, optional `COACH_EXPORT_TOKEN` (never `TZ` — reserved by Vercel); `DATABASE_URL` and `DATABASE_URL_UNPOOLED` come from the Neon integration.
- **Public code, private data:** `.gitignore` excludes `.env*` (except `.env.example`), `exports/`, `*.dump.json`, DB dumps, `.pglite/`. No personal data in the repo; the program seed is fine to be public. MIT `LICENSE`. README explains single-user + passcode, env vars, Neon setup, migrations, seeding, local dev (PGlite, no Docker), and "deploy your own".

## 13. Seed data — program v2 (2026-09-07)

Rest: `template_exercise.rest_seconds = 120` at `order_index 0`, null otherwise; `exercise.rest_seconds = 90` for every exercise. `(+)` marks a superset with the previous exercise. `increment` is a positive magnitude; `rack` means `increment = null` (ladder stepping).

### Gym config

`plates_lb = [2.5, 5, 10, 22, 25, 35, 45]`, `dumbbell_rack_lb = [2.5, 5, 7, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 60]`, `stack_step_kg = 5`.

### Exercise library

| Exercise | loadType | unit | stepping | unilateral | progression | muscles (credit) | swaps / aliases / notes |
|---|---|---|---|---|---|---|---|
| Machine Chest Press | stack | kg | +5 | — | load_up | chest 1, triceps 0.5, front_delts 0.5 | swap: Pec Fly Machine |
| Half-Kneeling Landmine Press | stack | lb | +5 | arm | load_up | chest 0.5, front_delts 0.5, triceps 0.25 | load = plates on the sleeve, bar ignored; swap: Low-Incline DB Press; alias "Landmine Press" |
| Pec Fly Machine | stack | kg | +5 | — | load_up | chest 1 | alias "Pec Deck" |
| Low-Incline DB Press (15-30°) | dumbbell | lb | rack | — | load_up | chest 1, front_delts 0.5, triceps 0.5 | swap: Machine Chest Press |
| Cable Lateral Raise | stack | kg | +5 | arm | load_up | side_delts 1 | alias "Lateral Raise" |
| Single-Arm Cable Overhead Triceps (rope) | stack | kg | +5 | arm | load_up | triceps 1 | swap: Cable Tricep Pushdown (rope) |
| Cable Tricep Pushdown (rope) | stack | kg | +5 | — | load_up | triceps 1 | — |
| Sidelying DB External Rotation | dumbbell | lb | rack | arm | load_up | rear_delts_cuff 1 | alias "External Rotation (L arm first)" |
| Pull-Ups (overhand, shoulder-width) | bodyweight | lb (added) | rack | — | load_up | back 1, biceps 0.5 | swaps: Assisted Pull-Up Machine, Lat Pulldown (Front, Medium Grip); alias "Pull ups"; cue (below) |
| Pull-Ups (neutral grip) | bodyweight | lb (added) | rack | — | load_up | back 1, biceps 0.5 | swaps: Assisted Pull-Up Machine, Lat Pulldown (Neutral Grip); cue (below) |
| Assisted Pull-Up Machine | stack | kg | +5 | — | assist_down | back 1, biceps 0.5 | load = assist; swap target for both pull-up variants; cue: "At 10 reps on all sets with ≤ 10 kg assist, try Pull-Ups" |
| Lat Pulldown (Front, Medium Grip) | stack | kg | +5 | — | load_up | back 1, biceps 0.5 | alias "2 Grip Lat Pulldown" |
| Lat Pulldown (Neutral Grip) | stack | kg | +5 | — | load_up | back 1, biceps 0.5 | — |
| Machine Chest-Supported Row | stack | kg | +5 | — | load_up | back 1, rear_delts_cuff 0.25, biceps 0.5 | swap: Seated Cable Row (Close Grip); alias "Chest-supported Row" |
| Seated Cable Row (Close Grip) | stack | kg | +5 | — | load_up | back 1, rear_delts_cuff 0.25, biceps 0.5 | — |
| Cable Face Pull | stack | kg | +5 | — | load_up | rear_delts_cuff 1 | — |
| Cable Reverse Fly | stack | kg | +5 | — | load_up | rear_delts_cuff 1 | alias "Reverse pec deck" (same history bucket) |
| Incline DB Curl | dumbbell | lb | rack | — | load_up | biceps 1 | — |
| Hammer Curls | dumbbell | lb | rack | — | load_up | biceps 1 | — |
| Cable Crunch | stack | kg | +5 | — | load_up | abs 1 | alias "Crunch" |
| Leg Press | per_side | lb | +10 | — | load_up | quads 1, glutes 0.5 | plate-loaded; bar_weight null |
| Single-Leg Leg Press | per_side | lb | +5 | leg | load_up | quads 1, glutes 0.5 | swap: Reverse Lunge (DB) |
| Leg Extension | stack | kg | +5 | — | load_up | quads 1 | — |
| Lying Leg Curl | stack | kg | +5 | — | load_up | hamstrings 1 | — |
| Seated Leg Curl | stack | kg | +5 | — | load_up | hamstrings 1 | — |
| Barbell RDL | per_side | lb | +2.5 | — | load_up | hamstrings 1, glutes 0.5, back 0.25 | bar 45 lb; alias "RDL" |
| Seated Calf Raise | stack | kg | +5 | — | load_up | calves 1 | — |
| Standing Calf Raise | stack | kg | +5 | — | load_up | calves 1 | swap: Standing BW Calf Raise |
| Standing BW Calf Raise | bodyweight | lb (added) | rack | — | load_up | calves 1 | alias "Standing bw Calf Raise" |
| Reverse Lunge (DB) | dumbbell | lb | rack | leg | load_up | quads 1, glutes 0.5 | — |

Only the two pull-up variants and the assisted machine carry a `cue`.

### Templates (loop order)

```
Push A:  Machine Chest Press 8-12 x 3 · Half-Kneeling Landmine Press 8-12/arm x 3 · Pec Fly Machine 10-12 x 2 · Cable Lateral Raise 12-15/arm x 3 · Single-Arm Cable Overhead Triceps (rope) 12-15/arm x 2 · (+) Sidelying DB External Rotation 15/arm x 2
Pull A:  Pull-Ups (overhand, shoulder-width) 6-10 x 3 · Machine Chest-Supported Row 10-12 x 3 · Lat Pulldown (Front, Medium Grip) 10-12 x 2 · Cable Face Pull 15-20 x 2 · Incline DB Curl 10-12 x 3 · (+) Cable Crunch 12-15 x 2
Legs A:  Leg Press 10-15 x 3 · Lying Leg Curl 10-15 x 3 · Single-Leg Leg Press 10-12/leg x 2 · Leg Extension 12-15 x 2 · Seated Calf Raise 15-20 x 3
Push B:  Low-Incline DB Press (15-30°) 8-12 x 3 · Pec Fly Machine 10-12 x 3 · Cable Lateral Raise 12-15/arm x 3 · Single-Arm Cable Overhead Triceps (rope) 12-15/arm x 3 · (+) Sidelying DB External Rotation 15/arm x 2
Pull B:  Seated Cable Row (Close Grip) 10-12 x 3 · Pull-Ups (neutral grip) 6-10 x 3 · Cable Reverse Fly 15-20 x 2 · Hammer Curls 10-12 x 3 · Cable Lateral Raise 12-15/arm x 2
Legs B:  Barbell RDL 8-10 x 3 · Leg Press 12-15 x 2 · Seated Leg Curl 10-15 x 3 · Leg Extension 12-15 x 2 · (+) Cable Crunch 12-15 x 2 · Standing Calf Raise 12-15 x 2
```

The `/arm` and `/leg` markers in headers are derived from `exercise.unilateral`; template entries do not store them.

### Warm-up checklist (shown, not logged)

Bike/treadmill 2 min · Cable Face Pull very light 15 · Sidelying DB External Rotation lightest DB 12/arm · ramp-up sets of the first exercise at ~50% × 8 and ~75% × 4.

### Pull-up special rules (surfaced in the card)

Target 6–10 reps. < 6 → swap to the Assisted Pull-Up Machine. 10 on all sets → add weight (next dumbbell rack entry, held between the feet). Cue: "Shoulder blades down first. Don't hang loose at the bottom."

## 14. Build phases

1. **Phase 1 — core, pushed and deployed.** Scaffold, repo push, auth + rate limit, DB + migrations + seed (PGlite locally), domain logic with tests (§7 incl. PR computation and the report golden file), Home (loop + phase + week dots + sleep/weight quick entry + shoulder banner + export nudge), Session goal-first logging (goal line, chips, ✓, stepper, cascade, rest timer, superset grouping, collapse/verdict, finish check-in, loop advance, write queue with the §11.3 policy, resume), History list + session detail (read-only), Coach export (markdown, copy). Tests green, headless-Chrome QA gallery, push. Hand over the Vercel import steps + env vars. Live on `*.vercel.app`.
2. **Phase 2.** Body screen, History calendar + edit/delete sets + delete session, Exercise detail, notes-text import (§5.3), JSON export/import (§11.4), PWA install + wake lock + vibration, swap, short session, walk day, start-different-template prompt, Discard in-progress session, easy-week override, PR badges, undo toasts, "type it instead", Share, More (Program view, Settings view-only, About), polish.
3. **Phase 3 (v1.1).** Progress charts, weekly sets per muscle screen, adherence heatmap, program + gym-config editor (with `edited_at` seed protection and `default_lo/hi/sets`), service-worker offline, optional token export endpoint.

After each phase: run tests, update README, push, list what changed.

## 15. Definition of done (v1)

- On the phone, installed as a PWA, a full session can be logged one-handed with one tap per set when the goal is hit, and two taps when it isn't.
- Every exercise card shows exactly one goal line computed across all templates and the current phase.
- Finishing a session advances the loop; short sessions advance, walk days don't.
- The coach export produces the §8 report for any range, copies to clipboard, and shares via the share sheet; its Sessions section re-imports through the §3 parser with zero errors.
- Full JSON export/import works; notes-text import backfills history.
- Code on GitHub (public, no secrets), deployed on a `*.vercel.app` URL on free tiers only; README covers env vars, Neon setup, migrations, seeding, local dev, deploy-your-own.
- Tests pass; the §3 round-trip test passes for every example; goal engine covered for every mode, stepping rule, phase and verdict; the queue's `rev` rule is covered by a test that replays a stale write after a newer edit.

## 16. Decision log (2026-09-07, with the owner)

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

## 17. Review-driven changes (2026-09-07, adversarial spec review, 47 confirmed findings)

1. Shorthand: right-anchored header regex; comment lines (`#`, `(`, `Note:`); a header always starts a block; `<sets>` never validated against rep entries; `normalize` defined; canonical form defined; parsed block keeps `rawName`, `headerKind`, nullable `lo/hi`, `unilateralMarker`; one `serializeHeader` for both the parsed-block and database paths.
2. `exercise.unilateral` is `'arm' | 'leg' | null` (was a boolean); `/arm` added to the lateral-raise and overhead-triceps template entries.
3. Notes import fully specified (§5.3): last two lines per block, chronological, per-line dates grouped into one session per date, `source = 'imported'`, null goal/verdict; imported sessions excluded from week dots and report counts but visible to the goal engine, PRs and history. Report re-import via `###` date lines.
4. `session_exercise` snapshots `sets/lo/hi`; swap keeps the entry's `sets/lo/hi`; `default_lo/hi/sets` dropped from v1.
5. Rest: `template_exercise.rest_seconds` (120 at slot 0) with `exercise.rest_seconds` (90) as fallback.
6. Goal engine: `load` is always the weight to lift this session; `nextLoad = step(load)`; `repsPerSet` truncation/padding rule; hi-test defined over `repsPerSet` with the counted-set count; failure entries handled in goal, prefill, total and marks; `deload` flag and the `last` rule that skips easy-week sessions; `setsOverride` snapshot makes every Ramp/Easy verdict `done` including `first_time`; bodyweight easy loads ≤ 0 unchanged, rack loads clamp to the rack minimum; negative bodyweight loads step by 5 lb; `formatLoad` used in every line/chip/note/report cell; assist threshold unified at `≤ 10 kg` with `increment` stored positive.
7. Rack ladder extended above the max in 5 lb steps; the contradictory `load ± 5` clauses removed.
8. Verdict `nextNote` uses `step(effectiveLoad)`; the easy/Ramp note uses `weekPhase(next week).name` ("2 sets again next week" during Ramp week 1).
9. `weekPhase` for week-granular consumers; partial weeks labelled `W3*`; phase bullet lists all phases in range; `< 3 sessions` flag on complete weeks only.
10. `weightAvg7` defined (§7.11); PR rule and `is_pr` recomputation defined (§7.6); Best set defined; report rendering rules (verdict labels, row order, avg/max, owner name env var); `export_log` written by Copy/Share only, after success; nudge and flag thresholds defined.
11. Report example regenerated for Ramp (2 sets, `easy 42`, Sunday fixed); `(swapped from …)` and `Note:` are comment lines; blank line between blocks.
12. Data safety: Start creates all `session_exercise` rows in one idempotent transaction; set identity `(session_exercise_id, set_index)` with `rev` and a guarded upsert; single FIFO runner, no direct writes; failure policy (§11.3); soft-deleted rows excluded from every read; Finish re-submittable.
13. JSON import: "empty of user data" precondition, transactional truncate-and-restore with original ids, `schema_version` guard, `login_attempt` excluded.
14. Seed upserts definitional columns and never touches `program.next_index` / overrides; expand-contract migration policy; production-only migrate+seed via `vercel.json`.
15. Login rate limit is global and atomic (advisory lock in one statement); `APP_PASSCODE` ≥ 8 chars enforced at boot.
16. Scope/phase reconciliation (§14 lists every v1 screen); gym config editing is v1.1.
17. Local dev/tests on PGlite (no Docker, no Neon needed); production on `neon-serverless` Pool for transactions.
18. Second pass (12 findings): `session_exercise.sets` = `goal.sets`; `entry` always from `template_exercise`; easy rounding by `increment` in the exercise's unit; `ghost` from `lastReps`; imported rows count as non-deload; report example swapped block fixed; upsert SET lists spelled out incl. `deleted_at = NULL`; `rev` derived from the loaded row with a one-shot re-submit on `applied = false`; only set writes are queued, other actions are direct and gated; import refuses dates with an existing session and only parses the `## Sessions` section of a report; restore accepts older dumps and uses a typed confirmation when user data exists.

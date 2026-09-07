// Idempotent program seed (spec §10.3). Upserts the DEFINITIONAL columns of exercise, template,
// template_exercise and gym_config; inserts `program` only when missing and never writes its
// next_index or easy_week_overrides (that would reset the loop on every deploy). Sessions and
// set logs are never touched. Usage: pnpm db:seed (also called from tests).
import 'dotenv/config'
import { eq, sql } from 'drizzle-orm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb, type Db } from './client'
import { PROGRAM_V2 } from './seed/program-v2'
import { exercise, gymConfig, program, template, templateExercise } from './schema'

export async function seedProgram(db: Db): Promise<{ programId: string }> {
  const data = PROGRAM_V2

  // 1. exercises (without swap ids — they need every id first)
  const idByName = new Map<string, string>()
  for (const e of data.exercises) {
    const values = {
      name: e.name,
      aliases: e.aliases ?? [],
      loadType: e.loadType,
      unit: e.unit,
      barWeight: e.barWeight ?? null,
      increment: e.increment,
      progression: e.progression ?? 'load_up',
      restSeconds: data.restSecondsDefault,
      unilateral: e.unilateral ?? null,
      muscles: e.muscles,
      cue: e.cue ?? null,
      notes: e.notes ?? null,
    }
    const [row] = await db
      .insert(exercise)
      .values(values)
      .onConflictDoUpdate({ target: exercise.name, set: values })
      .returning({ id: exercise.id })
    idByName.set(e.name, row.id)
  }
  for (const e of data.exercises) {
    const swapIds = (e.swaps ?? []).map((n) => {
      const id = idByName.get(n)
      if (!id) throw new Error(`Seed: swap target "${n}" of "${e.name}" is not in the library`)
      return id
    })
    await db.update(exercise).set({ swapIds }).where(eq(exercise.id, idByName.get(e.name) as string))
  }

  // 2. gym config singleton
  const gymValues = { id: 1, platesLb: data.gym.platesLb, dumbbellRackLb: data.gym.dumbbellRackLb, stackStepKg: data.gym.stackStepKg, updatedAt: new Date() }
  await db.insert(gymConfig).values(gymValues).onConflictDoUpdate({ target: gymConfig.id, set: gymValues })

  // 3. program: insert-only (next_index / overrides belong to the user)
  let [prog] = await db.select({ id: program.id }).from(program).limit(1)
  if (!prog) {
    ;[prog] = await db
      .insert(program)
      .values({ name: data.program.name, version: data.program.version, startDate: data.program.startDate })
      .returning({ id: program.id })
  } else {
    await db.update(program).set({ name: data.program.name, version: data.program.version }).where(eq(program.id, prog.id))
  }

  // 4. templates and entries by position
  for (let ti = 0; ti < data.templates.length; ti += 1) {
    const t = data.templates[ti]
    const tValues = { programId: prog.id, name: t.name, kind: t.kind, orderIndex: ti }
    const [trow] = await db
      .insert(template)
      .values(tValues)
      .onConflictDoUpdate({ target: [template.programId, template.orderIndex], set: { name: t.name, kind: t.kind } })
      .returning({ id: template.id })
    let group = 0
    for (let ei = 0; ei < t.entries.length; ei += 1) {
      const en = t.entries[ei]
      const exerciseId = idByName.get(en.exercise)
      if (!exerciseId) throw new Error(`Seed: template "${t.name}" references unknown exercise "${en.exercise}"`)
      let supersetGroup: number | null = null
      if (en.supersetWithPrevious) {
        group += 1
        supersetGroup = group
        // the previous entry joins the same group
        await db
          .update(templateExercise)
          .set({ supersetGroup })
          .where(sql`${templateExercise.templateId} = ${trow.id} and ${templateExercise.orderIndex} = ${ei - 1}`)
      }
      const eValues = {
        templateId: trow.id,
        exerciseId,
        orderIndex: ei,
        sets: en.sets,
        lo: en.lo,
        hi: en.hi,
        restSeconds: ei === 0 ? data.restSecondsFirstExercise : null,
        supersetGroup,
      }
      await db
        .insert(templateExercise)
        .values(eValues)
        .onConflictDoUpdate({
          target: [templateExercise.templateId, templateExercise.orderIndex],
          set: { exerciseId, sets: en.sets, lo: en.lo, hi: en.hi, restSeconds: eValues.restSeconds, supersetGroup },
        })
    }
  }
  return { programId: prog.id }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  const { db, close, kind } = await createDb(url)
  console.log(`Seeding program v${PROGRAM_V2.program.version} (${kind})`)
  await seedProgram(db)
  await close()
  console.log('Seed complete')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

// Backfill the 16-week PBO check-in task for journeys whose pregnancy was
// confirmed BEFORE the auto-task feature shipped.
//
// Defaults to dry-run. Pass --apply to actually create tasks.
//
// Run:
//   node scripts/backfill-16wk-pbo-tasks.mjs           # dry-run
//   node scripts/backfill-16wk-pbo-tasks.mjs --apply   # create tasks
//
// Eligibility per journey:
//   - journey_data._transfers has at least one entry with heartbeatConfirmed
//   - That same transfer has no lossType (no miscarriage / ectopic / chemical)
//   - The journey is not delivered (journey_data.delivered !== true)
//   - The computed 16-week date is in the FUTURE (today or later) — already-
//     past dates are skipped, since the PBO check is moot for surrogates who
//     have already passed 16 weeks
//   - No existing case_task on the journey whose title matches the 16wk PBO
//     pattern (idempotent — re-running is safe)
//
// The 16-week date is computed as transfer.date + 93 days (5-day embryo →
// gestational age at transfer is 2w5d = 19 days; 16w0d = 112 days GA →
// 112 - 19 = 93 days post-transfer). Matches the in-app handler.

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: new URL('../.env', import.meta.url).pathname })

const APPLY = process.argv.includes('--apply')
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

console.log(`Connecting to: ${SUPABASE_URL}`)
console.log(APPLY ? '⚠️  --apply set — will WRITE to the database.' : '🔍 Dry-run — no writes. Pass --apply to actually create tasks.')
console.log('')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const TITLE_PATTERN = '16 Weeks Pregnant, Check on PBO'

const { data: journeys, error } = await supabase
  .from('matched_journeys')
  .select('id, gc_name, assigned_to, journey_data')

if (error) { console.error('Failed to fetch journeys:', error.message); process.exit(1) }
console.log(`Loaded ${journeys.length} matched journeys.`)

const today = new Date().toISOString().split('T')[0]
const candidates = []
let skippedPast = 0

for (const j of journeys) {
  const jd = j.journey_data || {}
  const transfers = Array.isArray(jd._transfers) ? jd._transfers : []
  if (transfers.length === 0) continue
  if (jd.delivered === true) continue

  // Pick the latest transfer that confirmed a heartbeat and didn't end in loss.
  const eligible = [...transfers].reverse().find(t => t?.heartbeatConfirmed && !t?.lossType)
  if (!eligible || !eligible.date) continue

  const transferDate = new Date(eligible.date + 'T12:00:00')
  if (Number.isNaN(transferDate.getTime())) continue
  const sixteenWeekDate = new Date(transferDate.getTime() + 93 * 24 * 60 * 60 * 1000)
  const dueStr = sixteenWeekDate.toISOString().split('T')[0]

  // Skip surrogates who have already passed 16 weeks.
  if (dueStr < today) { skippedPast++; continue }

  candidates.push({
    journeyId: j.id,
    gcName: j.gc_name || 'Surrogate',
    assignedTo: j.assigned_to || null,
    transferDate: eligible.date,
    dueDate: dueStr,
  })
}

console.log(`Found ${candidates.length} journeys not yet at 16 weeks (skipped ${skippedPast} already past 16wk).`)
if (candidates.length === 0) process.exit(0)

// Idempotency: pull existing 16wk PBO tasks across these journeys
const journeyIds = candidates.map(c => c.journeyId)
const { data: existingTasks, error: tErr } = await supabase
  .from('case_tasks')
  .select('id, case_id, case_type, title, status')
  .in('case_id', journeyIds)
  .eq('case_type', 'journey')
  .ilike('title', `%${TITLE_PATTERN}%`)

if (tErr) { console.error('Failed to load existing tasks:', tErr.message); process.exit(1) }

const alreadyHave = new Set(existingTasks.map(t => t.case_id))
const toCreate = candidates.filter(c => !alreadyHave.has(c.journeyId))
const skipped = candidates.length - toCreate.length

console.log(`  - ${skipped} already have a 16wk PBO task (skipping).`)
console.log(`  - ${toCreate.length} need a 16wk PBO task created.`)
console.log('')

for (const c of toCreate) {
  console.log(`  journey=${c.journeyId}  gc="${c.gcName}"  transfer=${c.transferDate}  due=${c.dueDate}  assignee=${c.assignedTo || '(unassigned → fallback)'}`)
}

if (!APPLY) {
  console.log('')
  console.log('Dry-run complete. Re-run with --apply to create the tasks.')
  process.exit(0)
}

console.log('')
console.log(`Creating ${toCreate.length} tasks...`)
let created = 0, failed = 0
for (const c of toCreate) {
  const { error: insErr } = await supabase
    .from('case_tasks')
    .insert({
      case_id: c.journeyId,
      case_type: 'journey',
      title: `${c.gcName} is 16 Weeks Pregnant, Check on PBO`,
      assigned_to: c.assignedTo || 'intake@northstarsurrogacy.com',
      due_date: c.dueDate,
      priority: 'normal',
      status: 'open',
      created_by: 'system-backfill',
    })
  if (insErr) {
    console.error(`  ✗ journey ${c.journeyId}: ${insErr.message}`)
    failed++
  } else {
    created++
  }
}

console.log('')
console.log(`Done. Created: ${created}. Failed: ${failed}.`)

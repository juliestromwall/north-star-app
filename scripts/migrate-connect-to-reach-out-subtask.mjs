// One-shot migration: move "Connect With Applicant" parent logs onto the new
// "Reach out to GC" subtask (config step `reach_out_to_gc_1777906809415`).
//
// Background: surrogates were logged against the parent step before the
// subtask existed. Now that the subtask is in the config, each surrogate's
// status pill is derived from children — leaving the parent's old logs
// stranded in the data.
//
// What this does, per surrogate:
//   - Reads tracking[connect_with_applicant_1775840399269].history + .log
//   - Converts those entries into the new `log` shape and writes them into
//     tracking[reach_out_to_gc_1777906809415].log
//   - Sets the subtask's status from the latest log entry
//   - OVERRIDES any existing subtask log (per user's instruction — they
//     manually patched a few earlier and want the bulk migration to win)
//   - Leaves the parent's history/log alone (as historical record)
//
// Defaults to dry-run. Pass --apply to write.
//
//   node scripts/migrate-connect-to-reach-out-subtask.mjs           # dry-run
//   node scripts/migrate-connect-to-reach-out-subtask.mjs --apply   # write

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: new URL('../.env', import.meta.url).pathname, quiet: true })

const APPLY = process.argv.includes('--apply')
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const PARENT_ID = 'connect_with_applicant_1775840399269'
const SUBTASK_ID = 'reach_out_to_gc_1777906809415'

console.error(`Connecting to: ${SUPABASE_URL}`)
console.error(APPLY ? '⚠️  --apply set — WILL write to the database.' : '🔍 Dry-run — no writes. Pass --apply to actually migrate.')
console.error('')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const { data: surrogates, error } = await supabase
  .from('intake_submissions')
  .select('id, answers')
  .eq('intake_type', 'gc')

if (error) { console.error('Failed to fetch surrogates:', error.message); process.exit(1) }
console.error(`Loaded ${surrogates.length} surrogates.`)

// Map each parent log entry (from history or log) into the new log shape.
function normalizeEntries(entry) {
  const fromHistory = (Array.isArray(entry?.history) ? entry.history : [])
    .filter(h => h && !h._deactivate && !h.auto)
    .map(h => ({
      id: h.id || `log_mig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status: h.status || 'in_progress',
      optionLabel: h.optionLabel || h._optionLabel || '',
      from: '',
      changed_at: h.date ? `${String(h.date).slice(0, 10)}T12:00:00Z` : new Date().toISOString(),
      changed_by: h.by || h.changed_by || 'Migrated',
      note: h.note || '',
    }))
  const fromLog = (Array.isArray(entry?.log) ? entry.log : [])
    .filter(l => l && !l.auto)
    .map(l => ({
      id: l.id || `log_mig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status: l.status || 'in_progress',
      optionLabel: l.optionLabel || l._optionLabel || '',
      from: l.from || '',
      changed_at: l.changed_at || (l.date ? `${String(l.date).slice(0, 10)}T12:00:00Z` : new Date().toISOString()),
      changed_by: l.changed_by || l.by || 'Migrated',
      note: l.note || '',
    }))
  // Combine + sort oldest → newest by changed_at, dedupe by (date, optionLabel, note)
  const combined = [...fromHistory, ...fromLog]
  combined.sort((a, b) => String(a.changed_at).localeCompare(String(b.changed_at)))
  const seen = new Set()
  const deduped = []
  for (const e of combined) {
    const key = `${String(e.changed_at).slice(0, 10)}|${e.optionLabel}|${e.note}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(e)
  }
  return deduped
}

const plan = []
let withSourceLogs = 0
let alreadyHasSubtask = 0

for (const s of surrogates) {
  const tracking = s.answers?._recordTracking || {}
  const parentEntry = tracking[PARENT_ID]
  if (!parentEntry) continue
  const parentHasLogs =
    (Array.isArray(parentEntry.history) && parentEntry.history.some(h => h && !h._deactivate && !h.auto)) ||
    (Array.isArray(parentEntry.log) && parentEntry.log.some(l => l && !l.auto))
  if (!parentHasLogs) continue

  withSourceLogs++
  const subtaskEntry = tracking[SUBTASK_ID]
  if (subtaskEntry && Array.isArray(subtaskEntry.log) && subtaskEntry.log.length > 0) alreadyHasSubtask++

  const newLogs = normalizeEntries(parentEntry)
  if (newLogs.length === 0) continue

  const latest = newLogs[newLogs.length - 1]
  const ans = s.answers || {}
  const name = [ans.firstName, ans.lastName].filter(Boolean).join(' ').trim()
    || ans.legalName || ans.name || `Surrogate #${s.id}`

  plan.push({
    id: s.id,
    name,
    logCount: newLogs.length,
    latestStatus: latest.status,
    latestOption: latest.optionLabel,
    latestDate: String(latest.changed_at).slice(0, 10),
    newLogs,
    existingAnswers: ans,
    existingTracking: tracking,
  })
}

console.error(`Surrogates with parent-step logs: ${withSourceLogs}`)
console.error(`  - of those, ${alreadyHasSubtask} already have subtask log data (will be overridden)`)
console.error(`Plan: migrate ${plan.length} surrogate(s).`)
console.error('')

for (const p of plan) {
  console.error(`  ${p.id}  "${p.name}"  → ${p.logCount} log${p.logCount === 1 ? '' : 's'}  (latest: ${p.latestOption || p.latestStatus} on ${p.latestDate})`)
}

if (!APPLY) {
  console.error('')
  console.error('Dry-run complete. Re-run with --apply to write.')
  process.exit(0)
}

console.error('')
console.error(`Writing ${plan.length} surrogate(s)...`)
let updated = 0, failed = 0
for (const p of plan) {
  const latest = p.newLogs[p.newLogs.length - 1]
  const newSubtaskEntry = {
    ...(p.existingTracking[SUBTASK_ID] || {}),
    status: latest.status,
    _optionLabel: latest.optionLabel || undefined,
    log: p.newLogs,
    history: [], // clear legacy slot now that we've consolidated into log
  }
  const newTracking = { ...p.existingTracking, [SUBTASK_ID]: newSubtaskEntry }
  const newAnswers = { ...p.existingAnswers, _recordTracking: newTracking }

  const { error: upErr } = await supabase
    .from('intake_submissions')
    .update({ answers: newAnswers })
    .eq('id', p.id)

  if (upErr) { console.error(`  ✗ ${p.id} (${p.name}): ${upErr.message}`); failed++ }
  else updated++
}

console.error('')
console.error(`Done. Updated: ${updated}. Failed: ${failed}.`)

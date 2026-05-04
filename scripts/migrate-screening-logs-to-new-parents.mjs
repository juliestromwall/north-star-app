// Move surrogate logs from the OLD step IDs (now nested as children) UP to
// the newly-created parent step IDs. After this runs, the old child steps
// will be empty and admins can delete them via Settings → Edit Mode.
//
// Pairs (source childId → target parentId):
//   background_check    →  background_check_1777910702108
//   mitera              →  mitera_1777910735957
//   psych_screening     →  psych_1777910710690
//   insurance           →  art_risk_insurance_verification_1777910745457
//
// Default dry-run; --apply to write.

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: new URL('../.env', import.meta.url).pathname, quiet: true })

const APPLY = process.argv.includes('--apply')

const PAIRS = [
  { from: 'background_check', to: 'background_check_1777910702108', label: 'Background Check' },
  { from: 'mitera', to: 'mitera_1777910735957', label: 'Mitera' },
  { from: 'psych_screening', to: 'psych_1777910710690', label: 'Psych' },
  { from: 'insurance', to: 'art_risk_insurance_verification_1777910745457', label: 'Insurance' },
]

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

console.error(`Connecting to: ${SUPABASE_URL}`)
console.error(APPLY ? '⚠️  --apply set — WILL write to the database.' : '🔍 Dry-run — no writes. Pass --apply to actually migrate.')
console.error('')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const { data: surrogates, error } = await supabase
  .from('intake_submissions')
  .select('id, answers')
  .eq('intake_type', 'gc')

if (error) { console.error('Failed to fetch surrogates:', error.message); process.exit(1) }

// Normalize source entry's history + log into a single chronological log array.
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

for (const s of surrogates) {
  const tracking = s.answers?._recordTracking || {}
  const ans = s.answers || {}
  const name = [ans.firstName, ans.lastName].filter(Boolean).join(' ').trim()
    || ans.legalName || ans.name || `Surrogate #${s.id}`

  for (const { from, to, label } of PAIRS) {
    const src = tracking[from]
    if (!src) continue
    const hasSrcLogs =
      (Array.isArray(src.history) && src.history.some(h => h && !h._deactivate && !h.auto)) ||
      (Array.isArray(src.log) && src.log.some(l => l && !l.auto))
    if (!hasSrcLogs) continue
    const newLogs = normalizeEntries(src)
    if (newLogs.length === 0) continue
    plan.push({
      id: s.id,
      name,
      pair: label,
      from,
      to,
      logCount: newLogs.length,
      latest: newLogs[newLogs.length - 1],
      newLogs,
      existingAnswers: ans,
      existingTracking: tracking,
    })
  }
}

console.error(`Plan: ${plan.length} migration(s) across ${new Set(plan.map(p => p.id)).size} surrogate(s).`)
console.error('')
for (const p of plan) {
  console.error(`  ${p.id}  "${p.name}"  ${p.pair}: ${p.from} → ${p.to}  (${p.logCount} log${p.logCount === 1 ? '' : 's'}, latest: ${p.latest.optionLabel || p.latest.status} on ${String(p.latest.changed_at).slice(0, 10)})`)
}

if (!APPLY) {
  console.error('')
  console.error('Dry-run complete. Re-run with --apply to write.')
  process.exit(0)
}

// Apply: group by surrogate so we do one write per row.
const bySurr = {}
for (const p of plan) {
  if (!bySurr[p.id]) bySurr[p.id] = { name: p.name, ans: p.existingAnswers, tracking: p.existingTracking, ops: [] }
  bySurr[p.id].ops.push(p)
}

let updated = 0, failed = 0
for (const [id, group] of Object.entries(bySurr)) {
  const newTracking = { ...group.tracking }
  for (const op of group.ops) {
    const latest = op.newLogs[op.newLogs.length - 1]
    newTracking[op.to] = {
      ...(newTracking[op.to] || {}),
      status: latest.status,
      _optionLabel: latest.optionLabel || undefined,
      log: op.newLogs,
      history: [],
    }
  }
  const newAnswers = { ...group.ans, _recordTracking: newTracking }
  const { error: upErr } = await supabase
    .from('intake_submissions')
    .update({ answers: newAnswers })
    .eq('id', id)
  if (upErr) { console.error(`  ✗ ${id} (${group.name}): ${upErr.message}`); failed++ }
  else updated++
}

console.error('')
console.error(`Done. Updated: ${updated} surrogate(s). Failed: ${failed}.`)

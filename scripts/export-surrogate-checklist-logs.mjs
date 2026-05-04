// Export every checklist log entry for surrogates so admins can audit logs
// that may have been "stranded" on parent steps when child steps were added
// later (a parent step's status pill is derived from its children, so the
// parent's own log history can become hard to find in the new UI).
//
// Defaults to all stages. Pass --stage=<id> to filter (e.g. pre-qualification).
//
// Run:
//   node scripts/export-surrogate-checklist-logs.mjs > logs.csv
//   node scripts/export-surrogate-checklist-logs.mjs --stage=pre-qualification > pq-logs.csv

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: new URL('../.env', import.meta.url).pathname, quiet: true })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const stageFilter = (process.argv.find(a => a.startsWith('--stage=')) || '').split('=')[1] || null

console.error(`Connecting to: ${SUPABASE_URL}`)
console.error(stageFilter ? `Filtering: stage=${stageFilter}` : 'No stage filter (all surrogates)')
console.error('')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const { data: stagesRow } = await supabase
  .from('app_config')
  .select('config_value')
  .eq('config_key', 'surrogate_stages')
  .maybeSingle()
const stagesByCase = stagesRow?.config_value || {}

const { data: checklistRow } = await supabase
  .from('app_config')
  .select('config_value')
  .eq('config_key', 'checklist_config')
  .maybeSingle()
const checklistConfig = checklistRow?.config_value || {}

// Build a flat map of stepId → { label, hasChildren, stageId } across the
// surrogate (gc) checklist, all stages.
const stepIndex = {}
for (const [stageId, stageData] of Object.entries(checklistConfig.gc || {})) {
  if (stageFilter && stageId !== stageFilter) continue
  const steps = stageData?.steps || []
  for (const step of steps) {
    stepIndex[step.id] = {
      label: step.label,
      stageId,
      parentId: step.parentId || null,
      hasChildren: false,
    }
  }
  // Second pass: mark parents
  for (const step of steps) {
    if (step.parentId && stepIndex[step.parentId]) {
      stepIndex[step.parentId].hasChildren = true
    }
  }
}

const { data: surrogates, error } = await supabase
  .from('intake_submissions')
  .select('id, answers')
  .eq('intake_type', 'gc')

if (error) { console.error('Failed to fetch surrogates:', error.message); process.exit(1) }
console.error(`Loaded ${surrogates.length} surrogates.`)

function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const header = [
  'surrogate_id', 'surrogate_name', 'stage', 'step_id', 'step_label',
  'has_children_now', 'log_source', 'log_date', 'log_status', 'log_option_label',
  'log_note', 'log_changed_by',
]

const rows = []
let rowCount = 0
let surrogatesWithLogs = 0

for (const s of surrogates) {
  const stageEntry = stagesByCase[s.id] || stagesByCase[String(s.id)]
  const stage = stageEntry?.stage || 'pre-qualification'
  if (stageFilter && stage !== stageFilter) continue

  const tracking = s.answers?._recordTracking || {}
  const ans = s.answers || {}
  const name = [ans.firstName, ans.lastName].filter(Boolean).join(' ').trim()
    || ans.legalName || ans.name || `Surrogate #${s.id}`

  let surrogateHadAny = false

  for (const [stepId, entry] of Object.entries(tracking)) {
    if (!entry || typeof entry !== 'object') continue
    if (entry._isCaseSubtask) continue // case-added subtasks aren't config steps
    const meta = stepIndex[stepId]
    // Only include steps that exist in this filter's config — otherwise we'd
    // dump logs from other stages that aren't relevant.
    if (!meta) continue

    const sources = [
      ...(Array.isArray(entry.log) ? entry.log.map(l => ({ ...l, _src: 'log' })) : []),
      ...(Array.isArray(entry.history) ? entry.history.map(l => ({ ...l, _src: 'history' })) : []),
    ]

    for (const l of sources) {
      if (!l) continue
      if (l._deactivate || l.auto) continue // skip deactivate markers + auto-derived rows
      const date = (l.changed_at || l.date || '').slice(0, 10)
      rows.push([
        s.id,
        name,
        stage,
        stepId,
        meta.label,
        meta.hasChildren ? 'yes' : 'no',
        l._src,
        date,
        l.status || '',
        l.optionLabel || l._optionLabel || '',
        l.note || '',
        l.changed_by || l.by || '',
      ])
      rowCount++
      surrogateHadAny = true
    }
  }
  if (surrogateHadAny) surrogatesWithLogs++
}

console.error(`Surrogates with logs: ${surrogatesWithLogs}`)
console.error(`Total log rows: ${rowCount}`)
console.error('')

// Write CSV to stdout (so user can redirect)
console.log(header.join(','))
for (const row of rows) {
  console.log(row.map(csvEscape).join(','))
}

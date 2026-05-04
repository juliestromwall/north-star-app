// One-shot config edit: re-parent existing screening steps under newly-created
// parent steps. Step IDs stay the same so all surrogate tracking data
// (history, log entries) remains attached automatically — only the
// parent-child relationship in the checklist_config changes.
//
// Mapping (child step ID → new parent step ID):
//   ob_records                       → medical_records_1777910689290
//   delivery_records                 → medical_records_1777910689290
//   ivf_records                      → medical_records_1777910689290
//   pap                              → medical_records_1777910689290
//   ob_clearance_1776983234841       → medical_records_1777910689290
//   records_summary_1776031580426    → records_summary_1777910723174
//   background_check                 → background_check_1777910702108
//   psych_screening                  → psych_1777910710690
//   mitera                           → mitera_1777910735957
//   insurance                        → art_risk_insurance_verification_1777910745457
//   reference_check_1776318522771    → references_1777911412106
//
// Default dry-run; --apply to write.

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: new URL('../.env', import.meta.url).pathname, quiet: true })

const APPLY = process.argv.includes('--apply')
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const REPARENT = {
  ob_records: 'medical_records_1777910689290',
  delivery_records: 'medical_records_1777910689290',
  ivf_records: 'medical_records_1777910689290',
  pap: 'medical_records_1777910689290',
  ob_clearance_1776983234841: 'medical_records_1777910689290',
  records_summary_1776031580426: 'records_summary_1777910723174',
  background_check: 'background_check_1777910702108',
  psych_screening: 'psych_1777910710690',
  mitera: 'mitera_1777910735957',
  insurance: 'art_risk_insurance_verification_1777910745457',
  reference_check_1776318522771: 'references_1777911412106',
}

console.error(`Connecting to: ${SUPABASE_URL}`)
console.error(APPLY ? '⚠️  --apply set — WILL write to the database.' : '🔍 Dry-run — no writes. Pass --apply to actually update.')
console.error('')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const { data: row, error } = await supabase
  .from('app_config')
  .select('config_value')
  .eq('config_key', 'checklist_config')
  .maybeSingle()

if (error) { console.error('Failed to load checklist_config:', error.message); process.exit(1) }

const cfg = row?.config_value
if (!cfg?.gc?.screening?.steps) {
  console.error('checklist_config has no gc.screening.steps — bailing.')
  process.exit(1)
}

const steps = cfg.gc.screening.steps
const stepById = Object.fromEntries(steps.map(s => [s.id, s]))

// Validate before mutating
const issues = []
for (const [childId, parentId] of Object.entries(REPARENT)) {
  const child = stepById[childId]
  const parent = stepById[parentId]
  if (!child) issues.push(`MISSING child: ${childId}`)
  if (!parent) issues.push(`MISSING parent: ${parentId}`)
}
if (issues.length > 0) {
  console.error('Validation failed:')
  for (const i of issues) console.error('  -', i)
  process.exit(1)
}

console.error('Re-parent plan:')
const updatedSteps = steps.map(s => {
  if (REPARENT[s.id]) {
    const newParent = stepById[REPARENT[s.id]]
    const oldParent = s.parentId ? `(was: ${s.parentId})` : '(was: top-level)'
    console.error(`  ${s.id}  "${s.label}"  →  ${newParent.id}  "${newParent.label}"  ${oldParent}`)
    return { ...s, parentId: REPARENT[s.id] }
  }
  return s
})

console.error('')
console.error(`Steps changed: ${Object.keys(REPARENT).length}`)
console.error(`Steps untouched: ${steps.length - Object.keys(REPARENT).length}`)
console.error('')

if (!APPLY) {
  console.error('Dry-run complete. Re-run with --apply to write.')
  process.exit(0)
}

// Build the updated config — preserve everything else
const newConfig = {
  ...cfg,
  gc: {
    ...cfg.gc,
    screening: {
      ...cfg.gc.screening,
      steps: updatedSteps,
    },
  },
}

const { error: upErr } = await supabase
  .from('app_config')
  .update({ config_value: newConfig, updated_at: new Date().toISOString() })
  .eq('config_key', 'checklist_config')

if (upErr) { console.error('Write failed:', upErr.message); process.exit(1) }
console.error('✓ checklist_config updated.')

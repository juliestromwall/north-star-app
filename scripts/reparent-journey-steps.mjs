// One-shot config edit: re-parent existing journey-oversight steps under
// existing parent steps. Step IDs unchanged → no tracking data is touched.
//
// Mapping (child step ID → new parent step ID):
//   send_ips_checklist_1776050184246      → pregnancy_1777175130853 (Pregnant)
//   initiate_pbo_1776050116029            → pregnancy_1777175130853
//   ivf_graduation_1776050130032          → pregnancy_1777175130853
//   birth_guidelines_1776050206083        → pregnancy_1777175130853
//   weekly_updates_1776190185151          → pregnancy_1777175130853
//   escrow_closed                         → final_payments_1776050264180 (Final Payments)
//   ip_background_check_1775853451038     → introductions_1775853375283 (Intros & IP BG Check)
//
// Default dry-run; --apply to write.

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: new URL('../.env', import.meta.url).pathname, quiet: true })

const APPLY = process.argv.includes('--apply')

const REPARENT = {
  send_ips_checklist_1776050184246: 'pregnancy_1777175130853',
  initiate_pbo_1776050116029: 'pregnancy_1777175130853',
  ivf_graduation_1776050130032: 'pregnancy_1777175130853',
  birth_guidelines_1776050206083: 'pregnancy_1777175130853',
  weekly_updates_1776190185151: 'pregnancy_1777175130853',
  escrow_closed: 'final_payments_1776050264180',
  ip_background_check_1775853451038: 'introductions_1775853375283',
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

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
if (!cfg?.gc?.['journey-oversight']?.steps) {
  console.error('checklist_config has no gc.journey-oversight.steps — bailing.')
  process.exit(1)
}

const steps = cfg.gc['journey-oversight'].steps
const stepById = Object.fromEntries(steps.map(s => [s.id, s]))

const issues = []
for (const [childId, parentId] of Object.entries(REPARENT)) {
  if (!stepById[childId]) issues.push(`MISSING child: ${childId}`)
  if (!stepById[parentId]) issues.push(`MISSING parent: ${parentId}`)
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
    const oldParent = s.parentId
      ? `(was: ${stepById[s.parentId]?.label || s.parentId})`
      : '(was: top-level)'
    console.error(`  "${s.label}"  →  "${newParent.label}"  ${oldParent}`)
    return { ...s, parentId: REPARENT[s.id] }
  }
  return s
})

console.error('')
console.error(`Steps changed: ${Object.keys(REPARENT).length}`)
console.error('')

if (!APPLY) {
  console.error('Dry-run complete. Re-run with --apply to write.')
  process.exit(0)
}

const newConfig = {
  ...cfg,
  gc: {
    ...cfg.gc,
    'journey-oversight': {
      ...cfg.gc['journey-oversight'],
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

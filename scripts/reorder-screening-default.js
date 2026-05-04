/**
 * One-off: move "Request Medical Records" to the top of the
 * GC > Screening status list (index 0 = the rendered "Default").
 *
 * Usage:
 *   node scripts/reorder-screening-default.js              (dry run)
 *   node scripts/reorder-screening-default.js --apply      (commit)
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: new URL('../.env', import.meta.url).pathname })

const apply = process.argv.includes('--apply')
const TARGET = 'Request Medical Records'
const STAGE = 'screening'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

console.log(`Target Supabase: ${process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL}`)
console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (pass --apply to commit)'}\n`)

const { data, error } = await supabase
  .from('app_config')
  .select('config_value')
  .eq('config_key', 'status_config')
  .single()
if (error || !data) {
  console.error('Could not load status_config:', error?.message)
  process.exit(1)
}

const cfg = data.config_value
if (!cfg?.gc?.[STAGE]) {
  console.error(`gc.${STAGE} not present in status_config`)
  process.exit(1)
}

const before = cfg.gc[STAGE]
console.log(`Current gc.${STAGE} order:`)
before.forEach((s, i) => console.log(`  ${i === 0 ? '* DEFAULT' : '         '}  ${s}`))

const idx = before.findIndex(s => s.toLowerCase() === TARGET.toLowerCase())
if (idx < 0) {
  console.error(`\n"${TARGET}" not found in gc.${STAGE} — nothing to do.`)
  process.exit(1)
}
if (idx === 0) {
  console.log(`\n"${TARGET}" is already at index 0 — nothing to change.`)
  process.exit(0)
}

const exact = before[idx]
const after = [exact, ...before.filter((_, i) => i !== idx)]

console.log(`\nWill reorder gc.${STAGE} to:`)
after.forEach((s, i) => console.log(`  ${i === 0 ? '* DEFAULT' : '         '}  ${s}`))

if (!apply) {
  console.log('\nDry run complete — re-run with --apply to commit.')
  process.exit(0)
}

const next = { ...cfg, gc: { ...cfg.gc, [STAGE]: after } }
const { error: updErr } = await supabase
  .from('app_config')
  .update({ config_value: next })
  .eq('config_key', 'status_config')
if (updErr) {
  console.error('Update failed:', updErr.message)
  process.exit(1)
}
console.log('\nstatus_config updated.')

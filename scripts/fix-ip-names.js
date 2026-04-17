// Run with: node scripts/fix-ip-names.js
// Fixes IP records to use primaryFirstName/primaryLastName fields

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: new URL('../.env', import.meta.url).pathname })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

const { data: rows, error } = await supabase
  .from('intake_submissions')
  .select('id, answers')
  .eq('intake_type', 'ip')
  .gte('id', 136)

if (error) { console.error(error); process.exit(1) }
console.log(`Found ${rows.length} IP records to fix`)

let fixed = 0
for (const row of rows) {
  const a = row.answers || {}
  const updates = { ...a }
  if (a.ip1FirstName && !a.primaryFirstName) updates.primaryFirstName = a.ip1FirstName
  if (a.ip1LastName && !a.primaryLastName) updates.primaryLastName = a.ip1LastName
  if (a.ip1Dob && !a.primaryDob) updates.primaryDob = a.ip1Dob
  if (a.ip1Email && !a.email) updates.email = a.ip1Email
  if (a.ip1Phone && !a.phone) updates.phone = a.ip1Phone
  if (a.ip2FirstName) updates.hasPartner = 'yes'
  if (!a.ip2FirstName && !a.ip2Email) updates.hasPartner = 'no'
  if (a.city && !a.stateProv) updates.stateProv = a.state || ''

  const { error: updateErr } = await supabase
    .from('intake_submissions')
    .update({ answers: updates })
    .eq('id', row.id)
  if (updateErr) {
    console.error(`  ✗ ID ${row.id}: ${updateErr.message}`)
  } else {
    const name = `${updates.primaryFirstName || ''} ${updates.primaryLastName || ''}`.trim()
    console.log(`  ✓ ID ${row.id}: ${name}`)
    fixed++
  }
}
console.log(`\nFixed ${fixed}/${rows.length} records`)

// Run with: node scripts/import-surrogates.js
// Imports surrogates from CSV into intake_submissions
// Does NOT send any emails or create portal accounts

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load .env file
import { config } from 'dotenv'
config({ path: new URL('../.env', import.meta.url).pathname })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Parse CSV
const csvPath = process.argv[2] || '/Users/juliestromwall/Downloads/Untitled spreadsheet - Sheet1 (1) (1).csv'
const raw = readFileSync(csvPath, 'utf-8')
const lines = raw.split('\n').filter(l => l.trim())
const headers = parseCSVLine(lines[0])

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
    current += ch
  }
  result.push(current.trim())
  return result
}

const rows = lines.slice(1).map(line => {
  const vals = parseCSVLine(line)
  const obj = {}
  headers.forEach((h, i) => { obj[h] = vals[i] || '' })
  return obj
})

console.log(`Parsed ${rows.length} rows from CSV`)

// Deduplicate by email (keep first occurrence)
const seen = new Set()
const unique = []
for (const row of rows) {
  const email = (row['Email'] || '').trim().toLowerCase()
  if (!email || seen.has(email)) continue
  seen.add(email)
  unique.push(row)
}
console.log(`${unique.length} unique surrogates after dedup (${rows.length - unique.length} duplicates removed)`)

// Check which emails already exist in intake_submissions
const { data: existing } = await supabase
  .from('intake_submissions')
  .select('applicant_email')
  .eq('intake_type', 'gc')

const existingEmails = new Set((existing || []).map(e => e.applicant_email?.trim().toLowerCase()))
const toInsert = unique.filter(r => !existingEmails.has(r['Email'].trim().toLowerCase()))
const skipped = unique.length - toInsert.length
console.log(`${skipped} already exist in database, ${toInsert.length} to insert`)

if (toInsert.length === 0) {
  console.log('Nothing to import!')
  process.exit(0)
}

// Convert DOB from MM/DD/YYYY to YYYY-MM-DD
function convertDob(dob) {
  if (!dob) return null
  const parts = dob.split('/')
  if (parts.length !== 3) return null
  const [m, d, y] = parts
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// Build state abbreviation map
const STATE_ABBREVS = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

function expandState(abbrev) {
  if (!abbrev) return ''
  const up = abbrev.trim().toUpperCase()
  return STATE_ABBREVS[up] || abbrev.trim()
}

// Insert
let inserted = 0
let failed = 0
for (const row of toInsert) {
  const firstName = (row['First Name'] || '').replace(/["()]/g, '').trim()
  const lastName = (row['Last Name'] || '').trim()
  const email = (row['Email'] || '').trim().toLowerCase()
  const phone = (row['Phone Number'] || '').trim()
  const dob = convertDob(row['Date Of Birth'])
  const street = [row['Street Address'], row['Street Address 2']].filter(Boolean).join(' ').trim()
  const city = (row['City'] || '').trim()
  const state = expandState(row['State'])
  const zip = (row['Zip Code'] || '').trim()

  const submission = {
    intake_type: 'gc',
    status: 'qualified',
    qualified: true,
    applicant_name: `${firstName} ${lastName}`.trim(),
    applicant_email: email,
    applicant_phone: phone,
    answers: {
      firstName,
      lastName,
      email,
      phone,
      state,
      dob,
      street,
      city,
      zipCode: zip,
    },
    submitted_at: new Date().toISOString(),
    state_region: state,
    dq_reasons: [],
  }

  const { error } = await supabase.from('intake_submissions').insert(submission)
  if (error) {
    console.error(`  FAILED: ${firstName} ${lastName} (${email}):`, error.message)
    failed++
  } else {
    console.log(`  ✓ ${firstName} ${lastName} (${email}) — ${city}, ${state}`)
    inserted++
  }
}

console.log(`\nDone! ${inserted} inserted, ${failed} failed, ${skipped} skipped (already existed)`)

// Run with: node scripts/import-ips.js
// Imports intended parents from CSV into intake_submissions
// Does NOT send any emails or create portal accounts

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load .env file
import { config } from 'dotenv'
config({ path: new URL('../.env', import.meta.url).pathname })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Parse CSV
const csvPath = process.argv[2] || '/Users/juliestromwall/Downloads/IP Import - Sheet6.csv'
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

// Deduplicate by IP1 email (keep LATEST occurrence by date)
const byEmail = {}
for (const row of rows) {
  const email = (row['IP 1 Email'] || '').trim().toLowerCase()
  if (!email) continue
  // Parse date to compare
  const dateStr = row['Date Applied'] || ''
  const parts = dateStr.split('/')
  const dateVal = parts.length === 3 ? new Date(`${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`) : new Date(0)
  if (!byEmail[email] || dateVal > byEmail[email].date) {
    byEmail[email] = { row, date: dateVal }
  }
}
const unique = Object.values(byEmail).map(v => v.row)
console.log(`${unique.length} unique IPs after dedup (${rows.length - unique.length} duplicates removed)`)

// Check which emails already exist in intake_submissions (IP type)
const { data: existing } = await supabase
  .from('intake_submissions')
  .select('applicant_email')
  .eq('intake_type', 'ip')

const existingEmails = new Set((existing || []).map(e => e.applicant_email?.trim().toLowerCase()))
const toInsert = unique.filter(r => !existingEmails.has(r['IP 1 Email'].trim().toLowerCase()))
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

// Admin email lookup
const ADMIN_MAP = {
  'stacie adler': 'stacie@northstarsurrogacy.com',
  'emily rotter': 'emily@northstarsurrogacy.com',
  'desiree melchiori': 'desiree@northstarsurrogacy.com',
  'julie allgood': 'julie@northstarsurrogacy.com',
  'nicole lawson': 'nicole@northstarsurrogacy.com',
}

function getAdminEmail(name) {
  if (!name) return null
  return ADMIN_MAP[name.trim().toLowerCase()] || null
}

// Convert date applied from MM/DD/YYYY to ISO string
function parseAppliedDate(dateStr) {
  if (!dateStr) return new Date().toISOString()
  const parts = dateStr.split('/')
  if (parts.length !== 3) return new Date().toISOString()
  const [m, d, y] = parts
  return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00Z`).toISOString()
}

// Insert
let inserted = 0
let failed = 0
for (const row of toInsert) {
  const ip1First = (row['IP 1 First Name'] || '').trim()
  const ip1Last = (row['IP 1 Last Name'] || '').trim()
  const ip1Email = (row['IP 1 Email'] || '').trim().toLowerCase()
  const ip1Phone = (row['IP1 Phone'] || '').trim()
  const ip1Dob = convertDob(row['IP1 DOB'])

  const ip2First = (row['IP 2 First Name'] || '').trim()
  const ip2Last = (row['IP 2 Last Name'] || '').trim()
  const ip2Email = (row['IP 2 Email'] || '').trim()
  const ip2Phone = (row['IP2 Phone'] || '').trim()
  const ip2Dob = convertDob(row['IP2 DOB'])

  const street = [row['Street Address'], row['Street Address 2']].filter(Boolean).join(' ').trim()
  const city = (row['City'] || '').trim()
  const state = (row['State'] || '').trim()
  const zip = (row['Zip Code'] || '').trim()

  const adminEmail = getAdminEmail(row['Assigned Admin'])
  const submittedAt = parseAppliedDate(row['Date Applied'])

  const hasPartner = !!(ip2First || ip2Email)
  const ip1Name = `${ip1First} ${ip1Last}`.trim()
  const ip2Name = ip2First ? `${ip2First} ${ip2Last}`.trim() : ''
  const displayNames = hasPartner ? `${ip1Name} & ${ip2Name}` : ip1Name

  const submission = {
    intake_type: 'ip',
    status: 'qualified',
    qualified: true,
    applicant_name: displayNames,
    applicant_email: ip1Email,
    applicant_phone: ip1Phone,
    assigned_to: adminEmail,
    answers: {
      // IP1
      ip1FirstName: ip1First,
      ip1LastName: ip1Last,
      ip1Email,
      ip1Phone,
      ip1Dob,
      // IP2
      ip2FirstName: ip2First,
      ip2LastName: ip2Last,
      ip2Email,
      ip2Phone,
      ip2Dob,
      // Shared info
      ipType: hasPartner ? 'couple' : 'single',
      street,
      city,
      state,
      zipCode: zip,
      // Names for display
      firstName: ip1First,
      lastName: ip1Last,
    },
    submitted_at: submittedAt,
  }

  try {
    const { data, error } = await supabase
      .from('intake_submissions')
      .insert(submission)
      .select('id')
      .single()
    if (error) throw error
    inserted++
    console.log(`  ✓ ${displayNames} (${ip1Email}) → ID ${data.id}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${displayNames} (${ip1Email}): ${err.message}`)
  }
}

console.log(`\nDone! Inserted: ${inserted}, Failed: ${failed}, Skipped: ${skipped}`)

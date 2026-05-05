// Read-only export of the current therapist-tracking state. Mirrors the
// API's loadRows() logic so the CSV reflects exactly what Jenny sees.
//
// Run:
//   node scripts/export-therapist-tracking.mjs > therapist-tracking.csv
//
// The script reads .env (production by default — same convention as
// scripts/export-surrogate-checklist-logs.mjs). It does not write anything.
//
// CSV columns:
//   gcId, name, email, phone, ipNames, caseManagerEmail, dueDate, deliveryDate,
//   week10, week20, week30, birthGuidelinesGc, birthGuidelinesIp, postDelivery,
//   customCheckIns, REMOVE_FROM_LIST
//
// Each milestone cell shows current state:
//   ""                    — nothing recorded
//   "complete | 2026-04-15" — status: complete, with completion date if known
//   "skipped | <reason>"    — status: skipped
//   "draft"                 — status: draft (in progress)
//
// To mark something complete in a re-import, overwrite the cell with one of:
//   "complete"              — mark complete (today's date stamped server-side)
//   "complete | 2026-03-10" — mark complete with a specific date
// Put "y" (any truthy string) in REMOVE_FROM_LIST to hide that case from
// Jenny's view.

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: new URL('../.env', import.meta.url).pathname, quiet: true })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

console.error(`Connecting to: ${SUPABASE_URL}`)
console.error('')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function isActiveMatchedJourney(journey) {
  const status = String(journey?.status || '').toLowerCase()
  const stage = String(journey?.stage || '').toLowerCase()
  const state = `${status} ${stage}`
  return !/(broken|cancelled|canceled|failed|terminated|dissolved)/.test(state)
}

function ipDisplayName(ipCase) {
  if (!ipCase) return ''
  const a = ipCase.answers || {}
  const ip1 = `${a.ip1FirstName || ''} ${a.ip1LastName || ''}`.trim()
  const ip2 = `${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim()
  if (ip1 && ip2) return `${ip1} & ${ip2}`
  return ip1 || ip2 || ''
}

const [{ data: trackingRow }, { data: checkinsRow }, { data: gcs }, { data: ips }, { data: journeys }] = await Promise.all([
  supabase.from('app_config').select('config_value').eq('config_key', 'psych_tracking').maybeSingle(),
  supabase.from('app_config').select('config_value').eq('config_key', 'psych_checkins').maybeSingle(),
  supabase.from('intake_submissions').select('id,applicant_email,answers').eq('intake_type', 'gc').in('status', ['qualified', 'approved', 'reviewed', 'pending_review']).order('submitted_at', { ascending: false }),
  supabase.from('intake_submissions').select('id,answers').eq('intake_type', 'ip'),
  supabase.from('matched_journeys').select('id,gc_case_id,ip_case_id,assigned_to,status,stage,journey_data').order('created_at', { ascending: false }),
])

const tracking = trackingRow?.config_value || {}
const checkinReports = checkinsRow?.config_value || {}

const gcById = new Map((gcs || []).map(row => {
  const a = row.answers || {}
  return [row.id, {
    id: row.id,
    name: `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unknown',
    email: row.applicant_email || a.email || '',
    phone: a.phone || '',
  }]
}))

const ipById = new Map((ips || []).map(row => [row.id, row]))

const rows = []
for (const j of journeys || []) {
  if (!isActiveMatchedJourney(j) || j.journey_data?.pregnant !== 'yes') continue
  const gc = gcById.get(j.gc_case_id)
  if (!gc) continue
  const t = tracking[gc.id] || {}
  const reports = checkinReports[gc.id] || {}
  const jd = j.journey_data || {}
  const ipCase = ipById.get(j.ip_case_id)
  rows.push({
    gcId: gc.id,
    name: gc.name,
    email: gc.email,
    phone: gc.phone,
    ipNames: ipDisplayName(ipCase),
    caseManagerEmail: j.assigned_to || jd.assigned_to || '',
    dueDate: jd.dueDate || '',
    deliveryDate: jd.deliveryDate || '',
    tracking: t,
    reports,
    hidden: Boolean(t._hiddenFromTherapist),
  })
}

// Manual rows (added via admin UI without a journey).
for (const [key, val] of Object.entries(tracking)) {
  if (!key.startsWith('manual_') || !val?._manual) continue
  rows.push({
    gcId: key,
    name: val.name || 'Unknown',
    email: val.email || '',
    phone: val.phone || '',
    ipNames: val.ipNames || '',
    caseManagerEmail: '',
    dueDate: val.dueDate || '',
    deliveryDate: val.deliveryDate || '',
    tracking: val,
    reports: checkinReports[key] || {},
    hidden: Boolean(val._hiddenFromTherapist),
  })
}

function milestoneCell(report, trackingDate) {
  const status = report?.status
  if (status === 'complete') {
    const date = trackingDate || (report.completedAt ? report.completedAt.slice(0, 10) : '')
    return date ? `complete | ${date}` : 'complete'
  }
  if (status === 'skipped') {
    const reason = (report.skipReason || '').replace(/[\r\n]+/g, ' ').slice(0, 120)
    return reason ? `skipped | ${reason}` : 'skipped'
  }
  if (status === 'draft') return 'draft'
  if (trackingDate) return `complete | ${trackingDate}`
  return ''
}

function customCheckInsCell(row) {
  const customs = Array.isArray(row.tracking.customCheckIns) ? row.tracking.customCheckIns : []
  if (!customs.length) return ''
  return customs.map(c => {
    const cell = milestoneCell(row.reports[c.id], '')
    return `${c.label || 'Misc'} (${c.duration || 30}m): ${cell || '—'}`
  }).join(' ; ')
}

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const headers = [
  'gcId', 'name', 'email', 'phone', 'ipNames', 'caseManagerEmail',
  'dueDate', 'deliveryDate',
  'week10', 'week20', 'week30',
  'birthGuidelinesGc', 'birthGuidelinesIp', 'postDelivery',
  'customCheckIns', 'REMOVE_FROM_LIST',
]
console.log(headers.join(','))

for (const row of rows) {
  const t = row.tracking
  const r = row.reports
  const line = [
    row.gcId,
    row.name,
    row.email,
    row.phone,
    row.ipNames,
    row.caseManagerEmail,
    row.dueDate,
    row.deliveryDate,
    milestoneCell(r.week10, t.week10),
    milestoneCell(r.week20, t.week20),
    milestoneCell(r.week30, t.week30),
    milestoneCell(r.birthGuidelinesGc, t.birthGuidelinesGc || t.birthGuidelines),
    milestoneCell(r.birthGuidelinesIp, t.birthGuidelinesIp),
    milestoneCell(r.postDelivery, t.postDelivery),
    customCheckInsCell(row),
    row.hidden ? 'y' : '',
  ].map(csvEscape).join(',')
  console.log(line)
}

console.error(`\nExported ${rows.length} rows.`)

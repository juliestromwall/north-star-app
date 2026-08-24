import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Brain, Lock, Eye, EyeOff, ShieldCheck, Loader2, ClipboardCheck, FileText, User, Phone, ClipboardList, DollarSign, MessageSquare, Calendar, Check, Pencil, ChevronRight, Plus, X, Mail, Baby } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import RichTextEditor from '@/components/shared/RichTextEditor'
import { formatDate } from '@/lib/utils'

// Therapist defaults (pre-filled but editable)
const THERAPIST_DEFAULTS = {
  therapistName: 'Jenny Oliver-Miramontes, LMFT',
  signatureName: 'Jennifer Oliver-Miramontes',
  signatureCredentials: 'LMFT, MA',
  signatureLicense: '51961',
}

// Hardcoded clinician info used as the "From" block on generated invoices.
const CLINICIAN_INVOICE_INFO = {
  name: 'Jennifer Oliver-Miramontes, LMFT, MA',
  license: '51961',
  npi: '1124278486',
  addressLines: ['31356 Via Colinas #114', 'Westlake Village, CA 91362-6864'],
  phone: '(310) 213-0027',
}

// Pacific Time formatting helpers
const PT_TZ = 'America/Los_Angeles'

function formatPTDate(d) {
  return d.toLocaleDateString('en-US', { timeZone: PT_TZ, month: '2-digit', day: '2-digit', year: 'numeric' })
}
function formatPTTime(d) {
  return d.toLocaleTimeString('en-US', { timeZone: PT_TZ, hour: '2-digit', minute: '2-digit', hour12: true })
}
function ptLocalInputValue(iso) {
  const d = iso ? new Date(iso) : new Date()
  const parts = d.toLocaleString('en-US', {
    timeZone: PT_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const m = parts.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s(\d{2}):(\d{2})/)
  if (!m) return ''
  return `${m[3]}-${m[1]}-${m[2]}T${m[4]}:${m[5]}`
}
function ptLocalInputToIso(local) {
  if (!local) return ''
  const [datePart, timePart] = local.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  const asUtc = Date.UTC(y, mo - 1, d, h, mi)
  const guess = new Date(asUtc)
  const ptStr = guess.toLocaleString('en-US', { timeZone: PT_TZ })
  const ptDate = new Date(ptStr)
  const diff = guess.getTime() - ptDate.getTime()
  return new Date(asUtc + diff).toISOString()
}

const MILESTONE_LABELS = {
  week10: '10 Week',
  week20: '20 Week',
  week30: '30 Week',
  birthGuidelinesGc: 'Birth Guidelines (GC)',
  birthGuidelinesIp: 'Birth Guidelines (IP)',
  postDelivery: 'Post Delivery',
  // Legacy key — kept so old data displays a sensible label until backfilled.
  birthGuidelines: 'Birth Guidelines',
}

// Required slots used to determine when a case is "complete" (every required
// milestone is either complete or skipped). Custom check-ins don't count.
const REQUIRED_MILESTONES = ['week10', 'week20', 'week30', 'birthGuidelinesGc', 'birthGuidelinesIp', 'postDelivery']

const BIRTH_GUIDELINES_KEYS = new Set(['birthGuidelinesGc', 'birthGuidelinesIp'])

// Default time-spent (minutes) per milestone — prefilled into the form.
const DEFAULT_TIME_SPENT = {
  week10: 30,
  week20: 30,
  week30: 30,
  postDelivery: 30,
  birthGuidelinesGc: 60,
  birthGuidelinesIp: 60,
}

// Rich-text sections that appear on Birth Guidelines reports.
const BIRTH_PLAN_SECTIONS = [
  { key: 'obInfo', label: 'OB Info' },
  { key: 'hospitalInfo', label: 'Hospital Info' },
  { key: 'note', label: 'Note' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'postDeliveryPlan', label: 'Post Delivery' },
  { key: 'insurance', label: 'Insurance' },
]

function isCustomMilestoneKey(key) {
  return typeof key === 'string' && key.startsWith('custom_')
}

function getMilestoneLabel(key, customCheckIns = []) {
  if (MILESTONE_LABELS[key]) return MILESTONE_LABELS[key]
  if (isCustomMilestoneKey(key)) {
    const found = customCheckIns.find(c => c.id === key)
    return found?.label || 'Misc Consult'
  }
  return key
}

function getDefaultTimeSpent(milestoneKey, customCheckIns = []) {
  if (DEFAULT_TIME_SPENT[milestoneKey]) return DEFAULT_TIME_SPENT[milestoneKey]
  if (isCustomMilestoneKey(milestoneKey)) {
    const found = customCheckIns.find(c => c.id === milestoneKey)
    return found?.duration === 60 ? 60 : 30
  }
  return 30
}

function isCaseComplete(row, checkins) {
  const reports = checkins[row.id] || {}
  return REQUIRED_MILESTONES.every(key => {
    const status = reports[key]?.status
    if (status === 'complete' || status === 'skipped') return true
    // Tracking date counts the same as a completed report (legacy data).
    if (key === 'birthGuidelinesGc' && (row.birthGuidelinesGc || row.birthGuidelines)) return true
    if (row[key]) return true
    return false
  })
}

async function therapistTrackingApi(payload) {
  const res = await fetch('/api/therapist-tracking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Therapist tracking request failed')
  return data
}

function generateCheckinPdfHtml(report, milestoneName, surrogateName) {
  const dt = report.dateTime ? new Date(report.dateTime) : new Date()
  const dateStr = formatPTDate(dt)
  const timeStr = formatPTTime(dt)
  const completedDt = report.completedAt ? new Date(report.completedAt) : dt
  const completedDateStr = formatPTDate(completedDt)
  const completedTimeStr = formatPTTime(completedDt)
  const detailsHtml = report.details || ''
  const licenseStr = report.signatureLicense ? (/^license/i.test(report.signatureLicense) ? report.signatureLicense : 'License ' + report.signatureLicense) : ''

  return `<!DOCTYPE html><html><head>
    <title>${surrogateName} - ${milestoneName} Check-In</title>
    <style>
      @page { size: letter; margin: 0.5in; }
      @media print {
        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .print-bar { display: none !important; }
        .content { padding: 0 !important; }
      }
      * { box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; margin: 0; padding: 0; color: #1c1917; line-height: 1.5; font-size: 12px; background: white; }
      .print-bar { position: sticky; top: 0; z-index: 100; padding: 12px 24px; background: #1A3638; color: white; display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
      .print-bar button { background: white; color: #1A3638; border: none; padding: 7px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
      .content { max-width: 760px; margin: 0 auto; padding: 28px 32px; }
      .title { font-size: 22px; font-weight: 700; color: #1A3638; margin: 0 0 4px 0; text-align: center; }
      .subtitle { font-size: 11px; color: #78716c; text-align: center; margin: 0 0 14px 0; letter-spacing: 0.04em; text-transform: uppercase; }
      .top-divider { border: none; border-top: 2px solid #1A3638; margin: 0 0 18px 0; }
      .header-card { background: #f8f7ff; border: 1px solid #e0e2f0; border-radius: 10px; padding: 12px 16px; margin: 0 0 14px 0; }
      .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 12px; }
      .header-grid .item { display: flex; flex-direction: column; }
      .header-grid .label { font-size: 9px; color: #78716c; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
      .header-grid .value { font-size: 12px; color: #1c1917; font-weight: 500; margin-top: 1px; }
      .section-title { font-size: 11px; font-weight: 700; color: #1A3638; text-transform: uppercase; letter-spacing: 0.07em; margin: 14px 0 6px 0; }
      .info-card { border: 1px solid #e7e5e4; border-radius: 8px; overflow: hidden; margin: 0 0 10px 0; }
      .info-row { display: grid; grid-template-columns: 1fr 1fr 1fr; }
      .info-row > div { padding: 8px 12px; border-right: 1px solid #f5f4f3; }
      .info-row > div:last-child { border-right: none; }
      .info-row .lbl { font-size: 8.5px; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 1px; }
      .info-row .val { font-size: 12px; color: #1c1917; font-weight: 500; }
      .info-row-2 { display: grid; grid-template-columns: 1fr 1fr; }
      .info-row-2 > div { padding: 8px 12px; border-right: 1px solid #f5f4f3; }
      .info-row-2 > div:last-child { border-right: none; }
      .info-row-2 .lbl { font-size: 8.5px; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 1px; }
      .info-row-2 .val { font-size: 12px; color: #1c1917; font-weight: 500; }
      .details-box { background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 14px 16px; font-size: 12px; line-height: 1.65; margin: 4px 0 0 0; }
      .details-box > *:first-child { margin-top: 0; }
      .details-box > *:last-child { margin-bottom: 0; }
      .details-box ul { list-style-type: disc; padding-left: 1.4em; margin: 0.4em 0; }
      .details-box ol { list-style-type: decimal; padding-left: 1.4em; margin: 0.4em 0; }
      .details-box li { margin: 0.2em 0; }
      .details-box li p { margin: 0; }
      .details-box p { margin: 0.4em 0; }
      .details-box strong { font-weight: 600; }
      .details-box em { font-style: italic; }
      .details-box mark { border-radius: 2px; padding: 1px 3px; }
      .details-box img { max-width: 100%; height: auto; border-radius: 6px; margin: 0.5em 0; }
      .signature { margin-top: 18px; padding: 12px 16px; background: #f8f7ff; border: 1px solid #e0e2f0; border-radius: 8px; font-size: 11px; color: #57534e; line-height: 1.6; }
      .signature strong { color: #1A3638; }
    </style>
  </head><body>
    <div class="print-bar">
      <strong>${surrogateName} - ${milestoneName} Check-In</strong>
      <button onclick="window.print()">Save as PDF</button>
    </div>
    <div class="content">
      <h1 class="title">${surrogateName} — ${milestoneName} Check-In</h1>
      <p class="subtitle">Gestational Surrogate</p>
      <hr class="top-divider" />

      <div class="header-card">
        <div class="header-grid">
          <div class="item">
            <span class="label">Note Completed By</span>
            <span class="value">${report.therapistName || ''}</span>
          </div>
          <div class="item">
            <span class="label">Date &amp; Time</span>
            <span class="value">${dateStr} ${timeStr} <span style="color:#a8a29e;font-weight:400;">(PT)</span></span>
          </div>
          <div class="item">
            <span class="label">Method</span>
            <span class="value">${report.communicationMethod || '—'}</span>
          </div>
          <div class="item">
            <span class="label">Reason</span>
            <span class="value">${report.reason || milestoneName + ' Check-In'}</span>
          </div>
        </div>
      </div>

      <p class="section-title">Requested By</p>
      <div class="info-card">
        <div class="info-row">
          <div><div class="lbl">Case Manager</div><div class="val">${report.caseManagerName || '—'}</div></div>
          <div><div class="lbl">Company</div><div class="val">First Star Surrogacy</div></div>
          <div><div class="lbl">Email</div><div class="val" style="word-break:break-all;">${report.caseManagerEmail || '—'}</div></div>
        </div>
      </div>

      <p class="section-title">Billing Information</p>
      <div class="info-card">
        <div class="info-row-2">
          <div><div class="lbl">Time Spent</div><div class="val">${report.timeSpent || '—'}</div></div>
          <div><div class="lbl">Billing</div><div class="val">Patient will not be billed for this communication</div></div>
        </div>
      </div>

      ${(report.birthPlanSections && Object.values(report.birthPlanSections).some(v => (v || '').trim()))
        ? `<p class="section-title">Birth Plan</p>` +
          BIRTH_PLAN_SECTIONS
            .filter(s => (report.birthPlanSections[s.key] || '').trim())
            .map(s => `<div style="margin: 0 0 10px 0;"><div style="font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-bottom:3px;">${s.label}</div><div class="details-box" style="margin:0;">${report.birthPlanSections[s.key]}</div></div>`)
            .join('')
        : ''}

      <p class="section-title">Communication Details</p>
      <div class="details-box">${detailsHtml}</div>

      <div class="signature">
        <strong>${report.signatureName || report.therapistName || ''}</strong>${report.signatureCredentials ? ', ' + report.signatureCredentials : ''}${licenseStr ? ', ' + licenseStr : ''}, signed this note and declared this information to be accurate and complete on ${completedDateStr} at ${completedTimeStr} (Pacific Time).
      </div>
    </div>
  </body></html>`
}

// Invoice amount: 60-min slots = $150, everything else = $100. Custom check-ins
// pull duration from the row's customCheckIns entry.
function getInvoiceAmount(milestoneKey, customCheckIns = []) {
  const minutes = getDefaultTimeSpent(milestoneKey, customCheckIns)
  return minutes >= 60 ? 150 : 100
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// Patient billed on the invoice. birthGuidelinesIp uses the IP name; everything
// else uses the surrogate's name.
function getInvoicePatientName(milestoneKey, row) {
  if (milestoneKey === 'birthGuidelinesIp' && row.ipNames) return row.ipNames
  return row.name
}

function generateInvoiceHtml(report, milestoneKey, row, customCheckIns = []) {
  const milestoneName = getMilestoneLabel(milestoneKey, customCheckIns)
  const patientName = getInvoicePatientName(milestoneKey, row)
  const apptDt = report.dateTime ? new Date(report.dateTime) : new Date()
  const apptDateStr = formatPTDate(apptDt)
  const issuedDt = report.completedAt ? new Date(report.completedAt) : new Date()
  const issuedDateStr = formatPTDate(issuedDt)
  const minutes = getDefaultTimeSpent(milestoneKey, customCheckIns)
  const fee = getInvoiceAmount(milestoneKey, customCheckIns)
  const feeStr = `$${fee.toFixed(2)}`
  const invoiceNumber = `INV-${issuedDt.toISOString().slice(0, 10).replace(/-/g, '')}-${String(row.id || '').slice(-4).toUpperCase() || 'XXXX'}-${milestoneKey.toUpperCase().slice(0, 6)}`
  const docTitle = `Invoice for ${patientName} ${milestoneName}`

  return `<!DOCTYPE html><html><head>
    <title>${escapeHtml(docTitle)}</title>
    <style>
      @page { size: letter; margin: 0.5in; }
      @media print {
        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .print-bar { display: none !important; }
        .content { padding: 0 !important; }
      }
      * { box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; margin: 0; padding: 0; color: #1c1917; line-height: 1.5; font-size: 12px; background: white; }
      .print-bar { position: sticky; top: 0; z-index: 100; padding: 12px 24px; background: #1A3638; color: white; display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
      .print-bar button { background: white; color: #1A3638; border: none; padding: 7px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
      .content { max-width: 760px; margin: 0 auto; padding: 28px 32px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin: 0 0 24px 0; }
      .brand { font-size: 11px; color: #78716c; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
      .brand .name { font-size: 16px; color: #1A3638; font-weight: 700; letter-spacing: 0; text-transform: none; margin-top: 2px; }
      .doc-title { text-align: right; }
      .doc-title h1 { font-size: 28px; font-weight: 700; color: #1A3638; margin: 0 0 6px 0; letter-spacing: 0.04em; }
      .doc-title .meta { font-size: 11px; color: #57534e; line-height: 1.6; }
      .doc-title .meta strong { color: #1c1917; font-weight: 600; }
      .top-divider { border: none; border-top: 2px solid #1A3638; margin: 0 0 20px 0; }
      .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 0 0 22px 0; }
      .party-card { border: 1px solid #e7e5e4; border-radius: 10px; padding: 14px 16px; background: #fafaf9; }
      .party-card .label { font-size: 9px; color: #78716c; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 6px; }
      .party-card .name { font-size: 13px; font-weight: 700; color: #1c1917; margin-bottom: 4px; }
      .party-card .line { font-size: 11.5px; color: #44403c; line-height: 1.55; }
      .patient-bar { background: #f8f7ff; border: 1px solid #e0e2f0; border-radius: 10px; padding: 12px 16px; margin: 0 0 20px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
      .patient-bar .item { display: flex; flex-direction: column; }
      .patient-bar .lbl { font-size: 9px; color: #78716c; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 700; }
      .patient-bar .val { font-size: 13px; color: #1c1917; font-weight: 600; margin-top: 2px; }
      table.lines { width: 100%; border-collapse: collapse; margin: 0 0 6px 0; }
      table.lines thead th { font-size: 10px; color: #78716c; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 700; text-align: left; padding: 10px 12px; border-bottom: 2px solid #1A3638; }
      table.lines thead th.amount { text-align: right; }
      table.lines tbody td { padding: 14px 12px; border-bottom: 1px solid #e7e5e4; font-size: 12px; vertical-align: top; }
      table.lines tbody td.amount { text-align: right; font-variant-numeric: tabular-nums; }
      table.lines tbody td .svc-title { font-weight: 600; color: #1c1917; }
      table.lines tbody td .svc-sub { color: #78716c; font-size: 11px; margin-top: 2px; }
      table.lines tfoot td { padding: 12px; font-size: 13px; }
      table.lines tfoot td.label { text-align: right; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; font-weight: 700; color: #1A3638; }
      table.lines tfoot td.amount { text-align: right; font-weight: 700; font-size: 15px; color: #1c1917; font-variant-numeric: tabular-nums; }
      .footer-note { margin-top: 24px; font-size: 10.5px; color: #a8a29e; text-align: center; letter-spacing: 0.04em; }
    </style>
  </head><body>
    <div class="print-bar">
      <span>${escapeHtml(docTitle)}</span>
      <button onclick="window.print()">Save as PDF</button>
    </div>
    <div class="content">
      <div class="header">
        <div class="brand">
          Invoice from
          <div class="name">${escapeHtml(CLINICIAN_INVOICE_INFO.name)}</div>
        </div>
        <div class="doc-title">
          <h1>INVOICE</h1>
          <div class="meta">
            <strong>${escapeHtml(invoiceNumber)}</strong><br/>
            Issued ${escapeHtml(issuedDateStr)}
          </div>
        </div>
      </div>
      <hr class="top-divider"/>
      <div class="parties">
        <div class="party-card">
          <div class="label">Bill To</div>
          <div class="name">First Star Surrogacy</div>
          <div class="line">Accounts Payable</div>
        </div>
        <div class="party-card">
          <div class="label">From</div>
          <div class="name">${escapeHtml(CLINICIAN_INVOICE_INFO.name)}</div>
          <div class="line">License #${escapeHtml(CLINICIAN_INVOICE_INFO.license)} &nbsp;•&nbsp; NPI ${escapeHtml(CLINICIAN_INVOICE_INFO.npi)}</div>
          ${CLINICIAN_INVOICE_INFO.addressLines.map(l => `<div class="line">${escapeHtml(l)}</div>`).join('')}
          <div class="line">${escapeHtml(CLINICIAN_INVOICE_INFO.phone)}</div>
        </div>
      </div>
      <div class="patient-bar">
        <div class="item">
          <span class="lbl">Patient</span>
          <span class="val">${escapeHtml(patientName)}</span>
        </div>
        <div class="item">
          <span class="lbl">Service Date</span>
          <span class="val">${escapeHtml(apptDateStr)}</span>
        </div>
      </div>
      <table class="lines">
        <thead>
          <tr>
            <th style="width: 110px;">Date</th>
            <th>Service</th>
            <th class="amount" style="width: 110px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(apptDateStr)}</td>
            <td>
              <div class="svc-title">${escapeHtml(milestoneName)} for ${escapeHtml(patientName)}</div>
              <div class="svc-sub">${minutes} min session with ${escapeHtml(CLINICIAN_INVOICE_INFO.name)}</div>
            </td>
            <td class="amount">${feeStr}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td></td>
            <td class="label">Total Due</td>
            <td class="amount">${feeStr}</td>
          </tr>
        </tfoot>
      </table>
      <div class="footer-note">Generated by First Star Surrogacy on ${escapeHtml(issuedDateStr)}</div>
    </div>
  </body></html>`
}

export default function SharedPsychTrackingPage() {
  const { token } = useParams()
  const idleTimer = useRef(null)
  const [valid, setValid] = useState(null) // null = loading, true/false
  const [authed, setAuthed] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false) // true = first time, set password
  const [sessionToken, setSessionToken] = useState('')
  const [idleLoggedOut, setIdleLoggedOut] = useState(false)
  const [rows, setRows] = useState([])
  const [tracking, setTracking] = useState({})
  const [checkins, setCheckins] = useState({})
  const [search, setSearch] = useState('')

  // Password state
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Check-in dialog state
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [checkinRow, setCheckinRow] = useState(null)
  const [checkinMilestone, setCheckinMilestone] = useState(null)
  const [checkinForm, setCheckinForm] = useState({})
  const [checkinSaving, setCheckinSaving] = useState(false)
  const [checkinReadOnly, setCheckinReadOnly] = useState(false)
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)

  // Skip-reason dialog state
  const [skipOpen, setSkipOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [skipSaving, setSkipSaving] = useState(false)

  // Skip Detail Dialog (view reason + withdraw skip)
  const [skipDetailOpen, setSkipDetailOpen] = useState(false)
  const [skipDetailRow, setSkipDetailRow] = useState(null)
  const [skipDetailMilestone, setSkipDetailMilestone] = useState(null)
  const [withdrawSaving, setWithdrawSaving] = useState(false)

  // Custom check-in dialog (Add Check-In)
  const [customOpen, setCustomOpen] = useState(false)
  const [customRow, setCustomRow] = useState(null)
  const [customLabel, setCustomLabel] = useState('Misc Consult')
  const [customDuration, setCustomDuration] = useState(30)
  const [customSaving, setCustomSaving] = useState(false)

  // Active / Completed tab toggle
  const [tab, setTab] = useState('active')

  const SESSION_KEY = useMemo(() => `psych_share_session_${token}`, [token])
  const LAST_ACTIVITY_KEY = useMemo(() => `psych_share_last_activity_${token}`, [token])
  const IDLE_TIMEOUT_MS = 1 * 60 * 60 * 1000

  const expireForIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(LAST_ACTIVITY_KEY)
    setSessionToken('')
    setAuthed(false)
    setIdleLoggedOut(true)
  }, [SESSION_KEY, LAST_ACTIVITY_KEY])

  const resetIdleTimer = useCallback(() => {
    if (!authed || !sessionToken) return
    if (idleTimer.current) clearTimeout(idleTimer.current)
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
    idleTimer.current = setTimeout(() => {
      expireForIdle()
    }, IDLE_TIMEOUT_MS)
  }, [authed, sessionToken, expireForIdle, LAST_ACTIVITY_KEY])

  const loadData = useCallback(async (authToken = sessionToken) => {
    const data = await therapistTrackingApi({ action: 'load', sessionToken: authToken })
    setRows(data.rows || [])
    setCheckins(data.checkins || {})
  }, [sessionToken])

  useEffect(() => {
    async function load() {
      try {
        const status = await therapistTrackingApi({ action: 'status', token })
        if (!status.valid) {
          setValid(false)
          return
        }
        setValid(true)
        setNeedsSetup(status.needsSetup)
      } catch {
        setValid(false)
        return
      }

      // Check if already authenticated this session
      const savedSession = sessionStorage.getItem(SESSION_KEY)
      if (savedSession) {
        try {
          await loadData(savedSession)
          setSessionToken(savedSession)
          setAuthed(true)
          setIdleLoggedOut(false)
        } catch {
          sessionStorage.removeItem(SESSION_KEY)
          localStorage.removeItem(LAST_ACTIVITY_KEY)
          setSessionToken('')
          setAuthed(false)
        }
      }
    }
    load()
  }, [SESSION_KEY, LAST_ACTIVITY_KEY, loadData, token])

  useEffect(() => {
    if (!authed || !sessionToken) return
    const checkForExpiredIdle = () => {
      const raw = localStorage.getItem(LAST_ACTIVITY_KEY)
      const last = Number(raw || 0)
      if (last && Date.now() - last > IDLE_TIMEOUT_MS) {
        expireForIdle()
        return
      }
      resetIdleTimer()
    }
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove']
    const handler = () => resetIdleTimer()
    events.forEach((eventName) => window.addEventListener(eventName, handler, { passive: true }))
    window.addEventListener('focus', checkForExpiredIdle)
    document.addEventListener('visibilitychange', checkForExpiredIdle)
    resetIdleTimer()
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handler))
      window.removeEventListener('focus', checkForExpiredIdle)
      document.removeEventListener('visibilitychange', checkForExpiredIdle)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [authed, sessionToken, resetIdleTimer, expireForIdle, LAST_ACTIVITY_KEY])

  async function handleSetPassword() {
    setPasswordError('')
    if (password.length < 8) { setPasswordError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setPasswordError('Passwords do not match'); return }
    setPasswordSaving(true)
    try {
      const result = await therapistTrackingApi({ action: 'set-password', token, password })
      sessionStorage.setItem(SESSION_KEY, result.sessionToken)
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
      setSessionToken(result.sessionToken)
      setAuthed(true)
      setIdleLoggedOut(false)
      setNeedsSetup(false)
      await loadData(result.sessionToken)
    } catch { setPasswordError('Failed to set password. Please try again.') }
    finally { setPasswordSaving(false) }
  }

  async function handleLogin() {
    setPasswordError('')
    if (!password) { setPasswordError('Please enter your password'); return }
    setPasswordSaving(true)
    try {
      const result = await therapistTrackingApi({ action: 'login', token, password })
      sessionStorage.setItem(SESSION_KEY, result.sessionToken)
      localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
      setSessionToken(result.sessionToken)
      setAuthed(true)
      setIdleLoggedOut(false)
      await loadData(result.sessionToken)
    } catch (err) { setPasswordError(err.message === 'Incorrect password' ? 'Incorrect password' : 'Something went wrong. Please try again.') }
    finally { setPasswordSaving(false) }
  }

  const saveTracking = useCallback(async (updated) => {
    setTracking(updated)
  }, [])

  const saveCheckins = useCallback(async (updated) => {
    setCheckins(updated)
  }, [])

  // An archived journey is always treated as Completed for tab-bucket purposes
  // — Jenny shouldn't be prompted to do new check-ins on a closed case, but
  // the row stays visible so prior check-in history is still browsable.
  const isCaseArchivedOrComplete = (r) => Boolean(r.archivedAt) || isCaseComplete(r, checkins)

  const filtered = useMemo(() => {
    let list = rows
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
    }
    if (tab === 'completed') return list.filter(isCaseArchivedOrComplete)
    return list.filter(r => !isCaseArchivedOrComplete(r))
  }, [rows, search, checkins, tab])

  const counts = useMemo(() => {
    let active = 0, completed = 0
    for (const r of rows) {
      if (isCaseArchivedOrComplete(r)) completed++
      else active++
    }
    return { active, completed }
  }, [rows, checkins])

  async function updateDate(surrogateId, field, value) {
    const updated = { ...tracking, [surrogateId]: { ...tracking[surrogateId], [field]: value } }
    await saveTracking(updated)
  }

  function openCheckinDialog(row, milestoneKey, readOnly = false, { forceFresh = false } = {}) {
    // forceFresh: ignore any existing record (used after withdraw-skip where
    // we just removed the skipped report but React state hasn't flushed yet,
    // so the lookup would still see the stale skipped report and lock the form).
    const existing = forceFresh ? null : checkins[row.id]?.[milestoneKey]
    const milestoneName = getMilestoneLabel(milestoneKey, row.customCheckIns)
    const defaultMin = getDefaultTimeSpent(milestoneKey, row.customCheckIns)
    if (existing) {
      setCheckinForm({ ...existing })
      setCheckinReadOnly(readOnly || existing.status === 'complete' || existing.status === 'skipped')
    } else {
      setCheckinForm({
        therapistName: THERAPIST_DEFAULTS.therapistName,
        dateTime: new Date().toISOString(),
        patientName: row.name,
        caseManagerName: row.caseManagerName || '',
        caseManagerEmail: row.caseManagerEmail || '',
        relationship: 'Self',
        communicationMethod: 'Phone',
        reason: `${milestoneName} Check-In`,
        timeSpent: `${defaultMin} minutes`,
        details: '',
        birthPlanSections: BIRTH_GUIDELINES_KEYS.has(milestoneKey)
          ? Object.fromEntries(BIRTH_PLAN_SECTIONS.map(s => [s.key, '']))
          : undefined,
        signatureName: THERAPIST_DEFAULTS.signatureName,
        signatureCredentials: THERAPIST_DEFAULTS.signatureCredentials,
        signatureLicense: THERAPIST_DEFAULTS.signatureLicense,
        status: 'draft',
        completedAt: null,
        savedAt: null,
      })
      setCheckinReadOnly(false)
    }
    setCheckinRow(row)
    setCheckinMilestone(milestoneKey)
    setCheckinOpen(true)
  }

  function openPdfWindow(report, milestoneKey, surrogateName, customCheckIns = []) {
    const milestoneName = getMilestoneLabel(milestoneKey, customCheckIns)
    const html = generateCheckinPdfHtml(report, milestoneName, surrogateName)
    const win = window.open('', '_blank')
    if (!win) { alert('Please allow popups to view the PDF'); return }
    win.document.write(html)
    win.document.close()
  }

  function openInvoiceWindow(report, milestoneKey, row) {
    const html = generateInvoiceHtml(report, milestoneKey, row, row.customCheckIns)
    const win = window.open('', '_blank')
    if (!win) { alert('Please allow popups to view the invoice'); return }
    win.document.write(html)
    win.document.close()
  }

  async function handleSaveDraft() {
    if (!checkinRow || !checkinMilestone) return
    setCheckinSaving(true)
    try {
      const report = { ...checkinForm, status: 'draft', savedAt: new Date().toISOString() }
      const updatedCheckins = {
        ...checkins,
        [checkinRow.id]: {
          ...(checkins[checkinRow.id] || {}),
          [checkinMilestone]: report,
        },
      }
      await therapistTrackingApi({
        action: 'save-draft',
        sessionToken,
        surrogateId: checkinRow.id,
        milestone: checkinMilestone,
        report,
      })
      await saveCheckins(updatedCheckins)
      setCheckinOpen(false)
    } catch (e) {
      console.error('Failed to save draft:', e)
      alert('Draft could not be saved. Please try again.')
    }
    finally { setCheckinSaving(false) }
  }

  async function handleSubmitReport() {
    if (!checkinRow || !checkinMilestone) return
    setSubmitConfirmOpen(false)
    setCheckinSaving(true)
    try {
      const now = new Date().toISOString()
      const today = new Date().toISOString().split('T')[0]
      const report = { ...checkinForm, status: 'complete', completedAt: now, savedAt: now }
      const milestoneName = getMilestoneLabel(checkinMilestone, checkinRow.customCheckIns)

      // 1. Generate PDF and submit via server-side API (handles RLS bypass)
      const fileName = `${checkinRow.name} - ${milestoneName} Check In.pdf`
      const invoicePatientName = getInvoicePatientName(checkinMilestone, checkinRow)
      const invoiceFileName = `Invoice for ${invoicePatientName} - ${milestoneName}.pdf`
      try {
        if (!String(checkinRow.id).startsWith('manual_')) {
          const html2pdf = (await import('html2pdf.js')).default
          const renderToBase64 = async (html, filename) => {
            const cleanHtml = html.replace(/<div class="print-bar">[\s\S]*?<\/div>/g, '')
            const tempDiv = document.createElement('div')
            tempDiv.innerHTML = cleanHtml
            document.body.appendChild(tempDiv)
            try {
              const blob = await html2pdf().set({
                margin: 0.5,
                filename,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
              }).from(tempDiv).output('blob')
              const arrayBuffer = await blob.arrayBuffer()
              const bytes = new Uint8Array(arrayBuffer)
              let binary = ''
              for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
              return btoa(binary)
            } finally {
              document.body.removeChild(tempDiv)
            }
          }

          const pdfBase64 = await renderToBase64(
            generateCheckinPdfHtml(report, milestoneName, checkinRow.name),
            fileName,
          )
          // Invoice is best-effort — if it flakes, the check-in still submits.
          let invoicePdfBase64 = null
          try {
            invoicePdfBase64 = await renderToBase64(
              generateInvoiceHtml(report, checkinMilestone, checkinRow, checkinRow.customCheckIns),
              invoiceFileName,
            )
          } catch (invErr) {
            console.error('Invoice PDF generation failed:', invErr)
          }

          // Submit to server endpoint
          const submitRes = await fetch('/api/therapist-checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Therapist-Session': sessionToken },
            body: JSON.stringify({
              surrogateId: checkinRow.id,
              surrogateName: checkinRow.name,
              milestoneName,
              pdfBase64,
              fileName,
              invoicePdfBase64,
              invoiceFileName: invoicePdfBase64 ? invoiceFileName : null,
              uploadedBy: report.therapistName || 'Therapist',
              caseManagerEmail: checkinForm.caseManagerEmail || '',
              taskTitle: `${checkinRow.name} ${milestoneName} Check In Complete - Needs Review`,
              taskDescription: `Check-in report submitted by ${report.therapistName || 'Therapist'}. PDF saved to Psych folder.`,
            }),
          })
          const result = await submitRes.json()
          console.log('Check-in submission result:', result)
          if (!submitRes.ok || !result.documentUploaded || !result.taskCreated) {
            throw new Error(result.error || 'PDF upload or task creation failed')
          }
          if (invoicePdfBase64 && !result.invoiceUploaded) {
            console.warn('Invoice upload reported failure:', result.errors)
          }
        }
      } catch (e) {
        console.error('Check-in submission failed:', e)
        alert('The report was not submitted because the PDF or review task could not be saved. Please try again.')
        return
      }

      // 2. Mark report complete only after upload/task creation succeeds.
      await therapistTrackingApi({
        action: 'complete',
        sessionToken,
        surrogateId: checkinRow.id,
        milestone: checkinMilestone,
        report,
      })

      const updatedCheckins = {
        ...checkins,
        [checkinRow.id]: {
          ...(checkins[checkinRow.id] || {}),
          [checkinMilestone]: report,
        },
      }
      await saveCheckins(updatedCheckins)
      const updatedTracking = { ...tracking, [checkinRow.id]: { ...tracking[checkinRow.id], [checkinMilestone]: today } }
      await saveTracking(updatedTracking)
      setRows(currentRows => currentRows.map(row => row.id === checkinRow.id ? { ...row, [checkinMilestone]: today } : row))

      // 3. Open PDF for download
      openPdfWindow(report, checkinMilestone, checkinRow.name, checkinRow.customCheckIns)

      setCheckinOpen(false)
    } catch (e) {
      console.error('Failed to submit report:', e)
      alert('The report could not be submitted. Please try again.')
    }
    finally { setCheckinSaving(false) }
  }

  function openSkipDialog(row, milestone) {
    if (row && milestone) {
      setCheckinRow(row)
      setCheckinMilestone(milestone)
    }
    setSkipReason('')
    setSkipOpen(true)
  }

  async function handleSkipConfirm() {
    if (!checkinRow || !checkinMilestone) return
    setSkipSaving(true)
    try {
      const milestoneName = getMilestoneLabel(checkinMilestone, checkinRow.customCheckIns)
      await therapistTrackingApi({
        action: 'skip',
        sessionToken,
        surrogateId: checkinRow.id,
        milestone: checkinMilestone,
        skipReason,
        surrogateName: checkinRow.name,
        milestoneName,
        therapistName: THERAPIST_DEFAULTS.therapistName,
        caseManagerEmail: checkinRow.caseManagerEmail || '',
      })
      const skippedReport = {
        ...(checkins[checkinRow.id]?.[checkinMilestone] || {}),
        status: 'skipped',
        skipReason,
        skippedAt: new Date().toISOString(),
        skippedBy: THERAPIST_DEFAULTS.therapistName,
      }
      setCheckins(prev => ({
        ...prev,
        [checkinRow.id]: { ...(prev[checkinRow.id] || {}), [checkinMilestone]: skippedReport },
      }))
      setSkipOpen(false)
      setCheckinOpen(false)
    } catch (e) {
      console.error('Failed to skip check-in:', e)
      alert('Could not skip the check-in. Please try again.')
    } finally {
      setSkipSaving(false)
    }
  }

  function openSkipDetailDialog(row, milestone) {
    setSkipDetailRow(row)
    setSkipDetailMilestone(milestone)
    setSkipDetailOpen(true)
  }

  async function handleWithdrawSkip() {
    if (!skipDetailRow || !skipDetailMilestone) return
    setWithdrawSaving(true)
    try {
      const milestoneName = getMilestoneLabel(skipDetailMilestone, skipDetailRow.customCheckIns)
      await therapistTrackingApi({
        action: 'withdraw-skip',
        sessionToken,
        surrogateId: skipDetailRow.id,
        milestone: skipDetailMilestone,
        surrogateName: skipDetailRow.name,
        milestoneName,
        therapistName: THERAPIST_DEFAULTS.therapistName,
        caseManagerEmail: skipDetailRow.caseManagerEmail || '',
      })
      // Drop the skipped report from local state so the cell goes back to "Check In".
      setCheckins(prev => {
        const surrogateRecord = prev[skipDetailRow.id] || {}
        const { [skipDetailMilestone]: _removed, ...rest } = surrogateRecord
        return { ...prev, [skipDetailRow.id]: rest }
      })
      const rowSnapshot = skipDetailRow
      const milestoneSnapshot = skipDetailMilestone
      setSkipDetailOpen(false)
      setSkipDetailRow(null)
      setSkipDetailMilestone(null)
      // Open the regular Check-In form so the therapist can complete it now.
      // forceFresh because the just-removed skip report is still in checkins state.
      openCheckinDialog(rowSnapshot, milestoneSnapshot, false, { forceFresh: true })
    } catch (e) {
      console.error('Failed to withdraw skip:', e)
      alert('Could not withdraw the skip. Please try again.')
    } finally {
      setWithdrawSaving(false)
    }
  }

  function openCustomCheckinDialog(row) {
    setCustomRow(row)
    setCustomLabel('Misc Consult')
    setCustomDuration(30)
    setCustomOpen(true)
  }

  async function handleAddCustomCheckin() {
    if (!customRow) return
    setCustomSaving(true)
    try {
      const res = await therapistTrackingApi({
        action: 'add-custom-checkin',
        sessionToken,
        surrogateId: customRow.id,
        label: customLabel.trim() || 'Misc Consult',
        duration: customDuration,
      })
      const newCheckin = { id: res.id, label: customLabel.trim() || 'Misc Consult', duration: customDuration }
      setRows(prev => prev.map(r => r.id === customRow.id
        ? { ...r, customCheckIns: [...(r.customCheckIns || []), newCheckin] }
        : r))
      setCustomOpen(false)
    } catch (e) {
      console.error('Failed to add custom check-in:', e)
      alert('Could not add the check-in. Please try again.')
    } finally {
      setCustomSaving(false)
    }
  }

  async function handleRemoveCustomCheckin(rowId, checkInId) {
    try {
      await therapistTrackingApi({
        action: 'remove-custom-checkin',
        sessionToken,
        surrogateId: rowId,
        checkInId,
      })
      setRows(prev => prev.map(r => r.id === rowId
        ? { ...r, customCheckIns: (r.customCheckIns || []).filter(c => c.id !== checkInId) }
        : r))
      setCheckins(prev => {
        if (!prev[rowId]?.[checkInId]) return prev
        const next = { ...prev, [rowId]: { ...prev[rowId] } }
        delete next[rowId][checkInId]
        return next
      })
    } catch (e) {
      console.error('Failed to remove custom check-in:', e)
    }
  }

  const milestoneName = checkinMilestone ? getMilestoneLabel(checkinMilestone, checkinRow?.customCheckIns) : ''
  const isBirthGuidelinesMilestone = BIRTH_GUIDELINES_KEYS.has(checkinMilestone)

  if (valid === null) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (valid === false) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4">
          <CardContent className="py-12 text-center">
            <Brain className="size-10 mx-auto mb-3 text-stone-300" />
            <h2 className="text-lg font-semibold text-stone-800 mb-1">Invalid Share Link</h2>
            <p className="text-sm text-stone-500">This link is no longer valid or has been revoked.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Set Password (first time) ──
  if (valid && !authed && needsSetup) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4 rounded-2xl">
          <CardContent className="py-8 px-6 space-y-5">
            <div className="text-center">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="size-7 text-white" />
              </div>
              <h2 className="text-lg font-bold text-stone-800">Secure Your Access</h2>
              <p className="text-sm text-stone-500 mt-1">Create a password to protect this page. You'll use it each time you visit.</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-stone-500 font-medium">Create Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="pr-9"
                    onKeyDown={e => { if (e.key === 'Enter' && confirmPassword) handleSetPassword() }}
                  />
                  <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-stone-500 font-medium">Confirm Password</label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  onKeyDown={e => { if (e.key === 'Enter') handleSetPassword() }}
                />
              </div>
              {passwordError && <p className="text-xs text-red-500 font-medium">{passwordError}</p>}
              <Button className="w-full gap-1.5" style={{ background: 'linear-gradient(135deg, #1F3A3C, #5A9EA2)' }} onClick={handleSetPassword} disabled={passwordSaving}>
                {passwordSaving ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                {passwordSaving ? 'Setting up...' : 'Set Password & Continue'}
              </Button>
            </div>
            <p className="text-[10px] text-stone-400 text-center leading-relaxed">
              This page contains confidential health information protected under HIPAA. Do not share your password or this link with unauthorized individuals.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Enter Password ──
  if (valid && !authed && !needsSetup) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Card className="max-w-sm w-full mx-4 rounded-2xl">
          <CardContent className="py-8 px-6 space-y-5">
            <div className="text-center">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mx-auto mb-3">
                <Lock className="size-7 text-white" />
              </div>
              <h2 className="text-lg font-bold text-stone-800">Password Required</h2>
              <p className="text-sm text-stone-500 mt-1">Enter your password to access the Therapist Check-In sheet.</p>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pr-9"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {idleLoggedOut && <p className="text-xs text-amber-600 font-medium">You were logged out due to inactivity. Please enter your password again.</p>}
              {passwordError && <p className="text-xs text-red-500 font-medium">{passwordError}</p>}
              <Button className="w-full gap-1.5" style={{ background: 'linear-gradient(135deg, #1F3A3C, #5A9EA2)' }} onClick={handleLogin} disabled={passwordSaving}>
                {passwordSaving ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                {passwordSaving ? 'Verifying...' : 'Unlock'}
              </Button>
            </div>
            <p className="text-[10px] text-stone-400 text-center leading-relaxed">
              This page contains confidential health information protected under HIPAA. Do not share your password or this link with unauthorized individuals.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
            <Brain className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-800">Therapist Check-Ins</h1>
            <p className="text-sm text-stone-500">First Star Surrogacy · {rows.length} surrogates</p>
          </div>
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex gap-1 border-b border-stone-200">
            <button
              onClick={() => setTab('active')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'active' ? 'border-[#D4A853] text-[#1A3638]' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
            >
              Active <span className="text-stone-400 text-xs ml-1">{counts.active}</span>
            </button>
            <button
              onClick={() => setTab('completed')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'completed' ? 'border-[#D4A853] text-[#1A3638]' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
            >
              Completed Cases <span className="text-stone-400 text-xs ml-1">{counts.completed}</span>
            </button>
          </div>
          <div className="relative max-w-sm flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {/* Check-In To-Do (Active tab only) */}
        {tab === 'active' && (
          <CheckInTodoPanel
            rows={filtered}
            checkins={checkins}
            onCheckin={(row, milestone) => openCheckinDialog(row, milestone)}
            onSkip={(row, milestone) => openSkipDialog(row, milestone)}
          />
        )}

        {/* Cards */}
        <SharedPsychTable
          rows={filtered}
          checkins={checkins}
          onDateChange={updateDate}
          onCheckin={(row, milestone) => openCheckinDialog(row, milestone)}
          onViewReport={(row, milestone) => {
            const r = checkins[row.id]?.[milestone]
            if (r?.status === 'skipped') openSkipDetailDialog(row, milestone)
            else openCheckinDialog(row, milestone, true)
          }}
          onSkip={(row, milestone) => openSkipDialog(row, milestone)}
          onDownloadPdf={(row, milestone) => {
            const report = checkins[row.id]?.[milestone]
            if (report) openPdfWindow(report, milestone, row.name, row.customCheckIns)
          }}
          onAddCustom={openCustomCheckinDialog}
          onRemoveCustom={handleRemoveCustomCheckin}
        />

        <p className="text-[10px] text-stone-400 text-center pt-4">
          First Star Surrogacy · Shared view · Click "Check In" to complete a milestone
        </p>
      </div>

      {/* Check-In Report Builder Dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="!max-w-[95vw] sm:!max-w-[1400px] !w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b-2 border-[#1A3638]/20">
            <DialogTitle asChild>
              <h2 className="text-2xl font-bold text-[#1A3638] flex items-center gap-2">
                <ClipboardCheck className="size-6 text-[#1A3638]" />
                {checkinRow ? `${checkinRow.name} - ${milestoneName} Check-In` : `${milestoneName} Check-In`}
              </h2>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Therapist + Date/Time + Patient */}
            <div className="rounded-lg bg-stone-50/60 border border-stone-100 p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Therapist Name</label>
                  <Input
                    value={checkinForm.therapistName || ''}
                    onChange={e => setCheckinForm(f => ({ ...f, therapistName: e.target.value }))}
                    placeholder="Dr. Jane Smith"
                    disabled={checkinReadOnly}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Date and Time (Pacific Time)</label>
                  <Input
                    type="datetime-local"
                    value={ptLocalInputValue(checkinForm.dateTime)}
                    onChange={e => setCheckinForm(f => ({ ...f, dateTime: ptLocalInputToIso(e.target.value) }))}
                    disabled={checkinReadOnly}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Method of Communication</label>
                <select
                  value={checkinForm.communicationMethod || 'Phone'}
                  onChange={e => setCheckinForm(f => ({ ...f, communicationMethod: e.target.value }))}
                  disabled={checkinReadOnly}
                  className="w-full h-9 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1A3638]/20 focus:border-[#1A3638] disabled:bg-stone-50 disabled:text-stone-500"
                >
                  <option value="Phone">Phone</option>
                  <option value="Video Call">Video Call</option>
                  <option value="In Person">In Person</option>
                  <option value="Email">Email</option>
                </select>
              </div>
            </div>

            {/* Requested By */}
            <div className="rounded-lg bg-[#88C0C4]/[0.18] border border-[#88C0C4]/40 p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#1A3638] uppercase tracking-wider flex items-center gap-2">
                <User className="size-4" /> Requested By
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Case Manager</label>
                  <Input
                    value={checkinForm.caseManagerName || ''}
                    onChange={e => setCheckinForm(f => ({ ...f, caseManagerName: e.target.value }))}
                    placeholder="Case manager name"
                    disabled={checkinReadOnly}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Company</label>
                  <Input value="First Star Surrogacy" disabled className="bg-white" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-medium text-stone-600">Email</label>
                  <Input
                    type="email"
                    value={checkinForm.caseManagerEmail || ''}
                    onChange={e => setCheckinForm(f => ({ ...f, caseManagerEmail: e.target.value }))}
                    placeholder="email@example.com"
                    disabled={checkinReadOnly}
                  />
                </div>
              </div>
            </div>

            {/* Reason for Communication */}
            <div className="rounded-lg bg-[#88C0C4]/[0.18] border border-[#88C0C4]/40 p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#1A3638] uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="size-4" /> Reason for Communication
              </h3>
              <Input
                value={checkinForm.reason || ''}
                onChange={e => setCheckinForm(f => ({ ...f, reason: e.target.value }))}
                disabled={checkinReadOnly}
              />
            </div>

            {/* Billing Information */}
            <div className="rounded-lg bg-[#88C0C4]/[0.18] border border-[#88C0C4]/40 p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#1A3638] uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="size-4" /> Billing Information
              </h3>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Time Spent</label>
                <Input
                  value={checkinForm.timeSpent || ''}
                  onChange={e => setCheckinForm(f => ({ ...f, timeSpent: e.target.value }))}
                  placeholder="e.g. 30 minutes"
                  disabled={checkinReadOnly}
                />
              </div>
              <p className="text-xs text-stone-500 italic">The patient will not be billed for this communication.</p>
            </div>

            {/* Birth Plan Sections — only shown for Birth Guidelines milestones */}
            {isBirthGuidelinesMilestone && (
              <div className="rounded-lg bg-[#D4A853]/[0.10] border border-[#D4A853]/20 p-4 space-y-4">
                <h3 className="text-sm font-bold text-[#D4A853] uppercase tracking-wider flex items-center gap-2">
                  <ClipboardList className="size-4" /> Birth Plan
                </h3>
                {checkinRow?.ipNames && checkinMilestone === 'birthGuidelinesIp' && (
                  <p className="text-xs text-stone-500">For IP{checkinRow.ipNames ? `: ${checkinRow.ipNames}` : ''}</p>
                )}
                {checkinMilestone === 'birthGuidelinesGc' && (
                  <p className="text-xs text-stone-500">For GC: {checkinRow?.name}</p>
                )}
                {BIRTH_PLAN_SECTIONS.map(section => (
                  <div key={section.key} className="space-y-1.5">
                    <label className="text-xs font-medium text-stone-600">{section.label}</label>
                    {checkinReadOnly ? (
                      <div
                        className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-700 min-h-[60px]"
                        dangerouslySetInnerHTML={{ __html: checkinForm.birthPlanSections?.[section.key] || '<p class="text-stone-400">(empty)</p>' }}
                      />
                    ) : (
                      <RichTextEditor
                        content={checkinForm.birthPlanSections?.[section.key] || ''}
                        onChange={html => setCheckinForm(f => ({ ...f, birthPlanSections: { ...(f.birthPlanSections || {}), [section.key]: html } }))}
                        placeholder={`${section.label}...`}
                        minHeight="80px"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Communication Details */}
            <div className="rounded-lg bg-[#88C0C4]/[0.18] border border-[#88C0C4]/40 p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#1A3638] uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="size-4" /> Communication Details
              </h3>
              {checkinReadOnly ? (
                <div
                  className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-700 min-h-[120px]"
                  dangerouslySetInnerHTML={{ __html: checkinForm.details || '<p class="text-stone-400">(no details)</p>' }}
                />
              ) : (
                <RichTextEditor
                  content={checkinForm.details || ''}
                  onChange={html => setCheckinForm(f => ({ ...f, details: html }))}
                  placeholder="Enter detailed notes about the communication..."
                  minHeight="160px"
                />
              )}
            </div>

            {/* Signature Section */}
            <div className="border-t border-stone-200 pt-4 mt-4">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Signature</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Name</label>
                  <Input
                    value={checkinForm.signatureName || ''}
                    onChange={e => setCheckinForm(f => ({ ...f, signatureName: e.target.value }))}
                    placeholder="Full name"
                    disabled={checkinReadOnly}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Credentials</label>
                  <Input
                    value={checkinForm.signatureCredentials || ''}
                    onChange={e => setCheckinForm(f => ({ ...f, signatureCredentials: e.target.value }))}
                    placeholder="e.g. LMFT, PsyD"
                    disabled={checkinReadOnly}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">License Number</label>
                  <Input
                    value={checkinForm.signatureLicense || ''}
                    onChange={e => setCheckinForm(f => ({ ...f, signatureLicense: e.target.value }))}
                    placeholder="License #"
                    disabled={checkinReadOnly}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {checkinReadOnly ? (
              <>
                <DialogClose asChild><Button variant="outline" size="sm">Close</Button></DialogClose>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                  const report = checkins[checkinRow?.id]?.[checkinMilestone]
                  if (report) openPdfWindow(report, checkinMilestone, checkinRow.name, checkinRow.customCheckIns)
                }}>
                  <FileText className="size-3.5" /> Download PDF
                </Button>
                {checkins[checkinRow?.id]?.[checkinMilestone]?.status === 'complete' && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                    const report = checkins[checkinRow?.id]?.[checkinMilestone]
                    if (report) openInvoiceWindow(report, checkinMilestone, checkinRow)
                  }}>
                    <DollarSign className="size-3.5" /> Download Invoice
                  </Button>
                )}
              </>
            ) : (
              <>
                <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
                <Button size="sm" variant="ghost" className="gap-1.5 text-stone-500 hover:text-amber-700" onClick={openSkipDialog} disabled={checkinSaving}>
                  Skip
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSaveDraft} disabled={checkinSaving}>
                  {checkinSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Save Draft
                </Button>
                <Button size="sm" className="gap-1.5 bg-[#1A3638] hover:bg-[#5A9EA2] text-white" onClick={() => setSubmitConfirmOpen(true)} disabled={checkinSaving}>
                  {checkinSaving ? <Loader2 className="size-3.5 animate-spin" /> : <ClipboardCheck className="size-3.5" />}
                  Submit Report
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Confirmation Dialog */}
      <Dialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="size-5 text-[#1A3638]" />
              Submit Check-In Report?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-stone-600">
            <p>You're about to submit this check-in for <strong className="text-stone-800">{checkinRow?.name}</strong> ({milestoneName} Check-In).</p>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Once submitted:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>The report will be saved as a PDF in the surrogate's Psych folder</li>
                <li>The case manager will be notified to review</li>
                <li>The report will be marked as complete and locked</li>
              </ul>
            </div>
            <p className="text-xs text-stone-500">Are you sure you're ready to submit?</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setSubmitConfirmOpen(false)}>Cancel</Button>
            <Button size="sm" className="gap-1.5 bg-[#1A3638] hover:bg-[#5A9EA2] text-white" onClick={handleSubmitReport} disabled={checkinSaving}>
              {checkinSaving ? <Loader2 className="size-3.5 animate-spin" /> : <ClipboardCheck className="size-3.5" />}
              Yes, Submit Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Skip Reason Dialog */}
      <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Skip {milestoneName}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-stone-600">
            <p>Marking this check-in as skipped for <strong className="text-stone-800">{checkinRow?.name}</strong>. Add a quick reason so the case file has context.</p>
            <textarea
              value={skipReason}
              onChange={e => setSkipReason(e.target.value)}
              placeholder="Reason for skipping (e.g. surrogate unreachable, milestone not applicable)"
              rows={3}
              className="w-full text-sm border border-stone-200 rounded-md px-2 py-1.5 bg-white"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setSkipOpen(false)} disabled={skipSaving}>Cancel</Button>
            <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSkipConfirm} disabled={skipSaving || !skipReason.trim()}>
              {skipSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Skip Check-In
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Skip Detail Dialog (view skip reason + withdraw) */}
      <Dialog open={skipDetailOpen} onOpenChange={setSkipDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {skipDetailMilestone ? `${getMilestoneLabel(skipDetailMilestone, skipDetailRow?.customCheckIns)} — Skipped` : 'Skipped Check-In'}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const skipReport = checkins[skipDetailRow?.id]?.[skipDetailMilestone] || {}
            const reason = skipReport.skipReason || ''
            const skippedAt = skipReport.skippedAt ? new Date(skipReport.skippedAt) : null
            const skippedBy = skipReport.skippedBy || ''
            return (
              <div className="space-y-4 text-sm text-stone-600">
                <p>
                  This check-in for <strong className="text-stone-800">{skipDetailRow?.name}</strong> was marked as skipped
                  {skippedAt ? ` on ${formatPTDate(skippedAt)} at ${formatPTTime(skippedAt)} (Pacific Time)` : ''}
                  {skippedBy ? ` by ${skippedBy}` : ''}.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Reason</p>
                  <p className="text-sm text-amber-900 mt-1 whitespace-pre-wrap">{reason || <span className="italic text-amber-500">No reason recorded.</span>}</p>
                </div>
                <p className="text-xs text-stone-500">
                  If this was a mistake, you can withdraw your skip and complete the check-in. The assigned admin will be notified.
                </p>
              </div>
            )
          })()}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setSkipDetailOpen(false)} disabled={withdrawSaving}>Close</Button>
            <Button size="sm" className="gap-1.5 bg-[#1A3638] hover:bg-[#5A9EA2] text-white" onClick={handleWithdrawSkip} disabled={withdrawSaving}>
              {withdrawSaving ? <Loader2 className="size-3.5 animate-spin" /> : <ClipboardCheck className="size-3.5" />}
              Withdraw Skip & Check In
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Custom Check-In Dialog */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              Add Check-In{customRow ? ` — ${customRow.name}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600">Label</label>
              <Input
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                placeholder="Misc Consult"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600">Time</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCustomDuration(30)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${customDuration === 30 ? 'bg-[#1A3638] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >30 min</button>
                <button
                  onClick={() => setCustomDuration(60)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${customDuration === 60 ? 'bg-[#1A3638] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >60 min</button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setCustomOpen(false)} disabled={customSaving}>Cancel</Button>
            <Button size="sm" className="gap-1.5 bg-[#1A3638] hover:bg-[#5A9EA2] text-white" onClick={handleAddCustomCheckin} disabled={customSaving || !customLabel.trim()}>
              {customSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Add Check-In
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Check-In Cell (shared view) ──
// ── Card-based view: each case is its own rounded card with a milestone
//    timeline. Replaces the spreadsheet so the shared therapist view
//    matches the rest of the app's profile-card visual language. ──

const STATION_DEFS = [
  { key: 'week10', label: '10 Week', dateField: 'week10Date' },
  { key: 'week20', label: '20 Week', dateField: 'week20Date' },
  { key: 'week30', label: '30 Week', dateField: 'week30Date' },
  { key: 'birthGuidelinesGc', label: 'Birth Plan · GC', dateField: null },
  { key: 'birthGuidelinesIp', label: 'Birth Plan · IP', dateField: null },
  { key: 'postDelivery', label: 'Post Delivery', dateField: null },
]

function getInitials(name) {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/).filter(p => /^[A-Za-z"]/.test(p))
  if (!parts.length) return name.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function GradientAvatar({ name, accent = 'pink' }) {
  const bg = accent === 'indigo'
    ? 'linear-gradient(135deg, #6366f1, #1A3638)'
    : 'linear-gradient(135deg, #1F3A3C, #5A9EA2)'
  return (
    <div className="size-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: bg }}>
      {getInitials(name)}
    </div>
  )
}

function DueDatePill({ date }) {
  if (!date) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 text-stone-400 text-xs font-medium">
        <Baby className="size-3.5" /> No estimated due date
      </div>
    )
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-50 border border-pink-200 text-pink-700 text-xs font-semibold whitespace-nowrap">
      <Baby className="size-3.5" /> Estimated Due Date {formatDate(date)}
    </div>
  )
}

function MilestoneStation({ row, milestoneKey, label, plannedDate, checkins, onCheckin, onViewReport, onSkip }) {
  const report = checkins[row.id]?.[milestoneKey]
  const status = report?.status
  const isComplete = status === 'complete'
  const isSkipped = status === 'skipped'
  const isDraft = status === 'draft'
  const trackingDate = row[milestoneKey] || null

  // Click target: complete/skipped → view report, draft/none → check-in form.
  const handleClick = () => {
    if (isComplete || isSkipped) onViewReport(row, milestoneKey)
    else onCheckin(row, milestoneKey)
  }

  // Visual style per state.
  let bubbleClass, bubbleIcon, statusText, statusClass
  if (isComplete) {
    bubbleClass = 'bg-emerald-500 text-white border-emerald-500'
    bubbleIcon = <Check className="size-4" strokeWidth={3} />
    statusText = trackingDate ? formatDate(trackingDate) : 'Complete'
    statusClass = 'text-emerald-600 font-semibold'
  } else if (isSkipped) {
    bubbleClass = 'bg-amber-100 text-amber-700 border-amber-300'
    bubbleIcon = <X className="size-4" strokeWidth={3} />
    statusText = 'Skipped'
    statusClass = 'text-amber-700 font-medium'
  } else if (isDraft) {
    bubbleClass = 'bg-amber-50 text-amber-600 border-amber-300'
    bubbleIcon = <Pencil className="size-3.5" />
    statusText = 'Draft'
    statusClass = 'text-amber-600 font-medium'
  } else {
    bubbleClass = 'bg-white text-[#1A3638] border-[#1A3638]/30 group-hover:bg-[#1A3638] group-hover:text-white group-hover:border-[#1A3638]'
    bubbleIcon = <ChevronRight className="size-4" strokeWidth={2.5} />
    statusText = 'Check In'
    statusClass = 'text-[#1A3638] font-semibold group-hover:underline'
  }

  const showSkipLink = !isComplete && !isSkipped && typeof onSkip === 'function'

  return (
    <div className="flex flex-col items-center gap-1 min-w-[88px] flex-1">
      <button
        onClick={handleClick}
        className="group flex flex-col items-center gap-1.5 w-full"
      >
        <div className={`size-9 rounded-full border-2 flex items-center justify-center transition-colors ${bubbleClass}`}>
          {bubbleIcon}
        </div>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-stone-500 text-center leading-tight">{label}</p>
        <p className={`text-[11px] text-center leading-tight ${statusClass}`}>{statusText}</p>
        {plannedDate && !isComplete && !isSkipped && !isDraft && (
          <p className="text-[10px] text-stone-400 leading-tight">~{formatDate(plannedDate)}</p>
        )}
      </button>
      {showSkipLink && (
        <button
          onClick={() => onSkip(row, milestoneKey)}
          className="text-[10px] text-stone-400 hover:text-amber-700 hover:underline transition-colors"
        >
          skip
        </button>
      )}
    </div>
  )
}

function MilestoneTimeline({ row, checkins, onCheckin, onViewReport, onSkip }) {
  return (
    <div className="flex items-start gap-1 overflow-x-auto py-2 -mx-1 px-1">
      {STATION_DEFS.map(station => (
        <MilestoneStation
          key={station.key}
          row={row}
          milestoneKey={station.key}
          label={station.label}
          plannedDate={station.dateField ? row[station.dateField] : null}
          checkins={checkins}
          onCheckin={onCheckin}
          onViewReport={onViewReport}
          onSkip={onSkip}
        />
      ))}
    </div>
  )
}

function CustomCheckInChip({ row, custom, checkins, onCheckin, onViewReport, onSkip, onRemove }) {
  const report = checkins[row.id]?.[custom.id]
  const status = report?.status
  const isComplete = status === 'complete'
  const isSkipped = status === 'skipped'
  const isDraft = status === 'draft'

  let chipClass, statusEl, handleClick
  if (isComplete) {
    chipClass = 'bg-emerald-50 border-emerald-200 text-emerald-700'
    statusEl = (
      <span className="inline-flex items-center gap-1 font-medium">
        <Check className="size-3" strokeWidth={3} />
        {report?.completedAt ? formatDate(report.completedAt) : 'Complete'}
      </span>
    )
    handleClick = () => onViewReport(row, custom.id)
  } else if (isSkipped) {
    chipClass = 'bg-amber-50 border-amber-200 text-amber-700'
    statusEl = <span className="font-medium">Skipped</span>
    handleClick = () => onViewReport(row, custom.id)
  } else if (isDraft) {
    chipClass = 'bg-amber-50/60 border-amber-200 text-amber-600'
    statusEl = <span className="font-medium">Draft</span>
    handleClick = () => onCheckin(row, custom.id)
  } else {
    chipClass = 'bg-white border-[#1A3638]/30 text-[#1A3638] hover:bg-[#1A3638]/5'
    statusEl = <span className="font-semibold">Check In</span>
    handleClick = () => onCheckin(row, custom.id)
  }

  return (
    <div className={`inline-flex items-center gap-2 pl-3 pr-1 py-1.5 rounded-full border text-xs transition-colors ${chipClass}`}>
      <button onClick={handleClick} className="flex items-center gap-2">
        <span className="font-semibold">{custom.label}</span>
        <span className="text-stone-400">· {custom.duration}m</span>
        <span className="text-stone-300">·</span>
        {statusEl}
      </button>
      {!isComplete && !isSkipped && typeof onSkip === 'function' && (
        <button
          onClick={() => onSkip(row, custom.id)}
          className="text-[10px] text-stone-400 hover:text-amber-700"
          title="Skip"
        >
          skip
        </button>
      )}
      {!isComplete && (
        <button
          onClick={() => onRemove(row.id, custom.id)}
          className="size-5 rounded-full text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center"
          title="Remove this check-in slot"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}

function ContactLine({ label, name, email, phone, accent = 'violet' }) {
  const accentClass = accent === 'indigo' ? 'text-[#1A3638] bg-[#1A3638]/10 border-[#1A3638]/20' : 'text-pink-600 bg-pink-50 border-pink-200'
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
      <span className={`inline-flex shrink-0 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border ${accentClass}`}>{label}</span>
      {name && <span className="font-semibold text-stone-800">{name}</span>}
      {email && (
        <span className="inline-flex items-center gap-1 text-stone-500"><Mail className="size-3" /> {email}</span>
      )}
      {phone && (
        <span className="inline-flex items-center gap-1 text-stone-500"><Phone className="size-3" /> {phone}</span>
      )}
    </div>
  )
}

// ── Check-In To-Do panel ─────────────────────────────────────────────
//
// Flat list of every pending standard milestone across the active rows so
// Jenny has a "today / this week" worklist at the top of the page. Each
// row links straight back into the same check-in form a station click
// would open.

// Approximate planned date for milestones that don't have a calculated one.
// Birth Plan: ~36 weeks gestation (≈ dueDate − 28 days). Post Delivery:
// 1 week after deliveryDate, falling back to dueDate.
function computePlannedDate(row, milestoneKey) {
  if (milestoneKey === 'week10') return row.week10Date || null
  if (milestoneKey === 'week20') return row.week20Date || null
  if (milestoneKey === 'week30') return row.week30Date || null
  if (milestoneKey === 'birthGuidelinesGc' || milestoneKey === 'birthGuidelinesIp') {
    if (!row.dueDate) return null
    const d = new Date(row.dueDate + 'T00:00:00')
    d.setDate(d.getDate() - 28)
    return d.toISOString().slice(0, 10)
  }
  if (milestoneKey === 'postDelivery') {
    if (row.deliveryDate) {
      const d = new Date(row.deliveryDate + 'T00:00:00')
      d.setDate(d.getDate() + 7)
      return d.toISOString().slice(0, 10)
    }
    return row.dueDate || null
  }
  return null
}

function getUrgency(plannedDate) {
  if (!plannedDate) return 'unscheduled'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const planned = new Date(plannedDate + 'T00:00:00')
  const diffDays = Math.round((planned - today) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'soon'
  return 'later'
}

function getPendingMilestoneItems(rows, checkins) {
  const items = []
  for (const row of rows) {
    if (row.archivedAt) continue
    for (const station of STATION_DEFS) {
      const report = checkins[row.id]?.[station.key]
      const status = report?.status
      if (status === 'complete' || status === 'skipped') continue
      const plannedDate = computePlannedDate(row, station.key)
      const isEstimate = ['birthGuidelinesGc', 'birthGuidelinesIp', 'postDelivery'].includes(station.key)
      items.push({
        row,
        milestoneKey: station.key,
        label: station.label,
        plannedDate,
        plannedDateIsEstimate: isEstimate,
        isDraft: status === 'draft',
        urgency: getUrgency(plannedDate),
      })
    }
  }
  items.sort((a, b) => {
    if (!a.plannedDate && !b.plannedDate) return 0
    if (!a.plannedDate) return 1
    if (!b.plannedDate) return -1
    return a.plannedDate < b.plannedDate ? -1 : 1
  })
  return items
}

function TodoRow({ item, onCheckin, onSkip }) {
  const { row, milestoneKey, label, plannedDate, plannedDateIsEstimate, isDraft, urgency } = item
  const dotClass = {
    overdue: 'bg-red-500 ring-4 ring-red-100',
    soon: 'bg-amber-400 ring-4 ring-amber-100',
    later: 'bg-stone-300',
    unscheduled: 'bg-stone-200',
  }[urgency]
  const dateClass = urgency === 'overdue'
    ? 'text-red-600 font-bold'
    : urgency === 'soon'
      ? 'text-amber-700 font-semibold'
      : 'text-stone-600 font-medium'
  const dateLabel = plannedDate
    ? (plannedDateIsEstimate ? `~${formatDate(plannedDate)}` : formatDate(plannedDate))
    : 'No date'

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-stone-50/60 transition-colors">
      <span className={`size-2.5 rounded-full shrink-0 ${dotClass}`} />
      <span className={`text-xs w-24 shrink-0 ${dateClass}`} title={plannedDateIsEstimate ? 'Estimated date — actual timing varies' : ''}>{dateLabel}</span>
      <span className="text-xs font-semibold text-stone-700 w-32 shrink-0 truncate">{label}</span>
      <span className="text-xs text-stone-800 flex-1 truncate font-medium">{row.name}</span>
      {isDraft && (
        <span className="text-[9px] uppercase tracking-wider font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Draft</span>
      )}
      {urgency === 'overdue' && (
        <span className="text-[9px] uppercase tracking-wider font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Overdue</span>
      )}
      <button
        onClick={() => onCheckin(row, milestoneKey)}
        className="text-[#1A3638] hover:text-white hover:bg-[#1A3638] border border-[#1A3638]/30 hover:border-[#1A3638] text-xs font-semibold whitespace-nowrap px-3 py-1 rounded-full transition-colors"
      >
        {isDraft ? 'Resume' : 'Check In'}
      </button>
      {typeof onSkip === 'function' && (
        <button
          onClick={() => onSkip(row, milestoneKey)}
          className="text-[10px] text-stone-400 hover:text-amber-700 hover:underline transition-colors"
          title="Skip this check-in"
        >
          skip
        </button>
      )}
    </div>
  )
}

function CheckInTodoPanel({ rows, checkins, onCheckin, onSkip }) {
  const [showAll, setShowAll] = useState(false)
  const items = useMemo(() => getPendingMilestoneItems(rows, checkins), [rows, checkins])
  const overdueCount = items.filter(i => i.urgency === 'overdue').length
  const soonCount = items.filter(i => i.urgency === 'soon').length

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-white p-6 text-center">
        <p className="text-sm font-semibold text-emerald-700">🎉 All caught up — no pending check-ins.</p>
      </div>
    )
  }

  const PREVIEW_COUNT = 10
  const visible = showAll ? items : items.slice(0, PREVIEW_COUNT)
  const hiddenCount = items.length - visible.length

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-violet-50/60 to-pink-50/60 border-b border-stone-100">
        <div className="flex items-center gap-2 flex-wrap">
          <ClipboardCheck className="size-4 text-[#1A3638]" />
          <h2 className="text-sm font-semibold text-stone-800">Check-In To-Do</h2>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-600 font-semibold">{items.length} pending</span>
          {overdueCount > 0 && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-semibold">{overdueCount} overdue</span>
          )}
          {soonCount > 0 && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-semibold">{soonCount} this week</span>
          )}
        </div>
      </div>
      <div className="divide-y divide-stone-100">
        {visible.map(item => (
          <TodoRow key={`${item.row.id}-${item.milestoneKey}`} item={item} onCheckin={onCheckin} onSkip={onSkip} />
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2.5 text-xs font-semibold text-[#1A3638] hover:bg-stone-50 border-t border-stone-100 transition-colors"
        >
          Show {hiddenCount} more
        </button>
      )}
      {showAll && items.length > PREVIEW_COUNT && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full py-2.5 text-xs font-semibold text-stone-500 hover:bg-stone-50 border-t border-stone-100 transition-colors"
        >
          Show fewer
        </button>
      )}
    </div>
  )
}

function CaseCard({ row, checkins, onCheckin, onViewReport, onSkip, onAddCustom, onRemoveCustom }) {
  const intendedParents = Array.isArray(row.intendedParents) ? row.intendedParents : []
  const fallbackIpName = !intendedParents.length && row.ipNames ? row.ipNames : ''
  const customs = row.customCheckIns || []
  return (
    <div className={`rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow p-5 space-y-4 ${row.archivedAt ? 'border-stone-200 opacity-90' : 'border-stone-200'}`}>
      {/* Header: avatar, name, due date */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <GradientAvatar name={row.name} accent="pink" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-stone-800 truncate">{row.name}</h3>
              {row.archivedAt && (
                <span className="inline-flex px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-[9px] font-semibold uppercase tracking-wider border border-stone-200">Archived</span>
              )}
            </div>
            <ContactLine label="Surrogate" email={row.email} phone={row.phone} accent="violet" />
            {intendedParents.map((ip, i) => (
              <ContactLine key={i} label={ip.label} name={ip.name} email={ip.email} phone={ip.phone} accent="indigo" />
            ))}
            {fallbackIpName && (
              <ContactLine label="Intended Parent" name={fallbackIpName} accent="indigo" />
            )}
          </div>
        </div>
        <div className="shrink-0">
          <DueDatePill date={row.dueDate} />
          {row.deliveryDate && (
            <div className="mt-1.5 text-right">
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-emerald-600">
                Delivered {formatDate(row.deliveryDate)}
              </span>
            </div>
          )}
        </div>
      </div>

      <hr className="border-stone-100" />

      {/* Milestone timeline */}
      <MilestoneTimeline row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} onSkip={onSkip} />

      {/* Custom check-ins */}
      {(customs.length > 0 || typeof onAddCustom === 'function') && (
        <>
          <hr className="border-stone-100" />
          <div className="space-y-2">
            <h4 className="text-[10px] uppercase tracking-wider font-semibold text-stone-500">Other Check-Ins</h4>
            <div className="flex flex-wrap items-center gap-2">
              {customs.map(c => (
                <CustomCheckInChip
                  key={c.id}
                  row={row}
                  custom={c}
                  checkins={checkins}
                  onCheckin={onCheckin}
                  onViewReport={onViewReport}
                  onSkip={onSkip}
                  onRemove={onRemoveCustom}
                />
              ))}
              {typeof onAddCustom === 'function' && (
                <button
                  onClick={() => onAddCustom(row)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1A3638] bg-[#1A3638]/10 hover:bg-[#88C0C4]/40 border border-[#1A3638]/20 rounded-full transition-colors"
                >
                  <Plus className="size-3.5" /> Add Check-In
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SharedPsychTable({ rows, checkins = {}, onCheckin, onViewReport, onSkip, onAddCustom, onRemoveCustom }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white px-6 py-16 text-center text-stone-400">
        <p className="text-sm">No surrogates found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {rows.map(row => (
        <CaseCard
          key={row.id}
          row={row}
          checkins={checkins}
          onCheckin={onCheckin}
          onViewReport={onViewReport}
          onSkip={onSkip}
          onAddCustom={onAddCustom}
          onRemoveCustom={onRemoveCustom}
        />
      ))}
    </div>
  )
}

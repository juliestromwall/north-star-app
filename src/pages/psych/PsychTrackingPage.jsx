import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Share2, Copy, Check, ExternalLink, Plus, FileText, ClipboardCheck, Loader2, Eye, User, Phone, ClipboardList, DollarSign, MessageSquare } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import RichTextEditor from '@/components/shared/RichTextEditor'
import { fetchSurrogatesFromIntake, getAppConfig, setAppConfig } from '@/lib/db'
import { fetchMatchedJourneys, isActiveMatchedJourney } from '@/lib/matching'
import { fetchAdminUsers } from '@/lib/adminUsers'
import { formatDate } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// Therapist defaults (pre-filled but editable)
const THERAPIST_DEFAULTS = {
  therapistName: 'Jenny Oliver-Miramontes, LMFT',
  signatureName: 'Jennifer Oliver-Miramontes',
  signatureCredentials: 'LMFT, MA',
  signatureLicense: '51961',
}

// Pacific Time formatting helpers
const PT_TZ = 'America/Los_Angeles'

function formatPTDate(d) {
  return d.toLocaleDateString('en-US', { timeZone: PT_TZ, month: '2-digit', day: '2-digit', year: 'numeric' })
}
function formatPTTime(d) {
  return d.toLocaleTimeString('en-US', { timeZone: PT_TZ, hour: '2-digit', minute: '2-digit', hour12: true })
}
// Get ISO string representing "now in Pacific Time" suitable for datetime-local input (YYYY-MM-DDTHH:MM)
function ptLocalInputValue(iso) {
  const d = iso ? new Date(iso) : new Date()
  const parts = d.toLocaleString('en-US', {
    timeZone: PT_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  // en-US produces e.g. "04/14/2026, 13:05" — parse it into YYYY-MM-DDTHH:mm
  const m = parts.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s(\d{2}):(\d{2})/)
  if (!m) return ''
  return `${m[3]}-${m[1]}-${m[2]}T${m[4]}:${m[5]}`
}
// Convert a datetime-local value (user-entered; interpreted as Pacific Time wall-clock) back to an ISO UTC string
function ptLocalInputToIso(local) {
  if (!local) return ''
  // local looks like "2026-04-14T13:05"
  // We treat it as Pacific Time and compute the UTC equivalent.
  const [datePart, timePart] = local.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, mi] = timePart.split(':').map(Number)
  // Start with a UTC timestamp matching those wall-clock numbers, then correct by the PT offset
  const asUtc = Date.UTC(y, mo - 1, d, h, mi)
  // Compute offset between that "as if UTC" instant and what Pacific Time thinks it is at that moment
  // Simpler: construct Date from a PT-formatted string by leveraging Intl
  const guess = new Date(asUtc)
  const ptStr = guess.toLocaleString('en-US', { timeZone: PT_TZ })
  const ptDate = new Date(ptStr)
  const diff = guess.getTime() - ptDate.getTime()
  return new Date(asUtc + diff).toISOString()
}

const TRACKING_KEY = 'psych_tracking'
const CHECKINS_KEY = 'psych_checkins'
const SHARE_KEY = 'psych_tracking_share'

const CHECKIN_COLS = [
  { key: 'week10', label: '10 Week' },
  { key: 'week20', label: '20 Week' },
  { key: 'week30', label: '30 Week' },
  { key: 'birthGuidelinesGc', label: 'Birth Guidelines (GC)' },
  { key: 'birthGuidelinesIp', label: 'Birth Guidelines (IP)' },
  { key: 'postDelivery', label: 'Post Delivery' },
]

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

function getMilestoneLabel(key, customCheckIns = []) {
  if (MILESTONE_LABELS[key]) return MILESTONE_LABELS[key]
  if (typeof key === 'string' && key.startsWith('custom_')) {
    const found = customCheckIns.find(c => c.id === key)
    return found?.label || 'Misc Consult'
  }
  return key
}

// Calculate gestational milestone dates from due date
// Due date = 40 weeks (280 days) from conception
// 10w = conception + 70 days, 20w = +140, 30w = +210
function calcMilestoneDates(dueDate) {
  if (!dueDate) return {}
  const due = new Date(dueDate + 'T00:00:00')
  const conceptionMs = due.getTime() - 280 * 24 * 60 * 60 * 1000
  const fmt = (ms) => new Date(ms).toISOString().split('T')[0]
  return {
    week10Date: fmt(conceptionMs + 70 * 24 * 60 * 60 * 1000),
    week20Date: fmt(conceptionMs + 140 * 24 * 60 * 60 * 1000),
    week30Date: fmt(conceptionMs + 210 * 24 * 60 * 60 * 1000),
  }
}

function generateShareToken() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
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

      /* Title */
      .title { font-size: 22px; font-weight: 700; color: #1A3638; margin: 0 0 4px 0; text-align: center; }
      .subtitle { font-size: 11px; color: #78716c; text-align: center; margin: 0 0 14px 0; letter-spacing: 0.04em; text-transform: uppercase; }
      .top-divider { border: none; border-top: 2px solid #1A3638; margin: 0 0 18px 0; }

      /* Header info card — 2 columns */
      .header-card { background: #f8f7ff; border: 1px solid #e0e2f0; border-radius: 10px; padding: 12px 16px; margin: 0 0 14px 0; }
      .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 12px; }
      .header-grid .item { display: flex; flex-direction: column; }
      .header-grid .label { font-size: 9px; color: #78716c; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
      .header-grid .value { font-size: 12px; color: #1c1917; font-weight: 500; margin-top: 1px; }

      /* Section headers */
      .section-title { font-size: 11px; font-weight: 700; color: #1A3638; text-transform: uppercase; letter-spacing: 0.07em; margin: 14px 0 6px 0; }

      /* Compact 3-column info section */
      .info-card { border: 1px solid #e7e5e4; border-radius: 8px; overflow: hidden; margin: 0 0 10px 0; }
      .info-row { display: grid; grid-template-columns: 1fr 1fr 1fr; }
      .info-row > div { padding: 8px 12px; border-right: 1px solid #f5f4f3; }
      .info-row > div:last-child { border-right: none; }
      .info-row .lbl { font-size: 8.5px; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 1px; }
      .info-row .val { font-size: 12px; color: #1c1917; font-weight: 500; }

      /* 2-column for shorter sections */
      .info-row-2 { display: grid; grid-template-columns: 1fr 1fr; }
      .info-row-2 > div { padding: 8px 12px; border-right: 1px solid #f5f4f3; }
      .info-row-2 > div:last-child { border-right: none; }
      .info-row-2 .lbl { font-size: 8.5px; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 1px; }
      .info-row-2 .val { font-size: 12px; color: #1c1917; font-weight: 500; }

      /* Details box */
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

      /* Signature */
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
          [
            { key: 'obInfo', label: 'OB Info' },
            { key: 'hospitalInfo', label: 'Hospital Info' },
            { key: 'note', label: 'Note' },
            { key: 'preferences', label: 'Preferences' },
            { key: 'postDeliveryPlan', label: 'Post Delivery' },
            { key: 'insurance', label: 'Insurance' },
          ]
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

export default function PsychTrackingPage() {
  const [surrogates, setSurrogates] = useState([])
  const [journeys, setJourneys] = useState([])
  const [tracking, setTracking] = useState({})
  const [checkins, setCheckins] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [manualForm, setManualForm] = useState({ name: '', email: '', phone: '' })

  // Check-in dialog state
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [checkinRow, setCheckinRow] = useState(null)
  const [checkinMilestone, setCheckinMilestone] = useState(null)
  const [checkinForm, setCheckinForm] = useState({})
  const [checkinSaving, setCheckinSaving] = useState(false)
  const [checkinReadOnly, setCheckinReadOnly] = useState(false)
  const [adminUsers, setAdminUsers] = useState([])
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchSurrogatesFromIntake(),
      fetchMatchedJourneys(),
      getAppConfig(TRACKING_KEY),
      getAppConfig(CHECKINS_KEY),
      fetchAdminUsers().catch(() => []),
    ]).then(([gcs, js, saved, savedCheckins, admins]) => {
      setSurrogates(gcs || [])
      setJourneys(js || [])
      setTracking(saved || {})
      setCheckins(savedCheckins || {})
      setAdminUsers(admins || [])
    }).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const saveTracking = useCallback(async (updated) => {
    setTracking(updated)
    await setAppConfig(TRACKING_KEY, updated).catch(() => {})
  }, [])

  const saveCheckins = useCallback(async (updated) => {
    setCheckins(updated)
    await setAppConfig(CHECKINS_KEY, updated).catch(() => {})
  }, [])

  // Build rows: only surrogates with an active pregnancy tracker
  const rows = useMemo(() => {
    const pregnantRows = journeys
      .filter(j => isActiveMatchedJourney(j) && j.journey_data?.pregnant === 'yes')
      .map(j => {
        const gc = surrogates.find(s => s.id === j.gc_case_id)
        if (!gc) return null
        const t = tracking[gc.id] || {}
        // Hidden cases (set via cleanup CSV) drop off the admin tracker too.
        if (t._hiddenFromTherapist) return null
        const jd = j.journey_data || {}
        const milestones = calcMilestoneDates(jd.dueDate)
        // Birth guidelines: legacy `birthGuidelines` falls back into the GC slot.
        const birthGuidelinesGc = t.birthGuidelinesGc || t.birthGuidelines || null
        const birthGuidelinesIp = t.birthGuidelinesIp || null
        return {
          id: gc.id,
          name: gc.name,
          email: gc.email || '',
          phone: gc.phone || '',
          assignedTo: j.assigned_to || jd.assigned_to || gc.assignedTo || '',
          journeyId: j.id,
          journeyPath: `/journeys/${j.id}`,
          casePath: `/surrogates/${gc.id}`,
          dueDate: jd.dueDate || null,
          deliveryDate: jd.deliveryDate || null,
          ...milestones,
          week10: t.week10 || null,
          week20: t.week20 || null,
          week30: t.week30 || null,
          birthGuidelinesGc,
          birthGuidelinesIp,
          birthGuidelines: birthGuidelinesGc,
          postDelivery: t.postDelivery || null,
          customCheckIns: Array.isArray(t.customCheckIns) ? t.customCheckIns : [],
        }
      }).filter(Boolean)

    // Add manual entries from tracking data
    const manualRows = Object.entries(tracking)
      .filter(([key, val]) => key.startsWith('manual_') && val._manual && !val._hiddenFromTherapist)
      .map(([key, val]) => {
        const birthGuidelinesGc = val.birthGuidelinesGc || val.birthGuidelines || null
        const birthGuidelinesIp = val.birthGuidelinesIp || null
        return {
          id: key,
          name: val.name || 'Unknown',
          email: val.email || '',
          phone: val.phone || '',
          journeyPath: null,
          casePath: null,
          manual: true,
          dueDate: val.dueDate || null,
          deliveryDate: val.deliveryDate || null,
          ...calcMilestoneDates(val.dueDate),
          week10: val.week10 || null,
          week20: val.week20 || null,
          week30: val.week30 || null,
          birthGuidelinesGc,
          birthGuidelinesIp,
          birthGuidelines: birthGuidelinesGc,
          postDelivery: val.postDelivery || null,
          customCheckIns: Array.isArray(val.customCheckIns) ? val.customCheckIns : [],
        }
      })

    // Sort by Due Date ascending (soonest first); rows without a dueDate
    // sink to the bottom — same ordering Jenny sees in the shared view.
    return [...pregnantRows, ...manualRows].sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0
    })
  }, [surrogates, journeys, tracking])

  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
  }, [rows, search])

  async function updateDate(surrogateId, field, value) {
    const updated = { ...tracking, [surrogateId]: { ...tracking[surrogateId], [field]: value } }
    await saveTracking(updated)
  }

  function openCheckinDialog(row, milestoneKey, readOnly = false) {
    const existing = checkins[row.id]?.[milestoneKey]
    const milestoneName = getMilestoneLabel(milestoneKey, row.customCheckIns)
    // Find case manager from row.assignedTo (email)
    const assignedEmail = row.assignedTo || ''
    const cm = assignedEmail ? adminUsers.find(a => a.email?.toLowerCase() === assignedEmail.toLowerCase()) : null
    // If admin found, use their name. Otherwise, derive name from email prefix.
    let caseManagerName = cm?.name || ''
    if (!caseManagerName && assignedEmail) {
      const prefix = assignedEmail.split('@')[0]
      caseManagerName = prefix.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
    }
    const caseManagerEmail = cm?.email || assignedEmail
    const isBg = milestoneKey === 'birthGuidelinesGc' || milestoneKey === 'birthGuidelinesIp'
    const defaultMin = milestoneKey === 'birthGuidelinesGc' || milestoneKey === 'birthGuidelinesIp' ? 60
      : (milestoneKey === 'week10' || milestoneKey === 'week20' || milestoneKey === 'week30' || milestoneKey === 'postDelivery') ? 30
      : (typeof milestoneKey === 'string' && milestoneKey.startsWith('custom_'))
        ? ((row.customCheckIns || []).find(c => c.id === milestoneKey)?.duration === 60 ? 60 : 30)
        : 30
    if (existing) {
      setCheckinForm({
        ...existing,
        // Backfill case manager if missing
        caseManagerName: existing.caseManagerName || caseManagerName,
        caseManagerEmail: existing.caseManagerEmail || caseManagerEmail,
      })
      setCheckinReadOnly(readOnly || existing.status === 'complete' || existing.status === 'skipped')
    } else {
      setCheckinForm({
        therapistName: THERAPIST_DEFAULTS.therapistName,
        dateTime: new Date().toISOString(),
        patientName: row.name,
        caseManagerName,
        caseManagerEmail,
        relationship: 'Self',
        communicationMethod: 'Phone',
        reason: `${milestoneName} Check-In`,
        timeSpent: `${defaultMin} minutes`,
        details: '',
        birthPlanSections: isBg ? { obInfo: '', hospitalInfo: '', note: '', preferences: '', postDeliveryPlan: '', insurance: '' } : undefined,
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
      await saveCheckins(updatedCheckins)
      setCheckinOpen(false)
    } catch (e) { console.error('Failed to save draft:', e) }
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

      // 1. Generate PDF and submit via server-side API (handles RLS + uploads + task)
      const fileName = `${checkinRow.name} - ${milestoneName} Check In.pdf`
      try {
        if (!String(checkinRow.id).startsWith('manual_')) {
          const html = generateCheckinPdfHtml(report, milestoneName, checkinRow.name)
          const cleanHtml = html.replace(/<div class="print-bar">[\s\S]*?<\/div>/g, '')
          const html2pdf = (await import('html2pdf.js')).default
          const tempDiv = document.createElement('div')
          tempDiv.innerHTML = cleanHtml
          document.body.appendChild(tempDiv)
          const pdfBlob = await html2pdf().set({
            margin: 0.5,
            filename: fileName,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
          }).from(tempDiv).output('blob')
          document.body.removeChild(tempDiv)
          // Convert blob to base64
          const arrayBuffer = await pdfBlob.arrayBuffer()
          const bytes = new Uint8Array(arrayBuffer)
          let binary = ''
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
          const pdfBase64 = btoa(binary)
          const journey = journeys.find(j => j.gc_case_id === checkinRow.id)
          const { data: authData } = supabase ? await supabase.auth.getSession() : { data: null }
          const authHeaders = authData?.session?.access_token
            ? { Authorization: `Bearer ${authData.session.access_token}` }
            : {}
          const submitRes = await fetch('/api/therapist-checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({
              surrogateId: checkinRow.id,
              surrogateName: checkinRow.name,
              milestoneName,
              pdfBase64,
              fileName,
              uploadedBy: report.therapistName || 'Therapist',
              caseManagerEmail: checkinForm.caseManagerEmail || journey?.assigned_to || journey?.journey_data?.assigned_to || '',
              journeyId: journey?.id || null,
              taskTitle: `${checkinRow.name} ${milestoneName} Check In Complete - Needs Review`,
              taskDescription: `Check-in report submitted by ${report.therapistName || 'Therapist'}. PDF saved to Psych folder.`,
            }),
          })
          const result = await submitRes.json()
          console.log('Check-in submission result:', result)
          if (!submitRes.ok || !result.success || !result.documentUploaded || !result.taskCreated) {
            throw new Error(result.error || 'PDF upload or task creation failed')
          }
        }
      } catch (e) {
        console.error('Check-in submission failed:', e)
        alert('The report was not submitted because the PDF or review task could not be saved. Please try again.')
        return
      }

      // 2. Save report to psych_checkins only after upload/task creation succeeds.
      const updatedCheckins = {
        ...checkins,
        [checkinRow.id]: {
          ...(checkins[checkinRow.id] || {}),
          [checkinMilestone]: report,
        },
      }
      await saveCheckins(updatedCheckins)

      // 3. Mark the milestone date as today in psych_tracking
      const updatedTracking = { ...tracking, [checkinRow.id]: { ...tracking[checkinRow.id], [checkinMilestone]: today } }
      await saveTracking(updatedTracking)

      // Open PDF in new window for therapist to download
      openPdfWindow(report, checkinMilestone, checkinRow.name, checkinRow.customCheckIns)

      setCheckinOpen(false)
    } catch (e) { console.error('Failed to submit report:', e) }
    finally { setCheckinSaving(false) }
  }

  async function handleShare() {
    let shareData = await getAppConfig(SHARE_KEY).catch(() => null)
    if (!shareData?.token) {
      const token = generateShareToken()
      shareData = { token, createdAt: new Date().toISOString() }
      await setAppConfig(SHARE_KEY, shareData).catch(() => {})
    }
    const url = `${window.location.origin}/therapist-tracking/share/${shareData.token}`
    setShareUrl(url)
    setShareOpen(true)
    setCopied(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveManualEntry() {
    if (!manualForm.name.trim()) return
    const id = `manual_${Date.now()}`
    const updated = {
      ...tracking,
      [id]: {
        _manual: true,
        name: manualForm.name.trim(),
        email: manualForm.email.trim(),
        phone: manualForm.phone.trim(),
      },
    }
    await saveTracking(updated)
    setAddOpen(false)
    setManualForm({ name: '', email: '', phone: '' })
  }

  if (loading) return <div className="p-8 text-center text-stone-400 text-sm">Loading...</div>

  const milestoneName = checkinMilestone ? getMilestoneLabel(checkinMilestone, checkinRow?.customCheckIns) : ''
  const isBirthGuidelinesMilestoneAdmin = checkinMilestone === 'birthGuidelinesGc' || checkinMilestone === 'birthGuidelinesIp'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Therapist Check-Ins"
        subtitle={`${rows.length} pregnant surrogates tracked`}
        actions={<>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setManualForm({ name: '', email: '', phone: '' }); setAddOpen(true) }}>
            <Plus className="size-3.5" /> Add Surrogate
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleShare}>
            <Share2 className="size-3.5" /> Share Link
          </Button>
        </>}
      />

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <PsychTable
        rows={filtered}
        checkins={checkins}
        onDateChange={updateDate}
        onCheckin={(row, milestone) => openCheckinDialog(row, milestone)}
        onViewReport={(row, milestone) => openCheckinDialog(row, milestone, true)}
        onDownloadPdf={(row, milestone) => {
          const report = checkins[row.id]?.[milestone]
          if (report) openPdfWindow(report, milestone, row.name, row.customCheckIns)
        }}
      />

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
            {isBirthGuidelinesMilestoneAdmin && (
              <div className="rounded-lg bg-[#D4A853]/[0.10] border border-[#D4A853]/20 p-4 space-y-4">
                <h3 className="text-sm font-bold text-[#D4A853] uppercase tracking-wider flex items-center gap-2">
                  <ClipboardList className="size-4" /> Birth Plan
                </h3>
                {checkinMilestone === 'birthGuidelinesIp' && checkinRow?.ipNames && (
                  <p className="text-xs text-stone-500">For IP: {checkinRow.ipNames}</p>
                )}
                {checkinMilestone === 'birthGuidelinesGc' && (
                  <p className="text-xs text-stone-500">For GC: {checkinRow?.name}</p>
                )}
                {[
                  { key: 'obInfo', label: 'OB Info' },
                  { key: 'hospitalInfo', label: 'Hospital Info' },
                  { key: 'note', label: 'Note' },
                  { key: 'preferences', label: 'Preferences' },
                  { key: 'postDeliveryPlan', label: 'Post Delivery' },
                  { key: 'insurance', label: 'Insurance' },
                ].map(section => (
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
              </>
            ) : (
              <>
                <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
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
                <li>A task will be created for the case manager to review</li>
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

      {/* Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-4 text-violet-500" /> Share Therapist Check-Ins
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600">
            This link is password-protected. The recipient will set a password on their first visit.
          </p>
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="text-xs" />
            <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={copyLink}>
              {copied ? <><Check className="size-3.5 text-emerald-500" /> Copied</> : <><Copy className="size-3.5" /> Copy</>}
            </Button>
          </div>
          <Button variant="outline" size="sm" className="text-xs gap-1 text-amber-600 hover:bg-amber-50" onClick={async () => {
            if (!confirm('Reset the shared link password? The recipient will need to set a new password on their next visit.')) return
            const shareData = await getAppConfig(SHARE_KEY).catch(() => null)
            if (shareData) {
              const rest = { ...shareData }
              delete rest.passwordHash
              delete rest.passwordSetAt
              await setAppConfig(SHARE_KEY, rest).catch(() => {})
            }
          }}>
            Reset Password
          </Button>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Done</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Surrogate Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Surrogate to Therapist Check-Ins</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600">Name *</label>
              <Input value={manualForm.name} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} placeholder="First Last" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600">Email</label>
              <Input value={manualForm.email} onChange={e => setManualForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-stone-600">Phone</label>
              <Input value={manualForm.phone} onChange={e => setManualForm(f => ({ ...f, phone: e.target.value }))} placeholder="xxx-xxx-xxxx" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={saveManualEntry} disabled={!manualForm.name.trim()} className="bg-[#D4A853] hover:bg-[#d4127d] text-white gap-1">
              <Plus className="size-3.5" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Check-In Cell (replaces EditableDateCell for milestone columns) ──
function CheckInCell({ value, milestoneKey, row, checkins, onCheckin, onViewReport }) {
  const report = checkins[row.id]?.[milestoneKey]
  const isDraft = report?.status === 'draft'
  const isComplete = report?.status === 'complete'
  const isSkipped = report?.status === 'skipped'

  if (isSkipped) {
    return (
      <button
        onClick={() => onViewReport(row, milestoneKey)}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full hover:bg-amber-100 transition-colors"
        title={report?.skipReason ? `Skipped: ${report.skipReason}` : 'Skipped'}
      >
        Skipped
      </button>
    )
  }

  if (isComplete) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-emerald-600 font-medium text-xs">{value ? formatDate(value) : 'Complete'}</span>
        <button
          onClick={() => onViewReport(row, milestoneKey)}
          className="text-[#1A3638] hover:text-[#5A9EA2] transition-colors"
          title="View Report"
        >
          <Eye className="size-3" />
        </button>
      </div>
    )
  }

  if (isDraft) {
    return (
      <button
        onClick={() => onCheckin(row, milestoneKey)}
        className="text-amber-500 hover:text-amber-600 text-xs font-medium transition-colors"
        title="Continue draft"
      >
        Draft
      </button>
    )
  }

  return (
    <button
      onClick={() => onCheckin(row, milestoneKey)}
      className="text-[#1A3638] hover:text-[#5A9EA2] text-xs font-medium transition-colors"
    >
      Check In
    </button>
  )
}

// ── Editable Date Cell (for due date / delivery date) ──
function EditableDateCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)

  if (value && !editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-emerald-600 font-medium cursor-pointer hover:underline" onClick={() => setEditing(true)} title="Click to edit">
          {formatDate(value)}
        </span>
      </div>
    )
  }

  if (editing || !value) {
    return editing ? (
      <input
        type="date"
        autoFocus
        defaultValue={value || ''}
        className="text-xs border border-stone-300 rounded px-1.5 py-1 w-[130px]"
        onBlur={(e) => { if (e.target.value) onSave(e.target.value); setEditing(false) }}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value) { onSave(e.target.value); setEditing(false) } if (e.key === 'Escape') setEditing(false) }}
      />
    ) : (
      <button onClick={() => setEditing(true)} className="text-stone-400 hover:text-violet-500 text-xs transition-colors">
        + Add date
      </button>
    )
  }

  return <span className="text-stone-300">&mdash;</span>
}

// ── Table ──
export function PsychTable({ rows, checkins = {}, onDateChange, onCheckin, onViewReport, onDownloadPdf, isSharedView = false }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-16 text-center text-stone-400">
            <p className="text-sm">No surrogates found.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-5 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 z-20 min-w-[180px] border-r border-stone-200">
                  Surrogate
                </th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Contact</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Estimated Due Date</th>
                <th className="text-center px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100" colSpan="2">10 Week</th>
                <th className="text-center px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100" colSpan="2">20 Week</th>
                <th className="text-center px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100" colSpan="2">30 Week</th>
                <th className="text-center px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100 min-w-[180px]">Birth Guidelines</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Delivery Date</th>
                <th className="text-center px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Post Delivery</th>
                <th className="text-center px-3 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap min-w-[200px]">Other Check-Ins</th>
              </tr>
              <tr className="bg-stone-50/50 border-b border-stone-200">
                <th className="sticky left-0 bg-stone-50/50 z-20 border-r border-stone-200" />
                <th className="border-r border-stone-100" />
                <th className="border-r border-stone-100" />
                <th className="text-center px-2 py-1.5 text-[9px] text-stone-400 font-medium border-r border-stone-50">Due</th>
                <th className="text-center px-2 py-1.5 text-[9px] text-stone-400 font-medium border-r border-stone-100">Completed</th>
                <th className="text-center px-2 py-1.5 text-[9px] text-stone-400 font-medium border-r border-stone-50">Due</th>
                <th className="text-center px-2 py-1.5 text-[9px] text-stone-400 font-medium border-r border-stone-100">Completed</th>
                <th className="text-center px-2 py-1.5 text-[9px] text-stone-400 font-medium border-r border-stone-50">Due</th>
                <th className="text-center px-2 py-1.5 text-[9px] text-stone-400 font-medium border-r border-stone-100">Completed</th>
                <th className="border-r border-stone-100" />
                <th className="border-r border-stone-100" />
                <th className="border-r border-stone-100" />
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-5 py-3.5 sticky left-0 bg-white z-20 border-r border-stone-200">
                    {!isSharedView && row.casePath ? (
                      <Link to={row.casePath} className="text-[#D4A853] hover:underline font-semibold text-xs">{row.name}</Link>
                    ) : (
                      <span className="font-semibold text-xs text-stone-800">{row.name}</span>
                    )}
                    {row.manual && !isSharedView && <span className="text-[10px] text-violet-400 ml-1">(manual)</span>}
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    <p className="text-stone-600">{row.email || '—'}</p>
                    {row.phone && <p className="text-stone-400 text-[10px]">{row.phone}</p>}
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600 font-medium">{row.dueDate ? formatDate(row.dueDate) : '—'}</td>
                  {/* 10 Week */}
                  <td className="px-3 py-3 border-r border-stone-50 text-center text-stone-400 text-[10px]">{row.week10Date ? formatDate(row.week10Date) : '—'}</td>
                  <td className={`px-3 py-3 border-r border-stone-100 ${row.week10 ? 'bg-green-50/60' : ''}`}>
                    {onCheckin ? (
                      <CheckInCell value={row.week10} milestoneKey="week10" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} onDownloadPdf={onDownloadPdf} />
                    ) : (
                      <EditableDateCell value={row.week10} onSave={(date) => onDateChange(row.id, 'week10', date)} />
                    )}
                  </td>
                  {/* 20 Week */}
                  <td className="px-3 py-3 border-r border-stone-50 text-center text-stone-400 text-[10px]">{row.week20Date ? formatDate(row.week20Date) : '—'}</td>
                  <td className={`px-3 py-3 border-r border-stone-100 ${row.week20 ? 'bg-green-50/60' : ''}`}>
                    {onCheckin ? (
                      <CheckInCell value={row.week20} milestoneKey="week20" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} onDownloadPdf={onDownloadPdf} />
                    ) : (
                      <EditableDateCell value={row.week20} onSave={(date) => onDateChange(row.id, 'week20', date)} />
                    )}
                  </td>
                  {/* 30 Week */}
                  <td className="px-3 py-3 border-r border-stone-50 text-center text-stone-400 text-[10px]">{row.week30Date ? formatDate(row.week30Date) : '—'}</td>
                  <td className={`px-3 py-3 border-r border-stone-100 ${row.week30 ? 'bg-green-50/60' : ''}`}>
                    {onCheckin ? (
                      <CheckInCell value={row.week30} milestoneKey="week30" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} onDownloadPdf={onDownloadPdf} />
                    ) : (
                      <EditableDateCell value={row.week30} onSave={(date) => onDateChange(row.id, 'week30', date)} />
                    )}
                  </td>
                  {/* Birth Guidelines (GC + IP slots) */}
                  <td className="px-3 py-3 border-r border-stone-100">
                    <div className="space-y-1.5">
                      <div className={`flex items-center justify-between gap-2 px-2 py-1 rounded ${row.birthGuidelinesGc ? 'bg-green-50/60' : ''}`}>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-stone-500">For: GC</span>
                        {onCheckin ? (
                          <CheckInCell value={row.birthGuidelinesGc} milestoneKey="birthGuidelinesGc" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} onDownloadPdf={onDownloadPdf} />
                        ) : (
                          <EditableDateCell value={row.birthGuidelinesGc} onSave={(date) => onDateChange(row.id, 'birthGuidelinesGc', date)} />
                        )}
                      </div>
                      <div className={`flex items-center justify-between gap-2 px-2 py-1 rounded ${row.birthGuidelinesIp ? 'bg-green-50/60' : ''}`}>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-stone-500">For: IP</span>
                        {onCheckin ? (
                          <CheckInCell value={row.birthGuidelinesIp} milestoneKey="birthGuidelinesIp" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} onDownloadPdf={onDownloadPdf} />
                        ) : (
                          <EditableDateCell value={row.birthGuidelinesIp} onSave={(date) => onDateChange(row.id, 'birthGuidelinesIp', date)} />
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Delivery Date */}
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600">
                    {row.deliveryDate ? <span className="font-medium text-emerald-600">{formatDate(row.deliveryDate)}</span> : <span className="text-stone-300">—</span>}
                  </td>
                  {/* Post Delivery */}
                  <td className={`px-3 py-3 border-r border-stone-100 ${row.postDelivery ? 'bg-green-50/60' : ''}`}>
                    {onCheckin ? (
                      <CheckInCell value={row.postDelivery} milestoneKey="postDelivery" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} onDownloadPdf={onDownloadPdf} />
                    ) : (
                      <EditableDateCell value={row.postDelivery} onSave={(date) => onDateChange(row.id, 'postDelivery', date)} />
                    )}
                  </td>
                  {/* Other / Custom Check-Ins (read-only on admin view) */}
                  <td className="px-3 py-3 align-top">
                    <div className="space-y-1.5">
                      {(row.customCheckIns || []).length === 0 ? (
                        <span className="text-[10px] text-stone-300">—</span>
                      ) : (
                        (row.customCheckIns || []).map(c => {
                          const r = checkins[row.id]?.[c.id]
                          const status = r?.status
                          return (
                            <div key={c.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-stone-50/60 border border-stone-200">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-stone-500">{c.label} <span className="text-stone-400">· {c.duration}m</span></span>
                              {status === 'complete' && r?.completedAt && onCheckin && (
                                <button onClick={() => onViewReport(row, c.id)} className="text-emerald-600 text-xs font-medium flex items-center gap-1">
                                  {formatDate(r.completedAt)}<Eye className="size-3 text-[#1A3638]" />
                                </button>
                              )}
                              {status === 'skipped' && (
                                <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full" title={r?.skipReason || 'Skipped'}>Skipped</span>
                              )}
                              {status === 'draft' && onCheckin && (
                                <button onClick={() => onCheckin(row, c.id)} className="text-amber-500 text-xs font-medium">Draft</button>
                              )}
                              {!status && onCheckin && (
                                <button onClick={() => onCheckin(row, c.id)} className="text-[#1A3638] text-xs font-medium">Check In</button>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

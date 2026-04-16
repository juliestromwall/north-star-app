import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Share2, Copy, Check, ExternalLink, Plus, FileText, ClipboardCheck, Loader2, Eye, User, Phone, ClipboardList, DollarSign, MessageSquare } from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import RichTextEditor from '@/components/shared/RichTextEditor'
import { fetchSurrogatesFromIntake, getAppConfig, setAppConfig, createCaseTask, uploadBase64ToCaseDocuments } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
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
  { key: 'birthGuidelines', label: 'Birth Guidelines' },
  { key: 'postDelivery', label: 'Post Delivery' },
]

const MILESTONE_LABELS = {
  week10: '10 Week',
  week20: '20 Week',
  week30: '30 Week',
  birthGuidelines: 'Birth Guidelines',
  postDelivery: 'Post Delivery',
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

function formatDateTime(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function generateCheckinPdfHtml(report, milestoneName, surrogateName) {
  const dt = report.dateTime ? new Date(report.dateTime) : new Date()
  const dateStr = formatPTDate(dt)
  const timeStr = formatPTTime(dt)
  const completedDt = report.completedAt ? new Date(report.completedAt) : dt
  const completedDateStr = formatPTDate(completedDt)
  const completedTimeStr = formatPTTime(completedDt)
  const detailsHtml = report.details || ''
  const contactedEmail = report.contactedPartyEmail || ''
  const contactedPhone = report.contactedPartyPhone || ''
  const licenseStr = report.signatureLicense ? (/^license/i.test(report.signatureLicense) ? report.signatureLicense : 'License ' + report.signatureLicense) : ''

  return `<!DOCTYPE html><html><head>
    <title>${surrogateName} - ${milestoneName} Check-In</title>
    <style>
      @page { size: letter; margin: 1in; }
      @media print {
        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .print-bar { display: none !important; }
      }
      body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; margin: 0; padding: 0; color: #1c1917; line-height: 1.6; font-size: 14px; }
      .print-bar { position: sticky; top: 0; z-index: 100; padding: 14px 24px; background: #283693; color: white; display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
      .print-bar button { background: white; color: #283693; border: none; padding: 8px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }
      .content { max-width: 700px; margin: 0 auto; padding: 40px; }
      h1 { font-size: 24px; font-weight: 700; margin: 0 0 4px 0; color: #283693; }
      .divider { border: none; border-top: 2px solid #283693; margin: 12px 0 24px 0; }
      .header-line { font-size: 13px; color: #57534e; margin: 2px 0; }
      .section-title { font-size: 13px; font-weight: 700; color: #283693; text-transform: uppercase; letter-spacing: 0.05em; margin: 24px 0 6px 0; }
      .section-value { font-size: 14px; margin: 0 0 4px 0; }
      .details-box { background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 6px; padding: 16px; font-size: 13px; line-height: 1.7; margin: 6px 0; }
      .details-box ul { list-style-type: disc; padding-left: 1.5em; margin: 0.5em 0; }
      .details-box ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.5em 0; }
      .details-box li { margin: 0.25em 0; }
      .details-box li p { margin: 0; }
      .details-box p { margin: 0.25em 0; }
      .details-box mark { border-radius: 2px; padding: 1px 2px; }
      .details-box img { max-width: 100%; height: auto; border-radius: 6px; margin: 0.5em 0; }
      .signature { margin-top: 36px; padding-top: 16px; border-top: 1px solid #d6d3d1; font-size: 13px; color: #57534e; line-height: 1.8; }
    </style>
  </head><body>
    <div class="print-bar">
      <strong>${surrogateName} - ${milestoneName} Check-In</strong>
      <button onclick="window.print()">Save as PDF</button>
    </div>
    <div class="content">
      <h1>${surrogateName} - ${milestoneName} Check-In</h1>
      <hr class="divider" />
      <p class="header-line"><strong>${report.therapistName || ''}${report.signatureCredentials ? ', ' + report.signatureCredentials : ''}</strong></p>
      <p class="header-line">Date and Time: ${dateStr} ${timeStr} (Pacific Time)</p>
      <p class="header-line">Note Completed By: ${report.therapistName || ''}</p>
      <p class="header-line">Patient: ${report.patientName || surrogateName}</p>

      <p class="section-title">Contacted Party</p>
      <p class="section-value">Name: ${report.contactedPartyName || surrogateName}</p>
      ${contactedEmail ? `<p class="section-value">Email: ${contactedEmail}</p>` : ''}
      ${contactedPhone ? `<p class="section-value">Phone: ${contactedPhone}</p>` : ''}
      <p class="section-value">Relationship to Patient: ${report.relationship || 'Self'}</p>

      <p class="section-title">Method of Communication</p>
      <p class="section-value">${report.communicationMethod || ''}</p>

      <p class="section-title">Reason for Communication</p>
      <p class="section-value">${report.reason || milestoneName + ' Check-In'}</p>

      <p class="section-title">Billing Information</p>
      <p class="section-value">Time spent: ${report.timeSpent || ''}</p>
      <p class="section-value">The patient will not be billed for this communication.</p>

      <p class="section-title">Communication Details</p>
      <div class="details-box">${detailsHtml}</div>

      <div class="signature">
        <p><strong>${report.signatureName || report.therapistName || ''}</strong>${report.signatureCredentials ? ', ' + report.signatureCredentials : ''}${licenseStr ? ', ' + licenseStr : ''}, signed this note and declared this information to be accurate and complete on ${completedDateStr} at ${completedTimeStr} (Pacific Time).</p>
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

  useEffect(() => {
    Promise.all([
      fetchSurrogatesFromIntake(),
      fetchMatchedJourneys(),
      getAppConfig(TRACKING_KEY),
      getAppConfig(CHECKINS_KEY),
    ]).then(([gcs, js, saved, savedCheckins]) => {
      setSurrogates(gcs || [])
      setJourneys(js || [])
      setTracking(saved || {})
      setCheckins(savedCheckins || {})
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
      .filter(j => j.journey_data?.pregnant === 'yes')
      .map(j => {
        const gc = surrogates.find(s => s.id === j.gc_case_id)
        if (!gc) return null
        const t = tracking[gc.id] || {}
        const jd = j.journey_data || {}
        const milestones = calcMilestoneDates(jd.dueDate)
        return {
          id: gc.id,
          name: gc.name,
          email: gc.email || '',
          phone: gc.phone || '',
          journeyId: j.id,
          journeyPath: `/journeys/${j.id}`,
          casePath: `/surrogates/${gc.id}`,
          dueDate: jd.dueDate || null,
          deliveryDate: jd.deliveryDate || null,
          ...milestones,
          week10: t.week10 || null,
          week20: t.week20 || null,
          week30: t.week30 || null,
          birthGuidelines: t.birthGuidelines || null,
          postDelivery: t.postDelivery || null,
        }
      }).filter(Boolean)

    // Add manual entries from tracking data
    const manualRows = Object.entries(tracking)
      .filter(([key, val]) => key.startsWith('manual_') && val._manual)
      .map(([key, val]) => ({
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
        birthGuidelines: val.birthGuidelines || null,
        postDelivery: val.postDelivery || null,
      }))

    return [...pregnantRows, ...manualRows]
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
    const milestoneName = MILESTONE_LABELS[milestoneKey]
    if (existing) {
      setCheckinForm({ ...existing })
      setCheckinReadOnly(readOnly || existing.status === 'complete')
    } else {
      setCheckinForm({
        therapistName: THERAPIST_DEFAULTS.therapistName,
        dateTime: new Date().toISOString(),
        patientName: row.name,
        contactedPartyName: row.name,
        contactedPartyEmail: row.email || '',
        contactedPartyPhone: row.phone || '',
        relationship: 'Self',
        communicationMethod: 'Phone',
        reason: `${milestoneName} Check-In`,
        timeSpent: '',
        details: '',
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

  function openPdfWindow(report, milestoneKey, surrogateName) {
    const milestoneName = MILESTONE_LABELS[milestoneKey]
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
    setCheckinSaving(true)
    try {
      const now = new Date().toISOString()
      const today = new Date().toISOString().split('T')[0]
      const report = { ...checkinForm, status: 'complete', completedAt: now, savedAt: now }
      const milestoneName = MILESTONE_LABELS[checkinMilestone]

      // 1. Save report to psych_checkins
      const updatedCheckins = {
        ...checkins,
        [checkinRow.id]: {
          ...(checkins[checkinRow.id] || {}),
          [checkinMilestone]: report,
        },
      }
      await saveCheckins(updatedCheckins)

      // 2. Mark the milestone date as today in psych_tracking
      const updatedTracking = { ...tracking, [checkinRow.id]: { ...tracking[checkinRow.id], [checkinMilestone]: today } }
      await saveTracking(updatedTracking)

      // 3. Open PDF in new window
      openPdfWindow(report, checkinMilestone, checkinRow.name)

      // 4. Create auto-tasks for case/journey managers
      try {
        const journey = journeys.find(j => j.gc_case_id === checkinRow.id)
        if (journey) {
          const taskTitle = `${milestoneName} Therapist Check In Complete for ${checkinRow.name}`
          // Create tasks for assigned team members
          const assignees = new Set()
          if (journey.journey_data?.assigned_to) assignees.add(journey.journey_data.assigned_to)
          if (journey.assigned_to) assignees.add(journey.assigned_to)
          for (const assignee of assignees) {
            await createCaseTask({
              journey_id: journey.id,
              title: taskTitle,
              priority: 'normal',
              status: 'pending',
              assigned_to: assignee,
              created_at: now,
            }).catch(() => {})
          }
          // If no specific assignees found, create unassigned task
          if (assignees.size === 0) {
            await createCaseTask({
              journey_id: journey.id,
              title: taskTitle,
              priority: 'normal',
              status: 'pending',
              created_at: now,
            }).catch(() => {})
          }
        }
      } catch (e) { console.error('Failed to create tasks:', e) }

      // 5. Save PDF as case document
      try {
        if (supabase && !checkinRow.id.startsWith('manual_')) {
          const html = generateCheckinPdfHtml(report, milestoneName, checkinRow.name)
          const fileName = `${checkinRow.name} - ${milestoneName} Check In.pdf`
          // We store as HTML doc reference since we can't generate a real PDF blob in browser easily
          // The PDF is available via the "Download PDF" / print flow
          await uploadBase64ToCaseDocuments({
            surrogateId: checkinRow.id,
            category: 'psych',
            fileName,
            base64Data: btoa(unescape(encodeURIComponent(html))),
            uploadedBy: report.therapistName || 'Therapist',
          }).catch(() => {})
        }
      } catch (e) { console.error('Failed to save document:', e) }

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

  const milestoneName = checkinMilestone ? MILESTONE_LABELS[checkinMilestone] : ''

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
          if (report) openPdfWindow(report, milestone, row.name)
        }}
      />

      {/* Check-In Report Builder Dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b-2 border-[#283693]/20">
            <DialogTitle asChild>
              <h2 className="text-2xl font-bold text-[#283693] flex items-center gap-2">
                <ClipboardCheck className="size-6 text-[#283693]" />
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
                <label className="text-xs font-medium text-stone-600">Patient</label>
                <Input value={checkinForm.patientName || ''} disabled className="bg-white" />
              </div>
            </div>

            {/* Contacted Party */}
            <div className="rounded-lg bg-[#283693]/[0.03] border border-[#283693]/15 p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#283693] uppercase tracking-wider flex items-center gap-2">
                <User className="size-4" /> Contacted Party
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Name</label>
                  <Input
                    value={checkinForm.contactedPartyName || ''}
                    onChange={e => setCheckinForm(f => ({ ...f, contactedPartyName: e.target.value }))}
                    disabled={checkinReadOnly}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Relationship to Patient</label>
                  <select
                    value={checkinForm.relationship || 'Self'}
                    onChange={e => setCheckinForm(f => ({ ...f, relationship: e.target.value }))}
                    disabled={checkinReadOnly}
                    className="w-full h-9 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#283693]/20 focus:border-[#283693] disabled:bg-stone-50 disabled:text-stone-500"
                  >
                    <option value="Self">Self</option>
                    <option value="Spouse/Partner">Spouse/Partner</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Email</label>
                  <Input
                    type="email"
                    value={checkinForm.contactedPartyEmail || ''}
                    onChange={e => setCheckinForm(f => ({ ...f, contactedPartyEmail: e.target.value }))}
                    placeholder="email@example.com"
                    disabled={checkinReadOnly}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-600">Phone</label>
                  <Input
                    value={checkinForm.contactedPartyPhone || ''}
                    onChange={e => setCheckinForm(f => ({ ...f, contactedPartyPhone: e.target.value }))}
                    placeholder="xxx-xxx-xxxx"
                    disabled={checkinReadOnly}
                  />
                </div>
              </div>
            </div>

            {/* Method of Communication */}
            <div className="rounded-lg bg-[#283693]/[0.03] border border-[#283693]/15 p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#283693] uppercase tracking-wider flex items-center gap-2">
                <Phone className="size-4" /> Method of Communication
              </h3>
              <select
                value={checkinForm.communicationMethod || 'Phone'}
                onChange={e => setCheckinForm(f => ({ ...f, communicationMethod: e.target.value }))}
                disabled={checkinReadOnly}
                className="w-full h-9 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#283693]/20 focus:border-[#283693] disabled:bg-stone-50 disabled:text-stone-500"
              >
                <option value="Phone">Phone</option>
                <option value="Video Call">Video Call</option>
                <option value="In Person">In Person</option>
                <option value="Email">Email</option>
              </select>
            </div>

            {/* Reason for Communication */}
            <div className="rounded-lg bg-[#283693]/[0.03] border border-[#283693]/15 p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#283693] uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="size-4" /> Reason for Communication
              </h3>
              <Input
                value={checkinForm.reason || ''}
                onChange={e => setCheckinForm(f => ({ ...f, reason: e.target.value }))}
                disabled={checkinReadOnly}
              />
            </div>

            {/* Billing Information */}
            <div className="rounded-lg bg-[#283693]/[0.03] border border-[#283693]/15 p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#283693] uppercase tracking-wider flex items-center gap-2">
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

            {/* Communication Details */}
            <div className="rounded-lg bg-[#283693]/[0.03] border border-[#283693]/15 p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#283693] uppercase tracking-wider flex items-center gap-2">
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
                  if (report) openPdfWindow(report, checkinMilestone, checkinRow.name)
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
                <Button size="sm" className="gap-1.5 bg-[#283693] hover:bg-[#1e2a6e] text-white" onClick={handleSubmitReport} disabled={checkinSaving}>
                  {checkinSaving ? <Loader2 className="size-3.5 animate-spin" /> : <ClipboardCheck className="size-3.5" />}
                  Submit Report
                </Button>
              </>
            )}
          </DialogFooter>
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
              const { passwordHash, passwordSetAt, ...rest } = shareData
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
            <Button size="sm" onClick={saveManualEntry} disabled={!manualForm.name.trim()} className="bg-[#ed148c] hover:bg-[#d4127d] text-white gap-1">
              <Plus className="size-3.5" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Check-In Cell (replaces EditableDateCell for milestone columns) ──
function CheckInCell({ value, milestoneKey, row, checkins, onCheckin, onViewReport, onDownloadPdf }) {
  const report = checkins[row.id]?.[milestoneKey]
  const isDraft = report?.status === 'draft'
  const isComplete = report?.status === 'complete'

  if (value && isComplete) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-emerald-600 font-medium text-xs">{formatDate(value)}</span>
        <button
          onClick={() => onViewReport(row, milestoneKey)}
          className="text-[#283693] hover:text-[#1e2a6e] transition-colors"
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
      className="text-[#283693] hover:text-[#1e2a6e] text-xs font-medium transition-colors"
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
                <th className="text-center px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Birth Guidelines</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap border-r border-stone-100">Delivery Date</th>
                <th className="text-center px-4 py-3.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">Post Delivery</th>
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
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                  <td className="px-5 py-3.5 sticky left-0 bg-white z-20 border-r border-stone-200">
                    {!isSharedView && row.casePath ? (
                      <Link to={row.casePath} className="text-[#ed148c] hover:underline font-semibold text-xs">{row.name}</Link>
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
                  {/* Birth Guidelines */}
                  <td className={`px-3 py-3 border-r border-stone-100 ${row.birthGuidelines ? 'bg-green-50/60' : ''}`}>
                    {onCheckin ? (
                      <CheckInCell value={row.birthGuidelines} milestoneKey="birthGuidelines" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} onDownloadPdf={onDownloadPdf} />
                    ) : (
                      <EditableDateCell value={row.birthGuidelines} onSave={(date) => onDateChange(row.id, 'birthGuidelines', date)} />
                    )}
                  </td>
                  {/* Delivery Date */}
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600">
                    {row.deliveryDate ? <span className="font-medium text-emerald-600">{formatDate(row.deliveryDate)}</span> : <span className="text-stone-300">—</span>}
                  </td>
                  {/* Post Delivery */}
                  <td className={`px-3 py-3 ${row.postDelivery ? 'bg-green-50/60' : ''}`}>
                    {onCheckin ? (
                      <CheckInCell value={row.postDelivery} milestoneKey="postDelivery" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} onDownloadPdf={onDownloadPdf} />
                    ) : (
                      <EditableDateCell value={row.postDelivery} onSave={(date) => onDateChange(row.id, 'postDelivery', date)} />
                    )}
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

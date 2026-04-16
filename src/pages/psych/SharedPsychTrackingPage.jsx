import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Brain, Lock, Eye, EyeOff, ShieldCheck, Loader2, ClipboardCheck, FileText, User, Phone, ClipboardList, DollarSign, MessageSquare } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import RichTextEditor from '@/components/shared/RichTextEditor'
import { supabase } from '@/lib/supabase'
import { fetchSurrogatesFromIntake, uploadCaseDocument, createCaseTask } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { formatDate } from '@/lib/utils'

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

const TRACKING_KEY = 'psych_tracking'
const CHECKINS_KEY = 'psych_checkins'
const SHARE_KEY = 'psych_tracking_share'

const MILESTONE_LABELS = {
  week10: '10 Week',
  week20: '20 Week',
  week30: '30 Week',
  birthGuidelines: 'Birth Guidelines',
  postDelivery: 'Post Delivery',
}

// ── Password hashing (SHA-256) ──
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

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

async function getAppConfigPublic(key) {
  if (!supabase) return null
  const { data, error } = await supabase.from('app_config').select('config_value').eq('config_key', key).single()
  if (error) return null
  return data?.config_value ?? null
}

async function setAppConfigPublic(key, value) {
  if (!supabase) return null
  const { data, error } = await supabase.from('app_config').upsert(
    { config_key: key, config_value: value, updated_at: new Date().toISOString() },
    { onConflict: 'config_key' }
  ).select().single()
  if (error) return null
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
  const contactedEmail = report.contactedPartyEmail || ''
  const contactedPhone = report.contactedPartyPhone || ''
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
      .print-bar { position: sticky; top: 0; z-index: 100; padding: 12px 24px; background: #283693; color: white; display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
      .print-bar button { background: white; color: #283693; border: none; padding: 7px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
      .content { max-width: 760px; margin: 0 auto; padding: 28px 32px; }
      .title { font-size: 22px; font-weight: 700; color: #283693; margin: 0 0 4px 0; text-align: center; }
      .subtitle { font-size: 11px; color: #78716c; text-align: center; margin: 0 0 14px 0; letter-spacing: 0.04em; text-transform: uppercase; }
      .top-divider { border: none; border-top: 2px solid #283693; margin: 0 0 18px 0; }
      .header-card { background: #f8f7ff; border: 1px solid #e0e2f0; border-radius: 10px; padding: 12px 16px; margin: 0 0 14px 0; }
      .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 12px; }
      .header-grid .item { display: flex; flex-direction: column; }
      .header-grid .label { font-size: 9px; color: #78716c; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
      .header-grid .value { font-size: 12px; color: #1c1917; font-weight: 500; margin-top: 1px; }
      .section-title { font-size: 11px; font-weight: 700; color: #283693; text-transform: uppercase; letter-spacing: 0.07em; margin: 14px 0 6px 0; }
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
      .signature strong { color: #283693; }
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
          <div><div class="lbl">Company</div><div class="val">Abundant Beginnings Co.</div></div>
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

      <p class="section-title">Communication Details</p>
      <div class="details-box">${detailsHtml}</div>

      <div class="signature">
        <strong>${report.signatureName || report.therapistName || ''}</strong>${report.signatureCredentials ? ', ' + report.signatureCredentials : ''}${licenseStr ? ', ' + licenseStr : ''}, signed this note and declared this information to be accurate and complete on ${completedDateStr} at ${completedTimeStr} (Pacific Time).
      </div>
    </div>
  </body></html>`
}

export default function SharedPsychTrackingPage() {
  const { token } = useParams()
  const [valid, setValid] = useState(null) // null = loading, true/false
  const [authed, setAuthed] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false) // true = first time, set password
  const [shareData, setShareData] = useState(null)
  const [surrogates, setSurrogates] = useState([])
  const [journeys, setJourneys] = useState([])
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

  const SESSION_KEY = `psych_share_session_${token}`

  useEffect(() => {
    async function load() {
      // Validate share token
      const sd = await getAppConfigPublic(SHARE_KEY)
      if (!sd?.token || sd.token !== token) {
        setValid(false)
        return
      }
      setShareData(sd)
      setValid(true)

      // Check if already authenticated this session
      if (sessionStorage.getItem(SESSION_KEY) === 'true') {
        setAuthed(true)
        await loadData()
        return
      }

      // Check if password has been set
      if (!sd.passwordHash) {
        setNeedsSetup(true)
      }
    }
    load()
  }, [token])

  async function loadData() {
    const [gcs, js, saved, savedCheckins] = await Promise.all([
      fetchSurrogatesFromIntake().catch(() => []),
      fetchMatchedJourneys().catch(() => []),
      getAppConfigPublic(TRACKING_KEY),
      getAppConfigPublic(CHECKINS_KEY),
    ])
    setSurrogates(gcs || [])
    setJourneys(js || [])
    setTracking(saved || {})
    setCheckins(savedCheckins || {})
  }

  async function handleSetPassword() {
    setPasswordError('')
    if (password.length < 8) { setPasswordError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setPasswordError('Passwords do not match'); return }
    setPasswordSaving(true)
    try {
      const hash = await hashPassword(password)
      const updated = { ...shareData, passwordHash: hash, passwordSetAt: new Date().toISOString() }
      await setAppConfigPublic(SHARE_KEY, updated)
      setShareData(updated)
      sessionStorage.setItem(SESSION_KEY, 'true')
      setAuthed(true)
      setNeedsSetup(false)
      await loadData()
    } catch (err) { setPasswordError('Failed to set password. Please try again.') }
    finally { setPasswordSaving(false) }
  }

  async function handleLogin() {
    setPasswordError('')
    if (!password) { setPasswordError('Please enter your password'); return }
    setPasswordSaving(true)
    try {
      const hash = await hashPassword(password)
      if (hash !== shareData.passwordHash) {
        setPasswordError('Incorrect password')
        setPasswordSaving(false)
        return
      }
      sessionStorage.setItem(SESSION_KEY, 'true')
      setAuthed(true)
      await loadData()
    } catch (err) { setPasswordError('Something went wrong. Please try again.') }
    finally { setPasswordSaving(false) }
  }

  const saveTracking = useCallback(async (updated) => {
    setTracking(updated)
    await setAppConfigPublic(TRACKING_KEY, updated)
  }, [])

  const saveCheckins = useCallback(async (updated) => {
    setCheckins(updated)
    await setAppConfigPublic(CHECKINS_KEY, updated)
  }, [])

  const rows = useMemo(() => {
    const pregnantRows = journeys
      .filter(j => j.journey_data?.pregnant === 'yes')
      .map(j => {
        const gc = surrogates.find(s => s.id === j.gc_case_id)
        if (!gc) return null
        const t = tracking[gc.id] || {}
        const jd = j.journey_data || {}
        const milestones = calcMilestoneDates(jd.dueDate)
        const assignedEmail = j.assigned_to || jd.assigned_to || gc.assignedTo || ''
        let cmName = ''
        if (assignedEmail) {
          const prefix = assignedEmail.split('@')[0]
          cmName = prefix.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
        }
        return {
          id: gc.id,
          name: gc.name,
          email: gc.email || '',
          phone: gc.phone || '',
          assignedTo: assignedEmail,
          caseManagerName: cmName,
          caseManagerEmail: assignedEmail,
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

    const manualRows = Object.entries(tracking)
      .filter(([key, val]) => key.startsWith('manual_') && val._manual)
      .map(([key, val]) => ({
        id: key,
        name: val.name || 'Unknown',
        email: val.email || '',
        phone: val.phone || '',
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
        caseManagerName: row.caseManagerName || '',
        caseManagerEmail: row.caseManagerEmail || '',
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
    setSubmitConfirmOpen(false)
    setCheckinSaving(true)
    try {
      const now = new Date().toISOString()
      const today = new Date().toISOString().split('T')[0]
      const report = { ...checkinForm, status: 'complete', completedAt: now, savedAt: now }
      const milestoneName = MILESTONE_LABELS[checkinMilestone]

      // 1. Save report
      const updatedCheckins = {
        ...checkins,
        [checkinRow.id]: {
          ...(checkins[checkinRow.id] || {}),
          [checkinMilestone]: report,
        },
      }
      await saveCheckins(updatedCheckins)

      // 2. Mark milestone date
      const updatedTracking = { ...tracking, [checkinRow.id]: { ...tracking[checkinRow.id], [checkinMilestone]: today } }
      await saveTracking(updatedTracking)

      // 3. Generate real PDF and upload to surrogate's psych folder
      const fileName = `${checkinRow.name} - ${milestoneName} Check In.pdf`
      try {
        if (supabase && !checkinRow.id.startsWith('manual_')) {
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
          const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })
          await uploadCaseDocument({
            surrogateId: checkinRow.id,
            category: 'psych',
            file: pdfFile,
            uploadedBy: report.therapistName || 'Therapist',
          })
        }
      } catch (e) { console.error('PDF upload failed:', e) }

      // 4. Create task for case manager (Needs Review)
      try {
        const taskTitle = `${checkinRow.name} ${milestoneName} Check In Complete - Needs Review`
        const assignedTo = checkinForm.caseManagerEmail || ''
        if (!checkinRow.id.startsWith('manual_')) {
          await createCaseTask({
            case_id: Number(checkinRow.id),
            case_type: 'surrogate',
            title: taskTitle,
            priority: 'normal',
            status: 'open',
            assigned_to: assignedTo,
            created_by: report.therapistName || 'Therapist',
            description: `Check-in report submitted by ${report.therapistName || 'Therapist'}. PDF saved to Psych folder.`,
          })
        }
      } catch (e) { console.error('Task creation failed:', e) }

      // 4. Open PDF for download
      openPdfWindow(report, checkinMilestone, checkinRow.name)

      setCheckinOpen(false)
    } catch (e) { console.error('Failed to submit report:', e) }
    finally { setCheckinSaving(false) }
  }

  const milestoneName = checkinMilestone ? MILESTONE_LABELS[checkinMilestone] : ''

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
              <Button className="w-full gap-1.5" style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }} onClick={handleSetPassword} disabled={passwordSaving}>
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
              {passwordError && <p className="text-xs text-red-500 font-medium">{passwordError}</p>}
              <Button className="w-full gap-1.5" style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }} onClick={handleLogin} disabled={passwordSaving}>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
            <Brain className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-800">Therapist Check-Ins</h1>
            <p className="text-sm text-stone-500">ABC Surrogacy · {rows.length} surrogates</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Table */}
        <SharedPsychTable
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

        <p className="text-[10px] text-stone-400 text-center pt-4">
          ABC Surrogacy · Shared view · Click "Check In" to complete a milestone
        </p>
      </div>

      {/* Check-In Report Builder Dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="!max-w-[95vw] sm:!max-w-[1400px] !w-[95vw] max-h-[90vh] overflow-y-auto">
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
                <label className="text-xs font-medium text-stone-600">Method of Communication</label>
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
            </div>

            {/* Requested By */}
            <div className="rounded-lg bg-[#283693]/[0.03] border border-[#283693]/15 p-4 space-y-3">
              <h3 className="text-sm font-bold text-[#283693] uppercase tracking-wider flex items-center gap-2">
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
                  <Input value="Abundant Beginnings Co." disabled className="bg-white" />
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
                <Button size="sm" className="gap-1.5 bg-[#283693] hover:bg-[#1e2a6e] text-white" onClick={() => setSubmitConfirmOpen(true)} disabled={checkinSaving}>
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
              <ClipboardCheck className="size-5 text-[#283693]" />
              Submit Check-In Report?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-stone-600">
            <p>You're about to submit this check-in for <strong className="text-stone-800">{checkinRow?.name}</strong> ({MILESTONE_LABELS[checkinMilestone] || ''} Check-In).</p>
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
            <Button size="sm" className="gap-1.5 bg-[#283693] hover:bg-[#1e2a6e] text-white" onClick={handleSubmitReport} disabled={checkinSaving}>
              {checkinSaving ? <Loader2 className="size-3.5 animate-spin" /> : <ClipboardCheck className="size-3.5" />}
              Yes, Submit Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Check-In Cell (shared view) ──
function CheckInCell({ value, milestoneKey, row, checkins, onCheckin, onViewReport }) {
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

// ── Editable Date Cell (shared view — for non-checkin date fields) ──
function EditableDateCell({ value, onSave }) {
  const [editing, setEditing] = useState(false)

  if (value && !editing) {
    return (
      <span className="text-emerald-600 font-medium cursor-pointer hover:underline" onClick={() => setEditing(true)} title="Click to edit">
        {formatDate(value)}
      </span>
    )
  }

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

// ── Shared Table (no case links) ──
function SharedPsychTable({ rows, checkins = {}, onDateChange, onCheckin, onViewReport, onDownloadPdf }) {
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
                    <span className="font-semibold text-xs text-stone-800">{row.name}</span>
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100">
                    <p className="text-stone-600">{row.email || '—'}</p>
                    {row.phone && <p className="text-stone-400 text-[10px]">{row.phone}</p>}
                  </td>
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600 font-medium">{row.dueDate ? formatDate(row.dueDate) : '—'}</td>
                  {/* 10 Week */}
                  <td className="px-3 py-3 border-r border-stone-50 text-center text-stone-400 text-[10px]">{row.week10Date ? formatDate(row.week10Date) : '—'}</td>
                  <td className={`px-3 py-3 border-r border-stone-100 ${row.week10 ? 'bg-green-50/60' : ''}`}>
                    <CheckInCell value={row.week10} milestoneKey="week10" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} />
                  </td>
                  {/* 20 Week */}
                  <td className="px-3 py-3 border-r border-stone-50 text-center text-stone-400 text-[10px]">{row.week20Date ? formatDate(row.week20Date) : '—'}</td>
                  <td className={`px-3 py-3 border-r border-stone-100 ${row.week20 ? 'bg-green-50/60' : ''}`}>
                    <CheckInCell value={row.week20} milestoneKey="week20" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} />
                  </td>
                  {/* 30 Week */}
                  <td className="px-3 py-3 border-r border-stone-50 text-center text-stone-400 text-[10px]">{row.week30Date ? formatDate(row.week30Date) : '—'}</td>
                  <td className={`px-3 py-3 border-r border-stone-100 ${row.week30 ? 'bg-green-50/60' : ''}`}>
                    <CheckInCell value={row.week30} milestoneKey="week30" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} />
                  </td>
                  {/* Birth Guidelines */}
                  <td className={`px-3 py-3 border-r border-stone-100 ${row.birthGuidelines ? 'bg-green-50/60' : ''}`}>
                    <CheckInCell value={row.birthGuidelines} milestoneKey="birthGuidelines" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} />
                  </td>
                  {/* Delivery Date */}
                  <td className="px-4 py-3 border-r border-stone-100 text-stone-600">
                    {row.deliveryDate ? <span className="font-medium text-emerald-600">{formatDate(row.deliveryDate)}</span> : <span className="text-stone-300">—</span>}
                  </td>
                  {/* Post Delivery */}
                  <td className={`px-3 py-3 ${row.postDelivery ? 'bg-green-50/60' : ''}`}>
                    <CheckInCell value={row.postDelivery} milestoneKey="postDelivery" row={row} checkins={checkins} onCheckin={onCheckin} onViewReport={onViewReport} />
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

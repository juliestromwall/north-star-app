import { useState, useEffect, useMemo, useRef } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent, CardAction, CardDescription } from '@/components/ui/card'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronDown, Loader2, Save, CheckCircle2, Circle, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
]

const FORM_SECTIONS = [
  { key: '_application', label: 'Personal Information', description: 'Address, identification, and NICU information' },
  { key: '_confidential', label: 'Confidential Information', description: 'Personal details, insurance, and emergency contact' },
  { key: '_references', label: 'References', description: 'Three references required' },
  { key: '_clinicHospital', label: 'Clinic & Hospital Form', description: 'Provider information for each pregnancy' },
  { key: '_socialMediaRelease', label: 'Social Media Release', description: 'Photo and video consent' },
]

function YesNoButtons({ value, onChange }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange('yes')}
        className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${value === 'yes' || value === true ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
        Yes
      </button>
      <button type="button" onClick={() => onChange('no')}
        className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${value === 'no' || value === false ? 'bg-red-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
        No
      </button>
    </div>
  )
}

function FieldLabel({ children }) {
  return <label className="text-xs font-medium text-stone-600">{children}</label>
}

function Req() {
  return <span className="text-red-400">*</span>
}

function ReadField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-stone-400 uppercase">{label}</p>
      <p className="text-sm text-stone-700">{value || <span className="text-stone-300">—</span>}</p>
    </div>
  )
}

// ── Personal Information ───────────────────────────────
function PersonalInfoForm({ data, onSave, saving }) {
  const [form, setForm] = useState({
    street: '', city: '', state: '', zipCode: '',
    realId: '', validPassport: '',
    nearestNICU: '', willingToTravelNICU: '',
  })
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (data) setForm({
      street: data.street || '', city: data.city || '', state: data.state || '', zipCode: data.zipCode || '',
      realId: data.realId || '', validPassport: data.validPassport || '',
      nearestNICU: data.nearestNICU || '', willingToTravelNICU: data.willingToTravelNICU || '',
    })
  }, [data])

  const allFilled = form.street && form.city && form.state && form.zipCode && form.realId && form.validPassport && form.nearestNICU && form.willingToTravelNICU
  const isComplete = data && data.street && data.city && data.state && data.zipCode && data.realId && data.validPassport && data.nearestNICU && data.willingToTravelNICU

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={() => setEditing(!editing)}>
        <div className="flex items-center gap-2">
          {isComplete ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
          <div>
            <CardTitle className="text-base">Personal Information</CardTitle>
            <CardDescription>Address, identification, and NICU information</CardDescription>
          </div>
        </div>
        <CardAction><ChevronDown className={`size-4 text-stone-400 transition-transform ${editing ? 'rotate-180' : ''}`} /></CardAction>
      </CardHeader>
      {editing && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2"><FieldLabel>Street Address <Req /></FieldLabel><Input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>City <Req /></FieldLabel><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>State <Req /></FieldLabel>
              <Select value={form.state} onValueChange={v => setForm(f => ({ ...f, state: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><FieldLabel>Zip Code <Req /></FieldLabel><Input value={form.zipCode} onChange={e => setForm(f => ({ ...f, zipCode: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Do you have a Real ID? <Req /></FieldLabel><YesNoButtons value={form.realId} onChange={v => setForm(f => ({ ...f, realId: v }))} /></div>
            <div className="space-y-1"><FieldLabel>Do you have a valid passport? <Req /></FieldLabel><YesNoButtons value={form.validPassport} onChange={v => setForm(f => ({ ...f, validPassport: v }))} /></div>
            <div className="space-y-1 sm:col-span-2"><FieldLabel>Nearest hospital with Level II or III NICU <Req /></FieldLabel><Input value={form.nearestNICU} onChange={e => setForm(f => ({ ...f, nearestNICU: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Willing to travel to Level II+ NICU? <Req /></FieldLabel><YesNoButtons value={form.willingToTravelNICU} onChange={v => setForm(f => ({ ...f, willingToTravelNICU: v }))} /></div>
          </div>
          {!allFilled && <p className="text-xs text-red-400">Please complete all required fields.</p>}
          <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_application', form)} disabled={saving || !allFilled}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

// ── References ─────────────────────────────────────────
function ReferencesForm({ data, onSave, saving }) {
  const REFS = [
    { key: 'ref1', title: 'Reference #1 — Family Member' },
    { key: 'ref2', title: 'Reference #2 — Friend' },
    { key: 'ref3', title: 'Reference #3 — Friend' },
  ]
  const fields = ['name', 'phone', 'email', 'cityState', 'relationship']
  const labels = { name: 'Name', phone: 'Phone Number', email: 'Email Address', cityState: 'City, State', relationship: 'Relationship to you' }

  const [form, setForm] = useState({})
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (data) {
      const init = {}
      for (const r of REFS) {
        for (const f of fields) init[`${r.key}_${f}`] = data[`${r.key}_${f}`] || ''
      }
      setForm(init)
    }
  }, [data])

  const requiredKeys = REFS.flatMap(r => fields.map(f => `${r.key}_${f}`))
  const allFilled = requiredKeys.every(k => form[k]?.trim())
  const isComplete = data && requiredKeys.every(k => data[k]?.trim())

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={() => setEditing(!editing)}>
        <div className="flex items-center gap-2">
          {isComplete ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
          <div>
            <CardTitle className="text-base">References</CardTitle>
            <CardDescription>Three references required</CardDescription>
          </div>
        </div>
        <CardAction><ChevronDown className={`size-4 text-stone-400 transition-transform ${editing ? 'rotate-180' : ''}`} /></CardAction>
      </CardHeader>
      {editing && (
        <CardContent className="space-y-6">
          {REFS.map(ref => (
            <div key={ref.key}>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{ref.title}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {fields.map(f => {
                  const key = `${ref.key}_${f}`
                  return (
                    <div key={key} className="space-y-1">
                      <FieldLabel>{labels[f]} <Req /></FieldLabel>
                      <Input value={form[key] || ''} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {!allFilled && <p className="text-xs text-red-400">Please complete all required fields.</p>}
          <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => {
            const cleaned = { ...form }
            if (data) {
              for (const [k, v] of Object.entries(data)) {
                if (k.includes('adminNotes')) cleaned[k] = v
              }
            }
            onSave('_references', cleaned)
          }} disabled={saving || !allFilled}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

// ── Confidential Information ───────────────────────────
function ConfidentialForm({ data, onSave, saving, quizData }) {
  const [form, setForm] = useState({})
  const [editing, setEditing] = useState(false)

  const FIELDS = [
    { key: 'fullLegalName', label: 'Full Legal Name' },
    { key: 'maidenName', label: 'Maiden Name (if applicable)' },
    { key: 'dob', label: 'Date of Birth', type: 'date' },
    { key: 'ssn4', label: 'Last 4 of SSN' },
    { key: 'driversLicense', label: "Driver's License #" },
    { key: 'religion', label: 'Religion' },
    { key: 'hasInsurance', label: 'Do you have health insurance?', type: 'yesno' },
    { key: 'insuranceProvider', label: 'Health Insurance Provider', group: 'insurance' },
    { key: 'insurancePolicyNumber', label: 'Policy Number', group: 'insurance' },
    { key: 'insuranceGroupNumber', label: 'Group Number', group: 'insurance' },
    { key: 'insurancePhone', label: 'Insurance Phone', group: 'insurance' },
    { key: 'hasSpouse', label: 'Do you have a spouse/partner?', type: 'yesno' },
    { key: 'spouseFullName', label: 'Spouse/Partner Full Name' },
    { key: 'spouseEmail', label: 'Spouse/Partner Email' },
    { key: 'spousePhone', label: 'Spouse/Partner Phone' },
    { key: 'emergencyName', label: 'Emergency Contact Name' },
    { key: 'emergencyPhone', label: 'Emergency Contact Phone' },
    { key: 'emergencyRelationship', label: 'Emergency Contact Relationship' },
  ]

  useEffect(() => {
    const init = {}
    // Pre-fill from quiz data if available
    const q = quizData || {}
    const fullName = [q.firstName, q.lastName].filter(Boolean).join(' ')
    // Check profile for health insurance
    const profileEmployment = quizData?._profileData?.employment || {}
    const hasInsFromProfile = profileEmployment.healthInsurance === 'yes' || profileEmployment.healthInsurance === true
    const prefills = {
      fullLegalName: fullName,
      dob: q.dob || '',
      hasSpouse: q.maritalStatus === 'Married' || q.maritalStatus === 'Domestic Partnership' ? 'yes' : '',
      hasInsurance: hasInsFromProfile ? 'yes' : '',
    }
    for (const f of FIELDS) {
      init[f.key] = data?.[f.key] || prefills[f.key] || ''
    }
    setForm(init)
  }, [data, quizData])

  const SPOUSE_KEYS = ['spouseFullName', 'spouseEmail', 'spousePhone']
  const INSURANCE_KEYS = ['insuranceProvider', 'insurancePolicyNumber', 'insuranceGroupNumber', 'insurancePhone']
  const hasSpouse = form.hasSpouse === 'yes' || form.hasSpouse === true
  const hasInsurance = form.hasInsurance === 'yes' || form.hasInsurance === true

  function isFieldRequired(f) {
    if (SPOUSE_KEYS.includes(f.key)) return hasSpouse
    if (f.group === 'insurance') return hasInsurance
    return true
  }

  const requiredFields = FIELDS.filter(isFieldRequired)
  const allFilled = requiredFields.every(f => {
    const val = form[f.key]
    if (f.type === 'yesno') return val === 'yes' || val === 'no' || val === true || val === false
    return val?.toString().trim()
  })

  function checkComplete(d) {
    if (!d) return false
    const hs = d.hasSpouse === 'yes' || d.hasSpouse === true
    const hi = d.hasInsurance === 'yes' || d.hasInsurance === true
    return FIELDS.filter(f => {
      if (SPOUSE_KEYS.includes(f.key)) return hs
      if (f.group === 'insurance') return hi
      return true
    }).every(f => {
      const val = d[f.key]
      if (f.type === 'yesno') return val === 'yes' || val === 'no' || val === true || val === false
      return val?.toString().trim()
    })
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={() => setEditing(!editing)}>
        <div className="flex items-center gap-2">
          {checkComplete(data) ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
          <div>
            <CardTitle className="text-base">Confidential Information</CardTitle>
            <CardDescription>Personal details, insurance, and emergency contact</CardDescription>
          </div>
        </div>
        <CardAction><ChevronDown className={`size-4 text-stone-400 transition-transform ${editing ? 'rotate-180' : ''}`} /></CardAction>
      </CardHeader>
      {editing && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FIELDS.map(f => {
              if (SPOUSE_KEYS.includes(f.key) && !hasSpouse) return null
              if (f.group === 'insurance' && !hasInsurance) return null
              if (f.type === 'yesno') {
                return (
                  <div key={f.key} className="space-y-1">
                    <FieldLabel>{f.label} <Req /></FieldLabel>
                    <YesNoButtons value={form[f.key]} onChange={v => setForm(prev => ({ ...prev, [f.key]: v }))} />
                  </div>
                )
              }
              return (
                <div key={f.key} className="space-y-1">
                  <FieldLabel>{f.label} <Req /></FieldLabel>
                  <Input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                </div>
              )
            })}
          </div>
          {!allFilled && <p className="text-xs text-red-400">Please complete all required fields.</p>}
          <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_confidential', form)} disabled={saving || !allFilled}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

// ── Signature Pad (type or draw) ───────────────────────
function SignaturePad({ value, onChange, signerName }) {
  const [mode, setMode] = useState('typed')
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)

  function getCanvasXY(canvas, e) {
    const rect = canvas.getBoundingClientRect()
    const clientX = e.clientX || e.touches?.[0]?.clientX || 0
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }
  }
  function handleDown(e) {
    e.preventDefault(); drawingRef.current = true
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { x, y } = getCanvasXY(canvas, e)
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  useEffect(() => {
    function handleMove(e) {
      if (!drawingRef.current) return
      const canvas = canvasRef.current; if (!canvas) return
      const ctx = canvas.getContext('2d')
      const { x, y } = getCanvasXY(canvas, e)
      ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a2e'
      ctx.lineTo(x, y); ctx.stroke()
    }
    function handleUp() {
      if (!drawingRef.current) return
      drawingRef.current = false
      if (canvasRef.current && mode === 'drawn') onChange({ type: 'drawn', image: canvasRef.current.toDataURL('image/png'), name: signerName })
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleUp)
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleUp) }
  }, [mode, onChange, signerName])

  return (
    <div className="space-y-2">
      <FieldLabel>Signature</FieldLabel>
      <div className="flex gap-2 mb-1">
        <button type="button" onClick={() => setMode('typed')} className={`text-xs px-3 py-1 rounded-full font-medium ${mode === 'typed' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>Type</button>
        <button type="button" onClick={() => setMode('drawn')} className={`text-xs px-3 py-1 rounded-full font-medium ${mode === 'drawn' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>Draw</button>
      </div>
      {mode === 'typed' ? (
        <input type="text" value={typeof value === 'object' ? value?.name || '' : value || ''}
          onChange={e => onChange({ type: 'typed', name: e.target.value })}
          placeholder="Type your full name"
          className="w-full text-xl py-3 px-4 border-b-2 border-stone-300 bg-stone-50/50 outline-none rounded-t font-serif italic" />
      ) : (
        <div>
          <canvas ref={canvasRef} width={400} height={80}
            className="w-full border border-stone-200 rounded-lg bg-white cursor-crosshair touch-none"
            onMouseDown={handleDown} onTouchStart={handleDown} />
          <button type="button" onClick={() => { const c = canvasRef.current; if (c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); onChange(null) } }} className="text-xs text-stone-400 hover:text-red-500 mt-1">Clear</button>
        </div>
      )}
      {value?.type === 'typed' && value?.name && (
        <p className="text-lg text-[#283693] font-serif italic">{value.name}</p>
      )}
    </div>
  )
}

// ── Social Media Release ───────────────────────────────
function SocialMediaForm({ data, onSave, saving, quizData, userEmail }) {
  const [form, setForm] = useState({ fullName: '', email: '', signatureDate: '', agreed: false, signature: null })
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const q = quizData || {}
    const fullName = [q.firstName, q.lastName].filter(Boolean).join(' ')
    setForm({
      fullName: data?.fullName || fullName || '',
      email: data?.email || userEmail || '',
      signatureDate: data?.signatureDate || new Date().toISOString().split('T')[0],
      agreed: data?.agreed || false,
      signature: data?.signature || null,
    })
  }, [data, quizData, userEmail])

  const isComplete = !!(data?.agreed && data?.signature && data?.fullName && data?.email && data?.signatureDate)

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={() => setEditing(!editing)}>
        <div className="flex items-center gap-2">
          {isComplete ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
          <div>
            <CardTitle className="text-base">Social Media Release</CardTitle>
            <CardDescription>Photo and video consent</CardDescription>
          </div>
        </div>
        <CardAction><ChevronDown className={`size-4 text-stone-400 transition-transform ${editing ? 'rotate-180' : ''}`} /></CardAction>
      </CardHeader>
      {editing && (
        <CardContent className="space-y-4">
          <div className="bg-stone-50 rounded-lg p-4 text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">
            I hereby grant permission to the rights of my image, likeness and sound of my voice as recorded on audio without payment or any other consideration. I understand that my image may be edited, copied, exhibited, published or distributed and waive the right to inspect or approve the finished product wherein my likeness appears. Additionally, I waive any right to the royalties or other compensation arising or related to the use of my image.{'\n\n'}By signing this release I understand this permission signifies that photographic or video recordings of me may be electronically displayed via the internet.{'\n\n'}There is no time limit of the validity of this release nor is there any geographic limitation on where these materials may be distributed.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1"><FieldLabel>Full Name <Req /></FieldLabel><Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Email <Req /></FieldLabel><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Date <Req /></FieldLabel><Input type="date" value={form.signatureDate} onChange={e => setForm(f => ({ ...f, signatureDate: e.target.value }))} /></div>
          </div>
          <SignaturePad value={form.signature} onChange={v => setForm(f => ({ ...f, signature: v }))} signerName={form.fullName} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.agreed} onChange={e => setForm(f => ({ ...f, agreed: e.target.checked }))} className="size-4 accent-[#283693]" />
            <span className="text-sm text-stone-700">I agree to the terms above <Req /></span>
          </label>
          {(!form.agreed || !form.signature || !form.fullName || !form.email || !form.signatureDate) && <p className="text-xs text-red-400">Please complete all required fields, sign, and agree to the terms.</p>}
          <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_socialMediaRelease', form)} disabled={saving || !form.agreed || !form.signature || !form.fullName || !form.email || !form.signatureDate}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

// ── Main Page ──────────────────────────────────────────
export default function PortalApplicationPage() {
  const { currentUser } = useRole()
  const [answers, setAnswers] = useState(null)
  const [caseId, setCaseId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentUser?.email || !supabase) { setLoading(false); return }
    loadData()
  }, [currentUser?.email])

  async function loadData() {
    try {
      const { data } = await supabase
        .from('intake_submissions')
        .select('id, answers')
        .eq('applicant_email', currentUser.email.trim().toLowerCase())
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single()
      if (data) {
        setCaseId(data.id)
        setAnswers(data.answers || {})
      }
    } catch (err) {
      console.error('Failed to load application data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(sectionKey, formData) {
    if (!caseId || !supabase) { console.error('Cannot save: no caseId or supabase', { caseId, supabase: !!supabase }); return }
    setSaving(true)
    try {
      // Fresh read to avoid overwriting concurrent admin edits
      const { data: fresh } = await supabase.from('intake_submissions').select('answers').eq('id', caseId).single()
      const currentAnswers = fresh?.answers || answers
      const updatedAnswers = { ...currentAnswers, [sectionKey]: { ...(currentAnswers[sectionKey] || {}), ...formData } }
      const { error } = await supabase.from('intake_submissions').update({ answers: updatedAnswers }).eq('id', caseId)
      if (error) throw error
      setAnswers(updatedAnswers)
    } catch (err) {
      console.error('Save failed:', err)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-stone-400" />
      </div>
    )
  }

  if (!answers?._applicationAvailable) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Application" subtitle="Your application forms will appear here when they're ready." />
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="size-10 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-500 font-medium">Not yet available</p>
            <p className="text-stone-400 text-sm mt-1">Your agency will notify you when your application is ready to complete.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  function isSectionComplete(key) {
    const d = answers[key]
    if (!d) return false
    if (key === '_application') {
      return !!(d.street && d.city && d.state && d.zipCode && d.realId && d.validPassport && d.nearestNICU && d.willingToTravelNICU)
    }
    if (key === '_confidential') {
      const SPOUSE_KEYS = ['spouseFullName', 'spouseEmail', 'spousePhone']
      const INSURANCE_KEYS = ['insuranceProvider', 'insurancePolicyNumber', 'insuranceGroupNumber', 'insurancePhone']
      const hs = d.hasSpouse === 'yes' || d.hasSpouse === true
      const hi = d.hasInsurance === 'yes' || d.hasInsurance === true
      const yesNoKeys = ['hasSpouse', 'hasInsurance']
      const required = ['fullLegalName', 'dob', 'ssn4', 'driversLicense', 'religion', 'hasInsurance', ...(hi ? INSURANCE_KEYS : []), 'hasSpouse', ...(hs ? SPOUSE_KEYS : []), 'emergencyName', 'emergencyPhone', 'emergencyRelationship']
      return required.every(k => { const v = d[k]; return yesNoKeys.includes(k) ? (v === 'yes' || v === 'no' || v === true || v === false) : v?.toString().trim() })
    }
    if (key === '_references') {
      const refs = ['ref1', 'ref2', 'ref3']
      const fields = ['name', 'phone', 'email', 'cityState', 'relationship']
      return refs.every(r => fields.every(f => d[`${r}_${f}`]?.trim()))
    }
    if (key === '_socialMediaRelease') {
      return !!(d.agreed && d.signature && d.fullName && d.email && d.signatureDate)
    }
    return false
  }

  const completedCount = FORM_SECTIONS.filter(s => isSectionComplete(s.key)).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Application"
        subtitle={`Complete each section below. ${completedCount} of ${FORM_SECTIONS.length} complete.`}
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-2 rounded-full bg-stone-100">
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / FORM_SECTIONS.length) * 100}%`, backgroundColor: '#ed148c' }}
          />
        </div>
        <span className="text-xs text-stone-500 font-medium">{completedCount}/{FORM_SECTIONS.length}</span>
      </div>

      <PersonalInfoForm data={answers._application} onSave={handleSave} saving={saving} />
      <ConfidentialForm data={answers._confidential} onSave={handleSave} saving={saving} quizData={answers} />
      <ReferencesForm data={answers._references} onSave={handleSave} saving={saving} />
      <SocialMediaForm data={answers._socialMediaRelease} onSave={handleSave} saving={saving} quizData={answers} userEmail={currentUser?.email} />
    </div>
  )
}

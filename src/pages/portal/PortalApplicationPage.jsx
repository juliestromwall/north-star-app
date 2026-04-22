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
import { ChevronDown, Loader2, Save, CheckCircle2, Circle, FileText, Send, Upload, X, Image } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { createCaseTask, findCaseByEmail, uploadCaseDocument } from '@/lib/db'
import { DollarSign } from 'lucide-react'

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
  { key: '_application', label: 'Personal Information', description: 'Address, identification, insurance, and emergency contact' },
  { key: '_profileFollowUp', label: 'Profile Follow Up Questions', description: 'Additional details about your lifestyle, health, and preferences' },
  { key: '_references', label: 'References', description: 'Three references required' },
  { key: '_clinicHospital', label: 'Clinic & Hospital Form', description: 'Provider information for each pregnancy' },
  { key: '_paymentPreference', label: 'Screening Incentive Payment Preference', description: 'How you prefer to receive your screening incentive' },
  { key: '_socialMediaRelease', label: 'Social Media Release', description: 'Photo and video consent' },
]

const IP_FORM_SECTIONS = [
  { key: '_ipContact', label: 'Contact Information', description: 'Your address, contact details, and emergency contacts' },
  { key: '_ipClinic', label: 'Clinic Information', description: 'Your fertility clinic, doctor, and embryo details' },
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

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

function isValidPhone(value) {
  if (!value) return false
  // Accept any 10-digit phone regardless of formatting:
  // "1234567890", "123-456-7890", "(123) 456-7890" all valid.
  return value.toString().replace(/\D/g, '').length === 10
}

function isValidEmail(value) {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function ReadField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-stone-400 uppercase">{label}</p>
      <p className="text-sm text-stone-700">{value || <span className="text-stone-300">—</span>}</p>
    </div>
  )
}

// ── Personal Information (combined with Confidential) ───────
function PersonalInfoForm({ data, onSave, saving, readOnly, isOpen, onToggle, quizData, caseId, userId }) {
  const [form, setForm] = useState({})
  const editing = isOpen
  const [insFrontUrl, setInsFrontUrl] = useState(null)
  const [insBackUrl, setInsBackUrl] = useState(null)
  const [uploading, setUploading] = useState(null)
  const insFrontRef = useRef(null)
  const insBackRef = useRef(null)

  // Load existing insurance card photos
  useEffect(() => {
    if (!caseId || !supabase) return
    supabase.from('case_documents').select('*').eq('surrogate_id', caseId).eq('category', 'insurance-card').then(({ data: docs }) => {
      if (docs) {
        const front = docs.find(d => d.doc_label === 'insurance-front')
        const back = docs.find(d => d.doc_label === 'insurance-back')
        if (front?.public_url) setInsFrontUrl(front.public_url)
        if (back?.public_url) setInsBackUrl(back.public_url)
      }
    })
  }, [caseId])

  async function handleInsUpload(file, label) {
    if (!file || !caseId || !supabase) return
    setUploading(label)
    try {
      const path = `${caseId}/insurance-card/${label}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { data: uploadData, error: uploadError } = await supabase.storage.from('case-documents').upload(path, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('case-documents').getPublicUrl(uploadData.path)
      const { data: existing } = await supabase.from('case_documents').select('id').eq('surrogate_id', caseId).eq('category', 'insurance-card').eq('doc_label', label)
      if (existing?.length > 0) for (const old of existing) await supabase.from('case_documents').delete().eq('id', old.id)
      await supabase.from('case_documents').insert({
        surrogate_id: caseId, category: 'insurance-card', doc_label: label,
        file_name: `Insurance Card ${label === 'insurance-front' ? 'Front' : 'Back'} - ${file.name}`,
        file_type: file.type, file_size: file.size,
        storage_path: uploadData.path, public_url: urlData.publicUrl,
        uploaded_by: 'Portal Upload',
      })
      if (label === 'insurance-front') setInsFrontUrl(urlData.publicUrl)
      else setInsBackUrl(urlData.publicUrl)
    } catch (err) { console.error('Insurance card upload failed:', err); alert('Upload failed.') }
    finally { setUploading(null) }
  }

  // Load profile data for pre-fill
  useEffect(() => {
    let profileData = {}
    try {
      const raw = localStorage.getItem(`abc-surrogate-profile-${userId || 'anonymous'}`)
      if (raw) profileData = JSON.parse(raw)
    } catch {}
    const personal = profileData?.personal || {}
    const q = quizData || {}
    const fullName = [q.firstName, q.lastName].filter(Boolean).join(' ')
    const profileEmployment = profileData?.employment || {}
    const hasInsFromProfile = profileEmployment.healthInsurance === 'yes' || profileEmployment.healthInsurance === true
    const prefills = {
      fullLegalName: fullName,
      dob: q.dob || '',
      city: personal.city || q.city || '',
      state: personal.state || q.state || '',
      hasSpouse: q.maritalStatus === 'Married' || q.maritalStatus === 'Domestic Partnership' ? 'yes' : '',
      spouseFirstName: personal.partnerName || '',
      spouseDob: personal.partnerDob || '',
      hasInsurance: hasInsFromProfile ? 'yes' : '',
    }
    const KEYS = [
      'fullLegalName','maidenName','dob','ssn4','religion',
      'street','city','state','zipCode',
      'hasInsurance','insuranceProvider','insurancePolicyNumber','insuranceGroupNumber','insurancePhone',
      'hasSpouse','spouseFirstName','spouseDob','spouseEmail','spousePhone',
      'emergencyName','emergencyPhone','emergencyRelationship',
    ]
    const init = {}
    for (const k of KEYS) init[k] = data?.[k] || prefills[k] || ''
    setForm(init)
  }, [data, quizData, userId])

  const hasSpouse = form.hasSpouse === 'yes' || form.hasSpouse === true
  const hasInsurance = form.hasInsurance === 'yes' || form.hasInsurance === true
  const SPOUSE_KEYS = ['spouseFirstName', 'spouseDob', 'spouseEmail', 'spousePhone']
  const INSURANCE_KEYS = ['insuranceProvider', 'insurancePolicyNumber', 'insuranceGroupNumber', 'insurancePhone']

  const requiredKeys = ['fullLegalName','dob','ssn4','street','city','state','zipCode','hasInsurance','hasSpouse','emergencyName','emergencyPhone','emergencyRelationship']
  if (hasSpouse) requiredKeys.push(...SPOUSE_KEYS)
  if (hasInsurance) requiredKeys.push(...INSURANCE_KEYS)
  const allFilled = requiredKeys.every(k => {
    const v = form[k]
    if (k === 'hasInsurance' || k === 'hasSpouse') return v === 'yes' || v === 'no'
    if (k === 'emergencyPhone' || k === 'spousePhone' || k === 'insurancePhone') return isValidPhone(v)
    if (k === 'spouseEmail') return isValidEmail(v)
    return v?.toString().trim()
  })

  function checkComplete(d) {
    if (!d) return false
    const hs = d.hasSpouse === 'yes'
    const hi = d.hasInsurance === 'yes'
    const rk = ['fullLegalName','dob','ssn4','street','city','state','zipCode','hasInsurance','hasSpouse','emergencyName','emergencyPhone','emergencyRelationship']
    if (hs) rk.push(...SPOUSE_KEYS)
    if (hi) rk.push(...INSURANCE_KEYS)
    return rk.every(k => {
      const v = d[k]
      if (k === 'hasInsurance' || k === 'hasSpouse') return v === 'yes' || v === 'no'
      if (k.includes('Phone')) return isValidPhone(v)
      if (k.includes('Email')) return isValidEmail(v)
      return v?.toString().trim()
    })
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {checkComplete(data) ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
          <div>
            <CardTitle className="text-base">Personal Information</CardTitle>
            <CardDescription>Address, identification, insurance, and emergency contact</CardDescription>
          </div>
        </div>
        <CardAction><ChevronDown className={`size-4 text-stone-400 transition-transform ${editing ? 'rotate-180' : ''}`} /></CardAction>
      </CardHeader>
      {editing && (
        <CardContent className={`space-y-4 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}>
          {/* Identity */}
          <p className="text-xs font-semibold text-muted-foreground uppercase pt-1">Identity</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1"><FieldLabel>Full Legal Name <Req /></FieldLabel><Input value={form.fullLegalName || ''} onChange={e => setForm(f => ({ ...f, fullLegalName: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Maiden Name</FieldLabel><Input value={form.maidenName || ''} onChange={e => setForm(f => ({ ...f, maidenName: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Date of Birth <Req /></FieldLabel><Input type="date" value={form.dob || ''} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Last 4 of SSN <Req /></FieldLabel><Input value={form.ssn4 || ''} onChange={e => setForm(f => ({ ...f, ssn4: e.target.value }))} maxLength={4} /></div>
            <div className="space-y-1"><FieldLabel>Religion</FieldLabel><Input value={form.religion || ''} onChange={e => setForm(f => ({ ...f, religion: e.target.value }))} /></div>
          </div>

          {/* Address */}
          <p className="text-xs font-semibold text-muted-foreground uppercase pt-3 border-t">Address</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2"><FieldLabel>Street Address <Req /></FieldLabel><Input value={form.street || ''} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>City <Req /></FieldLabel><Input value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>State <Req /></FieldLabel>
              <Select value={form.state || ''} onValueChange={v => setForm(f => ({ ...f, state: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><FieldLabel>Zip Code <Req /></FieldLabel><Input value={form.zipCode || ''} onChange={e => setForm(f => ({ ...f, zipCode: e.target.value }))} /></div>
          </div>

          {/* Insurance */}
          <p className="text-xs font-semibold text-muted-foreground uppercase pt-3 border-t">Health Insurance</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1"><FieldLabel>Do you have health insurance? <Req /></FieldLabel><YesNoButtons value={form.hasInsurance} onChange={v => setForm(f => ({ ...f, hasInsurance: v }))} /></div>
            {hasInsurance && <>
              <div className="space-y-1"><FieldLabel>Insurance Provider <Req /></FieldLabel><Input value={form.insuranceProvider || ''} onChange={e => setForm(f => ({ ...f, insuranceProvider: e.target.value }))} /></div>
              <div className="space-y-1"><FieldLabel>Policy Number <Req /></FieldLabel><Input value={form.insurancePolicyNumber || ''} onChange={e => setForm(f => ({ ...f, insurancePolicyNumber: e.target.value }))} /></div>
              <div className="space-y-1"><FieldLabel>Group Number <Req /></FieldLabel><Input value={form.insuranceGroupNumber || ''} onChange={e => setForm(f => ({ ...f, insuranceGroupNumber: e.target.value }))} /></div>
              <div className="space-y-1"><FieldLabel>Insurance Phone <Req /></FieldLabel><Input type="tel" value={form.insurancePhone || ''} onChange={e => setForm(f => ({ ...f, insurancePhone: formatPhone(e.target.value) }))} placeholder="xxx-xxx-xxxx" /></div>
            </>}
          </div>
          {/* Insurance Card Uploads */}
          {hasInsurance && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-2">
                <FieldLabel>Insurance Card — Front</FieldLabel>
                {insFrontUrl ? (
                  <div className="flex items-center gap-3">
                    <a href={insFrontUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#283693] hover:underline"><Image className="size-4" /> View Front</a>
                    {!readOnly && <button onClick={() => insFrontRef.current?.click()} className="text-xs text-stone-400 hover:text-stone-600">Replace</button>}
                  </div>
                ) : !readOnly && (
                  <button onClick={() => insFrontRef.current?.click()} disabled={uploading === 'insurance-front'}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-stone-200 hover:border-[#283693]/40 hover:bg-stone-50 text-sm text-stone-500 transition-colors">
                    {uploading === 'insurance-front' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    Upload Front of Card
                  </button>
                )}
                <input ref={insFrontRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleInsUpload(e.target.files[0], 'insurance-front'); e.target.value = '' }} />
              </div>
              <div className="space-y-2">
                <FieldLabel>Insurance Card — Back</FieldLabel>
                {insBackUrl ? (
                  <div className="flex items-center gap-3">
                    <a href={insBackUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#283693] hover:underline"><Image className="size-4" /> View Back</a>
                    {!readOnly && <button onClick={() => insBackRef.current?.click()} className="text-xs text-stone-400 hover:text-stone-600">Replace</button>}
                  </div>
                ) : !readOnly && (
                  <button onClick={() => insBackRef.current?.click()} disabled={uploading === 'insurance-back'}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-stone-200 hover:border-[#283693]/40 hover:bg-stone-50 text-sm text-stone-500 transition-colors">
                    {uploading === 'insurance-back' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    Upload Back of Card
                  </button>
                )}
                <input ref={insBackRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleInsUpload(e.target.files[0], 'insurance-back'); e.target.value = '' }} />
              </div>
            </div>
          )}

          {/* Spouse/Partner */}
          <p className="text-xs font-semibold text-muted-foreground uppercase pt-3 border-t">Spouse / Partner</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1"><FieldLabel>Do you have a spouse/partner? <Req /></FieldLabel><YesNoButtons value={form.hasSpouse} onChange={v => setForm(f => ({ ...f, hasSpouse: v }))} /></div>
            {hasSpouse && <>
              <div className="space-y-1"><FieldLabel>Spouse/Partner First Name <Req /></FieldLabel><Input value={form.spouseFirstName || ''} onChange={e => setForm(f => ({ ...f, spouseFirstName: e.target.value }))} /></div>
              <div className="space-y-1"><FieldLabel>Spouse/Partner DOB <Req /></FieldLabel><Input type="date" value={form.spouseDob || ''} onChange={e => setForm(f => ({ ...f, spouseDob: e.target.value }))} /></div>
              <div className="space-y-1"><FieldLabel>Spouse/Partner Email <Req /></FieldLabel><Input type="email" value={form.spouseEmail || ''} onChange={e => setForm(f => ({ ...f, spouseEmail: e.target.value }))} placeholder="name@example.com" /></div>
              <div className="space-y-1"><FieldLabel>Spouse/Partner Phone <Req /></FieldLabel><Input type="tel" value={form.spousePhone || ''} onChange={e => setForm(f => ({ ...f, spousePhone: formatPhone(e.target.value) }))} placeholder="xxx-xxx-xxxx" /></div>
            </>}
          </div>

          {/* Emergency Contact */}
          <p className="text-xs font-semibold text-muted-foreground uppercase pt-3 border-t">Emergency Contact</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1"><FieldLabel>Name <Req /></FieldLabel><Input value={form.emergencyName || ''} onChange={e => setForm(f => ({ ...f, emergencyName: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Phone <Req /></FieldLabel><Input type="tel" value={form.emergencyPhone || ''} onChange={e => setForm(f => ({ ...f, emergencyPhone: formatPhone(e.target.value) }))} placeholder="xxx-xxx-xxxx" /></div>
            <div className="space-y-1"><FieldLabel>Relationship <Req /></FieldLabel><Input value={form.emergencyRelationship || ''} onChange={e => setForm(f => ({ ...f, emergencyRelationship: e.target.value }))} /></div>
          </div>

          {!readOnly && !allFilled && <p className="text-xs text-red-400 pt-2">Please complete all required fields.</p>}
          {!readOnly && <Button size="sm" className="gap-1.5 mt-2" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_application', form)} disabled={saving || !allFilled}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>}
        </CardContent>
      )}
    </Card>
  )
}

// ── Profile Follow Up Questions ──────────────────────────
function ProfileFollowUpForm({ data, onSave, saving, readOnly, isOpen, onToggle }) {
  const FIELDS = [
    { key: 'breastfeeding', label: 'Are you currently breastfeeding/lactating?', type: 'yesno' },
    { key: 'breastfeedingStopDate', label: 'When do you expect to stop?', type: 'text', conditional: d => d.breastfeeding === 'yes' },
    { key: 'cycleLength', label: 'Are your cycles typically between 28 to 30 days?', type: 'yesno' },
    { key: 'cycleLengthDetails', label: 'What is your typical cycle length?', type: 'text', conditional: d => d.cycleLength === 'no' },
    { key: 'lastPeriod', label: 'When was the start of your last period?', type: 'text' },
    { key: 'timeToConceive', label: 'How long after stopping contraceptives did it take to get pregnant?', type: 'text' },
    { key: 'placedForAdoption', label: 'Have you ever placed a child for adoption?', type: 'yesno' },
    { key: 'gunsOwned', label: 'Do you own any guns?', type: 'yesno' },
    { key: 'nonSterilePiercing', label: 'Have you been tattooed or had a non-sterile skin piercing in the last 12 months?', type: 'yesno' },
    { key: 'eatingDisorders', label: 'Do you have a history of eating disorders?', type: 'yesno' },
    { key: 'recentTravel', label: 'Have you traveled outside of the U.S. in the last 6 months?', type: 'yesno' },
    { key: 'sleepIssues', label: 'Do you have any issues with sleeping?', type: 'yesno' },
    { key: 'sleepHours', label: 'How many hours do you typically sleep each night?', type: 'text' },
    { key: 'autoInsurance', label: 'Do you have automobile insurance?', type: 'yesno' },
    { key: 'validLicense', label: 'Do you have a valid driver\'s license?', type: 'yesno' },
    { key: 'partnerFdaTests', label: 'Will your partner submit to the FDA required lab tests?', type: 'yesno' },
    { key: 'lastPhysical', label: 'When was your last physical exam?', type: 'text' },
    { key: 'compensationNegotiable', label: 'Is your desired compensation negotiable?', type: 'yesno' },
  ]

  const [form, setForm] = useState({})
  useEffect(() => { if (data) setForm({ ...data }) }, [data])

  const visibleFields = FIELDS.filter(f => !f.conditional || f.conditional(form))
  const requiredKeys = FIELDS.filter(f => f.type === 'yesno' && (!f.conditional || f.conditional(form))).map(f => f.key)
  const allFilled = requiredKeys.every(k => form[k] === 'yes' || form[k] === 'no' || form[k] === true || form[k] === false)
  const isComplete = data && requiredKeys.every(k => data[k] === 'yes' || data[k] === 'no' || data[k] === true || data[k] === false)

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {isComplete ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
          <div>
            <CardTitle className="text-base">Profile Follow Up Questions</CardTitle>
            <CardDescription>Additional details about your lifestyle, health, and preferences</CardDescription>
          </div>
        </div>
        <CardAction><ChevronDown className={`size-4 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></CardAction>
      </CardHeader>
      {isOpen && (
        <CardContent className={`space-y-4 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleFields.map(f => (
              <div key={f.key} className={`space-y-1 ${f.type === 'text' && !f.conditional ? '' : ''}`}>
                <FieldLabel>{f.label}</FieldLabel>
                {f.type === 'yesno' ? (
                  <YesNoButtons value={form[f.key]} onChange={v => setForm(prev => ({ ...prev, [f.key]: v }))} />
                ) : (
                  <Input value={form[f.key] || ''} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          {!readOnly && <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_profileFollowUp', form)} disabled={saving || !allFilled}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>}
        </CardContent>
      )}
    </Card>
  )
}

// ── Screening Incentive Payment Preference ────────────────
function PaymentPreferenceForm({ data, onSave, saving, readOnly, isOpen, onToggle, caseId }) {
  const [form, setForm] = useState({ method: '', venmoUsername: '', zelleInfo: '', screenshotUrl: '' })
  const [uploading, setUploading] = useState(false)
  useEffect(() => { if (data) setForm({ method: data.method || '', venmoUsername: data.venmoUsername || '', zelleInfo: data.zelleInfo || '', screenshotUrl: data.screenshotUrl || '' }) }, [data])

  const isComplete = data && data.method && (data.method === 'Venmo' ? data.venmoUsername : data.zelleInfo)
  const allFilled = form.method && (form.method === 'Venmo' ? form.venmoUsername : form.zelleInfo)

  async function handleScreenshot(file) {
    if (!file || !caseId) return
    setUploading(true)
    try {
      const doc = await uploadCaseDocument({ surrogateId: caseId, category: 'Payment Info', file, uploadedBy: 'Surrogate' })
      if (doc?.public_url) {
        const updatedForm = { ...form, screenshotUrl: doc.public_url }
        setForm(updatedForm)
        // Auto-save immediately so the URL persists
        if (onSave) onSave('_paymentPreference', updatedForm)
      }
    } catch (err) { console.error('Upload failed:', err) }
    finally { setUploading(false) }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {isComplete ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
          <div>
            <CardTitle className="text-base">Screening Incentive Payment Preference</CardTitle>
            <CardDescription>How would you prefer to receive your screening incentive payment?</CardDescription>
          </div>
        </div>
        <CardAction><ChevronDown className={`size-4 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></CardAction>
      </CardHeader>
      {isOpen && (
        <CardContent className={`space-y-4 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}>
          <div className="space-y-1">
            <FieldLabel>Payment Method <Req /></FieldLabel>
            <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Venmo">Venmo</SelectItem>
                <SelectItem value="Zelle">Zelle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.method === 'Venmo' && (
            <div className="space-y-1">
              <FieldLabel>Venmo Username <Req /></FieldLabel>
              <Input value={form.venmoUsername} onChange={e => setForm(f => ({ ...f, venmoUsername: e.target.value }))} placeholder="@username" />
            </div>
          )}
          {form.method === 'Zelle' && (
            <div className="space-y-1">
              <FieldLabel>Zelle Email or Phone <Req /></FieldLabel>
              <Input value={form.zelleInfo} onChange={e => setForm(f => ({ ...f, zelleInfo: e.target.value }))} placeholder="email@example.com or (555) 123-4567" />
            </div>
          )}
          {(form.method === 'Venmo' || form.method === 'Zelle') && (
            <div className="space-y-1">
              <FieldLabel>Screenshot of {form.method} Name (optional)</FieldLabel>
              <Input type="file" accept="image/*" onChange={e => handleScreenshot(e.target.files?.[0])} className="text-xs" disabled={uploading} />
              {uploading && <p className="text-xs text-stone-400 flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Uploading...</p>}
              {form.screenshotUrl && <a href={form.screenshotUrl} target="_blank" rel="noreferrer" className="text-xs text-[#283693] hover:underline">View uploaded screenshot →</a>}
            </div>
          )}
          {!readOnly && <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_paymentPreference', form)} disabled={saving || !allFilled}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>}
        </CardContent>
      )}
    </Card>
  )
}

// ── References ─────────────────────────────────────────
function ReferencesForm({ data, onSave, saving, readOnly, isOpen, onToggle }) {
  const REFS = [
    { key: 'ref1', title: 'Reference #1 — Family Member' },
    { key: 'ref2', title: 'Reference #2 — Friend' },
    { key: 'ref3', title: 'Reference #3 — Friend' },
  ]
  const fields = ['name', 'phone', 'email', 'cityState', 'relationship']
  const labels = { name: 'Name', phone: 'Phone Number', email: 'Email Address', cityState: 'City, State', relationship: 'Relationship to you' }

  const [form, setForm] = useState({})
  const editing = isOpen

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
  function isRefFieldValid(k, val) {
    if (k.endsWith('_phone')) return isValidPhone(val)
    if (k.endsWith('_email')) return isValidEmail(val)
    return val?.trim()
  }
  const allFilled = requiredKeys.every(k => isRefFieldValid(k, form[k]))
  const isComplete = data && requiredKeys.every(k => isRefFieldValid(k, data[k]))

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
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
        <CardContent className={`space-y-6 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}>
          {REFS.map(ref => (
            <div key={ref.key}>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{ref.title}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {fields.map(f => {
                  const key = `${ref.key}_${f}`
                  const val = form[key] || ''
                  if (f === 'phone') {
                    const showErr = val && !isValidPhone(val)
                    return (
                      <div key={key} className="space-y-1">
                        <FieldLabel>{labels[f]} <Req /></FieldLabel>
                        <Input type="tel" placeholder="xxx-xxx-xxxx" value={val} onChange={e => setForm(prev => ({ ...prev, [key]: formatPhone(e.target.value) }))} />
                        {showErr && <p className="text-[10px] text-red-400">Format: xxx-xxx-xxxx</p>}
                      </div>
                    )
                  }
                  if (f === 'email') {
                    const showErr = val && !isValidEmail(val)
                    return (
                      <div key={key} className="space-y-1">
                        <FieldLabel>{labels[f]} <Req /></FieldLabel>
                        <Input type="email" placeholder="name@example.com" value={val} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} />
                        {showErr && <p className="text-[10px] text-red-400">Enter a valid email address</p>}
                      </div>
                    )
                  }
                  return (
                    <div key={key} className="space-y-1">
                      <FieldLabel>{labels[f]} <Req /></FieldLabel>
                      <Input value={val} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {!readOnly && !allFilled && <p className="text-xs text-red-400">Please complete all required fields.</p>}
          {!readOnly && <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => {
            const cleaned = { ...form }
            if (data) {
              for (const [k, v] of Object.entries(data)) {
                if (k.includes('adminNotes')) cleaned[k] = v
              }
            }
            onSave('_references', cleaned)
          }} disabled={saving || !allFilled}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>}
        </CardContent>
      )}
    </Card>
  )
}

// ── Confidential Information ───────────────────────────
function ConfidentialForm({ data, onSave, saving, quizData, readOnly, isOpen, onToggle, caseId }) {
  const [form, setForm] = useState({})
  const editing = isOpen
  const [gcDlUrl, setGcDlUrl] = useState(null)
  const [partnerDlUrl, setPartnerDlUrl] = useState(null)
  const [uploading, setUploading] = useState(null) // 'gc' | 'partner' | null
  const gcFileRef = useRef(null)
  const partnerFileRef = useRef(null)

  // Load existing DL photos
  useEffect(() => {
    if (!caseId || !supabase) return
    supabase.from('case_documents').select('*').eq('surrogate_id', caseId).eq('category', 'photo-id').then(({ data: docs }) => {
      if (docs) {
        const gc = docs.find(d => d.doc_label === 'gc')
        const partner = docs.find(d => d.doc_label === 'partner')
        if (gc?.public_url) setGcDlUrl(gc.public_url)
        if (partner?.public_url) setPartnerDlUrl(partner.public_url)
      }
    })
  }, [caseId])

  async function handleDlUpload(file, label) {
    if (!file || !caseId || !supabase) return
    setUploading(label)
    try {
      const path = `${caseId}/photo-id/${label}_dl_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { data: uploadData, error: uploadError } = await supabase.storage.from('case-documents').upload(path, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('case-documents').getPublicUrl(uploadData.path)
      // Remove old DL for this label
      const { data: existing } = await supabase.from('case_documents').select('id').eq('surrogate_id', caseId).eq('category', 'photo-id').eq('doc_label', label)
      if (existing?.length > 0) {
        for (const old of existing) await supabase.from('case_documents').delete().eq('id', old.id)
      }
      await supabase.from('case_documents').insert({
        surrogate_id: caseId, category: 'photo-id', doc_label: label,
        file_name: `${label === 'gc' ? "GC Driver's License" : "Partner Driver's License"} - ${file.name}`,
        file_type: file.type, file_size: file.size,
        storage_path: uploadData.path, public_url: urlData.publicUrl,
        uploaded_by: 'Portal Upload',
      })
      if (label === 'gc') setGcDlUrl(urlData.publicUrl)
      else setPartnerDlUrl(urlData.publicUrl)
    } catch (err) { console.error('DL upload failed:', err); alert('Upload failed. Please try again.') }
    finally { setUploading(null) }
  }

  const FIELDS = [
    { key: 'fullLegalName', label: 'Full Legal Name' },
    { key: 'maidenName', label: 'Maiden Name (if applicable)', optional: true },
    { key: 'dob', label: 'Date of Birth', type: 'date' },
    { key: 'ssn4', label: 'Last 4 of SSN' },
    { key: 'driversLicense', label: "Driver's License #" },
    { key: 'religion', label: 'Religion (if applicable)', optional: true },
    { key: 'hasInsurance', label: 'Do you have health insurance?', type: 'yesno' },
    { key: 'insuranceProvider', label: 'Health Insurance Provider', group: 'insurance' },
    { key: 'insurancePolicyNumber', label: 'Policy Number', group: 'insurance' },
    { key: 'insuranceGroupNumber', label: 'Group Number', group: 'insurance' },
    { key: 'insurancePhone', label: 'Insurance Phone', group: 'insurance', type: 'phone' },
    { key: 'hasSpouse', label: 'Do you have a spouse/partner?', type: 'yesno' },
    { key: 'spouseFullName', label: 'Spouse/Partner Full Name' },
    { key: 'spouseEmail', label: 'Spouse/Partner Email', type: 'email' },
    { key: 'spousePhone', label: 'Spouse/Partner Phone', type: 'phone' },
    { key: 'emergencyName', label: 'Emergency Contact Name' },
    { key: 'emergencyPhone', label: 'Emergency Contact Phone', type: 'phone' },
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
    if (f.optional) return false
    if (SPOUSE_KEYS.includes(f.key)) return hasSpouse
    if (f.group === 'insurance') return hasInsurance
    return true
  }

  function isFieldValid(f, val) {
    if (f.type === 'yesno') return val === 'yes' || val === 'no' || val === true || val === false
    if (f.type === 'phone') return isValidPhone(val)
    if (f.type === 'email') return isValidEmail(val)
    return val?.toString().trim()
  }

  const requiredFields = FIELDS.filter(isFieldRequired)
  const allFilled = requiredFields.every(f => isFieldValid(f, form[f.key]))

  function checkComplete(d) {
    if (!d) return false
    const hs = d.hasSpouse === 'yes' || d.hasSpouse === true
    const hi = d.hasInsurance === 'yes' || d.hasInsurance === true
    return FIELDS.filter(f => {
      if (f.optional) return false
      if (SPOUSE_KEYS.includes(f.key)) return hs
      if (f.group === 'insurance') return hi
      return true
    }).every(f => isFieldValid(f, d[f.key]))
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
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
        <CardContent className={`space-y-4 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FIELDS.map(f => {
              if (SPOUSE_KEYS.includes(f.key) && !hasSpouse) return null
              if (f.group === 'insurance' && !hasInsurance) return null
              const req = isFieldRequired(f)
              const val = form[f.key] || ''
              if (f.type === 'yesno') {
                return (
                  <div key={f.key} className="space-y-1">
                    <FieldLabel>{f.label} {req && <Req />}</FieldLabel>
                    <YesNoButtons value={form[f.key]} onChange={v => setForm(prev => ({ ...prev, [f.key]: v }))} />
                  </div>
                )
              }
              if (f.type === 'phone') {
                const showErr = val && !isValidPhone(val)
                return (
                  <div key={f.key} className="space-y-1">
                    <FieldLabel>{f.label} {req && <Req />}</FieldLabel>
                    <Input type="tel" placeholder="xxx-xxx-xxxx" value={val} onChange={e => setForm(prev => ({ ...prev, [f.key]: formatPhone(e.target.value) }))} />
                    {showErr && <p className="text-[10px] text-red-400">Format: xxx-xxx-xxxx</p>}
                  </div>
                )
              }
              if (f.type === 'email') {
                const showErr = val && !isValidEmail(val)
                return (
                  <div key={f.key} className="space-y-1">
                    <FieldLabel>{f.label} {req && <Req />}</FieldLabel>
                    <Input type="email" placeholder="name@example.com" value={val} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                    {showErr && <p className="text-[10px] text-red-400">Enter a valid email address</p>}
                  </div>
                )
              }
              return (
                <div key={f.key} className="space-y-1">
                  <FieldLabel>{f.label} {req && <Req />}</FieldLabel>
                  <Input type={f.type || 'text'} value={val} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                </div>
              )
            })}
          </div>
          {/* Driver's License Uploads */}
          <div className={`pt-3 border-t border-stone-200 space-y-4 ${readOnly ? '' : ''}`}>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Photo ID Uploads</p>

            {/* GC Driver's License */}
            <div className="space-y-2">
              <FieldLabel>Your Driver's License <Req /></FieldLabel>
              {gcDlUrl ? (
                <div className="flex items-center gap-3">
                  <a href={gcDlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#283693] hover:underline">
                    <Image className="size-4" /> View Driver's License
                  </a>
                  {!readOnly && (
                    <button onClick={() => gcFileRef.current?.click()} className="text-xs text-stone-400 hover:text-stone-600">Replace</button>
                  )}
                </div>
              ) : (
                <div>
                  {!readOnly && (
                    <button onClick={() => gcFileRef.current?.click()} disabled={uploading === 'gc'}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-stone-200 hover:border-[#283693]/40 hover:bg-stone-50 text-sm text-stone-500 transition-colors">
                      {uploading === 'gc' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                      {uploading === 'gc' ? 'Uploading...' : 'Upload Photo of Driver\'s License'}
                    </button>
                  )}
                  {!gcDlUrl && !readOnly && <p className="text-[10px] text-red-400 mt-1">Required</p>}
                </div>
              )}
              <input ref={gcFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleDlUpload(e.target.files[0], 'gc'); e.target.value = '' }} />
            </div>

            {/* Partner Driver's License — only if has spouse */}
            {hasSpouse && (
              <div className="space-y-2">
                <FieldLabel>Spouse/Partner Driver's License <Req /></FieldLabel>
                {partnerDlUrl ? (
                  <div className="flex items-center gap-3">
                    <a href={partnerDlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#283693] hover:underline">
                      <Image className="size-4" /> View Partner's License
                    </a>
                    {!readOnly && (
                      <button onClick={() => partnerFileRef.current?.click()} className="text-xs text-stone-400 hover:text-stone-600">Replace</button>
                    )}
                  </div>
                ) : (
                  <div>
                    {!readOnly && (
                      <button onClick={() => partnerFileRef.current?.click()} disabled={uploading === 'partner'}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-stone-200 hover:border-[#283693]/40 hover:bg-stone-50 text-sm text-stone-500 transition-colors">
                        {uploading === 'partner' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        {uploading === 'partner' ? 'Uploading...' : "Upload Partner's Driver's License"}
                      </button>
                    )}
                  </div>
                )}
                <input ref={partnerFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleDlUpload(e.target.files[0], 'partner'); e.target.value = '' }} />
              </div>
            )}
          </div>

          {!readOnly && !allFilled && <p className="text-xs text-red-400">Please complete all required fields.</p>}
          {!readOnly && <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_confidential', form)} disabled={saving || !allFilled}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>}
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

// ── Clinic & Hospital Form ─────────────────────────────
const NON_DELIVERY_OUTCOMES = ['miscarriage', 'ectopic', 'ectopic pregnancy', 'termination', 'chemical', 'chemical pregnancy']
const EMPTY_PREG = {
  date: '', outcome: '', receivedPrenatalCare: '', wasSurrogacy: '',
  obClinicName: '', obDoctorName: '', obPhone: '', obAddress: '',
  hospitalName: '', hospitalPhone: '', hospitalAddress: '',
  sawMFM: '', mfmClinicName: '', mfmDoctorName: '', mfmPhone: '', mfmAddress: '',
  wasIVF: '', ivfClinicName: '', ivfDoctorName: '', ivfPhone: '', ivfAddress: '',
}

function ClinicHospitalForm({ data, onSave, saving, quizData, userId, readOnly, isOpen, onToggle }) {
  const [form, setForm] = useState({
    currentOBGYN: '', currentOBPhone: '', currentOBAddress: '',
    papDate: '', papDoctorName: '', papClinicName: '', papClinicCity: '', papClinicState: '', papClinicPhone: '',
    experiencedSurrogate: '', numberOfPregnancies: '',
    pregnancies: [],
  })
  const editing = isOpen

  useEffect(() => {
    // Try to get pregnancy count from profile (localStorage)
    let profilePregs = []
    let profileCount = 0
    try {
      const raw = localStorage.getItem(`abc-surrogate-profile-${userId || 'anonymous'}`)
      if (raw) {
        const profile = JSON.parse(raw)
        profilePregs = profile?.pregnancyHistory?.pregnancies || []
        profileCount = parseInt(profile?.pregnancyHistory?.numberOfPregnancies) || 0
      }
    } catch {}

    const saved = data || {}
    const count = Math.max(profileCount, profilePregs.length, (saved.pregnancies || []).length)
    const pregnancies = []
    for (let i = 0; i < Math.max(count, 0); i++) {
      const ex = (saved.pregnancies || [])[i] || {}
      const prof = profilePregs[i] || {}
      pregnancies.push({
        ...EMPTY_PREG, ...ex,
        date: ex.date || prof.dob || '',
        outcome: ex.outcome || prof.outcome || '',
        wasSurrogacy: ex.wasSurrogacy ?? prof.wasSurrogacy ?? '',
      })
    }
    setForm({
      currentOBGYN: saved.currentOBGYN || '',
      currentOBPhone: saved.currentOBPhone || '',
      currentOBAddress: saved.currentOBAddress || '',
      papDate: saved.papDate || '',
      papDoctorName: saved.papDoctorName || '',
      papClinicName: saved.papClinicName || '',
      papClinicCity: saved.papClinicCity || '',
      papClinicState: saved.papClinicState || '',
      papClinicPhone: saved.papClinicPhone || '',
      experiencedSurrogate: saved.experiencedSurrogate || (() => {
        try {
          const raw = localStorage.getItem(`abc-surrogate-profile-${userId || 'anonymous'}`)
          if (raw) {
            const profile = JSON.parse(raw)
            const prev = profile?.preferences?.previousSurrogate
            if (prev === 'yes' || prev === true) return 'yes'
            if (prev === 'no' || prev === false) return 'no'
          }
        } catch {}
        return ''
      })(),
      numberOfPregnancies: saved.numberOfPregnancies || profileCount || '',
      pregnancies,
    })
  }, [data, userId])

  function updatePreg(i, key, val) {
    setForm(f => {
      const pregnancies = [...(f.pregnancies || [])]
      pregnancies[i] = { ...pregnancies[i], [key]: val }
      return { ...f, pregnancies }
    })
  }

  function handleCountChange(val) {
    const num = parseInt(val) || 0
    setForm(f => {
      const existing = f.pregnancies || []
      const pregnancies = []
      for (let i = 0; i < num; i++) {
        pregnancies.push(existing[i] || { ...EMPTY_PREG })
      }
      return { ...f, numberOfPregnancies: val, pregnancies }
    })
  }

  const isNonDelivery = (outcome) => NON_DELIVERY_OUTCOMES.includes((outcome || '').toLowerCase())

  // Completion: need currentOBGYN, numberOfPregnancies, and each pregnancy needs at least outcome + prenatal clinic
  const hasPregs = (form.pregnancies || []).length > 0
  const pregsValid = (form.pregnancies || []).every(p => {
    if (!p.outcome) return false
    const isNonDel = isNonDelivery(p.outcome)
    if (isNonDel && p.receivedPrenatalCare === 'no') return true // skipped
    if (!p.obClinicName || !p.obDoctorName) return false
    if (!isNonDel && !p.hospitalName) return false
    return true
  })
  const isComplete = !!(data && data.currentOBGYN && data.numberOfPregnancies && (data.pregnancies || []).length > 0 && pregsValid)
  const canSave = form.currentOBGYN && form.numberOfPregnancies && hasPregs && (form.pregnancies || []).every(p => {
    if (!p.outcome) return false
    const isNonDel = isNonDelivery(p.outcome)
    if (isNonDel && p.receivedPrenatalCare === 'no') return true
    if (!p.obClinicName || !p.obDoctorName) return false
    if (!isNonDel && !p.hospitalName) return false
    return true
  })

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {isComplete ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
          <div>
            <CardTitle className="text-base">Clinic & Hospital Form</CardTitle>
            <CardDescription>Provider information for each pregnancy</CardDescription>
          </div>
        </div>
        <CardAction><ChevronDown className={`size-4 text-stone-400 transition-transform ${editing ? 'rotate-180' : ''}`} /></CardAction>
      </CardHeader>
      {editing && (
        <CardContent className={`space-y-6 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}>
          {/* Current OB */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Current OB/GYN</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1"><FieldLabel>Doctor / Midwife Name <Req /></FieldLabel><Input value={form.currentOBGYN} onChange={e => setForm(f => ({ ...f, currentOBGYN: e.target.value }))} /></div>
              <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" placeholder="xxx-xxx-xxxx" value={form.currentOBPhone} onChange={e => setForm(f => ({ ...f, currentOBPhone: formatPhone(e.target.value) }))} /></div>
              <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={form.currentOBAddress} onChange={e => setForm(f => ({ ...f, currentOBAddress: e.target.value }))} placeholder="Optional" /></div>
            </div>
          </div>
          {/* PAP Smear */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Most Recent PAP Smear</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1"><FieldLabel>Date</FieldLabel><Input type="date" value={form.papDate} onChange={e => setForm(f => ({ ...f, papDate: e.target.value }))} /></div>
              <div className="space-y-1"><FieldLabel>Doctor Name</FieldLabel><Input value={form.papDoctorName} onChange={e => setForm(f => ({ ...f, papDoctorName: e.target.value }))} /></div>
              <div className="space-y-1"><FieldLabel>Clinic Name</FieldLabel><Input value={form.papClinicName} onChange={e => setForm(f => ({ ...f, papClinicName: e.target.value }))} /></div>
              <div className="space-y-1"><FieldLabel>City</FieldLabel><Input value={form.papClinicCity} onChange={e => setForm(f => ({ ...f, papClinicCity: e.target.value }))} /></div>
              <div className="space-y-1"><FieldLabel>State</FieldLabel>
                <Select value={form.papClinicState} onValueChange={v => setForm(f => ({ ...f, papClinicState: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" placeholder="xxx-xxx-xxxx" value={form.papClinicPhone} onChange={e => setForm(f => ({ ...f, papClinicPhone: formatPhone(e.target.value) }))} /></div>
            </div>
          </div>
          {/* Pregnancy count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <FieldLabel>Are you an experienced surrogate?</FieldLabel>
              <YesNoButtons value={form.experiencedSurrogate} onChange={v => setForm(f => ({ ...f, experiencedSurrogate: v }))} />
            </div>
            <div className="space-y-1">
              <FieldLabel>Total number of pregnancies <Req /></FieldLabel>
              <p className="text-[10px] text-stone-400 -mt-0.5">Include all deliveries, miscarriages, terminations, and ectopic pregnancies</p>
              <Input type="number" min="0" max="20" value={form.numberOfPregnancies} onChange={e => handleCountChange(e.target.value)} />
            </div>
          </div>
          {/* Per-Pregnancy */}
          {(form.pregnancies || []).map((p, i) => {
            const isNonDel = isNonDelivery(p.outcome)
            const skipRelease = isNonDel && p.receivedPrenatalCare === 'no'
            return (
              <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-4">
                <p className="text-sm font-semibold text-[#283693]">Pregnancy #{i + 1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1"><FieldLabel>Date <Req /></FieldLabel><Input type="date" value={p.date} onChange={e => updatePreg(i, 'date', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>Outcome <Req /></FieldLabel>
                    <Select value={p.outcome} onValueChange={v => updatePreg(i, 'outcome', v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {['Live Birth', 'Miscarriage', 'Ectopic Pregnancy', 'Termination', 'Chemical Pregnancy', 'Stillborn'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><FieldLabel>Did you use IVF or other third-party reproductive assistance for this pregnancy?</FieldLabel><YesNoButtons value={p.wasSurrogacy} onChange={v => { updatePreg(i, 'wasSurrogacy', v); if (v === 'yes') updatePreg(i, 'wasIVF', 'yes') }} /></div>
                </div>
                {isNonDel && (
                  <div className="space-y-1 max-w-xs">
                    <FieldLabel>Did you receive any prenatal care for this pregnancy? <Req /></FieldLabel>
                    <YesNoButtons value={p.receivedPrenatalCare} onChange={v => updatePreg(i, 'receivedPrenatalCare', v)} />
                  </div>
                )}
                {skipRelease && <p className="text-xs text-stone-400 italic">No medical records release needed for this pregnancy.</p>}
                {!skipRelease && p.outcome && (
                  <>
                    {/* Prenatal Care */}
                    <div>
                      <p className="text-[11px] font-semibold text-stone-500 uppercase mb-2">Prenatal Care</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1"><FieldLabel>Clinic Name <Req /></FieldLabel><Input value={p.obClinicName} onChange={e => updatePreg(i, 'obClinicName', e.target.value)} /></div>
                        <div className="space-y-1"><FieldLabel>OB Doctor / Midwife <Req /></FieldLabel><Input value={p.obDoctorName} onChange={e => updatePreg(i, 'obDoctorName', e.target.value)} /></div>
                        <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" placeholder="xxx-xxx-xxxx" value={p.obPhone} onChange={e => updatePreg(i, 'obPhone', formatPhone(e.target.value))} /></div>
                        <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={p.obAddress} onChange={e => updatePreg(i, 'obAddress', e.target.value)} placeholder="Optional" /></div>
                      </div>
                    </div>
                    {/* Delivery Hospital */}
                    {!isNonDel && (
                      <div>
                        <p className="text-[11px] font-semibold text-stone-500 uppercase mb-2">Delivery Hospital</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1"><FieldLabel>Hospital Name <Req /></FieldLabel><Input value={p.hospitalName} onChange={e => updatePreg(i, 'hospitalName', e.target.value)} /></div>
                          <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" placeholder="xxx-xxx-xxxx" value={p.hospitalPhone} onChange={e => updatePreg(i, 'hospitalPhone', formatPhone(e.target.value))} /></div>
                          <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={p.hospitalAddress} onChange={e => updatePreg(i, 'hospitalAddress', e.target.value)} placeholder="Optional" /></div>
                        </div>
                      </div>
                    )}
                    {/* MFM */}
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-[11px] font-semibold text-stone-500 uppercase">Did you see a Maternal Fetal Medicine (MFM) doctor?</p>
                        <YesNoButtons value={p.sawMFM} onChange={v => updatePreg(i, 'sawMFM', v)} />
                      </div>
                      {(p.sawMFM === 'yes' || p.sawMFM === true) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="space-y-1"><FieldLabel>MFM Clinic Name</FieldLabel><Input value={p.mfmClinicName} onChange={e => updatePreg(i, 'mfmClinicName', e.target.value)} /></div>
                          <div className="space-y-1"><FieldLabel>MFM Doctor Name</FieldLabel><Input value={p.mfmDoctorName} onChange={e => updatePreg(i, 'mfmDoctorName', e.target.value)} /></div>
                          <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" placeholder="xxx-xxx-xxxx" value={p.mfmPhone} onChange={e => updatePreg(i, 'mfmPhone', formatPhone(e.target.value))} /></div>
                          <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={p.mfmAddress} onChange={e => updatePreg(i, 'mfmAddress', e.target.value)} placeholder="Optional" /></div>
                        </div>
                      )}
                    </div>
                    {/* IVF / Fertility Clinic — show when third-party assistance used */}
                    {(p.wasSurrogacy === 'yes' || p.wasSurrogacy === true) && (
                      <div>
                        <p className="text-[11px] font-semibold text-stone-500 uppercase mb-2">IVF / Fertility Clinic</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="space-y-1"><FieldLabel>IVF Clinic Name</FieldLabel><Input value={p.ivfClinicName} onChange={e => updatePreg(i, 'ivfClinicName', e.target.value)} /></div>
                          <div className="space-y-1"><FieldLabel>IVF Doctor Name</FieldLabel><Input value={p.ivfDoctorName} onChange={e => updatePreg(i, 'ivfDoctorName', e.target.value)} /></div>
                          <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" placeholder="xxx-xxx-xxxx" value={p.ivfPhone} onChange={e => updatePreg(i, 'ivfPhone', formatPhone(e.target.value))} /></div>
                          <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={p.ivfAddress} onChange={e => updatePreg(i, 'ivfAddress', e.target.value)} placeholder="Optional" /></div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
          {!readOnly && !canSave && hasPregs && <p className="text-xs text-red-400">Please complete all required fields for each pregnancy.</p>}
          {!readOnly && <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_clinicHospital', form)} disabled={saving || !canSave}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>}
        </CardContent>
      )}
    </Card>
  )
}

// ── Social Media Release ───────────────────────────────
function SocialMediaForm({ data, onSave, saving, quizData, userEmail, readOnly, isOpen, onToggle }) {
  const [form, setForm] = useState({ fullName: '', email: '', signatureDate: '', agreed: false, signature: null })
  const editing = isOpen

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
      <CardHeader className="cursor-pointer" onClick={onToggle}>
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
        <CardContent className={`space-y-4 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}>
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
          {!readOnly && (!form.agreed || !form.signature || !form.fullName || !form.email || !form.signatureDate) && <p className="text-xs text-red-400">Please complete all required fields, sign, and agree to the terms.</p>}
          {!readOnly && <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_socialMediaRelease', form)} disabled={saving || !form.agreed || !form.signature || !form.fullName || !form.email || !form.signatureDate}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>}
        </CardContent>
      )}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────
// Intended Parent Application Forms
// ─────────────────────────────────────────────────────────

// Generic auto-save hook for IP forms — debounces saves so we don't
// hammer the DB on every keystroke.
function useAutoSave(form, onSave, sectionKey, readOnly, hydrated) {
  const timer = useRef(null)
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])
  useEffect(() => {
    if (!onSaveRef.current || readOnly || !hydrated || Object.keys(form || {}).length === 0) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      onSaveRef.current(sectionKey, form, { silent: true })
    }, 1500)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [form, sectionKey, readOnly, hydrated])
}

// ── IP Contact Information ──────────────────────────────
function IPContactForm({ data, onSave, saving, quizData, readOnly, isOpen, onToggle, hasPartner }) {
  const [form, setForm] = useState({})
  const [hydrated, setHydrated] = useState(false)
  const didHydrate = useRef(false)
  useEffect(() => {
    if (didHydrate.current) return
    const a = quizData || {}
    // Prefill priority: existing application answer (data) → profile data
    // (a._ipProfile) → intake quiz answer (a.*). Goal: never make the IP
    // re-enter something they've already answered upstream.
    const profile = a._ipProfile || {}
    const ip1Personal = profile.ip1?.personal || {}
    const ip2Personal = profile.ip2?.personal || {}
    const init = {
      ip1FirstName: data?.ip1FirstName || a.primaryFirstName || '',
      ip1LastName: data?.ip1LastName || a.primaryLastName || '',
      ip1Dob: data?.ip1Dob || ip1Personal.dob || a.primaryDob || '',
      ip1Email: data?.ip1Email || a.email || '',
      ip1Phone: formatPhone(data?.ip1Phone || a.phone || ''),
      country: data?.country || a.country || 'United States',
      street: data?.street || a.street || '',
      city: data?.city || a.city || '',
      state: data?.state || a.stateProv || '',
      zipCode: data?.zipCode || a.zipCode || '',
      ip2FirstName: data?.ip2FirstName || a.ip2FirstName || '',
      ip2LastName: data?.ip2LastName || a.ip2LastName || '',
      ip2Dob: data?.ip2Dob || ip2Personal.dob || a.ip2Dob || '',
      ip2Email: data?.ip2Email || a.ip2Email || '',
      ip2Phone: formatPhone(data?.ip2Phone || a.ip2Phone || ''),
      preferredContact: data?.preferredContact || '',
      emergency1Name: data?.emergency1Name || '',
      emergency1Phone: formatPhone(data?.emergency1Phone || ''),
      emergency1Email: data?.emergency1Email || '',
      emergency2Name: data?.emergency2Name || '',
      emergency2Phone: formatPhone(data?.emergency2Phone || ''),
      emergency2Email: data?.emergency2Email || '',
    }
    setForm(init)
    setHydrated(true)
    didHydrate.current = true
  }, [data, quizData])
  useAutoSave(form, onSave, '_ipContact', readOnly, hydrated)

  const requiredKeys = [
    'ip1FirstName','ip1LastName','ip1Dob','ip1Email','ip1Phone',
    'country','street','city','state','zipCode','preferredContact',
    'emergency1Name','emergency1Phone','emergency1Email',
    'emergency2Name','emergency2Phone','emergency2Email',
  ]
  if (hasPartner) requiredKeys.push('ip2FirstName','ip2LastName','ip2Dob','ip2Email','ip2Phone')
  const allFilled = requiredKeys.every(k => {
    const v = form[k]
    if (k.includes('Phone')) return isValidPhone(v)
    if (k.includes('Email')) return isValidEmail(v)
    return v?.toString().trim()
  })

  function checkComplete(d) {
    if (!d) return false
    const rk = ['ip1FirstName','ip1LastName','ip1Dob','ip1Email','ip1Phone','street','city','state','zipCode','preferredContact']
    if (hasPartner) rk.push('ip2FirstName','ip2LastName','ip2Dob','ip2Email','ip2Phone')
    return rk.every(k => {
      const v = d[k]
      if (k.includes('Phone')) return isValidPhone(v)
      if (k.includes('Email')) return isValidEmail(v)
      return v?.toString().trim()
    })
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {checkComplete(data) ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
          <div>
            <CardTitle className="text-base">Contact Information</CardTitle>
            <CardDescription>Your address and contact details</CardDescription>
          </div>
        </div>
        <CardAction><ChevronDown className={`size-4 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></CardAction>
      </CardHeader>
      {isOpen && (
        <CardContent className={`space-y-4 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase">Intended Parent #1</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1"><FieldLabel>First Name <Req /></FieldLabel><Input value={form.ip1FirstName || ''} onChange={e => setForm(f => ({ ...f, ip1FirstName: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Last Name <Req /></FieldLabel><Input value={form.ip1LastName || ''} onChange={e => setForm(f => ({ ...f, ip1LastName: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Date of Birth <Req /></FieldLabel><Input type="date" value={form.ip1Dob || ''} onChange={e => setForm(f => ({ ...f, ip1Dob: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Email <Req /></FieldLabel><Input type="email" value={form.ip1Email || ''} onChange={e => setForm(f => ({ ...f, ip1Email: e.target.value }))} placeholder="name@example.com" /></div>
            <div className="space-y-1"><FieldLabel>Phone <Req /></FieldLabel><Input type="tel" value={form.ip1Phone || ''} onChange={e => setForm(f => ({ ...f, ip1Phone: formatPhone(e.target.value) }))} placeholder="xxx-xxx-xxxx" /></div>
          </div>

          {hasPartner && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase pt-3 border-t">Intended Parent #2</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1"><FieldLabel>First Name <Req /></FieldLabel><Input value={form.ip2FirstName || ''} onChange={e => setForm(f => ({ ...f, ip2FirstName: e.target.value }))} /></div>
                <div className="space-y-1"><FieldLabel>Last Name <Req /></FieldLabel><Input value={form.ip2LastName || ''} onChange={e => setForm(f => ({ ...f, ip2LastName: e.target.value }))} /></div>
                <div className="space-y-1"><FieldLabel>Date of Birth <Req /></FieldLabel><Input type="date" value={form.ip2Dob || ''} onChange={e => setForm(f => ({ ...f, ip2Dob: e.target.value }))} /></div>
                <div className="space-y-1"><FieldLabel>Email <Req /></FieldLabel><Input type="email" value={form.ip2Email || ''} onChange={e => setForm(f => ({ ...f, ip2Email: e.target.value }))} placeholder="name@example.com" /></div>
                <div className="space-y-1"><FieldLabel>Phone <Req /></FieldLabel><Input type="tel" value={form.ip2Phone || ''} onChange={e => setForm(f => ({ ...f, ip2Phone: formatPhone(e.target.value) }))} placeholder="xxx-xxx-xxxx" /></div>
              </div>
            </>
          )}

          <p className="text-xs font-semibold text-muted-foreground uppercase pt-3 border-t">Home Address</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2"><FieldLabel>Country <Req /></FieldLabel>
              <Input value={form.country || ''} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="United States" />
            </div>
            <div className="space-y-1 sm:col-span-2"><FieldLabel>Street Address <Req /></FieldLabel><Input value={form.street || ''} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>City <Req /></FieldLabel><Input value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div className="space-y-1">
              <FieldLabel>{form.country?.toLowerCase().includes('united states') || !form.country ? 'State' : 'State / Province / Region'} <Req /></FieldLabel>
              {(form.country?.toLowerCase().includes('united states') || !form.country) ? (
                <Select value={form.state || ''} onValueChange={v => setForm(f => ({ ...f, state: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input value={form.state || ''} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="Province / Region" />
              )}
            </div>
            <div className="space-y-1"><FieldLabel>{form.country?.toLowerCase().includes('united states') || !form.country ? 'Zip Code' : 'Postal Code'} <Req /></FieldLabel><Input value={form.zipCode || ''} onChange={e => setForm(f => ({ ...f, zipCode: e.target.value }))} /></div>
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase pt-3 border-t">Preferences</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><FieldLabel>Preferred Contact Method <Req /></FieldLabel>
              <Select value={form.preferredContact || ''} onValueChange={v => setForm(f => ({ ...f, preferredContact: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Phone">Phone</SelectItem>
                  <SelectItem value="Text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {[1, 2].map(n => (
            <div key={`emg-${n}`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase pt-3 border-t">Emergency Contact #{n}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1"><FieldLabel>Name <Req /></FieldLabel>
                  <Input value={form[`emergency${n}Name`] || ''} onChange={e => setForm(f => ({ ...f, [`emergency${n}Name`]: e.target.value }))} />
                </div>
                <div className="space-y-1"><FieldLabel>Phone <Req /></FieldLabel>
                  <Input type="tel" value={form[`emergency${n}Phone`] || ''} onChange={e => setForm(f => ({ ...f, [`emergency${n}Phone`]: formatPhone(e.target.value) }))} placeholder="xxx-xxx-xxxx" />
                </div>
                <div className="space-y-1"><FieldLabel>Email <Req /></FieldLabel>
                  <Input type="email" value={form[`emergency${n}Email`] || ''} onChange={e => setForm(f => ({ ...f, [`emergency${n}Email`]: e.target.value }))} placeholder="name@example.com" />
                </div>
              </div>
            </div>
          ))}

          {!readOnly && !allFilled && <p className="text-xs text-red-400 pt-2">Please complete all required fields.</p>}
          {!readOnly && <Button size="sm" className="gap-1.5 mt-2" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_ipContact', form)} disabled={saving || !allFilled}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>}
        </CardContent>
      )}
    </Card>
  )
}

// ── IP Clinic Information ────────────────────────────────
function IPClinicForm({ data, onSave, saving, quizData, readOnly, isOpen, onToggle }) {
  const [form, setForm] = useState({})
  const [hydrated, setHydrated] = useState(false)
  const didHydrate = useRef(false)
  useEffect(() => {
    if (didHydrate.current) return
    const a = quizData || {}
    // Prefill priority: existing _ipClinic answer → IP profile (fertility +
    // surrogacy sections) → intake quiz answers. The IP shouldn't re-enter
    // anything they already gave us in their matching profile or intake.
    const profile = a._ipProfile || {}
    const fert = profile.fertility || {}
    const surr = profile.surrogacy || {}
    const ynFromBool = (v) => v === true ? 'yes' : v === false ? 'no' : ''
    const init = {
      clinicName: data?.clinicName || surr.clinicName || '',
      clinicStreet: data?.clinicStreet || '',
      clinicCity: data?.clinicCity || '',
      clinicState: data?.clinicState || '',
      clinicZip: data?.clinicZip || '',
      clinicPhone: formatPhone(data?.clinicPhone || ''),
      reDoctorName: data?.reDoctorName || surr.reDoctorName || a.reDoctorName || '',
      reDoctorEmail: data?.reDoctorEmail || '',
      reDoctorPhone: formatPhone(data?.reDoctorPhone || ''),
      nurseCoordinator: data?.nurseCoordinator || '',
      embryoCount: data?.embryoCount || fert.frozenEmbryoCount || a.frozenEmbryoCount || a.frozenEmbryoDetails || '',
      embryosTested: data?.embryosTested || fert.embryosGeneticallyTested || '',
      usingEggDonor: data?.usingEggDonor || fert.usingEggDonor || ynFromBool(a.usingEggDonor),
      usingSpermDonor: data?.usingSpermDonor || fert.usingSpermDonor || ynFromBool(a.usingSpermDonor),
    }
    setForm(init)
    setHydrated(true)
    didHydrate.current = true
  }, [data, quizData])
  useAutoSave(form, onSave, '_ipClinic', readOnly, hydrated)

  const requiredKeys = [
    'clinicName','clinicPhone','reDoctorName','reDoctorPhone',
    'embryoCount','embryosTested','usingEggDonor','usingSpermDonor',
  ]
  const allFilled = requiredKeys.every(k => {
    const v = form[k]
    if (k.endsWith('Phone')) return isValidPhone(v)
    if (['embryosTested','usingEggDonor','usingSpermDonor'].includes(k)) return v === 'yes' || v === 'no' || v === 'undecided'
    return v?.toString().trim()
  })

  function checkComplete(d) {
    if (!d) return false
    return requiredKeys.every(k => {
      const v = d[k]
      if (k.endsWith('Phone')) return isValidPhone(v)
      if (['embryosTested','usingEggDonor','usingSpermDonor'].includes(k)) return v === 'yes' || v === 'no' || v === 'undecided'
      return v?.toString().trim()
    })
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {checkComplete(data) ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
          <div>
            <CardTitle className="text-base">Clinic Information</CardTitle>
            <CardDescription>Your fertility clinic, doctor, and embryo details</CardDescription>
          </div>
        </div>
        <CardAction><ChevronDown className={`size-4 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></CardAction>
      </CardHeader>
      {isOpen && (
        <CardContent className={`space-y-4 ${readOnly ? 'pointer-events-none opacity-60' : ''}`}>
          <p className="text-xs font-semibold text-muted-foreground uppercase">Fertility Clinic</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2"><FieldLabel>Clinic Name <Req /></FieldLabel><Input value={form.clinicName || ''} onChange={e => setForm(f => ({ ...f, clinicName: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Clinic Phone <Req /></FieldLabel><Input type="tel" value={form.clinicPhone || ''} onChange={e => setForm(f => ({ ...f, clinicPhone: formatPhone(e.target.value) }))} placeholder="xxx-xxx-xxxx" /></div>
            <div className="space-y-1 sm:col-span-2"><FieldLabel>Street Address</FieldLabel><Input value={form.clinicStreet || ''} onChange={e => setForm(f => ({ ...f, clinicStreet: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>City</FieldLabel><Input value={form.clinicCity || ''} onChange={e => setForm(f => ({ ...f, clinicCity: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>State</FieldLabel>
              <Select value={form.clinicState || ''} onValueChange={v => setForm(f => ({ ...f, clinicState: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><FieldLabel>Zip</FieldLabel><Input value={form.clinicZip || ''} onChange={e => setForm(f => ({ ...f, clinicZip: e.target.value }))} /></div>
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase pt-3 border-t">Reproductive Endocrinologist (RE)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1"><FieldLabel>Doctor Name <Req /></FieldLabel><Input value={form.reDoctorName || ''} onChange={e => setForm(f => ({ ...f, reDoctorName: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Email</FieldLabel><Input type="email" value={form.reDoctorEmail || ''} onChange={e => setForm(f => ({ ...f, reDoctorEmail: e.target.value }))} placeholder="doctor@clinic.com" /></div>
            <div className="space-y-1"><FieldLabel>Phone <Req /></FieldLabel><Input type="tel" value={form.reDoctorPhone || ''} onChange={e => setForm(f => ({ ...f, reDoctorPhone: formatPhone(e.target.value) }))} placeholder="xxx-xxx-xxxx" /></div>
            <div className="space-y-1"><FieldLabel>Nurse Coordinator</FieldLabel><Input value={form.nurseCoordinator || ''} onChange={e => setForm(f => ({ ...f, nurseCoordinator: e.target.value }))} /></div>
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase pt-3 border-t">Embryos</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1"><FieldLabel>How Many Embryos? <Req /></FieldLabel><Input value={form.embryoCount || ''} onChange={e => setForm(f => ({ ...f, embryoCount: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Genetically Tested? <Req /></FieldLabel>
              <Select value={form.embryosTested || ''} onValueChange={v => setForm(f => ({ ...f, embryosTested: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="undecided">Undecided</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><FieldLabel>Using Egg Donor? <Req /></FieldLabel>
              <Select value={form.usingEggDonor || ''} onValueChange={v => setForm(f => ({ ...f, usingEggDonor: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="undecided">Undecided</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><FieldLabel>Using Sperm Donor? <Req /></FieldLabel>
              <Select value={form.usingSpermDonor || ''} onValueChange={v => setForm(f => ({ ...f, usingSpermDonor: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="undecided">Undecided</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!readOnly && !allFilled && <p className="text-xs text-red-400 pt-2">Please complete all required fields.</p>}
          {!readOnly && <Button size="sm" className="gap-1.5 mt-2" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_ipClinic', form)} disabled={saving || !allFilled}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>}
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
  const [submitOpen, setSubmitOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(null)
  const [assignedTo, setAssignedTo] = useState(null)
  const [intakeType, setIntakeType] = useState(null) // 'gc' (surrogate) | 'ip'
  const isSubmitted = answers?._applicationSubmitted
  const isIP = intakeType === 'ip' || currentUser?.role === 'intended_parent'
  const sections = isIP ? IP_FORM_SECTIONS : FORM_SECTIONS
  const hasPartner = answers?.hasPartner === 'yes' || answers?.hasPartner === true
  const ip1Name = answers?.primaryFirstName || ''
  const ip2Name = answers?.ip2FirstName || ''

  useEffect(() => {
    if (!currentUser?.email || !supabase) { setLoading(false); return }
    loadData()
  }, [currentUser?.email])

  async function loadData() {
    try {
      const data = await findCaseByEmail(currentUser.email)
      if (data) {
        setCaseId(data.id)
        setAnswers(data.answers || {})
        if (data.assigned_to) setAssignedTo(data.assigned_to)
        if (data.intake_type) setIntakeType(data.intake_type)
      }
    } catch (err) {
      console.error('Failed to load application data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(sectionKey, formData, opts = {}) {
    const silent = !!opts.silent
    if (!caseId || !supabase) { console.error('Cannot save: no caseId or supabase', { caseId, supabase: !!supabase }); return }
    if (!silent) setSaving(true)
    try {
      // Fresh read to avoid overwriting concurrent admin edits
      const { data: fresh } = await supabase.from('intake_submissions').select('answers').eq('id', caseId).single()
      const currentAnswers = fresh?.answers || answers
      const updatedAnswers = { ...currentAnswers, [sectionKey]: { ...(currentAnswers[sectionKey] || {}), ...formData } }
      const { error } = await supabase.from('intake_submissions').update({ answers: updatedAnswers }).eq('id', caseId)
      if (error) throw error
      setAnswers(updatedAnswers)
      // Silent auto-saves don't advance section or pop modals; they just persist.
      // After silent save, still check if everything is complete and trigger submit modal.
      if (silent) {
        const allDone = sections.every(s => isSectionComplete(s.key, updatedAnswers))
        if (allDone && !updatedAnswers._applicationSubmitted && !submitOpen) {
          setSubmitOpen(true)
        }
        return
      }
      // Manual save: advance to next section
      const sectionOrder = sections.map(s => s.key)
      const currentIdx = sectionOrder.indexOf(sectionKey)
      const nextKey = sectionOrder[currentIdx + 1]
      if (nextKey) {
        setActiveSection(nextKey)
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
      } else {
        setActiveSection(null)
        // All saved — check if all complete and show submit
        setTimeout(() => {
          const allDone = sections.every(s => isSectionComplete(s.key, updatedAnswers))
          if (allDone && !updatedAnswers._applicationSubmitted) {
            setSubmitOpen(true)
          }
        }, 300)
      }
    } catch (err) {
      console.error('Save failed:', err)
      if (!silent) alert('Failed to save. Please try again.')
    } finally {
      if (!silent) setSaving(false)
    }
  }

  async function handleSubmit() {
    if (!caseId || !supabase) return
    setSaving(true)
    try {
      const { data: fresh } = await supabase.from('intake_submissions').select('answers').eq('id', caseId).single()
      const currentAnswers = fresh?.answers || answers

      // Build checklist update inline (avoids separate read/write + RLS issues)
      const existingTracking = currentAnswers._recordTracking || {}
      const currentAppStep = existingTracking.app_complete || { history: [] }
      const trackingEntry = {
        status: 'reviewing',
        date: new Date().toISOString().split('T')[0],
        note: 'Submitted by Applicant',
        by: 'System',
      }
      const updatedTracking = {
        ...existingTracking,
        app_complete: {
          ...currentAppStep,
          status: 'reviewing',
          history: [...(currentAppStep.history || []), trackingEntry],
        },
      }

      const updated = {
        ...currentAnswers,
        _applicationSubmitted: true,
        _applicationSubmittedAt: new Date().toISOString(),
        _recordTracking: updatedTracking,
      }
      await supabase.from('intake_submissions').update({ answers: updated }).eq('id', caseId)
      setAnswers(updated)
      setSubmitOpen(false)
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 200)

      // Create task for assigned admin to review the application
      const ip1Name = [currentAnswers?.primaryFirstName, currentAnswers?.primaryLastName].filter(Boolean).join(' ')
      const ip2Name = [currentAnswers?.ip2FirstName, currentAnswers?.ip2LastName].filter(Boolean).join(' ')
      const surName = isIP
        ? (ip2Name ? `${ip1Name} & ${ip2Name}` : (ip1Name || currentUser?.name || 'Intended Parent'))
        : ([currentAnswers?.firstName, currentAnswers?.lastName].filter(Boolean).join(' ') || currentUser?.name || 'Surrogate')
      try {
        await createCaseTask({
          case_id: Number(caseId),
          case_type: isIP ? 'ip' : 'surrogate',
          title: `Review Application - ${surName}`,
          description: 'Application submitted by applicant. Please review all sections.',
          assigned_to: assignedTo || (isIP ? 'julie@abcsurrogacy.com' : 'intake@abcsurrogacy.com'),
          due_date: new Date().toISOString().split('T')[0],
          priority: 'high',
          status: 'open',
          created_by: 'System',
        })
      } catch (err) {
        console.error('Auto-task for app review failed:', err)
      }

      // Notify admin(s) that application was submitted — route IP vs surrogate to the right endpoint
      try {
        if (isIP) {
          fetch('/api/notify-ip-app-submitted', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ip1Name: ip1Name || currentUser?.name || 'Intended Parent',
              ip2Name: ip2Name || '',
              ip1Email: currentUser?.email || '',
              assignedTo: assignedTo || '',
              caseId: caseId,
            }),
          }).catch(() => {})
        } else {
          fetch('/api/notify-app-submitted', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              surrogateName: surName,
              surrogateEmail: currentUser?.email || '',
              assignedTo: assignedTo || '',
              caseId: caseId,
            }),
          }).catch(() => {})
        }
      } catch {}
    } catch (err) {
      console.error('Submit failed:', err)
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

  function isSectionComplete(key, overrideAnswers) {
    const d = (overrideAnswers || answers)[key]
    if (!d) return false
    if (key === '_application') {
      const hs = d.hasSpouse === 'yes' || d.hasSpouse === true
      const hi = d.hasInsurance === 'yes' || d.hasInsurance === true
      const required = [
        'fullLegalName', 'dob', 'ssn4', 'street', 'city', 'state', 'zipCode',
        'hasInsurance',
        ...(hi ? ['insuranceProvider', 'insurancePolicyNumber', 'insuranceGroupNumber', 'insurancePhone'] : []),
        'hasSpouse',
        ...(hs ? ['spouseFirstName', 'spouseDob', 'spouseEmail', 'spousePhone'] : []),
        'emergencyName', 'emergencyPhone', 'emergencyRelationship',
      ]
      return required.every(k => {
        const v = d[k]
        if (['hasInsurance', 'hasSpouse'].includes(k)) return v === 'yes' || v === 'no' || v === true || v === false
        if (['insurancePhone', 'spousePhone', 'emergencyPhone'].includes(k)) return isValidPhone(v)
        if (k === 'spouseEmail') return isValidEmail(v)
        return v?.toString().trim()
      })
    }
    if (key === '_confidential') {
      const PHONE_KEYS = ['insurancePhone', 'spousePhone', 'emergencyPhone']
      const EMAIL_KEYS = ['spouseEmail']
      const hs = d.hasSpouse === 'yes' || d.hasSpouse === true
      const hi = d.hasInsurance === 'yes' || d.hasInsurance === true
      const yesNoKeys = ['hasSpouse', 'hasInsurance']
      const required = ['fullLegalName', 'dob', 'ssn4', 'driversLicense', 'hasInsurance', ...(hi ? ['insuranceProvider', 'insurancePolicyNumber', 'insuranceGroupNumber', 'insurancePhone'] : []), 'hasSpouse', ...(hs ? ['spouseFullName', 'spouseEmail', 'spousePhone'] : []), 'emergencyName', 'emergencyPhone', 'emergencyRelationship']
      return required.every(k => {
        const v = d[k]
        if (yesNoKeys.includes(k)) return v === 'yes' || v === 'no' || v === true || v === false
        if (PHONE_KEYS.includes(k)) return isValidPhone(v)
        if (EMAIL_KEYS.includes(k)) return isValidEmail(v)
        return v?.toString().trim()
      })
    }
    if (key === '_references') {
      const refs = ['ref1', 'ref2', 'ref3']
      const fields = ['name', 'phone', 'email', 'cityState', 'relationship']
      return refs.every(r => fields.every(f => d[`${r}_${f}`]?.trim()))
    }
    if (key === '_clinicHospital') {
      if (!d.currentOBGYN || !d.numberOfPregnancies || !(d.pregnancies?.length > 0)) return false
      return d.pregnancies.every(p => {
        if (!p.outcome) return false
        const isNonDel = NON_DELIVERY_OUTCOMES.includes((p.outcome || '').toLowerCase())
        if (isNonDel && p.receivedPrenatalCare === 'no') return true
        if (!p.obClinicName || !p.obDoctorName) return false
        if (!isNonDel && !p.hospitalName) return false
        return true
      })
    }
    if (key === '_profileFollowUp') {
      // Check that all yes/no fields have a value
      const ynKeys = ['breastfeeding', 'cycleLength', 'placedForAdoption', 'gunsOwned', 'eatingDisorders', 'recentTravel', 'sleepIssues', 'autoInsurance', 'validLicense', 'partnerFdaTests', 'compensationNegotiable', 'nonSterilePiercing']
      return ynKeys.every(k => d[k] === 'yes' || d[k] === 'no' || d[k] === true || d[k] === false)
    }
    if (key === '_paymentPreference') {
      return !!(d.method && (d.method === 'Venmo' ? d.venmoUsername : d.zelleInfo))
    }
    if (key === '_socialMediaRelease') {
      return !!(d.agreed && d.signature && d.fullName && d.email && d.signatureDate)
    }
    if (key === '_ipContact') {
      const rk = ['ip1FirstName','ip1LastName','ip1Dob','ip1Email','ip1Phone','country','street','city','state','zipCode','preferredContact',
        'emergency1Name','emergency1Phone','emergency1Email',
        'emergency2Name','emergency2Phone','emergency2Email']
      if (hasPartner) rk.push('ip2FirstName','ip2LastName','ip2Dob','ip2Email','ip2Phone')
      return rk.every(k => {
        const v = d[k]
        if (k.includes('Phone')) return isValidPhone(v)
        if (k.includes('Email')) return isValidEmail(v)
        return v?.toString().trim()
      })
    }
    if (key === '_ipClinic') {
      const rk = ['clinicName','clinicPhone','reDoctorName','reDoctorPhone','embryoCount','embryosTested','usingEggDonor','usingSpermDonor']
      return rk.every(k => {
        const v = d[k]
        if (k.endsWith('Phone')) return isValidPhone(v)
        if (['embryosTested','usingEggDonor','usingSpermDonor'].includes(k)) return v === 'yes' || v === 'no' || v === 'undecided'
        return v?.toString().trim()
      })
    }
    return false
  }

  const completedCount = sections.filter(s => isSectionComplete(s.key)).length
  const allComplete = completedCount === sections.length

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Application"
        subtitle={isSubmitted ? 'Your application has been submitted.' : `Complete each section below. ${completedCount} of ${sections.length} complete.`}
      />

      {isSubmitted && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
          <p className="text-sm text-emerald-700 font-medium">Application submitted on {new Date(answers._applicationSubmittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. We will review this soon and get back to you for next steps! You can view your responses below. You are unable to make edits at this time. Please reach out to <a href="mailto:jenn@abcsurrogacy.com" className="underline font-semibold">jenn@abcsurrogacy.com</a> if you need to make a change.</p>
        </div>
      )}

      {!isSubmitted && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 rounded-full bg-stone-100">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / sections.length) * 100}%`, backgroundColor: '#ed148c' }}
            />
          </div>
          <span className="text-xs text-stone-500 font-medium">{completedCount}/{sections.length}</span>
        </div>
      )}

      {isIP ? (
        <>
          <IPContactForm data={answers._ipContact} onSave={isSubmitted ? null : handleSave} saving={saving} quizData={answers} hasPartner={hasPartner} readOnly={isSubmitted}
            isOpen={activeSection === '_ipContact'} onToggle={() => setActiveSection(activeSection === '_ipContact' ? null : '_ipContact')} />
          <IPClinicForm data={answers._ipClinic} onSave={isSubmitted ? null : handleSave} saving={saving} quizData={answers} readOnly={isSubmitted}
            isOpen={activeSection === '_ipClinic'} onToggle={() => setActiveSection(activeSection === '_ipClinic' ? null : '_ipClinic')} />
        </>
      ) : (
        <>
          <PersonalInfoForm data={answers._application} onSave={isSubmitted ? null : handleSave} saving={saving} readOnly={isSubmitted}
            quizData={answers} caseId={caseId} userId={currentUser?.id || currentUser?.email}
            isOpen={activeSection === '_application'} onToggle={() => setActiveSection(activeSection === '_application' ? null : '_application')} />
          <ProfileFollowUpForm data={answers._profileFollowUp} onSave={isSubmitted ? null : handleSave} saving={saving} readOnly={isSubmitted}
            isOpen={activeSection === '_profileFollowUp'} onToggle={() => setActiveSection(activeSection === '_profileFollowUp' ? null : '_profileFollowUp')} />
          <ReferencesForm data={answers._references} onSave={isSubmitted ? null : handleSave} saving={saving} readOnly={isSubmitted}
            isOpen={activeSection === '_references'} onToggle={() => setActiveSection(activeSection === '_references' ? null : '_references')} />
          <ClinicHospitalForm data={answers._clinicHospital} onSave={isSubmitted ? null : handleSave} saving={saving} quizData={answers} userId={currentUser?.id || currentUser?.email} readOnly={isSubmitted}
            isOpen={activeSection === '_clinicHospital'} onToggle={() => setActiveSection(activeSection === '_clinicHospital' ? null : '_clinicHospital')} />
          <PaymentPreferenceForm data={answers._paymentPreference} onSave={isSubmitted ? null : handleSave} saving={saving} readOnly={isSubmitted} caseId={caseId}
            isOpen={activeSection === '_paymentPreference'} onToggle={() => setActiveSection(activeSection === '_paymentPreference' ? null : '_paymentPreference')} />
          <SocialMediaForm data={answers._socialMediaRelease} onSave={isSubmitted ? null : handleSave} saving={saving} quizData={answers} userEmail={currentUser?.email} readOnly={isSubmitted}
            isOpen={activeSection === '_socialMediaRelease'} onToggle={() => setActiveSection(activeSection === '_socialMediaRelease' ? null : '_socialMediaRelease')} />
        </>
      )}

      {/* Submit button — only when all complete and not yet submitted */}
      {!isSubmitted && allComplete && (
        <div className="flex justify-center pt-4">
          <Button size="lg" className="gap-2 text-base px-8" style={{ backgroundColor: '#ed148c' }} onClick={() => setSubmitOpen(true)}>
            <Send className="size-4" /> Submit Application
          </Button>
        </div>
      )}

      {/* Submit confirmation modal */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Application is 100% complete. Submit application?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600 leading-relaxed">
            <strong>Once submitted, you won't be able to make any edits.</strong> Our team will review your application and reach out with any questions and next steps. If you need to make a change after submitting, please contact us and we can reopen it for you.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSubmit} disabled={saving} style={{ backgroundColor: '#ed148c' }} className="gap-1.5">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

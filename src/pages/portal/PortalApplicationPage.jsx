import { useState, useEffect, useMemo } from 'react'
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

  const hasData = data && Object.values(data).some(v => v)

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={() => setEditing(!editing)}>
        <div className="flex items-center gap-2">
          {hasData ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
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
            <div className="space-y-1 sm:col-span-2"><FieldLabel>Street Address</FieldLabel><Input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>City</FieldLabel><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>State</FieldLabel>
              <Select value={form.state} onValueChange={v => setForm(f => ({ ...f, state: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><FieldLabel>Zip Code</FieldLabel><Input value={form.zipCode} onChange={e => setForm(f => ({ ...f, zipCode: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Do you have a Real ID?</FieldLabel><YesNoButtons value={form.realId} onChange={v => setForm(f => ({ ...f, realId: v }))} /></div>
            <div className="space-y-1"><FieldLabel>Do you have a valid passport?</FieldLabel><YesNoButtons value={form.validPassport} onChange={v => setForm(f => ({ ...f, validPassport: v }))} /></div>
            <div className="space-y-1 sm:col-span-2"><FieldLabel>Nearest hospital with Level II or III NICU</FieldLabel><Input value={form.nearestNICU} onChange={e => setForm(f => ({ ...f, nearestNICU: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Willing to travel to Level II+ NICU?</FieldLabel><YesNoButtons value={form.willingToTravelNICU} onChange={v => setForm(f => ({ ...f, willingToTravelNICU: v }))} /></div>
          </div>
          <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_application', form)} disabled={saving}>
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

  const hasData = data && Object.entries(data).some(([k, v]) => v && !k.startsWith('admin'))

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={() => setEditing(!editing)}>
        <div className="flex items-center gap-2">
          {hasData ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
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
                      <FieldLabel>{labels[f]}</FieldLabel>
                      <Input value={form[key] || ''} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => {
            // Strip adminNotes from the save — preserve existing admin notes
            const cleaned = { ...form }
            if (data) {
              for (const [k, v] of Object.entries(data)) {
                if (k.includes('adminNotes')) cleaned[k] = v
              }
            }
            onSave('_references', cleaned)
          }} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

// ── Confidential Information ───────────────────────────
function ConfidentialForm({ data, onSave, saving }) {
  const [form, setForm] = useState({})
  const [editing, setEditing] = useState(false)

  const FIELDS = [
    { key: 'fullLegalName', label: 'Full Legal Name' },
    { key: 'maidenName', label: 'Maiden Name (if applicable)' },
    { key: 'dob', label: 'Date of Birth', type: 'date' },
    { key: 'ssn4', label: 'Last 4 of SSN' },
    { key: 'driversLicense', label: "Driver's License #" },
    { key: 'religion', label: 'Religion' },
    { key: 'insuranceProvider', label: 'Health Insurance Provider' },
    { key: 'insurancePolicyNumber', label: 'Policy Number' },
    { key: 'insuranceGroupNumber', label: 'Group Number' },
    { key: 'insurancePhone', label: 'Insurance Phone' },
    { key: 'hasSpouse', label: 'Do you have a spouse/partner?', type: 'yesno' },
    { key: 'spouseFullName', label: 'Spouse/Partner Full Name' },
    { key: 'spouseEmail', label: 'Spouse/Partner Email' },
    { key: 'spousePhone', label: 'Spouse/Partner Phone' },
    { key: 'emergencyName', label: 'Emergency Contact Name' },
    { key: 'emergencyPhone', label: 'Emergency Contact Phone' },
    { key: 'emergencyRelationship', label: 'Emergency Contact Relationship' },
  ]

  useEffect(() => {
    if (data) {
      const init = {}
      for (const f of FIELDS) init[f.key] = data[f.key] || ''
      setForm(init)
    }
  }, [data])

  const hasData = data && Object.values(data).some(v => v)

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={() => setEditing(!editing)}>
        <div className="flex items-center gap-2">
          {hasData ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
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
              if (f.key === 'spouseFullName' || f.key === 'spouseEmail' || f.key === 'spousePhone') {
                if (form.hasSpouse !== 'yes' && form.hasSpouse !== true) return null
              }
              if (f.type === 'yesno') {
                return (
                  <div key={f.key} className="space-y-1">
                    <FieldLabel>{f.label}</FieldLabel>
                    <YesNoButtons value={form[f.key]} onChange={v => setForm(prev => ({ ...prev, [f.key]: v }))} />
                  </div>
                )
              }
              return (
                <div key={f.key} className="space-y-1">
                  <FieldLabel>{f.label}</FieldLabel>
                  <Input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                </div>
              )
            })}
          </div>
          <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_confidential', form)} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

// ── Social Media Release ───────────────────────────────
function SocialMediaForm({ data, onSave, saving }) {
  const [form, setForm] = useState({ fullName: '', email: '', signatureDate: '', agreed: false })
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (data) setForm({
      fullName: data.fullName || '', email: data.email || '',
      signatureDate: data.signatureDate || '', agreed: data.agreed || false,
    })
  }, [data])

  const hasData = data?.agreed

  return (
    <Card className="rounded-2xl">
      <CardHeader className="cursor-pointer" onClick={() => setEditing(!editing)}>
        <div className="flex items-center gap-2">
          {hasData ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4 text-stone-300" />}
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
            <div className="space-y-1"><FieldLabel>Full Name</FieldLabel><Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Email</FieldLabel><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1"><FieldLabel>Date</FieldLabel><Input type="date" value={form.signatureDate} onChange={e => setForm(f => ({ ...f, signatureDate: e.target.value }))} /></div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.agreed} onChange={e => setForm(f => ({ ...f, agreed: e.target.checked }))} className="size-4 accent-[#283693]" />
            <span className="text-sm text-stone-700">I agree to the terms above</span>
          </label>
          <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#283693' }} onClick={() => onSave('_socialMediaRelease', form)} disabled={saving}>
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

  const completedCount = FORM_SECTIONS.filter(s => {
    const d = answers[s.key]
    return d && Object.values(d).some(v => v)
  }).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Application"
        subtitle={`Complete each section below. ${completedCount} of ${FORM_SECTIONS.length} started.`}
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
      <ConfidentialForm data={answers._confidential} onSave={handleSave} saving={saving} />
      <ReferencesForm data={answers._references} onSave={handleSave} saving={saving} />
      <SocialMediaForm data={answers._socialMediaRelease} onSave={handleSave} saving={saving} />
    </div>
  )
}

import { useState, useMemo, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import { ChevronDown, Search, Pencil, Save, Loader2, Plus, Trash2, FileText, Shield, DollarSign, Upload } from 'lucide-react'
import { updateIntakeSubmission } from '@/lib/db'
import { formatPhoneInput } from '@/lib/utils'
import TemplateAnswersSection from '@/components/surrogates/TemplateAnswersSection'
import { GC_TEMPLATE_SECTIONS } from '@/lib/gcApplication'
import { FOLLOW_UP_FIELDS, FIELD_LABELS } from '@/components/profile/profileConstants'
import { useRole } from '@/context/RoleContext'
import { ADMIN_ROLES } from '@/lib/constants'
import SendFormTemplateButton from '@/components/shared/SendFormTemplateButton'
import ReleaseFormsSection from '@/components/surrogates/ReleaseFormsSection'
import { getAdminStaff } from '@/data/mock/users'

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming'
]

// ── Helpers ─────────────────────────────────────────────
function FieldLabel({ children }) {
  return <label className="text-xs text-muted-foreground font-medium">{children}</label>
}

function ReadField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || '—'}</p>
    </div>
  )
}

function YesNoButtons({ value, onChange }) {
  const isYes = value === true || value === 'yes' || value === 'Yes'
  const isNo = value === false || value === 'no' || value === 'No'
  return (
    <div className="flex items-center gap-2 pt-0.5">
      <button type="button" onClick={() => onChange('yes')}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${isYes ? 'bg-[#1A3638] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Yes</button>
      <button type="button" onClick={() => onChange('no')}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${isNo ? 'bg-[#1A3638] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>No</button>
    </div>
  )
}

function SelectField({ value, onValueChange, options, placeholder = 'Select...' }) {
  return (
    <SelectUI value={value || ''} onValueChange={onValueChange}>
      <SelectTriggerUI className="h-9 text-sm bg-white"><SelectValueUI placeholder={placeholder} /></SelectTriggerUI>
      <SelectContentUI>
        {options.map(opt => <SelectItemUI key={opt} value={opt}>{opt}</SelectItemUI>)}
      </SelectContentUI>
    </SelectUI>
  )
}

function boolDisplay(val) {
  if (val === true || val === 'yes' || val === 'Yes') return 'Yes'
  if (val === false || val === 'no' || val === 'No') return 'No'
  return '—'
}

// ── Section wrapper ─────────────────────────────────────
function FormSection({ title, description, children, defaultOpen = false, searchMatch = true }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!searchMatch) return null
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="rounded-2xl">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            <CardAction>
              <ChevronDown className={`size-5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </CardAction>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ── Quiz Answers Section ────────────────────────────────
const MARITAL_OPTIONS = ['Single', 'In a Relationship', 'Married', 'Domestic Partnership', 'Divorced', 'Separated', 'Widowed']
const CONTACT_OPTIONS = ['Text', 'Email', 'Phone']

const STATE_ABBRS = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

// Mirrors the questions in src/pages/intake/SurrogateIntakeForm.jsx. `legacy`
// is the key the old (ABC-era) quiz used for the same question, so older rows
// still display. `legacyOnly` questions aren't asked anymore and only show
// when a row already has an answer.
const QUIZ_FIELDS = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'street', label: 'Street Address' },
  { key: 'street2', label: 'Street Address Line 2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State', type: 'state' },
  { key: 'zip', label: 'ZIP Code' },
  { key: 'usCitizen', label: 'U.S. Citizen', type: 'yesno' },
  { key: 'permanentResident', label: 'Permanent Resident', type: 'yesno' },
  { key: 'dob', label: 'Date of Birth', type: 'date' },
  { key: 'heightFt', label: 'Height (ft)', type: 'number' },
  { key: 'heightIn', label: 'Height (in)', type: 'number' },
  { key: 'weightLbs', label: 'Weight (lbs)', type: 'number' },
  { key: 'bmi', label: 'BMI' },
  { key: 'hasSpouseOrPartner', label: 'Has Spouse or Partner', type: 'yesno' },
  { key: 'numPregnancies', label: 'Number of Pregnancies', type: 'number' },
  { key: 'numChildren', label: 'Children Given Birth To', type: 'number' },
  { key: 'lastDeliveryDate', label: 'Most Recent Delivery Date', type: 'date' },
  { key: 'allHealthy', legacy: 'healthyPregnancy', label: 'All Pregnancies Healthy', type: 'yesno' },
  { key: 'numCsections', label: 'Number of C-sections', type: 'number' },
  { key: 'previousSurrogate', legacy: 'experiencedSurrogate', label: 'Previously a Surrogate', type: 'yesno' },
  { key: 'takesPrescriptions', label: 'Takes Prescription Medications', type: 'yesno' },
  { key: 'prescriptionList', label: 'Current Prescriptions', type: 'textarea' },
  { key: 'hasInsurance', label: 'Has Health Insurance', type: 'yesno' },
  { key: 'publicAssistance', label: 'Receives Public Assistance / State Insurance', type: 'yesno' },
  { key: 'levelInterestTimeline', label: 'Level of Interest & Timeline', type: 'textarea' },
  { key: 'hearAbout', legacy: 'hearAboutUs', label: 'How did you hear about us?' },
  { key: 'hearAboutUsOther', label: 'Other (specify)', legacyOnly: true },
  { key: 'maritalStatus', label: 'Marital Status', type: 'select', options: MARITAL_OPTIONS, legacyOnly: true },
  { key: 'preferredContact', label: 'Preferred Contact', type: 'select', options: CONTACT_OPTIONS, legacyOnly: true },
  { key: 'agreeBackgroundCheck', label: 'Agreed to Background Check', type: 'yesno', legacyOnly: true },
]

const isBlank = (v) => v === undefined || v === null || v === ''
function quizValue(answers, f) {
  const v = answers?.[f.key]
  return isBlank(v) && f.legacy ? answers?.[f.legacy] : v
}

function QuizSection({ surrogate, quizAnswers, onSaved, search }) {
  const qa = quizAnswers || {}
  const visibleFields = QUIZ_FIELDS.filter(f => !f.legacyOnly || !isBlank(quizValue(qa, f)))

  const hasMatch = search ? visibleFields.some(f => f.label.toLowerCase().includes(search) || String(quizValue(qa, f) ?? '').toLowerCase().includes(search)) : true

  const { editing, saving, form, setForm, startEdit, handleSave, cancel } = useFormSection(
    surrogate?.id, quizAnswers, null,
    (_, answers) => {
      const init = {}
      for (const f of QUIZ_FIELDS) init[f.key] = quizValue(answers, f) ?? ''
      return init
    }
  )

  // Override handleSave to save directly to root answers (not a sub-key)
  async function saveQuiz() {
    if (!surrogate?.id) return
    const origSaving = saving
    try {
      // Fetch fresh answers to merge
      const { supabase } = await import('@/lib/supabase')
      let currentAnswers = quizAnswers || {}
      if (supabase) {
        const { data } = await supabase.from('intake_submissions').select('answers').eq('id', surrogate.id).single()
        if (data?.answers) currentAnswers = data.answers
      }
      const quizFields = { ...form }
      const merged = { ...currentAnswers, ...quizFields }
      await updateIntakeSubmission(surrogate.id, {
        answers: merged,
        applicant_name: `${form.firstName || ''} ${form.lastName || ''}`.trim(),
        applicant_email: (form.email || '').trim().toLowerCase(),
        applicant_phone: form.phone || '',
        state_region: form.state || '',
      })
      if (onSaved) onSaved(merged)
      cancel()
    } catch (err) {
      alert('Failed to save: ' + (err.message || ''))
    }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  if (!hasMatch) return null

  return (
    <Card className="rounded-2xl">
      <EditHeader
        title="Surrogate Quiz"
        description="Answers from the initial screening quiz"
        editing={editing}
        saving={saving}
        startEdit={startEdit}
        handleSave={saveQuiz}
        cancel={cancel}
      />
      <CardContent>
        {editing ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleFields.map(f => {
                if (f.type === 'yesno') return (
                  <div key={f.key} className="space-y-1"><FieldLabel>{f.label}</FieldLabel><YesNoButtons value={form[f.key]} onChange={v => set(f.key, v)} /></div>
                )
                if (f.type === 'select' || f.type === 'state') {
                  const base = f.type === 'state' ? STATE_ABBRS : f.options
                  const opts = form[f.key] && !base.includes(form[f.key]) ? [form[f.key], ...base] : base
                  return (
                    <div key={f.key} className="space-y-1"><FieldLabel>{f.label}</FieldLabel><SelectField value={form[f.key]} onValueChange={v => set(f.key, v)} options={opts} /></div>
                  )
                }
                if (f.type === 'textarea') return (
                  <div key={f.key} className="space-y-1 sm:col-span-2 lg:col-span-3"><FieldLabel>{f.label}</FieldLabel>
                    <Textarea value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} rows={3} className="bg-white text-sm" />
                  </div>
                )
                return (
                  <div key={f.key} className="space-y-1"><FieldLabel>{f.label}</FieldLabel>
                    <input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                      className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm bg-white focus:border-[#1A3638] focus:ring-1 focus:ring-[#1A3638]/20 outline-none" />
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleFields.map(f => {
                const val = quizValue(qa, f)
                if (isBlank(val)) return null
                const display = f.type === 'yesno' ? boolDisplay(val) : String(val)
                if (search && !f.label.toLowerCase().includes(search) && !display.toLowerCase().includes(search)) return null
                const wide = f.type === 'textarea' ? 'sm:col-span-2 lg:col-span-3' : ''
                return <div key={f.key} className={wide}><ReadField label={f.label} value={display} /></div>
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Editable section base ───────────────────────────────
function useFormSection(surrogateId, answers, storageKey, initFn) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})

  function startEdit() {
    setForm(initFn(answers?.[storageKey] || {}, answers))
    setEditing(true)
  }

  async function handleSave(onSaved) {
    setSaving(true)
    try {
      const updatedAnswers = { ...answers, [storageKey]: form }
      await updateIntakeSubmission(surrogateId, { answers: updatedAnswers })
      if (onSaved) onSaved(updatedAnswers)
      setEditing(false)
    } catch {} finally { setSaving(false) }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  return { editing, saving, form, set, setForm, startEdit, handleSave, cancel: () => setEditing(false) }
}

function EditHeader({ title, description, editing, saving, startEdit, handleSave, cancel }) {
  return (
    <CardHeader className={editing ? 'flex flex-row items-center justify-between' : 'cursor-pointer select-none'}>
      <div>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {editing ? (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={cancel}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5" style={{ backgroundColor: '#1A3638', color: '#fff' }}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
          </Button>
        </div>
      ) : (
        <CardAction>
          <Button variant="ghost" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); startEdit() }}>
            <Pencil className="size-3.5" /> Edit
          </Button>
        </CardAction>
      )}
    </CardHeader>
  )
}

// ── Application Section (merged Personal Information) ───
function ApplicationSection({ surrogate, answers, profileData, onSaved, search }) {
  const stored = answers?._application || {}
  const profile = profileData?.personal || {}
  const general = profileData?.general || {}
  const employment = profileData?.employment || {}

  const allLabels = [
    'Full Legal Name', 'Maiden Name', 'Date of Birth', 'Last 4 of SSN', 'Religion',
    'Real ID', 'Valid Passport',
    'Street Address', 'City', 'State', 'Zip Code',
    'Health Insurance', 'Insurance Provider', 'Policy Number', 'Group Number', 'Insurance Phone',
    'Spouse/Partner First Name', 'Spouse/Partner Date of Birth', 'Spouse/Partner Email', 'Spouse/Partner Phone',
    'Emergency Contact Name', 'Emergency Contact Phone', 'Emergency Contact Relationship',
  ]
  const hasMatch = search ? allLabels.some(l => l.toLowerCase().includes(search)) : true

  const { editing, saving, form, setForm, startEdit, handleSave, cancel } = useFormSection(
    surrogate.id, answers, '_application',
    (saved) => {
      const init = {
        // Identity
        fullLegalName: saved.fullLegalName || '',
        // Backfill: if a maiden name was already on file, infer 'yes'.
        hadDifferentLastName: saved.hadDifferentLastName ?? (saved.maidenName ? 'yes' : ''),
        maidenName: saved.maidenName || '',
        dob: saved.dob || '',
        ssn4: saved.ssn4 || '',
        religion: saved.religion || '',
        // Address
        street: saved.street || '',
        city: saved.city || profile.city || '',
        state: saved.state || profile.state || '',
        zipCode: saved.zipCode || '',
        // Insurance
        hasInsurance: saved.hasInsurance ?? '',
        insuranceProvider: saved.insuranceProvider || '',
        insurancePolicyNumber: saved.insurancePolicyNumber || '',
        insuranceGroupNumber: saved.insuranceGroupNumber || '',
        insurancePhone: saved.insurancePhone || '',
        // Spouse/Partner
        hasSpouse: saved.hasSpouse ?? '',
        spouseFirstName: saved.spouseFirstName || '',
        spouseLastName: saved.spouseLastName || '',
        spouseDob: saved.spouseDob || '',
        spouseEmail: saved.spouseEmail || '',
        spousePhone: saved.spousePhone || '',
        // Household members aged 18+ (anyone besides spouse/partner who lives
        // in the home and needs a background check). Stored as an array of
        // {firstName, lastName, email, phone}. Capped at 4 in the UI.
        hasAdultHouseholdMembers: saved.hasAdultHouseholdMembers ?? '',
        adultHouseholdMembers: Array.isArray(saved.adultHouseholdMembers) ? saved.adultHouseholdMembers : [],
        // Emergency Contact
        emergencyName: saved.emergencyName || '',
        emergencyPhone: saved.emergencyPhone || '',
        emergencyRelationship: saved.emergencyRelationship || '',
      }
      // Pre-fill from profile/quiz data
      if (!init.fullLegalName) init.fullLegalName = `${profile.firstName || answers?.firstName || ''} ${profile.lastName || answers?.lastName || ''}`.trim()
      if (!init.dob) init.dob = profile.dob || answers?.dob || ''
      if (!init.religion) init.religion = general.religion || ''
      if (!init.hasSpouse && (answers?.maritalStatus === 'Married' || answers?.maritalStatus === 'Domestic Partnership')) init.hasSpouse = 'yes'
      if (!init.hasInsurance && (employment.healthInsurance === 'yes' || employment.healthInsurance === true)) init.hasInsurance = 'yes'
      return init
    }
  )
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  if (!hasMatch) return null

  const showInsurance = editing ? form.hasInsurance === 'yes' || form.hasInsurance === true : stored.hasInsurance === 'yes' || stored.hasInsurance === true
  const showSpouse = editing ? form.hasSpouse === 'yes' || form.hasSpouse === true : stored.hasSpouse === 'yes' || stored.hasSpouse === true
  const showAdultMembers = editing
    ? form.hasAdultHouseholdMembers === 'yes' || form.hasAdultHouseholdMembers === true
    : stored.hasAdultHouseholdMembers === 'yes' || stored.hasAdultHouseholdMembers === true
  const MAX_ADULT_MEMBERS = 4
  const adultMembersArr = editing ? (form.adultHouseholdMembers || []) : (stored.adultHouseholdMembers || [])
  function updateAdultMember(idx, field, val) {
    const next = [...(form.adultHouseholdMembers || [])]
    next[idx] = { ...(next[idx] || {}), [field]: val }
    set('adultHouseholdMembers', next)
  }
  function addAdultMember() {
    const next = [...(form.adultHouseholdMembers || []), { firstName: '', lastName: '', email: '', phone: '' }]
    set('adultHouseholdMembers', next)
  }
  function removeAdultMember(idx) {
    const next = (form.adultHouseholdMembers || []).filter((_, i) => i !== idx)
    set('adultHouseholdMembers', next)
  }

  return (
    <Card className="rounded-2xl">
      <EditHeader title="Personal Information" description="Identity, address, insurance, spouse, and emergency contact" editing={editing} saving={saving} startEdit={startEdit} handleSave={() => handleSave(onSaved)} cancel={cancel} />
      <CardContent className="space-y-6">
        {/* Identity */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Identity</p>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1"><FieldLabel>Full Legal Name</FieldLabel><Input value={form.fullLegalName} onChange={e => set('fullLegalName', e.target.value)} /></div>
              <div className="space-y-1">
                <FieldLabel>Have you ever had a different last name?</FieldLabel>
                <YesNoButtons value={form.hadDifferentLastName} onChange={v => setForm(f => ({ ...f, hadDifferentLastName: v, ...(v === 'no' ? { maidenName: '' } : {}) }))} />
              </div>
              {(form.hadDifferentLastName === 'yes' || form.hadDifferentLastName === true) && (
                <div className="space-y-1"><FieldLabel>Other Name(s) Used</FieldLabel><Input value={form.maidenName} onChange={e => set('maidenName', e.target.value)} /></div>
              )}
              <div className="space-y-1"><FieldLabel>Date of Birth</FieldLabel><Input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>Last 4 of SSN</FieldLabel><Input value={form.ssn4} onChange={e => set('ssn4', e.target.value)} maxLength={4} /></div>
              <div className="space-y-1"><FieldLabel>Religion (if applicable)</FieldLabel><Input value={form.religion} onChange={e => set('religion', e.target.value)} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ReadField label="Full Legal Name" value={stored.fullLegalName} />
              <ReadField label="Different Last Name?" value={stored.hadDifferentLastName === 'yes' || stored.hadDifferentLastName === true ? 'Yes' : (stored.hadDifferentLastName === 'no' || stored.hadDifferentLastName === false ? 'No' : '')} />
              {(stored.hadDifferentLastName === 'yes' || stored.hadDifferentLastName === true || stored.maidenName) && (
                <ReadField label="Other Name(s) Used" value={stored.maidenName} />
              )}
              <ReadField label="Date of Birth" value={stored.dob} />
              <ReadField label="Last 4 of SSN" value={stored.ssn4} />
              <ReadField label="Religion" value={stored.religion} />
            </div>
          )}
        </div>

        {/* Address */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Address</p>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1"><FieldLabel>Street Address</FieldLabel><Input value={form.street} onChange={e => set('street', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>City</FieldLabel><Input value={form.city} onChange={e => set('city', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>State</FieldLabel><SelectField value={form.state} onValueChange={v => set('state', v)} options={US_STATES} /></div>
              <div className="space-y-1"><FieldLabel>Zip Code</FieldLabel><Input value={form.zipCode} onChange={e => set('zipCode', e.target.value)} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ReadField label="Street Address" value={stored.street} />
              <ReadField label="City" value={stored.city} />
              <ReadField label="State" value={stored.state} />
              <ReadField label="Zip Code" value={stored.zipCode} />
            </div>
          )}
        </div>

        {/* Health Insurance */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Health Insurance</p>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1"><FieldLabel>Do you have health insurance?</FieldLabel><YesNoButtons value={form.hasInsurance} onChange={v => set('hasInsurance', v)} /></div>
              {showInsurance && (
                <>
                  <div className="space-y-1"><FieldLabel>Insurance Provider</FieldLabel><Input value={form.insuranceProvider} onChange={e => set('insuranceProvider', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>Policy Number</FieldLabel><Input value={form.insurancePolicyNumber} onChange={e => set('insurancePolicyNumber', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>Group Number</FieldLabel><Input value={form.insuranceGroupNumber} onChange={e => set('insuranceGroupNumber', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>Insurance Phone</FieldLabel><Input value={form.insurancePhone} onChange={e => set('insurancePhone', e.target.value)} /></div>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ReadField label="Has Insurance" value={boolDisplay(stored.hasInsurance)} />
              {showInsurance && (
                <>
                  <ReadField label="Insurance Provider" value={stored.insuranceProvider} />
                  <ReadField label="Policy Number" value={stored.insurancePolicyNumber} />
                  <ReadField label="Group Number" value={stored.insuranceGroupNumber} />
                  <ReadField label="Insurance Phone" value={stored.insurancePhone} />
                </>
              )}
            </div>
          )}
          <InsuranceCardDisplay surrogateId={surrogate.id} />
        </div>

        {/* Spouse/Partner */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Spouse/Partner</p>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1"><FieldLabel>Do you have a spouse/partner?</FieldLabel><YesNoButtons value={form.hasSpouse} onChange={v => set('hasSpouse', v)} /></div>
              {showSpouse && (
                <>
                  <div className="space-y-1"><FieldLabel>Spouse/Partner First Name</FieldLabel><Input value={form.spouseFirstName} onChange={e => set('spouseFirstName', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>Spouse/Partner Last Name</FieldLabel><Input value={form.spouseLastName} onChange={e => set('spouseLastName', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>Spouse/Partner Date of Birth</FieldLabel><Input type="date" value={form.spouseDob} onChange={e => set('spouseDob', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>Spouse/Partner Email</FieldLabel><Input type="email" value={form.spouseEmail} onChange={e => set('spouseEmail', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>Spouse/Partner Phone</FieldLabel><Input value={form.spousePhone} onChange={e => set('spousePhone', e.target.value)} /></div>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ReadField label="Has Spouse/Partner" value={boolDisplay(stored.hasSpouse)} />
              {showSpouse && (
                <>
                  <ReadField label="Spouse/Partner First Name" value={stored.spouseFirstName} />
                  <ReadField label="Spouse/Partner Last Name" value={stored.spouseLastName} />
                  <ReadField label="Spouse/Partner DOB" value={stored.spouseDob} />
                  <ReadField label="Spouse/Partner Email" value={stored.spouseEmail} />
                  <ReadField label="Spouse/Partner Phone" value={stored.spousePhone} />
                </>
              )}
            </div>
          )}
        </div>

        {/* Adult household members (over 18, not spouse/partner) — each one
            gets their own Background Check Release Form in the release-forms
            section. Capped at 4 since most households don't go higher. */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Other Household Members (18+)</p>
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1 max-w-xs">
                <FieldLabel>Are any of your household members over the age of 18?</FieldLabel>
                <YesNoButtons value={form.hasAdultHouseholdMembers} onChange={v => set('hasAdultHouseholdMembers', v)} />
              </div>
              {showAdultMembers && (
                <div className="space-y-3">
                  {(form.adultHouseholdMembers || []).map((m, i) => (
                    <div key={i} className="rounded-lg border border-stone-200 bg-stone-50/50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Adult #{i + 1}</p>
                        <button type="button" onClick={() => removeAdultMember(i)} className="text-[11px] text-red-500 hover:underline">Remove</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1"><FieldLabel>First Name</FieldLabel><Input value={m.firstName || ''} onChange={e => updateAdultMember(i, 'firstName', e.target.value)} /></div>
                        <div className="space-y-1"><FieldLabel>Last Name</FieldLabel><Input value={m.lastName || ''} onChange={e => updateAdultMember(i, 'lastName', e.target.value)} /></div>
                        <div className="space-y-1"><FieldLabel>Email</FieldLabel><Input type="email" value={m.email || ''} onChange={e => updateAdultMember(i, 'email', e.target.value)} /></div>
                        <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input value={m.phone || ''} onChange={e => updateAdultMember(i, 'phone', e.target.value)} /></div>
                      </div>
                    </div>
                  ))}
                  {(form.adultHouseholdMembers || []).length < MAX_ADULT_MEMBERS && (
                    <button type="button" onClick={addAdultMember} className="text-xs font-semibold text-[#1A3638] hover:underline">
                      + Add household member
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <ReadField label="Has Adult Household Members" value={boolDisplay(stored.hasAdultHouseholdMembers)} />
              {showAdultMembers && adultMembersArr.length > 0 && (
                <div className="space-y-2">
                  {adultMembersArr.map((m, i) => (
                    <div key={i} className="rounded-lg border border-stone-200 bg-stone-50/50 p-3">
                      <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">Adult #{i + 1}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <ReadField label="First Name" value={m.firstName} />
                        <ReadField label="Last Name" value={m.lastName} />
                        <ReadField label="Email" value={m.email} />
                        <ReadField label="Phone" value={m.phone} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Emergency Contact */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Emergency Contact</p>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1"><FieldLabel>Emergency Contact Name</FieldLabel><Input value={form.emergencyName} onChange={e => set('emergencyName', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>Emergency Contact Phone</FieldLabel><Input value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>Emergency Contact Relationship</FieldLabel><Input value={form.emergencyRelationship} onChange={e => set('emergencyRelationship', e.target.value)} /></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <ReadField label="Emergency Contact Name" value={stored.emergencyName} />
              <ReadField label="Emergency Contact Phone" value={stored.emergencyPhone} />
              <ReadField label="Emergency Contact Relationship" value={stored.emergencyRelationship} />
            </div>
          )}
        </div>

        <PhotoIdDisplay surrogateId={surrogate.id} />
      </CardContent>
    </Card>
  )
}

// ── Insurance Card Display ────────────────────────────────
function InsuranceCardDisplay({ surrogateId }) {
  const [docs, setDocs] = useState([])
  useEffect(() => {
    if (!surrogateId) return
    import('@/lib/supabase').then(({ supabase }) => {
      if (!supabase) return
      supabase.from('case_documents').select('*').eq('surrogate_id', surrogateId).eq('category', 'insurance-card').then(({ data }) => {
        if (data) setDocs(data)
      })
    })
  }, [surrogateId])

  if (docs.length === 0) return null
  const labels = { 'insurance-front': 'Insurance Card (Front)', 'insurance-back': 'Insurance Card (Back)' }

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Insurance Cards</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {docs.map(doc => (
          <a key={doc.id} href={doc.public_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 hover:border-[#1A3638]/30 hover:bg-stone-50 transition-colors">
            {doc.file_type?.startsWith('image/') ? (
              <img src={doc.public_url} alt="" className="w-16 h-10 object-cover rounded border" />
            ) : (
              <div className="w-16 h-10 rounded border bg-stone-100 flex items-center justify-center text-stone-400 text-[10px]">PDF</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-stone-700 truncate">{labels[doc.doc_label] || doc.file_name}</p>
              <p className="text-[10px] text-stone-400">{doc.doc_label ? labels[doc.doc_label] : 'Unlabeled'}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

// ── References Section ──────────────────────────────────
function ReferencesSection({ surrogate, answers, onSaved, search }) {
  const stored = answers?._references || {}
  const { currentRole } = useRole()
  const isAdmin = ADMIN_ROLES.includes(currentRole)
  const REFS = [
    { key: 'ref1', title: 'Reference #1 — Family Member' },
    { key: 'ref2', title: 'Reference #2 — Friend' },
    { key: 'ref3', title: 'Reference #3 — Friend' },
  ]
  const refFields = ['name', 'phone', 'email', 'cityState', 'relationship']
  const refLabels = { name: 'Name', phone: 'Phone Number', email: 'Email Address', cityState: 'City, State', relationship: 'Relationship to you' }

  const allLabels = REFS.flatMap(r => refFields.map(f => `${r.title} ${refLabels[f]}`))
  const hasMatch = search ? allLabels.some(l => l.toLowerCase().includes(search)) : true

  const { editing, saving, form, setForm, startEdit, handleSave, cancel } = useFormSection(
    surrogate.id, answers, '_references',
    (saved) => {
      const init = {}
      for (const r of REFS) {
        for (const f of refFields) init[`${r.key}_${f}`] = saved[`${r.key}_${f}`] || ''
        init[`${r.key}_adminNotes`] = saved[`${r.key}_adminNotes`] || ''
      }
      return init
    }
  )
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  if (!hasMatch) return null

  return (
    <Card className="rounded-2xl">
      <EditHeader title="References" description="Three references required" editing={editing} saving={saving} startEdit={startEdit} handleSave={() => handleSave(onSaved)} cancel={cancel} />
      <CardContent className="space-y-6">
        {REFS.map(ref => (
          <div key={ref.key}>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{ref.title}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {refFields.map(f => {
                const key = `${ref.key}_${f}`
                return editing ? (
                  <div key={key} className="space-y-1"><FieldLabel>{refLabels[f]}</FieldLabel><Input value={form[key] || ''} onChange={e => set(key, e.target.value)} /></div>
                ) : (
                  <ReadField key={key} label={refLabels[f]} value={stored[key]} />
                )
              })}
            </div>
            {/* Admin Notes — only visible to admin users */}
            {isAdmin && (
              <div className="mt-3">
                {editing ? (
                  <div className="space-y-1">
                    <FieldLabel><span className="text-amber-600">Admin Notes</span> <span className="text-muted-foreground font-normal">(not visible to surrogate)</span></FieldLabel>
                    <Textarea
                      value={form[`${ref.key}_adminNotes`] || ''}
                      onChange={e => set(`${ref.key}_adminNotes`, e.target.value)}
                      placeholder="Notes from reference check..."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                ) : stored[`${ref.key}_adminNotes`] ? (
                  <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <p className="text-[10px] font-semibold text-amber-600 uppercase mb-1">Admin Notes</p>
                    <p className="text-sm text-stone-700 whitespace-pre-wrap">{stored[`${ref.key}_adminNotes`]}</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Photo ID Display (admin view) ──────────────────────
function PhotoIdDisplay({ surrogateId }) {
  const [docs, setDocs] = useState([])
  useEffect(() => {
    if (!surrogateId) return
    import('@/lib/supabase').then(({ supabase }) => {
      if (!supabase) return
      supabase.from('case_documents').select('*').eq('surrogate_id', surrogateId).eq('category', 'photo-id').then(({ data }) => {
        if (data) setDocs(data)
      })
    })
  }, [surrogateId])

  if (docs.length === 0) return null
  const labels = { gc: "GC Driver's License", partner: "Partner Driver's License", ip1: "IP1 Photo ID", ip2: "IP2 Photo ID" }

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Photo IDs</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {docs.map(doc => (
          <a key={doc.id} href={doc.public_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 hover:border-[#1A3638]/30 hover:bg-stone-50 transition-colors">
            {doc.file_type?.startsWith('image/') ? (
              <img src={doc.public_url} alt="" className="w-16 h-10 object-cover rounded border" />
            ) : (
              <div className="w-16 h-10 rounded border bg-stone-100 flex items-center justify-center text-stone-400 text-[10px]">PDF</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-stone-700 truncate">{labels[doc.doc_label] || doc.file_name}</p>
              <p className="text-[10px] text-stone-400">{doc.doc_label ? labels[doc.doc_label] : 'Unlabeled'}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Clinic & Hospital Section ───────────────────────────
const NON_DELIVERY_OUTCOMES = ['miscarriage', 'ectopic', 'ectopic pregnancy', 'termination', 'chemical', 'chemical pregnancy']
// The *Fax and *Email fields are ADMIN-ONLY: they are researched by staff,
// never asked of the surrogate, and are not rendered by the portal form in
// PortalApplicationPage. They flow into the Records Checklist as the provider
// fax / email defaults — see providerDefaults in SurrogateDetailPage.
const EMPTY_PREGNANCY = {
  date: '', outcome: '', receivedPrenatalCare: '', wasSurrogacy: '',
  obClinicName: '', obDoctorName: '', obPhone: '', obFax: '', obEmail: '', obAddress: '',
  transferredCare: '', obClinicName2: '', obDoctorName2: '', obPhone2: '', obFax2: '', obEmail2: '', obAddress2: '',
  hospitalName: '', hospitalPhone: '', hospitalFax: '', hospitalEmail: '', hospitalAddress: '',
  sawMFM: '', mfmClinicName: '', mfmDoctorName: '', mfmPhone: '', mfmFax: '', mfmEmail: '', mfmAddress: '',
  wasIVF: '', ivfClinicName: '', ivfDoctorName: '', ivfPhone: '', ivfFax: '', ivfEmail: '', ivfAddress: '',
}

// Admin-added "Additional Records" entries live at the ROOT of the
// _clinicHospital form (not per-pregnancy) — each entry stands on its
// own with its own dates of service. Shape:
//   { type, clinicName, doctorName, phone, address, datesOfService }
// type is one of 'ob'|'hospital'|'mfm'|'ivf'|'pcp'|'er'. Each entry
// generates a release form via releaseFormGenerator.extractProviders()
// and a tracked record via getMedicalRecordStepIds().
const EMPTY_ADDITIONAL_PROVIDER = {
  type: 'pcp',
  clinicName: '',
  doctorName: '',
  phone: '',
  fax: '', // admin-researched, flows to the Records Checklist
  email: '', // admin-researched, flows to the Records Checklist
  address: '',
  datesOfService: '',
}

// Picker options for the Additional Records type dropdown. Labels match
// the names admins use day-to-day; values match PROVIDER_TYPES keys in
// src/lib/releaseFormGenerator.js.
const ADDITIONAL_PROVIDER_TYPES = [
  { value: 'ob',       label: 'OB' },
  { value: 'hospital', label: 'Delivery' },
  { value: 'mfm',      label: 'MFM' },
  { value: 'ivf',      label: 'IVF' },
  { value: 'pcp',      label: 'PCP' },
  { value: 'er',       label: 'ER' },
]
const ADDITIONAL_PROVIDER_LABELS = Object.fromEntries(ADDITIONAL_PROVIDER_TYPES.map(t => [t.value, t.label]))

function ClinicHospitalSection({ surrogate, answers, profileData, onSaved, search }) {
  const stored = answers?._clinicHospital || {}
  const profilePregnancies = profileData?.pregnancyHistory?.pregnancies || []
  const profileCount = parseInt(profileData?.pregnancyHistory?.numberOfPregnancies) || 0

  const hasMatch = search ? ['clinic', 'hospital', 'ob', 'gyn', 'delivery', 'pregnancy', 'surrogate', 'ivf', 'mfm', 'pap', 'prenatal', 'maternal fetal', 'records', 'release'].some(k => search.includes(k)) : true

  const { editing, saving, form, setForm, startEdit, handleSave, cancel } = useFormSection(
    surrogate.id, answers, '_clinicHospital',
    (saved) => {
      const count = Math.max(profileCount, profilePregnancies.length, (saved.pregnancies || []).length)
      const pregnancies = []
      for (let i = 0; i < Math.max(count, 1); i++) {
        const existing = (saved.pregnancies || [])[i] || {}
        const prof = profilePregnancies[i] || {}
        pregnancies.push({
          ...EMPTY_PREGNANCY,
          date: existing.date || prof.dob || '',
          outcome: existing.outcome || prof.outcome || '',
          wasSurrogacy: existing.wasSurrogacy ?? prof.wasSurrogacy ?? '',
          receivedPrenatalCare: existing.receivedPrenatalCare ?? '',
          transferredCare: existing.transferredCare ?? '',
          obClinicName: existing.obClinicName || '',
          obDoctorName: existing.obDoctorName || '',
          obPhone: existing.obPhone || '',
          obFax: existing.obFax || '',
          obEmail: existing.obEmail || '',
          obAddress: existing.obAddress || '',
          obClinicName2: existing.obClinicName2 || '',
          obDoctorName2: existing.obDoctorName2 || '',
          obPhone2: existing.obPhone2 || '',
          obFax2: existing.obFax2 || '',
          obEmail2: existing.obEmail2 || '',
          obAddress2: existing.obAddress2 || '',
          hospitalName: existing.hospitalName || '',
          hospitalPhone: existing.hospitalPhone || '',
          hospitalFax: existing.hospitalFax || '',
          hospitalEmail: existing.hospitalEmail || '',
          hospitalAddress: existing.hospitalAddress || '',
          sawMFM: existing.sawMFM ?? '',
          mfmClinicName: existing.mfmClinicName || '',
          mfmDoctorName: existing.mfmDoctorName || '',
          mfmPhone: existing.mfmPhone || '',
          mfmFax: existing.mfmFax || '',
          mfmEmail: existing.mfmEmail || '',
          mfmAddress: existing.mfmAddress || '',
          wasIVF: existing.wasIVF ?? '',
          ivfClinicName: existing.ivfClinicName || '',
          ivfDoctorName: existing.ivfDoctorName || '',
          ivfPhone: existing.ivfPhone || '',
          ivfFax: existing.ivfFax || '',
          ivfEmail: existing.ivfEmail || '',
          ivfAddress: existing.ivfAddress || '',
        })
      }
      return {
        currentOBGYN: saved.currentOBGYN || '',
        currentOBPhone: saved.currentOBPhone || '',
        currentOBAddress: saved.currentOBAddress || '',
        experiencedSurrogate: saved.experiencedSurrogate ?? profileData?.experiencedSurrogate?.previousSurrogate ?? '',
        papDate: saved.papDate || '',
        papDoctorName: saved.papDoctorName || '',
        papClinicName: saved.papClinicName || '',
        papClinicCity: saved.papClinicCity || '',
        papClinicState: saved.papClinicState || '',
        papClinicPhone: saved.papClinicPhone || '',
        papClinicFax: saved.papClinicFax || '',
        papClinicEmail: saved.papClinicEmail || '',
        numberOfPregnancies: saved.numberOfPregnancies || profileCount || '',
        pregnancies,
        additionalProviders: Array.isArray(saved.additionalProviders) ? saved.additionalProviders : [],
      }
    }
  )

  if (!hasMatch) return null

  function updatePreg(i, key, val) {
    setForm(f => {
      const pregnancies = [...(f.pregnancies || [])]
      pregnancies[i] = { ...pregnancies[i], [key]: val }
      return { ...f, pregnancies }
    })
  }

  function addAdditionalProvider() {
    setForm(f => ({
      ...f,
      additionalProviders: [...(f.additionalProviders || []), { ...EMPTY_ADDITIONAL_PROVIDER }],
    }))
  }
  function updateAdditionalProvider(idx, key, val) {
    setForm(f => {
      const list = [...(f.additionalProviders || [])]
      list[idx] = { ...list[idx], [key]: val }
      return { ...f, additionalProviders: list }
    })
  }
  function removeAdditionalProvider(idx) {
    setForm(f => {
      const list = [...(f.additionalProviders || [])]
      list.splice(idx, 1)
      return { ...f, additionalProviders: list }
    })
  }

  function handleCountChange(val) {
    const num = parseInt(val) || 0
    setForm(f => {
      const existing = f.pregnancies || []
      const pregnancies = []
      for (let i = 0; i < num; i++) {
        const ex = existing[i] || {}
        const prof = profilePregnancies[i] || {}
        pregnancies.push({
          ...EMPTY_PREGNANCY,
          ...ex,
          date: ex.date || prof.dob || '',
          outcome: ex.outcome || prof.outcome || '',
          wasSurrogacy: ex.wasSurrogacy ?? prof.wasSurrogacy ?? '',
        })
      }
      return { ...f, numberOfPregnancies: val, pregnancies }
    })
  }

  const isNonDelivery = (outcome) => NON_DELIVERY_OUTCOMES.includes((outcome || '').toLowerCase())
  const needsDeliveryHospital = (p) => !isNonDelivery(p.outcome) || p.receivedPrenatalCare === 'yes'

  // Read mode
  const readPregnancies = stored.pregnancies || []

  return (
    <Card className="rounded-2xl">
      <EditHeader title="Clinic & Hospital Form" description="Provider information for medical records release" editing={editing} saving={saving} startEdit={startEdit} handleSave={() => handleSave(onSaved)} cancel={cancel} />
      <CardContent className="space-y-6">
        {editing ? (
          <>
            {/* Current OB/GYN */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Current OB/GYN</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1"><FieldLabel>Doctor / Midwife Name</FieldLabel><Input value={form.currentOBGYN} onChange={e => setForm(f => ({ ...f, currentOBGYN: e.target.value }))} /></div>
                <div className="space-y-1"><FieldLabel>Phone Number</FieldLabel><Input value={form.currentOBPhone} onChange={e => setForm(f => ({ ...f, currentOBPhone: formatPhoneInput(e.target.value) }))} /></div>
                <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={form.currentOBAddress} onChange={e => setForm(f => ({ ...f, currentOBAddress: e.target.value }))} placeholder="Optional" /></div>
              </div>
            </div>
            {/* PAP Smear */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Most Recent PAP Smear</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1"><FieldLabel>Date (MM/YYYY)</FieldLabel><Input type="month" value={form.papDate} onChange={e => setForm(f => ({ ...f, papDate: e.target.value }))} /></div>
                <div className="space-y-1"><FieldLabel>Doctor Name</FieldLabel><Input value={form.papDoctorName} onChange={e => setForm(f => ({ ...f, papDoctorName: e.target.value }))} /></div>
                <div className="space-y-1"><FieldLabel>Clinic Name</FieldLabel><Input value={form.papClinicName} onChange={e => setForm(f => ({ ...f, papClinicName: e.target.value }))} /></div>
                <div className="space-y-1"><FieldLabel>City</FieldLabel><Input value={form.papClinicCity} onChange={e => setForm(f => ({ ...f, papClinicCity: e.target.value }))} /></div>
                <div className="space-y-1"><FieldLabel>State</FieldLabel><SelectField value={form.papClinicState} onValueChange={v => setForm(f => ({ ...f, papClinicState: v }))} options={US_STATES} /></div>
                <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input value={form.papClinicPhone} onChange={e => setForm(f => ({ ...f, papClinicPhone: formatPhoneInput(e.target.value) }))} placeholder="Optional" /></div>
                <AdminFaxField value={form.papClinicFax} onChange={v => setForm(f => ({ ...f, papClinicFax: v }))} />
                <AdminEmailField value={form.papClinicEmail} onChange={v => setForm(f => ({ ...f, papClinicEmail: v }))} />
              </div>
            </div>
            {/* Experienced Surrogate + Pregnancy Count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1"><FieldLabel>Are you an experienced surrogate?</FieldLabel><YesNoButtons value={form.experiencedSurrogate} onChange={v => setForm(f => ({ ...f, experiencedSurrogate: v }))} /></div>
              <div className="space-y-1">
                <FieldLabel>Total number of pregnancies {profileCount > 0 && <span className="text-muted-foreground font-normal">(from profile: {profileCount})</span>}</FieldLabel>
                <Input type="number" min="0" max="20" value={form.numberOfPregnancies} onChange={e => handleCountChange(e.target.value)} />
              </div>
            </div>
            {/* Per-Pregnancy Provider Info */}
            {(form.pregnancies || []).map((p, i) => {
              const profPreg = profilePregnancies[i]
              const outcomeLabel = p.outcome || profPreg?.outcome || ''
              const isNonDel = isNonDelivery(outcomeLabel)
              const skipRelease = isNonDel && p.receivedPrenatalCare === 'no'
              return (
                <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#1A3638]">Pregnancy #{i + 1}</p>
                    {outcomeLabel && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isNonDel ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{outcomeLabel}</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1"><FieldLabel>Date</FieldLabel><Input type="date" value={p.date} onChange={e => updatePreg(i, 'date', e.target.value)} /></div>
                    <div className="space-y-1"><FieldLabel>Outcome</FieldLabel>
                      <SelectField value={p.outcome} onValueChange={v => updatePreg(i, 'outcome', v)} options={['Live Birth', 'Miscarriage', 'Ectopic Pregnancy', 'Termination', 'Chemical Pregnancy', 'Stillborn']} />
                    </div>
                    <div className="space-y-1"><FieldLabel>Surrogacy pregnancy?</FieldLabel><YesNoButtons value={p.wasSurrogacy} onChange={v => updatePreg(i, 'wasSurrogacy', v)} /></div>
                  </div>
                  {/* For non-delivery outcomes, ask about prenatal care */}
                  {isNonDel && (
                    <div className="space-y-1 max-w-xs">
                      <FieldLabel>Did you receive any prenatal care for this pregnancy?</FieldLabel>
                      <YesNoButtons value={p.receivedPrenatalCare} onChange={v => updatePreg(i, 'receivedPrenatalCare', v)} />
                    </div>
                  )}
                  {skipRelease && (
                    <p className="text-xs text-stone-400 italic">No medical records release needed for this pregnancy.</p>
                  )}
                  {!skipRelease && (
                    <>
                      {/* Prenatal Care */}
                      <div>
                        <p className="text-[11px] font-semibold text-stone-500 uppercase mb-2">Prenatal Care{(p.transferredCare === 'yes' || p.transferredCare === true) ? ' — First Provider' : ''}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="space-y-1"><FieldLabel>Clinic Name</FieldLabel><Input value={p.obClinicName} onChange={e => updatePreg(i, 'obClinicName', e.target.value)} /></div>
                          <div className="space-y-1"><FieldLabel>OB Doctor / Midwife</FieldLabel><Input value={p.obDoctorName} onChange={e => updatePreg(i, 'obDoctorName', e.target.value)} /></div>
                          <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" placeholder="xxx-xxx-xxxx" value={p.obPhone} onChange={e => updatePreg(i, 'obPhone', formatPhoneInput(e.target.value))} /></div>
                          <AdminFaxField value={p.obFax} onChange={v => updatePreg(i, 'obFax', v)} />
                          <AdminEmailField value={p.obEmail} onChange={v => updatePreg(i, 'obEmail', v)} />
                          <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={p.obAddress} onChange={e => updatePreg(i, 'obAddress', e.target.value)} placeholder="Optional" /></div>
                        </div>
                      </div>
                      {/* Transfer of care → second OB provider (creates a 2nd OB record) */}
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-[11px] font-semibold text-stone-500 uppercase">Transferred care during this pregnancy? (e.g., switched OB clinics)</p>
                          <YesNoButtons value={p.transferredCare} onChange={v => updatePreg(i, 'transferredCare', v)} />
                        </div>
                        {(p.transferredCare === 'yes' || p.transferredCare === true) && (
                          <div>
                            <p className="text-[11px] font-semibold text-stone-500 uppercase mb-2">Prenatal Care — Second Provider</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              <div className="space-y-1"><FieldLabel>Clinic Name</FieldLabel><Input value={p.obClinicName2} onChange={e => updatePreg(i, 'obClinicName2', e.target.value)} /></div>
                              <div className="space-y-1"><FieldLabel>OB Doctor / Midwife</FieldLabel><Input value={p.obDoctorName2} onChange={e => updatePreg(i, 'obDoctorName2', e.target.value)} /></div>
                              <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" placeholder="xxx-xxx-xxxx" value={p.obPhone2} onChange={e => updatePreg(i, 'obPhone2', formatPhoneInput(e.target.value))} /></div>
                              <AdminFaxField value={p.obFax2} onChange={v => updatePreg(i, 'obFax2', v)} />
                              <AdminEmailField value={p.obEmail2} onChange={v => updatePreg(i, 'obEmail2', v)} />
                              <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={p.obAddress2} onChange={e => updatePreg(i, 'obAddress2', e.target.value)} placeholder="Optional" /></div>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Delivery Hospital — only for live births / stillborns or if prenatal care was received */}
                      {(!isNonDel || p.receivedPrenatalCare === 'yes') && !isNonDel && (
                        <div>
                          <p className="text-[11px] font-semibold text-stone-500 uppercase mb-2">Delivery Hospital</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="space-y-1"><FieldLabel>Hospital Name</FieldLabel><Input value={p.hospitalName} onChange={e => updatePreg(i, 'hospitalName', e.target.value)} /></div>
                            <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" placeholder="xxx-xxx-xxxx" value={p.hospitalPhone} onChange={e => updatePreg(i, 'hospitalPhone', formatPhoneInput(e.target.value))} /></div>
                            <AdminFaxField value={p.hospitalFax} onChange={v => updatePreg(i, 'hospitalFax', v)} />
                            <AdminEmailField value={p.hospitalEmail} onChange={v => updatePreg(i, 'hospitalEmail', v)} />
                            <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={p.hospitalAddress} onChange={e => updatePreg(i, 'hospitalAddress', e.target.value)} placeholder="Optional" /></div>
                          </div>
                        </div>
                      )}
                      {/* MFM */}
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-[11px] font-semibold text-stone-500 uppercase">Maternal Fetal Medicine (MFM)</p>
                          <YesNoButtons value={p.sawMFM} onChange={v => updatePreg(i, 'sawMFM', v)} />
                        </div>
                        {(p.sawMFM === 'yes' || p.sawMFM === true) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="space-y-1"><FieldLabel>MFM Clinic Name</FieldLabel><Input value={p.mfmClinicName} onChange={e => updatePreg(i, 'mfmClinicName', e.target.value)} /></div>
                            <div className="space-y-1"><FieldLabel>MFM Doctor Name</FieldLabel><Input value={p.mfmDoctorName} onChange={e => updatePreg(i, 'mfmDoctorName', e.target.value)} /></div>
                            <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" placeholder="xxx-xxx-xxxx" value={p.mfmPhone} onChange={e => updatePreg(i, 'mfmPhone', formatPhoneInput(e.target.value))} /></div>
                            <AdminFaxField value={p.mfmFax} onChange={v => updatePreg(i, 'mfmFax', v)} />
                            <AdminEmailField value={p.mfmEmail} onChange={v => updatePreg(i, 'mfmEmail', v)} />
                            <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={p.mfmAddress} onChange={e => updatePreg(i, 'mfmAddress', e.target.value)} placeholder="Optional" /></div>
                          </div>
                        )}
                      </div>
                      {/* IVF */}
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-[11px] font-semibold text-stone-500 uppercase">IVF Care</p>
                          <YesNoButtons value={p.wasIVF} onChange={v => updatePreg(i, 'wasIVF', v)} />
                        </div>
                        {(p.wasIVF === 'yes' || p.wasIVF === true) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="space-y-1"><FieldLabel>IVF Clinic Name</FieldLabel><Input value={p.ivfClinicName} onChange={e => updatePreg(i, 'ivfClinicName', e.target.value)} /></div>
                            <div className="space-y-1"><FieldLabel>IVF Doctor Name</FieldLabel><Input value={p.ivfDoctorName} onChange={e => updatePreg(i, 'ivfDoctorName', e.target.value)} /></div>
                            <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" placeholder="xxx-xxx-xxxx" value={p.ivfPhone} onChange={e => updatePreg(i, 'ivfPhone', formatPhoneInput(e.target.value))} /></div>
                            <AdminFaxField value={p.ivfFax} onChange={v => updatePreg(i, 'ivfFax', v)} />
                            <AdminEmailField value={p.ivfEmail} onChange={v => updatePreg(i, 'ivfEmail', v)} />
                            <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={p.ivfAddress} onChange={e => updatePreg(i, 'ivfAddress', e.target.value)} placeholder="Optional" /></div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
            {/* Additional Records — root-level (not tied to a pregnancy).
                Admin can add PCP, ER, extra OB visits, etc. Each entry
                generates its own release form + tracked record. */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#1A3638]">Additional Records</p>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addAdditionalProvider()}>
                  <Plus className="size-3" /> Additional Records
                </Button>
              </div>
              {(form.additionalProviders || []).length === 0 ? (
                <p className="text-[11px] text-stone-400 italic">None added. Click "+ Additional Records" to request release forms for any provider not tied to a specific pregnancy (PCP, ER, extra OB visits, etc.).</p>
              ) : (
                <div className="space-y-3">
                  {(form.additionalProviders || []).map((extra, ei) => (
                    <div key={ei} className="rounded-lg border border-stone-200 bg-white p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-semibold text-stone-400">Provider Type</span>
                        <SelectField
                          value={extra.type || 'pcp'}
                          onValueChange={v => updateAdditionalProvider(ei, 'type', v)}
                          options={ADDITIONAL_PROVIDER_TYPES}
                        />
                        <button
                          type="button"
                          onClick={() => removeAdditionalProvider(ei)}
                          className="ml-auto text-[11px] text-stone-400 hover:text-red-500 transition-colors"
                          title="Remove this provider"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="space-y-1"><FieldLabel>Clinic / Facility Name</FieldLabel><Input value={extra.clinicName || ''} onChange={e => updateAdditionalProvider(ei, 'clinicName', e.target.value)} /></div>
                        <div className="space-y-1"><FieldLabel>Doctor Name</FieldLabel><Input value={extra.doctorName || ''} onChange={e => updateAdditionalProvider(ei, 'doctorName', e.target.value)} placeholder="Optional" /></div>
                        <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" placeholder="xxx-xxx-xxxx" value={extra.phone || ''} onChange={e => updateAdditionalProvider(ei, 'phone', formatPhoneInput(e.target.value))} /></div>
                        <AdminFaxField value={extra.fax} onChange={v => updateAdditionalProvider(ei, 'fax', v)} />
                        <AdminEmailField value={extra.email} onChange={v => updateAdditionalProvider(ei, 'email', v)} />
                        <div className="space-y-1 sm:col-span-2"><FieldLabel>Address</FieldLabel><Input value={extra.address || ''} onChange={e => updateAdditionalProvider(ei, 'address', e.target.value)} placeholder="Optional" /></div>
                        <div className="space-y-1"><FieldLabel>Dates of Service</FieldLabel><Input value={extra.datesOfService || ''} onChange={e => updateAdditionalProvider(ei, 'datesOfService', e.target.value)} placeholder="e.g. 01/15/2023 - 06/30/2024" /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Read Mode */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Current OB/GYN</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <ReadField label="Doctor / Midwife" value={stored.currentOBGYN} />
                <ReadField label="Phone" value={stored.currentOBPhone} />
                <ReadField label="Address" value={stored.currentOBAddress} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Most Recent PAP Smear</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <ReadField label="Date" value={(() => {
                  const v = String(stored.papDate || '')
                  // Reformat YYYY-MM and legacy YYYY-MM-DD into MM/YYYY for display.
                  const m = v.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/)
                  return m ? `${m[2]}/${m[1]}` : v
                })()} />
                <ReadField label="Doctor" value={stored.papDoctorName} />
                <ReadField label="Clinic" value={stored.papClinicName} />
                <ReadField label="City" value={stored.papClinicCity} />
                <ReadField label="State" value={stored.papClinicState} />
                <ReadField label="Phone" value={stored.papClinicPhone} />
                <ReadField label="Fax" value={stored.papClinicFax} />
                <ReadField label="Email" value={stored.papClinicEmail} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ReadField label="Experienced Surrogate" value={boolDisplay(stored.experiencedSurrogate)} />
              <ReadField label="Total Pregnancies" value={stored.numberOfPregnancies || profileCount || '—'} />
            </div>
            {readPregnancies.map((p, i) => {
              const isNonDel = isNonDelivery(p.outcome)
              const skipRelease = isNonDel && p.receivedPrenatalCare === 'no'
              return (
                <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Pregnancy #{i + 1}</p>
                    {p.outcome && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isNonDel ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{p.outcome}</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <ReadField label="Date" value={p.date} />
                    <ReadField label="Outcome" value={p.outcome} />
                    <ReadField label="Surrogacy" value={boolDisplay(p.wasSurrogacy)} />
                  </div>
                  {skipRelease ? (
                    <p className="text-xs text-stone-400 italic">No prenatal care received — no release needed.</p>
                  ) : (
                    <>
                      {(p.obClinicName || p.obDoctorName) && (
                        <div>
                          <p className="text-[10px] font-semibold text-stone-400 uppercase mb-1">
                            Prenatal Care{(p.transferredCare === 'yes' || p.transferredCare === true) ? ' — First Provider' : ''}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            <ReadField label="Clinic" value={p.obClinicName} />
                            <ReadField label="Doctor" value={p.obDoctorName} />
                            <ReadField label="Phone" value={p.obPhone} />
                            <ReadField label="Fax" value={p.obFax} />
                            <ReadField label="Email" value={p.obEmail} />
                            <ReadField label="Address" value={p.obAddress} />
                          </div>
                        </div>
                      )}
                      {(p.transferredCare === 'yes' || p.transferredCare === true || p.obClinicName2 || p.obDoctorName2 || p.obPhone2 || p.obAddress2) && (
                        <div>
                          <p className="text-[10px] font-semibold text-stone-400 uppercase mb-1">Prenatal Care — Second Provider</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            <ReadField label="Transferred Care" value={boolDisplay(p.transferredCare)} />
                            <ReadField label="Clinic" value={p.obClinicName2} />
                            <ReadField label="Doctor" value={p.obDoctorName2} />
                            <ReadField label="Phone" value={p.obPhone2} />
                            <ReadField label="Fax" value={p.obFax2} />
                            <ReadField label="Email" value={p.obEmail2} />
                            <ReadField label="Address" value={p.obAddress2} />
                          </div>
                        </div>
                      )}
                      {(p.hospitalName) && (
                        <div>
                          <p className="text-[10px] font-semibold text-stone-400 uppercase mb-1">Delivery Hospital</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            <ReadField label="Hospital" value={p.hospitalName} />
                            <ReadField label="Phone" value={p.hospitalPhone} />
                            <ReadField label="Fax" value={p.hospitalFax} />
                            <ReadField label="Email" value={p.hospitalEmail} />
                            <ReadField label="Address" value={p.hospitalAddress} />
                          </div>
                        </div>
                      )}
                      {(p.sawMFM === 'yes' || p.sawMFM === true) && (
                        <div>
                          <p className="text-[10px] font-semibold text-stone-400 uppercase mb-1">Maternal Fetal Medicine</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            <ReadField label="Clinic" value={p.mfmClinicName} />
                            <ReadField label="Doctor" value={p.mfmDoctorName} />
                            <ReadField label="Phone" value={p.mfmPhone} />
                            <ReadField label="Fax" value={p.mfmFax} />
                            <ReadField label="Email" value={p.mfmEmail} />
                            <ReadField label="Address" value={p.mfmAddress} />
                          </div>
                        </div>
                      )}
                      {(p.wasIVF === 'yes' || p.wasIVF === true) && (
                        <div>
                          <p className="text-[10px] font-semibold text-stone-400 uppercase mb-1">IVF Care</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            <ReadField label="Clinic" value={p.ivfClinicName} />
                            <ReadField label="Doctor" value={p.ivfDoctorName} />
                            <ReadField label="Phone" value={p.ivfPhone} />
                            <ReadField label="Fax" value={p.ivfFax} />
                            <ReadField label="Email" value={p.ivfEmail} />
                            <ReadField label="Address" value={p.ivfAddress} />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {readPregnancies.length === 0 && <p className="text-sm text-stone-400">No pregnancy provider information entered yet.</p>}
            {/* Additional Records (root-level) — read mode */}
            {(stored.additionalProviders || []).length > 0 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Additional Records</p>
                <div className="space-y-3">
                  {(stored.additionalProviders || []).map((extra, ei) => (
                    <div key={ei} className="rounded-lg border border-stone-100 bg-white p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-[#1A3638]">
                        {ADDITIONAL_PROVIDER_LABELS[extra.type] || extra.type || 'Provider'}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        <ReadField label="Clinic" value={extra.clinicName} />
                        <ReadField label="Doctor" value={extra.doctorName} />
                        <ReadField label="Phone" value={extra.phone} />
                        <ReadField label="Fax" value={extra.fax} />
                        <ReadField label="Email" value={extra.email} />
                        <ReadField label="Address" value={extra.address} className="sm:col-span-2" />
                        <ReadField label="Dates of Service" value={extra.datesOfService} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Release Forms button — admin only, read mode, with data */}
            {readPregnancies.length > 0 && (
              <GenerateReleaseFormsButton clinicData={stored} surrogate={surrogate} answers={answers} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Generate Release Forms Button ──────────────────────
function GenerateReleaseFormsButton({ clinicData, surrogate, answers }) {
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedIndexes, setSelectedIndexes] = useState(new Set())
  const { currentUser } = useRole()

  const { extractProviders, generateReleaseFormHtml } = useMemo(() => {
    // Lazy import to avoid circular deps
    return { extractProviders: null, generateReleaseFormHtml: null }
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setResult(null)
    try {
      const { extractProviders, generateReleaseFormHtml } = await import('@/lib/releaseFormGenerator')
      const { createDocument, sendDocument, updateDocument } = await import('@/lib/esign')
      const { supabase } = await import('@/lib/supabase')

      // Generate a batch token to group all release forms
      const batchToken = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')

      const allProviders = extractProviders(clinicData)
      // Filter to only selected providers
      const providers = allProviders.filter((_, i) => selectedIndexes.has(i))
      if (providers.length === 0) {
        setResult({ error: 'No providers selected. Please check at least one provider.' })
        setGenerating(false)
        return
      }

      // Get patient info from confidential data, with application/profile fallbacks.
      const applicationData = answers?._application || {}
      const confidentialData = {
        ...(answers?._confidential || {}),
        dob: (answers?._confidential?.dob || clinicData?.dob || applicationData.dob || answers?.dob || ''),
        maidenName: (answers?._confidential?.maidenName || applicationData.maidenName || ''),
        ssn4: (answers?._confidential?.ssn4 || applicationData.ssn4 || ''),
      }
      const patient = {
        name: confidentialData.fullLegalName || surrogate.name || '',
        email: surrogate.email || '',
      }

      const created = []
      for (const provider of providers) {
        // Generate HTML
        const html = generateReleaseFormHtml(provider, patient, confidentialData)
        const htmlBlob = new Blob([html], { type: 'text/html' })
        const htmlPath = `documents/release_${surrogate.id}_${provider.type}_${Date.now()}.html`

        // Upload HTML to storage
        await supabase.storage.from('esign-documents').upload(htmlPath, htmlBlob, { contentType: 'text/html', cacheControl: '3600' })

        const typeLabels = { ob: 'Prenatal/OB', hospital: 'Labor & Delivery', mfm: 'MFM', ivf: 'IVF/Fertility', pcp: 'Primary Care', er: 'Emergency Room' }
        const title = `Medical Records Release - ${typeLabels[provider.type] || provider.type} - ${provider.clinicName}`

        // Create e-sign document
        const doc = await createDocument({
          templateId: null,
          caseId: surrogate.id,
          caseType: 'surrogate',
          title,
          signers: [{ role: 'Surrogate', name: patient.name, email: patient.email, status: 'pending' }],
          filePath: null,
          createdBy: currentUser?.name || 'Admin',
        })

        // Store HTML path in document_hash
        await updateDocument(doc.id, {
          document_hash: JSON.stringify({
            htmlPath,
            batchToken,
            fields: [
              { fieldType: 'signature', role: 'gc', fieldId: 'field_0', placeholder: '{{Signature:GC}}' },
              { fieldType: 'date', role: 'gc', fieldId: 'field_1', placeholder: '{{Date:GC}}' },
              { fieldType: 'name', role: 'gc', fieldId: 'field_2', placeholder: '{{Name:GC}}' },
            ],
            providerType: provider.type,
            providerName: provider.clinicName,
          }),
        })

        // Send for signature
        await sendDocument(doc.id)

        created.push({ title, clinicName: provider.clinicName, type: provider.type, signingToken: doc.signing_token })
      }

      // Send ONE email with a single batch signing link
      if (created.length > 0 && patient.email) {
        const batchUrl = `${window.location.origin}/e-signature/release/${batchToken}`
        try {
          const { sendEmail } = await import('@/lib/google')
          const providerListHtml = created.map((d, i) => `
            <div style="padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
              <span style="color: #1A3638; font-weight: 600;">${i + 1}.</span>
              ${d.clinicName}
              <span style="color: #888; font-size: 12px;"> - ${{ ob: 'Prenatal/OB', hospital: 'Labor & Delivery', mfm: 'MFM', ivf: 'IVF/Fertility' }[d.type] || 'Medical'}</span>
            </div>
          `).join('')

          await sendEmail(currentUser?.id, {
            to: patient.email,
            subject: `Medical Records Release Forms - ${created.length} forms ready to sign`,
            body: `
              <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <img src="https://app.firststarsurrogacy.com/first-star-logo.png" alt="First Star Surrogacy" style="max-width: 180px;" />
                </div>
                <h2 style="color: #1A3638; margin-bottom: 8px;">Medical Records Release Forms</h2>
                <p>Hi ${patient.name || ''},</p>
                <p>${currentUser?.name || 'Your case manager'} at <strong>First Star Surrogacy</strong> has prepared ${created.length} medical records release form${created.length === 1 ? '' : 's'} for your signature. You can review and sign all forms on a single page:</p>
                <div style="background: #f8f9fc; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  ${providerListHtml}
                </div>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${batchUrl}" style="display: inline-block; background: #1A3638; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    Review & Sign All Forms
                  </a>
                </div>
                <p style="color: #666; font-size: 13px;">Each form authorizes a specific provider to release your medical records to First Star Surrogacy for your surrogacy journey.</p>
                <p style="color: #888; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
                  These are legally binding electronic signature requests from First Star Surrogacy, LLC.
                  If you have questions, please contact us at info@firststarsurrogacy.com.
                </p>
              </div>
            `,
          })
          // Log to case emails
          const providerList = created.map((d, i) => `${i + 1}. ${d.clinicName} (${{ ob: 'Prenatal/OB', hospital: 'Labor & Delivery', mfm: 'MFM', ivf: 'IVF/Fertility' }[d.type] || d.type})`).join('<br/>')
          try {
            await supabase.from('case_emails').insert({
              gmail_message_id: 'release-forms-' + Date.now(),
              case_id: surrogate.id,
              case_type: 'gc',
              subject: `Medical Records Release Forms - ${created.length} form${created.length === 1 ? '' : 's'} sent`,
              from_address: currentUser?.email || '',
              to_address: patient.email,
              date: new Date().toISOString(),
              snippet: `Sent ${created.length} medical records release form${created.length === 1 ? '' : 's'} to ${patient.name} for e-signature:<br/><br/>${providerList}<br/><br/>Signing link: <a href="${batchUrl}">${batchUrl}</a>`,
              logged_by: currentUser?.id,
              logged_by_name: currentUser?.name || '',
              tag: 'medical-records',
            })
          } catch {}
        } catch (emailErr) {
          console.error('Failed to email signer:', emailErr)
        }
      }

      setResult({ success: true, count: created.length, documents: created })
    } catch (err) {
      console.error('Failed to generate release forms:', err)
      setResult({ error: err.message || 'Failed to generate release forms.' })
    } finally {
      setGenerating(false)
    }
  }

  // Preview providers
  async function handlePreview() {
    try {
      const { extractProviders } = await import('@/lib/releaseFormGenerator')
      const providers = extractProviders(clinicData)
      setShowPreview(true)
      // Select all by default
      setSelectedIndexes(new Set(providers.map((_, i) => i)))
      setResult({ preview: true, providers })
    } catch {}
  }

  function toggleProvider(idx) {
    setSelectedIndexes(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="mt-4 pt-4 border-t border-stone-200">
      {!result?.success ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePreview} disabled={generating}>
              <FileText className="size-3.5" /> Preview Release Forms
            </Button>
            {result?.preview && selectedIndexes.size > 0 && (
              <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#D4A853', color: '#fff' }} onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
                {generating ? 'Generating...' : `Generate ${selectedIndexes.size} Release Form${selectedIndexes.size === 1 ? '' : 's'}`}
              </Button>
            )}
          </div>
          {result?.preview && result.providers?.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <button className="text-[10px] text-[#1A3638] font-medium hover:underline" onClick={() => setSelectedIndexes(new Set(result.providers.map((_, i) => i)))}>Select All</button>
                <span className="text-stone-300">|</span>
                <button className="text-[10px] text-stone-500 font-medium hover:underline" onClick={() => setSelectedIndexes(new Set())}>Deselect All</button>
              </div>
              {result.providers.map((p, i) => {
                const typeLabels = { ob: 'Prenatal/OB', hospital: 'L&D Hospital', mfm: 'MFM', ivf: 'IVF/Fertility', pcp: 'Primary Care', er: 'Emergency Room' }
                return (
                  <label key={i} className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer hover:bg-stone-50 rounded px-1 py-0.5">
                    <input type="checkbox" checked={selectedIndexes.has(i)} onChange={() => toggleProvider(i)} className="size-3.5 accent-[#1A3638]" />
                    <span className="font-medium text-[#1A3638]">{typeLabels[p.type]}</span> — {p.clinicName} {p.doctorName && <span className="text-stone-400">({p.doctorName})</span>}
                  </label>
                )
              })}
            </div>
          )}
          {result?.preview && result.providers?.length === 0 && (
            <p className="text-xs text-amber-600">No providers found. Please ensure clinic/hospital data is entered.</p>
          )}
          {result?.error && <p className="text-xs text-red-500">{result.error}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-emerald-600">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <p className="text-sm font-medium">{result.count} release form{result.count === 1 ? '' : 's'} created and sent for signature</p>
          </div>
          {result.documents?.map((d, i) => (
            <div key={i} className="text-xs text-stone-500 pl-6">• {d.title}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Social Media Release ────────────────────────────────
function SocialMediaSection({ surrogate, answers, onSaved, search }) {
  const stored = answers?._socialMediaRelease || {}
  const hasMatch = search ? ['social media', 'release', 'signature', 'permission', 'image', 'photo', 'video'].some(k => search.includes(k)) : true

  const { editing, saving, form, setForm, startEdit, handleSave, cancel } = useFormSection(
    surrogate.id, answers, '_socialMediaRelease',
    (saved) => ({
      fullName: saved.fullName || '',
      email: saved.email || answers?.email || surrogate.email || '',
      signatureDate: saved.signatureDate || '',
      agreed: saved.agreed || false,
    })
  )
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  if (!hasMatch) return null

  const CONSENT_TEXT = `I hereby grant permission to the rights of my image, likeness and sound of my voice as recorded on audio without payment or any other consideration. I understand that my image may be edited, copied, exhibited, published or distributed and waive the right to inspect or approve the finished product wherein my likeness appears. Additionally, I waive any right to the royalties or other compensation arising or related to the use of my image.

By signing this release I understand this permission signifies that photographic or video recordings of me may be electronically displayed via the internet.

There is no time limit of the validity of this release nor is there any geographic limitation on where these materials may be distributed.

This release applies to photographic, audio or video recordings collected (if any).

By signing this form I acknowledge that I have completely read and fully understand the above release and agree to be bound thereby. I hereby release any and all claims against any person or organization utilizing this material for educational purposes.`

  return (
    <Card className="rounded-2xl">
      <EditHeader title="Social Media Release" description="Photo and video consent" editing={editing} saving={saving} startEdit={startEdit} handleSave={() => handleSave(onSaved)} cancel={cancel} />
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-stone-50 border p-4 text-xs text-stone-500 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">{CONSENT_TEXT}</div>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1"><FieldLabel>Full Name</FieldLabel><Input value={form.fullName} onChange={e => set('fullName', e.target.value)} /></div>
            <div className="space-y-1"><FieldLabel>Email Address</FieldLabel><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div className="space-y-1"><FieldLabel>Date</FieldLabel><Input type="date" value={form.signatureDate} onChange={e => set('signatureDate', e.target.value)} /></div>
            <div className="space-y-1 flex items-center gap-2 pt-4">
              <Switch checked={form.agreed} onCheckedChange={v => set('agreed', v)} />
              <span className="text-sm font-medium">I agree to the above terms</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ReadField label="Full Name" value={stored.fullName} />
            <ReadField label="Email" value={stored.email} />
            <ReadField label="Date" value={stored.signatureDate} />
            <ReadField label="Agreed" value={stored.agreed ? 'Yes — Agreed' : 'Not yet signed'} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Export ──────────────────────────────────────────
// ── Profile Follow Up Questions (editable) ──

export default function GCApplicationTab({ surrogate, setSurrogate, quizAnswers, setQuizAnswers, profileData }) {
  const [search, setSearch] = useState('')
  const searchLower = search.toLowerCase().trim()
  const answers = quizAnswers || {}

  function handleSaved(updatedAnswers) {
    setQuizAnswers(updatedAnswers)
  }

  const APP_SECTIONS = [
    { id: 'quiz', label: 'Surrogate Quiz' },
    // One chip per application section, straight off the template.
    ...GC_TEMPLATE_SECTIONS.map(sec => ({ id: sec.key.replace(/^_/, ''), label: sec.title })),
    { id: 'personal', label: 'Identity & Docs' },
    { id: 'references', label: 'References' },
    { id: 'clinic', label: 'Clinic & Hospital' },
    { id: 'social', label: 'Social Media' },
    { id: 'waivers', label: 'BG Waivers' },
  ]

  return (
    <div className="space-y-4">
      {/* Quick Links + Search */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
          {APP_SECTIONS.map(sec => (
            <button
              key={sec.id}
              onClick={() => document.getElementById(`app-sec-${sec.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="rounded-lg border border-stone-200 hover:border-[#1A3638]/30 hover:bg-[#1A3638]/5 p-2 text-center cursor-pointer transition-colors"
            >
              <p className="text-[10px] font-medium text-stone-600 truncate">{sec.label}</p>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div id="app-sec-quiz"><QuizSection surrogate={surrogate} quizAnswers={quizAnswers} onSaved={handleSaved} search={searchLower} /></div>
      {/* The application questionnaire itself — same template the portal renders. */}
      {GC_TEMPLATE_SECTIONS.map(section => (
        <div key={section.key} id={`app-sec-${section.key.replace(/^_/, '')}`}>
          <TemplateAnswersSection surrogate={surrogate} section={section} answers={answers} onSaved={handleSaved} search={searchLower} />
        </div>
      ))}
      <div id="app-sec-personal"><ApplicationSection surrogate={surrogate} answers={answers} profileData={profileData} onSaved={handleSaved} search={searchLower} /></div>
      <div id="app-sec-references"><ReferencesSection surrogate={surrogate} answers={answers} onSaved={handleSaved} search={searchLower} /></div>
      <div id="app-sec-clinic"><ClinicHospitalSection surrogate={surrogate} answers={answers} profileData={profileData} onSaved={handleSaved} search={searchLower} /></div>
      <div id="app-sec-social"><SocialMediaSection surrogate={surrogate} answers={answers} onSaved={handleSaved} search={searchLower} /></div>

      {/* Release Forms — batch send with per-template checkboxes */}
      {(!searchLower || 'release form'.includes(searchLower) || 'background waiver'.includes(searchLower)) && (() => {
        const partnerName = [answers?._application?.spouseFirstName, answers?._application?.spouseLastName].filter(Boolean).join(' ')
        const partnerEmail = answers?._application?.spouseEmail
        const adminEmail = surrogate?.assignedTo || ''
        const adminName = adminEmail ? (getAdminStaff().find(a => a.email === adminEmail)?.name || adminEmail.split('@')[0]) : ''
        const maritalStatus = (profileData?.personal?.maritalStatus || answers?.maritalStatus || '').toLowerCase().trim()
        const hasPartner = !!partnerName.trim() || ['married', 'in a relationship', 'domestic partnership', 'partnered'].includes(maritalStatus)
        // Pull adult household members from the saved application so each
        // gets their own background-waiver row (rendered + sendable).
        const adultHouseholdMembers = Array.isArray(answers?._application?.adultHouseholdMembers)
          ? answers._application.adultHouseholdMembers.filter(m => m && (m.firstName || m.lastName || m.email))
          : []
        return (
          <ReleaseFormsSection
            surrogate={surrogate}
            hasPartner={hasPartner}
            partnerName={partnerName}
            partnerEmail={partnerEmail}
            adminName={adminName}
            adminEmail={adminEmail}
            adultHouseholdMembers={adultHouseholdMembers}
          />
        )
      })()}
    </div>
  )
}

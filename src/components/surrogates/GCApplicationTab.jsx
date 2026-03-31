import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import { ChevronDown, Search, Pencil, Save, Loader2, Plus, Trash2 } from 'lucide-react'
import { updateIntakeSubmission } from '@/lib/db'

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
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${isYes ? 'bg-[#283693] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Yes</button>
      <button type="button" onClick={() => onChange('no')}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${isNo ? 'bg-[#283693] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>No</button>
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
function QuizSection({ quizAnswers, search }) {
  if (!quizAnswers) return null
  const qa = quizAnswers
  const fields = [
    { label: 'First Name', value: qa.firstName },
    { label: 'Last Name', value: qa.lastName },
    { label: 'Email', value: qa.email },
    { label: 'Phone', value: qa.phone },
    { label: 'Date of Birth', value: qa.dob },
    { label: 'State', value: qa.state },
    { label: 'Height (ft)', value: qa.heightFt },
    { label: 'Height (in)', value: qa.heightIn },
    { label: 'Weight (lbs)', value: qa.weightLbs },
    { label: 'Marital Status', value: qa.maritalStatus },
    { label: 'US Citizen', value: boolDisplay(qa.usCitizen) },
    { label: 'Healthy Pregnancy', value: boolDisplay(qa.healthyPregnancy) },
    { label: 'Preferred Contact', value: qa.preferredContact },
    { label: 'How did you hear about us?', value: qa.hearAboutUs },
  ].filter(f => f.value !== undefined && f.value !== null && f.value !== '')

  const filtered = search ? fields.filter(f => f.label.toLowerCase().includes(search) || String(f.value).toLowerCase().includes(search)) : fields
  const hasMatch = search ? filtered.length > 0 : true

  return (
    <FormSection title="Surrogate Quiz" description="Answers from the initial screening quiz" defaultOpen={!search} searchMatch={hasMatch}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(f => <ReadField key={f.label} label={f.label} value={String(f.value)} />)}
      </div>
    </FormSection>
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
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
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

// ── Application Section ─────────────────────────────────
function ApplicationSection({ surrogate, answers, profileData, onSaved, search }) {
  const stored = answers?._application || {}
  const profile = profileData?.personal || {}
  const fertility = profileData?.fertility || {}
  const general = profileData?.general || {}

  const readFields = [
    { label: 'Street Address', value: stored.street || '' },
    { label: 'City', value: stored.city || profile.city || '' },
    { label: 'State', value: stored.state || profile.state || '' },
    { label: 'Zip Code', value: stored.zipCode || '' },
    { label: 'Real ID', value: boolDisplay(stored.realId ?? profile.realId) },
    { label: 'Valid Passport', value: boolDisplay(stored.validPassport ?? profile.validPassport) },
    { label: 'Spouse/Partner Email', value: stored.partnerEmail || '' },
    { label: 'Nearest hospital with Level II or III NICU', value: stored.nearestNICU || fertility.nearestNICU || '' },
    { label: 'Willing to travel to Level II+ NICU?', value: boolDisplay(stored.willingToTravelNICU ?? fertility.willingToTravelNICU) },
  ]
  const filtered = search ? readFields.filter(f => f.label.toLowerCase().includes(search) || String(f.value).toLowerCase().includes(search)) : readFields
  const hasMatch = search ? filtered.length > 0 : true

  const hasPartner = ['Married', 'Domestic Partnership', 'In a Relationship'].includes(profile.maritalStatus || answers?.maritalStatus)

  const { editing, saving, form, set, startEdit, handleSave, cancel } = useFormSection(
    surrogate.id, answers, '_application',
    (saved) => ({
      street: saved.street || '',
      city: saved.city || profile.city || '',
      state: saved.state || profile.state || '',
      zipCode: saved.zipCode || '',
      realId: saved.realId ?? profile.realId ?? '',
      validPassport: saved.validPassport ?? profile.validPassport ?? '',
      partnerEmail: saved.partnerEmail || '',
      nearestNICU: saved.nearestNICU || fertility.nearestNICU || '',
      willingToTravelNICU: saved.willingToTravelNICU ?? fertility.willingToTravelNICU ?? '',
    })
  )

  if (!hasMatch) return null

  return (
    <Card className="rounded-2xl">
      <EditHeader title="Application" description="Address, identification, and NICU information" editing={editing} saving={saving} startEdit={startEdit} handleSave={() => handleSave(onSaved)} cancel={cancel} />
      <CardContent>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1"><FieldLabel>Street Address</FieldLabel><Input value={form.street} onChange={e => set('street', e.target.value)} /></div>
            <div className="space-y-1"><FieldLabel>City</FieldLabel><Input value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div className="space-y-1"><FieldLabel>State</FieldLabel><SelectField value={form.state} onValueChange={v => set('state', v)} options={US_STATES} /></div>
            <div className="space-y-1"><FieldLabel>Zip Code</FieldLabel><Input value={form.zipCode} onChange={e => set('zipCode', e.target.value)} /></div>
            <div className="space-y-1"><FieldLabel>Real ID?</FieldLabel><YesNoButtons value={form.realId} onChange={v => set('realId', v)} /></div>
            <div className="space-y-1"><FieldLabel>Valid Passport?</FieldLabel><YesNoButtons value={form.validPassport} onChange={v => set('validPassport', v)} /></div>
            {hasPartner && <div className="space-y-1 col-span-full sm:col-span-1"><FieldLabel>Spouse/Partner Email</FieldLabel><Input type="email" value={form.partnerEmail} onChange={e => set('partnerEmail', e.target.value)} placeholder="Must be different than theirs" /></div>}
            <div className="space-y-1 col-span-full sm:col-span-1"><FieldLabel>Nearest Hospital with Level II or III NICU</FieldLabel><Input value={form.nearestNICU} onChange={e => set('nearestNICU', e.target.value)} /></div>
            <div className="space-y-1"><FieldLabel>Willing to travel to Level II+ NICU?</FieldLabel><YesNoButtons value={form.willingToTravelNICU} onChange={v => set('willingToTravelNICU', v)} /></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(f => <ReadField key={f.label} label={f.label} value={f.value} />)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── References Section ──────────────────────────────────
function ReferencesSection({ surrogate, answers, onSaved, search }) {
  const stored = answers?._references || {}
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
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Confidential Info Section ───────────────────────────
function ConfidentialSection({ surrogate, answers, profileData, onSaved, search }) {
  const stored = answers?._confidential || {}
  const profile = profileData?.personal || {}
  const general = profileData?.general || {}
  const employment = profileData?.employment || {}

  const fields = [
    'fullLegalName', 'maidenName', 'street', 'cityStateZip', 'howLongAtAddress', 'ownRent',
    'homePhone', 'homeVoicemail', 'workPhone', 'workMessages', 'mobilePhone', 'mobileVoicemail',
    'emailAddress', 'emailConfidential', 'ssn', 'usCitizen',
    'driversLicenseNumber', 'driversLicenseState', 'driversLicenseExpiration',
    'age', 'dob', 'height', 'weight', 'placeOfBirth', 'religion',
    'insuranceName', 'insuranceProvider', 'insuranceAddress', 'insurancePhone',
    'insurancePolicyNumber', 'insuranceGroupName', 'insuranceCoversSurrogacy', 'insuranceUsedBefore',
    'hasSpouse',
    'spouseFullName', 'spouseRelationshipLength', 'spouseUsCitizen',
    'spouseDLNumber', 'spouseDLState', 'spouseDLExpiration', 'spouseDob',
    'spouseHomePhone', 'spouseWorkPhone', 'spouseCellPhone', 'spouseSSN',
    'emergencyName', 'emergencyHomePhone', 'emergencyCellPhone',
  ]

  const fieldLabels = {
    fullLegalName: 'Full Legal Name', maidenName: 'Maiden Last Name', street: 'Street Address',
    cityStateZip: 'City, State, Zip', howLongAtAddress: 'How long at current address?', ownRent: 'Own / Rent',
    homePhone: 'Home Phone', homeVoicemail: 'Confidential messages on home voicemail?',
    workPhone: 'Work Phone', workMessages: 'May I speak freely at work?',
    mobilePhone: 'Mobile Phone', mobileVoicemail: 'Confidential messages on mobile?',
    emailAddress: 'Email Address', emailConfidential: 'Email confidential?',
    ssn: 'Social Security Number', usCitizen: 'US Citizen',
    driversLicenseNumber: "Driver's License Number", driversLicenseState: "Driver's License State",
    driversLicenseExpiration: "Driver's License Expiration",
    age: 'Age', dob: 'Date of Birth', height: 'Height', weight: 'Weight',
    placeOfBirth: 'Place of Birth', religion: 'Religion',
    insuranceName: 'Name on Medical Insurance', insuranceProvider: 'Health Insurance Provider',
    insuranceAddress: 'Insurance Provider Address', insurancePhone: 'Insurance Provider Phone',
    insurancePolicyNumber: 'Policy Number', insuranceGroupName: 'Group Name',
    insuranceCoversSurrogacy: 'Policy covers surrogacy?', insuranceUsedBefore: 'Used this insurance for surrogacy before?',
    hasSpouse: 'Do you have a spouse / partner?',
    spouseFullName: "Spouse's Full Legal Name", spouseRelationshipLength: 'Length of Relationship',
    spouseUsCitizen: 'Spouse US Citizen', spouseDLNumber: "Spouse's DL Number",
    spouseDLState: "Spouse's DL State", spouseDLExpiration: "Spouse's DL Expiration",
    spouseDob: "Spouse's Date of Birth",
    spouseHomePhone: "Spouse's Home Phone", spouseWorkPhone: "Spouse's Work Phone",
    spouseCellPhone: "Spouse's Cell Phone", spouseSSN: "Spouse's SSN",
    emergencyName: 'Emergency Contact Name', emergencyHomePhone: 'Emergency Home Phone',
    emergencyCellPhone: 'Emergency Cell Phone',
  }

  const yesNoFields = new Set(['homeVoicemail', 'workMessages', 'mobileVoicemail', 'emailConfidential', 'usCitizen', 'insuranceCoversSurrogacy', 'insuranceUsedBefore', 'hasSpouse', 'spouseUsCitizen'])
  const selectFields = { ownRent: ['Own', 'Rent', 'Other'], driversLicenseState: US_STATES, spouseDLState: US_STATES }

  const hasMatch = search ? fields.some(f => (fieldLabels[f] || f).toLowerCase().includes(search)) : true

  const { editing, saving, form, setForm, startEdit, handleSave, cancel } = useFormSection(
    surrogate.id, answers, '_confidential',
    (saved) => {
      const init = {}
      for (const f of fields) {
        // Pull from stored first, then profile data
        init[f] = saved[f] ?? ''
      }
      // Pre-fill from profile
      if (!init.fullLegalName) init.fullLegalName = `${profile.firstName || ''} ${answers?.lastName || ''}`.trim()
      if (!init.dob) init.dob = profile.dob || answers?.dob || ''
      if (!init.height) init.height = profile.heightFt ? `${profile.heightFt}'${profile.heightIn || 0}"` : ''
      if (!init.weight) init.weight = profile.weight || answers?.weightLbs || ''
      if (!init.religion) init.religion = general.religion || ''
      if (!init.usCitizen) init.usCitizen = profile.usCitizen || ''
      if (!init.emailAddress) init.emailAddress = answers?.email || surrogate.email || ''
      if (!init.mobilePhone) init.mobilePhone = answers?.phone || surrogate.phone || ''
      if (!init.ownRent) init.ownRent = general.homeOwnership || ''
      if (!init.howLongAtAddress) init.howLongAtAddress = general.homeDuration || ''
      return init
    }
  )
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  if (!hasMatch) return null

  const spouseFields = fields.filter(f => f.startsWith('spouse'))
  const emergencyFields = fields.filter(f => f.startsWith('emergency'))
  const personalFields = fields.filter(f => !f.startsWith('spouse') && !f.startsWith('emergency') && !f.startsWith('insurance') && f !== 'hasSpouse')
  const insuranceFields = fields.filter(f => f.startsWith('insurance'))

  function renderField(f) {
    const label = fieldLabels[f] || f
    if (editing) {
      if (yesNoFields.has(f)) return <div key={f} className="space-y-1"><FieldLabel>{label}</FieldLabel><YesNoButtons value={form[f]} onChange={v => set(f, v)} /></div>
      if (selectFields[f]) return <div key={f} className="space-y-1"><FieldLabel>{label}</FieldLabel><SelectField value={form[f]} onValueChange={v => set(f, v)} options={selectFields[f]} /></div>
      return <div key={f} className="space-y-1"><FieldLabel>{label}</FieldLabel><Input value={form[f] || ''} onChange={e => set(f, e.target.value)} /></div>
    }
    return <ReadField key={f} label={label} value={yesNoFields.has(f) ? boolDisplay(stored[f]) : (stored[f] || '')} />
  }

  return (
    <Card className="rounded-2xl">
      <EditHeader title="Confidential Personal Information" description="Sensitive information — shared with IPs only with surrogate approval" editing={editing} saving={saving} startEdit={startEdit} handleSave={() => handleSave(onSaved)} cancel={cancel} />
      <CardContent className="space-y-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Personal Information</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{personalFields.map(renderField)}</div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Insurance</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{insuranceFields.map(renderField)}</div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Spouse / Partner</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {renderField('hasSpouse')}
            {(editing ? form.hasSpouse === 'yes' || form.hasSpouse === true : stored.hasSpouse === 'yes' || stored.hasSpouse === true) && spouseFields.map(renderField)}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Emergency Contact</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{emergencyFields.map(renderField)}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Clinic & Hospital Section ───────────────────────────
function ClinicHospitalSection({ surrogate, answers, profileData, onSaved, search }) {
  const stored = answers?._clinicHospital || {}
  const pregnancies = profileData?.pregnancyHistory?.pregnancies || []
  const numPreg = parseInt(profileData?.pregnancyHistory?.numberOfPregnancies) || 0

  const hasMatch = search ? ['clinic', 'hospital', 'ob', 'gyn', 'delivery', 'pregnancy', 'experienced surrogate'].some(k => search.includes(k)) : true

  const { editing, saving, form, setForm, startEdit, handleSave, cancel } = useFormSection(
    surrogate.id, answers, '_clinicHospital',
    (saved) => {
      const count = Math.max(numPreg, pregnancies.length, (saved.deliveries || []).length)
      const deliveries = []
      for (let i = 0; i < Math.max(count, 1); i++) {
        const existing = (saved.deliveries || [])[i] || {}
        const preg = pregnancies[i] || {}
        deliveries.push({
          birthDate: existing.birthDate || preg.dob || '',
          obClinicName: existing.obClinicName || '',
          obClinicAddress: existing.obClinicAddress || '',
          hospitalName: existing.hospitalName || '',
          hospitalAddress: existing.hospitalAddress || '',
          notes: existing.notes || '',
        })
      }
      return {
        currentOBGYN: saved.currentOBGYN || '',
        experiencedSurrogate: saved.experiencedSurrogate ?? profileData?.experiencedSurrogate?.previousSurrogate ?? '',
        deliveries,
      }
    }
  )

  if (!hasMatch) return null

  function updateDelivery(i, key, val) {
    setForm(f => {
      const deliveries = [...(f.deliveries || [])]
      deliveries[i] = { ...deliveries[i], [key]: val }
      return { ...f, deliveries }
    })
  }

  function addDelivery() {
    setForm(f => ({ ...f, deliveries: [...(f.deliveries || []), { birthDate: '', obClinicName: '', obClinicAddress: '', hospitalName: '', hospitalAddress: '', notes: '' }] }))
  }

  function removeDelivery(i) {
    setForm(f => ({ ...f, deliveries: (f.deliveries || []).filter((_, idx) => idx !== i) }))
  }

  return (
    <Card className="rounded-2xl">
      <EditHeader title="Clinic & Hospital Form" description="OB/GYN and hospital details for each pregnancy" editing={editing} saving={saving} startEdit={startEdit} handleSave={() => handleSave(onSaved)} cancel={cancel} />
      <CardContent className="space-y-6">
        {editing ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1"><FieldLabel>Current OB/GYN or Primary Care (name & location)</FieldLabel><Input value={form.currentOBGYN} onChange={e => setForm(f => ({ ...f, currentOBGYN: e.target.value }))} /></div>
              <div className="space-y-1"><FieldLabel>Are you an experienced surrogate?</FieldLabel><YesNoButtons value={form.experiencedSurrogate} onChange={v => setForm(f => ({ ...f, experiencedSurrogate: v }))} /></div>
            </div>
            {(form.deliveries || []).map((d, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#283693]">Delivery #{i + 1}</p>
                  {(form.deliveries || []).length > 1 && <button onClick={() => removeDelivery(i)} className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1"><Trash2 className="size-3" /> Remove</button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="space-y-1"><FieldLabel>Birth Date</FieldLabel><Input type="date" value={d.birthDate} onChange={e => updateDelivery(i, 'birthDate', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>OB Clinic Name</FieldLabel><Input value={d.obClinicName} onChange={e => updateDelivery(i, 'obClinicName', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>OB Clinic Address</FieldLabel><Input value={d.obClinicAddress} onChange={e => updateDelivery(i, 'obClinicAddress', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>Hospital Name</FieldLabel><Input value={d.hospitalName} onChange={e => updateDelivery(i, 'hospitalName', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>Hospital Address</FieldLabel><Input value={d.hospitalAddress} onChange={e => updateDelivery(i, 'hospitalAddress', e.target.value)} /></div>
                  <div className="space-y-1"><FieldLabel>Notes</FieldLabel><Input value={d.notes} onChange={e => updateDelivery(i, 'notes', e.target.value)} /></div>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={addDelivery}><Plus className="size-3.5" /> Add Delivery</Button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ReadField label="Current OB/GYN" value={stored.currentOBGYN} />
              <ReadField label="Experienced Surrogate" value={boolDisplay(stored.experiencedSurrogate)} />
            </div>
            {(stored.deliveries || []).map((d, i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/30 p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Delivery #{i + 1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <ReadField label="Birth Date" value={d.birthDate} />
                  <ReadField label="OB Clinic" value={d.obClinicName} />
                  <ReadField label="OB Address" value={d.obClinicAddress} />
                  <ReadField label="Hospital" value={d.hospitalName} />
                  <ReadField label="Hospital Address" value={d.hospitalAddress} />
                  <ReadField label="Notes" value={d.notes} />
                </div>
              </div>
            ))}
            {(!stored.deliveries || stored.deliveries.length === 0) && <p className="text-sm text-stone-400">No delivery information entered yet.</p>}
          </>
        )}
      </CardContent>
    </Card>
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
export default function GCApplicationTab({ surrogate, setSurrogate, quizAnswers, setQuizAnswers, profileData }) {
  const [search, setSearch] = useState('')
  const searchLower = search.toLowerCase().trim()
  const answers = quizAnswers || {}

  function handleSaved(updatedAnswers) {
    setQuizAnswers(updatedAnswers)
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search questions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <QuizSection quizAnswers={quizAnswers} search={searchLower} />
      <ApplicationSection surrogate={surrogate} answers={answers} profileData={profileData} onSaved={handleSaved} search={searchLower} />
      <ReferencesSection surrogate={surrogate} answers={answers} onSaved={handleSaved} search={searchLower} />
      <ConfidentialSection surrogate={surrogate} answers={answers} profileData={profileData} onSaved={handleSaved} search={searchLower} />
      <ClinicHospitalSection surrogate={surrogate} answers={answers} profileData={profileData} onSaved={handleSaved} search={searchLower} />
      <SocialMediaSection surrogate={surrogate} answers={answers} onSaved={handleSaved} search={searchLower} />
    </div>
  )
}

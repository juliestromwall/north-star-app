import { useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import { ChevronDown, Search, Pencil, Save, Loader2, Plus, Trash2, FileText } from 'lucide-react'
import { updateIntakeSubmission } from '@/lib/db'
import { useRole } from '@/context/RoleContext'
import { ADMIN_ROLES } from '@/lib/constants'

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
const MARITAL_OPTIONS = ['Single', 'In a Relationship', 'Married', 'Domestic Partnership', 'Divorced', 'Separated', 'Widowed']
const CONTACT_OPTIONS = ['Text', 'Email', 'Phone']
const HEAR_OPTIONS = ['Google', 'Instagram', 'TikTok', 'Facebook', 'Friend/Family', 'Previous Surrogate', 'Agency Referral', 'Other']

function QuizSection({ surrogate, quizAnswers, onSaved, search }) {
  const qa = quizAnswers || {}
  const QUIZ_FIELDS = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'dob', label: 'Date of Birth', type: 'date' },
    { key: 'state', label: 'State', type: 'select', options: US_STATES },
    { key: 'heightFt', label: 'Height (ft)', type: 'select', options: ['4', '5', '6'] },
    { key: 'heightIn', label: 'Height (in)', type: 'select', options: ['0','1','2','3','4','5','6','7','8','9','10','11'] },
    { key: 'weightLbs', label: 'Weight (lbs)', type: 'number' },
    { key: 'maritalStatus', label: 'Marital Status', type: 'select', options: MARITAL_OPTIONS },
    { key: 'usCitizen', label: 'US Citizen', type: 'yesno' },
    { key: 'healthyPregnancy', label: 'Healthy Pregnancy History', type: 'yesno' },
    { key: 'preferredContact', label: 'Preferred Contact', type: 'select', options: CONTACT_OPTIONS },
    { key: 'hearAboutUs', label: 'How did you hear about us?', type: 'select', options: HEAR_OPTIONS },
    { key: 'hearAboutUsOther', label: 'Other (specify)' },
    { key: 'agreeBackgroundCheck', label: 'Agreed to Background Check', type: 'yesno' },
  ]

  const allLabels = QUIZ_FIELDS.map(f => f.label.toLowerCase())
  const hasMatch = search ? allLabels.some(l => l.includes(search)) || QUIZ_FIELDS.some(f => String(qa[f.key] || '').toLowerCase().includes(search)) : true

  const { editing, saving, form, setForm, startEdit, handleSave, cancel } = useFormSection(
    surrogate?.id, quizAnswers, null,
    (_, answers) => {
      const init = {}
      for (const f of QUIZ_FIELDS) init[f.key] = answers?.[f.key] ?? ''
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
      const merged = { ...currentAnswers, ...form }
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {QUIZ_FIELDS.map(f => {
              if (f.type === 'yesno') return (
                <div key={f.key} className="space-y-1"><FieldLabel>{f.label}</FieldLabel><YesNoButtons value={form[f.key]} onChange={v => set(f.key, v)} /></div>
              )
              if (f.type === 'select') return (
                <div key={f.key} className="space-y-1"><FieldLabel>{f.label}</FieldLabel><SelectField value={form[f.key]} onValueChange={v => set(f.key, v)} options={f.options} /></div>
              )
              return (
                <div key={f.key} className="space-y-1"><FieldLabel>{f.label}</FieldLabel>
                  <input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                    className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm bg-white focus:border-[#283693] focus:ring-1 focus:ring-[#283693]/20 outline-none" />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {QUIZ_FIELDS.map(f => {
              const val = qa[f.key]
              if (val === undefined || val === null || val === '') return null
              const display = f.type === 'yesno' ? boolDisplay(val) : String(val)
              if (search && !f.label.toLowerCase().includes(search) && !display.toLowerCase().includes(search)) return null
              return <ReadField key={f.key} label={f.label} value={display} />
            })}
          </div>
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
      nearestNICU: saved.nearestNICU || fertility.nearestNICU || '',
      willingToTravelNICU: saved.willingToTravelNICU ?? fertility.willingToTravelNICU ?? '',
    })
  )

  if (!hasMatch) return null

  return (
    <Card className="rounded-2xl">
      <EditHeader title="Personal Information" description="Address, identification, and NICU information" editing={editing} saving={saving} startEdit={startEdit} handleSave={() => handleSave(onSaved)} cancel={cancel} />
      <CardContent>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1"><FieldLabel>Street Address</FieldLabel><Input value={form.street} onChange={e => set('street', e.target.value)} /></div>
            <div className="space-y-1"><FieldLabel>City</FieldLabel><Input value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div className="space-y-1"><FieldLabel>State</FieldLabel><SelectField value={form.state} onValueChange={v => set('state', v)} options={US_STATES} /></div>
            <div className="space-y-1"><FieldLabel>Zip Code</FieldLabel><Input value={form.zipCode} onChange={e => set('zipCode', e.target.value)} /></div>
            <div className="space-y-1"><FieldLabel>Real ID?</FieldLabel><YesNoButtons value={form.realId} onChange={v => set('realId', v)} /></div>
            <div className="space-y-1"><FieldLabel>Valid Passport?</FieldLabel><YesNoButtons value={form.validPassport} onChange={v => set('validPassport', v)} /></div>
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
    'spouseEmail',
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
    spouseEmail: "Spouse/Partner Email",
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
const NON_DELIVERY_OUTCOMES = ['miscarriage', 'ectopic', 'ectopic pregnancy', 'termination', 'chemical', 'chemical pregnancy']
const EMPTY_PREGNANCY = {
  date: '', outcome: '', receivedPrenatalCare: '', wasSurrogacy: '',
  obClinicName: '', obDoctorName: '', obPhone: '', obAddress: '',
  hospitalName: '', hospitalPhone: '', hospitalAddress: '',
  sawMFM: '', mfmClinicName: '', mfmDoctorName: '', mfmPhone: '', mfmAddress: '',
  wasIVF: '', ivfClinicName: '', ivfDoctorName: '', ivfPhone: '', ivfAddress: '',
}

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
          obClinicName: existing.obClinicName || '',
          obDoctorName: existing.obDoctorName || '',
          obPhone: existing.obPhone || '',
          obAddress: existing.obAddress || '',
          hospitalName: existing.hospitalName || '',
          hospitalPhone: existing.hospitalPhone || '',
          hospitalAddress: existing.hospitalAddress || '',
          sawMFM: existing.sawMFM ?? '',
          mfmClinicName: existing.mfmClinicName || '',
          mfmDoctorName: existing.mfmDoctorName || '',
          mfmPhone: existing.mfmPhone || '',
          mfmAddress: existing.mfmAddress || '',
          wasIVF: existing.wasIVF ?? '',
          ivfClinicName: existing.ivfClinicName || '',
          ivfDoctorName: existing.ivfDoctorName || '',
          ivfPhone: existing.ivfPhone || '',
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
        numberOfPregnancies: saved.numberOfPregnancies || profileCount || '',
        pregnancies,
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
                <div className="space-y-1"><FieldLabel>Phone Number</FieldLabel><Input value={form.currentOBPhone} onChange={e => setForm(f => ({ ...f, currentOBPhone: e.target.value }))} /></div>
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
                <div className="space-y-1"><FieldLabel>State</FieldLabel><SelectField value={form.papClinicState} onValueChange={v => setForm(f => ({ ...f, papClinicState: v }))} options={US_STATES} /></div>
                <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input value={form.papClinicPhone} onChange={e => setForm(f => ({ ...f, papClinicPhone: e.target.value }))} placeholder="Optional" /></div>
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
                    <p className="text-sm font-semibold text-[#283693]">Pregnancy #{i + 1}</p>
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
                        <p className="text-[11px] font-semibold text-stone-500 uppercase mb-2">Prenatal Care</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="space-y-1"><FieldLabel>Clinic Name</FieldLabel><Input value={p.obClinicName} onChange={e => updatePreg(i, 'obClinicName', e.target.value)} /></div>
                          <div className="space-y-1"><FieldLabel>OB Doctor / Midwife</FieldLabel><Input value={p.obDoctorName} onChange={e => updatePreg(i, 'obDoctorName', e.target.value)} /></div>
                          <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input value={p.obPhone} onChange={e => updatePreg(i, 'obPhone', e.target.value)} /></div>
                          <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={p.obAddress} onChange={e => updatePreg(i, 'obAddress', e.target.value)} placeholder="Optional" /></div>
                        </div>
                      </div>
                      {/* Delivery Hospital — only for live births / stillborns or if prenatal care was received */}
                      {(!isNonDel || p.receivedPrenatalCare === 'yes') && !isNonDel && (
                        <div>
                          <p className="text-[11px] font-semibold text-stone-500 uppercase mb-2">Delivery Hospital</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div className="space-y-1"><FieldLabel>Hospital Name</FieldLabel><Input value={p.hospitalName} onChange={e => updatePreg(i, 'hospitalName', e.target.value)} /></div>
                            <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input value={p.hospitalPhone} onChange={e => updatePreg(i, 'hospitalPhone', e.target.value)} /></div>
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
                            <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input value={p.mfmPhone} onChange={e => updatePreg(i, 'mfmPhone', e.target.value)} /></div>
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
                            <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input value={p.ivfPhone} onChange={e => updatePreg(i, 'ivfPhone', e.target.value)} /></div>
                            <div className="space-y-1"><FieldLabel>Address</FieldLabel><Input value={p.ivfAddress} onChange={e => updatePreg(i, 'ivfAddress', e.target.value)} placeholder="Optional" /></div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
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
                <ReadField label="Date" value={stored.papDate} />
                <ReadField label="Doctor" value={stored.papDoctorName} />
                <ReadField label="Clinic" value={stored.papClinicName} />
                <ReadField label="City" value={stored.papClinicCity} />
                <ReadField label="State" value={stored.papClinicState} />
                <ReadField label="Phone" value={stored.papClinicPhone} />
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
                          <p className="text-[10px] font-semibold text-stone-400 uppercase mb-1">Prenatal Care</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            <ReadField label="Clinic" value={p.obClinicName} />
                            <ReadField label="Doctor" value={p.obDoctorName} />
                            <ReadField label="Phone" value={p.obPhone} />
                            <ReadField label="Address" value={p.obAddress} />
                          </div>
                        </div>
                      )}
                      {(p.hospitalName) && (
                        <div>
                          <p className="text-[10px] font-semibold text-stone-400 uppercase mb-1">Delivery Hospital</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            <ReadField label="Hospital" value={p.hospitalName} />
                            <ReadField label="Phone" value={p.hospitalPhone} />
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

      const providers = extractProviders(clinicData)
      if (providers.length === 0) {
        setResult({ error: 'No providers found. Please ensure the clinic/hospital form is filled out.' })
        setGenerating(false)
        return
      }

      // Get patient info from confidential data
      const confidentialData = answers?._confidential || {}
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

        const typeLabels = { ob: 'Prenatal/OB', hospital: 'Labor & Delivery', mfm: 'MFM', ivf: 'IVF/Fertility' }
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
              <span style="color: #283693; font-weight: 600;">${i + 1}.</span>
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
                  <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="ABC Surrogacy" style="max-width: 180px;" />
                </div>
                <h2 style="color: #283693; margin-bottom: 8px;">Medical Records Release Forms</h2>
                <p>Hi ${patient.name || ''},</p>
                <p>${currentUser?.name || 'Your case manager'} at <strong>Abundant Beginnings Co.</strong> has prepared ${created.length} medical records release form${created.length === 1 ? '' : 's'} for your signature. You can review and sign all forms on a single page:</p>
                <div style="background: #f8f9fc; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  ${providerListHtml}
                </div>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${batchUrl}" style="display: inline-block; background: #283693; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                    Review & Sign All Forms
                  </a>
                </div>
                <p style="color: #666; font-size: 13px;">Each form authorizes a specific provider to release your medical records to ABC Surrogacy for your surrogacy journey.</p>
                <p style="color: #888; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
                  These are legally binding electronic signature requests from Abundant Beginnings Company, LLC.
                  If you have questions, please contact us at info@abcsurrogacy.com.
                </p>
              </div>
            `,
          })
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
      setResult({ preview: true, providers })
    } catch {}
  }

  return (
    <div className="mt-4 pt-4 border-t border-stone-200">
      {!result?.success ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePreview} disabled={generating}>
              <FileText className="size-3.5" /> Preview Release Forms
            </Button>
            {result?.preview && (
              <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#ed148c', color: '#fff' }} onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
                {generating ? 'Generating...' : `Generate ${result.providers?.length || 0} Release Form${result.providers?.length === 1 ? '' : 's'}`}
              </Button>
            )}
          </div>
          {result?.preview && result.providers?.length > 0 && (
            <div className="space-y-1">
              {result.providers.map((p, i) => {
                const typeLabels = { ob: 'Prenatal/OB', hospital: 'L&D Hospital', mfm: 'MFM', ivf: 'IVF/Fertility' }
                return (
                  <div key={i} className="flex items-center gap-2 text-xs text-stone-600">
                    <span className="size-1.5 rounded-full bg-[#283693]" />
                    <span className="font-medium">{typeLabels[p.type]}</span> — {p.clinicName} {p.doctorName && `(${p.doctorName})`}
                  </div>
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

      <QuizSection surrogate={surrogate} quizAnswers={quizAnswers} onSaved={handleSaved} search={searchLower} />
      <ApplicationSection surrogate={surrogate} answers={answers} profileData={profileData} onSaved={handleSaved} search={searchLower} />
      <ConfidentialSection surrogate={surrogate} answers={answers} profileData={profileData} onSaved={handleSaved} search={searchLower} />
      <ReferencesSection surrogate={surrogate} answers={answers} onSaved={handleSaved} search={searchLower} />
      <ClinicHospitalSection surrogate={surrogate} answers={answers} profileData={profileData} onSaved={handleSaved} search={searchLower} />
      <SocialMediaSection surrogate={surrogate} answers={answers} onSaved={handleSaved} search={searchLower} />
    </div>
  )
}

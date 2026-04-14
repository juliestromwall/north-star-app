import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import { ChevronDown, Search, Pencil, Save, Loader2, Shield } from 'lucide-react'
import { updateIntakeSubmission } from '@/lib/db'
import SendFormTemplateButton from '@/components/shared/SendFormTemplateButton'

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

function useFormSection(ipId, answers, storageKey, initFn) {
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
      await updateIntakeSubmission(ipId, { answers: updatedAnswers })
      if (onSaved) onSaved(updatedAnswers)
      setEditing(false)
    } catch {} finally { setSaving(false) }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  return { editing, saving, form, set, setForm, startEdit, handleSave, cancel: () => setEditing(false) }
}

// ── Intake Answers (editable) ───────────────────────────
function IntakeAnswersSection({ ip, setIp, search }) {
  const a = ip.answers || {}
  const hasPartner = a.hasPartner === 'yes' || a.hasPartner === true

  const INTAKE_FIELDS = [
    { key: 'primaryFirstName', label: 'IP1 First Name' },
    { key: 'primaryLastName', label: 'IP1 Last Name' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'primaryDob', label: 'Date of Birth', type: 'date' },
    { key: 'country', label: 'Country' },
    { key: 'city', label: 'City' },
    { key: 'stateProv', label: 'State', type: 'select', options: US_STATES },
    { key: 'hasPartner', label: 'Has Partner', type: 'yesno' },
    ...(hasPartner ? [
      { key: 'ip2FirstName', label: 'IP2 First Name' },
      { key: 'ip2LastName', label: 'IP2 Last Name' },
      { key: 'ip2Email', label: 'IP2 Email', type: 'email' },
      { key: 'ip2Phone', label: 'IP2 Phone', type: 'tel' },
      { key: 'ip2Dob', label: 'IP2 Date of Birth', type: 'date' },
    ] : []),
    { key: 'maritalStatus', label: 'Marital Status' },
    { key: 'hasRE', label: 'Has RE Doctor', type: 'yesno' },
    { key: 'reDoctorName', label: 'RE Doctor Name' },
    { key: 'hasFrozenEmbryos', label: 'Frozen Embryos', type: 'yesno' },
    { key: 'frozenEmbryoDetails', label: 'Embryo Details' },
    { key: 'usingEggDonor', label: 'Using Egg Donor', type: 'yesno' },
    { key: 'usingSpermDonor', label: 'Using Sperm Donor', type: 'yesno' },
    { key: 'wantsConsultation', label: 'Wants Consultation', type: 'yesno' },
    { key: 'hearAboutUs', label: 'How They Heard' },
  ]

  const allLabels = INTAKE_FIELDS.map(f => f.label.toLowerCase())
  const hasMatch = search ? allLabels.some(l => l.includes(search)) || INTAKE_FIELDS.some(f => String(a[f.key] || '').toLowerCase().includes(search)) : true

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})

  function startEdit() {
    const init = {}
    for (const f of INTAKE_FIELDS) init[f.key] = a[f.key] ?? ''
    setForm(init)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Fetch fresh answers from DB
      const { supabase } = await import('@/lib/supabase')
      let currentAnswers = a
      if (supabase) {
        const { data } = await supabase.from('intake_submissions').select('answers').eq('id', ip.id).single()
        if (data?.answers) currentAnswers = data.answers
      }
      const merged = { ...currentAnswers, ...form }
      const hp = form.hasPartner === true || form.hasPartner === 'yes'
      const ip1Name = `${form.primaryFirstName || ''} ${form.primaryLastName || ''}`.trim()
      const ip2Name = hp ? `${form.ip2FirstName || ''} ${form.ip2LastName || ''}`.trim() : ''
      const displayName = ip2Name ? `${ip1Name} & ${ip2Name}` : ip1Name

      await updateIntakeSubmission(ip.id, {
        answers: merged,
        applicant_name: displayName || undefined,
        applicant_email: (form.email || '').trim().toLowerCase() || undefined,
        applicant_phone: form.phone || undefined,
        state_region: form.stateProv || undefined,
      })
      setIp(prev => ({
        ...prev,
        names: displayName || prev.names,
        ip1Name: ip1Name || prev.ip1Name,
        ip2Name: ip2Name || prev.ip2Name,
        email: form.email || prev.email,
        phone: form.phone || prev.phone,
        ip2Email: form.ip2Email || prev.ip2Email,
        ip2Phone: form.ip2Phone || prev.ip2Phone,
        location: [form.city, form.stateProv].filter(Boolean).join(', ') || prev.location,
        type: hp ? 'Couple' : 'Single parent',
        hasRE: form.hasRE,
        reDoctorName: form.reDoctorName,
        hasFrozenEmbryos: form.hasFrozenEmbryos,
        frozenEmbryoDetails: form.frozenEmbryoDetails,
        usingEggDonor: form.usingEggDonor,
        usingSpermDonor: form.usingSpermDonor,
        wantsConsultation: form.wantsConsultation,
        hearAboutUs: form.hearAboutUs,
        answers: merged,
      }))
      setEditing(false)
    } catch (err) {
      alert('Failed to save: ' + (err.message || ''))
    } finally { setSaving(false) }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  if (!hasMatch) return null

  return (
    <Card className="rounded-2xl">
      <CardHeader className={editing ? 'flex flex-row items-center justify-between' : 'cursor-pointer select-none'}>
        <div>
          <CardTitle className="text-base">Intake Answers</CardTitle>
          <p className="text-xs text-muted-foreground">Answers from the intake form submission</p>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
            </Button>
          </div>
        ) : (
          <CardAction>
            <Button variant="ghost" size="sm" className="gap-1" onClick={startEdit}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTAKE_FIELDS.map(f => {
              if (f.type === 'yesno') return (
                <div key={f.key} className="space-y-1">
                  <FieldLabel>{f.label}</FieldLabel>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button type="button" onClick={() => set(f.key, true)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${form[f.key] === true || form[f.key] === 'yes' ? 'bg-[#283693] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>Yes</button>
                    <button type="button" onClick={() => set(f.key, false)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${form[f.key] === false || form[f.key] === 'no' ? 'bg-[#283693] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>No</button>
                  </div>
                </div>
              )
              if (f.type === 'select') return (
                <div key={f.key} className="space-y-1">
                  <FieldLabel>{f.label}</FieldLabel>
                  <SelectField value={form[f.key]} onValueChange={v => set(f.key, v)} options={f.options} />
                </div>
              )
              return (
                <div key={f.key} className="space-y-1">
                  <FieldLabel>{f.label}</FieldLabel>
                  <Input type={f.type || 'text'} value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTAKE_FIELDS.map(f => {
              const val = a[f.key]
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

// ── Contact Information (IP1 + IP2) ─────────────────────
function ContactInfoSection({ ip, setIp, search }) {
  const a = ip.answers || {}
  const hasPartner = a.hasPartner === 'yes' || a.hasPartner === true

  const allLabels = ['first name', 'last name', 'email', 'phone', 'date of birth', 'country', 'street', 'city', 'state', 'zip', 'employer', 'job position', 'contact', 'address', 'work phone', 'home phone', 'cell phone']
  const hasMatch = search ? allLabels.some(l => l.includes(search)) : true

  const { editing, saving, form, set, setForm, startEdit, handleSave, cancel } = useFormSection(
    ip.id, a, '_ipContact',
    (saved) => ({
      // IP1
      ip1FirstName: saved.ip1FirstName || a.primaryFirstName || '',
      ip1LastName: saved.ip1LastName || a.primaryLastName || '',
      ip1Email: saved.ip1Email || a.email || ip.email || '',
      ip1HomePhone: saved.ip1HomePhone || '',
      ip1CellPhone: saved.ip1CellPhone || a.phone || ip.phone || '',
      ip1WorkPhone: saved.ip1WorkPhone || '',
      ip1Dob: saved.ip1Dob || a.primaryDob || '',
      ip1Country: saved.ip1Country || a.country || 'United States',
      ip1Street: saved.ip1Street || a.street || '',
      ip1Street2: saved.ip1Street2 || a.street2 || '',
      ip1City: saved.ip1City || a.city || '',
      ip1State: saved.ip1State || a.stateProv || '',
      ip1Zip: saved.ip1Zip || a.zipCode || '',
      ip1Employer: saved.ip1Employer || '',
      ip1EmployerAddress: saved.ip1EmployerAddress || '',
      ip1EmployerPhone: saved.ip1EmployerPhone || '',
      ip1JobPosition: saved.ip1JobPosition || '',
      // IP2
      ip2FirstName: saved.ip2FirstName || a.ip2FirstName || '',
      ip2LastName: saved.ip2LastName || a.ip2LastName || '',
      ip2Email: saved.ip2Email || a.ip2Email || '',
      ip2HomePhone: saved.ip2HomePhone || '',
      ip2CellPhone: saved.ip2CellPhone || a.ip2Phone || '',
      ip2WorkPhone: saved.ip2WorkPhone || '',
      ip2Dob: saved.ip2Dob || a.ip2Dob || '',
      ip2Employer: saved.ip2Employer || '',
      ip2EmployerAddress: saved.ip2EmployerAddress || '',
      ip2EmployerPhone: saved.ip2EmployerPhone || '',
      ip2JobPosition: saved.ip2JobPosition || '',
    })
  )

  if (!hasMatch) return null

  const ip1Fields = [
    ['ip1FirstName', 'First Name'], ['ip1LastName', 'Last Name'], ['ip1Email', 'Email', 'email'],
    ['ip1HomePhone', 'Home Phone', 'tel'], ['ip1CellPhone', 'Cell Phone', 'tel'], ['ip1WorkPhone', 'Work Phone', 'tel'],
    ['ip1Dob', 'Date of Birth', 'date'], ['ip1Country', 'Country'],
    ['ip1Street', 'Street Address'], ['ip1Street2', 'Street Address Line 2'],
    ['ip1City', 'City'], ['ip1State', 'State/Province', 'select'], ['ip1Zip', 'Zip Code'],
    ['ip1Employer', 'Employer Name'], ['ip1EmployerAddress', 'Employer Address'],
    ['ip1EmployerPhone', 'Employer Phone', 'tel'], ['ip1JobPosition', 'Job Position'],
  ]

  const ip2Fields = [
    ['ip2FirstName', 'First Name'], ['ip2LastName', 'Last Name'], ['ip2Email', 'Email', 'email'],
    ['ip2HomePhone', 'Home Phone', 'tel'], ['ip2CellPhone', 'Cell Phone', 'tel'], ['ip2WorkPhone', 'Work Phone', 'tel'],
    ['ip2Dob', 'Date of Birth', 'date'],
    ['ip2Employer', 'Employer Name'], ['ip2EmployerAddress', 'Employer Address'],
    ['ip2EmployerPhone', 'Employer Phone', 'tel'], ['ip2JobPosition', 'Job Position'],
  ]

  function renderField([key, label, type]) {
    const stored = (a._ipContact || {})[key] || ''
    if (editing) {
      if (type === 'select') return <div key={key} className="space-y-1"><FieldLabel>{label}</FieldLabel><SelectField value={form[key]} onValueChange={v => set(key, v)} options={US_STATES} /></div>
      return <div key={key} className="space-y-1"><FieldLabel>{label}</FieldLabel><Input type={type || 'text'} value={form[key] || ''} onChange={e => set(key, e.target.value)} /></div>
    }
    return <ReadField key={key} label={label} value={stored} />
  }

  async function saveAndSync() {
    await handleSave((updatedAnswers) => {
      // Sync key fields back to parent IP state
      const c = updatedAnswers._ipContact || {}
      const ip1Name = `${c.ip1FirstName || ''} ${c.ip1LastName || ''}`.trim()
      const ip2Name = hasPartner ? `${c.ip2FirstName || ''} ${c.ip2LastName || ''}`.trim() : ''
      setIp(prev => ({
        ...prev,
        ip1Name: ip1Name || prev.ip1Name,
        ip2Name: ip2Name || prev.ip2Name,
        names: ip2Name ? `${ip1Name} & ${ip2Name}` : ip1Name || prev.names,
        email: c.ip1Email || prev.email,
        phone: c.ip1CellPhone || prev.phone,
        ip2Email: c.ip2Email || prev.ip2Email,
        ip2Phone: c.ip2CellPhone || prev.ip2Phone,
        location: [c.ip1City, c.ip1State].filter(Boolean).join(', ') || prev.location,
        answers: updatedAnswers,
      }))
    })
  }

  return (
    <Card className="rounded-2xl">
      <EditHeader title="Contact Information" description="IP1 and IP2 contact details, address, and employment" editing={editing} saving={saving} startEdit={startEdit} handleSave={saveAndSync} cancel={cancel} />
      <CardContent className="space-y-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Intended Parent 1</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ip1Fields.map(renderField)}
          </div>
        </div>
        {hasPartner && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Intended Parent 2</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ip2Fields.map(renderField)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Clinic Information ──────────────────────────────────
function ClinicSection({ ip, setIp, search }) {
  const a = ip.answers || {}
  const hasMatch = search ? ['clinic', 'reproductive', 'doctor', 're '].some(k => search.includes(k)) : true

  const { editing, saving, form, set, startEdit, handleSave, cancel } = useFormSection(
    ip.id, a, '_ipClinic',
    (saved) => ({
      clinicName: saved.clinicName || a.reDoctorName || '',
      doctorName: saved.doctorName || '',
      clinicPhone: saved.clinicPhone || '',
    })
  )

  if (!hasMatch) return null

  async function saveAndSync() {
    await handleSave((updatedAnswers) => {
      const c = updatedAnswers._ipClinic || {}
      setIp(prev => ({
        ...prev,
        reDoctorName: c.doctorName || c.clinicName || prev.reDoctorName,
        hasRE: !!(c.clinicName || c.doctorName) || prev.hasRE,
        answers: updatedAnswers,
      }))
    })
  }

  const stored = a._ipClinic || {}

  return (
    <Card className="rounded-2xl">
      <EditHeader title="Clinic Information" description="Reproductive clinic and doctor details" editing={editing} saving={saving} startEdit={startEdit} handleSave={saveAndSync} cancel={cancel} />
      <CardContent>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1"><FieldLabel>Reproductive Clinic Name</FieldLabel><Input value={form.clinicName} onChange={e => set('clinicName', e.target.value)} /></div>
            <div className="space-y-1"><FieldLabel>Reproductive Doctor's Name</FieldLabel><Input value={form.doctorName} onChange={e => set('doctorName', e.target.value)} /></div>
            <div className="space-y-1"><FieldLabel>Reproductive Clinic Phone</FieldLabel><Input type="tel" value={form.clinicPhone} onChange={e => set('clinicPhone', e.target.value)} /></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ReadField label="Reproductive Clinic Name" value={stored.clinicName} />
            <ReadField label="Reproductive Doctor's Name" value={stored.doctorName} />
            <ReadField label="Reproductive Clinic Phone" value={stored.clinicPhone} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Personal References ─────────────────────────────────
function ReferencesSection({ ip, setIp, search }) {
  const a = ip.answers || {}
  const REFS = [
    { key: 'ref1', title: 'Reference #1' },
    { key: 'ref2', title: 'Reference #2' },
    { key: 'ref3', title: 'Reference #3' },
  ]
  const refFields = ['name', 'phone', 'email', 'cityState', 'relationship']
  const refLabels = { name: 'Name', phone: 'Phone Number', email: 'Email Address', cityState: 'City, State', relationship: 'Relationship' }

  const allLabels = REFS.flatMap(r => refFields.map(f => `${r.title} ${refLabels[f]}`))
  const hasMatch = search ? allLabels.some(l => l.toLowerCase().includes(search)) || 'reference'.includes(search) : true

  const { editing, saving, form, setForm, startEdit, handleSave, cancel } = useFormSection(
    ip.id, a, '_ipReferences',
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

  const stored = a._ipReferences || {}

  return (
    <Card className="rounded-2xl">
      <EditHeader title="Personal References" description="Three references, including at least one doctor who has treated infertility. All references must know both IPs." editing={editing} saving={saving} startEdit={startEdit} handleSave={() => handleSave((ua) => setIp(prev => ({ ...prev, answers: ua })))} cancel={cancel} />
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

// ── Main Export ──────────────────────────────────────────
export default function IPApplicationTab({ ip, setIp }) {
  const [search, setSearch] = useState('')
  const searchLower = search.toLowerCase().trim()

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search questions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <IntakeAnswersSection ip={ip} setIp={setIp} search={searchLower} />
      <ContactInfoSection ip={ip} setIp={setIp} search={searchLower} />
      <ClinicSection ip={ip} setIp={setIp} search={searchLower} />
      <ReferencesSection ip={ip} setIp={setIp} search={searchLower} />

      {/* Background Waivers */}
      {(!searchLower || 'background waiver'.includes(searchLower)) && (() => {
        const a = ip?.answers || {}
        const ip1Name = `${a.primaryFirstName || ''} ${a.primaryLastName || ''}`.trim()
        const ip2Name = (a.hasPartner === true || a.hasPartner === 'yes') ? `${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim() : ''
        // For SendFormTemplateButton, pass the IP as "surrogate" (it just needs .id, .name, .email)
        const ip1AsSurrogate = { id: ip.id, name: ip1Name || ip.names, email: ip.email }
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-4 text-[#283693]" /> Background Waivers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <SendFormTemplateButton templateId="ip_background_waiver" surrogate={ip1AsSurrogate} />
              {ip2Name && ip.ip2Email && (
                <SendFormTemplateButton templateId="ip2_background_waiver"
                  surrogate={{ id: ip.id, name: ip2Name, email: ip.ip2Email }}
                />
              )}
            </CardContent>
          </Card>
        )
      })()}
    </div>
  )
}

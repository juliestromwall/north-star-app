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

// ── Contact Information (matches IP-side _ipContact shape) ──
function ContactInfoSection({ ip, setIp, search }) {
  const a = ip.answers || {}
  const hasPartner = a.hasPartner === 'yes' || a.hasPartner === true
  const isUS = !a._ipContact?.country || a._ipContact?.country?.toLowerCase().includes('united states')

  const allLabels = ['first name', 'last name', 'email', 'phone', 'date of birth', 'country', 'street', 'city', 'state', 'zip', 'province', 'postal', 'preferred contact', 'address']
  const hasMatch = search ? allLabels.some(l => l.includes(search)) : true

  const { editing, saving, form, set, startEdit, handleSave, cancel } = useFormSection(
    ip.id, a, '_ipContact',
    (saved) => ({
      ip1FirstName: saved.ip1FirstName || a.primaryFirstName || '',
      ip1LastName: saved.ip1LastName || a.primaryLastName || '',
      ip1Dob: saved.ip1Dob || a.primaryDob || '',
      ip1Email: saved.ip1Email || a.email || ip.email || '',
      ip1Phone: saved.ip1Phone || a.phone || ip.phone || '',
      ip2FirstName: saved.ip2FirstName || a.ip2FirstName || '',
      ip2LastName: saved.ip2LastName || a.ip2LastName || '',
      ip2Dob: saved.ip2Dob || a.ip2Dob || '',
      ip2Email: saved.ip2Email || a.ip2Email || '',
      ip2Phone: saved.ip2Phone || a.ip2Phone || '',
      country: saved.country || a.country || 'United States',
      street: saved.street || a.street || '',
      city: saved.city || a.city || '',
      state: saved.state || a.stateProv || '',
      zipCode: saved.zipCode || a.zipCode || '',
      preferredContact: saved.preferredContact || '',
    })
  )

  if (!hasMatch) return null

  const formIsUS = !form.country || form.country?.toLowerCase().includes('united states')
  const stored = a._ipContact || {}

  function readVal(k) { return stored[k] || '' }

  async function saveAndSync() {
    await handleSave((updatedAnswers) => {
      const c = updatedAnswers._ipContact || {}
      const ip1Name = `${c.ip1FirstName || ''} ${c.ip1LastName || ''}`.trim()
      const ip2Name = hasPartner ? `${c.ip2FirstName || ''} ${c.ip2LastName || ''}`.trim() : ''
      setIp(prev => ({
        ...prev,
        ip1Name: ip1Name || prev.ip1Name,
        ip2Name: ip2Name || prev.ip2Name,
        names: ip2Name ? `${ip1Name} & ${ip2Name}` : ip1Name || prev.names,
        email: c.ip1Email || prev.email,
        phone: c.ip1Phone || prev.phone,
        ip2Email: c.ip2Email || prev.ip2Email,
        ip2Phone: c.ip2Phone || prev.ip2Phone,
        location: [c.city, c.state].filter(Boolean).join(', ') || prev.location,
        answers: updatedAnswers,
      }))
    })
  }

  const renderPersonFields = (prefix, label) => (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{label}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[['FirstName','First Name'],['LastName','Last Name'],['Dob','Date of Birth','date'],['Email','Email','email'],['Phone','Phone','tel']].map(([k,l,t]) => (
          editing
            ? <div key={`${prefix}${k}`} className="space-y-1"><FieldLabel>{l}</FieldLabel><Input type={t || 'text'} value={form[`${prefix}${k}`] || ''} onChange={e => set(`${prefix}${k}`, e.target.value)} /></div>
            : <ReadField key={`${prefix}${k}`} label={l} value={readVal(`${prefix}${k}`)} />
        ))}
      </div>
    </div>
  )

  return (
    <Card className="rounded-2xl">
      <EditHeader title="Contact Information" description="What the IP entered on /my-application" editing={editing} saving={saving} startEdit={startEdit} handleSave={saveAndSync} cancel={cancel} />
      <CardContent className="space-y-6">
        {renderPersonFields('ip1', 'Intended Parent 1')}
        {hasPartner && renderPersonFields('ip2', 'Intended Parent 2')}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Home Address</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {editing ? (
              <>
                <div className="space-y-1"><FieldLabel>Country</FieldLabel><Input value={form.country || ''} onChange={e => set('country', e.target.value)} placeholder="United States" /></div>
                <div className="space-y-1 sm:col-span-2"><FieldLabel>Street Address</FieldLabel><Input value={form.street || ''} onChange={e => set('street', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>City</FieldLabel><Input value={form.city || ''} onChange={e => set('city', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>{formIsUS ? 'State' : 'State / Province / Region'}</FieldLabel>
                  {formIsUS
                    ? <SelectField value={form.state} onValueChange={v => set('state', v)} options={US_STATES} />
                    : <Input value={form.state || ''} onChange={e => set('state', e.target.value)} placeholder="Province / Region" />
                  }
                </div>
                <div className="space-y-1"><FieldLabel>{formIsUS ? 'Zip Code' : 'Postal Code'}</FieldLabel><Input value={form.zipCode || ''} onChange={e => set('zipCode', e.target.value)} /></div>
              </>
            ) : (
              <>
                <ReadField label="Country" value={readVal('country')} />
                <ReadField label="Street Address" value={readVal('street')} />
                <ReadField label="City" value={readVal('city')} />
                <ReadField label={isUS ? 'State' : 'State / Province / Region'} value={readVal('state')} />
                <ReadField label={isUS ? 'Zip Code' : 'Postal Code'} value={readVal('zipCode')} />
              </>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Preferences</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {editing
              ? <div className="space-y-1"><FieldLabel>Preferred Contact Method</FieldLabel>
                  <SelectField value={form.preferredContact} onValueChange={v => set('preferredContact', v)} options={['Email','Phone','Text']} />
                </div>
              : <ReadField label="Preferred Contact Method" value={readVal('preferredContact')} />
            }
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Clinic Information (matches IP-side _ipClinic shape) ──
function ClinicSection({ ip, setIp, search }) {
  const a = ip.answers || {}
  const hasMatch = search ? ['clinic', 'reproductive', 'doctor', 're ', 'embryo', 'donor', 'nurse'].some(k => search.includes(k)) : true

  const { editing, saving, form, set, startEdit, handleSave, cancel } = useFormSection(
    ip.id, a, '_ipClinic',
    (saved) => ({
      clinicName: saved.clinicName || '',
      clinicStreet: saved.clinicStreet || '',
      clinicCity: saved.clinicCity || '',
      clinicState: saved.clinicState || '',
      clinicZip: saved.clinicZip || '',
      clinicPhone: saved.clinicPhone || '',
      reDoctorName: saved.reDoctorName || a.reDoctorName || saved.doctorName || '',
      reDoctorEmail: saved.reDoctorEmail || '',
      reDoctorPhone: saved.reDoctorPhone || '',
      nurseCoordinator: saved.nurseCoordinator || '',
      embryoCount: saved.embryoCount || '',
      embryosTested: saved.embryosTested || '',
      usingEggDonor: saved.usingEggDonor || (a.usingEggDonor === true ? 'yes' : a.usingEggDonor === false ? 'no' : ''),
      usingSpermDonor: saved.usingSpermDonor || (a.usingSpermDonor === true ? 'yes' : a.usingSpermDonor === false ? 'no' : ''),
    })
  )

  if (!hasMatch) return null

  async function saveAndSync() {
    await handleSave((updatedAnswers) => {
      const c = updatedAnswers._ipClinic || {}
      setIp(prev => ({
        ...prev,
        reDoctorName: c.reDoctorName || prev.reDoctorName,
        hasRE: !!(c.clinicName || c.reDoctorName) || prev.hasRE,
        answers: updatedAnswers,
      }))
    })
  }

  const stored = a._ipClinic || {}
  function R(k) { return stored[k] || '' }

  const ynLabel = (v) => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v === 'undecided' ? 'Undecided' : '—'

  return (
    <Card className="rounded-2xl">
      <EditHeader title="Clinic Information" description="What the IP entered on /my-application" editing={editing} saving={saving} startEdit={startEdit} handleSave={saveAndSync} cancel={cancel} />
      <CardContent className="space-y-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Fertility Clinic</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {editing ? (
              <>
                <div className="space-y-1 sm:col-span-2"><FieldLabel>Clinic Name</FieldLabel><Input value={form.clinicName || ''} onChange={e => set('clinicName', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>Clinic Phone</FieldLabel><Input type="tel" value={form.clinicPhone || ''} onChange={e => set('clinicPhone', e.target.value)} /></div>
                <div className="space-y-1 sm:col-span-2"><FieldLabel>Street Address</FieldLabel><Input value={form.clinicStreet || ''} onChange={e => set('clinicStreet', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>City</FieldLabel><Input value={form.clinicCity || ''} onChange={e => set('clinicCity', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>State</FieldLabel><SelectField value={form.clinicState} onValueChange={v => set('clinicState', v)} options={US_STATES} /></div>
                <div className="space-y-1"><FieldLabel>Zip</FieldLabel><Input value={form.clinicZip || ''} onChange={e => set('clinicZip', e.target.value)} /></div>
              </>
            ) : (
              <>
                <ReadField label="Clinic Name" value={R('clinicName')} />
                <ReadField label="Clinic Phone" value={R('clinicPhone')} />
                <ReadField label="Street Address" value={R('clinicStreet')} />
                <ReadField label="City" value={R('clinicCity')} />
                <ReadField label="State" value={R('clinicState')} />
                <ReadField label="Zip" value={R('clinicZip')} />
              </>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Reproductive Endocrinologist</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {editing ? (
              <>
                <div className="space-y-1"><FieldLabel>Doctor Name</FieldLabel><Input value={form.reDoctorName || ''} onChange={e => set('reDoctorName', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>Email</FieldLabel><Input type="email" value={form.reDoctorEmail || ''} onChange={e => set('reDoctorEmail', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" value={form.reDoctorPhone || ''} onChange={e => set('reDoctorPhone', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>Nurse Coordinator</FieldLabel><Input value={form.nurseCoordinator || ''} onChange={e => set('nurseCoordinator', e.target.value)} /></div>
              </>
            ) : (
              <>
                <ReadField label="Doctor Name" value={R('reDoctorName')} />
                <ReadField label="Email" value={R('reDoctorEmail')} />
                <ReadField label="Phone" value={R('reDoctorPhone')} />
                <ReadField label="Nurse Coordinator" value={R('nurseCoordinator')} />
              </>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Embryos</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {editing ? (
              <>
                <div className="space-y-1"><FieldLabel>How Many Embryos?</FieldLabel><Input value={form.embryoCount || ''} onChange={e => set('embryoCount', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>Genetically Tested?</FieldLabel><SelectField value={form.embryosTested} onValueChange={v => set('embryosTested', v)} options={['yes','no','undecided']} /></div>
                <div className="space-y-1"><FieldLabel>Using Egg Donor?</FieldLabel><SelectField value={form.usingEggDonor} onValueChange={v => set('usingEggDonor', v)} options={['yes','no','undecided']} /></div>
                <div className="space-y-1"><FieldLabel>Using Sperm Donor?</FieldLabel><SelectField value={form.usingSpermDonor} onValueChange={v => set('usingSpermDonor', v)} options={['yes','no','undecided']} /></div>
              </>
            ) : (
              <>
                <ReadField label="How Many Embryos?" value={R('embryoCount')} />
                <ReadField label="Genetically Tested?" value={ynLabel(R('embryosTested'))} />
                <ReadField label="Using Egg Donor?" value={ynLabel(R('usingEggDonor'))} />
                <ReadField label="Using Sperm Donor?" value={ynLabel(R('usingSpermDonor'))} />
              </>
            )}
          </div>
        </div>
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
    ip.id, a, '_references',
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

  const stored = a._references || {}

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

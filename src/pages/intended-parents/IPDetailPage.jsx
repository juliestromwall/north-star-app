import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Mail, Phone, MapPin, Users, Baby, Stethoscope,
  Calendar, ClipboardList, Copy, Check, MessageSquare, Heart, UserCog, Egg,
  Pencil, Save, Loader2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import InfoRow from '@/components/shared/InfoRow'
import EmptyState from '@/components/shared/EmptyState'
import IPProfileTab from '@/components/intended-parents/IPProfileTab'
import { useRole } from '@/context/RoleContext'
import { fetchIPsFromIntake, updateIntakeSubmission, assignSurrogateToAdmin } from '@/lib/db'
import { mockUsers } from '@/data/mock/users'

const ADMIN_STAFF = mockUsers.filter(u => ['super_admin', 'master_admin', 'admin'].includes(u.role))

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

const MARITAL_OPTIONS = ['Single', 'In a Relationship', 'Married', 'Domestic Partnership', 'Divorced', 'Separated', 'Widowed']

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  if (!text) return null
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="text-stone-400 hover:text-stone-600 ml-1">
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
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

function boolLabel(val, yesText = 'Yes', noText = 'No') {
  if (val === true || val === 'yes' || val === 'Yes') return yesText
  if (val === false || val === 'no' || val === 'No') return noText
  return '—'
}

function YesNoButtons({ value, onChange }) {
  const isYes = value === true || value === 'yes'
  const isNo = value === false || value === 'no'
  return (
    <div className="flex items-center gap-2 pt-0.5">
      <button type="button" onClick={() => onChange(true)}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${isYes ? 'bg-[#283693] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
        Yes
      </button>
      <button type="button" onClick={() => onChange(false)}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${isNo ? 'bg-[#283693] text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
        No
      </button>
    </div>
  )
}

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

// ── Contact Tab ─────────────────────────────────────────
function ContactTab({ ip, setIp }) {
  const a = ip.answers || {}
  const hasPartner = a.hasPartner === 'yes' || a.hasPartner === true
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})

  function startEdit() {
    setForm({
      primaryFirstName: a.primaryFirstName || '',
      primaryLastName: a.primaryLastName || '',
      email: a.email || ip.email || '',
      phone: a.phone || ip.phone || '',
      primaryDob: a.primaryDob || '',
      country: a.country || 'United States',
      street: a.street || '',
      street2: a.street2 || '',
      city: a.city || '',
      stateProv: a.stateProv || '',
      zipCode: a.zipCode || '',
      maritalStatus: a.maritalStatus || '',
      hasPartner: hasPartner,
      ip2FirstName: a.ip2FirstName || '',
      ip2LastName: a.ip2LastName || '',
      ip2Email: a.ip2Email || '',
      ip2Phone: a.ip2Phone || '',
      ip2Dob: a.ip2Dob || '',
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updatedAnswers = {
        ...a,
        ...form,
        hasPartner: form.hasPartner ? 'yes' : 'no',
      }
      const ip1Name = `${form.primaryFirstName} ${form.primaryLastName}`.trim()
      const ip2Name = form.hasPartner ? `${form.ip2FirstName} ${form.ip2LastName}`.trim() : ''
      const displayName = ip2Name ? `${ip1Name} & ${ip2Name}` : ip1Name

      await updateIntakeSubmission(ip.id, {
        applicant_name: displayName,
        applicant_email: form.email.trim().toLowerCase(),
        applicant_phone: form.phone,
        answers: updatedAnswers,
        state_region: form.stateProv,
      })

      setIp(prev => ({
        ...prev,
        names: displayName,
        ip1Name,
        ip2Name: ip2Name || null,
        email: form.email,
        ip2Email: form.ip2Email,
        phone: form.phone,
        ip2Phone: form.ip2Phone,
        location: [form.city, form.stateProv].filter(Boolean).join(', '),
        type: form.hasPartner ? 'Couple' : 'Single parent',
        answers: updatedAnswers,
      }))
      setEditing(false)
    } catch {} finally { setSaving(false) }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  if (editing) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Contact & Details</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* IP1 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Intended Parent 1</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1"><FieldLabel>First Name</FieldLabel><Input value={form.primaryFirstName} onChange={e => set('primaryFirstName', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>Last Name</FieldLabel><Input value={form.primaryLastName} onChange={e => set('primaryLastName', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>Date of Birth</FieldLabel><Input type="date" value={form.primaryDob} onChange={e => set('primaryDob', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>Email</FieldLabel><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>Marital Status</FieldLabel><SelectField value={form.maritalStatus} onValueChange={v => set('maritalStatus', v)} options={MARITAL_OPTIONS} /></div>
            </div>
          </div>

          {/* Partner toggle + IP2 */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Has a Partner?</p>
              <p className="text-xs text-muted-foreground">Going through the journey with someone</p>
            </div>
            <Switch checked={form.hasPartner} onCheckedChange={v => set('hasPartner', v)} />
          </div>

          {form.hasPartner && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Intended Parent 2</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1"><FieldLabel>First Name</FieldLabel><Input value={form.ip2FirstName} onChange={e => set('ip2FirstName', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>Last Name</FieldLabel><Input value={form.ip2LastName} onChange={e => set('ip2LastName', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>Date of Birth</FieldLabel><Input type="date" value={form.ip2Dob} onChange={e => set('ip2Dob', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>Email</FieldLabel><Input type="email" value={form.ip2Email} onChange={e => set('ip2Email', e.target.value)} /></div>
                <div className="space-y-1"><FieldLabel>Phone</FieldLabel><Input type="tel" value={form.ip2Phone} onChange={e => set('ip2Phone', e.target.value)} /></div>
              </div>
            </div>
          )}

          {/* Address */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Address</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1"><FieldLabel>Street</FieldLabel><Input value={form.street} onChange={e => set('street', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>Street 2</FieldLabel><Input value={form.street2} onChange={e => set('street2', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>City</FieldLabel><Input value={form.city} onChange={e => set('city', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>State</FieldLabel><SelectField value={form.stateProv} onValueChange={v => set('stateProv', v)} options={US_STATES} /></div>
              <div className="space-y-1"><FieldLabel>Zip Code</FieldLabel><Input value={form.zipCode} onChange={e => set('zipCode', e.target.value)} /></div>
              <div className="space-y-1"><FieldLabel>Country</FieldLabel><Input value={form.country} onChange={e => set('country', e.target.value)} /></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Read-only view
  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Contact & Details</CardTitle>
        <Button variant="ghost" size="sm" className="gap-1" onClick={startEdit}>
          <Pencil className="size-3.5" /> Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Intended Parent 1</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReadField label="Name" value={ip.ip1Name} />
            <ReadField label="Date of Birth" value={a.primaryDob} />
            <div className="flex items-center gap-1"><div className="flex-1"><ReadField label="Email" value={ip.email} /></div><CopyButton text={ip.email} /></div>
            <div className="flex items-center gap-1"><div className="flex-1"><ReadField label="Phone" value={ip.phone} /></div><CopyButton text={ip.phone} /></div>
            <ReadField label="Marital Status" value={a.maritalStatus || '—'} />
          </div>
        </div>

        {hasPartner && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Intended Parent 2</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ReadField label="Name" value={ip.ip2Name} />
              <ReadField label="Date of Birth" value={a.ip2Dob} />
              <div className="flex items-center gap-1"><div className="flex-1"><ReadField label="Email" value={ip.ip2Email} /></div><CopyButton text={ip.ip2Email} /></div>
              <div className="flex items-center gap-1"><div className="flex-1"><ReadField label="Phone" value={ip.ip2Phone} /></div><CopyButton text={ip.ip2Phone} /></div>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Address</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReadField label="Street" value={[a.street, a.street2].filter(Boolean).join(', ')} />
            <ReadField label="City / State / Zip" value={[a.city, a.stateProv, a.zipCode].filter(Boolean).join(', ')} />
            {a.country && a.country !== 'United States' && <ReadField label="Country" value={a.country} />}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Intake Form Tab ─────────────────────────────────────
function IntakeFormTab({ ip, setIp }) {
  const a = ip.answers || {}
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})

  function startEdit() {
    setForm({
      hasRE: a.hasRE ?? null,
      reDoctorName: a.reDoctorName || '',
      hasFrozenEmbryos: a.hasFrozenEmbryos ?? null,
      frozenEmbryoDetails: a.frozenEmbryoDetails || '',
      usingEggDonor: a.usingEggDonor ?? null,
      usingSpermDonor: a.usingSpermDonor ?? null,
      wantsConsultation: a.wantsConsultation ?? null,
      hearAboutUs: a.hearAboutUs || '',
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updatedAnswers = { ...a, ...form }
      await updateIntakeSubmission(ip.id, { answers: updatedAnswers })
      setIp(prev => ({
        ...prev,
        hasRE: form.hasRE,
        reDoctorName: form.reDoctorName,
        hasFrozenEmbryos: form.hasFrozenEmbryos,
        frozenEmbryoDetails: form.frozenEmbryoDetails,
        usingEggDonor: form.usingEggDonor,
        usingSpermDonor: form.usingSpermDonor,
        wantsConsultation: form.wantsConsultation,
        hearAboutUs: form.hearAboutUs,
        answers: updatedAnswers,
      }))
      setEditing(false)
    } catch {} finally { setSaving(false) }
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  if (editing) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Intake Form</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Fertility Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1"><FieldLabel>Has RE Doctor?</FieldLabel><YesNoButtons value={form.hasRE} onChange={v => set('hasRE', v)} /></div>
              {form.hasRE && <div className="space-y-1"><FieldLabel>RE Doctor / Clinic Name</FieldLabel><Input value={form.reDoctorName} onChange={e => set('reDoctorName', e.target.value)} /></div>}
              <div className="space-y-1"><FieldLabel>Has Frozen Embryos?</FieldLabel><YesNoButtons value={form.hasFrozenEmbryos} onChange={v => set('hasFrozenEmbryos', v)} /></div>
              {form.hasFrozenEmbryos && <div className="space-y-1"><FieldLabel>Embryo Details</FieldLabel><Input value={form.frozenEmbryoDetails} onChange={e => set('frozenEmbryoDetails', e.target.value)} placeholder="Number of embryos, clinic, etc." /></div>}
              <div className="space-y-1"><FieldLabel>Using Egg Donor?</FieldLabel><YesNoButtons value={form.usingEggDonor} onChange={v => set('usingEggDonor', v)} /></div>
              <div className="space-y-1"><FieldLabel>Using Sperm Donor?</FieldLabel><YesNoButtons value={form.usingSpermDonor} onChange={v => set('usingSpermDonor', v)} /></div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Other</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1"><FieldLabel>Wants Consultation?</FieldLabel><YesNoButtons value={form.wantsConsultation} onChange={v => set('wantsConsultation', v)} /></div>
              <div className="space-y-1"><FieldLabel>How did you hear about us?</FieldLabel><Textarea value={form.hearAboutUs} onChange={e => set('hearAboutUs', e.target.value)} rows={2} className="bg-white" /></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Intake Form</CardTitle>
        <Button variant="ghost" size="sm" className="gap-1" onClick={startEdit}>
          <Pencil className="size-3.5" /> Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Fertility Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReadField label="Has RE Doctor" value={boolLabel(ip.hasRE)} />
            {ip.hasRE && ip.reDoctorName && <ReadField label="RE Doctor / Clinic" value={ip.reDoctorName} />}
            <ReadField label="Frozen Embryos" value={boolLabel(ip.hasFrozenEmbryos)} />
            {ip.hasFrozenEmbryos && ip.frozenEmbryoDetails && <ReadField label="Embryo Details" value={ip.frozenEmbryoDetails} />}
            <ReadField label="Using Egg Donor" value={boolLabel(ip.usingEggDonor)} />
            <ReadField label="Using Sperm Donor" value={boolLabel(ip.usingSpermDonor)} />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Other</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReadField label="Wants Consultation" value={boolLabel(ip.wantsConsultation, 'Yes', 'Not right now')} />
            <ReadField label="How They Heard" value={ip.hearAboutUs || '—'} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Page ───────────────────────────────────────────
export default function IPDetailPage() {
  const { id } = useParams()
  const { currentUser } = useRole()
  const [ip, setIp] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchIPsFromIntake().then(all => {
      const found = all.find(item => String(item.id) === String(id))
      setIp(found || null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="text-center py-12 text-stone-400">Loading...</div>
  }

  if (!ip) {
    return (
      <div className="space-y-6">
        <Link to="/intended-parents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Intended Parents
        </Link>
        <EmptyState title="Intended Parent not found" description="This case doesn't exist." />
      </div>
    )
  }

  const a = ip.answers || {}
  const hasPartner = a.hasPartner === 'yes' || a.hasPartner === true

  return (
    <div className="space-y-6">
      <Link to="/intended-parents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Intended Parents
      </Link>

      {/* ─── Hero Section ─────────────────────────────────── */}
      <div className="rounded-2xl border border-stone-200/80 bg-white">
        <div className="p-6 space-y-6">
          {/* Name row */}
          <div className="flex flex-col sm:flex-row items-start gap-5">
            <ProfileAvatar name={ip.names} size="xl" className="ring-4 ring-white shadow-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-heading font-bold text-stone-900">{ip.names}</h1>
                <Badge variant="outline" className="text-xs bg-sky-100 text-sky-800 border-sky-200">
                  {ip.type}
                </Badge>
                <span className="text-xs font-medium text-stone-400 capitalize">{ip.status?.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-stone-500">
                {ip.location && (
                  <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {ip.location}{ip.country && ip.country !== 'United States' ? `, ${ip.country}` : ''}</span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5" />
                  Submitted {new Date(ip.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              {/* Assignment */}
              <div className="flex items-center gap-1.5 mt-2">
                <UserCog className="size-3.5 text-stone-400" />
                <span className="text-xs text-stone-400">Assigned to</span>
                <SelectUI
                  value={ip.assignedTo || '_unassigned'}
                  onValueChange={async val => {
                    const email = val === '_unassigned' ? null : val
                    await assignSurrogateToAdmin(ip.id, email).catch(() => {})
                    setIp(prev => ({ ...prev, assignedTo: email }))
                  }}
                >
                  <SelectTriggerUI className="h-7 text-xs font-semibold border-none shadow-none px-1 w-auto min-w-24 text-[#283693]">
                    <SelectValueUI />
                  </SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="_unassigned">Unassigned</SelectItemUI>
                    {ADMIN_STAFF.map(s => (
                      <SelectItemUI key={s.email} value={s.email}>{s.name}</SelectItemUI>
                    ))}
                  </SelectContentUI>
                </SelectUI>
              </div>
            </div>

            {/* Contact buttons */}
            <div className="flex gap-2 shrink-0">
              {ip.phone && (
                <Button size="sm" className="gap-1.5" asChild>
                  <a href={`sms:${ip.phone}`}><MessageSquare className="size-3.5" /> Text</a>
                </Button>
              )}
              {ip.email && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`mailto:${ip.email}`}><Mail className="size-3.5" /> Email</a>
                </Button>
              )}
              {ip.phone && (
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={`tel:${ip.phone}`}><Phone className="size-3.5" /> Call</a>
                </Button>
              )}
            </div>
          </div>

          {/* Info tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { icon: Users, label: 'Type', value: ip.type || '—' },
              { icon: Heart, label: 'Relationship', value: a.maritalStatus || '—' },
              { icon: Stethoscope, label: 'RE Doctor', value: ip.hasRE ? (ip.reDoctorName || 'Yes') : '—' },
              { icon: Baby, label: 'Embryos', value: ip.hasFrozenEmbryos ? (ip.frozenEmbryoDetails || 'Yes') : boolLabel(ip.hasFrozenEmbryos) },
              { icon: Egg, label: 'Egg Donor', value: boolLabel(ip.usingEggDonor) },
              { icon: Users, label: 'Sperm Donor', value: boolLabel(ip.usingSpermDonor) },
            ].map(tile => (
              <div key={tile.label} className="rounded-xl bg-stone-50/80 border border-stone-100 p-3 text-center">
                <tile.icon className="size-4 text-stone-300 mx-auto mb-1" />
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{tile.label}</p>
                <p className="text-lg font-bold mt-0.5 leading-tight text-stone-800">{tile.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="intake">Intake Form</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="texts">Texts</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-2xl">
              <CardHeader><CardTitle>Intended Parent 1</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Users} label="Name" value={ip.ip1Name} />
                <InfoRow icon={Calendar} label="Date of Birth" value={a.primaryDob} />
                {ip.age && <InfoRow icon={Users} label="Age" value={`${ip.age}`} />}
                <InfoRow icon={Mail} label="Email" value={ip.email} />
                <InfoRow icon={Phone} label="Phone" value={ip.phone} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader><CardTitle>Intended Parent 2</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {hasPartner ? (
                  <>
                    <InfoRow icon={Users} label="Name" value={ip.ip2Name} />
                    <InfoRow icon={Calendar} label="Date of Birth" value={a.ip2Dob} />
                    <InfoRow icon={Mail} label="Email" value={ip.ip2Email} />
                    <InfoRow icon={Phone} label="Phone" value={ip.ip2Phone} />
                  </>
                ) : (
                  <p className="text-sm text-stone-400">No partner on this journey</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader><CardTitle>Fertility Details</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={Stethoscope} label="Has RE" value={boolLabel(ip.hasRE)} />
                {ip.hasRE && ip.reDoctorName && <InfoRow icon={Stethoscope} label="RE Doctor / Clinic" value={ip.reDoctorName} />}
                <InfoRow icon={Baby} label="Frozen Embryos" value={boolLabel(ip.hasFrozenEmbryos)} />
                {ip.hasFrozenEmbryos && ip.frozenEmbryoDetails && <InfoRow icon={Baby} label="Embryo Details" value={ip.frozenEmbryoDetails} />}
                <InfoRow icon={Egg} label="Using Egg Donor" value={boolLabel(ip.usingEggDonor)} />
                <InfoRow icon={Heart} label="Using Sperm Donor" value={boolLabel(ip.usingSpermDonor)} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader><CardTitle>Additional Details</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <InfoRow icon={ClipboardList} label="Wants Consultation" value={boolLabel(ip.wantsConsultation, 'Yes', 'Not right now')} />
                <InfoRow icon={ClipboardList} label="How They Heard" value={ip.hearAboutUs || '—'} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-6 mt-4">
          <ContactTab ip={ip} setIp={setIp} />
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 mt-4">
          <IPProfileTab
            ip={ip}
            onUpdate={async (updatedAnswers) => {
              try {
                await updateIntakeSubmission(ip.id, { answers: updatedAnswers })
                setIp(prev => ({ ...prev, answers: updatedAnswers }))
              } catch (err) {
                console.error('Failed to save IP profile:', err)
              }
            }}
          />
        </TabsContent>

        {/* Intake Form Tab */}
        <TabsContent value="intake" className="space-y-6 mt-4">
          <IntakeFormTab ip={ip} setIp={setIp} />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6 mt-4">
          <EmptyState title="Documents" description="Document management for intended parents coming soon." />
        </TabsContent>

        {/* Texts Tab */}
        <TabsContent value="texts" className="space-y-6 mt-4">
          <EmptyState title="Text Messages" description="SMS messaging for intended parents coming soon." />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-6 mt-4">
          <EmptyState title="Notes" description="Case notes for intended parents coming soon." />
        </TabsContent>
      </Tabs>
    </div>
  )
}

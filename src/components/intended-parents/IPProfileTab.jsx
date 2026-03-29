import { useState } from 'react'
import {
  ChevronDown, Save, Baby, Stethoscope, User, Heart, BookOpen
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

// ─────────────────────────────────────────────────────────
// Field Components
// ─────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return (
    <label className="text-xs text-stone-400 uppercase tracking-wide font-semibold">
      {children}
    </label>
  )
}

function TextField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white rounded-xl"
      />
    </div>
  )
}

function TextAreaField({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="bg-white rounded-xl resize-none"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options, placeholder = 'Select...' }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-white rounded-xl">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => {
            const val = typeof opt === 'string' ? opt : opt.value
            const lbl = typeof opt === 'string' ? opt : opt.label
            return <SelectItem key={val} value={val}>{lbl}</SelectItem>
          })}
        </SelectContent>
      </Select>
    </div>
  )
}

function YesNoField({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => onChange('yes')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            value === 'yes'
              ? 'bg-[#283693] text-white shadow-md'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange('no')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
            value === 'no'
              ? 'bg-[#283693] text-white shadow-md'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          No
        </button>
      </div>
    </div>
  )
}

function CheckboxGroupField({ label, options, value = [], onChange }) {
  const toggle = (opt) => {
    const set = new Set(value)
    if (set.has(opt)) set.delete(opt)
    else set.add(opt)
    onChange([...set])
  }
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={(value || []).includes(opt)}
              onCheckedChange={() => toggle(opt)}
            />
            <span className="text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Display Components (read-only)
// ─────────────────────────────────────────────────────────

function DisplayField({ label, value }) {
  if (value === undefined || value === null || value === '') return null
  let display = value
  if (Array.isArray(value)) display = value.join(', ')
  if (typeof value === 'boolean') display = value ? 'Yes' : 'No'
  if (value === 'yes') display = 'Yes'
  if (value === 'no') display = 'No'
  return (
    <div>
      <p className="text-xs text-stone-400 uppercase tracking-wide font-semibold">{label}</p>
      <p className="text-sm font-medium whitespace-pre-wrap">{String(display)}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Health conditions options
// ─────────────────────────────────────────────────────────

const HEALTH_CONDITIONS = [
  'Blood Transfusion', 'Polio or Meningitis', 'High Blood Pressure',
  'Scarlet Fever', 'Nervous Breakdown', 'Heart Disease',
  'Low Blood Pressure', 'Gonorrhea/Syphilis', 'Jaundice',
  'Epilepsy', 'Migraines', 'Tuberculosis',
  'Cancer', 'Hepatitis', 'HIV/AIDS',
  'Herpes', 'Chicken Pox'
]

// ─────────────────────────────────────────────────────────
// Section definitions
// ─────────────────────────────────────────────────────────

const FERTILITY_FIELDS = [
  { key: 'reasonForSurrogacy', label: 'What led to your decision to pursue surrogacy?', type: 'textarea' },
  { key: 'fertilityProcedures', label: 'What fertility procedures have you tried?', type: 'textarea' },
  { key: 'hasFrozenEmbryos', label: 'Do you have frozen embryos?', type: 'yesno' },
  { key: 'frozenEmbryoCount', label: 'How many frozen embryos?', type: 'text', conditional: d => d.hasFrozenEmbryos === 'yes' },
  { key: 'embryosGeneticallyTested', label: 'Have the embryos been genetically tested?', type: 'textarea' },
  { key: 'usingEggDonor', label: 'Using an egg donor?', type: 'yesno' },
  { key: 'usingSpermDonor', label: 'Using a sperm donor?', type: 'yesno' },
  { key: 'embryoTransferCount', label: 'Transfer one embryo or two?', type: 'select', options: ['1', '2', 'Undecided'] },
  { key: 'anticipatedTransferDate', label: 'When do you anticipate having the embryo transfer?', type: 'text' },
  { key: 'hasOtherChildren', label: 'Do you have other children?', type: 'yesno' },
  { key: 'otherChildrenDetails', label: 'How many and what age(s)?', type: 'text', conditional: d => d.hasOtherChildren === 'yes' },
]

const SURROGACY_FIELDS = [
  { key: 'clinicName', label: 'Name and location of your clinic and RE?', type: 'text' },
  { key: 'surrogatePreference', label: 'Prefer single, married, or no preference?', type: 'select', options: ['Single', 'Married', 'No Preference'] },
  { key: 'locationPreference', label: 'Preference on where surrogate resides?', type: 'yesno' },
  { key: 'locationPreferenceStates', label: 'Which state(s)?', type: 'text', conditional: d => d.locationPreference === 'yes' },
  { key: 'firstTimeOrRepeat', label: 'First time or repeat surrogate?', type: 'textarea' },
  { key: 'attendAppointments', label: 'Attend milestone OB appointments?', type: 'yesno' },
  { key: 'terminationForAbnormalities', label: 'If abnormalities, would you terminate?', type: 'textarea' },
  { key: 'relationshipWithSurrogate', label: 'What kind of relationship during pregnancy?', type: 'textarea' },
  { key: 'inDeliveryRoom', label: 'Want to be in the delivery room?', type: 'yesno' },
  { key: 'tandemSurrogacy', label: 'Pursue tandem surrogacy?', type: 'yesno' },
  { key: 'whatTellChild', label: 'What will you tell your child about the birth process?', type: 'textarea' },
  { key: 'messageToGC', label: 'Anything you\'d like to say to a potential GC?', type: 'textarea' },
]

const PERSONAL_FIELDS = [
  { key: 'dob', label: 'Date of Birth', type: 'date' },
  { key: 'birthplace', label: 'Birthplace', type: 'text' },
  { key: 'ethnicity', label: 'Ethnicity', type: 'text' },
  { key: 'languages', label: 'Languages', type: 'text' },
  { key: 'usCitizen', label: 'US Citizen?', type: 'yesno' },
  { key: 'citizenshipCountry', label: 'Citizenship Country', type: 'text', conditional: d => d.usCitizen === 'no' },
  { key: 'criminalHistory', label: 'Ever arrested/convicted?', type: 'textarea' },
]

const HEALTH_FIELDS = [
  { key: 'generalHealth', label: 'General health condition', type: 'textarea' },
  { key: 'medicalConditions', label: 'Any medical conditions?', type: 'textarea' },
  { key: 'hepatitisBC', label: 'Tested positive for Hep B or C?', type: 'textarea' },
  { key: 'hivAids', label: 'HIV/AIDS?', type: 'yesno' },
  { key: 'mentalHealthDiagnosis', label: 'Mental health diagnosis?', type: 'yesno' },
  { key: 'mentalHealthDiagnosisDetails', label: 'Diagnosis details', type: 'textarea', conditional: d => d.mentalHealthDiagnosis === 'yes' },
  { key: 'mentalHealthMedication', label: 'Mental health medication?', type: 'yesno' },
  { key: 'mentalHealthMedicationDetails', label: 'Medication details', type: 'textarea', conditional: d => d.mentalHealthMedication === 'yes' },
  { key: 'mentalHealthHospitalization', label: 'Mental health hospitalization?', type: 'yesno' },
  { key: 'mentalHealthHospitalizationDetails', label: 'Hospitalization details', type: 'textarea', conditional: d => d.mentalHealthHospitalization === 'yes' },
  { key: 'healthConditionsList', label: 'Health conditions', type: 'checkboxGroup', options: HEALTH_CONDITIONS },
  { key: 'healthConditionsDetails', label: 'Dates for any of the above', type: 'textarea' },
]

const HISTORY_FIELDS = [
  { key: 'favoriteMusic', label: 'Favorite Music', type: 'text' },
  { key: 'favoriteMovie', label: 'Favorite Movie', type: 'text' },
  { key: 'favoriteBook', label: 'Favorite Book', type: 'text' },
  { key: 'favoriteFoods', label: 'Favorite Foods', type: 'text' },
  { key: 'favoriteColor', label: 'Favorite Color', type: 'text' },
  { key: 'favoriteFlower', label: 'Favorite Flower', type: 'text' },
  { key: 'pets', label: 'Pets', type: 'textarea' },
  { key: 'freeTime', label: 'Free Time', type: 'textarea' },
  { key: 'collections', label: 'Collections', type: 'text' },
  { key: 'travelDestination', label: 'Travel Destination', type: 'textarea' },
  { key: 'personality', label: 'Describe yourself and personality', type: 'textarea' },
  { key: 'messageToSurrogate', label: 'What else would you like to tell the prospective surrogate?', type: 'textarea' },
]

const SECTIONS = [
  { key: 'fertility', label: 'Fertility Information', icon: Baby, fields: FERTILITY_FIELDS, perPerson: false },
  { key: 'surrogacy', label: 'Surrogacy Information', icon: Stethoscope, fields: SURROGACY_FIELDS, perPerson: false },
  { key: 'personal', label: 'Personal Information', icon: User, fields: PERSONAL_FIELDS, perPerson: true },
  { key: 'health', label: 'Health Information', icon: Heart, fields: HEALTH_FIELDS, perPerson: true },
  { key: 'history', label: 'Personal History', icon: BookOpen, fields: HISTORY_FIELDS, perPerson: true },
]

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function countProfileCompletion(profile, hasPartner) {
  let total = 0
  let filled = 0

  for (const section of SECTIONS) {
    if (section.perPerson) {
      // Count IP1 fields
      const ip1Data = profile?.ip1?.[section.key] || {}
      for (const f of section.fields) {
        if (f.conditional && !f.conditional(ip1Data)) continue
        total++
        if (isFieldFilled(ip1Data[f.key])) filled++
      }
      // Count IP2 fields if couple
      if (hasPartner) {
        const ip2Data = profile?.ip2?.[section.key] || {}
        for (const f of section.fields) {
          if (f.conditional && !f.conditional(ip2Data)) continue
          total++
          if (isFieldFilled(ip2Data[f.key])) filled++
        }
      }
    } else {
      const sData = profile?.[section.key] || {}
      for (const f of section.fields) {
        if (f.conditional && !f.conditional(sData)) continue
        total++
        if (isFieldFilled(sData[f.key])) filled++
      }
    }
  }

  return { filled, total, percent: total > 0 ? Math.round((filled / total) * 100) : 0 }
}

function isFieldFilled(value) {
  if (value === undefined || value === null || value === '') return false
  if (Array.isArray(value)) return value.length > 0
  return true
}

// ─────────────────────────────────────────────────────────
// Render field in edit mode
// ─────────────────────────────────────────────────────────

function renderEditField(field, data, onChange) {
  // Check conditional visibility
  if (field.conditional && !field.conditional(data)) return null

  const value = data[field.key]
  const handleChange = (val) => onChange(field.key, val)

  switch (field.type) {
    case 'text':
      return <TextField key={field.key} label={field.label} value={value} onChange={handleChange} />
    case 'date':
      return <TextField key={field.key} label={field.label} value={value} onChange={handleChange} type="date" />
    case 'textarea':
      return <TextAreaField key={field.key} label={field.label} value={value} onChange={handleChange} />
    case 'yesno':
      return <YesNoField key={field.key} label={field.label} value={value} onChange={handleChange} />
    case 'select':
      return <SelectField key={field.key} label={field.label} value={value} onChange={handleChange} options={field.options} />
    case 'checkboxGroup':
      return <CheckboxGroupField key={field.key} label={field.label} value={value} onChange={handleChange} options={field.options} />
    default:
      return <TextField key={field.key} label={field.label} value={value} onChange={handleChange} />
  }
}

// ─────────────────────────────────────────────────────────
// Render field in display (read-only) mode
// ─────────────────────────────────────────────────────────

function renderDisplayField(field, data) {
  if (field.conditional && !field.conditional(data)) return null
  const value = data[field.key]
  return <DisplayField key={field.key} label={field.label} value={value} />
}

// ─────────────────────────────────────────────────────────
// Section Editor (shared section)
// ─────────────────────────────────────────────────────────

function SharedSectionCard({ section, profile, onSave }) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)

  const sectionData = profile?.[section.key] || {}
  const Icon = section.icon

  function startEdit() {
    const merged = { ...sectionData }
    for (const f of section.fields) {
      if (!(f.key in merged)) merged[f.key] = f.type === 'checkboxGroup' ? [] : ''
    }
    setEditData(merged)
    setEditing(true)
  }

  function handleFieldChange(key, value) {
    setEditData(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(section.key, editData)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="size-5 text-[#283693]" />
                <CardTitle className="text-base">{section.label}</CardTitle>
              </div>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {editing ? (
              <div className="space-y-4">
                {section.fields.map(f => renderEditField(f, editData, handleFieldChange))}
                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                    <Save className="size-3.5" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {section.fields.map(f => renderDisplayField(f, sectionData))}
                </div>
                {section.fields.every(f => !isFieldFilled(sectionData[f.key])) && (
                  <p className="text-sm text-muted-foreground italic">No data entered yet.</p>
                )}
                <Button size="sm" variant="outline" onClick={startEdit} className="mt-2">
                  Edit
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ─────────────────────────────────────────────────────────
// Section Editor (per-person section with IP1/IP2 tabs)
// ─────────────────────────────────────────────────────────

function PerPersonSectionCard({ section, profile, hasPartner, ip1Name, ip2Name, onSave }) {
  const [open, setOpen] = useState(true)
  const [activeTab, setActiveTab] = useState('ip1')
  const [editing, setEditing] = useState(null) // 'ip1' | 'ip2' | null
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)

  const Icon = section.icon

  function getPersonData(person) {
    return profile?.[person]?.[section.key] || {}
  }

  function startEdit(person) {
    const data = getPersonData(person)
    const merged = { ...data }
    for (const f of section.fields) {
      if (!(f.key in merged)) merged[f.key] = f.type === 'checkboxGroup' ? [] : ''
    }
    setEditData(merged)
    setEditing(person)
  }

  function handleFieldChange(key, value) {
    setEditData(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(editing, section.key, editData)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  function renderPersonContent(person) {
    const personData = getPersonData(person)
    const isEditing = editing === person

    if (isEditing) {
      return (
        <div className="space-y-4">
          {section.fields.map(f => renderEditField(f, editData, handleFieldChange))}
          <div className="flex items-center gap-2 pt-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              <Save className="size-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {section.fields.map(f => renderDisplayField(f, personData))}
        </div>
        {section.fields.every(f => !isFieldFilled(personData[f.key])) && (
          <p className="text-sm text-muted-foreground italic">No data entered yet.</p>
        )}
        <Button size="sm" variant="outline" onClick={() => startEdit(person)} className="mt-2">
          Edit
        </Button>
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="size-5 text-[#283693]" />
                <CardTitle className="text-base">{section.label}</CardTitle>
              </div>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {hasPartner ? (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="ip1">IP1 ({ip1Name || 'IP1'})</TabsTrigger>
                  <TabsTrigger value="ip2">IP2 ({ip2Name || 'IP2'})</TabsTrigger>
                </TabsList>
                <TabsContent value="ip1">{renderPersonContent('ip1')}</TabsContent>
                <TabsContent value="ip2">{renderPersonContent('ip2')}</TabsContent>
              </Tabs>
            ) : (
              renderPersonContent('ip1')
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

export default function IPProfileTab({ ip, onUpdate }) {
  const answers = ip?.answers || {}
  const profile = answers._ipProfile || {}
  const hasPartner = answers.hasPartner === true

  const ip1Name = ip?.ip1Name || answers.primaryFirstName || 'IP1'
  const ip2Name = ip?.ip2Name || answers.ip2FirstName || 'IP2'

  const { filled, total, percent } = countProfileCompletion(profile, hasPartner)

  // Save a shared section (fertility, surrogacy)
  async function handleSharedSave(sectionKey, data) {
    const updatedProfile = {
      ...profile,
      [sectionKey]: data,
    }
    const updatedAnswers = {
      ...answers,
      _ipProfile: updatedProfile,
    }
    await onUpdate(updatedAnswers)
  }

  // Save a per-person section (personal, health, history)
  async function handlePerPersonSave(person, sectionKey, data) {
    const updatedProfile = {
      ...profile,
      [person]: {
        ...(profile[person] || {}),
        [sectionKey]: data,
      },
    }
    const updatedAnswers = {
      ...answers,
      _ipProfile: updatedProfile,
    }
    await onUpdate(updatedAnswers)
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Progress Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-stone-700">Profile Completion</p>
            <p className="text-sm font-semibold text-[#283693]">{percent}%</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full transition-all duration-500 bg-[#283693]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {filled} of {total} fields completed
          </p>
        </CardContent>
      </Card>

      {/* Sections */}
      {SECTIONS.map(section =>
        section.perPerson ? (
          <PerPersonSectionCard
            key={section.key}
            section={section}
            profile={profile}
            hasPartner={hasPartner}
            ip1Name={ip1Name}
            ip2Name={ip2Name}
            onSave={handlePerPersonSave}
          />
        ) : (
          <SharedSectionCard
            key={section.key}
            section={section}
            profile={profile}
            onSave={handleSharedSave}
          />
        )
      )}
    </div>
  )
}

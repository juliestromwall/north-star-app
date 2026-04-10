import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRole } from '@/context/RoleContext'
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardAction } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Baby, Stethoscope, User, Heart, BookOpen, CheckCircle2, Circle, ChevronDown, Loader2 } from 'lucide-react'
import { findCaseByEmail, updateIntakeSubmission } from '@/lib/db'

// ── Field definitions ──

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
  { key: 'surrogatePreference', label: 'Prefer single, married, or no preference for surrogate?', type: 'select', options: ['Single', 'Married', 'No Preference'] },
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
  { key: 'criminalHistory', label: 'Ever been arrested or convicted?', type: 'textarea' },
]

const HEALTH_CONDITIONS = [
  'Blood Transfusion', 'Polio or Meningitis', 'High Blood Pressure', 'Scarlet Fever',
  'Nervous Breakdown', 'Heart Disease', 'Low Blood Pressure', 'Gonorrhea/Syphilis',
  'Jaundice', 'Epilepsy', 'Migraines', 'Tuberculosis', 'Cancer', 'Hepatitis',
  'HIV/AIDS', 'Herpes', 'Chicken Pox',
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
  { key: 'healthConditionsList', label: 'Health conditions (check all that apply)', type: 'checkboxGroup', options: HEALTH_CONDITIONS },
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
  { key: 'freeTime', label: 'What do you do in your free time?', type: 'textarea' },
  { key: 'collections', label: 'Collections', type: 'text' },
  { key: 'travelDestination', label: 'Favorite travel destination', type: 'textarea' },
  { key: 'personality', label: 'Describe yourself and personality', type: 'textarea' },
  { key: 'messageToSurrogate', label: 'What else would you like to tell the prospective surrogate?', type: 'textarea' },
]

const SECTIONS = [
  { key: 'fertility', label: 'Fertility Information', description: 'Embryos, donors, and fertility history', icon: Baby, fields: FERTILITY_FIELDS, perPerson: false },
  { key: 'surrogacy', label: 'Surrogacy Information', description: 'Preferences, expectations, and clinic details', icon: Stethoscope, fields: SURROGACY_FIELDS, perPerson: false },
  { key: 'personal', label: 'Personal Information', description: 'Background, citizenship, and personal details', icon: User, fields: PERSONAL_FIELDS, perPerson: true },
  { key: 'health', label: 'Health Information', description: 'Medical history and health conditions', icon: Heart, fields: HEALTH_FIELDS, perPerson: true },
  { key: 'history', label: 'Personal History', description: 'Interests, favorites, and personality', icon: BookOpen, fields: HISTORY_FIELDS, perPerson: true },
]

// ── Completion helpers ──

function countCompletion(profile, hasPartner) {
  let filled = 0, total = 0
  for (const sec of SECTIONS) {
    const data = sec.perPerson ? profile?.ip1?.[sec.key] || {} : profile?.[sec.key] || {}
    const visibleFields = sec.fields.filter(f => !f.conditional || f.conditional(data))
    if (sec.perPerson) {
      for (const person of hasPartner ? ['ip1', 'ip2'] : ['ip1']) {
        const d = profile?.[person]?.[sec.key] || {}
        for (const f of visibleFields) { total++; const val = d[f.key]; if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++ }
      }
    } else {
      for (const f of visibleFields) { total++; const val = data[f.key]; if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++ }
    }
  }
  return total > 0 ? Math.round((filled / total) * 100) : 0
}

function countSectionCompletion(profile, section, hasPartner) {
  const data = section.perPerson ? profile?.ip1?.[section.key] || {} : profile?.[section.key] || {}
  const visibleFields = section.fields.filter(f => !f.conditional || f.conditional(data))
  let filled = 0, total = 0
  if (section.perPerson) {
    for (const person of hasPartner ? ['ip1', 'ip2'] : ['ip1']) {
      const d = profile?.[person]?.[section.key] || {}
      for (const f of visibleFields) { total++; const val = d[f.key]; if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++ }
    }
  } else {
    for (const f of visibleFields) { total++; const val = data[f.key]; if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++ }
  }
  return { filled, total, complete: total > 0 && filled === total }
}

// ── Inline Field Components (always editable, like GC profile) ──

function TextField({ label, value, onChange, type = 'text', placeholder, disabled }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#283693]">{label}</label>
      <Input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className="h-9" />
    </div>
  )
}

function TextAreaField({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#283693]">{label}</label>
      <Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} />
    </div>
  )
}

function YesNoField({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#283693]">{label}</label>
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange('yes')}
          className={`px-4 py-1.5 text-sm rounded-full font-medium transition-colors ${value === 'yes' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>Yes</button>
        <button type="button" onClick={() => onChange('no')}
          className={`px-4 py-1.5 text-sm rounded-full font-medium transition-colors ${value === 'no' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>No</button>
      </div>
    </div>
  )
}

function SelectField({ label, value, onChange, options, placeholder = 'Select...' }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#283693]">{label}</label>
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function CheckboxGroupField({ label, value, onChange, options }) {
  const selected = Array.isArray(value) ? value : []
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#283693]">{label}</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={selected.includes(opt)}
              onChange={e => onChange(e.target.checked ? [...selected, opt] : selected.filter(v => v !== opt))}
              className="rounded border-stone-300" />
            {opt}
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Progress Ring ──

function ProgressRing({ percent, size = 80 }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e7e5e4" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#283693" strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} className="transition-all duration-700" />
      <text x="50%" y="50%" textAnchor="middle" dy=".35em" className="text-sm font-bold fill-stone-700">{percent}%</text>
    </svg>
  )
}

// ── Render fields for a section ──

function renderField(field, value, onChange) {
  if (field.type === 'text' || field.type === 'date') return <TextField label={field.label} value={value} onChange={onChange} type={field.type} />
  if (field.type === 'textarea') return <TextAreaField label={field.label} value={value} onChange={onChange} />
  if (field.type === 'yesno') return <YesNoField label={field.label} value={value} onChange={onChange} />
  if (field.type === 'select') return <SelectField label={field.label} value={value} onChange={onChange} options={field.options} />
  if (field.type === 'checkboxGroup') return <CheckboxGroupField label={field.label} value={value} onChange={onChange} options={field.options} />
  return null
}

// ── Main Component ──

export default function IPProfilePage() {
  const { currentUser } = useRole()
  const [caseData, setCaseData] = useState(null)
  const [profile, setProfile] = useState({})
  const [loading, setLoading] = useState(true)
  const [openSections, setOpenSections] = useState({})
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!currentUser?.email) { setLoading(false); return }
    findCaseByEmail(currentUser.email).then(data => {
      if (data) {
        setCaseData(data)
        const existing = data.answers?._ipProfile || {}
        // Pre-fill from intake answers if profile sections are empty
        const a = data.answers || {}
        const boolToYN = (v) => v === true ? 'yes' : v === false ? 'no' : undefined
        if (!existing.fertility || Object.keys(existing.fertility).length === 0) {
          existing.fertility = {
            hasFrozenEmbryos: boolToYN(a.hasFrozenEmbryos),
            frozenEmbryoCount: a.frozenEmbryoDetails || '',
            usingEggDonor: boolToYN(a.usingEggDonor),
            usingSpermDonor: boolToYN(a.usingSpermDonor),
            hasOtherChildren: boolToYN(a.hasOtherChildren),
            otherChildrenDetails: a.otherChildrenDetails || '',
          }
        }
        if (!existing.surrogacy || Object.keys(existing.surrogacy).length === 0) {
          const clinicParts = [a.reDoctorName, a.hasRE === true ? 'RE' : ''].filter(Boolean)
          existing.surrogacy = {
            clinicName: clinicParts.length > 0 ? clinicParts.join(' — ') : '',
          }
        }
        const hp = a.hasPartner === 'yes' || a.hasPartner === true
        if (!existing.ip1?.personal || Object.keys(existing.ip1?.personal || {}).length === 0) {
          existing.ip1 = { ...existing.ip1, personal: { dob: a.primaryDob || '', ...(existing.ip1?.personal || {}) } }
        }
        if (hp && (!existing.ip2?.personal || Object.keys(existing.ip2?.personal || {}).length === 0)) {
          existing.ip2 = { ...existing.ip2, personal: { dob: a.ip2Dob || '', ...(existing.ip2?.personal || {}) } }
        }
        setProfile(existing)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [currentUser?.email])

  const hasPartner = caseData?.answers?.hasPartner === 'yes' || caseData?.answers?.hasPartner === true
  const ip1Name = caseData?.answers?.primaryFirstName || 'IP1'
  const ip2Name = caseData?.answers?.ip2FirstName || 'IP2'
  const completion = useMemo(() => countCompletion(profile, hasPartner), [profile, hasPartner])

  // Auto-save with debounce (2 seconds after last change)
  const scheduleAutoSave = useCallback((updatedProfile) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!caseData?.id) return
      try {
        await updateIntakeSubmission(caseData.id, { answers: { ...caseData.answers, _ipProfile: updatedProfile } })
      } catch {}
    }, 2000)
  }, [caseData])

  // Update a shared section field
  function updateField(sectionKey, fieldKey, value) {
    const updated = { ...profile, [sectionKey]: { ...profile[sectionKey], [fieldKey]: value } }
    setProfile(updated)
    scheduleAutoSave(updated)
  }

  // Update a per-person section field
  function updatePersonField(person, sectionKey, fieldKey, value) {
    const updated = { ...profile, [person]: { ...profile[person], [sectionKey]: { ...profile[person]?.[sectionKey], [fieldKey]: value } } }
    setProfile(updated)
    scheduleAutoSave(updated)
  }

  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-stone-400" /></div>
  }

  if (!caseData) {
    return (
      <div className="space-y-6">
        <Card><CardContent className="py-12 text-center text-stone-400 text-sm">No case data found. Please contact the agency.</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress header — title inside card like GC profile */}
      <Card className="rounded-2xl">
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <ProgressRing percent={completion} />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <p className="font-heading font-bold text-xl text-stone-800">My Profile</p>
              <p className="text-sm text-stone-500 mt-1">Complete your matching profile so intended parents can get to know you.</p>
              <div className="mt-3 max-w-sm mx-auto sm:mx-0">
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${completion}%`, background: 'linear-gradient(90deg, #ed148c, #283693)' }} />
                </div>
                <p className="text-xs text-stone-400 mt-1">{completion}% complete</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      {SECTIONS.map(sec => {
        const Icon = sec.icon
        const { filled, total, complete } = countSectionCompletion(profile, sec, hasPartner)
        const isOpen = openSections[sec.key]

        return (
          <Collapsible key={sec.key} open={isOpen} onOpenChange={() => toggleSection(sec.key)}>
            <Card className={`rounded-2xl ${complete ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`size-10 rounded-xl flex items-center justify-center ${complete ? 'bg-emerald-100' : 'bg-[#283693]/10'}`}>
                      <Icon className={`size-5 ${complete ? 'text-emerald-600' : 'text-[#283693]'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base text-[#283693]">{sec.label}</CardTitle>
                      <CardDescription>{sec.description}</CardDescription>
                    </div>
                    <span className="text-sm text-stone-400 font-medium shrink-0">{filled}/{total}</span>
                    {complete ? <CheckCircle2 className="size-5 text-emerald-500 shrink-0" /> : <Circle className="size-5 text-stone-300 shrink-0" />}
                  </div>
                  <CardAction>
                    <ChevronDown className={`size-5 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </CardAction>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {sec.perPerson ? (
                    <PerPersonFields
                      section={sec}
                      profile={profile}
                      hasPartner={hasPartner}
                      ip1Name={ip1Name}
                      ip2Name={ip2Name}
                      onUpdate={updatePersonField}
                    />
                  ) : (
                    <SharedFields
                      section={sec}
                      data={profile[sec.key] || {}}
                      onUpdate={(fieldKey, value) => updateField(sec.key, fieldKey, value)}
                    />
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )
      })}

      {/* Contact */}
      <Card className="bg-stone-50 border-dashed rounded-2xl">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-stone-500">Need help? Contact us at</p>
          <a href="mailto:info@abcsurrogacy.com" className="text-sm font-semibold text-[#283693] hover:underline">info@abcsurrogacy.com</a>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Shared section fields (always editable) ──

function SharedFields({ section, data, onUpdate }) {
  const visibleFields = section.fields.filter(f => !f.conditional || f.conditional(data))
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleFields.map(f => (
          <div key={f.key} className={f.type === 'textarea' || f.type === 'checkboxGroup' ? 'md:col-span-2' : ''}>
            {renderField(f, data[f.key], val => onUpdate(f.key, val))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Per-person section fields (IP1 / IP2 tabs) ──

function PerPersonFields({ section, profile, hasPartner, ip1Name, ip2Name, onUpdate }) {
  const [activeTab, setActiveTab] = useState('ip1')

  const renderPerson = (person) => {
    const data = profile[person]?.[section.key] || {}
    const visibleFields = section.fields.filter(f => !f.conditional || f.conditional(data))
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleFields.map(f => (
            <div key={f.key} className={f.type === 'textarea' || f.type === 'checkboxGroup' ? 'md:col-span-2' : ''}>
              {renderField(f, data[f.key], val => onUpdate(person, section.key, f.key, val))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!hasPartner) return renderPerson('ip1')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="ip1">{ip1Name}</TabsTrigger>
        <TabsTrigger value="ip2">{ip2Name}</TabsTrigger>
      </TabsList>
      <TabsContent value="ip1" className="mt-4">{renderPerson('ip1')}</TabsContent>
      <TabsContent value="ip2" className="mt-4">{renderPerson('ip2')}</TabsContent>
    </Tabs>
  )
}

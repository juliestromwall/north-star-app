import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Baby, Stethoscope, User, Heart, BookOpen, CheckCircle2, Circle, ChevronDown, Loader2, Save } from 'lucide-react'
import { findCaseByEmail, updateIntakeSubmission } from '@/lib/db'

// ── Section & field definitions (mirrors admin IPProfileTab) ──

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
  { key: 'criminalHistory', label: 'Ever arrested/convicted?', type: 'textarea' },
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

// ── Completion ──

function countCompletion(profile, hasPartner) {
  let filled = 0, total = 0
  for (const sec of SECTIONS) {
    const visibleFields = sec.fields.filter(f => !f.conditional || f.conditional(sec.perPerson ? profile?.ip1?.[sec.key] || {} : profile?.[sec.key] || {}))
    if (sec.perPerson) {
      for (const person of hasPartner ? ['ip1', 'ip2'] : ['ip1']) {
        for (const f of visibleFields) {
          total++
          const val = profile?.[person]?.[sec.key]?.[f.key]
          if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++
        }
      }
    } else {
      for (const f of visibleFields) {
        total++
        const val = profile?.[sec.key]?.[f.key]
        if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++
      }
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
      for (const f of visibleFields) {
        total++
        const val = d[f.key]
        if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++
      }
    }
  } else {
    for (const f of visibleFields) {
      total++
      const val = data[f.key]
      if (val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0)) filled++
    }
  }
  return { filled, total, complete: total > 0 && filled === total }
}

// ── Field Renderer ──

function FieldInput({ field, value, onChange }) {
  if (field.type === 'text' || field.type === 'date') {
    return <Input type={field.type} value={value || ''} onChange={e => onChange(e.target.value)} className="h-9" />
  }
  if (field.type === 'textarea') {
    return <Textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3} />
  }
  if (field.type === 'yesno') {
    return (
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange('yes')}
          className={`px-4 py-1.5 text-xs rounded-full font-medium transition-colors ${value === 'yes' ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>Yes</button>
        <button type="button" onClick={() => onChange('no')}
          className={`px-4 py-1.5 text-xs rounded-full font-medium transition-colors ${value === 'no' ? 'bg-red-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>No</button>
      </div>
    )
  }
  if (field.type === 'select') {
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
        <SelectContent>
          {field.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
        </SelectContent>
      </Select>
    )
  }
  if (field.type === 'checkboxGroup') {
    const selected = Array.isArray(value) ? value : []
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {field.options.map(opt => (
          <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={selected.includes(opt)}
              onChange={e => onChange(e.target.checked ? [...selected, opt] : selected.filter(v => v !== opt))}
              className="rounded border-stone-300" />
            {opt}
          </label>
        ))}
      </div>
    )
  }
  return null
}

function FieldDisplay({ field, value }) {
  if (value === undefined || value === null || value === '') return <span className="text-stone-300">—</span>
  if (field.type === 'yesno') return <span className={value === 'yes' ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>{value === 'yes' ? 'Yes' : 'No'}</span>
  if (field.type === 'checkboxGroup' && Array.isArray(value)) return <span>{value.join(', ') || '—'}</span>
  return <span>{value}</span>
}

// ── Progress Ring ──

function ProgressRing({ percent, size = 72 }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (percent / 100) * circ
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e7e5e4" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#283693" strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} className="transition-all duration-700" />
      <text x="50%" y="50%" textAnchor="middle" dy=".35em" className="text-xs font-bold fill-stone-700">{percent}%</text>
    </svg>
  )
}

// ── Main Component ──

export default function IPProfilePage() {
  const { currentUser } = useRole()
  const [caseData, setCaseData] = useState(null)
  const [profile, setProfile] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openSection, setOpenSection] = useState(null)
  const [editSection, setEditSection] = useState(null) // { sectionKey, person? }
  const [editData, setEditData] = useState({})

  useEffect(() => {
    if (!currentUser?.email) { setLoading(false); return }
    findCaseByEmail(currentUser.email).then(data => {
      if (data) {
        setCaseData(data)
        setProfile(data.answers?._ipProfile || {})
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [currentUser?.email])

  const hasPartner = caseData?.answers?.hasPartner === 'yes' || caseData?.answers?.hasPartner === true
  const ip1Name = caseData?.answers?.primaryFirstName || 'IP1'
  const ip2Name = caseData?.answers?.ip2FirstName || 'IP2'

  const completion = useMemo(() => countCompletion(profile, hasPartner), [profile, hasPartner])

  async function saveSection(sectionKey, person, data) {
    setSaving(true)
    let updated
    if (person) {
      updated = { ...profile, [person]: { ...profile[person], [sectionKey]: data } }
    } else {
      updated = { ...profile, [sectionKey]: data }
    }
    setProfile(updated)
    try {
      await updateIntakeSubmission(caseData.id, { answers: { ...caseData.answers, _ipProfile: updated } })
      setCaseData(prev => ({ ...prev, answers: { ...prev.answers, _ipProfile: updated } }))
    } catch {}
    setEditSection(null)
    setEditData({})
    setSaving(false)
  }

  function startEdit(sectionKey, person) {
    const data = person ? (profile[person]?.[sectionKey] || {}) : (profile[sectionKey] || {})
    setEditSection({ sectionKey, person })
    setEditData({ ...data })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-stone-400" />
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Profile" subtitle="Complete your profile for ABC Surrogacy" />
        <Card><CardContent className="py-12 text-center text-stone-400 text-sm">No case data found. Please contact the agency.</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" subtitle="Complete your matching profile so your coordinator can find the right surrogate for you." />

      {/* Progress header */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <ProgressRing percent={completion} />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <p className="font-semibold text-stone-800 text-lg">Profile Progress</p>
              <p className="text-sm text-stone-500 mt-1">Fill out each section below. Your answers help us find the perfect match.</p>
              <div className="mt-3 max-w-sm mx-auto sm:mx-0">
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${completion}%`, background: 'linear-gradient(90deg, #283693, #4a4fbf)' }} />
                </div>
                <p className="text-xs text-stone-400 mt-1">{completion}% complete</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="max-w-3xl space-y-4">
        {SECTIONS.map(sec => {
          const Icon = sec.icon
          const { filled, total, complete } = countSectionCompletion(profile, sec, hasPartner)
          const isOpen = openSection === sec.key
          const isEditing = editSection?.sectionKey === sec.key

          return (
            <Collapsible key={sec.key} open={isOpen} onOpenChange={() => { setOpenSection(isOpen ? null : sec.key); if (isEditing) { setEditSection(null); setEditData({}) } }}>
              <Card className={complete ? 'border-emerald-200 bg-emerald-50/30' : ''}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`size-8 rounded-lg flex items-center justify-center ${complete ? 'bg-emerald-100' : 'bg-[#283693]/10'}`}>
                        <Icon className={`size-4 ${complete ? 'text-emerald-600' : 'text-[#283693]'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm">{sec.label}</CardTitle>
                        <p className="text-[10px] text-stone-400 mt-0.5">{filled}/{total} fields completed</p>
                      </div>
                      {complete ? <CheckCircle2 className="size-4 text-emerald-500 shrink-0" /> : <Circle className="size-4 text-stone-300 shrink-0" />}
                    </div>
                    <CardAction>
                      <ChevronDown className={`size-4 text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </CardAction>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    {sec.perPerson ? (
                      <PerPersonSection
                        section={sec}
                        profile={profile}
                        hasPartner={hasPartner}
                        ip1Name={ip1Name}
                        ip2Name={ip2Name}
                        editSection={editSection}
                        editData={editData}
                        setEditData={setEditData}
                        onStartEdit={(person) => startEdit(sec.key, person)}
                        onSave={(person) => saveSection(sec.key, person, editData)}
                        onCancel={() => { setEditSection(null); setEditData({}) }}
                        saving={saving}
                      />
                    ) : (
                      <SharedSection
                        section={sec}
                        data={profile[sec.key] || {}}
                        isEditing={isEditing && !editSection?.person}
                        editData={editData}
                        setEditData={setEditData}
                        onStartEdit={() => startEdit(sec.key, null)}
                        onSave={() => saveSection(sec.key, null, editData)}
                        onCancel={() => { setEditSection(null); setEditData({}) }}
                        saving={saving}
                      />
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )
        })}
      </div>

      {/* Contact */}
      <Card className="max-w-3xl">
        <CardContent className="py-5">
          <div className="text-center">
            <p className="text-sm text-stone-600">
              Questions? Reach us at{' '}
              <a href="mailto:info@abcsurrogacy.com" className="text-[#283693] underline font-medium">info@abcsurrogacy.com</a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Shared Section (Fertility, Surrogacy) ──

function SharedSection({ section, data, isEditing, editData, setEditData, onStartEdit, onSave, onCancel, saving }) {
  const visibleFields = section.fields.filter(f => !f.conditional || f.conditional(isEditing ? editData : data))

  return (
    <div className="space-y-4">
      {isEditing ? (
        <>
          {visibleFields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600">{f.label}</label>
              <FieldInput field={f} value={editData[f.key]} onChange={val => setEditData(d => ({ ...d, [f.key]: val }))} />
            </div>
          ))}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} Save
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3">
            {visibleFields.map(f => (
              <div key={f.key}>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-0.5">{f.label}</p>
                <div className="text-sm text-stone-800"><FieldDisplay field={f} value={data[f.key]} /></div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={onStartEdit}>Edit</Button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Per-Person Section (Personal, Health, History) ──

function PerPersonSection({ section, profile, hasPartner, ip1Name, ip2Name, editSection, editData, setEditData, onStartEdit, onSave, onCancel, saving }) {
  const [activeTab, setActiveTab] = useState('ip1')
  const isEditingThis = editSection?.sectionKey === section.key
  const editingPerson = isEditingThis ? editSection.person : null

  const renderPerson = (person, personName) => {
    const data = profile[person]?.[section.key] || {}
    const isEditing = editingPerson === person
    const visibleFields = section.fields.filter(f => !f.conditional || f.conditional(isEditing ? editData : data))

    return (
      <div className="space-y-4">
        {isEditing ? (
          <>
            {visibleFields.map(f => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">{f.label}</label>
                <FieldInput field={f} value={editData[f.key]} onChange={val => setEditData(d => ({ ...d, [f.key]: val }))} />
              </div>
            ))}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
              <Button size="sm" className="gap-1" style={{ backgroundColor: '#283693' }} onClick={() => onSave(person)} disabled={saving}>
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} Save
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3">
              {visibleFields.map(f => (
                <div key={f.key}>
                  <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-0.5">{f.label}</p>
                  <div className="text-sm text-stone-800"><FieldDisplay field={f} value={data[f.key]} /></div>
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => onStartEdit(person)}>Edit</Button>
            </div>
          </>
        )}
      </div>
    )
  }

  if (!hasPartner) {
    return renderPerson('ip1', ip1Name)
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="ip1">{ip1Name}</TabsTrigger>
        <TabsTrigger value="ip2">{ip2Name}</TabsTrigger>
      </TabsList>
      <TabsContent value="ip1" className="mt-4">{renderPerson('ip1', ip1Name)}</TabsContent>
      <TabsContent value="ip2" className="mt-4">{renderPerson('ip2', ip2Name)}</TabsContent>
    </Tabs>
  )
}

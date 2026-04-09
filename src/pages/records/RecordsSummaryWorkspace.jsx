import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, ChevronDown, ChevronRight, Save, Loader2, Download, Trash2, Plus, Merge, Eye, X, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useRole } from '@/context/RoleContext'
import { fetchCaseDocuments, getAppConfig, setAppConfig } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

const SUMMARY_KEY_PREFIX = 'records_summary_'

const DEFAULT_LABS = [
  'Blood Type', 'Antibody Screen', 'Hgb/Hct', 'PAP', 'Rubella Titer',
  'Varicella Titer', 'CMV IgG', 'Hepatitis B Surface Antibody',
  'Hepatitis B Surface Antigen', 'Syphilis/RPR', 'HIV 1 & 2',
  'Hepatitis C', 'Chlamydia', 'Gonorrhea',
]

function SectionHeader({ title, open, onToggle }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-2 w-full text-left py-2 px-1 hover:bg-stone-50 rounded transition-colors">
      {open ? <ChevronDown className="size-3.5 text-stone-400" /> : <ChevronRight className="size-3.5 text-stone-400" />}
      <span className="text-xs font-bold text-[#283693] uppercase tracking-wider">{title}</span>
    </button>
  )
}

function FormField({ label, value, onChange, type = 'text', placeholder, rows }) {
  return (
    <div className="space-y-0.5">
      <label className="text-[10px] font-semibold text-stone-400 uppercase">{label}</label>
      {rows ? (
        <Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="text-sm" />
      ) : (
        <Input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-sm" />
      )}
    </div>
  )
}

// ── Document Viewer Panel ──────────────────────────────
function DocumentPanel({ documents, surrogateId }) {
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  // Filter to medical records category
  const medicalDocs = documents.filter(d =>
    d.category === 'medical-records' || d.category === 'clinic' || d.category === 'e-signature' ||
    d.file_name?.toLowerCase().includes('record') || d.file_name?.toLowerCase().includes('medical')
  )
  const allDocs = documents

  useEffect(() => {
    if (selectedDoc?.public_url) {
      setPreviewUrl(selectedDoc.public_url)
    }
  }, [selectedDoc])

  return (
    <div className="flex flex-col h-full">
      {/* Doc list header */}
      <div className="p-3 border-b bg-stone-50">
        <p className="text-xs font-semibold text-stone-600">Medical Records ({medicalDocs.length})</p>
      </div>

      {!selectedDoc ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {allDocs.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-8">No documents found</p>
          )}
          {allDocs.map(doc => (
            <button key={doc.id} onClick={() => setSelectedDoc(doc)}
              className="w-full text-left p-2.5 rounded-lg hover:bg-stone-100 transition-colors flex items-center gap-2">
              <FileText className="size-4 text-stone-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-stone-700 truncate">{doc.file_name}</p>
                <p className="text-[10px] text-stone-400">{doc.category} · {formatDate(doc.created_at)}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {/* Back button */}
          <div className="p-2 border-b flex items-center justify-between">
            <button onClick={() => { setSelectedDoc(null); setPreviewUrl(null) }} className="text-xs text-[#283693] hover:underline flex items-center gap-1">
              <ArrowLeft className="size-3" /> Back to list
            </button>
            <a href={selectedDoc.public_url} target="_blank" rel="noopener noreferrer" className="text-xs text-stone-400 hover:text-stone-600">
              <Download className="size-3.5" />
            </a>
          </div>
          <p className="text-xs font-medium text-stone-700 px-3 py-1.5 bg-stone-50 border-b truncate">{selectedDoc.file_name}</p>
          {/* PDF preview */}
          <div className="flex-1">
            {previewUrl && selectedDoc.file_type === 'application/pdf' ? (
              <iframe src={previewUrl} className="w-full h-full border-0" title="Document preview" />
            ) : previewUrl && selectedDoc.file_type?.startsWith('image/') ? (
              <div className="p-4 flex items-center justify-center h-full">
                <img src={previewUrl} alt="" className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-stone-400 text-sm">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[#283693] hover:underline">Open in new tab</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Summary Form Panel ─────────────────────────────────
function SummaryForm({ surrogateId, surrogate, profileData, clinicData, summary, onSave, saving }) {
  const [form, setForm] = useState({})
  const [openSections, setOpenSections] = useState({ general: true, pregnancies: true, labs: true })
  const [labRows, setLabRows] = useState([])

  // Initialize form from saved summary or profile data
  useEffect(() => {
    const profile = profileData || {}
    const personal = profile.personal || {}
    const pregnancyHistory = profile.pregnancyHistory || {}
    const pregnancies = pregnancyHistory.pregnancies || []
    const numPreg = parseInt(pregnancyHistory.numberOfPregnancies) || pregnancies.length || 0
    const clinic = clinicData || {}

    const saved = summary || {}
    const init = {
      // General info
      name: saved.name || surrogate?.name || '',
      dob: saved.dob || surrogate?.dob || personal.dob || '',
      maritalStatus: saved.maritalStatus || personal.maritalStatus || '',
      height: saved.height || (personal.heightFt ? `${personal.heightFt}'${personal.heightIn || 0}"` : ''),
      weight: saved.weight || (personal.weight ? `${personal.weight} lbs` : ''),
      bmi: saved.bmi || '',
      currentMedications: saved.currentMedications || '',
      allergies: saved.allergies || '',
      pertinentMedicalHistory: saved.pertinentMedicalHistory || '',
      surgicalHistory: saved.surgicalHistory || '',
      // Social
      occupation: saved.occupation || '',
      livesWith: saved.livesWith || '',
      alcohol: saved.alcohol || 'None',
      tobacco: saved.tobacco || 'Nonsmoker. No smoking history.',
      recreationalDrugs: saved.recreationalDrugs || 'None',
      // COVID
      covidPositive: saved.covidPositive || '',
      covidVaccine: saved.covidVaccine || '',
      // GYN
      lmp: saved.lmp || '',
      cycleLength: saved.cycleLength || '',
      menarche: saved.menarche || '',
      contraception: saved.contraception || '',
      stdHistory: saved.stdHistory || 'None',
      gynProblems: saved.gynProblems || 'None',
      infertilityHistory: saved.infertilityHistory || 'None',
      // Obstetrical summary line
      obstetricSummary: saved.obstetricSummary || '',
      // OB clearance
      obClearance: saved.obClearance || '',
      reviewedBy: saved.reviewedBy || '',
      // Pregnancies
      numberOfPregnancies: saved.numberOfPregnancies || numPreg,
      pregnancies: saved.pregnancies || pregnancies.map((p, i) => {
        const clinicPreg = (clinic.pregnancies || [])[i] || {}
        const isNonDelivery = ['miscarriage', 'ectopic', 'ectopic pregnancy', 'termination', 'chemical', 'chemical pregnancy'].includes((p.outcome || '').toLowerCase())
        const skipDetails = isNonDelivery && clinicPreg.receivedPrenatalCare === 'no'
        return {
          label: `G${i + 1}`,
          pageRef: '',
          dateOfDelivery: p.dob || '',
          outcome: p.outcome || '',
          skipDetails,
          gestationalAge: p.gestationWeeks ? `${p.gestationWeeks}w ${p.gestationDays || 0}d` : '',
          typeOfDelivery: p.deliveryType || '',
          antenatalMonitoring: '',
          gbs: '',
          glucoseScreen: '',
          glucoseValues: { fasting: '', oneHr: '', twoHr: '', threeHr: '' },
          bps: 'Normal',
          anesthesia: '',
          weightGained: '',
          infantBirthWeight: p.weight || '',
          complications: p.complications || '',
          gcCycle: p.wasSurrogacy === 'yes' ? 'Yes' : 'No',
          deliveryNote: '',
          deliveryComplications: '',
          apgar: '',
          ebl: '',
          postpartumComplications: saved.pregnancies?.[i]?.postpartumComplications || 'Unremarkable hospital postpartum course\nPer patient no postpartum complications',
          notes: '',
        }
      }),
    }

    // Initialize labs
    const savedLabs = saved.labs || DEFAULT_LABS.map(name => ({ name, result: '', date: '', pageNumber: '' }))
    setLabRows(savedLabs)
    setForm(init)
  }, [surrogate, profileData, clinicData, summary])

  function updateField(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function updatePregnancy(idx, key, value) {
    setForm(f => {
      const pregnancies = [...f.pregnancies]
      pregnancies[idx] = { ...pregnancies[idx], [key]: value }
      return { ...f, pregnancies }
    })
  }

  function updateLabRow(idx, key, value) {
    setLabRows(prev => {
      const rows = [...prev]
      rows[idx] = { ...rows[idx], [key]: value }
      return rows
    })
  }

  function addLabRow() {
    setLabRows(prev => [...prev, { name: '', result: '', date: '', pageNumber: '' }])
  }

  function removeLabRow(idx) {
    setLabRows(prev => prev.filter((_, i) => i !== idx))
  }

  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSave() {
    onSave({ ...form, labs: labRows })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-stone-50 flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-600">GC Summary of Records</p>
        <Button size="sm" className="gap-1.5 h-7 text-xs" style={{ backgroundColor: '#283693' }} onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} Save
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* General Medical History */}
        <SectionHeader title="General Information" open={openSections.general} onToggle={() => toggleSection('general')} />
        {openSections.general && (
          <div className="space-y-3 pl-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Name (Last, First)" value={form.name} onChange={v => updateField('name', v)} />
              <FormField label="DOB" value={form.dob} onChange={v => updateField('dob', v)} type="date" />
              <FormField label="Marital Status" value={form.maritalStatus} onChange={v => updateField('maritalStatus', v)} />
              <div className="grid grid-cols-3 gap-2">
                <FormField label="HT" value={form.height} onChange={v => updateField('height', v)} />
                <FormField label="WT" value={form.weight} onChange={v => updateField('weight', v)} />
                <FormField label="BMI" value={form.bmi} onChange={v => updateField('bmi', v)} />
              </div>
            </div>
            <FormField label="Current Medications" value={form.currentMedications} onChange={v => updateField('currentMedications', v)} rows={2} placeholder="(PG.)" />
            <FormField label="Allergies" value={form.allergies} onChange={v => updateField('allergies', v)} />
            <FormField label="Pertinent Medical History" value={form.pertinentMedicalHistory} onChange={v => updateField('pertinentMedicalHistory', v)} rows={3} />
            <FormField label="Surgical History" value={form.surgicalHistory} onChange={v => updateField('surgicalHistory', v)} rows={2} />

            <p className="text-[10px] font-bold text-stone-500 uppercase mt-3">Social History</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Occupation" value={form.occupation} onChange={v => updateField('occupation', v)} />
              <FormField label="Lives with" value={form.livesWith} onChange={v => updateField('livesWith', v)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Alcohol" value={form.alcohol} onChange={v => updateField('alcohol', v)} />
              <FormField label="Tobacco" value={form.tobacco} onChange={v => updateField('tobacco', v)} />
              <FormField label="Recreational Drugs" value={form.recreationalDrugs} onChange={v => updateField('recreationalDrugs', v)} />
            </div>

            <p className="text-[10px] font-bold text-stone-500 uppercase mt-3">COVID-19</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ever tested positive" value={form.covidPositive} onChange={v => updateField('covidPositive', v)} />
              <FormField label="COVID-19 Vaccine" value={form.covidVaccine} onChange={v => updateField('covidVaccine', v)} />
            </div>

            <p className="text-[10px] font-bold text-stone-500 uppercase mt-3">Gynecologic History</p>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="LMP" value={form.lmp} onChange={v => updateField('lmp', v)} />
              <FormField label="Cycle Length" value={form.cycleLength} onChange={v => updateField('cycleLength', v)} />
              <FormField label="Menarche" value={form.menarche} onChange={v => updateField('menarche', v)} />
            </div>
            <FormField label="Current Contraception" value={form.contraception} onChange={v => updateField('contraception', v)} />
            <div className="grid grid-cols-3 gap-3">
              <FormField label="History of STD" value={form.stdHistory} onChange={v => updateField('stdHistory', v)} />
              <FormField label="GYN Problems" value={form.gynProblems} onChange={v => updateField('gynProblems', v)} />
              <FormField label="Infertility History" value={form.infertilityHistory} onChange={v => updateField('infertilityHistory', v)} />
            </div>
          </div>
        )}

        {/* Obstetrical History */}
        <SectionHeader title={`Obstetrical History (${form.numberOfPregnancies || 0} pregnancies)`} open={openSections.pregnancies} onToggle={() => toggleSection('pregnancies')} />
        {openSections.pregnancies && (
          <div className="space-y-4 pl-2">
            <FormField label="Obstetric Summary (G T P A L)" value={form.obstetricSummary} onChange={v => updateField('obstetricSummary', v)} placeholder="G4 T3 P0 A1 L3 (3 vaginal 0 cesarean)" />

            {(form.pregnancies || []).map((preg, i) => (
              <div key={i} className="rounded-lg border border-stone-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#283693]">{preg.label || `G${i + 1}`}</p>
                  {preg.outcome && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${preg.skipDetails ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{preg.outcome}</span>}
                </div>

                {preg.skipDetails ? (
                  <div className="space-y-2">
                    <p className="text-xs text-stone-400 italic">No prenatal care received — details not required</p>
                    <FormField label="Notes" value={preg.notes} onChange={v => updatePregnancy(i, 'notes', v)} rows={2} placeholder="Additional notes..." />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <FormField label="Page Ref" value={preg.pageRef} onChange={v => updatePregnancy(i, 'pageRef', v)} placeholder="(pg.)" />
                      <FormField label="Date of Delivery" value={preg.dateOfDelivery} onChange={v => updatePregnancy(i, 'dateOfDelivery', v)} type="date" />
                      <FormField label="Gestational Age" value={preg.gestationalAge} onChange={v => updatePregnancy(i, 'gestationalAge', v)} placeholder="38w 2d" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField label="Type of Delivery" value={preg.typeOfDelivery} onChange={v => updatePregnancy(i, 'typeOfDelivery', v)} />
                      <FormField label="GBS" value={preg.gbs} onChange={v => updatePregnancy(i, 'gbs', v)} placeholder="Negative/Positive (PG.)" />
                    </div>
                    <FormField label="Glucose Screen" value={preg.glucoseScreen} onChange={v => updatePregnancy(i, 'glucoseScreen', v)} placeholder="Normal/Abnormal 1-hour/50gm = __ mg/DL" />
                    <div className="grid grid-cols-4 gap-2">
                      <FormField label="Fasting" value={preg.glucoseValues?.fasting} onChange={v => updatePregnancy(i, 'glucoseValues', { ...preg.glucoseValues, fasting: v })} placeholder="mg/dl" />
                      <FormField label="1hr" value={preg.glucoseValues?.oneHr} onChange={v => updatePregnancy(i, 'glucoseValues', { ...preg.glucoseValues, oneHr: v })} placeholder="mg/dl" />
                      <FormField label="2hr" value={preg.glucoseValues?.twoHr} onChange={v => updatePregnancy(i, 'glucoseValues', { ...preg.glucoseValues, twoHr: v })} placeholder="mg/dl" />
                      <FormField label="3hr" value={preg.glucoseValues?.threeHr} onChange={v => updatePregnancy(i, 'glucoseValues', { ...preg.glucoseValues, threeHr: v })} placeholder="mg/dl" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <FormField label="BP's" value={preg.bps} onChange={v => updatePregnancy(i, 'bps', v)} />
                      <FormField label="Anesthesia" value={preg.anesthesia} onChange={v => updatePregnancy(i, 'anesthesia', v)} />
                      <FormField label="Weight Gained" value={preg.weightGained} onChange={v => updatePregnancy(i, 'weightGained', v)} placeholder="lbs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField label="Infant Birth Weight" value={preg.infantBirthWeight} onChange={v => updatePregnancy(i, 'infantBirthWeight', v)} />
                      <FormField label="GC Cycle" value={preg.gcCycle} onChange={v => updatePregnancy(i, 'gcCycle', v)} />
                    </div>
                    <FormField label="Complications" value={preg.complications} onChange={v => updatePregnancy(i, 'complications', v)} rows={2} />
                    <div className="grid grid-cols-2 gap-2">
                      <FormField label="APGAR" value={preg.apgar} onChange={v => updatePregnancy(i, 'apgar', v)} placeholder="8/9" />
                      <FormField label="Estimated Blood Loss" value={preg.ebl} onChange={v => updatePregnancy(i, 'ebl', v)} placeholder="ml" />
                    </div>
                    <FormField label="Delivery Note / Complications" value={preg.deliveryComplications} onChange={v => updatePregnancy(i, 'deliveryComplications', v)} rows={2} />
                    <FormField label="Postpartum Complications" value={preg.postpartumComplications} onChange={v => updatePregnancy(i, 'postpartumComplications', v)} rows={2} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Labs */}
        <SectionHeader title="Most Recent Labs" open={openSections.labs} onToggle={() => toggleSection('labs')} />
        {openSections.labs && (
          <div className="space-y-2 pl-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="text-left py-2 px-1 text-[10px] font-semibold text-stone-400 uppercase w-[35%]">Test</th>
                  <th className="text-left py-2 px-1 text-[10px] font-semibold text-stone-400 uppercase w-[25%]">Result</th>
                  <th className="text-left py-2 px-1 text-[10px] font-semibold text-stone-400 uppercase w-[20%]">Date</th>
                  <th className="text-left py-2 px-1 text-[10px] font-semibold text-stone-400 uppercase w-[15%]">Page #</th>
                  <th className="w-[5%]" />
                </tr>
              </thead>
              <tbody>
                {labRows.map((lab, i) => (
                  <tr key={i} className="border-b border-stone-100">
                    <td className="py-1 px-1"><Input value={lab.name} onChange={e => updateLabRow(i, 'name', e.target.value)} className="h-7 text-xs" /></td>
                    <td className="py-1 px-1"><Input value={lab.result} onChange={e => updateLabRow(i, 'result', e.target.value)} className="h-7 text-xs" /></td>
                    <td className="py-1 px-1"><Input value={lab.date} onChange={e => updateLabRow(i, 'date', e.target.value)} className="h-7 text-xs" placeholder="MM/DD/YY" /></td>
                    <td className="py-1 px-1"><Input value={lab.pageNumber} onChange={e => updateLabRow(i, 'pageNumber', e.target.value)} className="h-7 text-xs" /></td>
                    <td className="py-1 px-1">
                      <button onClick={() => removeLabRow(i)} className="text-stone-300 hover:text-red-500"><Trash2 className="size-3" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addLabRow} className="text-xs text-[#283693] hover:underline flex items-center gap-1">
              <Plus className="size-3" /> Add Lab
            </button>
          </div>
        )}

        {/* OB Clearance & Reviewer */}
        <div className="space-y-3 pt-4 border-t">
          <FormField label="OB Clearance" value={form.obClearance} onChange={v => updateField('obClearance', v)} rows={2} />
          <FormField label="Medical records reviewed by" value={form.reviewedBy} onChange={v => updateField('reviewedBy', v)} placeholder="Name, credentials" />
        </div>
      </div>
    </div>
  )
}

// ── Main Workspace ─────────────────────────────────────
export default function RecordsSummaryWorkspace() {
  const { id } = useParams()
  const { currentUser } = useRole()
  const [surrogate, setSurrogate] = useState(null)
  const [documents, setDocuments] = useState([])
  const [profileData, setProfileData] = useState(null)
  const [clinicData, setClinicData] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id || !supabase) return
    Promise.all([
      // Load surrogate info
      supabase.from('intake_submissions').select('*').eq('id', id).single(),
      // Load documents
      fetchCaseDocuments(id),
      // Load saved summary
      getAppConfig(`${SUMMARY_KEY_PREFIX}${id}`),
    ]).then(([{ data: intake }, docs, saved]) => {
      if (intake) {
        setSurrogate({ id: intake.id, name: intake.applicant_name, email: intake.applicant_email, dob: intake.answers?.dob, answers: intake.answers })
        setClinicData(intake.answers?._clinicHospital || {})
        // Try loading profile from localStorage or answers
        try {
          const raw = localStorage.getItem(`abc-surrogate-profile-${intake.id}`)
          if (raw) setProfileData(JSON.parse(raw))
        } catch {}
      }
      setDocuments(docs || [])
      setSummary(saved || null)
    }).catch(err => console.error('Failed to load workspace:', err))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSave(formData) {
    setSaving(true)
    try {
      await setAppConfig(`${SUMMARY_KEY_PREFIX}${id}`, formData)
      setSummary(formData)
    } catch (err) {
      console.error('Save failed:', err)
      alert('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-stone-400">Loading workspace...</div>
  if (!surrogate) return <div className="p-8 text-center text-stone-400">Surrogate not found.</div>

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
        <div className="flex items-center gap-3">
          <Link to="/records-summary" className="text-stone-400 hover:text-stone-600">
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <p className="text-sm font-bold text-stone-800">{surrogate.name}</p>
            <p className="text-[10px] text-stone-400">{surrogate.email} · Records Summary</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
            <Download className="size-3" /> Export PDF
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ backgroundColor: '#16a34a' }}>
            <CheckCircle2 className="size-3" /> Mark Complete
          </Button>
        </div>
      </div>

      {/* Split screen */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document Viewer */}
        <div className="w-1/2 border-r flex flex-col overflow-hidden">
          <DocumentPanel documents={documents} surrogateId={id} />
        </div>

        {/* Right: Summary Form */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <SummaryForm
            surrogateId={id}
            surrogate={surrogate}
            profileData={profileData}
            clinicData={clinicData}
            summary={summary}
            onSave={handleSave}
            saving={saving}
          />
        </div>
      </div>
    </div>
  )
}

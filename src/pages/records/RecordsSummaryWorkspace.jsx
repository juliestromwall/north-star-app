import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, ChevronDown, ChevronRight, Save, Loader2, Download, Trash2, Plus, Merge, Eye, X, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useRole } from '@/context/RoleContext'
import { fetchCaseDocuments, getAppConfig, setAppConfig, fetchSurrogateProfileByEmail } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

const SUMMARY_KEY_PREFIX = 'records_summary_'

const DEFAULT_LABS = [
  'Blood Type', 'Antibody Screen', 'Hgb/Hct', 'PAP', 'Rubella Titer',
  'Varicella Titer', 'CMV IgG', 'Hepatitis B Surface Antibody',
  'Hepatitis B Surface Antigen', 'Syphilis/RPR', 'HIV 1 & 2',
  'Hepatitis C', 'Chlamydia', 'Gonorrhea', 'OB Clearance',
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
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeSelected, setMergeSelected] = useState(new Set())
  const [merging, setMerging] = useState(false)
  const [pageRemoveMode, setPageRemoveMode] = useState(false)
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [removedPages, setRemovedPages] = useState(new Set())
  const [removingPages, setRemovingPages] = useState(false)

  const pdfDocs = documents.filter(d => d.file_type === 'application/pdf')
  const allDocs = documents

  useEffect(() => {
    if (selectedDoc?.public_url) setPreviewUrl(selectedDoc.public_url)
  }, [selectedDoc])

  // Get page count when entering page remove mode
  useEffect(() => {
    if (!pageRemoveMode || !selectedDoc?.public_url || selectedDoc.file_type !== 'application/pdf') return
    ;(async () => {
      try {
        const { PDFDocument } = await import('pdf-lib')
        const res = await fetch(selectedDoc.public_url)
        const bytes = await res.arrayBuffer()
        const pdf = await PDFDocument.load(bytes)
        setPdfPageCount(pdf.getPageCount())
        setRemovedPages(new Set())
      } catch (err) { console.error('Failed to load PDF:', err); setPdfPageCount(0) }
    })()
  }, [pageRemoveMode, selectedDoc])

  async function handleMerge() {
    if (mergeSelected.size < 2) return
    setMerging(true)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const mergedPdf = await PDFDocument.create()
      const selectedDocs = allDocs.filter(d => mergeSelected.has(d.id))

      for (const doc of selectedDocs) {
        try {
          const res = await fetch(doc.public_url)
          const bytes = await res.arrayBuffer()
          if (doc.file_type === 'application/pdf') {
            const srcPdf = await PDFDocument.load(bytes)
            const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices())
            pages.forEach(p => mergedPdf.addPage(p))
          } else if (doc.file_type?.startsWith('image/')) {
            const page = mergedPdf.addPage()
            let img
            if (doc.file_type === 'image/png') img = await mergedPdf.embedPng(bytes)
            else img = await mergedPdf.embedJpg(bytes)
            const { width, height } = img.scale(Math.min(page.getWidth() / img.width, page.getHeight() / img.height))
            page.drawImage(img, { x: (page.getWidth() - width) / 2, y: (page.getHeight() - height) / 2, width, height })
          }
        } catch (err) { console.error('Failed to add doc:', doc.file_name, err) }
      }

      const mergedBytes = await mergedPdf.save()
      const blob = new Blob([mergedBytes], { type: 'application/pdf' })
      const fileName = `Merged_Records_${Date.now()}.pdf`
      const path = `${surrogateId}/medical-records/${fileName}`

      if (supabase) {
        await supabase.storage.from('case-documents').upload(path, blob, { contentType: 'application/pdf' })
        const { data: urlData } = supabase.storage.from('case-documents').getPublicUrl(path)
        await supabase.from('case_documents').insert({
          surrogate_id: surrogateId, category: 'medical-records',
          file_name: fileName, file_type: 'application/pdf', file_size: mergedBytes.length,
          storage_path: path, public_url: urlData.publicUrl, uploaded_by: 'Records Summary (Merge)',
        })
        // Refresh — parent will need to reload
        window.location.reload()
      }
    } catch (err) { console.error('Merge failed:', err); alert('Merge failed.') }
    finally { setMerging(false) }
  }

  async function handleRemovePages() {
    if (removedPages.size === 0 || !selectedDoc) return
    setRemovingPages(true)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const res = await fetch(selectedDoc.public_url)
      const bytes = await res.arrayBuffer()
      const srcPdf = await PDFDocument.load(bytes)
      const newPdf = await PDFDocument.create()

      const keepIndices = srcPdf.getPageIndices().filter(i => !removedPages.has(i))
      if (keepIndices.length === 0) { alert('Cannot remove all pages.'); setRemovingPages(false); return }

      const pages = await newPdf.copyPages(srcPdf, keepIndices)
      pages.forEach(p => newPdf.addPage(p))

      const newBytes = await newPdf.save()
      const blob = new Blob([newBytes], { type: 'application/pdf' })

      // Save original as backup (if not already backed up)
      if (supabase && !selectedDoc.file_name?.startsWith('[Original]')) {
        const origPath = `${surrogateId}/medical-records/originals/${selectedDoc.file_name}`
        await supabase.storage.from('case-documents').upload(origPath, await (await fetch(selectedDoc.public_url)).blob(), { contentType: 'application/pdf', upsert: true })
        await supabase.from('case_documents').insert({
          surrogate_id: surrogateId, category: 'medical-records',
          file_name: `[Original] ${selectedDoc.file_name}`,
          file_type: 'application/pdf', storage_path: origPath,
          public_url: supabase.storage.from('case-documents').getPublicUrl(origPath).data?.publicUrl,
          uploaded_by: 'Records Summary (Backup)',
        })
      }

      // Overwrite the current doc
      if (supabase) {
        const newPath = selectedDoc.storage_path || `${surrogateId}/medical-records/${selectedDoc.file_name}`
        await supabase.storage.from('case-documents').upload(newPath, blob, { contentType: 'application/pdf', upsert: true })
        const { data: urlData } = supabase.storage.from('case-documents').getPublicUrl(newPath)
        await supabase.from('case_documents').update({ public_url: urlData.publicUrl, file_size: newBytes.length }).eq('id', selectedDoc.id)
        window.location.reload()
      }
    } catch (err) { console.error('Page removal failed:', err); alert('Failed to remove pages.') }
    finally { setRemovingPages(false) }
  }

  function toggleMergeDoc(docId) {
    setMergeSelected(prev => { const s = new Set(prev); if (s.has(docId)) s.delete(docId); else s.add(docId); return s })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Doc list header */}
      <div className="p-3 border-b bg-stone-50 flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-600">Documents ({allDocs.length})</p>
        <div className="flex items-center gap-1">
          {!selectedDoc && (
            <button onClick={() => { setMergeMode(!mergeMode); setMergeSelected(new Set()) }}
              className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${mergeMode ? 'bg-[#283693] text-white' : 'text-stone-500 hover:bg-stone-200'}`}>
              <Merge className="size-3 inline mr-1" />{mergeMode ? 'Cancel' : 'Merge'}
            </button>
          )}
          {mergeMode && mergeSelected.size >= 2 && (
            <button onClick={handleMerge} disabled={merging}
              className="text-[10px] px-2 py-1 rounded font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {merging ? 'Merging...' : `Merge ${mergeSelected.size}`}
            </button>
          )}
        </div>
      </div>

      {!selectedDoc ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {allDocs.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-8">No documents found</p>
          )}
          {allDocs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2">
              {mergeMode && doc.file_type === 'application/pdf' && (
                <input type="checkbox" checked={mergeSelected.has(doc.id)} onChange={() => toggleMergeDoc(doc.id)} className="size-3.5 accent-[#283693] shrink-0 ml-1" />
              )}
              <button onClick={() => { if (!mergeMode) setSelectedDoc(doc) }}
                className={`flex-1 text-left p-2.5 rounded-lg hover:bg-stone-100 transition-colors flex items-center gap-2 ${mergeMode && !doc.file_type?.includes('pdf') ? 'opacity-30' : ''}`}>
                <FileText className="size-4 text-stone-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-stone-700 truncate">{doc.file_name}</p>
                  <p className="text-[10px] text-stone-400">{doc.category} · {formatDate(doc.created_at)}</p>
                </div>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="p-2 border-b flex items-center justify-between">
            <button onClick={() => { setSelectedDoc(null); setPreviewUrl(null); setPageRemoveMode(false); setRemovedPages(new Set()) }} className="text-xs text-[#283693] hover:underline flex items-center gap-1">
              <ArrowLeft className="size-3" /> Back to list
            </button>
            <div className="flex items-center gap-1">
              {selectedDoc.file_type === 'application/pdf' && !pageRemoveMode && (
                <button onClick={() => setPageRemoveMode(true)} className="text-[10px] px-2 py-1 rounded text-stone-500 hover:bg-stone-200 font-medium">
                  <Trash2 className="size-3 inline mr-1" />Remove Pages
                </button>
              )}
              <a href={selectedDoc.public_url} target="_blank" rel="noopener noreferrer" className="text-xs text-stone-400 hover:text-stone-600 p-1">
                <Download className="size-3.5" />
              </a>
            </div>
          </div>

          {/* Page removal mode */}
          {pageRemoveMode && (
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-amber-800">Select pages to remove ({removedPages.size} selected)</p>
                <div className="flex gap-1">
                  <button onClick={() => { setPageRemoveMode(false); setRemovedPages(new Set()) }} className="text-[10px] px-2 py-1 rounded bg-white border border-stone-200 text-stone-600">Cancel</button>
                  <button onClick={handleRemovePages} disabled={removedPages.size === 0 || removingPages}
                    className="text-[10px] px-2 py-1 rounded bg-red-600 text-white font-medium disabled:opacity-50">
                    {removingPages ? 'Removing...' : `Remove ${removedPages.size} Page${removedPages.size !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: pdfPageCount }, (_, i) => (
                  <button key={i} onClick={() => setRemovedPages(prev => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s })}
                    className={`size-8 rounded text-[10px] font-medium border transition-colors ${removedPages.has(i) ? 'bg-red-500 text-white border-red-600' : 'bg-white text-stone-600 border-stone-200 hover:border-red-300'}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-amber-600 mt-1.5">Original document will be backed up before changes.</p>
            </div>
          )}

          <p className="text-xs font-medium text-stone-700 px-3 py-1.5 bg-stone-50 border-b truncate">{selectedDoc.file_name}</p>
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
const SummaryForm = forwardRef(function SummaryForm({ surrogateId, surrogate, profileData, clinicData, summary, onSave, saving }, ref) {
  const [form, setForm] = useState({})
  const [openSections, setOpenSections] = useState({ general: true, pregnancies: true, labs: true })
  const [labRows, setLabRows] = useState([])

  useImperativeHandle(ref, () => ({
    getFormData: () => ({ ...form, labs: labRows }),
  }))

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
      bmi: saved.bmi || (() => {
        const ft = parseInt(personal.heightFt)
        const inches = parseInt(personal.heightIn) || 0
        const wt = parseFloat(personal.weight)
        if (ft && wt) {
          const totalInches = ft * 12 + inches
          return ((wt / (totalInches * totalInches)) * 703).toFixed(1)
        }
        return ''
      })(),
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
      // Pregnancies — always re-derive flags from source data
      numberOfPregnancies: saved.numberOfPregnancies || numPreg,
      pregnancies: (() => {
        const NON_DELIVERY_OUTCOMES = ['miscarriage', 'ectopic', 'ectopic pregnancy', 'termination', 'chemical', 'chemical pregnancy']
        const base = saved.pregnancies || pregnancies.map((p, i) => ({
          label: `G${i + 1}`,
          pageRef: '',
          dateOfDelivery: p.dob || '',
          outcome: p.outcome || '',
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
          infantSex: p.sex || '',
          complications: p.complications || '',
          gcCycle: p.wasSurrogacy === 'yes' ? 'Yes' : 'No',
          deliveryNote: '',
          deliveryComplications: '',
          apgar: '',
          ebl: '',
          postpartumComplications: 'Unremarkable hospital postpartum course\nPer patient no postpartum complications',
          notes: p.complications || '',
        }))
        // Always re-derive flags from clinic data
        return base.map((preg, i) => {
          const clinicPreg = (clinic.pregnancies || [])[i] || {}
          const profilePreg = pregnancies[i] || {}
          const outcome = preg.outcome || profilePreg.outcome || ''
          const isNonDelivery = NON_DELIVERY_OUTCOMES.includes(outcome.toLowerCase())
          const hadPrenatalCare = clinicPreg.receivedPrenatalCare === 'yes'
          const skipDetails = isNonDelivery && !hadPrenatalCare
          return { ...preg, isNonDelivery, hadPrenatalCare, skipDetails }
        })
      })(),
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
        <p className="text-xs font-semibold text-stone-600">GC Medical Records Summary</p>
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
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Alcohol" value={form.alcohol} onChange={v => updateField('alcohol', v)} />
              <FormField label="Tobacco" value={form.tobacco} onChange={v => updateField('tobacco', v)} />
              <FormField label="Recreational Drugs" value={form.recreationalDrugs} onChange={v => updateField('recreationalDrugs', v)} />
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
            {(form.pregnancies || []).map((preg, i) => {
              const isNonDel = preg.isNonDelivery
              const limitedFields = isNonDel && preg.hadPrenatalCare
              return (
              <div key={i} className="rounded-lg border border-stone-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#283693]">{preg.label || `G${i + 1}`}</p>
                  {preg.outcome && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${preg.skipDetails ? 'bg-amber-100 text-amber-700' : isNonDel ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{preg.outcome}</span>}
                </div>

                {preg.skipDetails ? (
                  <div className="space-y-2">
                    <p className="text-xs text-stone-400 italic">No prenatal care received — details not required</p>
                    <FormField label="Notes / Details" value={preg.notes} onChange={v => updatePregnancy(i, 'notes', v)} rows={3} placeholder="Details about the miscarriage, termination, or other outcome..." />
                  </div>
                ) : limitedFields ? (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-600 italic">Prenatal care received — limited fields</p>
                    <div className="grid grid-cols-3 gap-2">
                      <FormField label="Page Ref" value={preg.pageRef} onChange={v => updatePregnancy(i, 'pageRef', v)} placeholder="(pg.)" />
                      <FormField label="Date" value={preg.dateOfDelivery} onChange={v => updatePregnancy(i, 'dateOfDelivery', v)} type="date" />
                      <FormField label="Gestational Age" value={preg.gestationalAge} onChange={v => updatePregnancy(i, 'gestationalAge', v)} placeholder="8w 2d" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField label="GBS" value={preg.gbs} onChange={v => updatePregnancy(i, 'gbs', v)} placeholder="Negative/Positive" />
                      <FormField label="Glucose Screen" value={preg.glucoseScreen} onChange={v => updatePregnancy(i, 'glucoseScreen', v)} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <FormField label="GC Cycle" value={preg.gcCycle} onChange={v => updatePregnancy(i, 'gcCycle', v)} />
                      <FormField label="BP's" value={preg.bps} onChange={v => updatePregnancy(i, 'bps', v)} />
                      <FormField label="Weight Gained" value={preg.weightGained} onChange={v => updatePregnancy(i, 'weightGained', v)} placeholder="lbs" />
                    </div>
                    <FormField label="Notes" value={preg.complications} onChange={v => updatePregnancy(i, 'complications', v)} rows={2} />
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
                    <div className="grid grid-cols-3 gap-2">
                      <FormField label="Infant Birth Weight" value={preg.infantBirthWeight} onChange={v => updatePregnancy(i, 'infantBirthWeight', v)} />
                      <FormField label="Infant Sex" value={preg.infantSex} onChange={v => updatePregnancy(i, 'infantSex', v)} placeholder="Male / Female" />
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
              )
            })}
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

        {/* Reviewer */}
        <div className="space-y-3 pt-4 border-t">
          <FormField label="Medical records reviewed by" value={form.reviewedBy} onChange={v => updateField('reviewedBy', v)} placeholder="Name, credentials" />
        </div>
      </div>
    </div>
  )
})

// ── Summary Preview / PDF Export ────────────────────────
function InfoGridRow({ label, value, span }) {
  return (
    <div style={{ backgroundColor: 'white', padding: '5px 12px', ...(span ? { gridColumn: `span ${span}` } : {}) }}>
      <div style={{ fontSize: 8, color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 0 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: value ? '#1c1917' : '#d6d3d1', whiteSpace: 'pre-wrap' }}>{value || '—'}</div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <h2 style={{ fontSize: 10, fontWeight: 700, color: '#ed148c', margin: 0, marginTop: 14, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '1px' }}>{children}</h2>
  )
}

function PregnancyBanner({ label, outcome, skipDetails, preg }) {
  const color = skipDetails ? '#d97706' : '#283693'
  function fmtDate(d) {
    if (!d) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) { const [y, m, day] = d.split('-'); return `${m}/${day}/${y}` }
    return d
  }
  const infoItems = []
  if (outcome) infoItems.push(outcome)
  if (preg?.dateOfDelivery) infoItems.push(fmtDate(preg.dateOfDelivery))
  if (preg?.gestationalAge) infoItems.push(preg.gestationalAge)
  if (preg?.infantBirthWeight) infoItems.push(preg.infantBirthWeight)
  if (preg?.infantSex) infoItems.push(preg.infantSex)
  if (preg?.typeOfDelivery) infoItems.push(preg.typeOfDelivery)

  return (
    <div style={{ marginTop: 16, marginBottom: 8, padding: '8px 14px', borderRadius: 8, background: skipDetails ? 'linear-gradient(135deg, #fffbeb, #fef3c7)' : '#283693' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', lineHeight: '22px' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: skipDetails ? '#92400e' : '#fff', letterSpacing: '0.3px' }}>{label}</span>
        {infoItems.map((item, i) => (
          <span key={i} style={{ fontSize: 10, fontWeight: 600, color: skipDetails ? '#92400e' : 'rgba(255,255,255,0.9)', backgroundColor: skipDetails ? '#fef3c750' : 'rgba(255,255,255,0.15)', padding: '2px 10px', borderRadius: 4, display: 'inline-block', verticalAlign: 'middle' }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function SummaryPreview({ data, surrogateName, onClose, onExport, exporting }) {
  if (!data) return null
  const pregnancies = data.pregnancies || []
  const labs = data.labs || []

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-xl shadow-2xl max-w-[816px] w-full mx-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b sticky top-0 bg-white rounded-t-xl z-10">
          <p className="text-sm font-semibold text-stone-700">Preview — GC Medical Records Summary</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={onExport} disabled={exporting}>
              {exporting ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />} {exporting ? 'Generating...' : 'Download PDF'}
            </Button>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X className="size-4" /></button>
          </div>
        </div>

        {/* Printable content — match sheet style */}
        <div id="summary-preview-content" style={{ padding: '32px 40px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#1c1917', fontSize: 12, lineHeight: 1.4 }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img src="/abc-logo-horz.png" alt="Abundant Beginnings Co." style={{ height: 44, marginBottom: 8, display: 'inline-block' }} crossOrigin="anonymous" />
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#283693', margin: 0, letterSpacing: '0.3px' }}>Gestational Carrier Medical Records Summary</h1>
          </div>
          <div style={{ height: 1.5, background: '#283693', borderRadius: 1, marginBottom: 16 }} />

          {/* Patient Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, backgroundColor: '#e7e5e4', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4', marginBottom: 6 }}>
            <InfoGridRow label="Name" value={data.name} span={2} />
            <InfoGridRow label="DOB" value={data.dob ? new Date(data.dob + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''} />
            <InfoGridRow label="Marital Status" value={data.maritalStatus} />
            <InfoGridRow label="Height / Weight / BMI" value={[data.height, data.weight, data.bmi ? `BMI ${data.bmi}` : ''].filter(Boolean).join('  ·  ')} />
          </div>

          {/* General Medical History */}
          <div data-section="medical">
            <SectionLabel>General Medical History</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, backgroundColor: '#e7e5e4', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
              <InfoGridRow label="Current Medications" value={data.currentMedications} span={2} />
              <InfoGridRow label="Allergies" value={data.allergies} span={2} />
              <InfoGridRow label="Pertinent Medical History" value={data.pertinentMedicalHistory} span={2} />
              <InfoGridRow label="Surgical History" value={data.surgicalHistory} span={2} />
            </div>
          </div>

          {/* Social History */}
          <div data-section="social">
            <SectionLabel>Social History</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, backgroundColor: '#e7e5e4', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
              <InfoGridRow label="Alcohol" value={data.alcohol} />
              <InfoGridRow label="Tobacco" value={data.tobacco} />
              <InfoGridRow label="Recreational Drugs" value={data.recreationalDrugs} />
            </div>
          </div>

          {/* GYN History */}
          <div data-section="gyn">
            <SectionLabel>Gynecologic History</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, backgroundColor: '#e7e5e4', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
              <InfoGridRow label="LMP" value={data.lmp} />
              <InfoGridRow label="Cycle Length" value={data.cycleLength ? `${data.cycleLength} days` : ''} />
              <InfoGridRow label="Menarche" value={data.menarche} />
              <InfoGridRow label="Current Contraception" value={data.contraception} />
              <InfoGridRow label="History of STD" value={data.stdHistory} />
              <InfoGridRow label="GYN Problems" value={data.gynProblems} />
              <InfoGridRow label="Infertility History" value={data.infertilityHistory} span={3} />
            </div>
          </div>

          {/* Obstetrical History */}
          <SectionLabel>Obstetrical History</SectionLabel>

          {pregnancies.map((preg, i) => {
            const isNonDel = preg.isNonDelivery
            const limitedFields = isNonDel && preg.hadPrenatalCare
            return (
            <div key={i} data-section={`preg-${i}`}>
              <PregnancyBanner label={preg.label || `G${i + 1}`} outcome={preg.outcome} skipDetails={preg.skipDetails} preg={preg} />
              {preg.skipDetails ? (
                <div style={{ padding: '6px 12px', backgroundColor: '#fffbeb', borderRadius: 6, border: '1px solid #fef3c7', fontSize: 11, color: '#92400e', fontStyle: 'italic' }}>
                  No prenatal care received{preg.notes ? ` — ${preg.notes}` : ''}
                </div>
              ) : limitedFields ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, backgroundColor: '#e7e5e4', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
                  <InfoGridRow label="GBS" value={preg.gbs} />
                  <InfoGridRow label="Glucose Screen" value={preg.glucoseScreen} />
                  <InfoGridRow label="GC Cycle" value={preg.gcCycle} />
                  <InfoGridRow label="BP's" value={preg.bps} />
                  <InfoGridRow label="Weight Gained" value={preg.weightGained} />
                  <InfoGridRow label="Notes" value={preg.complications} span={3} />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, backgroundColor: '#e7e5e4', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
                  <InfoGridRow label="GBS" value={preg.gbs} />
                  <InfoGridRow label="Glucose Screen" value={preg.glucoseScreen} />
                  <InfoGridRow label="GC Cycle" value={preg.gcCycle} />
                  {(preg.glucoseValues?.fasting || preg.glucoseValues?.oneHr) && (
                    <>
                      <InfoGridRow label="Fasting" value={preg.glucoseValues?.fasting ? `${preg.glucoseValues.fasting} mg/dl` : ''} />
                      <InfoGridRow label="1hr" value={preg.glucoseValues?.oneHr ? `${preg.glucoseValues.oneHr} mg/dl` : ''} />
                      <InfoGridRow label="2hr / 3hr" value={[preg.glucoseValues?.twoHr, preg.glucoseValues?.threeHr].filter(Boolean).join(' / ') + (preg.glucoseValues?.twoHr ? ' mg/dl' : '')} />
                    </>
                  )}
                  <InfoGridRow label="BP's" value={preg.bps} />
                  <InfoGridRow label="Anesthesia" value={preg.anesthesia} />
                  <InfoGridRow label="Weight Gained" value={preg.weightGained} />
                  <InfoGridRow label="APGAR" value={preg.apgar} />
                  <InfoGridRow label="Est. Blood Loss" value={preg.ebl} />
                  <InfoGridRow label="Complications" value={preg.complications} span={3} />
                  <InfoGridRow label="Delivery Complications" value={preg.deliveryComplications} span={3} />
                  <InfoGridRow label="Postpartum" value={preg.postpartumComplications} span={3} />
                </div>
              )}
            </div>
            )
          })}

          {/* Labs */}
          <div data-section="labs">
          <SectionLabel>Most Recent Labs</SectionLabel>
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f4' }}>
                  <th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 8, fontWeight: 600, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Test</th>
                  <th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 8, fontWeight: 600, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Result</th>
                  <th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 8, fontWeight: 600, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '5px 10px', fontSize: 8, fontWeight: 600, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Page #</th>
                </tr>
              </thead>
              <tbody>
                {labs.map((lab, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #e7e5e4' }}>
                    <td style={{ padding: '4px 10px', fontWeight: 500 }}>{lab.name}</td>
                    <td style={{ padding: '4px 10px' }}>{lab.result || <span style={{ color: '#d6d3d1' }}>—</span>}</td>
                    <td style={{ padding: '4px 10px', color: '#78716c' }}>{lab.date || ''}</td>
                    <td style={{ padding: '4px 10px', color: '#78716c' }}>{lab.pageNumber || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>

          {/* Reviewer */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1.5px solid #283693', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 10, color: '#78716c' }}>
              <span style={{ fontWeight: 600 }}>Medical records reviewed by:</span> {data.reviewedBy || '—'}
            </div>
            <img src="/abc-logo-horz.png" alt="" style={{ height: 20, opacity: 0.3 }} crossOrigin="anonymous" />
          </div>
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
  const [previewOpen, setPreviewOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const formRef = useRef(null) // ref to get current form data

  useEffect(() => {
    if (!id || !supabase) return
    Promise.all([
      // Load surrogate info
      supabase.from('intake_submissions').select('*').eq('id', id).single(),
      // Load documents
      fetchCaseDocuments(id),
      // Load saved summary
      getAppConfig(`${SUMMARY_KEY_PREFIX}${id}`),
    ]).then(async ([{ data: intake }, docs, saved]) => {
      if (intake) {
        setSurrogate({ id: intake.id, name: intake.applicant_name, email: intake.applicant_email, dob: intake.answers?.dob, answers: intake.answers })
        setClinicData(intake.answers?._clinicHospital || {})
        // Fetch profile from Supabase
        if (intake.applicant_email) {
          try {
            const profileRow = await fetchSurrogateProfileByEmail(intake.applicant_email)
            if (profileRow?.profile_data) setProfileData(profileRow.profile_data)
          } catch {}
        }
      }
      setDocuments(docs || [])
      setSummary(saved || null)
    }).catch(err => console.error('Failed to load workspace:', err))
      .finally(() => setLoading(false))
  }, [id])

  function handleExportPdf() {
    const el = document.getElementById('summary-preview-content')
    if (!el) return
    setExporting(true)
    const firstName = (surrogate.name || 'Surrogate').split(' ')[0]
    const printWin = window.open('', '_blank')
    if (!printWin) { alert('Please allow popups to save as PDF'); setExporting(false); return }
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map(el => el.outerHTML).join('\n')
    const html = `<!DOCTYPE html><html><head><title>GC Summary — ${surrogate.name}</title>${styles}
      <style>
        @page { size: letter; margin: 0.4in 0.5in; }
        body { margin: 0; padding: 0; background: white; font-family: system-ui, -apple-system, sans-serif; }
        .print-bar { position: sticky; top: 0; z-index: 100; padding: 12px 24px; background: #283693; color: white; display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
        .print-bar button { background: white; color: #283693; border: none; padding: 8px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .print-bar .hint { font-size: 12px; opacity: 0.7; margin-left: 12px; }
        .print-content { max-width: 100%; padding: 0; }
        /* Prevent page breaks inside sections */
        .print-content > div > div { break-inside: avoid; }
        [data-section] { break-inside: avoid; page-break-inside: avoid; }
        @media print {
          .print-bar { display: none !important; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      </style></head><body>
      <div class="print-bar">
        <div><strong>${firstName}'s GC Medical Records Summary</strong><span class="hint">Use "Save as PDF" as destination</span></div>
        <button onclick="window.print()">Save as PDF</button>
      </div>
      <div class="print-content">${el.innerHTML}</div>
    </body></html>`
    printWin.document.write(html)
    printWin.document.close()
    setExporting(false)
  }

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
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => setPreviewOpen(true)}>
            <Eye className="size-3" /> Preview & Export
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
            ref={formRef}
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

      {/* Preview modal */}
      {previewOpen && (
        <SummaryPreview
          data={formRef.current?.getFormData() || summary}
          surrogateName={surrogate.name}
          onClose={() => setPreviewOpen(false)}
          onExport={handleExportPdf}
          exporting={exporting}
        />
      )}
    </div>
  )
}

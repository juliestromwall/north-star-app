import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle, createContext, useContext } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, ChevronDown, ChevronRight, Save, Loader2, Download, Trash2, Plus, Merge, Eye, EyeOff, X, CheckCircle2, GripVertical } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useRole } from '@/context/RoleContext'
import { fetchCaseDocuments, getAppConfig, setAppConfig, fetchSurrogateProfileByEmail, uploadCaseDocument, updateCaseDocument, createCaseTask } from '@/lib/db'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'

const SUMMARY_KEY_PREFIX = 'records_summary_'
const HiddenFieldsContext = createContext([])

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
      <span className="text-xs font-bold text-[#1A3638] uppercase tracking-wider">{title}</span>
    </button>
  )
}

const HiddenToggleContext = createContext(null)

function FormField({ label, value, onChange, type = 'text', placeholder, rows, fp: fpProp }) {
  const ctx = useContext(HiddenToggleContext)
  // Auto-generate fp from label if not provided
  const fp = fpProp || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_') : null)
  const isHidden = fp && ctx?.hiddenFields?.includes(fp)
  return (
    <div className={`space-y-0.5 ${isHidden ? 'opacity-40' : ''}`}>
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-stone-400 uppercase">{label}</label>
        {fp && ctx?.onToggle && (
          <button onClick={() => ctx.onToggle(fp)} className={`p-0.5 rounded transition-colors ${isHidden ? 'text-red-400 hover:text-red-600' : 'text-stone-300 hover:text-stone-500'}`} title={isHidden ? 'Hidden from PDF — click to show' : 'Visible on PDF — click to hide'}>
            {isHidden ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </button>
        )}
      </div>
      {rows ? (
        <Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="text-sm" />
      ) : (
        <Input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-8 text-sm" />
      )}
    </div>
  )
}

// ── Document Viewer Panel ──────────────────────────────
function MergeOrderItem({ id, label }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 rounded border border-stone-200 bg-white px-2 py-1.5 mb-1 text-xs" {...attributes} {...listeners}>
      <GripVertical className="size-3 text-stone-400 cursor-grab shrink-0" />
      <span className="truncate text-stone-700">{label}</span>
    </div>
  )
}

function DocumentPanel({ documents, surrogateId }) {
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeSelected, setMergeSelected] = useState(new Set())
  const [mergeOrder, setMergeOrder] = useState([]) // ordered list of selected doc IDs
  const [merging, setMerging] = useState(false)

  const mergeSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [pageRemoveMode, setPageRemoveMode] = useState(false)
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [removedPages, setRemovedPages] = useState(new Set())
  const [removingPages, setRemovingPages] = useState(false)

  const allDocs = documents.filter(d => (d.category || '').toLowerCase().replace(/[\s_-]/g, '').includes('medicalrecord'))
  const pdfDocs = allDocs.filter(d => d.file_type === 'application/pdf')
  const [renamingDoc, setRenamingDoc] = useState(null)
  const [renameValue, setRenameValue] = useState('')

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
      // Use mergeOrder to preserve user's drag-reorder sequence
      const docMap = Object.fromEntries(allDocs.map(d => [d.id, d]))
      const selectedDocs = mergeOrder.filter(id => mergeSelected.has(id)).map(id => docMap[id]).filter(Boolean)

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
    setMergeSelected(prev => {
      const s = new Set(prev)
      if (s.has(docId)) { s.delete(docId); setMergeOrder(o => o.filter(id => id !== docId)) }
      else { s.add(docId); setMergeOrder(o => [...o, docId]) }
      return s
    })
  }

  async function handleRename() {
    if (!renamingDoc || !renameValue.trim()) return
    try {
      await updateCaseDocument(renamingDoc.id, { file_name: renameValue.trim() })
      // Update local state — parent documents won't auto-refresh, so update allDocs via a trick
      // Since allDocs is derived from documents prop, we need to mutate the source
      const idx = documents.findIndex(d => d.id === renamingDoc.id)
      if (idx >= 0) documents[idx].file_name = renameValue.trim()
      setRenamingDoc(null)
      setRenameValue('')
    } catch (err) { console.error('Rename failed:', err) }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Doc list header */}
      <div className="p-3 border-b bg-stone-50 flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-600">Documents ({allDocs.length})</p>
        <div className="flex items-center gap-1">
          {!selectedDoc && (
            <button onClick={() => { setMergeMode(!mergeMode); setMergeSelected(new Set()) }}
              className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${mergeMode ? 'bg-[#1A3638] text-white' : 'text-stone-500 hover:bg-stone-200'}`}>
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

      {/* Merge order — drag to reorder */}
      {mergeMode && mergeOrder.length >= 2 && (
        <div className="px-3 py-2 border-b bg-[#1A3638]/5">
          <p className="text-[10px] font-semibold text-[#1A3638] uppercase mb-1.5">Merge Order (drag to reorder)</p>
          <DndContext sensors={mergeSensors} collisionDetection={closestCenter} onDragEnd={e => {
            const { active, over } = e
            if (!over || active.id === over.id) return
            setMergeOrder(prev => {
              const oldIdx = prev.indexOf(active.id)
              const newIdx = prev.indexOf(over.id)
              return arrayMove(prev, oldIdx, newIdx)
            })
          }}>
            <SortableContext items={mergeOrder} strategy={verticalListSortingStrategy}>
              {mergeOrder.map((docId, i) => {
                const doc = allDocs.find(d => d.id === docId)
                if (!doc) return null
                return <MergeOrderItem key={docId} id={docId} label={`${i + 1}. ${doc.file_name}`} />
              })}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {!selectedDoc ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {allDocs.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-8">No documents found</p>
          )}
          {allDocs.map(doc => {
            const isChecked = mergeSelected.has(doc.id)
            return (
            <div key={doc.id} className={`flex items-center gap-2 rounded-lg ${mergeMode && isChecked ? 'bg-[#1A3638]/5 border border-[#1A3638]/20' : ''}`}>
              {mergeMode && (
                <label className="flex items-center shrink-0 ml-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleMergeDoc(doc.id)}
                    className="size-4 accent-[#1A3638] cursor-pointer"
                  />
                </label>
              )}
              <button onClick={() => { if (mergeMode) { toggleMergeDoc(doc.id) } else { setSelectedDoc(doc) } }}
                className="flex-1 text-left p-2.5 rounded-lg hover:bg-stone-100 transition-colors flex items-center gap-2 group">
                <FileText className="size-4 text-stone-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-stone-700 truncate">{doc.file_name}</p>
                  <p className="text-[10px] text-stone-400">{formatDate(doc.created_at)}</p>
                </div>
                {mergeMode && isChecked && <span className="text-[9px] font-bold text-[#1A3638] bg-[#1A3638]/10 px-1.5 py-0.5 rounded shrink-0">#{mergeOrder.indexOf(doc.id) + 1}</span>}
                {!mergeMode && (
                  <span onClick={(e) => { e.stopPropagation(); setRenamingDoc(doc); setRenameValue(doc.file_name) }}
                    className="text-[9px] text-stone-400 hover:text-[#1A3638] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Rename">
                    Rename
                  </span>
                )}
              </button>
            </div>
            )
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="p-2 border-b flex items-center justify-between">
            <button onClick={() => { setSelectedDoc(null); setPreviewUrl(null); setPageRemoveMode(false); setRemovedPages(new Set()) }} className="text-xs text-[#1A3638] hover:underline flex items-center gap-1">
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
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[#1A3638] hover:underline">Open in new tab</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {renamingDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setRenamingDoc(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-stone-800">Rename Document</h3>
            <input value={renameValue} onChange={e => setRenameValue(e.target.value)} className="w-full h-9 text-sm border border-stone-200 rounded-lg px-3" autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenamingDoc(null) }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRenamingDoc(null)} className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg hover:bg-stone-50">Cancel</button>
              <button onClick={handleRename} disabled={!renameValue.trim()} className="px-3 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-40" style={{ backgroundColor: '#1A3638' }}>Rename</button>
            </div>
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

  const [hiddenFields, setHiddenFields] = useState([])

  useImperativeHandle(ref, () => ({
    getFormData: () => ({ ...form, labs: labRows, _hiddenFields: hiddenFields }),
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
    setHiddenFields(saved._hiddenFields || [])
    setForm(init)
  }, [surrogate, profileData, clinicData, summary])

  function toggleHidden(fp) {
    setHiddenFields(prev => prev.includes(fp) ? prev.filter(f => f !== fp) : [...prev, fp])
  }

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
    onSave({ ...form, labs: labRows, _hiddenFields: hiddenFields })
  }

  const hiddenCtx = useMemo(() => ({ hiddenFields, onToggle: toggleHidden }), [hiddenFields])

  return (
    <HiddenToggleContext.Provider value={hiddenCtx}>
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-stone-50 flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-600">GC Medical Records Summary</p>
        <Button size="sm" className="gap-1.5 h-7 text-xs" style={{ backgroundColor: '#1A3638' }} onClick={handleSave} disabled={saving}>
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
                  <p className="text-sm font-bold text-[#1A3638]">{preg.label || `G${i + 1}`}</p>
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
                      <FormField label="Page Ref" value={preg.pageRef} onChange={v => updatePregnancy(i, 'pageRef', v)} placeholder="(pg.)" fp={`g${i}_page_ref`} />
                      <FormField label="Date" value={preg.dateOfDelivery} onChange={v => updatePregnancy(i, 'dateOfDelivery', v)} type="date" fp={`g${i}_date_of_delivery`} />
                      <FormField label="Gestational Age" value={preg.gestationalAge} onChange={v => updatePregnancy(i, 'gestationalAge', v)} placeholder="8w 2d" fp={`g${i}_gestational_age`} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField label="GBS" value={preg.gbs} onChange={v => updatePregnancy(i, 'gbs', v)} placeholder="Negative/Positive" fp={`g${i}_gbs`} />
                      <FormField label="Glucose Screen" value={preg.glucoseScreen} onChange={v => updatePregnancy(i, 'glucoseScreen', v)} fp={`g${i}_glucose_screen`} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <FormField label="GC Cycle" value={preg.gcCycle} onChange={v => updatePregnancy(i, 'gcCycle', v)} fp={`g${i}_gc_cycle`} />
                      <FormField label="BP's" value={preg.bps} onChange={v => updatePregnancy(i, 'bps', v)} fp={`g${i}_bp_s`} />
                      <FormField label="Weight Gained" value={preg.weightGained} onChange={v => updatePregnancy(i, 'weightGained', v)} placeholder="lbs" fp={`g${i}_weight_gained`} />
                    </div>
                    <FormField label="Notes" value={preg.complications} onChange={v => updatePregnancy(i, 'complications', v)} rows={2} fp={`g${i}_complications`} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <FormField label="Page Ref" value={preg.pageRef} onChange={v => updatePregnancy(i, 'pageRef', v)} placeholder="(pg.)" fp={`g${i}_page_ref`} />
                      <FormField label="Date of Delivery" value={preg.dateOfDelivery} onChange={v => updatePregnancy(i, 'dateOfDelivery', v)} type="date" fp={`g${i}_date_of_delivery`} />
                      <FormField label="Gestational Age" value={preg.gestationalAge} onChange={v => updatePregnancy(i, 'gestationalAge', v)} placeholder="38w 2d" fp={`g${i}_gestational_age`} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField label="Type of Delivery" value={preg.typeOfDelivery} onChange={v => updatePregnancy(i, 'typeOfDelivery', v)} fp={`g${i}_type_of_delivery`} />
                      <FormField label="GBS" value={preg.gbs} onChange={v => updatePregnancy(i, 'gbs', v)} placeholder="Negative/Positive (PG.)" fp={`g${i}_gbs`} />
                    </div>
                    <FormField label="Glucose Screen" value={preg.glucoseScreen} onChange={v => updatePregnancy(i, 'glucoseScreen', v)} placeholder="Normal/Abnormal 1-hour/50gm = __ mg/DL" fp={`g${i}_glucose_screen`} />
                    <div className="grid grid-cols-4 gap-2">
                      <FormField label="Fasting" value={preg.glucoseValues?.fasting} onChange={v => updatePregnancy(i, 'glucoseValues', { ...preg.glucoseValues, fasting: v })} placeholder="mg/dl" fp={`g${i}_fasting`} />
                      <FormField label="1hr" value={preg.glucoseValues?.oneHr} onChange={v => updatePregnancy(i, 'glucoseValues', { ...preg.glucoseValues, oneHr: v })} placeholder="mg/dl" fp={`g${i}_1hr`} />
                      <FormField label="2hr" value={preg.glucoseValues?.twoHr} onChange={v => updatePregnancy(i, 'glucoseValues', { ...preg.glucoseValues, twoHr: v })} placeholder="mg/dl" fp={`g${i}_2hr`} />
                      <FormField label="3hr" value={preg.glucoseValues?.threeHr} onChange={v => updatePregnancy(i, 'glucoseValues', { ...preg.glucoseValues, threeHr: v })} placeholder="mg/dl" fp={`g${i}_3hr`} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <FormField label="BP's" value={preg.bps} onChange={v => updatePregnancy(i, 'bps', v)} fp={`g${i}_bp_s`} />
                      <FormField label="Anesthesia" value={preg.anesthesia} onChange={v => updatePregnancy(i, 'anesthesia', v)} fp={`g${i}_anesthesia`} />
                      <FormField label="Weight Gained" value={preg.weightGained} onChange={v => updatePregnancy(i, 'weightGained', v)} placeholder="lbs" fp={`g${i}_weight_gained`} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <FormField label="Infant Birth Weight" value={preg.infantBirthWeight} onChange={v => updatePregnancy(i, 'infantBirthWeight', v)} fp={`g${i}_infant_birth_weight`} />
                      <FormField label="Infant Sex" value={preg.infantSex} onChange={v => updatePregnancy(i, 'infantSex', v)} placeholder="Male / Female" fp={`g${i}_infant_sex`} />
                      <FormField label="GC Cycle" value={preg.gcCycle} onChange={v => updatePregnancy(i, 'gcCycle', v)} fp={`g${i}_gc_cycle`} />
                    </div>
                    <FormField label="Complications" value={preg.complications} onChange={v => updatePregnancy(i, 'complications', v)} rows={2} fp={`g${i}_complications`} />
                    <div className="grid grid-cols-2 gap-2">
                      <FormField label="APGAR" value={preg.apgar} onChange={v => updatePregnancy(i, 'apgar', v)} placeholder="8/9" fp={`g${i}_apgar`} />
                      <FormField label="Estimated Blood Loss" value={preg.ebl} onChange={v => updatePregnancy(i, 'ebl', v)} placeholder="ml" fp={`g${i}_ebl`} />
                    </div>
                    <FormField label="Delivery Note / Complications" value={preg.deliveryComplications} onChange={v => updatePregnancy(i, 'deliveryComplications', v)} rows={2} fp={`g${i}_delivery_complications`} />
                    <FormField label="Postpartum Complications" value={preg.postpartumComplications} onChange={v => updatePregnancy(i, 'postpartumComplications', v)} rows={2} fp={`g${i}_postpartum`} />
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
            <button onClick={addLabRow} className="text-xs text-[#1A3638] hover:underline flex items-center gap-1">
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
    </HiddenToggleContext.Provider>
  )
})

// ── Summary Preview / PDF Export ────────────────────────
function InfoGridRow({ label, value, span, fp }) {
  const hiddenFields = useContext(HiddenFieldsContext)
  if (fp && hiddenFields.includes(fp)) return null
  return (
    <div style={{ backgroundColor: 'white', padding: '5px 12px', ...(span ? { gridColumn: `span ${span}` } : {}) }}>
      <div style={{ fontSize: 8, color: '#a8a29e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 0 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: value ? '#1c1917' : '#d6d3d1', whiteSpace: 'pre-wrap' }}>{value || '—'}</div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <h2 style={{ fontSize: 10, fontWeight: 700, color: '#D4A853', margin: 0, marginTop: 14, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '1px' }}>{children}</h2>
  )
}

function PregnancyBanner({ label, outcome, skipDetails, preg }) {
  const color = skipDetails ? '#d97706' : '#1A3638'
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
    <div style={{ marginTop: 16, marginBottom: 8, padding: '8px 14px', borderRadius: 8, background: skipDetails ? 'linear-gradient(135deg, #fffbeb, #fef3c7)' : '#1A3638' }}>
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
  const previewHiddenFields = data._hiddenFields || []

  return (
    <HiddenFieldsContext.Provider value={previewHiddenFields}>
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
            <img src="/first-star-logo.png" alt="First Star Surrogacy" style={{ height: 44, marginBottom: 8, display: 'inline-block' }} crossOrigin="anonymous" />
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#1A3638', margin: 0, letterSpacing: '0.3px' }}>Gestational Carrier Medical Records Summary</h1>
          </div>
          <div style={{ height: 1.5, background: '#1A3638', borderRadius: 1, marginBottom: 16 }} />

          {/* Patient Header — name + stat cards + pregnancy history */}
          {(() => {
            const dobStr = data.dob ? new Date(data.dob + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''
            const calcAge = data.dob ? (() => { const b = new Date(data.dob); const t = new Date(); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return a > 0 ? a : null })() : null
            const iconStyle = { width: 14, height: 14, stroke: '#1A3638', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }
            const icons = {
              age: <svg viewBox="0 0 24 24" style={iconStyle}><path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>,
              height: <svg viewBox="0 0 24 24" style={iconStyle}><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/></svg>,
              weight: <svg viewBox="0 0 24 24" style={iconStyle}><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>,
              bmi: <svg viewBox="0 0 24 24" style={iconStyle}><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>,
              status: <svg viewBox="0 0 24 24" style={iconStyle}><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>,
            }
            const statCards = [
              { icon: icons.age, label: 'Age', value: calcAge, sub: `DOB ${dobStr}` },
              { icon: icons.height, label: 'Height', value: data.height },
              { icon: icons.weight, label: 'Weight', value: data.weight },
              { icon: icons.bmi, label: 'BMI', value: data.bmi },
              { icon: icons.status, label: 'Status', value: data.maritalStatus },
            ]
            // GTPAL from pregnancies
            const pregs = data.pregnancies || []
            const g = data.numberOfPregnancies || pregs.length
            let term = 0, preterm = 0, losses = 0, living = 0
            for (const p of pregs) {
              const outcome = (p.outcome || '').toLowerCase()
              if (outcome === 'live birth') {
                const weeks = parseInt(p.gestationalAge) || 40
                if (weeks >= 37) term++; else preterm++
                living++
              } else { losses++ }
            }
            const hasGtpal = g > 0
            const gtpalChips = [
              { label: 'Pregnancies', value: g, color: '#1A3638' },
              { label: 'Term', value: term, color: '#10b981' },
              { label: 'Preterm', value: preterm, color: '#f59e0b' },
              { label: 'Losses', value: losses, color: '#ef4444' },
              { label: 'Living', value: living, color: '#8b5cf6' },
            ]
            return (
              <div style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A3638', margin: '0 0 8px', letterSpacing: '0.3px' }}>{data.name}</h2>
                {/* Stat cards — full width, horizontal */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${statCards.filter(s => s.value).length}, 1fr)`, gap: 6, marginBottom: hasGtpal ? 6 : 0 }}>
                  {statCards.map(s => s.value ? (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, backgroundColor: '#fff', border: '1px solid #e7e5e4' }}>
                      {s.icon}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A3638', lineHeight: 1.2 }}>{s.value}</div>
                        <div style={{ fontSize: 7, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{s.sub || s.label}</div>
                      </div>
                    </div>
                  ) : null)}
                </div>
                {/* Pregnancy History — GTPAL bar */}
                {hasGtpal && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderRadius: 8, background: 'linear-gradient(135deg, #fdf2f8, #eef2ff)', border: '1px solid #f3e8ff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: '#ec4899', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/></svg>
                      <span style={{ fontSize: 8, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pregnancy History</span>
                    </div>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, fontWeight: 800, color: '#1A3638', letterSpacing: '1px' }}>G{g}P{term}{preterm}{losses}{living}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 4 }}>
                      {gtpalChips.map(c => (
                        <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: c.color, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{c.value}</span>
                          <span style={{ fontSize: 9, color: '#57534e', fontWeight: 500 }}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* General Medical History */}
          <div data-section="medical">
            <SectionLabel>General Medical History</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, backgroundColor: '#f5f5f4', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
              <InfoGridRow label="Current Medications" value={data.currentMedications} fp="current_medications" />
              <InfoGridRow label="Allergies" value={data.allergies} fp="allergies" />
              <InfoGridRow label="Pertinent Medical History" value={data.pertinentMedicalHistory} fp="pertinent_medical_history" />
              <InfoGridRow label="Surgical History" value={data.surgicalHistory} fp="surgical_history" />
            </div>
          </div>

          {/* Social History */}
          <div data-section="social">
            <SectionLabel>Social History</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, backgroundColor: '#f5f5f4', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
              <InfoGridRow label="Alcohol" value={data.alcohol} fp="alcohol" />
              <InfoGridRow label="Tobacco" value={data.tobacco} fp="tobacco" />
              <InfoGridRow label="Recreational Drugs" value={data.recreationalDrugs} fp="recreational_drugs" />
            </div>
          </div>

          {/* GYN History */}
          <div data-section="gyn">
            <SectionLabel>Gynecologic History</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, backgroundColor: '#f5f5f4', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
              <InfoGridRow label="LMP" value={data.lmp} fp="lmp" />
              <InfoGridRow label="Cycle Length" value={data.cycleLength ? `${data.cycleLength} days` : ''} fp="cycle_length" />
              <InfoGridRow label="Menarche" value={data.menarche} fp="menarche" />
              <InfoGridRow label="Current Contraception" value={data.contraception} fp="current_contraception" />
              <InfoGridRow label="History of STD" value={data.stdHistory} fp="history_of_std" />
              <InfoGridRow label="GYN Problems" value={data.gynProblems} fp="gyn_problems" />
              <InfoGridRow label="Infertility History" value={data.infertilityHistory} span={3} fp="infertility_history" />
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, backgroundColor: '#f5f5f4', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
                  <InfoGridRow label="GBS" value={preg.gbs} fp={`g${i}_gbs`} />
                  <InfoGridRow label="Glucose Screen" value={preg.glucoseScreen} fp={`g${i}_glucose_screen`} />
                  <InfoGridRow label="GC Cycle" value={preg.gcCycle} fp={`g${i}_gc_cycle`} />
                  <InfoGridRow label="BP's" value={preg.bps} fp={`g${i}_bp_s`} />
                  <InfoGridRow label="Weight Gained" value={preg.weightGained} fp={`g${i}_weight_gained`} />
                  <InfoGridRow label="Notes" value={preg.complications} span={3} fp={`g${i}_complications`} />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, backgroundColor: '#f5f5f4', borderRadius: 8, overflow: 'hidden', border: '1px solid #e7e5e4' }}>
                  <InfoGridRow label="GBS" value={preg.gbs} fp={`g${i}_gbs`} />
                  <InfoGridRow label="Glucose Screen" value={preg.glucoseScreen} fp={`g${i}_glucose_screen`} />
                  <InfoGridRow label="GC Cycle" value={preg.gcCycle} fp={`g${i}_gc_cycle`} />
                  <InfoGridRow label="BP's" value={preg.bps} fp={`g${i}_bp_s`} />
                  {(preg.glucoseValues?.fasting || preg.glucoseValues?.oneHr) && (
                    <>
                      <InfoGridRow label="Fasting" value={preg.glucoseValues?.fasting ? `${preg.glucoseValues.fasting} mg/dl` : ''} fp={`g${i}_fasting`} />
                      <InfoGridRow label="1hr" value={preg.glucoseValues?.oneHr ? `${preg.glucoseValues.oneHr} mg/dl` : ''} fp={`g${i}_1hr`} />
                      <InfoGridRow label="2hr" value={preg.glucoseValues?.twoHr ? `${preg.glucoseValues.twoHr} mg/dl` : ''} fp={`g${i}_2hr`} />
                      <InfoGridRow label="3hr" value={preg.glucoseValues?.threeHr ? `${preg.glucoseValues.threeHr} mg/dl` : ''} fp={`g${i}_3hr`} />
                    </>
                  )}
                  <InfoGridRow label="Anesthesia" value={preg.anesthesia} fp={`g${i}_anesthesia`} />
                  <InfoGridRow label="Weight Gained" value={preg.weightGained} fp={`g${i}_weight_gained`} />
                  <InfoGridRow label="APGAR" value={preg.apgar} fp={`g${i}_apgar`} />
                  <InfoGridRow label="Est. Blood Loss" value={preg.ebl} fp={`g${i}_ebl`} />
                  <InfoGridRow label="Complications" value={preg.complications} span={4} fp={`g${i}_complications`} />
                  <InfoGridRow label="Delivery Complications" value={preg.deliveryComplications} span={4} fp={`g${i}_delivery_complications`} />
                  <InfoGridRow label="Postpartum" value={preg.postpartumComplications} span={4} fp={`g${i}_postpartum`} />
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
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1.5px solid #1A3638', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 10, color: '#78716c' }}>
              <span style={{ fontWeight: 600 }}>Medical records reviewed by:</span> {data.reviewedBy || '—'}
            </div>
            <img src="/first-star-logo.png" alt="" style={{ height: 20, opacity: 0.3 }} crossOrigin="anonymous" />
          </div>
        </div>
      </div>
    </div>
    </HiddenFieldsContext.Provider>
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
  const [completing, setCompleting] = useState(false)
  const [completeConfirm, setCompleteConfirm] = useState(false)
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
        .print-bar { position: sticky; top: 0; z-index: 100; padding: 12px 24px; background: #1A3638; color: white; display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
        .print-bar button { background: white; color: #1A3638; border: none; padding: 8px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; }
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

  async function handleComplete() {
    setCompleting(true)
    try {
      const sName = surrogate?.name || 'Surrogate'
      const firstName = sName.split(' ')[0]

      // Save form data first
      const formData = formRef.current?.getFormData() || summary
      if (formData) {
        await setAppConfig(`${SUMMARY_KEY_PREFIX}${id}`, formData)
      }

      // Try to get rendered preview HTML, or generate a simple version
      let htmlContent
      const el = document.getElementById('summary-preview-content')
      if (el) {
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map(s => s.outerHTML).join('\n')
        htmlContent = `<!DOCTYPE html><html><head><title>Records Summary — ${sName}</title>${styles}
          <style>body { background: white; margin: 0; padding: 20px; font-family: system-ui, sans-serif; } [data-section] { break-inside: avoid; }</style>
          </head><body>${el.innerHTML}</body></html>`
      } else {
        // Generate simple HTML from form data
        const data = formData || {}
        const sections = []
        sections.push(`<h1 style="color:#1A3638">GC Medical Records Summary — ${sName}</h1>`)
        sections.push(`<p><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>`)
        if (data.name) sections.push(`<p><strong>Name:</strong> ${data.name}</p>`)
        if (data.dob) sections.push(`<p><strong>DOB:</strong> ${data.dob}</p>`)
        if (data.currentMeds) sections.push(`<h3>Current Medications</h3><p>${data.currentMeds}</p>`)
        if (data.allergies) sections.push(`<h3>Allergies</h3><p>${data.allergies}</p>`)
        if (data.pertinentHistory) sections.push(`<h3>Pertinent Medical History</h3><p>${data.pertinentHistory}</p>`)
        if (data.surgicalHistory) sections.push(`<h3>Surgical History</h3><p>${data.surgicalHistory}</p>`)
        htmlContent = `<!DOCTYPE html><html><head><title>Records Summary — ${sName}</title>
          <style>body { background: white; margin: 0; padding: 20px; font-family: system-ui, sans-serif; } h1 { color: #1A3638; } h3 { color: #1A3638; margin-top: 16px; }</style>
          </head><body>${sections.join('\n')}</body></html>`
      }

      const fileName = `Records_Summary_${firstName}_${new Date().toISOString().split('T')[0]}.html`
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const file = new File([blob], fileName, { type: 'text/html' })

      // Upload to Medical Records folder
      const uploaded = await uploadCaseDocument({
        surrogateId: id,
        category: 'Medical Records',
        file,
        uploadedBy: currentUser?.name || 'Admin',
      })

      // Mark summary as complete in app_config
      const currentSummary = await getAppConfig(`${SUMMARY_KEY_PREFIX}${id}`) || {}
      await setAppConfig(`${SUMMARY_KEY_PREFIX}${id}`, { ...currentSummary, _completedAt: new Date().toISOString(), _completedBy: currentUser?.name })

      // Create review tasks for Julie, Nicole, and Desiree
      const reviewers = [
        { email: 'julie@northstarsurrogacy.com', name: 'Julie Allgood' },
        { email: 'nicole@northstarsurrogacy.com', name: 'Nicole Lawson' },
        { email: 'desiree@northstarsurrogacy.com', name: 'Desiree Melchiori' },
      ]
      for (const reviewer of reviewers) {
        try {
          await createCaseTask({
            title: `Review Records Summary for ${sName}`,
            due_date: new Date().toISOString().split('T')[0],
            priority: 'high',
            assigned_to: reviewer.email,
            created_by: currentUser?.email,
            status: 'open',
            case_id: id,
            case_type: 'surrogate',
          })
        } catch {}
      }

      setCompleteConfirm(false)
    } catch (err) {
      console.error('Complete failed:', err)
      alert('Failed to complete: ' + (err.message || 'Unknown error'))
    } finally {
      setCompleting(false)
    }
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
          <Button size="sm" className="gap-1.5 text-xs h-7" style={{ backgroundColor: '#16a34a' }} onClick={() => setCompleteConfirm(true)} disabled={completing}>
            {completing ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
            {completing ? 'Filing...' : 'Mark Complete'}
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

      {/* Complete Confirmation Dialog */}
      <Dialog open={completeConfirm} onOpenChange={setCompleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="size-5" /> Submit Records Summary?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-stone-600">
            This will file the Records Summary to the <strong>Medical Records</strong> folder and create review tasks for Julie Allgood, Nicole Lawson, and Desiree Melchiori.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" className="gap-1" style={{ backgroundColor: '#16a34a' }} onClick={handleComplete} disabled={completing}>
              {completing ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
              {completing ? 'Filing...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

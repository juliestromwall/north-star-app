// CSVImportDialog — upload an XLSX (or CSV) and scaffold a form template.
//
// Each tab in the workbook becomes a section. Each non-empty row in
// column A becomes a field with type 'text' (or 'yesno' for questions
// that clearly read as yes/no). Admin can refine field types, conditional
// rules, prefill sources, etc. in the builder after import.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { upsertFormTemplate } from '@/lib/db'
import { Upload, Loader2, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'

// Best-effort field type inference from the question text. Conservative —
// when in doubt, fall back to 'text'. Admin can change after import.
function inferType(label) {
  const t = (label || '').trim().toLowerCase()
  if (!t) return 'text'
  // Clear yes/no signals
  if (/^(are|do|did|have|has|will|would|can|could|is|was|were|should)\b/.test(t)) return 'yesno'
  // Date Qs
  if (/\b(date|when|year|month)\b/.test(t)) {
    // Only use 'date' if the question is asking for a single date, not "when did you..."
    if (/^(date|when (was|is|will)|what date)\b/.test(t)) return 'date'
  }
  // Number Qs
  if (/^(how many|number of|count of)\b/.test(t)) return 'number'
  // Long-form answers
  if (/(describe|explain|tell us|what are your thoughts|please share|how would|how do)\b/.test(t)) return 'textarea'
  return 'text'
}

// Slugify a label into a stable field id. Falls back to 'field-N' when
// the label is empty after sanitization.
function slugifyLabel(label, fallbackIdx) {
  const slug = (label || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
  return slug || `field-${fallbackIdx}`
}

// Sheet name → section id. Same slug pattern but prefixed with `_` to
// match the convention used by existing application sections.
function slugifySection(name, idx) {
  const slug = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
  return slug ? `_${slug}` : `_section${idx + 1}`
}

// Parse a workbook into the form-template shape. Returns { sections, warnings }.
function parseWorkbook(workbook) {
  const warnings = []
  const sections = []
  const usedFieldIds = new Set()

  workbook.SheetNames.forEach((sheetName, sIdx) => {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })
    if (rows.length === 0) {
      warnings.push(`Sheet "${sheetName}" is empty — skipped.`)
      return
    }
    // First row is treated as a header (e.g. "Question"). Skip it if the
    // first cell looks like a header word.
    const firstCell = (rows[0]?.[0] || '').toString().trim().toLowerCase()
    const dataRows = ['question', 'questions', 'field', 'fields', 'label', 'prompt'].includes(firstCell)
      ? rows.slice(1)
      : rows

    const fields = []
    dataRows.forEach((row, rIdx) => {
      const label = (row?.[0] || '').toString().trim()
      if (!label) return
      let id = slugifyLabel(label, rIdx + 1)
      // De-dupe ids across the whole form
      let n = 2
      const base = id
      while (usedFieldIds.has(id)) { id = `${base}-${n++}` }
      usedFieldIds.add(id)
      fields.push({
        id,
        type: inferType(label),
        label,
        required: false,
      })
    })

    if (fields.length === 0) {
      warnings.push(`Sheet "${sheetName}" had no questions after the header — skipped.`)
      return
    }

    sections.push({
      id: slugifySection(sheetName, sIdx),
      title: sheetName,
      fields,
    })
  })

  return { sections, warnings }
}

export default function CSVImportDialog({ open, onOpenChange, onImported }) {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null) // { sections, warnings, sourceName }
  const [formTitle, setFormTitle] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)

  function reset() {
    setFile(null)
    setParsed(null)
    setFormTitle('')
    setError(null)
    setImporting(false)
    setParsing(false)
  }

  async function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError(null)
    setParsing(true)
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const result = parseWorkbook(wb)
      if (result.sections.length === 0) {
        setError('No usable sections found in the file. Check that each tab has a "Question" column with rows below it.')
        setParsed(null)
        return
      }
      setParsed({ ...result, sourceName: f.name })
      // Default the title from the file name (strip extension)
      setFormTitle(f.name.replace(/\.(xlsx|xls|csv)$/i, ''))
    } catch (err) {
      setError(`Could not parse the file: ${err.message}`)
      setParsed(null)
    } finally {
      setParsing(false)
    }
  }

  async function handleImport() {
    if (!parsed || !formTitle.trim()) return
    setImporting(true)
    try {
      const id = `form-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const template = {
        id,
        title: formTitle.trim(),
        description: `Imported from ${parsed.sourceName}`,
        status: 'draft',
        sections: parsed.sections,
        assignedRoles: [],
      }
      const saved = await upsertFormTemplate(template)
      if (!saved) {
        setError("Saved nothing — make sure the form_templates table exists (run scripts/20260527-add-form-templates.sql).")
        setImporting(false)
        return
      }
      reset()
      onOpenChange(false)
      if (onImported) onImported(saved)
      // Jump straight into the builder so admin can refine field types,
      // mark required, add conditionals, set prefill sources.
      navigate(`/forms/builder/${id}`)
    } catch (err) {
      console.error('Import failed:', err)
      setError(`Import failed: ${err.message}`)
      setImporting(false)
    }
  }

  const totalFields = parsed?.sections?.reduce((n, s) => n + s.fields.length, 0) || 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from spreadsheet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload an Excel file (.xlsx) or CSV. Each tab becomes a section; each row in column A becomes a field. All fields default to text type — you can refine in the builder after import.
          </p>

          {!parsed && (
            <div className="space-y-3">
              <Label htmlFor="csv-file" className="cursor-pointer">
                <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-stone-200 hover:border-stone-400 transition-colors">
                  {parsing ? (
                    <>
                      <Loader2 className="size-6 animate-spin text-stone-400" />
                      <span className="text-sm text-stone-500">Parsing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-6 text-stone-400" />
                      <span className="text-sm font-medium">Choose a spreadsheet</span>
                      <span className="text-xs text-stone-400">.xlsx or .csv</span>
                    </>
                  )}
                </div>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={parsing}
                />
              </Label>
            </div>
          )}

          {parsed && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-emerald-900">{parsed.sections.length} section{parsed.sections.length === 1 ? '' : 's'}, {totalFields} field{totalFields === 1 ? '' : 's'} ready</p>
                  <p className="text-emerald-700 text-xs">From {parsed.sourceName}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Form title</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Enter form title"
                />
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg border border-stone-100 p-3 bg-stone-50/50">
                {parsed.sections.map(s => (
                  <div key={s.id} className="text-sm">
                    <p className="font-medium text-stone-700">
                      <FileSpreadsheet className="inline size-3.5 mr-1.5 -mt-0.5 text-stone-400" />
                      {s.title} <span className="text-xs text-stone-400 font-normal">({s.fields.length} field{s.fields.length === 1 ? '' : 's'})</span>
                    </p>
                  </div>
                ))}
              </div>

              {parsed.warnings.length > 0 && (
                <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <ul className="text-xs text-amber-800 space-y-0.5">
                    {parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleImport} disabled={!parsed || !formTitle.trim() || importing}>
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {importing ? 'Importing...' : 'Import + open in builder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

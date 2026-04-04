import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileText, FileSpreadsheet, FolderArchive, Image, StickyNote,
  Check, Loader2, ChevronDown, X, AlertCircle,
} from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useRole } from '@/context/RoleContext'
import { adminAddSurrogate, insertCaseNote, uploadCaseDocument } from '@/lib/db'
import * as XLSX from 'xlsx'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

const DOCUMENT_CATEGORIES = [
  'Photo IDs', 'Agency Agreement', 'Legal', 'Medical Records', 'Psychological',
  'Background Check', 'Home Study', 'Insurance', 'Clinic', 'Other',
]

function FileDropZone({ label, icon: Icon, accept, multiple, files, onFiles, description }) {
  const [dragOver, setDragOver] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (accept && dropped.length) {
      const filtered = dropped.filter(f => {
        if (accept === '.xlsx,.xls,.csv') return /\.(xlsx|xls|csv)$/i.test(f.name)
        if (accept === '.zip') return /\.zip$/i.test(f.name)
        if (accept === 'image/*') return f.type.startsWith('image/')
        if (accept === '.pdf') return f.type === 'application/pdf'
        return true
      })
      onFiles(multiple ? [...(files || []), ...filtered] : filtered.slice(0, 1))
    } else {
      onFiles(multiple ? [...(files || []), ...dropped] : dropped.slice(0, 1))
    }
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
        dragOver ? 'border-abc-coral bg-pink-50/50' : 'border-stone-200 hover:border-stone-300'
      }`}
    >
      <Icon className="size-8 mx-auto text-stone-300 mb-2" />
      <p className="text-sm font-medium text-stone-600">{label}</p>
      {description && <p className="text-xs text-stone-400 mt-1">{description}</p>}

      {files && files.length > 0 && (
        <div className="mt-3 space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-stone-50 rounded-lg px-3 py-1.5">
              <FileText className="size-3 text-stone-400 shrink-0" />
              <span className="truncate flex-1 text-left">{f.name}</span>
              <span className="text-stone-400 shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
              <button onClick={() => onFiles(files.filter((_, j) => j !== i))} className="text-stone-400 hover:text-red-500 shrink-0">
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={e => {
          const selected = Array.from(e.target.files)
          onFiles(multiple ? [...(files || []), ...selected] : selected.slice(0, 1))
          e.target.value = ''
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  )
}

export default function CaseImportPage() {
  const { currentUser } = useRole()
  const navigate = useNavigate()

  // Basic info
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', state: '', dob: '',
    caseType: 'surrogate', // surrogate or journey
  })

  // File uploads
  const [profilePdf, setProfilePdf] = useState([])
  const [applicationPdfs, setApplicationPdfs] = useState([])
  const [documentsZip, setDocumentsZip] = useState([])
  const [notesFile, setNotesFile] = useState([])
  const [photos, setPhotos] = useState([])

  // State
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleImport() {
    if (!form.firstName || !form.lastName) {
      setError('First name and last name are required.')
      return
    }

    setImporting(true)
    setError(null)
    setResult(null)

    try {
      // 1. Create the surrogate case
      const surrogate = await adminAddSurrogate({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || null,
        phone: form.phone || null,
        state: form.state || null,
        dob: form.dob || null,
        assignedTo: currentUser?.email || null,
      })

      if (!surrogate?.id) throw new Error('Failed to create surrogate case')

      const caseId = surrogate.id
      const counts = { documents: 0, notes: 0, photos: 0 }

      // 2. Upload Profile PDF(s)
      for (const file of profilePdf) {
        await uploadCaseDocument({ surrogateId: caseId, category: 'Other', file, uploadedBy: currentUser?.name || 'Import' })
        counts.documents++
      }

      // 3. Upload Application PDF(s)
      for (const file of applicationPdfs) {
        await uploadCaseDocument({ surrogateId: caseId, category: 'Other', file, uploadedBy: currentUser?.name || 'Import' })
        counts.documents++
      }

      // 4. Upload Documents ZIP — extract and upload individually
      if (documentsZip.length > 0) {
        const JSZip = (await import('jszip')).default
        for (const zipFile of documentsZip) {
          const zip = await JSZip.loadAsync(zipFile)
          const entries = Object.entries(zip.files).filter(([name, entry]) =>
            !entry.dir && !name.startsWith('__MACOSX') && !name.startsWith('.')
          )
          for (const [name, entry] of entries) {
            const blob = await entry.async('blob')
            const ext = name.split('.').pop().toLowerCase()
            const mimeMap = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
            const file = new File([blob], name.split('/').pop(), { type: mimeMap[ext] || 'application/octet-stream' })
            await uploadCaseDocument({ surrogateId: caseId, category: 'Other', file, uploadedBy: currentUser?.name || 'Import' })
            counts.documents++
          }
        }
      }

      // 5. Import Notes from Excel
      if (notesFile.length > 0) {
        for (const file of notesFile) {
          const data = await file.arrayBuffer()
          const workbook = XLSX.read(data, { type: 'array' })
          const sheet = workbook.Sheets[workbook.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(sheet)

          for (const row of rows) {
            // Try common column names for note content
            const content = row.Note || row.Notes || row.Content || row.note || row.notes || row.content || row.Text || row.text || JSON.stringify(row)
            const author = row.Author || row.author || row.By || row.by || row['Created By'] || 'Imported'
            if (content) {
              await insertCaseNote({
                surrogateId: caseId,
                authorName: author,
                authorEmail: currentUser?.email || '',
                content: String(content),
              })
              counts.notes++
            }
          }
        }
      }

      // 6. Upload Photos
      for (const file of photos) {
        await uploadCaseDocument({ surrogateId: caseId, category: 'Other', file, uploadedBy: currentUser?.name || 'Import' })
        counts.photos++
      }

      setResult({
        caseId,
        name: `${form.firstName} ${form.lastName}`,
        ...counts,
      })
    } catch (err) {
      console.error('Import failed:', err)
      setError(err.message || 'Import failed. Check console for details.')
    } finally {
      setImporting(false)
    }
  }

  if (result) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <PageHeader title="Case Import" subtitle="Import complete" />
        <Card className="max-w-xl">
          <CardContent className="py-12 text-center space-y-4">
            <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Check className="size-8 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-stone-800">{result.name} imported successfully</p>
              <div className="text-sm text-stone-500 mt-2 space-y-1">
                {result.documents > 0 && <p>{result.documents} document{result.documents !== 1 ? 's' : ''} uploaded</p>}
                {result.notes > 0 && <p>{result.notes} note{result.notes !== 1 ? 's' : ''} imported</p>}
                {result.photos > 0 && <p>{result.photos} photo{result.photos !== 1 ? 's' : ''} uploaded</p>}
              </div>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Button onClick={() => navigate(`/surrogates/${result.caseId}`)} style={{ backgroundColor: '#283693' }}>
                View Case
              </Button>
              <Button variant="outline" onClick={() => { setResult(null); setForm({ firstName: '', lastName: '', email: '', phone: '', state: '', dob: '', caseType: 'surrogate' }); setProfilePdf([]); setApplicationPdfs([]); setDocumentsZip([]); setNotesFile([]); setPhotos([]) }}>
                Import Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader title="Case Import" subtitle="Import a case from ABC's previous system" />

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Surrogate Information</CardTitle>
          <CardDescription>Enter the basic details for this case</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">First Name *</label>
              <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Last Name *</label>
              <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Email</label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Phone</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 555-5555" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">State</label>
              <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                <option value="">Select state</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Date of Birth</label>
              <Input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} className="h-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Uploads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Files</CardTitle>
          <CardDescription>Upload files from the previous system — they'll be mapped to the correct locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FileDropZone
              label="Completed Profile"
              icon={FileText}
              accept=".pdf"
              multiple={false}
              files={profilePdf}
              onFiles={setProfilePdf}
              description="PDF from old system"
            />
            <FileDropZone
              label="Application Components"
              icon={FileText}
              accept=".pdf"
              multiple={true}
              files={applicationPdfs}
              onFiles={setApplicationPdfs}
              description="One or more PDFs"
            />
            <FileDropZone
              label="Documents (ZIP)"
              icon={FolderArchive}
              accept=".zip"
              multiple={false}
              files={documentsZip}
              onFiles={setDocumentsZip}
              description="ZIP file — will be extracted"
            />
            <FileDropZone
              label="Notes"
              icon={FileSpreadsheet}
              accept=".xlsx,.xls,.csv"
              multiple={false}
              files={notesFile}
              onFiles={setNotesFile}
              description="Excel with Note/Author columns"
            />
            <FileDropZone
              label="Photos"
              icon={Image}
              accept="image/*"
              multiple={true}
              files={photos}
              onFiles={setPhotos}
              description="Profile & gallery photos"
            />
          </div>
        </CardContent>
      </Card>

      {/* Import Button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleImport}
          disabled={importing || (!form.firstName && !form.lastName)}
          className="gap-2"
          style={{ backgroundColor: '#283693' }}
        >
          {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {importing ? 'Importing...' : 'Import Case'}
        </Button>
        <p className="text-xs text-stone-400">
          This will create a new surrogate case and upload all provided files.
        </p>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileText, FileSpreadsheet, FolderArchive, Image, StickyNote,
  Check, Loader2, ChevronDown, X, AlertCircle, Search, Route,
} from 'lucide-react'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useRole } from '@/context/RoleContext'
import { adminAddSurrogate, adminAddIP, insertCaseNote, uploadCaseDocument, fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { createMatchedJourney, updateMatchedJourney } from '@/lib/matching'
import { MATCH_STAGES } from '@/lib/constants'
import { getSurrogateApplicationImportSummary, importSurrogateApplicationPdfFiles, parseSurrogateApplicationPdfFiles } from '@/lib/surrogateApplicationPdfImport'
import * as XLSX from 'xlsx'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

const DOCUMENT_CATEGORIES = [
  'Photo IDs', 'Agency Documents', 'Legal', 'Medical Records', 'Psychological',
  'Background Check', 'Home Study', 'Insurance', 'Clinic', 'Escrow', 'Expenses', 'Photos', 'Other',
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

// Column name → _matchSheetData field mapping (case-insensitive, flexible)
const MATCH_SHEET_FIELD_MAP = {
  // Attorney sheet fields
  'sperm contribution': 'spermContribution',
  'sperm source': 'spermContribution',
  'egg source': 'eggSource',
  'egg contribution': 'eggSource',
  'ip attorney name': 'ipAttorneyName',
  'ip attorney': 'ipAttorneyName',
  'ip attorney email': 'ipAttorneyEmail',
  'gc attorney name': 'gcAttorneyName',
  'gc attorney': 'gcAttorneyName',
  'surrogate attorney name': 'gcAttorneyName',
  'surrogate attorney': 'gcAttorneyName',
  'gc attorney email': 'gcAttorneyEmail',
  'surrogate attorney email': 'gcAttorneyEmail',
  'surrogacy friendly insurance': 'surrogacyFriendlyInsurance',
  'surrogate friendly insurance': 'surrogacyFriendlyInsurance',
  'insurance carrier': 'insuranceCarrier',
  'carrier': 'insuranceCarrier',
  'ip pay premium': 'ipPayPremium',
  'ip pays premium': 'ipPayPremium',
  'surrogacy type': 'surrogacyType',
  'escrow company': 'escrowCompany',
  'escrow account holder': 'escrowCompany',
  'escrow funding': 'escrowFunding',
  'escrow to be funded': 'escrowFunding',
  'escrow minimum': 'escrowMinimum',
  'minimum balance': 'escrowMinimum',
  'escrow min': 'escrowMin',
  'amnio testing': 'amnioTesting',
  'amnio': 'amnioTesting',
  'number of fetuses': 'numberOfFetuses',
  'fetuses': 'numberOfFetuses',
  'willing twins': 'willingTwins',
  'willing to carry twins': 'willingTwins',
  'twins': 'willingTwins',
  'abort reduce': 'abortReduce',
  'abort/reduce': 'abortReduce',
  'selective reduction': 'abortReduce',
  'psych counseling': 'psychCounseling',
  'counseling': 'psychCounseling',
  'psych over phone': 'psychOverPhone',
  'max counseling sessions': 'maxCounselingSessions',
  'counseling sessions': 'maxCounselingSessions',
  'support group meetings': 'supportGroupMeetings',
  'support group': 'supportGroupMeetings',
  'clinic location': 'reClinicLocation',
  're clinic location': 'reClinicLocation',
  'ivf clinic': 'reClinicLocation',
  'delivery hospital': 'deliveryHospital',
  'hospital name': 'deliveryHospital',
  'hospital': 'hospital',
  'delivery hospital location': 'deliveryHospitalLocation',
  'hospital location': 'deliveryHospitalLocation',
  // Escrow sheet fields
  'escrow opening amount': 'escrowOpeningAmount',
  'opening amount': 'escrowOpeningAmount',
  'escrow fund after legal': 'escrowFundAfterLegal',
  'fund after legal': 'escrowFundAfterLegal',
  // Journey-level fields
  'lost wages': 'lostWages',
  'pumping': 'pumping',
  'escrow balance': 'escrowBalance',
}

function parseMatchSheetExcel(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: 'array' })
      const result = {}

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet)

        // Try key-value format: rows with Field/Value or Label/Value columns
        if (rows.length > 0) {
          const firstRow = rows[0]
          const keys = Object.keys(firstRow)
          const fieldCol = keys.find(k => /^(field|label|name|item|key)$/i.test(k))
          const valueCol = keys.find(k => /^(value|answer|data|entry|response)$/i.test(k))

          if (fieldCol && valueCol) {
            // Key-value format
            for (const row of rows) {
              const label = String(row[fieldCol] || '').trim().toLowerCase()
              const value = row[valueCol]
              const mapped = MATCH_SHEET_FIELD_MAP[label]
              if (mapped && value !== undefined && value !== null && value !== '') {
                result[mapped] = String(value)
              }
            }
          } else {
            // Column-header format: first row has field names as column headers
            for (const row of rows) {
              for (const [col, val] of Object.entries(row)) {
                const label = col.trim().toLowerCase()
                const mapped = MATCH_SHEET_FIELD_MAP[label]
                if (mapped && val !== undefined && val !== null && val !== '') {
                  result[mapped] = String(val)
                }
              }
            }
          }
        }
      }
      resolve(result)
    }
    reader.readAsArrayBuffer(file)
  })
}

const MATCH_SHEET_FIELDS = [
  { key: 'spermContribution', label: 'Sperm Contribution' },
  { key: 'eggSource', label: 'Egg Source' },
  { key: 'ipAttorneyName', label: 'IP Attorney Name' },
  { key: 'ipAttorneyEmail', label: 'IP Attorney Email' },
  { key: 'gcAttorneyName', label: 'GC Attorney Name' },
  { key: 'gcAttorneyEmail', label: 'GC Attorney Email' },
  { key: 'surrogacyFriendlyInsurance', label: 'Surrogacy Friendly Insurance' },
  { key: 'insuranceCarrier', label: 'Insurance Carrier' },
  { key: 'ipPayPremium', label: 'IP Pays Premium' },
  { key: 'surrogacyType', label: 'Surrogacy Type' },
  { key: 'escrowCompany', label: 'Escrow Company' },
  { key: 'escrowFunding', label: 'Escrow Funding' },
  { key: 'escrowMinimum', label: 'Escrow Minimum' },
  { key: 'amnioTesting', label: 'Amnio Testing' },
  { key: 'numberOfFetuses', label: 'Number of Fetuses' },
  { key: 'willingTwins', label: 'Willing to Carry Twins' },
  { key: 'abortReduce', label: 'Abort/Reduce' },
  { key: 'psychCounseling', label: 'Psych Counseling' },
  { key: 'psychOverPhone', label: 'Psych Over Phone' },
  { key: 'maxCounselingSessions', label: 'Max Counseling Sessions' },
  { key: 'supportGroupMeetings', label: 'Support Group Meetings' },
  { key: 'reClinicLocation', label: 'Clinic Location' },
  { key: 'deliveryHospital', label: 'Delivery Hospital' },
  { key: 'deliveryHospitalLocation', label: 'Hospital Location' },
  { key: 'escrowOpeningAmount', label: 'Escrow Opening Amount' },
  { key: 'escrowFundAfterLegal', label: 'Fund After Legal' },
  { key: 'lostWages', label: 'Lost Wages' },
  { key: 'hospital', label: 'Hospital (Journey)' },
  { key: 'pumping', label: 'Pumping' },
]

function MatchSheetImport({ matchSheetFile, setMatchSheetFile, matchSheetData, setMatchSheetData, matchSheetParsed, setMatchSheetParsed }) {
  const [expanded, setExpanded] = useState(false)
  const fieldCount = Object.keys(matchSheetData).length

  async function handleFile(files) {
    setMatchSheetFile(files)
    if (files.length > 0) {
      const parsed = await parseMatchSheetExcel(files[0])
      setMatchSheetData(prev => ({ ...prev, ...parsed }))
      setMatchSheetParsed(true)
    }
  }

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 text-stone-400" />
          Match Sheet Data
          {fieldCount > 0 && (
            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
              {fieldCount} field{fieldCount !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        <ChevronDown className={`size-4 text-stone-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-stone-100">
          <p className="text-xs text-stone-400 pt-3">
            Upload an Excel file with match sheet data, or fill in fields manually. Excel can use column headers or Field/Value rows.
          </p>

          {/* File upload */}
          <FileDropZone
            label="Match Sheet Excel"
            icon={FileSpreadsheet}
            accept=".xlsx,.xls,.csv"
            multiple={false}
            files={matchSheetFile}
            onFiles={handleFile}
            description="Excel with match sheet fields"
          />

          {matchSheetParsed && fieldCount === 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              <AlertCircle className="size-3.5 shrink-0" />
              No matching fields found. Check column names or fill in manually below.
            </div>
          )}

          {/* Manual entry / review grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MATCH_SHEET_FIELDS.map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-[10px] text-stone-400 font-medium">{f.label}</label>
                <Input
                  value={matchSheetData[f.key] || ''}
                  onChange={e => setMatchSheetData(prev => {
                    const next = { ...prev }
                    if (e.target.value) next[f.key] = e.target.value
                    else delete next[f.key]
                    return next
                  })}
                  placeholder="—"
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FieldPreview({ title, values }) {
  const entries = Object.entries(values || {}).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
  if (!entries.length) return null
  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <div className="px-3 py-2 border-b border-stone-100">
        <p className="text-xs font-semibold text-stone-600">{title}</p>
      </div>
      <div className="divide-y divide-stone-100">
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[150px_1fr] gap-3 px-3 py-2 text-xs">
            <span className="font-medium text-stone-500">{key}</span>
            <span className="text-stone-700 whitespace-pre-wrap break-words">{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExistingSurrogateApplicationPdfImport({ currentUser }) {
  const [email, setEmail] = useState('')
  const [pdfs, setPdfs] = useState([])
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handlePreview() {
    if (!email.trim()) {
      setError('Enter the surrogate email first.')
      return
    }
    if (!pdfs.length) {
      setError('Drop at least one PDF.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const parsed = await parseSurrogateApplicationPdfFiles(pdfs)
      setPreview({ parsed, summary: getSurrogateApplicationImportSummary(parsed) })
    } catch (err) {
      console.error('PDF preview failed:', err)
      setError(err.message || 'Could not read those PDFs.')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!email.trim()) {
      setError('Enter the surrogate email first.')
      return
    }
    if (!pdfs.length) {
      setError('Drop at least one PDF.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const imported = await importSurrogateApplicationPdfFiles({
        email,
        files: pdfs,
        uploadedBy: currentUser?.name || 'Application PDF Import',
      })
      setPreview({ parsed: imported.parsed, summary: imported.summary })
      setResult(imported)
    } catch (err) {
      console.error('PDF import failed:', err)
      setError(err.message || 'Import failed. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  const summary = preview?.summary
  const parsed = preview?.parsed

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Existing Surrogate Application PDFs</CardTitle>
        <CardDescription>Enter the surrogate email, drop the old application PDFs, preview the mapped fields, then import.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}
        {result && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <Check className="size-4 shrink-0" />
            Imported into {result.intake.applicant_name || result.intake.applicant_email}. {result.uploaded.length} PDF{result.uploaded.length !== 1 ? 's' : ''} uploaded.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Surrogate Email</label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="surrogate@example.com" className="h-9" />
            </div>
            <FileDropZone
              label="Application PDFs"
              icon={FileText}
              accept=".pdf"
              multiple={true}
              files={pdfs}
              onFiles={(files) => { setPdfs(files); setPreview(null); setResult(null) }}
              description="Intake, personal info, employment, references"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handlePreview} disabled={loading || !pdfs.length} className="gap-2">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Preview
              </Button>
              <Button type="button" onClick={handleImport} disabled={loading || !pdfs.length || !email.trim()} className="gap-2" style={{ backgroundColor: '#283693' }}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                Import PDFs
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {!preview ? (
              <div className="h-full min-h-48 rounded-lg border border-dashed border-stone-200 flex items-center justify-center text-sm text-stone-400 px-4 text-center">
                Preview shows the detected forms and mapped answers before anything is saved.
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <p className="text-xs font-semibold text-stone-600 mb-2">Detected PDFs</p>
                  <div className="space-y-1">
                    {summary.sectionsDetected.map(item => (
                      <div key={item.file} className="flex items-center gap-2 text-xs text-stone-600">
                        <FileText className="size-3 text-stone-400" />
                        <span className="truncate">{item.file}</span>
                        <span className="ml-auto rounded-full bg-white border border-stone-200 px-2 py-0.5 capitalize">{item.section}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <FieldPreview title="Intake Answers" values={parsed.intakeAnswers} />
                  <FieldPreview title="Application Details" values={parsed.application} />
                  <FieldPreview title="Confidential Details" values={parsed.confidential} />
                  <FieldPreview title="Employment" values={parsed.employment} />
                  <FieldPreview title="References" values={parsed.references} />
                  <FieldPreview title="Clinic & Hospital" values={parsed.clinicHospital} />
                  {Object.entries(parsed.profileData || {}).map(([section, values]) => (
                    <FieldPreview key={section} title={`Profile: ${section}`} values={values} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MatchJourneySection({ currentUser, navigate }) {
  const [surrogates, setSurrogates] = useState([])
  const [ips, setIPs] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedGC, setSelectedGC] = useState('')
  const [selectedIP, setSelectedIP] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [stage, setStage] = useState('Match Confirmed')
  const [gcSearch, setGcSearch] = useState('')
  const [ipSearch, setIpSearch] = useState('')

  // Match sheet import
  const [matchSheetFile, setMatchSheetFile] = useState([])
  const [matchSheetData, setMatchSheetData] = useState({})
  const [matchSheetParsed, setMatchSheetParsed] = useState(false)

  const [creating, setCreating] = useState(false)
  const [matchResult, setMatchResult] = useState(null)
  const [matchError, setMatchError] = useState(null)

  useEffect(() => {
    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake()])
      .then(([gc, ip]) => {
        setSurrogates(gc || [])
        setIPs(ip || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredGC = surrogates.filter(s =>
    !gcSearch || s.name?.toLowerCase().includes(gcSearch.toLowerCase()) || s.email?.toLowerCase().includes(gcSearch.toLowerCase())
  )
  const filteredIP = ips.filter(ip =>
    !ipSearch || ip.names?.toLowerCase().includes(ipSearch.toLowerCase()) || ip.email?.toLowerCase().includes(ipSearch.toLowerCase())
  )

  const selectedGCName = surrogates.find(s => String(s.id) === selectedGC)?.name
  const selectedIPName = ips.find(ip => String(ip.id) === selectedIP)?.names

  async function handleCreateJourney() {
    if (!selectedGC || !selectedIP) {
      setMatchError('Please select both a surrogate and an intended parent.')
      return
    }

    setCreating(true)
    setMatchError(null)
    setMatchResult(null)

    try {
      const journey = await createMatchedJourney({
        gcCaseId: Number(selectedGC),
        ipCaseId: Number(selectedIP),
        assignedTo: currentUser?.email || null,
        createdBy: currentUser?.name || 'Import',
      })

      if (!journey?.id) throw new Error('Failed to create journey')

      // Update stage, match_date, and match sheet data
      const updates = {}
      if (stage) updates.stage = stage
      if (matchDate) updates.match_date = matchDate

      // Include match sheet data in journey_data
      if (Object.keys(matchSheetData).length > 0) {
        const { lostWages, escrowMin, hospital, pumping, escrowBalance, ...sheetFields } = matchSheetData
        const journeyData = {
          ...(lostWages !== undefined && { lostWages }),
          ...(escrowMin !== undefined && { escrowMin }),
          ...(hospital !== undefined && { hospital }),
          ...(pumping !== undefined && { pumping }),
          ...(escrowBalance !== undefined && { escrowBalance }),
          _matchSheetData: sheetFields,
        }
        updates.journey_data = journeyData
      }

      if (Object.keys(updates).length > 0) {
        await updateMatchedJourney(journey.id, updates)
      }

      setMatchResult({
        journeyId: journey.id,
        gcName: selectedGCName,
        ipName: selectedIPName,
        hasMatchSheet: Object.keys(matchSheetData).length > 0,
      })
    } catch (err) {
      console.error('Journey creation failed:', err)
      setMatchError(err.message || 'Failed to create journey.')
    } finally {
      setCreating(false)
    }
  }

  if (matchResult) {
    return (
      <Card className="max-w-xl">
        <CardContent className="py-12 text-center space-y-4">
          <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Check className="size-8 text-green-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-stone-800">Journey created!</p>
            <p className="text-sm text-stone-500 mt-1">{matchResult.ipName} + {matchResult.gcName}</p>
            {matchDate && <p className="text-xs text-stone-400 mt-1">Original match date: {matchDate}</p>}
            {matchResult.hasMatchSheet && <p className="text-xs text-stone-400">Match sheet data imported</p>}
          </div>
          <div className="flex gap-2 justify-center pt-2">
            <Button onClick={() => navigate(`/journeys/${matchResult.journeyId}`)} style={{ backgroundColor: '#283693' }}>
              View Journey
            </Button>
            <Button variant="outline" onClick={() => { setMatchResult(null); setSelectedGC(''); setSelectedIP(''); setMatchDate(''); setStage('Match Confirmed'); setGcSearch(''); setIpSearch(''); setMatchSheetFile([]); setMatchSheetData({}); setMatchSheetParsed(false) }}>
              Create Another
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Route className="size-4" />
          Link Cases into a Matched Journey
        </CardTitle>
        <CardDescription>Select an existing surrogate and IP to create a journey. Import both cases above first.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {matchError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {matchError}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-stone-400 py-4">
            <Loader2 className="size-4 animate-spin" /> Loading cases...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Surrogate picker */}
            <div className="space-y-2">
              <label className="text-[11px] text-stone-400 font-medium">Surrogate *</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-stone-300" />
                <Input
                  value={gcSearch}
                  onChange={e => { setGcSearch(e.target.value); setSelectedGC('') }}
                  placeholder="Search surrogates..."
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                {filteredGC.length === 0 ? (
                  <p className="text-xs text-stone-400 px-3 py-4 text-center">No surrogates found</p>
                ) : filteredGC.slice(0, 50).map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedGC(String(s.id)); setGcSearch(s.name) }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-stone-50 transition-colors ${
                      String(s.id) === selectedGC ? 'bg-blue-50 text-abc-indigo font-medium' : 'text-stone-700'
                    }`}
                  >
                    <span>{s.name}</span>
                    {s.location && <span className="text-xs text-stone-400 ml-2">{s.location}</span>}
                  </button>
                ))}
              </div>
              {selectedGCName && (
                <p className="text-xs text-green-600 flex items-center gap-1"><Check className="size-3" /> {selectedGCName}</p>
              )}
            </div>

            {/* IP picker */}
            <div className="space-y-2">
              <label className="text-[11px] text-stone-400 font-medium">Intended Parent(s) *</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-stone-300" />
                <Input
                  value={ipSearch}
                  onChange={e => { setIpSearch(e.target.value); setSelectedIP('') }}
                  placeholder="Search IPs..."
                  className="h-9 pl-8 text-sm"
                />
              </div>
              <div className="max-h-40 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                {filteredIP.length === 0 ? (
                  <p className="text-xs text-stone-400 px-3 py-4 text-center">No IPs found</p>
                ) : filteredIP.slice(0, 50).map(ip => (
                  <button
                    key={ip.id}
                    onClick={() => { setSelectedIP(String(ip.id)); setIpSearch(ip.names) }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-stone-50 transition-colors ${
                      String(ip.id) === selectedIP ? 'bg-blue-50 text-abc-indigo font-medium' : 'text-stone-700'
                    }`}
                  >
                    <span>{ip.names}</span>
                    {ip.location && <span className="text-xs text-stone-400 ml-2">{ip.location}</span>}
                  </button>
                ))}
              </div>
              {selectedIPName && (
                <p className="text-xs text-green-600 flex items-center gap-1"><Check className="size-3" /> {selectedIPName}</p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Original Match Date</label>
            <Input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-stone-400 font-medium">Current Stage</label>
            <select value={stage} onChange={e => setStage(e.target.value)} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
              {MATCH_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Match Sheet Import */}
        <MatchSheetImport
          matchSheetFile={matchSheetFile}
          setMatchSheetFile={setMatchSheetFile}
          matchSheetData={matchSheetData}
          setMatchSheetData={setMatchSheetData}
          matchSheetParsed={matchSheetParsed}
          setMatchSheetParsed={setMatchSheetParsed}
        />

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleCreateJourney}
            disabled={creating || !selectedGC || !selectedIP}
            className="gap-2"
            style={{ backgroundColor: '#283693' }}
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Route className="size-4" />}
            {creating ? 'Creating...' : 'Create Matched Journey'}
          </Button>
          <p className="text-xs text-stone-400">
            Links the two cases into an active journey.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CaseImportPage() {
  const { currentUser } = useRole()
  const navigate = useNavigate()

  // Basic info
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', state: '', dob: '',
    caseType: 'surrogate', // surrogate or ip
    applicationDate: '',
    // IP2 fields (only used when caseType === 'ip')
    ip2FirstName: '', ip2LastName: '', ip2Email: '', ip2Phone: '',
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

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB Supabase limit

  async function handleImport() {
    if (!form.firstName || !form.lastName) {
      setError('First name and last name are required.')
      return
    }

    // Check file sizes before uploading
    const allFiles = [...profilePdf, ...applicationPdfs, ...documentsZip, ...photos]
    const oversized = allFiles.find(f => f.size > MAX_FILE_SIZE)
    if (oversized) {
      setError(`File "${oversized.name}" is ${(oversized.size / 1024 / 1024).toFixed(1)}MB — max allowed is 50MB. Remove it or compress it first.`)
      return
    }

    setImporting(true)
    setError(null)
    setResult(null)

    try {
      // 1. Create the case based on type
      let created
      if (form.caseType === 'ip') {
        created = await adminAddIP({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email || '',
          phone: form.phone || '',
          state: form.state || '',
          dob: form.dob || null,
          applicationDate: form.applicationDate || null,
          ip2FirstName: form.ip2FirstName || '',
          ip2LastName: form.ip2LastName || '',
          ip2Email: form.ip2Email || '',
          ip2Phone: form.ip2Phone || '',
          assignedTo: currentUser?.email || null,
        })
      } else {
        created = await adminAddSurrogate({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email || null,
          phone: form.phone || null,
          state: form.state || null,
          dob: form.dob || null,
          applicationDate: form.applicationDate || null,
          assignedTo: currentUser?.email || null,
        })
      }

      if (!created?.id) throw new Error('Failed to create case')

      const caseId = created.id
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
            if (blob.size > MAX_FILE_SIZE) {
              console.warn(`Skipping "${name}" — ${(blob.size / 1024 / 1024).toFixed(1)}MB exceeds 50MB limit`)
              continue
            }
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

      const isIP = form.caseType === 'ip'
      const ip2Name = form.ip2FirstName && form.ip2LastName ? `${form.ip2FirstName} ${form.ip2LastName}` : null
      const displayName = isIP && ip2Name
        ? `${form.firstName} ${form.lastName} & ${ip2Name}`
        : `${form.firstName} ${form.lastName}`
      setResult({
        caseId,
        caseType: form.caseType,
        name: displayName,
        typeLabel: isIP ? 'Intended Parent' : 'Surrogate',
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
              <p className="text-lg font-semibold text-stone-800">{result.name} ({result.typeLabel}) imported successfully</p>
              <div className="text-sm text-stone-500 mt-2 space-y-1">
                {result.documents > 0 && <p>{result.documents} document{result.documents !== 1 ? 's' : ''} uploaded</p>}
                {result.notes > 0 && <p>{result.notes} note{result.notes !== 1 ? 's' : ''} imported</p>}
                {result.photos > 0 && <p>{result.photos} photo{result.photos !== 1 ? 's' : ''} uploaded</p>}
              </div>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Button onClick={() => navigate(result.caseType === 'ip' ? `/intended-parents/${result.caseId}` : `/surrogates/${result.caseId}`)} style={{ backgroundColor: '#283693' }}>
                View Case
              </Button>
              <Button variant="outline" onClick={() => { setResult(null); setForm({ firstName: '', lastName: '', email: '', phone: '', state: '', dob: '', caseType: 'surrogate', applicationDate: '', ip2FirstName: '', ip2LastName: '', ip2Email: '', ip2Phone: '' }); setProfilePdf([]); setApplicationPdfs([]); setDocumentsZip([]); setNotesFile([]); setPhotos([]) }}>
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

      <ExistingSurrogateApplicationPdfImport currentUser={currentUser} />

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Case Information</CardTitle>
          <CardDescription>Enter the basic details for this case</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Case Type *</label>
              <select value={form.caseType} onChange={e => setForm(f => ({ ...f, caseType: e.target.value }))} className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white">
                <option value="surrogate">Surrogate</option>
                <option value="ip">Intended Parent</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">{form.caseType === 'ip' ? 'IP 1 First Name *' : 'First Name *'}</label>
              <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">{form.caseType === 'ip' ? 'IP 1 Last Name *' : 'Last Name *'}</label>
              <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">{form.caseType === 'ip' ? 'IP 1 Email' : 'Email'}</label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">{form.caseType === 'ip' ? 'IP 1 Phone' : 'Phone'}</label>
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
            <div className="space-y-1">
              <label className="text-[11px] text-stone-400 font-medium">Application Date</label>
              <Input type="date" value={form.applicationDate} onChange={e => setForm(f => ({ ...f, applicationDate: e.target.value }))} className="h-9" />
            </div>
          </div>

          {/* IP 2 fields — shown only for IP cases */}
          {form.caseType === 'ip' && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <p className="text-[11px] text-stone-400 font-medium mb-3">IP 2 (Partner) — optional</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400 font-medium">IP 2 First Name</label>
                  <Input value={form.ip2FirstName} onChange={e => setForm(f => ({ ...f, ip2FirstName: e.target.value }))} placeholder="First name" className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400 font-medium">IP 2 Last Name</label>
                  <Input value={form.ip2LastName} onChange={e => setForm(f => ({ ...f, ip2LastName: e.target.value }))} placeholder="Last name" className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400 font-medium">IP 2 Email</label>
                  <Input value={form.ip2Email} onChange={e => setForm(f => ({ ...f, ip2Email: e.target.value }))} placeholder="email@example.com" className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400 font-medium">IP 2 Phone</label>
                  <Input value={form.ip2Phone} onChange={e => setForm(f => ({ ...f, ip2Phone: e.target.value }))} placeholder="(555) 555-5555" className="h-9" />
                </div>
              </div>
            </div>
          )}
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
          This will create a new case and upload all provided files.
        </p>
      </div>

      {/* Divider */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200" /></div>
        <div className="relative flex justify-center">
          <span className="bg-abc-cream px-4 text-xs font-medium text-stone-400 uppercase tracking-wide">Create Matched Journey</span>
        </div>
      </div>

      <MatchJourneySection currentUser={currentUser} navigate={navigate} />
    </div>
  )
}

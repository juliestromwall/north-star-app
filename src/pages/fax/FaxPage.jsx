import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { sendFax, listFaxes, retrieveFax, fileToBase64 } from '@/lib/fax'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchCaseDocuments, uploadBase64ToCaseDocuments, getRecordTracking, setRecordTracking as setRecordTrackingDB } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { useRole } from '@/context/RoleContext'
import { isFaxRead, markFaxRead, markFaxUnread, markAllFaxesRead, getUnreadFaxCount, getFaxFiling, setFaxFiling, getAllFilings } from '@/lib/faxState'
import PageHeader from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Printer, Send, Loader2, RefreshCw, Download, Plus, Paperclip, X,
  Inbox, ArrowUpRight, ArrowDownLeft, CheckCircle2, AlertCircle,
  FileText, Eye, FolderInput, Search, Pencil, EyeOff, Mail,
  ClipboardList, ChevronDown,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatFaxNumber(num) {
  if (!num) return '—'
  const clean = num.replace(/[^\d]/g, '')
  if (clean.length === 11 && clean.startsWith('1')) {
    return `(${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`
  }
  return num
}

function fileSizeLabel(bytes) {
  if (!bytes) return ''
  const n = parseInt(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

const STATUS_STYLES = {
  'Sent': 'bg-emerald-100 text-emerald-700',
  'Queued': 'bg-amber-100 text-amber-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Failed': 'bg-red-100 text-red-700',
}

const MEDICAL_RECORD_STATUSES = [
  { id: 'requested', label: 'Requested' },
  { id: 'request_received', label: 'Request Received' },
  { id: 'followed_up', label: 'Follow Up' },
  { id: 'received', label: 'Received' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'complete', label: 'Complete' },
]

// ── Shared Case Selector Hook ───────────────────────────

function useCaseSelector() {
  const [surrogates, setSurrogates] = useState([])
  const [ips, setIps] = useState([])
  const [journeys, setJourneys] = useState([])
  const [loaded, setLoaded] = useState(false)

  const load = () => {
    if (loaded) return
    Promise.all([
      fetchSurrogatesFromIntake(),
      fetchIPsFromIntake(),
      fetchMatchedJourneys(),
    ]).then(([s, i, j]) => {
      setSurrogates(s || [])
      setIps(i || [])
      setJourneys(j || [])
      setLoaded(true)
    })
  }

  const filter = (caseType, query) => {
    const q = (query || '').toLowerCase()
    if (caseType === 'gc') return surrogates.filter(s => !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q))
    if (caseType === 'ip') return ips.filter(i => !q || i.names?.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q))
    if (caseType === 'journey') return journeys.filter(j => {
      const label = `${j.gc_name || ''} ${j.ip_names || ''}`.toLowerCase()
      return !q || label.includes(q)
    })
    return []
  }

  const getCaseName = (caseType, c) => {
    if (!c) return ''
    if (caseType === 'gc') return c.name
    if (caseType === 'ip') return c.names
    return `${c.gc_name} & ${c.ip_names}`
  }

  const getCaseLink = (caseType, c) => {
    if (!c) return '#'
    if (caseType === 'gc') return `/surrogates/${c.id}`
    if (caseType === 'ip') return `/intended-parents/${c.id}`
    return `/journeys/${c.id}`
  }

  return { surrogates, ips, journeys, loaded, load, filter, getCaseName, getCaseLink }
}

// ── Case Selector Component ─────────────────────────────

function CaseSelector({ caseType, setCaseType, selectedCase, onSelect, onClear, cases, disabled, compact }) {
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const h = compact ? 'h-8 text-sm' : ''

  const q = search.toLowerCase()
  const filtered = q
    ? cases.filter(c => (c._name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.ip1_email || '').toLowerCase().includes(q))
    : cases

  return (
    <div className="flex gap-2">
      <Select value={caseType} onValueChange={v => { setCaseType(v); onClear?.() }}>
        <SelectTrigger className={`w-[130px] ${h}`}>
          <SelectValue placeholder="Case type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="gc">Surrogate</SelectItem>
          <SelectItem value="ip">Intended Parent</SelectItem>
          <SelectItem value="journey">Journey</SelectItem>
        </SelectContent>
      </Select>
      <div className="relative flex-1">
        {selectedCase ? (
          <div className={`flex items-center gap-2 rounded-md border bg-emerald-50 px-3 ${compact ? 'h-8' : 'h-9'} text-sm text-emerald-800`}>
            <CheckCircle2 className="size-3.5 shrink-0" />
            <span className="font-medium truncate">{selectedCase._name}</span>
            <button onClick={onClear} className="ml-auto hover:text-destructive"><X className="size-3" /></button>
          </div>
        ) : (
          <>
            <Input
              placeholder={!caseType ? 'Select case type first' : 'Search cases...'}
              value={search}
              onChange={e => { setSearch(e.target.value); setDropdownOpen(true) }}
              onFocus={() => caseType && setDropdownOpen(true)}
              disabled={!caseType || disabled}
              className={h}
            />
            {dropdownOpen && filtered.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filtered.slice(0, 20).map(c => (
                  <button key={c.id} onClick={() => { onSelect(c); setSearch(''); setDropdownOpen(false) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-0">
                    <div className="font-medium">{c._name}</div>
                    <div className="text-xs text-muted-foreground">{c.email || c.ip1_email || ''}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Send Fax Dialog ─────────────────────────────────────

function SendFaxDialog({ open, onOpenChange, onSent, prefillCaseId, prefillCaseType }) {
  const [to, setTo] = useState('')
  const [file, setFile] = useState(null)
  const [coverPage, setCoverPage] = useState('none')
  const [coverSubject, setCoverSubject] = useState('')
  const [coverMessage, setCoverMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const fileRef = useRef(null)
  const [pickFromCase, setPickFromCase] = useState(false)
  const [caseType, setCaseType] = useState(prefillCaseType || '')
  const [selectedCase, setSelectedCase] = useState(null)
  const [caseDocs, setCaseDocs] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const caseSelector = useCaseSelector()

  useEffect(() => { if (pickFromCase) caseSelector.load() }, [pickFromCase])
  useEffect(() => {
    if (prefillCaseId && prefillCaseType) { setPickFromCase(true); setCaseType(prefillCaseType) }
  }, [prefillCaseId, prefillCaseType])
  useEffect(() => {
    if (!prefillCaseId || !caseSelector.loaded) return
    const cases = caseSelector.filter(prefillCaseType, '')
    const c = cases.find(x => String(x.id) === String(prefillCaseId))
    if (c) handleCaseSelect({ ...c, _name: caseSelector.getCaseName(prefillCaseType, c) })
  }, [prefillCaseId, caseSelector.loaded])

  const filteredCases = caseSelector.filter(caseType, '').map(c => ({ ...c, _name: caseSelector.getCaseName(caseType, c) }))

  const handleCaseSelect = async (c) => {
    setSelectedCase(c)
    setLoadingDocs(true)
    try {
      const caseId = caseType === 'journey' ? c.gc_case_id : c.id
      if (caseId) setCaseDocs(await fetchCaseDocuments(caseId) || [])
    } catch { setCaseDocs([]) }
    setLoadingDocs(false)
  }

  const handleDocSelect = async (doc) => {
    setSelectedDoc(doc)
    try {
      const resp = await fetch(doc.public_url)
      const blob = await resp.blob()
      setFile(new File([blob], doc.file_name, { type: doc.file_type || 'application/pdf' }))
    } catch (err) { alert('Could not load document: ' + err.message) }
  }

  const handleSend = async () => {
    if (!to.trim() || !file) return
    setSending(true)
    try {
      const base64 = await fileToBase64(file)
      await sendFax({ to: to.trim(), fileName: file.name, fileContent: base64, coverPage: coverPage !== 'none' ? coverPage : undefined, coverSubject: coverSubject || undefined, coverMessage: coverMessage || undefined })
      setSent(true)
      onSent?.()
      setTimeout(() => { onOpenChange(false); resetForm() }, 1500)
    } catch (err) { alert('Failed to send fax: ' + err.message) }
    setSending(false)
  }

  const resetForm = () => {
    setSent(false); setTo(''); setFile(null); setSelectedDoc(null)
    setCoverPage('none'); setCoverSubject(''); setCoverMessage('')
    setPickFromCase(false); setCaseType(''); setSelectedCase(null); setCaseDocs([])
  }

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="size-5" /> Send Fax</DialogTitle>
        </DialogHeader>
        {sent ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="size-10 text-green-500 mb-2" />
            <p className="text-sm font-medium">Fax queued successfully!</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Fax Number *</label>
                <Input value={to} onChange={e => setTo(e.target.value)} placeholder="(555) 555-0100" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Document *</label>
                <div className="flex gap-2 mb-2">
                  <Button variant={!pickFromCase ? 'default' : 'outline'} size="sm" onClick={() => setPickFromCase(false)}>
                    <Paperclip className="size-3.5 mr-1" /> Upload File
                  </Button>
                  <Button variant={pickFromCase ? 'default' : 'outline'} size="sm" onClick={() => { setPickFromCase(true); caseSelector.load() }}>
                    <FolderInput className="size-3.5 mr-1" /> From Case
                  </Button>
                </div>
                {pickFromCase ? (
                  <div className="space-y-2">
                    <CaseSelector caseType={caseType} setCaseType={v => { setCaseType(v); setSelectedCase(null); setCaseDocs([]) }}
                      selectedCase={selectedCase} onSelect={handleCaseSelect} onClear={() => { setSelectedCase(null); setCaseDocs([]); setSelectedDoc(null); setFile(null) }}
                      cases={filteredCases} />
                    {selectedCase && (
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        {loadingDocs ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Loading documents...</div>
                        ) : caseDocs.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No documents in this case</p>
                        ) : (
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {caseDocs.map(doc => (
                              <button key={doc.id} onClick={() => handleDocSelect(doc)}
                                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${selectedDoc?.id === doc.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted'}`}>
                                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate flex-1">{doc.file_name}</span>
                                <span className="text-[10px] text-muted-foreground">{fileSizeLabel(doc.file_size)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <input type="file" ref={fileRef} onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setSelectedDoc(null) } }} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.tif,.tiff" />
                    {file && !selectedDoc ? (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                        <FileText className="size-4 shrink-0" />
                        <span className="truncate flex-1">{file.name}</span>
                        <span className="text-xs text-muted-foreground">{fileSizeLabel(file.size)}</span>
                        <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} className="hover:text-destructive"><X className="size-3.5" /></button>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}><Paperclip className="size-4" /> Select File</Button>
                    )}
                    <p className="text-xs text-muted-foreground">PDF, Word, Excel, images, TIFF supported</p>
                  </>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cover Page</label>
                <Select value={coverPage} onValueChange={setCoverPage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No cover page</SelectItem>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Company">Company</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                    <SelectItem value="Confidential">Confidential</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {coverPage !== 'none' && (
                <>
                  <Input value={coverSubject} onChange={e => setCoverSubject(e.target.value)} placeholder="Cover page subject" />
                  <textarea value={coverMessage} onChange={e => setCoverMessage(e.target.value)} placeholder="Cover page message" rows={3}
                    className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSend} disabled={sending || !to.trim() || !file}>
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Send Fax
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Fax Preview Dialog with inline filing + medical records ──

function FaxPreviewDialog({ open, onOpenChange, fax, onFiled }) {
  const { currentUser } = useRole()
  const [pdfData, setPdfData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Filing state
  const [showFile, setShowFile] = useState(false)
  const [caseType, setCaseType] = useState('')
  const [selectedCase, setSelectedCase] = useState(null)
  const [fileName, setFileName] = useState('')
  const [filing, setFiling] = useState(false)
  const [filed, setFiled] = useState(false)
  const caseSelector = useCaseSelector()

  // Medical records state
  const [recordTracking, setRecordTracking] = useState(null)
  const [recordKeys, setRecordKeys] = useState([])
  const [selectedRecord, setSelectedRecord] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [recordNote, setRecordNote] = useState('')
  const [showMedRecords, setShowMedRecords] = useState(false)

  useEffect(() => {
    if (!open || !fax) { setPdfData(null); return }
    setLoading(true)
    setError(null)
    const fn = fax.FileName || 'received-fax.pdf'
    setFileName(fn.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ') + '.pdf')
    retrieveFax(fax.FileName, 'IN')
      .then(data => {
        if (data.fileData) {
          const binary = atob(data.fileData)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          setPdfData(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })))
        } else setError('No file data returned')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
    return () => { if (pdfData) URL.revokeObjectURL(pdfData) }
  }, [open, fax?.FileName])

  useEffect(() => { if (showFile) caseSelector.load() }, [showFile])

  // Load medical records when case is selected
  useEffect(() => {
    if (!selectedCase) { setRecordTracking(null); setRecordKeys([]); return }
    const caseId = caseType === 'journey' ? selectedCase.gc_case_id : selectedCase.id
    if (!caseId) return
    getRecordTracking(caseId).then(tracking => {
      if (tracking) {
        setRecordTracking(tracking)
        setRecordKeys(Object.keys(tracking).filter(k => tracking[k]?.status !== 'na'))
      } else {
        setRecordTracking({})
        setRecordKeys([])
      }
    })
  }, [selectedCase])

  const filteredCases = caseSelector.filter(caseType, '').map(c => ({ ...c, _name: caseSelector.getCaseName(caseType, c) }))

  const handleFile = async () => {
    if (!selectedCase || !fax) return
    setFiling(true)
    try {
      const data = await retrieveFax(fax.FileName, 'IN')
      if (!data.fileData) throw new Error('Could not retrieve fax content')
      const caseId = caseType === 'journey' ? selectedCase.gc_case_id : selectedCase.id
      if (!caseId) throw new Error('No case ID found')
      await uploadBase64ToCaseDocuments({
        surrogateId: caseId, category: 'medical-records',
        fileName: fileName || 'received-fax.pdf', base64Data: data.fileData,
        uploadedBy: currentUser?.name || 'Admin',
      })
      // Update medical records log if selected
      if (selectedRecord && selectedStatus && recordTracking) {
        const current = recordTracking[selectedRecord] || { history: [] }
        const entry = { status: selectedStatus, date: new Date().toISOString().split('T')[0], note: recordNote || `Filed from fax: ${formatFaxNumber(fax?.CallerID || fax?.RemoteID)}`, by: currentUser?.name || 'Admin' }
        const updated = { ...recordTracking, [selectedRecord]: { ...current, status: selectedStatus, history: [...(current.history || []), entry] } }
        await setRecordTrackingDB(caseId, updated)
      }
      // Save filing info locally
      setFaxFiling(fax.FileName, { caseType, caseName: selectedCase._name, caseId: caseType === 'journey' ? selectedCase.id : selectedCase.id, documentName: fileName, filedAt: new Date().toISOString(), filedBy: currentUser?.name || 'Admin' })
      setFiled(true)
      onFiled?.()
      setTimeout(() => { setFiled(false); setShowFile(false); setSelectedCase(null); setCaseType(''); setSelectedRecord(''); setSelectedStatus(''); setRecordNote(''); setShowMedRecords(false) }, 2000)
    } catch (err) { alert('Failed to file document: ' + err.message) }
    setFiling(false)
  }

  const getRecordLabel = (key) => {
    if (!recordTracking?.[key]) return key
    const r = recordTracking[key]
    if (r.customLabel) return r.customLabel
    const match = key.match(/^(ob|delivery|ivf)_records_(\d+)$/)
    if (match) {
      const typeMap = { ob: 'OB', delivery: 'Delivery', ivf: 'IVF' }
      return `${typeMap[match[1]] || match[1]} Records ${parseInt(match[2]) + 1}`
    }
    return key
  }

  const resetAndClose = (v) => {
    if (!v) { setPdfData(null); setShowFile(false); setSelectedCase(null); setCaseType(''); setFiled(false); setSelectedRecord(''); setSelectedStatus(''); setRecordNote(''); setShowMedRecords(false) }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-[95vw] w-[95vw] h-[95vh] flex flex-col !p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="size-5" /> Fax Preview
            <span className="text-sm font-normal text-muted-foreground ml-2">
              From: {formatFaxNumber(fax?.CallerID || fax?.RemoteID)}
              {fax?.Pages && ` · ${fax.Pages} pages`}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant={showFile ? 'default' : 'outline'} className="gap-1.5"
                style={showFile ? { backgroundColor: '#8b5cf6' } : {}}
                onClick={() => setShowFile(!showFile)}>
                <FolderInput className="size-4" /> File to Case
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Filing panel */}
        {showFile && (
          <div className="px-6 pb-3 shrink-0 border-b bg-violet-50/50">
            {filed ? (
              <div className="flex items-center gap-2 py-3 text-sm text-emerald-700">
                <CheckCircle2 className="size-5" />
                <span className="font-medium">Filed to Medical Records — {selectedCase?._name}</span>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1 min-w-[200px] flex-1 max-w-xs">
                    <label className="text-xs font-medium text-muted-foreground">Document Name</label>
                    <Input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="Document name" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1 flex-1 min-w-[350px]">
                    <label className="text-xs font-medium text-muted-foreground">Select Case</label>
                    <CaseSelector caseType={caseType} setCaseType={v => { setCaseType(v); setSelectedCase(null) }}
                      selectedCase={selectedCase}
                      onSelect={c => setSelectedCase({ ...c, _name: caseSelector.getCaseName(caseType, c) })}
                      onClear={() => { setSelectedCase(null); setRecordTracking(null); setRecordKeys([]) }}
                      cases={filteredCases} compact />
                  </div>
                  <Button size="sm" onClick={handleFile} disabled={filing || !selectedCase}
                    style={{ backgroundColor: '#8b5cf6' }} className="h-8 gap-1.5">
                    {filing ? <Loader2 className="size-3.5 animate-spin" /> : <FolderInput className="size-3.5" />}
                    File to Medical Records
                  </Button>
                </div>

                {/* Medical Records Log — warning if empty */}
                {selectedCase && recordTracking !== null && recordKeys.length === 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    This case has no Medical Records tasks to update. You can still file the document.
                  </div>
                )}

                {/* Medical Records Log Update */}
                {selectedCase && recordKeys.length > 0 && (
                  <div className="rounded-md border border-violet-200 bg-white px-3 py-2">
                    <button onClick={() => setShowMedRecords(!showMedRecords)}
                      className="flex items-center gap-2 text-sm font-medium text-violet-800 w-full">
                      <ClipboardList className="size-4" />
                      Update Medical Records Log
                      <ChevronDown className={`size-4 ml-auto transition-transform ${showMedRecords ? 'rotate-180' : ''}`} />
                    </button>
                    {showMedRecords && (
                      <div className="mt-2 flex flex-wrap items-end gap-3">
                        <div className="space-y-1 min-w-[180px]">
                          <label className="text-xs text-muted-foreground">Record</label>
                          <Select value={selectedRecord} onValueChange={setSelectedRecord}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select record..." /></SelectTrigger>
                            <SelectContent>
                              {recordKeys.map(k => (
                                <SelectItem key={k} value={k}>
                                  <span className="flex items-center gap-1.5">
                                    {recordTracking[k]?.recordType && (
                                      <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-blue-100 text-blue-700">{recordTracking[k].recordType}</span>
                                    )}
                                    {getRecordLabel(k)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 min-w-[150px]">
                          <label className="text-xs text-muted-foreground">Status</label>
                          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Status..." /></SelectTrigger>
                            <SelectContent>
                              {MEDICAL_RECORD_STATUSES.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 flex-1 min-w-[180px]">
                          <label className="text-xs text-muted-foreground">Note (optional)</label>
                          <Input value={recordNote} onChange={e => setRecordNote(e.target.value)} placeholder="e.g. Received via fax" className="h-8 text-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-sm text-red-500"><AlertCircle className="size-4 mr-2" /> {error}</div>
          ) : pdfData ? (
            <iframe src={pdfData} className="w-full h-full border-0" title="Fax Preview" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Hero Stats ──────────────────────────────────────────

function HeroStats({ inbox, outbox, unreadCount, filedCount, filter, setFilter }) {
  const stats = [
    { id: 'all-in', label: 'Received', value: inbox.length, color: '#8b5cf6' },
    { id: 'unread', label: 'Unread', value: unreadCount, color: '#ed148c' },
    { id: 'filed', label: 'Filed', value: filedCount, color: '#10b981' },
    { id: 'all-out', label: 'Sent', value: outbox.length, color: '#283693' },
  ]

  return (
    <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #fdf8f3 0%, #f0f1fa 100%)' }}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => {
          const active = filter === s.id
          return (
            <button key={s.id} onClick={() => setFilter(filter === s.id ? 'all-in' : s.id)}
              className={`rounded-lg px-4 py-3 text-center transition-all ${active ? 'bg-white shadow-md ring-2 scale-[1.03]' : 'bg-white/60 hover:bg-white/80'}`}
              style={active ? { ringColor: s.color } : {}}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-0.5">{s.label}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Fax Page ───────────────────────────────────────

export default function FaxPage() {
  const { currentUser } = useRole()
  const [outbox, setOutbox] = useState([])
  const [inbox, setInbox] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const [previewFax, setPreviewFax] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('all-in') // all-in, unread, filed, all-out
  const [, forceUpdate] = useState(0) // trigger re-render after read/unread changes

  const params = new URLSearchParams(window.location.search)
  const prefillCaseType = params.get('caseType') || ''
  const prefillCaseId = params.get('caseId') || ''

  const fetchFaxes = async () => {
    setLoading(true)
    setError(null)
    try {
      const [outData, inData] = await Promise.all([
        listFaxes('OUT', 'ALL').catch(() => ({ faxes: [] })),
        listFaxes('IN', 'ALL').catch(() => ({ faxes: [] })),
      ])
      setOutbox(Array.isArray(outData.faxes) ? outData.faxes : [])
      setInbox(Array.isArray(inData.faxes) ? inData.faxes : [])
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  useEffect(() => {
    fetchFaxes()
    if (prefillCaseType && prefillCaseId) setSendOpen(true)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchFaxes()
    setRefreshing(false)
  }

  const handleDownload = async (fax, direction) => {
    const fn = fax.FileName
    if (!fn) return
    setDownloading(fn)
    try {
      const data = await retrieveFax(fn, direction)
      if (data.fileData) {
        const binary = atob(data.fileData)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = fn; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) { alert('Download failed: ' + err.message) }
    setDownloading(null)
  }

  const handlePreview = (fax) => {
    markFaxRead(fax.FileName)
    setPreviewFax(fax)
    forceUpdate(n => n + 1)
  }

  const toggleRead = (fax) => {
    if (isFaxRead(fax.FileName)) markFaxUnread(fax.FileName)
    else markFaxRead(fax.FileName)
    forceUpdate(n => n + 1)
  }

  const handleMarkAllRead = () => {
    markAllFaxesRead(inbox.map(f => f.FileName))
    forceUpdate(n => n + 1)
  }

  // Compute stats
  const allFilings = getAllFilings()
  const unreadCount = inbox.filter(f => !isFaxRead(f.FileName)).length
  const filedCount = inbox.filter(f => allFilings[f.FileName]).length

  // Filter + search
  const filterFax = (fax) => {
    const q = searchQuery.toLowerCase()
    if (q) {
      const number = (fax.ToFaxNumber || fax.CallerID || fax.RemoteID || '').toLowerCase()
      const filing = allFilings[fax.FileName]
      const filedCase = filing?.caseName?.toLowerCase() || ''
      if (!number.includes(q) && !filedCase.includes(q)) return false
    }
    return true
  }

  const filteredInbox = inbox.filter(fax => {
    if (!filterFax(fax)) return false
    if (filter === 'unread') return !isFaxRead(fax.FileName)
    if (filter === 'filed') return !!allFilings[fax.FileName]
    return true
  })

  const filteredOutbox = outbox.filter(filterFax)
  const showingReceived = filter !== 'all-out'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fax"
        subtitle="Send and receive faxes"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => setSendOpen(true)}>
              <Plus className="size-4" /> Send Fax
            </Button>
          </div>
        }
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="size-4" />
          {error === 'SRFax not configured' ? 'SRFax is not configured yet. Add credentials in Cloudflare.' : error}
        </div>
      )}

      {/* Hero Stats */}
      <HeroStats inbox={inbox} outbox={outbox} unreadCount={unreadCount} filedCount={filedCount} filter={filter} setFilter={setFilter} />

      {/* Toolbar: search + actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search by fax number or case name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        {showingReceived && unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-1.5">
            <CheckCircle2 className="size-3.5" /> Mark All Read
          </Button>
        )}
      </div>

      {/* Fax Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : showingReceived ? (
        /* ── Received Table ── */
        filteredInbox.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Inbox className="size-8 text-stone-200 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {filter === 'unread' ? 'No unread faxes.' : filter === 'filed' ? 'No filed faxes.' : inbox.length === 0 ? 'No received faxes.' : 'No faxes match your search.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground w-8"></th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Fax Number</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Document Name</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Filed To</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Date Filed</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Filed By</th>
                    <th className="py-3 px-4 text-right font-medium text-muted-foreground w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInbox.map(fax => {
                    const isRead = isFaxRead(fax.FileName)
                    const filing = allFilings[fax.FileName]
                    return (
                      <tr key={fax.FileName || fax.FaxDetailsID}
                        className={`group hover:bg-muted/40 transition-colors cursor-pointer ${!isRead ? 'bg-violet-50/60' : ''}`}
                        onClick={() => handlePreview(fax)}>
                        <td className="py-3 px-4">
                          {!isRead && <span className="size-2 rounded-full bg-pink-500 animate-pulse inline-block" />}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={!isRead ? 'font-semibold' : 'font-medium text-foreground/80'}>
                              {formatFaxNumber(fax.CallerID || fax.RemoteID)}
                            </span>
                            {!isRead && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-pink-100 text-pink-700">New</span>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {fax.Pages && `${fax.Pages} pg`}{fax.Pages && fax.Size && ' · '}{fax.Size && fileSizeLabel(fax.Size)}
                            {fax.EpochTime && ` · ${formatDate(new Date(fax.EpochTime * 1000).toISOString())}`}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-foreground/70">
                          {filing?.documentName || <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                          {filing ? (
                            <Link to={filing.caseType === 'gc' ? `/surrogates/${filing.caseId}` : filing.caseType === 'ip' ? `/intended-parents/${filing.caseId}` : `/journeys/${filing.caseId}`}
                              className="text-sm font-medium text-violet-700 hover:underline">
                              {filing.caseName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-foreground/70 whitespace-nowrap">
                          {filing?.filedAt ? formatDate(filing.filedAt) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="py-3 px-4 text-foreground/70">
                          {filing?.filedBy || <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                          <button onClick={() => toggleRead(fax)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                            title={isRead ? 'Mark as unread' : 'Mark as read'}>
                            {isRead ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      ) : (
        /* ── Sent Table ── */
        filteredOutbox.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Printer className="size-8 text-stone-200 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{outbox.length === 0 ? 'No sent faxes yet.' : 'No faxes match your search.'}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Fax Number</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Status</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Pages</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Date Faxed</th>
                    <th className="py-3 px-4 text-left font-medium text-muted-foreground">Sent By</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredOutbox.map(fax => {
                    const sentStatus = fax.SentStatus || ''
                    const statusStyle = STATUS_STYLES[sentStatus] || 'bg-gray-100 text-gray-700'
                    return (
                      <tr key={fax.FileName || fax.FaxDetailsID} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-4 font-medium">{formatFaxNumber(fax.ToFaxNumber)}</td>
                        <td className="py-3 px-4">
                          {sentStatus && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusStyle}`}>{sentStatus}</span>}
                        </td>
                        <td className="py-3 px-4 text-foreground/70">{fax.Pages || '—'}</td>
                        <td className="py-3 px-4 text-foreground/70 whitespace-nowrap">{fax.DateSent ? formatDate(fax.DateSent) : fax.DateQueued ? formatDate(fax.DateQueued) : '—'}</td>
                        <td className="py-3 px-4 text-foreground/70">{currentUser?.name || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      )}

      <SendFaxDialog open={sendOpen} onOpenChange={setSendOpen} onSent={handleRefresh} prefillCaseType={prefillCaseType} prefillCaseId={prefillCaseId} />
      <FaxPreviewDialog open={!!previewFax} onOpenChange={v => { if (!v) setPreviewFax(null) }} fax={previewFax} onFiled={() => { handleRefresh(); forceUpdate(n => n + 1) }} />
    </div>
  )
}

export { SendFaxDialog }

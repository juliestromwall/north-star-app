import { useState, useEffect, useRef, useCallback } from 'react'
import { sendFax, listFaxes, retrieveFax, fileToBase64 } from '@/lib/fax'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchCaseDocuments, uploadBase64ToCaseDocuments } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { useRole } from '@/context/RoleContext'
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
  Inbox, ArrowUpRight, ArrowDownLeft, CheckCircle2, Clock, AlertCircle,
  FileText, Eye, FolderInput, Search, Pencil,
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
  'Received': 'bg-violet-100 text-violet-700',
  'Read': 'bg-gray-100 text-gray-700',
}

// ── Send Fax Dialog ─────────────────────────────────────

function SendFaxDialog({ open, onOpenChange, onSent, prefillFile, prefillCaseId, prefillCaseType }) {
  const [to, setTo] = useState('')
  const [file, setFile] = useState(null)
  const [coverPage, setCoverPage] = useState('none')
  const [coverSubject, setCoverSubject] = useState('')
  const [coverMessage, setCoverMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const fileRef = useRef(null)

  // Case document picker state
  const [pickFromCase, setPickFromCase] = useState(false)
  const [caseType, setCaseType] = useState(prefillCaseType || '')
  const [caseSearch, setCaseSearch] = useState('')
  const [caseDropdownOpen, setCaseDropdownOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState(null)
  const [caseDocs, setCaseDocs] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)

  // Cases data
  const [surrogates, setSurrogates] = useState([])
  const [ips, setIps] = useState([])
  const [journeys, setJourneys] = useState([])
  const [casesLoaded, setCasesLoaded] = useState(false)

  // Load cases when picking from case
  useEffect(() => {
    if (!pickFromCase || casesLoaded) return
    Promise.all([
      fetchSurrogatesFromIntake(),
      fetchIPsFromIntake(),
      fetchMatchedJourneys(),
    ]).then(([s, i, j]) => {
      setSurrogates(s || [])
      setIps(i || [])
      setJourneys(j || [])
      setCasesLoaded(true)
    })
  }, [pickFromCase, casesLoaded])

  // Load prefill case
  useEffect(() => {
    if (prefillCaseId && prefillCaseType) {
      setPickFromCase(true)
      setCaseType(prefillCaseType)
    }
  }, [prefillCaseId, prefillCaseType])

  // Auto-select prefill case when cases load
  useEffect(() => {
    if (!prefillCaseId || !casesLoaded) return
    let c = null
    if (prefillCaseType === 'gc') c = surrogates.find(s => String(s.id) === String(prefillCaseId))
    else if (prefillCaseType === 'ip') c = ips.find(i => String(i.id) === String(prefillCaseId))
    else if (prefillCaseType === 'journey') c = journeys.find(j => String(j.id) === String(prefillCaseId))
    if (c) handleCaseSelect(c)
  }, [prefillCaseId, casesLoaded])

  const filteredCases = (() => {
    const q = caseSearch.toLowerCase()
    if (caseType === 'gc') return surrogates.filter(s => !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q))
    if (caseType === 'ip') return ips.filter(i => !q || i.names?.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q))
    if (caseType === 'journey') return journeys.filter(j => {
      const label = `${j.gc_name || ''} ${j.ip_names || ''}`.toLowerCase()
      return !q || label.includes(q)
    })
    return []
  })()

  const handleCaseSelect = async (c) => {
    setSelectedCase(c)
    setCaseSearch('')
    setCaseDropdownOpen(false)
    setLoadingDocs(true)
    try {
      // For journeys, fetch GC docs
      const caseId = caseType === 'journey' ? c.gc_case_id : c.id
      if (caseId) {
        const docs = await fetchCaseDocuments(caseId)
        setCaseDocs(docs || [])
      }
    } catch { setCaseDocs([]) }
    setLoadingDocs(false)
  }

  const handleDocSelect = async (doc) => {
    setSelectedDoc(doc)
    // Fetch the file from its public URL and convert to a File object
    try {
      const resp = await fetch(doc.public_url)
      const blob = await resp.blob()
      const f = new File([blob], doc.file_name, { type: doc.file_type || 'application/pdf' })
      setFile(f)
    } catch (err) {
      alert('Could not load document: ' + err.message)
    }
  }

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setSelectedDoc(null) }
  }

  const handleSend = async () => {
    if (!to.trim() || !file) return
    setSending(true)
    try {
      const base64 = await fileToBase64(file)
      await sendFax({
        to: to.trim(),
        fileName: file.name,
        fileContent: base64,
        coverPage: coverPage !== 'none' ? coverPage : undefined,
        coverSubject: coverSubject || undefined,
        coverMessage: coverMessage || undefined,
      })
      setSent(true)
      onSent?.()
      setTimeout(() => {
        onOpenChange(false)
        resetForm()
      }, 1500)
    } catch (err) {
      alert('Failed to send fax: ' + err.message)
    }
    setSending(false)
  }

  const resetForm = () => {
    setSent(false); setTo(''); setFile(null); setSelectedDoc(null)
    setCoverPage('none'); setCoverSubject(''); setCoverMessage('')
    setPickFromCase(false); setCaseType(''); setSelectedCase(null); setCaseDocs([])
  }

  const caseName = selectedCase
    ? (caseType === 'gc' ? selectedCase.name : caseType === 'ip' ? selectedCase.names : `${selectedCase.gc_name} & ${selectedCase.ip_names}`)
    : ''

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-5" /> Send Fax
          </DialogTitle>
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
                <Input
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  placeholder="(555) 555-0100"
                />
              </div>

              {/* Document source toggle */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Document *</label>
                <div className="flex gap-2 mb-2">
                  <Button variant={!pickFromCase ? 'default' : 'outline'} size="sm" onClick={() => setPickFromCase(false)}>
                    <Paperclip className="size-3.5 mr-1" /> Upload File
                  </Button>
                  <Button variant={pickFromCase ? 'default' : 'outline'} size="sm" onClick={() => setPickFromCase(true)}>
                    <FolderInput className="size-3.5 mr-1" /> From Case
                  </Button>
                </div>

                {pickFromCase ? (
                  <div className="space-y-2">
                    {/* Case type + search */}
                    <div className="flex gap-2">
                      <Select value={caseType} onValueChange={v => { setCaseType(v); setSelectedCase(null); setCaseDocs([]) }}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Case type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gc">Surrogate</SelectItem>
                          <SelectItem value="ip">Intended Parent</SelectItem>
                          <SelectItem value="journey">Journey</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="relative flex-1">
                        <Input
                          placeholder={!caseType ? 'Select case type first' : 'Search cases...'}
                          value={caseSearch}
                          onChange={e => { setCaseSearch(e.target.value); setCaseDropdownOpen(true) }}
                          onFocus={() => caseType && setCaseDropdownOpen(true)}
                          disabled={!caseType}
                        />
                        {caseDropdownOpen && filteredCases.length > 0 && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {filteredCases.slice(0, 20).map(c => (
                              <button key={c.id} onClick={() => handleCaseSelect(c)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-0">
                                <div className="font-medium">{caseType === 'gc' ? c.name : caseType === 'ip' ? c.names : `${c.gc_name} & ${c.ip_names}`}</div>
                                <div className="text-xs text-muted-foreground">{c.email || c.ip1_email || ''}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected case */}
                    {selectedCase && (
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{caseName}</span>
                          <button onClick={() => { setSelectedCase(null); setCaseDocs([]); setSelectedDoc(null); setFile(null) }}
                            className="text-muted-foreground hover:text-destructive">
                            <X className="size-3.5" />
                          </button>
                        </div>

                        {/* Case documents */}
                        {loadingDocs ? (
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Loader2 className="size-3 animate-spin" /> Loading documents...
                          </div>
                        ) : caseDocs.length === 0 ? (
                          <p className="text-xs text-muted-foreground mt-1">No documents in this case</p>
                        ) : (
                          <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
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
                    <input type="file" ref={fileRef} onChange={handleFileSelect} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.tif,.tiff" />
                    {file && !selectedDoc ? (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                        <FileText className="size-4 shrink-0" />
                        <span className="truncate flex-1">{file.name}</span>
                        <span className="text-xs text-muted-foreground">{fileSizeLabel(file.size)}</span>
                        <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} className="hover:text-destructive">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                        <Paperclip className="size-4" />
                        Select File
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">PDF, Word, Excel, images, TIFF supported</p>
                  </>
                )}
              </div>

              {/* Cover page */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cover Page</label>
                <Select value={coverPage} onValueChange={setCoverPage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <Input
                    value={coverSubject}
                    onChange={e => setCoverSubject(e.target.value)}
                    placeholder="Cover page subject"
                  />
                  <textarea
                    value={coverMessage}
                    onChange={e => setCoverMessage(e.target.value)}
                    placeholder="Cover page message"
                    rows={3}
                    className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
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

// ── File to Case Dialog ─────────────────────────────────

function FileToCaseDialog({ open, onOpenChange, fax, onFiled }) {
  const { currentUser } = useRole()
  const [caseType, setCaseType] = useState('')
  const [caseSearch, setCaseSearch] = useState('')
  const [caseDropdownOpen, setCaseDropdownOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState(null)
  const [fileName, setFileName] = useState('')
  const [filing, setFiling] = useState(false)
  const [filed, setFiled] = useState(false)

  // Cases data
  const [surrogates, setSurrogates] = useState([])
  const [ips, setIps] = useState([])
  const [journeys, setJourneys] = useState([])
  const [casesLoaded, setCasesLoaded] = useState(false)

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetchSurrogatesFromIntake(),
      fetchIPsFromIntake(),
      fetchMatchedJourneys(),
    ]).then(([s, i, j]) => {
      setSurrogates(s || [])
      setIps(i || [])
      setJourneys(j || [])
      setCasesLoaded(true)
    })
  }, [open])

  useEffect(() => {
    if (fax) {
      const fn = fax.FileName || 'received-fax.pdf'
      // Clean up SRFax filename: remove extension, make readable
      const clean = fn.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')
      setFileName(clean + '.pdf')
    }
  }, [fax])

  const filteredCases = (() => {
    const q = caseSearch.toLowerCase()
    if (caseType === 'gc') return surrogates.filter(s => !q || s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q))
    if (caseType === 'ip') return ips.filter(i => !q || i.names?.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q))
    if (caseType === 'journey') return journeys.filter(j => {
      const label = `${j.gc_name || ''} ${j.ip_names || ''}`.toLowerCase()
      return !q || label.includes(q)
    })
    return []
  })()

  const handleCaseSelect = (c) => {
    setSelectedCase(c)
    setCaseSearch('')
    setCaseDropdownOpen(false)
  }

  const handleFile = async () => {
    if (!selectedCase || !fax) return
    setFiling(true)
    try {
      // Retrieve the fax PDF content
      const data = await retrieveFax(fax.FileName, 'IN')
      if (!data.fileData) throw new Error('Could not retrieve fax content')

      // Determine the case ID to file to
      const caseId = caseType === 'journey' ? selectedCase.gc_case_id : selectedCase.id
      if (!caseId) throw new Error('No case ID found')

      await uploadBase64ToCaseDocuments({
        surrogateId: caseId,
        category: 'medical-records',
        fileName: fileName || 'received-fax.pdf',
        base64Data: data.fileData,
        uploadedBy: currentUser?.name || 'Admin',
      })

      setFiled(true)
      onFiled?.()
      setTimeout(() => {
        onOpenChange(false)
        setFiled(false)
        setCaseType('')
        setSelectedCase(null)
        setFileName('')
      }, 1500)
    } catch (err) {
      alert('Failed to file document: ' + err.message)
    }
    setFiling(false)
  }

  const caseName = selectedCase
    ? (caseType === 'gc' ? selectedCase.name : caseType === 'ip' ? selectedCase.names : `${selectedCase.gc_name} & ${selectedCase.ip_names}`)
    : ''

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) { setFiled(false); setCaseType(''); setSelectedCase(null) } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="size-5" /> File to Medical Records
          </DialogTitle>
        </DialogHeader>
        {filed ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="size-10 text-green-500 mb-2" />
            <p className="text-sm font-medium">Filed to Medical Records!</p>
            <p className="text-xs text-muted-foreground mt-1">{caseName}</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Fax info */}
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div className="font-medium">From: {formatFaxNumber(fax?.CallerID || fax?.RemoteID)}</div>
                <div className="text-xs text-muted-foreground">
                  {fax?.Pages ? `${fax.Pages} page${fax.Pages !== '1' ? 's' : ''}` : ''}
                  {fax?.EpochTime && ` · ${formatDate(new Date(fax.EpochTime * 1000).toISOString())}`}
                </div>
              </div>

              {/* Rename */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Document Name</label>
                <div className="flex items-center gap-2">
                  <Pencil className="size-4 text-muted-foreground shrink-0" />
                  <Input value={fileName} onChange={e => setFileName(e.target.value)} placeholder="Document name" />
                </div>
              </div>

              {/* Case selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Select Case *</label>
                <div className="flex gap-2">
                  <Select value={caseType} onValueChange={v => { setCaseType(v); setSelectedCase(null) }}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Case type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gc">Surrogate</SelectItem>
                      <SelectItem value="ip">Intended Parent</SelectItem>
                      <SelectItem value="journey">Journey</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Input
                      placeholder={!caseType ? 'Select case type first' : 'Search cases...'}
                      value={caseSearch}
                      onChange={e => { setCaseSearch(e.target.value); setCaseDropdownOpen(true) }}
                      onFocus={() => caseType && setCaseDropdownOpen(true)}
                      disabled={!caseType}
                    />
                    {caseDropdownOpen && filteredCases.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredCases.slice(0, 20).map(c => (
                          <button key={c.id} onClick={() => handleCaseSelect(c)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-0">
                            <div className="font-medium">{caseType === 'gc' ? c.name : caseType === 'ip' ? c.names : `${c.gc_name} & ${c.ip_names}`}</div>
                            <div className="text-xs text-muted-foreground">{c.email || c.ip1_email || ''}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {selectedCase && (
                  <div className="flex items-center gap-2 rounded-md border bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span className="font-medium">{caseName}</span>
                    <button onClick={() => setSelectedCase(null)} className="ml-auto hover:text-destructive">
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Filing info */}
              <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
                This fax will be filed to the <strong>Medical Records</strong> folder in the selected case's documents.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleFile} disabled={filing || !selectedCase}
                style={{ backgroundColor: '#8b5cf6' }}>
                {filing ? <Loader2 className="size-4 animate-spin" /> : <FolderInput className="size-4" />}
                File to Medical Records
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Fax Preview Dialog ──────────────────────────────────

function FaxPreviewDialog({ open, onOpenChange, fax }) {
  const [pdfData, setPdfData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !fax) { setPdfData(null); return }
    setLoading(true)
    setError(null)
    retrieveFax(fax.FileName, 'IN')
      .then(data => {
        if (data.fileData) {
          const binary = atob(data.fileData)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          const blob = new Blob([bytes], { type: 'application/pdf' })
          setPdfData(URL.createObjectURL(blob))
        } else {
          setError('No file data returned')
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
    return () => { if (pdfData) URL.revokeObjectURL(pdfData) }
  }, [open, fax?.FileName])

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) { setPdfData(null) } }}>
      <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col !p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="size-5" /> Fax Preview
            <span className="text-sm font-normal text-muted-foreground ml-2">
              From: {formatFaxNumber(fax?.CallerID || fax?.RemoteID)}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-sm text-red-500">
              <AlertCircle className="size-4 mr-2" /> {error}
            </div>
          ) : pdfData ? (
            <iframe src={pdfData} className="w-full h-full border-0" title="Fax Preview" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Fax Page ───────────────────────────────────────

export default function FaxPage() {
  const [outbox, setOutbox] = useState([])
  const [inbox, setInbox] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const [previewFax, setPreviewFax] = useState(null)
  const [fileFax, setFileFax] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // URL params for prefill from case pages
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
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchFaxes()
    // Auto-open send dialog if prefill params present
    if (prefillCaseType && prefillCaseId) setSendOpen(true)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchFaxes()
    setRefreshing(false)
  }

  const handleDownload = async (fax, direction) => {
    const fileName = fax.FileName
    if (!fileName) return
    setDownloading(fileName)
    try {
      const data = await retrieveFax(fileName, direction)
      if (data.fileData) {
        const binary = atob(data.fileData)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      alert('Download failed: ' + err.message)
    }
    setDownloading(null)
  }

  // Filter faxes by search
  const filterFax = (fax) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const number = (fax.ToFaxNumber || fax.CallerID || fax.RemoteID || '').toLowerCase()
    const fileName = (fax.FileName || '').toLowerCase()
    return number.includes(q) || fileName.includes(q)
  }

  const filteredOutbox = outbox.filter(filterFax)
  const filteredInbox = inbox.filter(filterFax)

  const renderSentRow = (fax) => {
    const sentStatus = fax.SentStatus || ''
    const statusStyle = STATUS_STYLES[sentStatus] || 'bg-gray-100 text-gray-700'

    return (
      <div key={fax.FileName || fax.FaxDetailsID} className="px-4 py-3 flex items-center gap-3 group hover:bg-muted/50 transition-colors">
        <div className="size-8 rounded-full flex items-center justify-center shrink-0 bg-blue-50">
          <ArrowUpRight className="size-4 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{formatFaxNumber(fax.ToFaxNumber)}</span>
            {sentStatus && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusStyle}`}>{sentStatus}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {fax.Pages && <span>{fax.Pages} page{fax.Pages !== '1' ? 's' : ''}</span>}
            {fax.DateQueued && <span>{formatDate(fax.DateQueued)}</span>}
            {fax.DateSent && <span>Sent: {formatDate(fax.DateSent)}</span>}
          </div>
        </div>
        <button
          onClick={() => handleDownload(fax, 'OUT')}
          disabled={downloading === fax.FileName}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
          title="Download fax"
        >
          {downloading === fax.FileName ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        </button>
      </div>
    )
  }

  const renderReceivedRow = (fax) => {
    const viewedStatus = fax.ViewedStatus || ''
    const isUnread = viewedStatus !== 'Read' && viewedStatus !== 'Y'

    return (
      <div key={fax.FileName || fax.FaxDetailsID} className={`px-4 py-3 flex items-center gap-3 group hover:bg-muted/50 transition-colors ${isUnread ? 'bg-violet-50/50' : ''}`}>
        <div className="size-8 rounded-full flex items-center justify-center shrink-0 bg-violet-50">
          <ArrowDownLeft className="size-4 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isUnread ? 'font-semibold' : 'font-medium'}`}>
              {formatFaxNumber(fax.CallerID || fax.RemoteID)}
            </span>
            {isUnread && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">New</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {fax.Pages && <span>{fax.Pages} page{fax.Pages !== '1' ? 's' : ''}</span>}
            {fax.EpochTime && <span>{formatDate(new Date(fax.EpochTime * 1000).toISOString())}</span>}
            {fax.Size && <span>{fileSizeLabel(fax.Size)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={() => setPreviewFax(fax)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Preview fax"
          >
            <Eye className="size-4" />
          </button>
          <button
            onClick={() => setFileFax(fax)}
            className="p-1.5 rounded hover:bg-violet-100 text-muted-foreground hover:text-violet-700"
            title="File to case"
          >
            <FolderInput className="size-4" />
          </button>
          <button
            onClick={() => handleDownload(fax, 'IN')}
            disabled={downloading === fax.FileName}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Download fax"
          >
            {downloading === fax.FileName ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          </button>
        </div>
      </div>
    )
  }

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
              <Plus className="size-4" />
              Send Fax
            </Button>
          </div>
        }
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="size-4" />
          {error === 'SRFax not configured'
            ? 'SRFax is not configured yet. Add SRFax credentials in Cloudflare environment variables.'
            : error
          }
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by fax number..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">
            Received ({inbox.length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Sent ({outbox.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInbox.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Inbox className="size-8 text-stone-200 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {inbox.length === 0 ? 'No received faxes.' : 'No faxes match your search.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredInbox.map(fax => renderReceivedRow(fax))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOutbox.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Printer className="size-8 text-stone-200 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {outbox.length === 0 ? 'No sent faxes yet.' : 'No faxes match your search.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredOutbox.map(fax => renderSentRow(fax))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <SendFaxDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        onSent={handleRefresh}
        prefillCaseType={prefillCaseType}
        prefillCaseId={prefillCaseId}
      />

      <FaxPreviewDialog
        open={!!previewFax}
        onOpenChange={v => { if (!v) setPreviewFax(null) }}
        fax={previewFax}
      />

      <FileToCaseDialog
        open={!!fileFax}
        onOpenChange={v => { if (!v) setFileFax(null) }}
        fax={fileFax}
        onFiled={handleRefresh}
      />
    </div>
  )
}

// Export SendFaxDialog for use from case pages
export { SendFaxDialog }

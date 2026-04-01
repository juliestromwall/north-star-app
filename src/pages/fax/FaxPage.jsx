import { useState, useEffect, useRef } from 'react'
import { sendFax, listFaxes, retrieveFax, fileToBase64 } from '@/lib/fax'
import PageHeader from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  FileText,
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

function SendFaxDialog({ open, onOpenChange, onSent }) {
  const [to, setTo] = useState('')
  const [file, setFile] = useState(null)
  const [coverPage, setCoverPage] = useState('none')
  const [coverSubject, setCoverSubject] = useState('')
  const [coverMessage, setCoverMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const fileRef = useRef(null)

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
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
        setSent(false)
        setTo('')
        setFile(null)
        setCoverPage('none')
        setCoverSubject('')
        setCoverMessage('')
      }, 1500)
    } catch (err) {
      alert('Failed to send fax: ' + err.message)
    }
    setSending(false)
  }

  return (
    <Dialog open={open} onOpenChange={open => { onOpenChange(open); if (!open) setSent(false) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Fax</DialogTitle>
        </DialogHeader>
        {sent ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="size-10 text-green-500 mb-2" />
            <p className="text-sm font-medium">Fax queued successfully!</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Fax Number *</label>
                <Input
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  placeholder="+1 (555) 555-0100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Document *</label>
                <input type="file" ref={fileRef} onChange={handleFileSelect} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.tif,.tiff" />
                {file ? (
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
              </div>

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

// ── Main Fax Page ───────────────────────────────────────

export default function FaxPage() {
  const [outbox, setOutbox] = useState([])
  const [inbox, setInbox] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sendOpen, setSendOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [downloading, setDownloading] = useState(null)

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

  const renderFaxRow = (fax, direction) => {
    const sentStatus = fax.SentStatus || fax.ViewedStatus || ''
    const statusStyle = STATUS_STYLES[sentStatus] || 'bg-gray-100 text-gray-700'
    const isOut = direction === 'OUT'

    return (
      <div key={fax.FileName || fax.FaxDetailsID} className="px-4 py-3 flex items-center gap-3 group hover:bg-muted/50 transition-colors">
        <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${isOut ? 'bg-blue-50' : 'bg-violet-50'}`}>
          {isOut ? <ArrowUpRight className="size-4 text-blue-500" /> : <ArrowDownLeft className="size-4 text-violet-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{formatFaxNumber(fax.ToFaxNumber || fax.CallerID)}</span>
            {sentStatus && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusStyle}`}>{sentStatus}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{fax.Pages ? `${fax.Pages} page${fax.Pages !== '1' ? 's' : ''}` : ''}</span>
            {fax.DateQueued && <span>{formatDate(fax.DateQueued)}</span>}
            {fax.DateSent && <span>Sent: {formatDate(fax.DateSent)}</span>}
            {fax.EpochTime && !fax.DateSent && <span>{formatDate(new Date(fax.EpochTime * 1000).toISOString())}</span>}
            {fax.Size && <span>{fileSizeLabel(fax.Size)}</span>}
          </div>
        </div>
        <button
          onClick={() => handleDownload(fax, direction)}
          disabled={downloading === fax.FileName}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
          title="Download fax"
        >
          {downloading === fax.FileName ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fax"
        subtitle="Send and receive faxes via SRFax"
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

      <Tabs defaultValue="outbox">
        <TabsList>
          <TabsTrigger value="outbox">
            Sent ({outbox.length})
          </TabsTrigger>
          <TabsTrigger value="inbox">
            Received ({inbox.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="outbox" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : outbox.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Printer className="size-8 text-stone-200 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No sent faxes yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {outbox.map(fax => renderFaxRow(fax, 'OUT'))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="inbox" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : inbox.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Inbox className="size-8 text-stone-200 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No received faxes.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {inbox.map(fax => renderFaxRow(fax, 'IN'))}
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
      />
    </div>
  )
}

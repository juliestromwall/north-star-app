import { useState, useEffect } from 'react'
import { useRole } from '@/context/RoleContext'
import { fetchCaseEmails, deleteCaseEmail } from '@/lib/db'
import { getGoogleStatus, getEmail, parseEmailHeaders, parseEmailBody, parseEmailAttachments, getAttachment } from '@/lib/google'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Mail, MailOpen, Trash2, ExternalLink, Loader2, Download, ArrowLeft, Paperclip, Search, Tag, FileText, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { EMAIL_TEMPLATES, mergeTemplate } from '@/lib/emailTemplates'
import { useDrafts } from '@/context/DraftContext'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function extractName(fromStr) {
  if (!fromStr) return ''
  const match = fromStr.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : fromStr.split('@')[0]
}

function fileSizeLabel(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

const EMAIL_TAGS = [
  { value: 'escrow', label: 'Escrow', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'expense', label: 'Expense', color: 'bg-amber-100 text-amber-700' },
  { value: 'medical_records', label: 'Medical Records', color: 'bg-purple-100 text-purple-700' },
  { value: 'monitoring', label: 'Monitoring', color: 'bg-blue-100 text-blue-700' },
  { value: 'ob', label: 'OB', color: 'bg-pink-100 text-pink-700' },
  { value: 'hospital', label: 'Hospital', color: 'bg-red-100 text-red-700' },
  { value: 'legal', label: 'Legal', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'matching', label: 'Matching', color: 'bg-violet-100 text-violet-700' },
  { value: 'task', label: 'Task', color: 'bg-orange-100 text-orange-700' },
  { value: 'insurance', label: 'Insurance', color: 'bg-teal-100 text-teal-700' },
  { value: 'transfer', label: 'Transfer', color: 'bg-rose-100 text-rose-700' },
  { value: 'psych', label: 'Psych', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'general', label: 'General', color: 'bg-stone-100 text-stone-700' },
]

export default function CaseEmailsTab({ caseId, caseType, caseName, caseEmail, additionalCaseIds = [], caseManagerName }) {
  const { currentUser } = useRole()
  const userId = currentUser?.id
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [loadingFull, setLoadingFull] = useState(false)
  const [fullEmail, setFullEmail] = useState(null)
  const [downloading, setDownloading] = useState(null)
  const [tagFilter, setTagFilter] = useState('')
  const [emailSearch, setEmailSearch] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const { openDraft } = useDrafts()

  useEffect(() => {
    if (!caseId) return
    setLoading(true)
    const caseIds = [caseId, ...additionalCaseIds].filter(Boolean)
    Promise.all([
      Promise.all(caseIds.map(id => fetchCaseEmails(id))).then(results => {
        // Merge and deduplicate by gmail_message_id
        const all = results.flat()
        const seen = new Set()
        return all.filter(e => { if (seen.has(e.gmail_message_id)) return false; seen.add(e.gmail_message_id); return true })
          .sort((a, b) => new Date(b.date) - new Date(a.date))
      }),
      userId ? getGoogleStatus(userId).catch(() => ({ connected: false })) : Promise.resolve({ connected: false }),
    ]).then(([emailData, status]) => {
      setEmails(emailData)
      setConnected(status.connected)
    }).finally(() => setLoading(false))
  }, [caseId, userId])

  const handleDelete = async (emailId) => {
    if (!confirm('Remove this email from this case?')) return
    await deleteCaseEmail(emailId)
    setEmails(prev => prev.filter(e => e.id !== emailId))
  }

  const handleViewFull = async (loggedEmail) => {
    if (!connected || !userId) return
    setSelectedEmail(loggedEmail)
    setLoadingFull(true)
    setFullEmail(null)
    try {
      const full = await getEmail(userId, loggedEmail.gmail_message_id, 'full')
      const headers = parseEmailHeaders(full)
      const bodyHtml = parseEmailBody(full)
      const attachments = parseEmailAttachments(full)
      setFullEmail({ ...headers, bodyHtml, attachments })
    } catch {
      setFullEmail(null)
    }
    setLoadingFull(false)
  }

  const handleDownloadAttachment = async (att) => {
    if (!selectedEmail || !userId) return
    setDownloading(att.attachmentId)
    try {
      const data = await getAttachment(userId, selectedEmail.gmail_message_id, att.attachmentId)
      const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/')
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: att.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = att.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setDownloading(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-12 text-center">
          <Mail className="size-8 text-stone-200 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No emails logged for this case yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Go to Email and use "Log to Case" to link emails here.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Filter emails
  const filteredEmails = emails.filter(e => {
    if (tagFilter && e.tag !== tagFilter) return false
    if (emailSearch) {
      const q = emailSearch.toLowerCase()
      if (!(e.subject || '').toLowerCase().includes(q) && !(e.from_address || '').toLowerCase().includes(q) && !(e.snippet || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  // Tags that exist on logged emails
  const usedTags = [...new Set(emails.map(e => e.tag).filter(Boolean))]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filteredEmails.length} of {emails.length} email{emails.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2">
          {caseEmail && (
            <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setTemplateOpen(true)}>
              <FileText className="size-3" /> Send Template
            </Button>
          )}
          <div className="relative w-48">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input value={emailSearch} onChange={e => setEmailSearch(e.target.value)} placeholder="Search emails..." className="h-7 text-xs pl-8" />
          </div>
        </div>
      </div>
      {usedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setTagFilter('')} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${!tagFilter ? 'bg-[#283693] text-white border-transparent' : 'bg-white text-stone-500 border-stone-200'}`}>All</button>
          {usedTags.map(t => {
            const tagObj = EMAIL_TAGS.find(et => et.value === t)
            return (
              <button key={t} onClick={() => setTagFilter(tagFilter === t ? '' : t)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${tagFilter === t ? (tagObj?.color || 'bg-stone-200 text-stone-700') + ' border-transparent' : 'bg-white text-stone-500 border-stone-200'}`}>
                {tagObj?.label || t}
              </button>
            )
          })}
        </div>
      )}
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredEmails.map(email => {
              const tagObj = email.tag ? EMAIL_TAGS.find(t => t.value === email.tag) : null
              return (
              <div key={email.id} className="px-4 py-3 flex items-start gap-3 group">
                <Mail className="size-4 text-muted-foreground mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button onClick={() => connected && handleViewFull(email)} className={`text-sm font-medium truncate text-left ${connected ? 'text-[#283693] hover:underline cursor-pointer' : ''}`}>{email.subject || '(no subject)'}</button>
                      {tagObj && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${tagObj.color}`}>{tagObj.label}</span>}
                      {email.from_address?.includes(currentUser?.email) || email.to_address?.includes(currentUser?.email) ? (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${email.from_address?.includes(currentUser?.email) ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                          {email.from_address?.includes(currentUser?.email) ? 'Sent' : 'Received'}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{formatDate(email.date)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    From: {extractName(email.from_address) || email.from_address}
                  </p>
                  {email.snippet && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{email.snippet}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Logged by {email.logged_by_name}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDelete(email.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    title="Remove from case"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            )})}
          </div>
        </CardContent>
      </Card>

      {/* Full email view dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={(open) => { if (!open) { setSelectedEmail(null); setFullEmail(null) } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedEmail?.subject || '(no subject)'}</DialogTitle>
          </DialogHeader>
          {loadingFull ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : fullEmail ? (
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{extractName(fullEmail.from)}</p>
                  <p className="text-xs text-muted-foreground">To: {fullEmail.to}</p>
                  {fullEmail.cc && <p className="text-xs text-muted-foreground">Cc: {fullEmail.cc}</p>}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(fullEmail.date)}</p>
              </div>
              {fullEmail.attachments?.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {fullEmail.attachments.map((att, i) => (
                    <button
                      key={i}
                      onClick={() => handleDownloadAttachment(att)}
                      disabled={downloading === att.attachmentId}
                      className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
                    >
                      {downloading === att.attachmentId ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                      <span className="max-w-[150px] truncate">{att.filename}</span>
                      <span className="text-muted-foreground">{fileSizeLabel(att.size)}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="border-t pt-4">
                <div
                  className="prose prose-sm max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: fullEmail.bodyHtml || '' }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Could not load the full email. It may have been deleted from Gmail.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

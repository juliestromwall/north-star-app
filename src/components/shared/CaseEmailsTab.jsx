import { useState, useEffect } from 'react'
import { useRole } from '@/context/RoleContext'
import { fetchCaseEmails, deleteCaseEmail, updateCaseEmailPrivate } from '@/lib/db'
import { getGoogleStatus, getEmail, parseEmailHeaders, parseEmailBody, parseEmailAttachments, getAttachment } from '@/lib/google'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Mail, MailOpen, Trash2, ExternalLink, Loader2, Download, ArrowLeft, Paperclip, Search, Tag, FileText, Send, Lock, Unlock } from 'lucide-react'
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
  const { currentUser, isMasterAdmin } = useRole()
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
      // Filter out private emails for non-master admins
      const visible = isMasterAdmin ? emailData : emailData.filter(e => !e.is_private)
      setEmails(visible)
      setConnected(status.connected)
    }).finally(() => setLoading(false))
  }, [caseId, userId, isMasterAdmin])

  const handleDelete = async (emailId) => {
    if (!confirm('Remove this email from this case?')) return
    await deleteCaseEmail(emailId)
    setEmails(prev => prev.filter(e => e.id !== emailId))
  }

  const handleViewFull = async (loggedEmail) => {
    setSelectedEmail(loggedEmail)
    setLoadingFull(true)
    setFullEmail(null)

    // 1. Use stored body_html first (works for any admin without Gmail access)
    if (loggedEmail.body_html) {
      setFullEmail({
        from: loggedEmail.from_address || loggedEmail.logged_by_name || 'System',
        to: loggedEmail.to_address || '',
        date: loggedEmail.date,
        subject: loggedEmail.subject,
        bodyHtml: loggedEmail.body_html,
        attachments: [],
      })
      setLoadingFull(false)
      return
    }

    // 2. System-generated emails (not from Gmail) — show snippet as body
    const isSystemEmail = !loggedEmail.gmail_message_id || loggedEmail.gmail_message_id.startsWith('release-forms-') || loggedEmail.gmail_message_id.startsWith('sent-') || loggedEmail.gmail_message_id.startsWith('system-') || loggedEmail.gmail_message_id.startsWith('fax-')
    if (isSystemEmail) {
      setFullEmail({
        from: loggedEmail.from_address || loggedEmail.logged_by_name || 'System',
        to: loggedEmail.to_address || '',
        date: loggedEmail.date,
        subject: loggedEmail.subject,
        bodyHtml: `<p>${loggedEmail.snippet || loggedEmail.subject || ''}</p>`,
        attachments: [],
      })
      setLoadingFull(false)
      return
    }

    // 3. Try fetching from Gmail (only works if current admin has access)
    if (connected && userId) {
      try {
        const full = await getEmail(userId, loggedEmail.gmail_message_id, 'full')
        const headers = parseEmailHeaders(full)
        const bodyHtml = parseEmailBody(full)
        const attachments = parseEmailAttachments(full)
        setFullEmail({ ...headers, bodyHtml, attachments })
        setLoadingFull(false)
        return
      } catch {}
    }

    // 4. Fallback — show whatever metadata we have (snippet + logged_by info)
    setFullEmail({
      from: loggedEmail.from_address || '',
      to: loggedEmail.to_address || '',
      date: loggedEmail.date,
      subject: loggedEmail.subject,
      bodyHtml: `
        <div style="background: #fef3c7; border-left: 3px solid #f59e0b; padding: 12px; margin-bottom: 16px; border-radius: 4px;">
          <p style="margin: 0; font-size: 12px; color: #92400e;"><strong>Note:</strong> Full email body not available — this email was logged before body storage was enabled, or the original logger no longer has access to the email in their inbox.</p>
        </div>
        <p>${loggedEmail.snippet || '(No preview available)'}</p>
        <p style="color: #78716c; font-size: 12px; margin-top: 16px;">Logged by ${loggedEmail.logged_by_name || 'Unknown'}</p>
      `,
      attachments: [],
    })
    setLoadingFull(false)
  }

  async function togglePrivate(emailId, currentVal) {
    try {
      await updateCaseEmailPrivate(emailId, !currentVal)
      setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_private: !currentVal } : e))
    } catch (err) {
      console.error('Failed to toggle private:', err)
    }
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
              <div key={email.id} className={`px-4 py-3 flex items-start gap-3 group ${email.is_private ? 'bg-purple-50/40' : ''}`}>
                <Mail className="size-4 text-muted-foreground mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button onClick={() => handleViewFull(email)} className="text-sm font-medium truncate text-left text-[#283693] hover:underline cursor-pointer">{email.subject || '(no subject)'}</button>
                      {tagObj && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${tagObj.color}`}>{tagObj.label}</span>}
                      {email.is_private && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 bg-purple-100 text-purple-700 inline-flex items-center gap-0.5">
                          <Lock className="size-2.5" /> Private
                        </span>
                      )}
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
                  {isMasterAdmin && (
                    <button
                      onClick={() => togglePrivate(email.id, email.is_private)}
                      className={`p-1.5 rounded hover:bg-purple-100 ${email.is_private ? 'text-purple-600' : 'text-muted-foreground hover:text-purple-600'}`}
                      title={email.is_private ? 'Make public' : 'Mark as private (master admins only)'}
                    >
                      {email.is_private ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                    </button>
                  )}
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

      {/* Template Selection Dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="size-5 text-[#283693]" /> Send Email Template</DialogTitle>
          </DialogHeader>
          {!selectedTemplate ? (
            <div className="space-y-2">
              <p className="text-xs text-stone-400">Choose a template to send to {caseName || 'this case'}</p>
              {EMAIL_TEMPLATES.filter(t => !caseType || t.forType === caseType || t.forType === 'any').map(t => (
                <button key={t.id} onClick={() => setSelectedTemplate(t)}
                  className="w-full text-left rounded-lg border border-stone-100 px-4 py-3 hover:border-stone-300 hover:shadow-sm transition-all">
                  <p className="text-sm font-medium text-stone-800">{t.name}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{t.subject}</p>
                </button>
              ))}
              {EMAIL_TEMPLATES.filter(t => !caseType || t.forType === caseType || t.forType === 'any').length === 0 && (
                <p className="text-sm text-stone-400 text-center py-4">No templates available for this case type</p>
              )}
            </div>
          ) : (() => {
            const firstName = caseName?.split(' ')[0] || ''
            const merged = mergeTemplate(selectedTemplate, { firstName, fullName: caseName, caseManager: caseManagerName || 'your case manager' })
            return (
              <div className="space-y-4">
                <button onClick={() => setSelectedTemplate(null)} className="text-xs text-stone-400 hover:text-stone-600">← Back to templates</button>
                <div className="rounded-lg border border-stone-200 p-4 space-y-2">
                  <p className="text-xs text-stone-400">To: <span className="text-stone-700">{caseEmail}</span></p>
                  <p className="text-xs text-stone-400">Subject: <span className="text-stone-700 font-medium">{merged.subject}</span></p>
                  <hr className="border-stone-100" />
                  <div className="prose prose-sm max-w-none text-sm" dangerouslySetInnerHTML={{ __html: merged.body }} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedTemplate(null); setTemplateOpen(false) }}>Cancel</Button>
                  <Button size="sm" className="gap-1 text-white" style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }}
                    onClick={() => {
                      openDraft({ to: caseEmail, subject: merged.subject, body: merged.body, caseId, caseType, userId: currentUser?.id })
                      setSelectedTemplate(null)
                      setTemplateOpen(false)
                    }}>
                    <Send className="size-3" /> Open in Compose
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

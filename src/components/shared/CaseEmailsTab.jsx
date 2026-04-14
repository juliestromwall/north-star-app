import { useState, useEffect } from 'react'
import { useRole } from '@/context/RoleContext'
import { fetchCaseEmails, deleteCaseEmail, updateCaseEmailPrivate } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { getGoogleStatus, getEmail, listEmails, parseEmailHeaders, parseEmailBody, parseEmailAttachments, getAttachment } from '@/lib/google'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Mail, MailOpen, Trash2, ExternalLink, Loader2, Download, ArrowLeft, Paperclip, Search, Tag, FileText, Send, Lock, Unlock, LinkIcon, X } from 'lucide-react'
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

export default function CaseEmailsTab({ caseId, caseType, caseName, caseEmail, additionalCaseIds = [], caseManagerName, contactEmails = [], onUnreadCount }) {
  const { currentUser, isMasterAdmin } = useRole()
  const userId = currentUser?.id
  const [emails, setEmails] = useState([])
  const [inboxEmails, setInboxEmails] = useState([])
  const [loadingInbox, setLoadingInbox] = useState(false)
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
  const [viewMode, setViewMode] = useState('logged') // 'logged' | 'inbox'
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
      // Fetch inbox emails from Gmail for case contacts
      if (status.connected && userId && contactEmails.length > 0) {
        fetchInboxEmails(userId, contactEmails, visible)
      }
    }).finally(() => setLoading(false))
  }, [caseId, userId, isMasterAdmin])

  async function fetchInboxEmails(uid, contacts, loggedEmails) {
    setLoadingInbox(true)
    try {
      const query = contacts.map(e => `from:${e} OR to:${e}`).join(' OR ')
      const data = await listEmails(uid, { query, maxResults: 30 })
      if (!data.messages?.length) { setInboxEmails([]); setLoadingInbox(false); return }

      // Fetch metadata for each message
      const fetched = await Promise.all(
        data.messages.slice(0, 30).map(m => getEmail(uid, m.id, 'metadata').catch(() => null))
      )
      const parsed = fetched.filter(Boolean).map(parseEmailHeaders)

      // Filter out already-logged emails
      const loggedIds = new Set(loggedEmails.map(e => e.gmail_message_id))
      const unlogged = parsed.filter(e => !loggedIds.has(e.id))

      setInboxEmails(unlogged)

      // Report unread count to parent
      const unreadCount = unlogged.filter(e => e.isUnread).length
      if (onUnreadCount) onUnreadCount(unreadCount)
    } catch (err) {
      console.error('Failed to fetch inbox emails:', err)
    }
    setLoadingInbox(false)
  }

  // View a Gmail inbox email
  const handleViewInboxEmail = async (msg) => {
    setSelectedEmail({ ...msg, _fromInbox: true })
    setLoadingFull(true)
    setFullEmail(null)
    try {
      const full = await getEmail(userId, msg.id, 'full')
      const headers = parseEmailHeaders(full)
      const bodyHtml = parseEmailBody(full)
      const attachments = parseEmailAttachments(full)
      setFullEmail({ ...headers, bodyHtml, attachments })
      // Mark as read in Gmail
      if (msg.isUnread) {
        const { modifyEmail } = await import('@/lib/google')
        await modifyEmail(userId, msg.id, { removeLabels: ['UNREAD'] })
        setInboxEmails(prev => prev.map(e => e.id === msg.id ? { ...e, isUnread: false, labelIds: (e.labelIds || []).filter(l => l !== 'UNREAD') } : e))
        const newUnread = inboxEmails.filter(e => e.isUnread && e.id !== msg.id).length
        if (onUnreadCount) onUnreadCount(newUnread)
      }
    } catch {
      setFullEmail(null)
    }
    setLoadingFull(false)
  }

  // Quick-log an inbox email to this case
  const handleQuickLog = async (msg) => {
    if (!supabase || !caseId) return
    try {
      // Fetch body for storage
      let bodyHtml = null
      try {
        const full = await getEmail(userId, msg.id, 'full')
        bodyHtml = parseEmailBody(full)
      } catch {}
      const { error } = await supabase.from('case_emails').insert({
        gmail_message_id: msg.id,
        gmail_thread_id: msg.threadId,
        case_id: caseId,
        case_type: caseType,
        subject: msg.subject,
        from_address: msg.from,
        to_address: msg.to,
        date: msg.date ? new Date(msg.date).toISOString() : null,
        snippet: msg.snippet,
        body_html: bodyHtml,
        logged_by: userId,
        logged_by_name: currentUser?.name || '',
      })
      if (!error) {
        // Move from inbox list to logged list
        setInboxEmails(prev => prev.filter(e => e.id !== msg.id))
        setEmails(prev => [{
          gmail_message_id: msg.id, subject: msg.subject, from_address: msg.from,
          to_address: msg.to, date: msg.date ? new Date(msg.date).toISOString() : null,
          snippet: msg.snippet, body_html: bodyHtml, logged_by_name: currentUser?.name || '',
        }, ...prev])
      }
    } catch (err) {
      console.error('Quick log failed:', err)
    }
  }

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

  const [previewAtt, setPreviewAtt] = useState(null) // { url, filename, mimeType }
  const [savingAtt, setSavingAtt] = useState(null)
  const [saveAttDialog, setSaveAttDialog] = useState(null) // attachment to save
  const [saveCategory, setSaveCategory] = useState('other')

  const DOC_FOLDERS = [
    { id: 'agency-documents', label: 'Agency Documents' },
    { id: 'clinic', label: 'Clinic' },
    { id: 'medical-records', label: 'Medical Records' },
    { id: 'insurance', label: 'Insurance' },
    { id: 'legal', label: 'Legal Documents' },
    { id: 'escrow', label: 'Escrow' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'other', label: 'Other' },
  ]

  async function getAttachmentBlob(att) {
    const msgId = selectedEmail.gmail_message_id || selectedEmail.id
    const data = await getAttachment(userId, msgId, att.attachmentId)
    const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: att.mimeType })
  }

  const handlePreviewAttachment = async (att) => {
    if (!selectedEmail || !userId) return
    setDownloading(att.attachmentId)
    try {
      const blob = await getAttachmentBlob(att)
      const url = URL.createObjectURL(blob)
      // Close email dialog first, then show preview
      setSelectedEmail(null)
      setFullEmail(null)
      setTimeout(() => setPreviewAtt({ url, filename: att.filename, mimeType: att.mimeType }), 100)
    } catch {}
    setDownloading(null)
  }

  const handleSaveAttToCase = async (att, category) => {
    if (!selectedEmail || !userId || !caseId || !supabase) return
    setSavingAtt(att.attachmentId)
    try {
      const blob = await getAttachmentBlob(att)
      // Sanitize filename for Supabase storage (remove special chars)
      const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      const file = new File([blob], safeName, { type: att.mimeType })
      const { uploadCaseDocument } = await import('@/lib/db')
      await uploadCaseDocument({ surrogateId: caseId, category: category || 'other', file, uploadedBy: currentUser?.name || 'Admin' })
      setSaveAttDialog(null)
    } catch (err) {
      console.error('Save attachment to case failed:', err)
      alert('Failed to save: ' + (err.message || 'Unknown error'))
    }
    setSavingAtt(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (emails.length === 0 && inboxEmails.length === 0 && !loadingInbox && contactEmails.length === 0) {
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

  // Auto-switch to inbox if no logged emails but inbox has items
  if (emails.length === 0 && inboxEmails.length > 0 && viewMode === 'logged') {
    setViewMode('inbox')
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

  const unreadInboxCount = inboxEmails.filter(e => e.isUnread).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* View mode tabs */}
          {contactEmails.length > 0 && connected && (
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('logged')} className={`px-3 py-1 text-xs font-medium transition-colors ${viewMode === 'logged' ? 'bg-[#283693] text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}>
                Logged ({emails.length})
              </button>
              <button onClick={() => setViewMode('inbox')} className={`px-3 py-1 text-xs font-medium transition-colors relative ${viewMode === 'inbox' ? 'bg-[#283693] text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}>
                Inbox ({inboxEmails.length})
                {unreadInboxCount > 0 && viewMode !== 'inbox' && (
                  <span className="absolute -top-1 -right-1 flex size-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                    <span className="relative inline-flex rounded-full size-2 bg-pink-500" />
                  </span>
                )}
              </button>
            </div>
          )}
          {viewMode === 'logged' && <p className="text-sm text-muted-foreground">{filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}</p>}
          {viewMode === 'inbox' && <p className="text-sm text-muted-foreground">{inboxEmails.length} from contacts{unreadInboxCount > 0 ? ` · ${unreadInboxCount} unread` : ''}</p>}
        </div>
        <div className="flex items-center gap-2">
          {caseEmail && (
            <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setTemplateOpen(true)}>
              <FileText className="size-3" /> Send Template
            </Button>
          )}
          {viewMode === 'logged' && (
            <div className="relative w-48">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <Input value={emailSearch} onChange={e => setEmailSearch(e.target.value)} placeholder="Search emails..." className="h-7 text-xs pl-8" />
            </div>
          )}
        </div>
      </div>
      {viewMode === 'logged' && usedTags.length > 0 && (
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
      {/* Inbox view */}
      {viewMode === 'inbox' && (
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            {loadingInbox ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="size-5 animate-spin text-stone-400" /></div>
            ) : inboxEmails.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-8">No recent emails from case contacts</p>
            ) : (
              <div className="divide-y">
                {inboxEmails.map(msg => (
                  <div key={msg.id} className={`px-4 py-3 flex items-start gap-3 group ${msg.isUnread ? 'bg-blue-50/40' : ''}`}>
                    {msg.isUnread ? <MailOpen className="size-4 text-blue-500 mt-1 shrink-0" /> : <Mail className="size-4 text-muted-foreground mt-1 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button onClick={() => handleViewInboxEmail(msg)} className="text-sm font-medium truncate text-left text-[#283693] hover:underline cursor-pointer">
                            {msg.subject || '(no subject)'}
                          </button>
                          {msg.isUnread && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">New</span>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{formatDate(msg.date)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">From: {extractName(msg.from) || msg.from}</p>
                      {msg.snippet && <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.snippet}</p>}
                    </div>
                    <button onClick={() => handleQuickLog(msg)} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-lg text-[10px] font-semibold bg-[#283693] text-white hover:bg-[#283693]/90" title="Log to this case">
                      <LinkIcon className="size-3 inline mr-1" />Log
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Logged emails view */}
      {viewMode === 'logged' && <Card className="rounded-2xl">
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
      </Card>}

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
                <div className="border-t pt-3 space-y-2">
                  <p className="text-[10px] font-semibold text-stone-400 uppercase">Attachments ({fullEmail.attachments.length})</p>
                  <div className="space-y-1.5">
                    {fullEmail.attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border bg-stone-50/50 px-3 py-2">
                        <Paperclip className="size-3.5 text-stone-400 shrink-0" />
                        <span className="text-xs font-medium truncate flex-1">{att.filename}</span>
                        <span className="text-[10px] text-stone-400 shrink-0">{fileSizeLabel(att.size)}</span>
                        <button onClick={() => handlePreviewAttachment(att)} disabled={downloading === att.attachmentId}
                          className="text-[10px] font-semibold text-[#283693] hover:underline shrink-0">
                          {downloading === att.attachmentId ? <Loader2 className="size-3 animate-spin" /> : 'Preview'}
                        </button>
                        <button onClick={() => { setSaveAttDialog(att); setSaveCategory('other') }}
                          className="text-[10px] font-semibold text-emerald-600 hover:underline shrink-0">
                          Save to Case
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t pt-4">
                <div
                  className="prose prose-sm max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: fullEmail.bodyHtml || '' }}
                />
              </div>
              {/* Actions for inbox emails */}
              {selectedEmail?._fromInbox && (
                <div className="border-t pt-3 flex items-center gap-2">
                  <Button size="sm" className="gap-1.5 text-xs" style={{ backgroundColor: '#283693' }}
                    onClick={() => { handleQuickLog(selectedEmail); setSelectedEmail(null); setFullEmail(null) }}>
                    <LinkIcon className="size-3" /> Log to Case
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Could not load the full email. It may have been deleted from Gmail.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Attachment Preview — close email dialog first, then show preview */}
      <Dialog open={!!previewAtt} onOpenChange={(open) => { if (!open && previewAtt) { URL.revokeObjectURL(previewAtt.url); setPreviewAtt(null) } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold truncate">{previewAtt?.filename}</p>
          </div>
          <div className="flex-1 overflow-auto p-1">
            {previewAtt?.mimeType?.startsWith('image/') ? (
              <img src={previewAtt?.url} alt={previewAtt?.filename} className="max-w-full max-h-[75vh] mx-auto" />
            ) : previewAtt?.mimeType === 'application/pdf' ? (
              <iframe src={previewAtt?.url} className="w-full h-[75vh] rounded" title={previewAtt?.filename} />
            ) : previewAtt ? (
              <div className="flex flex-col items-center justify-center py-16 text-stone-400">
                <Paperclip className="size-10 mb-3" />
                <p className="text-sm">Preview not available for this file type</p>
                <p className="text-xs mt-1">{previewAtt.mimeType}</p>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Attachment to Case — Folder Picker */}
      <Dialog open={!!saveAttDialog} onOpenChange={(open) => { if (!open) setSaveAttDialog(null) }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Save to Documents</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-stone-500 truncate">{saveAttDialog?.filename}</p>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-stone-400 uppercase">Select folder</p>
              <div className="grid grid-cols-2 gap-1.5">
                {DOC_FOLDERS.map(f => (
                  <button key={f.id} onClick={() => setSaveCategory(f.id)}
                    className={`text-xs text-left px-3 py-2 rounded-lg border transition-all ${saveCategory === f.id ? 'border-[#283693] bg-[#283693]/5 text-[#283693] font-semibold' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <Button size="sm" className="w-full gap-1.5" style={{ backgroundColor: '#283693' }} disabled={savingAtt === saveAttDialog?.attachmentId}
              onClick={() => saveAttDialog && handleSaveAttToCase(saveAttDialog, saveCategory)}>
              {savingAtt === saveAttDialog?.attachmentId ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
              {savingAtt ? 'Saving...' : 'Save to Documents'}
            </Button>
          </div>
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

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useRole } from '@/context/RoleContext'
import {
  listEmails, getEmail, sendEmail, modifyEmail, getAttachment,
  getGoogleStatus, parseEmailHeaders, parseEmailBody, parseEmailAttachments,
  connectGoogle,
} from '@/lib/google'
import { supabase } from '@/lib/supabase'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import PageHeader from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Search, RefreshCw, Mail, MailOpen, Send, Paperclip, ArrowLeft,
  Star, Archive, Trash2, Reply, Forward, X, Loader2, Plus, LinkIcon,
  Inbox, AlertCircle, CheckCircle2, Download,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatFullDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function extractName(fromStr) {
  if (!fromStr) return ''
  const match = fromStr.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : fromStr.split('@')[0]
}

function extractEmail(fromStr) {
  if (!fromStr) return fromStr
  const match = fromStr.match(/<([^>]+)>/)
  return match ? match[1] : fromStr
}

function fileSizeLabel(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Not Connected State ─────────────────────────────────

function NotConnectedState({ userId }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Mail className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Connect your Google account</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Connect your Gmail to send and receive emails directly from ABC Surrogacy.
        You can manage your connection in Settings.
      </p>
      <Button onClick={() => connectGoogle(userId)}>
        Connect Google Account
      </Button>
    </div>
  )
}

// ── Compose Dialog ──────────────────────────────────────

function ComposeDialog({ open, onOpenChange, userId, replyTo, forwardMsg, onSent }) {
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState([])
  const [sending, setSending] = useState(false)
  const [showCcBcc, setShowCcBcc] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return
    if (replyTo) {
      const from = extractEmail(replyTo.from)
      setTo(from)
      setSubject(replyTo.subject?.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject || ''}`)
      setBody(`<br/><br/><div style="border-left:2px solid #ccc;padding-left:12px;margin-top:12px;color:#666">On ${replyTo.date}, ${replyTo.from} wrote:<br/>${replyTo.bodyHtml || ''}</div>`)
    } else if (forwardMsg) {
      setTo('')
      setSubject(`Fwd: ${forwardMsg.subject || ''}`)
      setBody(`<br/><br/><div style="border-left:2px solid #ccc;padding-left:12px;margin-top:12px;color:#666">---------- Forwarded message ----------<br/>From: ${forwardMsg.from}<br/>Date: ${forwardMsg.date}<br/>Subject: ${forwardMsg.subject}<br/><br/>${forwardMsg.bodyHtml || ''}</div>`)
    } else {
      setTo('')
      setSubject('')
      setBody('')
    }
    setCc('')
    setBcc('')
    setAttachments([])
    setShowCcBcc(false)
  }, [open, replyTo, forwardMsg])

  const handleFileAdd = (e) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]
        setAttachments(prev => [...prev, {
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data: base64,
          size: file.size,
        }])
      }
      reader.readAsDataURL(file)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleSend = async () => {
    if (!to.trim()) return
    setSending(true)
    try {
      await sendEmail(userId, {
        to: to.trim(),
        subject,
        body: body || '<p></p>',
        cc: cc || undefined,
        bcc: bcc || undefined,
        attachments,
      })
      onSent?.()
      onOpenChange(false)
    } catch (err) {
      alert('Failed to send: ' + err.message)
    }
    setSending(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{replyTo ? 'Reply' : forwardMsg ? 'Forward' : 'New Email'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-8">To</span>
              <Input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@email.com" />
              {!showCcBcc && (
                <button onClick={() => setShowCcBcc(true)} className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap">
                  Cc/Bcc
                </button>
              )}
            </div>
            {showCcBcc && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-8">Cc</span>
                  <Input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@email.com" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-8">Bcc</span>
                  <Input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="bcc@email.com" />
                </div>
              </>
            )}
          </div>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" />
          <textarea
            value={body.replace(/<[^>]*>/g, '')}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your message..."
            rows={10}
            className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs">
                  <Paperclip className="size-3" />
                  <span className="max-w-[150px] truncate">{att.filename}</span>
                  <span className="text-muted-foreground">{fileSizeLabel(att.size)}</span>
                  <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="ml-1 hover:text-destructive">
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input type="file" ref={fileRef} onChange={handleFileAdd} multiple hidden />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Paperclip className="size-4" />
              Attach
            </Button>
          </div>
          <Button onClick={handleSend} disabled={sending || !to.trim()}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Log to Case Dialog ──────────────────────────────────

function LogToCaseDialog({ open, onOpenChange, email, userId, userName }) {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    setSaved(false)
    setSelectedCase('')
    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake()])
      .then(([gcs, ips]) => {
        const allCases = [
          ...(gcs || []).map(c => ({ id: c.id, name: c.applicant_name, type: 'gc', label: `GC: ${c.applicant_name}` })),
          ...(ips || []).map(c => ({ id: c.id, name: c.applicant_name, type: 'ip', label: `IP: ${c.applicant_name}` })),
        ].sort((a, b) => a.name.localeCompare(b.name))
        setCases(allCases)
      })
      .finally(() => setLoading(false))
  }, [open])

  const handleLog = async () => {
    if (!selectedCase || !email || !supabase) return
    const c = cases.find(c => String(c.id) === selectedCase)
    if (!c) return
    setSaving(true)
    try {
      await supabase.from('case_emails').insert({
        gmail_message_id: email.id,
        gmail_thread_id: email.threadId,
        case_id: c.id,
        case_type: c.type,
        subject: email.subject,
        from_address: email.from,
        to_address: email.to,
        date: email.date ? new Date(email.date).toISOString() : null,
        snippet: email.snippet,
        logged_by: userId,
        logged_by_name: userName,
      })
      setSaved(true)
      setTimeout(() => onOpenChange(false), 1200)
    } catch (err) {
      alert('Failed to log email: ' + err.message)
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Email to Case</DialogTitle>
        </DialogHeader>
        {saved ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="size-10 text-green-500 mb-2" />
            <p className="text-sm font-medium">Email logged successfully</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/50 px-3 py-2">
                <p className="text-sm font-medium truncate">{email?.subject || '(no subject)'}</p>
                <p className="text-xs text-muted-foreground truncate">From: {email?.from}</p>
              </div>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="size-4 animate-spin" /> Loading cases...
                </div>
              ) : (
                <Select value={selectedCase} onValueChange={setSelectedCase}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a case..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cases.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleLog} disabled={saving || !selectedCase}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <LinkIcon className="size-4" />}
                Log to Case
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Email Detail View ───────────────────────────────────

function EmailDetail({ email, userId, userName, onBack, onReply, onForward }) {
  const [logOpen, setLogOpen] = useState(false)
  const [downloading, setDownloading] = useState(null)

  const handleDownloadAttachment = async (att) => {
    setDownloading(att.attachmentId)
    try {
      const data = await getAttachment(userId, email.id, att.attachmentId)
      // data.data is base64url encoded
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
    } catch (err) {
      alert('Download failed: ' + err.message)
    }
    setDownloading(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onReply}>
            <Reply className="size-4" /> Reply
          </Button>
          <Button variant="outline" size="sm" onClick={onForward}>
            <Forward className="size-4" /> Forward
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}>
            <LinkIcon className="size-4" /> Log to Case
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{email.subject || '(no subject)'}</h2>
            <div className="flex items-start justify-between mt-2">
              <div>
                <p className="text-sm font-medium">{extractName(email.from)}</p>
                <p className="text-xs text-muted-foreground">{extractEmail(email.from)}</p>
                {email.cc && <p className="text-xs text-muted-foreground mt-1">Cc: {email.cc}</p>}
              </div>
              <p className="text-xs text-muted-foreground">{formatFullDate(email.date)}</p>
            </div>
          </div>

          {email.attachments?.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              {email.attachments.map((att, i) => (
                <button
                  key={i}
                  onClick={() => handleDownloadAttachment(att)}
                  disabled={downloading === att.attachmentId}
                  className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
                >
                  {downloading === att.attachmentId ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Download className="size-3" />
                  )}
                  <span className="max-w-[200px] truncate">{att.filename}</span>
                  <span className="text-muted-foreground">{fileSizeLabel(att.size)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t pt-4">
            <div
              className="prose prose-sm max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: email.bodyHtml || '<p>' + (email.snippet || '') + '</p>' }}
            />
          </div>
        </CardContent>
      </Card>

      <LogToCaseDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        email={email}
        userId={userId}
        userName={userName}
      />
    </div>
  )
}

// ── Main Email Page ─────────────────────────────────────

export default function EmailPage() {
  const { currentUser } = useRole()
  const userId = currentUser?.id

  const [connected, setConnected] = useState(null) // null = loading
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [nextPageToken, setNextPageToken] = useState(null)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [forwardMsg, setForwardMsg] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Check Google connection
  useEffect(() => {
    if (!userId) return
    getGoogleStatus(userId)
      .then(s => setConnected(s.connected))
      .catch(() => setConnected(false))
  }, [userId])

  // Fetch email list
  const fetchMessages = useCallback(async (query = '', pageToken = null) => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await listEmails(userId, { query: query || 'in:inbox', maxResults: 25, pageToken })
      const msgIds = data.messages || []
      // Fetch each message's metadata
      const fetched = await Promise.all(
        msgIds.map(m => getEmail(userId, m.id, 'metadata'))
      )
      const parsed = fetched.map(parseEmailHeaders)
      if (pageToken) {
        setMessages(prev => [...prev, ...parsed])
      } else {
        setMessages(parsed)
      }
      setNextPageToken(data.nextPageToken || null)
    } catch (err) {
      console.error('Failed to fetch emails:', err)
      if (err.message?.includes('401') || err.message?.includes('Token')) {
        setConnected(false)
      }
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (connected) fetchMessages(searchQuery)
  }, [connected, searchQuery, fetchMessages])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchMessages(searchQuery)
    setRefreshing(false)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setSearchQuery(searchInput)
  }

  const handleOpenEmail = async (msg) => {
    setLoadingEmail(true)
    try {
      const full = await getEmail(userId, msg.id, 'full')
      const headers = parseEmailHeaders(full)
      const bodyHtml = parseEmailBody(full)
      const attachments = parseEmailAttachments(full)
      // Mark as read
      if (msg.isUnread) {
        modifyEmail(userId, msg.id, { removeLabels: ['UNREAD'] }).catch(() => {})
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isUnread: false } : m))
      }
      setSelectedEmail({ ...headers, bodyHtml, attachments })
    } catch (err) {
      alert('Failed to load email: ' + err.message)
    }
    setLoadingEmail(false)
  }

  const handleReply = () => {
    setReplyTo(selectedEmail)
    setForwardMsg(null)
    setComposeOpen(true)
  }

  const handleForward = () => {
    setForwardMsg(selectedEmail)
    setReplyTo(null)
    setComposeOpen(true)
  }

  const handleCompose = () => {
    setReplyTo(null)
    setForwardMsg(null)
    setComposeOpen(true)
  }

  // Loading connection status
  if (connected === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Email" subtitle="Gmail integration" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="space-y-6">
        <PageHeader title="Email" subtitle="Gmail integration" />
        <NotConnectedState userId={userId} />
      </div>
    )
  }

  // Email detail view
  if (selectedEmail) {
    return (
      <div className="space-y-6">
        <PageHeader title="Email" subtitle="Gmail integration" />
        <EmailDetail
          email={selectedEmail}
          userId={userId}
          userName={currentUser?.name}
          onBack={() => setSelectedEmail(null)}
          onReply={handleReply}
          onForward={handleForward}
        />
        <ComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          userId={userId}
          replyTo={replyTo}
          forwardMsg={forwardMsg}
          onSent={handleRefresh}
        />
      </div>
    )
  }

  // Inbox list view
  return (
    <div className="space-y-6">
      <PageHeader
        title="Email"
        subtitle="Gmail integration"
        actions={
          <Button onClick={handleCompose}>
            <Plus className="size-4" />
            Compose
          </Button>
        }
      />

      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search emails..."
            className="pl-9"
          />
        </form>
        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading && messages.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Inbox className="size-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No emails found</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {messages.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => handleOpenEmail(msg)}
                  disabled={loadingEmail}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors ${
                    msg.isUnread ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="mt-1">
                    {msg.isUnread ? (
                      <Mail className="size-4 text-blue-500" />
                    ) : (
                      <MailOpen className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${msg.isUnread ? 'font-semibold' : ''}`}>
                        {extractName(msg.from)}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDate(msg.date)}
                      </span>
                    </div>
                    <p className={`text-sm truncate ${msg.isUnread ? 'font-medium' : 'text-muted-foreground'}`}>
                      {msg.subject || '(no subject)'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {msg.snippet}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {nextPageToken && (
              <div className="p-3 border-t text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchMessages(searchQuery, nextPageToken)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : 'Load more'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        userId={userId}
        replyTo={replyTo}
        forwardMsg={forwardMsg}
        onSent={handleRefresh}
      />
    </div>
  )
}

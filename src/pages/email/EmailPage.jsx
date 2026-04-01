import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRole } from '@/context/RoleContext'
import {
  listEmails, getEmail, sendEmail, modifyEmail, getAttachment, listLabels,
  getGoogleStatus, parseEmailHeaders, parseEmailBody, parseEmailAttachments,
  connectGoogle,
} from '@/lib/google'
import { supabase } from '@/lib/supabase'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search, RefreshCw, Mail, MailOpen, Send, Paperclip, ArrowLeft,
  Star, Archive, Trash2, Reply, Forward, X, Loader2, Plus, LinkIcon,
  Inbox, AlertCircle, CheckCircle2, Download, Tag, ChevronDown,
  FileText, SendHorizonal, FileWarning, AlertTriangle, Clock,
  MailPlus, Pencil,
} from 'lucide-react'

// ── System folder config ────────────────────────────────

const SYSTEM_FOLDERS = [
  { id: 'INBOX', label: 'Inbox', icon: Inbox },
  { id: 'STARRED', label: 'Starred', icon: Star },
  { id: 'SENT', label: 'Sent', icon: SendHorizonal },
  { id: 'DRAFT', label: 'Drafts', icon: FileText },
  { id: 'SPAM', label: 'Spam', icon: AlertTriangle },
  { id: 'TRASH', label: 'Trash', icon: Trash2 },
]

const FOLDER_COLORS = {
  INBOX: 'text-blue-600',
  STARRED: 'text-amber-500',
  SENT: 'text-emerald-600',
  DRAFT: 'text-orange-500',
  SPAM: 'text-red-500',
  TRASH: 'text-gray-500',
}

// ── Helpers ──────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const isThisYear = d.getFullYear() === now.getFullYear()
  if (isThisYear) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-pink-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-rose-500',
  'bg-teal-500', 'bg-orange-500',
]

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
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
      setBody(`\n\n> On ${replyTo.date}, ${replyTo.from} wrote:\n> ${(replyTo.bodyHtml || '').replace(/<[^>]*>/g, '').slice(0, 500)}`)
    } else if (forwardMsg) {
      setTo('')
      setSubject(`Fwd: ${forwardMsg.subject || ''}`)
      setBody(`\n\n---------- Forwarded message ----------\nFrom: ${forwardMsg.from}\nDate: ${forwardMsg.date}\nSubject: ${forwardMsg.subject}\n\n${(forwardMsg.bodyHtml || '').replace(/<[^>]*>/g, '').slice(0, 1000)}`)
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
      const htmlBody = body.replace(/\n/g, '<br/>')
      await sendEmail(userId, {
        to: to.trim(),
        subject,
        body: htmlBody || '<p></p>',
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
          <DialogTitle className="flex items-center gap-2">
            {replyTo ? <Reply className="size-4" /> : forwardMsg ? <Forward className="size-4" /> : <Pencil className="size-4" />}
            {replyTo ? 'Reply' : forwardMsg ? 'Forward' : 'New Message'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-8">To</span>
              <Input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@email.com" className="h-9" />
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
                  <Input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@email.com" className="h-9" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-8">Bcc</span>
                  <Input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="bcc@email.com" className="h-9" />
                </div>
              </>
            )}
          </div>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className="h-9" />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your message..."
            rows={12}
            className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 resize-none font-sans"
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
        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            <input type="file" ref={fileRef} onChange={handleFileAdd} multiple hidden />
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <Paperclip className="size-4" />
            </Button>
          </div>
          <Button onClick={handleSend} disabled={sending || !to.trim()} className="gap-2">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send
          </Button>
        </div>
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

function EmailDetail({ email, userId, userName, onBack, onReply, onForward, onArchive, onTrash }) {
  const [logOpen, setLogOpen] = useState(false)
  const [downloading, setDownloading] = useState(null)

  const handleDownloadAttachment = async (att) => {
    setDownloading(att.attachmentId)
    try {
      const data = await getAttachment(userId, email.id, att.attachmentId)
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

  const senderName = extractName(email.from)
  const senderEmail = extractEmail(email.from)

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-card shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="ghost" size="icon-sm" onClick={onArchive} title="Archive" className="size-8">
          <Archive className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onTrash} title="Delete" className="size-8">
          <Trash2 className="size-4" />
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onReply} className="gap-1.5">
            <Reply className="size-4" /> Reply
          </Button>
          <Button variant="ghost" size="sm" onClick={onForward} className="gap-1.5">
            <Forward className="size-4" /> Forward
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLogOpen(true)} className="gap-1.5 ml-1">
            <LinkIcon className="size-4" /> Log to Case
          </Button>
        </div>
      </div>

      {/* Email content */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-5 max-w-4xl">
          {/* Subject */}
          <h2 className="text-xl font-semibold mb-4">{email.subject || '(no subject)'}</h2>

          {/* Sender row */}
          <div className="flex items-start gap-3 mb-5">
            <div className={`size-10 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 ${getAvatarColor(senderName)}`}>
              {getInitials(senderName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{senderName}</span>
                <span className="text-xs text-muted-foreground">&lt;{senderEmail}&gt;</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                to {email.to?.split(',').map(e => extractName(e.trim()) || e.trim()).join(', ')}
                {email.cc && <span> · cc: {email.cc}</span>}
              </div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{formatFullDate(email.date)}</span>
          </div>

          {/* Labels */}
          {email.labelIds?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {email.labelIds
                .filter(l => !['UNREAD', 'IMPORTANT', 'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_UPDATES', 'CATEGORY_PROMOTIONS', 'CATEGORY_FORUMS'].includes(l))
                .map(label => (
                  <span key={label} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {label.replace('CATEGORY_', '').replace(/_/g, ' ')}
                  </span>
                ))
              }
            </div>
          )}

          {/* Attachments */}
          {email.attachments?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5 pb-4 border-b">
              {email.attachments.map((att, i) => (
                <button
                  key={i}
                  onClick={() => handleDownloadAttachment(att)}
                  disabled={downloading === att.attachmentId}
                  className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  {downloading === att.attachmentId ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4 text-muted-foreground" />
                  )}
                  <span className="max-w-[200px] truncate">{att.filename}</span>
                  <span className="text-xs text-muted-foreground">{fileSizeLabel(att.size)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Body */}
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: email.bodyHtml || '<p>' + (email.snippet || '') + '</p>' }}
          />
        </div>
      </ScrollArea>

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

// ── Folder Sidebar ──────────────────────────────────────

function FolderSidebar({ activeFolder, onFolderChange, userLabels, labelCounts, onCompose }) {
  return (
    <div className="w-56 shrink-0 flex flex-col border-r bg-card">
      <div className="p-3">
        <Button onClick={onCompose} className="w-full gap-2 rounded-2xl shadow-sm" size="lg">
          <MailPlus className="size-5" />
          Compose
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <nav className="px-2 pb-4">
          {/* System folders */}
          {SYSTEM_FOLDERS.map(folder => {
            const isActive = activeFolder === folder.id
            const Icon = folder.icon
            const count = labelCounts[folder.id] || 0
            return (
              <button
                key={folder.id}
                onClick={() => onFolderChange(folder.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-foreground/70 hover:bg-muted'
                }`}
              >
                <Icon className={`size-4 shrink-0 ${isActive ? 'text-blue-600' : FOLDER_COLORS[folder.id] || 'text-muted-foreground'}`} />
                <span className="flex-1 text-left">{folder.label}</span>
                {count > 0 && folder.id === 'INBOX' && (
                  <span className="text-xs font-semibold text-blue-600">{count}</span>
                )}
              </button>
            )
          })}

          {/* User labels */}
          {userLabels.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-3 mt-4 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Labels</span>
              </div>
              {userLabels.map(label => {
                const isActive = activeFolder === label.id
                return (
                  <button
                    key={label.id}
                    onClick={() => onFolderChange(label.id)}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-foreground/70 hover:bg-muted'
                    }`}
                  >
                    <Tag className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-left truncate">{label.name}</span>
                  </button>
                )
              })}
            </>
          )}
        </nav>
      </ScrollArea>
    </div>
  )
}

// ── Email List ──────────────────────────────────────────

function EmailList({ messages, loading, onOpenEmail, loadingEmail, onLoadMore, hasMore, activeFolder, onRefresh, refreshing, searchInput, onSearchInput, onSearch, selectedIds, onToggleSelect, onSelectAll, allSelected }) {
  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0">
        <Checkbox
          checked={allSelected && messages.length > 0}
          onCheckedChange={onSelectAll}
          className="mr-1"
        />
        <Button variant="ghost" size="icon-sm" onClick={onRefresh} disabled={refreshing} className="size-8">
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
        <div className="w-px h-5 bg-border" />
        <form onSubmit={onSearch} className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => onSearchInput(e.target.value)}
            placeholder="Search mail"
            className="pl-9 h-8 bg-muted/50 border-none"
          />
        </form>
      </div>

      {/* Message list */}
      <ScrollArea className="flex-1">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center px-4">
            <Inbox className="size-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {activeFolder === 'INBOX' ? 'Your inbox is empty' : 'No messages'}
            </p>
          </div>
        ) : (
          <div>
            {messages.map(msg => {
              const senderName = extractName(msg.from)
              const isSelected = selectedIds.has(msg.id)
              const hasAttachment = msg.labelIds?.includes('ATTACHMENT') || msg.snippet?.includes('attachment')

              return (
                <div
                  key={msg.id}
                  className={`flex items-center gap-2 px-3 py-2 border-b cursor-pointer transition-colors group ${
                    msg.isUnread ? 'bg-white font-medium' : 'bg-card/50'
                  } ${isSelected ? 'bg-blue-50' : 'hover:bg-muted/50'}`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(msg.id)}
                    onClick={e => e.stopPropagation()}
                    className="shrink-0"
                  />
                  <button
                    onClick={() => onOpenEmail(msg)}
                    disabled={loadingEmail}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    {/* Avatar */}
                    <div className={`size-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 ${getAvatarColor(senderName)}`}>
                      {getInitials(senderName)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-sm truncate max-w-[180px] ${msg.isUnread ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                          {senderName || extractEmail(msg.from)}
                        </span>
                        {msg.isUnread && (
                          <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm truncate ${msg.isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {msg.subject || '(no subject)'}
                        </span>
                        <span className="text-sm text-muted-foreground truncate flex-1">
                          — {msg.snippet}
                        </span>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-2 shrink-0">
                      {hasAttachment && <Paperclip className="size-3.5 text-muted-foreground" />}
                      <span className={`text-xs whitespace-nowrap ${msg.isUnread ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                        {formatDate(msg.date)}
                      </span>
                    </div>
                  </button>
                </div>
              )
            })}

            {hasMore && (
              <div className="p-3 text-center">
                <Button variant="ghost" size="sm" onClick={onLoadMore} disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// ── Main Email Page ─────────────────────────────────────

export default function EmailPage() {
  const { currentUser } = useRole()
  const userId = currentUser?.id

  const [connected, setConnected] = useState(null)
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
  const [activeFolder, setActiveFolder] = useState('INBOX')
  const [userLabels, setUserLabels] = useState([])
  const [labelCounts, setLabelCounts] = useState({})
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Check Google connection
  useEffect(() => {
    if (!userId) return
    getGoogleStatus(userId)
      .then(s => setConnected(s.connected))
      .catch(() => setConnected(false))
  }, [userId])

  // Fetch labels on connect
  useEffect(() => {
    if (!connected || !userId) return
    listLabels(userId).then(labels => {
      const user = labels
        .filter(l => l.type === 'user')
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setUserLabels(user)

      // Build counts from label data
      const counts = {}
      labels.forEach(l => {
        if (l.messagesUnread) counts[l.id] = l.messagesUnread
      })
      setLabelCounts(counts)
    }).catch(() => {})
  }, [connected, userId])

  // Fetch email list
  const fetchMessages = useCallback(async (query = '', pageToken = null, folder = activeFolder) => {
    if (!userId) return
    setLoading(true)
    try {
      const opts = { maxResults: 30, pageToken }

      // If searching, use query directly; otherwise use labelIds filter
      if (query) {
        opts.query = query
      } else {
        opts.labelIds = [folder]
      }

      const data = await listEmails(userId, opts)
      const msgIds = data.messages || []

      if (msgIds.length === 0) {
        if (!pageToken) setMessages([])
        setNextPageToken(null)
        setLoading(false)
        return
      }

      // Fetch metadata for each message
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
  }, [userId, activeFolder])

  useEffect(() => {
    if (connected) {
      setSelectedEmail(null)
      setSelectedIds(new Set())
      fetchMessages(searchQuery, null, activeFolder)
    }
  }, [connected, activeFolder])

  // Re-fetch when search query changes
  useEffect(() => {
    if (connected && searchQuery) {
      fetchMessages(searchQuery, null, activeFolder)
    }
  }, [searchQuery])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchMessages(searchQuery, null, activeFolder)
    setRefreshing(false)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setSearchQuery(searchInput)
    if (!searchInput) fetchMessages('', null, activeFolder)
  }

  const handleFolderChange = (folderId) => {
    setActiveFolder(folderId)
    setSearchInput('')
    setSearchQuery('')
    setSelectedEmail(null)
    setSelectedIds(new Set())
  }

  const handleOpenEmail = async (msg) => {
    setLoadingEmail(true)
    try {
      const full = await getEmail(userId, msg.id, 'full')
      const headers = parseEmailHeaders(full)
      const bodyHtml = parseEmailBody(full)
      const attachments = parseEmailAttachments(full)
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

  const handleArchive = async () => {
    if (!selectedEmail || !userId) return
    await modifyEmail(userId, selectedEmail.id, { removeLabels: ['INBOX'] }).catch(() => {})
    setSelectedEmail(null)
    fetchMessages(searchQuery, null, activeFolder)
  }

  const handleTrash = async () => {
    if (!selectedEmail || !userId) return
    await modifyEmail(userId, selectedEmail.id, { addLabels: ['TRASH'], removeLabels: ['INBOX'] }).catch(() => {})
    setSelectedEmail(null)
    fetchMessages(searchQuery, null, activeFolder)
  }

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(messages.map(m => m.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  // Loading / not connected
  if (connected === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!connected) {
    return <NotConnectedState userId={userId} />
  }

  return (
    <div className="flex h-[calc(100vh-120px)] rounded-xl border bg-card overflow-hidden shadow-sm">
      {/* Folder Sidebar */}
      <FolderSidebar
        activeFolder={activeFolder}
        onFolderChange={handleFolderChange}
        userLabels={userLabels}
        labelCounts={labelCounts}
        onCompose={handleCompose}
      />

      {/* Email list or detail view */}
      {selectedEmail ? (
        <div className="flex-1 flex flex-col min-w-0">
          <EmailDetail
            email={selectedEmail}
            userId={userId}
            userName={currentUser?.name}
            onBack={() => setSelectedEmail(null)}
            onReply={handleReply}
            onForward={handleForward}
            onArchive={handleArchive}
            onTrash={handleTrash}
          />
        </div>
      ) : (
        <EmailList
          messages={messages}
          loading={loading}
          onOpenEmail={handleOpenEmail}
          loadingEmail={loadingEmail}
          onLoadMore={() => fetchMessages(searchQuery, nextPageToken, activeFolder)}
          hasMore={!!nextPageToken}
          activeFolder={activeFolder}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          searchInput={searchInput}
          onSearchInput={setSearchInput}
          onSearch={handleSearch}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          allSelected={selectedIds.size === messages.length}
        />
      )}

      {/* Compose Dialog */}
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

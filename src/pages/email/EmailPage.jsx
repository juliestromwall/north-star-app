import { useState, useEffect, useCallback, useRef } from 'react'
import { useRole } from '@/context/RoleContext'
import { useDrafts } from '@/context/DraftContext'
import {
  listEmails, getEmail, modifyEmail, getAttachment, listLabels,
  getGoogleStatus, parseEmailHeaders, parseEmailBody, parseEmailAttachments,
  connectGoogle,
} from '@/lib/google'
import { supabase } from '@/lib/supabase'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Star, Archive, Trash2, Reply, Forward, X, Loader2, LinkIcon,
  Inbox, CheckCircle2, Download, Tag,
  SendHorizonal, FileText, AlertTriangle,
  MailPlus, Clock, ChevronRight, Users, Info, MessageSquare, ShoppingBag, Megaphone, ChevronDown,
} from 'lucide-react'

// ── System folder config ────────────────────────────────

const SYSTEM_FOLDERS = [
  { id: 'INBOX', label: 'Inbox', icon: Inbox },
  { id: 'STARRED', label: 'Starred', icon: Star },
  { id: 'SNOOZED', label: 'Snoozed', icon: Clock },
  { id: 'IMPORTANT', label: 'Important', icon: ChevronRight },
  { id: 'SENT', label: 'Sent', icon: SendHorizonal },
  { id: 'DRAFT', label: 'Drafts', icon: FileText },
  { id: 'SPAM', label: 'Spam', icon: AlertTriangle },
  { id: 'TRASH', label: 'Trash', icon: Trash2 },
]

const CATEGORY_FOLDERS = [
  { id: 'CATEGORY_SOCIAL', label: 'Social', icon: Users },
  { id: 'CATEGORY_UPDATES', label: 'Updates', icon: Info },
  { id: 'CATEGORY_FORUMS', label: 'Forums', icon: MessageSquare },
  { id: 'CATEGORY_PROMOTIONS', label: 'Promotions', icon: Megaphone },
  { id: 'CATEGORY_PURCHASES', label: 'Purchases', icon: ShoppingBag },
]

const FOLDER_COLORS = {
  INBOX: 'text-blue-600',
  STARRED: 'text-amber-500',
  SNOOZED: 'text-stone-500',
  IMPORTANT: 'text-amber-600',
  SENT: 'text-emerald-600',
  DRAFT: 'text-orange-500',
  SPAM: 'text-red-500',
  TRASH: 'text-gray-500',
  CATEGORY_SOCIAL: 'text-blue-500',
  CATEGORY_UPDATES: 'text-stone-500',
  CATEGORY_FORUMS: 'text-cyan-600',
  CATEGORY_PROMOTIONS: 'text-green-600',
  CATEGORY_PURCHASES: 'text-purple-500',
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
      </p>
      <Button onClick={() => connectGoogle(userId)}>
        Connect Google Account
      </Button>
    </div>
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
          <ArrowLeft className="size-4" /> Back
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
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 max-w-4xl">
          <h2 className="text-xl font-semibold mb-4">{email.subject || '(no subject)'}</h2>

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

          {email.attachments?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5 pb-4 border-b">
              {email.attachments.map((att, i) => (
                <button
                  key={i}
                  onClick={() => handleDownloadAttachment(att)}
                  disabled={downloading === att.attachmentId}
                  className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  {downloading === att.attachmentId ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4 text-muted-foreground" />}
                  <span className="max-w-[200px] truncate">{att.filename}</span>
                  <span className="text-xs text-muted-foreground">{fileSizeLabel(att.size)}</span>
                </button>
              ))}
            </div>
          )}

          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: email.bodyHtml || '<p>' + (email.snippet || '') + '</p>' }}
          />
        </div>
      </div>

      <LogToCaseDialog open={logOpen} onOpenChange={setLogOpen} email={email} userId={userId} userName={userName} />
    </div>
  )
}

// ── Folder Sidebar ──────────────────────────────────────

function FolderSidebar({ activeFolder, onFolderChange, userLabels, labelCounts, onCompose }) {
  const [showMore, setShowMore] = useState(false)

  function renderFolder(folder) {
    const isActive = activeFolder === folder.id
    const Icon = folder.icon
    const count = labelCounts[folder.id] || 0
    return (
      <button
        key={folder.id}
        onClick={() => onFolderChange(folder.id)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-foreground/70 hover:bg-muted'
        }`}
      >
        <Icon className={`size-4 shrink-0 ${isActive ? 'text-blue-600' : FOLDER_COLORS[folder.id] || 'text-muted-foreground'}`} />
        <span className="flex-1 text-left">{folder.label}</span>
        {count > 0 && (
          <span className={`text-xs font-semibold ${isActive ? 'text-blue-600' : 'text-muted-foreground'}`}>{count.toLocaleString()}</span>
        )}
      </button>
    )
  }

  return (
    <div className="w-56 shrink-0 flex flex-col border-r bg-card">
      <div className="p-3">
        <Button onClick={onCompose} className="w-full gap-2 rounded-2xl shadow-sm" size="lg">
          <MailPlus className="size-5" />
          Compose
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <nav className="px-2 pb-4">
          {SYSTEM_FOLDERS.map(renderFolder)}

          {/* Categories (collapsible) */}
          <button
            onClick={() => setShowMore(!showMore)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground/70 hover:bg-muted transition-colors"
          >
            <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${showMore ? 'rotate-180' : ''}`} />
            <span className="flex-1 text-left">{showMore ? 'Less' : 'More'}</span>
          </button>

          {showMore && CATEGORY_FOLDERS.map(renderFolder)}

          {/* User Labels */}
          {userLabels.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-3 mt-4 mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Labels</span>
              </div>
              {userLabels.map(label => {
                const isActive = activeFolder === label.id
                const count = labelCounts[label.id] || 0
                return (
                  <button
                    key={label.id}
                    onClick={() => onFolderChange(label.id)}
                    className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-foreground/70 hover:bg-muted'
                    }`}
                  >
                    <Tag className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-left truncate">{label.name}</span>
                    {count > 0 && (
                      <span className={`text-xs font-semibold ${isActive ? 'text-blue-600' : 'text-muted-foreground'}`}>{count.toLocaleString()}</span>
                    )}
                  </button>
                )
              })}
            </>
          )}
        </nav>
      </div>
    </div>
  )
}

// ── Email List ──────────────────────────────────────────

function EmailList({ messages, loading, onOpenEmail, loadingEmail, onLoadMore, hasMore, activeFolder, onRefresh, refreshing, searchInput, onSearchInput, onSearch, selectedIds, onToggleSelect, onSelectAll, allSelected, onBulkTrash, onBulkArchive, onBulkLabel, userLabels }) {
  const [labelMenuOpen, setLabelMenuOpen] = useState(false)
  const hasSelection = selectedIds.size > 0

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0">
        <Checkbox
          checked={allSelected && messages.length > 0}
          onCheckedChange={onSelectAll}
          className="mr-1"
        />

        {hasSelection ? (
          <>
            <span className="text-xs text-muted-foreground font-medium">{selectedIds.size} selected</span>
            <div className="w-px h-5 bg-border" />
            <Button variant="ghost" size="icon-sm" className="size-8" title="Archive" onClick={onBulkArchive}>
              <Archive className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" className="size-8 text-red-500 hover:text-red-700" title="Delete" onClick={onBulkTrash}>
              <Trash2 className="size-4" />
            </Button>
            <div className="relative">
              <Button variant="ghost" size="icon-sm" className="size-8" title="Apply label" onClick={() => setLabelMenuOpen(!labelMenuOpen)}>
                <Tag className="size-4" />
              </Button>
              {labelMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setLabelMenuOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-xl border shadow-xl py-2 w-56 max-h-64 overflow-y-auto">
                    <p className="px-3 py-1 text-[10px] font-semibold text-stone-400 uppercase">Apply label</p>
                    {userLabels.map(label => (
                      <button
                        key={label.id}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-stone-50 flex items-center gap-2"
                        onClick={() => { onBulkLabel(label.id); setLabelMenuOpen(false) }}
                      >
                        <span className="size-2 rounded-full bg-stone-400 shrink-0" />
                        {label.name}
                      </button>
                    ))}
                    {userLabels.length === 0 && <p className="px-3 py-2 text-xs text-stone-400">No labels</p>}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Message list — native scroll */}
      <div className="flex-1 overflow-y-auto">
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
                    <div className={`size-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 ${getAvatarColor(senderName)}`}>
                      {getInitials(senderName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-sm truncate max-w-[180px] ${msg.isUnread ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                          {senderName || extractEmail(msg.from)}
                        </span>
                        {msg.isUnread && <span className="size-2 rounded-full bg-blue-500 shrink-0" />}
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
                    <div className="flex items-center gap-2 shrink-0">
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
      </div>
    </div>
  )
}

// ── Main Email Page ─────────────────────────────────────

export default function EmailPage() {
  const { currentUser } = useRole()
  const { openDraft } = useDrafts()
  const userId = currentUser?.id

  const [connected, setConnected] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [nextPageToken, setNextPageToken] = useState(null)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [loadingEmail, setLoadingEmail] = useState(false)
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
      const counts = {}
      labels.forEach(l => {
        // Inbox shows unread count; others show total
        if (l.id === 'INBOX') {
          if (l.messagesUnread) counts[l.id] = l.messagesUnread
        } else {
          if (l.messagesTotal) counts[l.id] = l.messagesTotal
        }
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

  // Compose actions — all use DraftContext now
  const handleCompose = () => openDraft({ userId })
  const handleReply = () => openDraft({ replyTo: selectedEmail, userId })
  const handleForward = () => openDraft({ forwardMsg: selectedEmail, userId })

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
    setSelectedIds(checked ? new Set(messages.map(m => m.id)) : new Set())
  }

  const handleBulkTrash = async () => {
    if (selectedIds.size === 0 || !userId) return
    const ids = [...selectedIds]
    await Promise.all(ids.map(id =>
      modifyEmail(userId, id, { addLabels: ['TRASH'], removeLabels: ['INBOX'] }).catch(() => {})
    ))
    setSelectedIds(new Set())
    fetchMessages(searchQuery, null, activeFolder)
  }

  const handleBulkArchive = async () => {
    if (selectedIds.size === 0 || !userId) return
    const ids = [...selectedIds]
    await Promise.all(ids.map(id =>
      modifyEmail(userId, id, { removeLabels: ['INBOX'] }).catch(() => {})
    ))
    setSelectedIds(new Set())
    fetchMessages(searchQuery, null, activeFolder)
  }

  const handleBulkLabel = async (labelId) => {
    if (selectedIds.size === 0 || !userId) return
    const ids = [...selectedIds]
    await Promise.all(ids.map(id =>
      modifyEmail(userId, id, { addLabels: [labelId] }).catch(() => {})
    ))
    setSelectedIds(new Set())
    fetchMessages(searchQuery, null, activeFolder)
  }

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
      <FolderSidebar
        activeFolder={activeFolder}
        onFolderChange={handleFolderChange}
        userLabels={userLabels}
        labelCounts={labelCounts}
        onCompose={handleCompose}
      />

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
          onBulkTrash={handleBulkTrash}
          onBulkArchive={handleBulkArchive}
          onBulkLabel={handleBulkLabel}
          userLabels={userLabels}
        />
      )}
    </div>
  )
}

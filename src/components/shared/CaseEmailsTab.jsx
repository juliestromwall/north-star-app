import { useState, useEffect } from 'react'
import { useRole } from '@/context/RoleContext'
import { fetchCaseEmails, deleteCaseEmail } from '@/lib/db'
import { getGoogleStatus, getEmail, parseEmailHeaders, parseEmailBody, parseEmailAttachments, getAttachment } from '@/lib/google'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Mail, MailOpen, Trash2, ExternalLink, Loader2, Download, ArrowLeft, Paperclip } from 'lucide-react'

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

export default function CaseEmailsTab({ caseId }) {
  const { currentUser } = useRole()
  const userId = currentUser?.id
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState(null)
  const [loadingFull, setLoadingFull] = useState(false)
  const [fullEmail, setFullEmail] = useState(null)
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    if (!caseId) return
    setLoading(true)
    Promise.all([
      fetchCaseEmails(caseId),
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

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{emails.length} email{emails.length !== 1 ? 's' : ''} logged</p>
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          <div className="divide-y">
            {emails.map(email => (
              <div key={email.id} className="px-4 py-3 flex items-start gap-3 group">
                <Mail className="size-4 text-muted-foreground mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{email.subject || '(no subject)'}</span>
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
                  {connected && (
                    <button
                      onClick={() => handleViewFull(email)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="View full email"
                    >
                      <ExternalLink className="size-3.5" />
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
            ))}
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

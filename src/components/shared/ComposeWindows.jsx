import { useState, useRef, useEffect } from 'react'
import { useDrafts } from '@/context/DraftContext'
import { useRole } from '@/context/RoleContext'
import { sendEmail } from '@/lib/google'
import { supabase } from '@/lib/supabase'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Send, Paperclip, X, Loader2, Minus, Maximize2, Minimize2, Trash2, ChevronDown,
} from 'lucide-react'

function fileSizeLabel(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function ComposeWindow({ draft, index, totalExpanded }) {
  const { updateDraft, closeDraft, minimizeDraft, expandDraft } = useDrafts()
  const { currentUser } = useRole()
  const userId = currentUser?.id
  const [sending, setSending] = useState(false)
  const [cases, setCases] = useState(null)
  const [expanded, setExpanded] = useState(false) // full-size mode
  const fileRef = useRef(null)

  // Load cases lazily when dropdown is first opened
  const loadCases = () => {
    if (cases) return
    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake()])
      .then(([gcs, ips]) => {
        const allCases = [
          { id: '', name: '', label: 'None' },
          ...(gcs || []).map(c => ({ id: c.id, name: c.applicant_name, type: 'gc', label: `GC: ${c.applicant_name}` })),
          ...(ips || []).map(c => ({ id: c.id, name: c.applicant_name, type: 'ip', label: `IP: ${c.applicant_name}` })),
        ].sort((a, b) => {
          if (!a.id) return -1
          if (!b.id) return 1
          return a.name.localeCompare(b.name)
        })
        setCases(allCases)
      })
      .catch(() => setCases([]))
  }

  const handleFileAdd = (e) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]
        updateDraft(draft.id, {
          attachments: [...draft.attachments, {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64Data: base64,
            size: file.size,
          }],
        })
      }
      reader.readAsDataURL(file)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeAttachment = (idx) => {
    updateDraft(draft.id, {
      attachments: draft.attachments.filter((_, i) => i !== idx),
    })
  }

  const handleSend = async () => {
    if (!draft.to.trim() || !userId) return
    setSending(true)
    try {
      const htmlBody = draft.body.replace(/\n/g, '<br/>')
      const result = await sendEmail(userId, {
        to: draft.to.trim(),
        subject: draft.subject,
        body: htmlBody || '<p></p>',
        cc: draft.cc || undefined,
        bcc: draft.bcc || undefined,
        attachments: draft.attachments,
      })

      // Log to case if one was selected
      if (draft.caseId && supabase) {
        const c = cases?.find(c => String(c.id) === draft.caseId)
        if (c) {
          await supabase.from('case_emails').insert({
            gmail_message_id: result.id || 'sent-' + Date.now(),
            case_id: c.id,
            case_type: c.type,
            subject: draft.subject,
            from_address: currentUser?.email || '',
            to_address: draft.to,
            date: new Date().toISOString(),
            snippet: draft.body.replace(/<[^>]*>/g, '').slice(0, 200),
            logged_by: userId,
            logged_by_name: currentUser?.name || '',
          }).catch(() => {})
        }
      }

      closeDraft(draft.id)
    } catch (err) {
      alert('Failed to send: ' + err.message)
    }
    setSending(false)
  }

  const handleDiscard = () => {
    if (draft.to || draft.subject || draft.body) {
      if (!confirm('Discard this draft?')) return
    }
    closeDraft(draft.id)
  }

  // Calculate position — stack from right, each 24rem wide + 8px gap
  const rightOffset = index * (384 + 8) + 16

  if (draft.minimized) {
    return (
      <div
        className="fixed bottom-0 z-50 shadow-lg rounded-t-lg overflow-hidden cursor-pointer"
        style={{ right: rightOffset, width: 280 }}
        onClick={() => expandDraft(draft.id)}
      >
        <div className="flex items-center justify-between px-3 py-2 bg-[#283693] text-white">
          <span className="text-sm font-medium truncate flex-1">
            {draft.subject || 'New Message'}
          </span>
          <div className="flex items-center gap-0.5 ml-2 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); expandDraft(draft.id) }}
              className="p-1 hover:bg-white/20 rounded"
            >
              <Maximize2 className="size-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDiscard() }}
              className="p-1 hover:bg-white/20 rounded"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const windowWidth = expanded ? 600 : 384
  const windowHeight = expanded ? 520 : 440

  return (
    <div
      className="fixed bottom-0 z-50 flex flex-col shadow-2xl rounded-t-xl overflow-hidden border border-border bg-card"
      style={{ right: rightOffset, width: windowWidth, height: windowHeight }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#283693] text-white shrink-0">
        <span className="text-sm font-medium truncate flex-1">
          {draft.subject || 'New Message'}
        </span>
        <div className="flex items-center gap-0.5 ml-2 shrink-0">
          <button onClick={() => minimizeDraft(draft.id)} className="p-1 hover:bg-white/20 rounded" title="Minimize">
            <Minus className="size-3.5" />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-white/20 rounded" title={expanded ? 'Shrink' : 'Expand'}>
            {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
          <button onClick={handleDiscard} className="p-1 hover:bg-white/20 rounded" title="Close">
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Form fields */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-3 pt-2 space-y-1.5 shrink-0">
          <div className="flex items-center gap-2 border-b pb-1.5">
            <span className="text-xs text-muted-foreground w-6">To</span>
            <input
              value={draft.to}
              onChange={e => updateDraft(draft.id, { to: e.target.value })}
              placeholder="recipient@email.com"
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {!draft.showCcBcc && (
              <button
                onClick={() => updateDraft(draft.id, { showCcBcc: true })}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cc/Bcc
              </button>
            )}
          </div>
          {draft.showCcBcc && (
            <>
              <div className="flex items-center gap-2 border-b pb-1.5">
                <span className="text-xs text-muted-foreground w-6">Cc</span>
                <input
                  value={draft.cc}
                  onChange={e => updateDraft(draft.id, { cc: e.target.value })}
                  className="flex-1 text-sm outline-none bg-transparent"
                />
              </div>
              <div className="flex items-center gap-2 border-b pb-1.5">
                <span className="text-xs text-muted-foreground w-6">Bcc</span>
                <input
                  value={draft.bcc}
                  onChange={e => updateDraft(draft.id, { bcc: e.target.value })}
                  className="flex-1 text-sm outline-none bg-transparent"
                />
              </div>
            </>
          )}
          <div className="flex items-center gap-2 border-b pb-1.5">
            <input
              value={draft.subject}
              onChange={e => updateDraft(draft.id, { subject: e.target.value })}
              placeholder="Subject"
              className="flex-1 text-sm outline-none bg-transparent"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-3 py-2 overflow-hidden">
          <textarea
            value={draft.body}
            onChange={e => updateDraft(draft.id, { body: e.target.value })}
            placeholder="Write your message..."
            className="w-full h-full text-sm outline-none bg-transparent resize-none"
          />
        </div>

        {/* Attachments */}
        {draft.attachments.length > 0 && (
          <div className="px-3 pb-1.5 flex flex-wrap gap-1.5 shrink-0">
            {draft.attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-1 rounded border bg-muted/50 px-2 py-1 text-[11px]">
                <Paperclip className="size-3 shrink-0" />
                <span className="max-w-[100px] truncate">{att.filename}</span>
                <span className="text-muted-foreground">{fileSizeLabel(att.size)}</span>
                <button onClick={() => removeAttachment(i)} className="hover:text-destructive ml-0.5">
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bottom toolbar */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-t bg-muted/30 shrink-0">
          <Button onClick={handleSend} disabled={sending || !draft.to.trim()} size="sm" className="gap-1.5">
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send
          </Button>

          <input type="file" ref={fileRef} onChange={handleFileAdd} multiple hidden />
          <Button variant="ghost" size="icon-sm" onClick={() => fileRef.current?.click()} className="size-7" title="Attach">
            <Paperclip className="size-3.5" />
          </Button>

          {/* Case selector */}
          <div className="ml-auto flex items-center gap-1.5">
            <Select
              value={draft.caseId || ''}
              onValueChange={v => updateDraft(draft.id, { caseId: v })}
              onOpenChange={loadCases}
            >
              <SelectTrigger className="h-7 text-xs w-[140px] border-dashed">
                <SelectValue placeholder="Log to case..." />
              </SelectTrigger>
              <SelectContent>
                {!cases ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" /> Loading...
                  </div>
                ) : (
                  cases.map(c => (
                    <SelectItem key={c.id || 'none'} value={String(c.id)}>{c.label}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Button variant="ghost" size="icon-sm" onClick={handleDiscard} className="size-7 text-muted-foreground hover:text-destructive" title="Discard">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ComposeWindows() {
  const { drafts } = useDrafts()

  if (drafts.length === 0) return null

  // Separate expanded and minimized drafts, render expanded on top
  const minimized = drafts.filter(d => d.minimized)
  const expanded = drafts.filter(d => !d.minimized)

  // Index all for positioning — minimized first (right side), then expanded
  const allOrdered = [...minimized, ...expanded]

  return (
    <>
      {allOrdered.map((draft, i) => (
        <ComposeWindow key={draft.id} draft={draft} index={i} totalExpanded={expanded.length} />
      ))}
    </>
  )
}

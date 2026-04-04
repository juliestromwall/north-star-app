import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Highlight } from '@tiptap/extension-highlight'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import TiptapUnderline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { useDrafts } from '@/context/DraftContext'
import { useRole } from '@/context/RoleContext'
import { sendEmail, createGmailDraft } from '@/lib/google'
import { supabase } from '@/lib/supabase'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Send, Paperclip, X, Loader2, Minus, Maximize2, Minimize2, Trash2,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter,
  List, ListOrdered, Palette, Link as LinkIcon, Undo2, Redo2,
} from 'lucide-react'

function fileSizeLabel(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Formatting Toolbar ──────────────────────────────────

const TEXT_COLORS = [
  { color: '#000000', label: 'Black' },
  { color: '#283693', label: 'Indigo' },
  { color: '#ed148c', label: 'Pink' },
  { color: '#ef4444', label: 'Red' },
  { color: '#f59e0b', label: 'Amber' },
  { color: '#10b981', label: 'Green' },
  { color: '#8b5cf6', label: 'Purple' },
  { color: '#6b7280', label: 'Gray' },
]

const HIGHLIGHT_COLORS = [
  { color: '#fef08a', label: 'Yellow' },
  { color: '#bbf7d0', label: 'Green' },
  { color: '#bfdbfe', label: 'Blue' },
  { color: '#fbcfe8', label: 'Pink' },
  { color: '#fcd6bb', label: 'Orange' },
  { color: '#ddd6fe', label: 'Purple' },
]

function TBtn({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1 rounded transition-colors ${active ? 'bg-stone-200 text-stone-900' : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'}`}
    >
      {children}
    </button>
  )
}

function ColorDrop({ colors, onSelect, onClear, icon: Icon, title }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <TBtn active={open} onClick={() => setOpen(!open)} title={title}>
        <Icon className="size-3.5" />
      </TBtn>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1 z-20 bg-white rounded-lg border shadow-lg p-2 flex gap-1.5 flex-wrap w-max">
            {colors.map(c => (
              <button
                key={c.color}
                className="size-5 rounded-full border border-stone-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: c.color }}
                title={c.label}
                onClick={() => { onSelect(c.color); setOpen(false) }}
              />
            ))}
            <button
              className="size-5 rounded-full border border-stone-200 hover:scale-110 transition-transform flex items-center justify-center text-[9px] text-stone-400"
              onClick={() => { onClear(); setOpen(false) }}
              title="Remove"
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function FormattingToolbar({ editor }) {
  if (!editor) return null

  const setLink = () => {
    const url = prompt('Enter URL:')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-t bg-stone-50/50 flex-wrap">
      <TBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
        <Bold className="size-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
        <Italic className="size-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
        <UnderlineIcon className="size-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
        <Strikethrough className="size-3.5" />
      </TBtn>
      <div className="w-px h-4 bg-stone-200 mx-0.5" />
      <ColorDrop
        colors={TEXT_COLORS}
        onSelect={color => editor.chain().focus().setColor(color).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
        icon={Palette}
        title="Text color"
      />
      <ColorDrop
        colors={HIGHLIGHT_COLORS}
        onSelect={color => editor.chain().focus().toggleHighlight({ color }).run()}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
        icon={Highlighter}
        title="Highlight"
      />
      <div className="w-px h-4 bg-stone-200 mx-0.5" />
      <TBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
        <List className="size-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
        <ListOrdered className="size-3.5" />
      </TBtn>
      <div className="w-px h-4 bg-stone-200 mx-0.5" />
      <TBtn active={editor.isActive('link')} onClick={setLink} title="Link">
        <LinkIcon className="size-3.5" />
      </TBtn>
      <div className="w-px h-4 bg-stone-200 mx-0.5" />
      <TBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
        <Undo2 className="size-3.5" />
      </TBtn>
      <TBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
        <Redo2 className="size-3.5" />
      </TBtn>
    </div>
  )
}

// ── Compose Window ──────────────────────────────────────

function ComposeWindow({ draft, index }) {
  const { updateDraft, closeDraft, minimizeDraft, expandDraft } = useDrafts()
  const { currentUser } = useRole()
  const userId = currentUser?.id
  const [sending, setSending] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [cases, setCases] = useState(null)
  const [compact, setCompact] = useState(false) // false = big, true = small
  const fileRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Color,
      TextStyle,
      TiptapUnderline,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true, allowBase64: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: draft.body || '',
    onUpdate: ({ editor }) => {
      updateDraft(draft.id, { body: editor.getHTML() })
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none px-3 py-2 text-sm h-full',
      },
    },
  })

  // Sync editor content if draft body changes externally (e.g. signature append, reply/forward init)
  const lastSyncedBody = useRef(draft.body)
  useEffect(() => {
    if (!editor || !draft.body) return
    // Always sync if the body grew (signature appended) or changed externally
    if (draft.body !== lastSyncedBody.current && editor.getHTML() !== draft.body) {
      editor.commands.setContent(draft.body)
    }
    lastSyncedBody.current = draft.body
  }, [draft.body, editor])

  const loadCases = () => {
    if (cases) return
    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake(), fetchMatchedJourneys().catch(() => [])])
      .then(([gcs, ips, journeys]) => {
        const allCases = [
          { id: '_none', name: '', label: 'None' },
          ...(gcs || []).map(c => ({ id: c.id, name: c.applicant_name, type: 'gc', label: `GC: ${c.applicant_name}` })),
          ...(ips || []).map(c => ({ id: c.id, name: c.applicant_name, type: 'ip', label: `IP: ${c.applicant_name}` })),
          ...(journeys || []).map(j => ({ id: j.id, name: `Journey #${j.id}`, type: 'journey', label: `Journey #${j.id}` })),
        ].sort((a, b) => {
          if (!a.id) return -1
          if (!b.id) return 1
          return String(a.name).localeCompare(String(b.name))
        })
        setCases(allCases)
      })
      .catch(() => setCases([]))
  }

  // Auto-load cases if draft has a pre-set caseId
  useEffect(() => {
    if (draft.caseId && !cases) {
      // Delay slightly to avoid render cascade
      const t = setTimeout(loadCases, 100)
      return () => clearTimeout(t)
    }
  }, [draft.caseId])

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
      const htmlBody = editor?.getHTML() || draft.body || '<p></p>'
      const result = await sendEmail(userId, {
        to: draft.to.trim(),
        subject: draft.subject,
        body: htmlBody,
        cc: draft.cc || undefined,
        bcc: draft.bcc || undefined,
        attachments: draft.attachments,
      })

      if (draft.caseId && draft.caseId !== '_none' && supabase) {
        const c = cases?.find(c => String(c.id) === String(draft.caseId))
        const caseType = draft.caseType || c?.type || 'gc'
        try {
          const { error } = await supabase.from('case_emails').insert({
            gmail_message_id: result.id || 'sent-' + Date.now(),
            case_id: Number(draft.caseId) || draft.caseId,
            case_type: caseType,
            subject: draft.subject,
            from_address: currentUser?.email || '',
            to_address: draft.to,
            date: new Date().toISOString(),
            snippet: (editor?.getText() || '').slice(0, 200),
            logged_by: userId,
            logged_by_name: currentUser?.name || '',
          })
          if (error) console.error('Email log failed:', error)
        } catch (err) { console.error('Email log failed:', err) }
      }

      closeDraft(draft.id)
    } catch (err) {
      alert('Failed to send: ' + err.message)
    }
    setSending(false)
  }

  const handleClose = async () => {
    const hasContent = draft.to || draft.subject || (editor?.getText()?.trim())
    if (!hasContent) {
      closeDraft(draft.id)
      return
    }

    // Save to Gmail drafts
    if (userId) {
      setSavingDraft(true)
      try {
        const htmlBody = editor?.getHTML() || draft.body || ''
        await createGmailDraft(userId, {
          to: draft.to,
          subject: draft.subject,
          body: htmlBody,
          cc: draft.cc || undefined,
          bcc: draft.bcc || undefined,
          attachments: draft.attachments,
        })
      } catch (err) {
        console.error('Failed to save draft:', err)
      }
      setSavingDraft(false)
    }
    closeDraft(draft.id)
  }

  const handleDiscard = () => {
    if (draft.to || draft.subject || editor?.getText()?.trim()) {
      if (!confirm('Discard this draft?')) return
    }
    closeDraft(draft.id)
  }

  // Position — stack from right
  const rightOffset = index * (compact ? 392 : 8) + 16

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
            <button onClick={(e) => { e.stopPropagation(); expandDraft(draft.id) }} className="p-1 hover:bg-white/20 rounded">
              <Maximize2 className="size-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleClose() }} className="p-1 hover:bg-white/20 rounded">
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Big mode: roughly fills the email content area
  // Compact mode: small Gmail-style window
  const bigStyle = {
    right: 16,
    bottom: 0,
    width: 'calc(100vw - 300px)',  // full width minus sidebar
    maxWidth: 900,
    height: 'calc(100vh - 140px)',
  }
  const compactStyle = {
    right: rightOffset,
    bottom: 0,
    width: 384,
    height: 440,
  }

  const style = compact ? compactStyle : bigStyle

  return (
    <div
      className="fixed z-50 flex flex-col shadow-2xl rounded-t-xl overflow-hidden border border-border bg-card"
      style={style}
    >
      {/* Tiptap styles */}
      <style>{`
        .compose-editor .tiptap { height: 100%; overflow-y: auto; }
        .compose-editor .tiptap ul { list-style-type: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .compose-editor .tiptap ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .compose-editor .tiptap li { margin: 0.25em 0; }
        .compose-editor .tiptap li p { margin: 0; }
        .compose-editor .tiptap p { margin: 0.25em 0; }
        .compose-editor .tiptap mark { border-radius: 2px; padding: 1px 2px; }
        .compose-editor .tiptap a { color: #283693; text-decoration: underline; }
        .compose-editor .ProseMirror { height: 100%; }
      `}</style>

      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#283693] text-white shrink-0">
        <span className="text-sm font-medium truncate flex-1">
          {draft.subject || 'New Message'}
        </span>
        <div className="flex items-center gap-0.5 ml-2 shrink-0">
          <button onClick={() => minimizeDraft(draft.id)} className="p-1 hover:bg-white/20 rounded" title="Minimize">
            <Minus className="size-3.5" />
          </button>
          <button onClick={() => setCompact(!compact)} className="p-1 hover:bg-white/20 rounded" title={compact ? 'Expand' : 'Shrink'}>
            {compact ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}
          </button>
          <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded" title="Save & close">
            {savingDraft ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
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
              <button onClick={() => updateDraft(draft.id, { showCcBcc: true })} className="text-xs text-muted-foreground hover:text-foreground">
                Cc/Bcc
              </button>
            )}
          </div>
          {draft.showCcBcc && (
            <>
              <div className="flex items-center gap-2 border-b pb-1.5">
                <span className="text-xs text-muted-foreground w-6">Cc</span>
                <input value={draft.cc} onChange={e => updateDraft(draft.id, { cc: e.target.value })} className="flex-1 text-sm outline-none bg-transparent" />
              </div>
              <div className="flex items-center gap-2 border-b pb-1.5">
                <span className="text-xs text-muted-foreground w-6">Bcc</span>
                <input value={draft.bcc} onChange={e => updateDraft(draft.id, { bcc: e.target.value })} className="flex-1 text-sm outline-none bg-transparent" />
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

        {/* Rich text body */}
        <div className="flex-1 overflow-hidden compose-editor">
          <EditorContent editor={editor} className="h-full" />
        </div>

        {/* Attachments */}
        {draft.attachments.length > 0 && (
          <div className="px-3 pb-1.5 flex flex-wrap gap-1.5 shrink-0 border-t pt-1.5">
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

        {/* Formatting toolbar + actions */}
        <FormattingToolbar editor={editor} />

        <div className="flex items-center gap-1.5 px-3 py-2 border-t bg-muted/30 shrink-0">
          <Button onClick={handleSend} disabled={sending || !draft.to.trim()} size="sm" className="gap-1.5">
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send
          </Button>

          <input type="file" ref={fileRef} onChange={handleFileAdd} multiple hidden />
          <Button variant="ghost" size="icon-sm" onClick={() => fileRef.current?.click()} className="size-7" title="Attach">
            <Paperclip className="size-3.5" />
          </Button>

          <div className="ml-auto flex items-center gap-1.5">
            <Select
              value={draft.caseId || '_none'}
              onValueChange={v => updateDraft(draft.id, { caseId: v === '_none' ? '' : v })}
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

// ── Render all compose windows ──────────────────────────

export default function ComposeWindows() {
  const { drafts } = useDrafts()
  if (drafts.length === 0) return null

  const minimized = drafts.filter(d => d.minimized)
  const expanded = drafts.filter(d => !d.minimized)
  const allOrdered = [...minimized, ...expanded]

  return (
    <>
      {allOrdered.map((draft, i) => (
        <ComposeWindow key={draft.id} draft={draft} index={i} />
      ))}
    </>
  )
}

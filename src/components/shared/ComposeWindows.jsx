import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Highlight } from '@tiptap/extension-highlight'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import TiptapUnderline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { useDrafts } from '@/context/DraftContext'
import { useRole } from '@/context/RoleContext'
import { sendEmail, createGmailDraft, fetchEmailContacts, addEmailContactToCache } from '@/lib/google'
import { supabase } from '@/lib/supabase'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake, fetchCaseDocuments } from '@/lib/db'
import { fetchMatchedJourneys } from '@/lib/matching'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Send, Paperclip, X, Loader2, Minus, Maximize2, Minimize2, Trash2,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter,
  List, ListOrdered, Palette, Link as LinkIcon, Undo2, Redo2,
  FolderOpen, Search, FileText,
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

function RecipientInput({ value, onChange, placeholder, contacts }) {
  const [focused, setFocused] = useState(false)
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  // Get the segment being typed (everything after the last comma)
  const lastCommaIdx = Math.max(value.lastIndexOf(','), value.lastIndexOf(';'))
  const beforeFragment = lastCommaIdx >= 0 ? value.slice(0, lastCommaIdx + 1) : ''
  const fragment = (lastCommaIdx >= 0 ? value.slice(lastCommaIdx + 1) : value).trim().toLowerCase()

  // Filter suggestions
  const suggestions = fragment.length >= 1
    ? contacts.filter(c => c.email.toLowerCase().includes(fragment) || c.name?.toLowerCase().includes(fragment)).slice(0, 8)
    : []

  function selectContact(contact) {
    const newVal = (beforeFragment + (beforeFragment && !beforeFragment.endsWith(' ') ? ' ' : '') + contact.email + ', ').replace(/^\s+/, '')
    onChange(newVal)
    setHighlightedIdx(0)
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      selectContact(suggestions[highlightedIdx])
    } else if (e.key === 'Escape') {
      setFocused(false)
    }
  }

  // Reset highlight when suggestions change
  useEffect(() => { setHighlightedIdx(0) }, [fragment])

  // Close on outside click
  useEffect(() => {
    if (!focused) return
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setFocused(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [focused])

  const showDropdown = focused && suggestions.length > 0

  return (
    <div ref={containerRef} className="flex-1 relative">
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full text-sm outline-none bg-transparent"
      />
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {suggestions.map((c, i) => (
            <button
              key={c.email}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectContact(c) }}
              onMouseEnter={() => setHighlightedIdx(i)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${i === highlightedIdx ? 'bg-[#283693]/8' : 'hover:bg-stone-50'}`}
            >
              <div className="size-7 rounded-full bg-[#283693]/10 flex items-center justify-center text-[10px] font-semibold text-[#283693] shrink-0">
                {(c.name || c.email)[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                {c.name && <p className="font-medium text-stone-800 truncate">{c.name}</p>}
                <p className={`text-xs text-stone-500 truncate ${!c.name ? 'text-stone-800 font-medium' : ''}`}>{c.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ComposeWindow({ draft, index }) {
  const { updateDraft, closeDraft, minimizeDraft, expandDraft } = useDrafts()
  const { currentUser } = useRole()
  const userId = currentUser?.id
  const [sending, setSending] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [cases, setCases] = useState(null)
  const [compact, setCompact] = useState(false) // false = big, true = small
  const fileRef = useRef(null)
  const [docPickerOpen, setDocPickerOpen] = useState(false)
  const [caseDocs, setCaseDocs] = useState([])
  const [docSearch, setDocSearch] = useState('')
  const [docsLoading, setDocsLoading] = useState(false)
  const [contacts, setContacts] = useState([])

  // Load Gmail contacts (cached)
  useEffect(() => {
    if (!userId) return
    fetchEmailContacts(userId).then(setContacts).catch(() => {})
  }, [userId])

  async function openDocPicker() {
    if (!draft.caseId) { alert('Select a case first to attach documents.'); return }
    setDocPickerOpen(true)
    setDocsLoading(true)
    setDocSearch('')
    try {
      // For journey cases, fetch documents from the journey itself + the linked GC and IP cases
      if (draft.caseType === 'journey') {
        const { fetchMatchedJourney } = await import('@/lib/matching')
        const journey = await fetchMatchedJourney(draft.caseId)
        const ids = [draft.caseId]
        if (journey?.gc_case_id) ids.push(journey.gc_case_id)
        if (journey?.ip_case_id) ids.push(journey.ip_case_id)
        const docArrays = await Promise.all(ids.map(id => fetchCaseDocuments(id).catch(() => [])))
        // Tag each doc with its source so the user can tell which case it's from
        const labeled = docArrays.flatMap((docs, i) => {
          const sourceLabel = i === 0 ? 'Journey' : i === 1 ? 'GC' : 'IP'
          return (docs || []).map(d => ({ ...d, _source: sourceLabel }))
        })
        // De-duplicate by id (in case the journey id matches a case id somewhere)
        const seen = new Set()
        const unique = labeled.filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true })
        setCaseDocs(unique)
      } else {
        const docs = await fetchCaseDocuments(draft.caseId)
        setCaseDocs(docs || [])
      }
    } catch { setCaseDocs([]) }
    finally { setDocsLoading(false) }
  }

  async function attachDoc(doc) {
    try {
      const res = await fetch(doc.public_url)
      const blob = await res.blob()
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]
        const existing = draft.attachments || []
        updateDraft(draft.id, { attachments: [...existing, { filename: doc.file_name, mimeType: doc.file_type || 'application/octet-stream', base64Data: base64, size: doc.file_size || blob.size }] })
      }
      reader.readAsDataURL(blob)
    } catch { alert('Failed to attach document') }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Color,
      TextStyle,
      TiptapUnderline,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true, allowBase64: true }),
    ],
    content: draft.body || '',
    onUpdate: ({ editor }) => {
      updateDraft(draft.id, { body: editor.getHTML() })
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none px-3 py-2 text-sm h-full [&_p]:mb-3 [&_p:last-child]:mb-0',
      },
    },
  })

  // Sync editor content if draft body changes externally (e.g. reply/forward init)
  useEffect(() => {
    if (editor && draft.body && editor.getHTML() !== draft.body && !editor.isFocused) {
      editor.commands.setContent(draft.body)
    }
  }, [draft.body, editor])

  const loadCases = () => {
    if (cases) return
    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake(), fetchMatchedJourneys().catch(() => [])])
      .then(([gcs, ips, journeys]) => {
        // Build GC/IP name lookups for journey labels
        const gcMap = {}
        for (const g of (gcs || [])) gcMap[g.id] = g.name
        const ipMap = {}
        for (const ip of (ips || [])) ipMap[ip.id] = ip.names

        const allCases = [
          { id: '_none', name: '', label: 'None', group: '' },
          ...(journeys || []).map(j => {
            const gcName = gcMap[j.gc_case_id] || 'GC'
            const ipName = ipMap[j.ip_case_id] || 'IP'
            return { id: j.id, name: `${ipName} + ${gcName}`, type: 'journey', label: `${ipName} + ${gcName}`, group: 'Journeys' }
          }),
          ...(gcs || []).map(c => ({ id: c.id, name: c.name || '?', type: 'gc', label: c.name || '?', group: 'Surrogates' })),
          ...(ips || []).map(c => ({ id: c.id, name: c.names || '?', type: 'ip', label: c.names || '?', group: 'Intended Parents' })),
        ]
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
      // Don't append signature — Gmail auto-appends it on send
      const result = await sendEmail(userId, {
        to: draft.to.trim(),
        subject: draft.subject,
        body: htmlBody,
        cc: draft.cc || undefined,
        bcc: draft.bcc || undefined,
        attachments: draft.attachments,
      })

      // Cache recipients for autocomplete on next compose
      try { addEmailContactToCache(userId, [draft.to, draft.cc, draft.bcc].filter(Boolean)) } catch {}

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
            body_html: editor?.getHTML() || null,
            logged_by: userId,
            logged_by_name: currentUser?.name || '',
            tag: draft.emailTag || null,
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
        // Don't append signature — Gmail adds it when draft is sent from Gmail
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
            <RecipientInput
              value={draft.to || ''}
              onChange={v => updateDraft(draft.id, { to: v })}
              placeholder="recipient@email.com"
              contacts={contacts}
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
                <RecipientInput value={draft.cc || ''} onChange={v => updateDraft(draft.id, { cc: v })} placeholder="" contacts={contacts} />
              </div>
              <div className="flex items-center gap-2 border-b pb-1.5">
                <span className="text-xs text-muted-foreground w-6">Bcc</span>
                <RecipientInput value={draft.bcc || ''} onChange={v => updateDraft(draft.id, { bcc: v })} placeholder="" contacts={contacts} />
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

        {/* Rich text body + signature */}
        <div className="flex-1 overflow-y-auto compose-editor">
          <EditorContent editor={editor} className="min-h-[80px]" />
          {draft.signatureHtml && (
            <div className="px-3 pb-3 text-sm border-t border-transparent">
              <div className="text-stone-400">--</div>
              <div dangerouslySetInnerHTML={{ __html: draft.signatureHtml }} />
            </div>
          )}
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
          <Button variant="ghost" size="icon-sm" onClick={() => fileRef.current?.click()} className="size-7" title="Attach file">
            <Paperclip className="size-3.5" />
          </Button>
          {draft.caseId && (
            <Button variant="ghost" size="sm" onClick={openDocPicker} className="h-7 gap-1 text-[10px] text-stone-500 hover:text-[#283693]" title="Attach from case documents">
              <FolderOpen className="size-3.5" /> Docs
            </Button>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <Select
              value={draft.caseId || '_none'}
              onValueChange={v => updateDraft(draft.id, { caseId: v === '_none' ? '' : v })}
              onOpenChange={loadCases}
            >
              <SelectTrigger className="h-7 text-xs w-[180px] border-dashed">
                <SelectValue placeholder="Log to case..." />
              </SelectTrigger>
              <SelectContent>
                {!cases ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" /> Loading...
                  </div>
                ) : (
                  <>
                    <SelectItem value="_none">None</SelectItem>
                    {cases.filter(c => c.group === 'Journeys').length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Journeys</div>
                        {cases.filter(c => c.group === 'Journeys').map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                        ))}
                      </>
                    )}
                    {cases.filter(c => c.group === 'Surrogates').length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Surrogates</div>
                        {cases.filter(c => c.group === 'Surrogates').map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                        ))}
                      </>
                    )}
                    {cases.filter(c => c.group === 'Intended Parents').length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Intended Parents</div>
                        {cases.filter(c => c.group === 'Intended Parents').map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>
                        ))}
                      </>
                    )}
                  </>
                )}
              </SelectContent>
            </Select>

            {draft.caseId && draft.caseId !== '_none' && (
              <Select value={draft.emailTag || '_none'} onValueChange={v => updateDraft(draft.id, { emailTag: v === '_none' ? '' : v })}>
                <SelectTrigger className="h-7 text-xs w-[100px] border-dashed">
                  <SelectValue placeholder="Tag..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No tag</SelectItem>
                  <SelectItem value="escrow">Escrow</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="medical_records">Medical Records</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="ob">OB</SelectItem>
                  <SelectItem value="hospital">Hospital</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                  <SelectItem value="matching">Matching</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="psych">Psych</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button variant="ghost" size="icon-sm" onClick={handleDiscard} className="size-7 text-muted-foreground hover:text-destructive" title="Discard">
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Attach from Case Documents Modal */}
      {docPickerOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center" onClick={() => setDocPickerOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[60vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-2">
                <FolderOpen className="size-4 text-[#283693]" /> Attach from Case Documents
              </h3>
              <button onClick={() => setDocPickerOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="size-4" /></button>
            </div>
            <div className="px-4 py-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
                <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder="Search documents..." className="w-full h-8 text-sm border border-stone-200 rounded-lg pl-8 pr-3 bg-white" autoFocus />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[40vh] p-2">
              {docsLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="size-5 animate-spin text-stone-400" /></div>
              ) : caseDocs.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-8">No documents found for this case.</p>
              ) : (
                <div className="space-y-1">
                  {caseDocs
                    .filter(d => !docSearch || d.file_name?.toLowerCase().includes(docSearch.toLowerCase()) || d.category?.toLowerCase().includes(docSearch.toLowerCase()))
                    .map(doc => {
                      const alreadyAttached = (draft.attachments || []).some(a => a.filename === doc.file_name)
                      return (
                        <button
                          key={doc.id}
                          disabled={alreadyAttached}
                          onClick={() => { attachDoc(doc); setDocPickerOpen(false) }}
                          className={`w-full text-left rounded-lg border px-3 py-2 flex items-center gap-2 transition-colors ${alreadyAttached ? 'opacity-40 cursor-not-allowed border-stone-100' : 'border-stone-100 hover:border-[#283693]/30 hover:bg-[#283693]/5 cursor-pointer'}`}
                        >
                          <FileText className="size-4 text-stone-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-stone-700 truncate">{doc.file_name}</p>
                            <p className="text-[10px] text-stone-400">
                              {doc._source && <span className={`inline-block mr-1.5 px-1 py-0 rounded text-white text-[9px] font-bold ${doc._source === 'GC' ? 'bg-pink-500' : doc._source === 'IP' ? 'bg-[#283693]' : 'bg-purple-500'}`}>{doc._source}</span>}
                              {doc.category?.replace(/_/g, ' ')} {doc.file_size ? `· ${fileSizeLabel(doc.file_size)}` : ''}
                            </p>
                          </div>
                          {alreadyAttached && <span className="text-[9px] text-stone-400">Attached</span>}
                        </button>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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

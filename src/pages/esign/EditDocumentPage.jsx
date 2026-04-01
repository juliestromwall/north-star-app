import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import mammoth from 'mammoth'
import {
  ArrowLeft, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, Send, Loader2, Save, FileText, Eye,
  Plus, Trash2, PenLine, User, Calendar, Hash, CheckSquare, Type, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import { useRole } from '@/context/RoleContext'
import { fetchTemplates, getTemplateFileUrl, createDocument, sendDocument, saveTemplateHtml, updateTemplate } from '@/lib/esign'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { SignField, FIELD_TYPES, FIELD_ROLES } from '@/lib/signFieldExtension'

// ── Toolbar ─────────────────────────────────────────────

function ToolbarButton({ active, onClick, children, title }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-stone-200 text-stone-900' : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'}`}>
      {children}
    </button>
  )
}

const FIELD_ICONS = {
  signature: PenLine,
  name: User,
  date: Calendar,
  initials: Hash,
  checkbox: CheckSquare,
  text: Type,
}

function InsertFieldDropdown({ editor }) {
  const [open, setOpen] = useState(false)
  const [fieldType, setFieldType] = useState('signature')
  const [role, setRole] = useState('gc')
  const [label, setLabel] = useState('')

  function insertField() {
    if (!editor) return
    const fieldId = `field_${Date.now()}`
    editor.chain().focus().insertContent({
      type: 'signField',
      attrs: { fieldType, role, label, fieldId },
    }).run()
    setOpen(false)
    setLabel('')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Insert signing field"
        className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition-colors bg-[#283693]/10 text-[#283693] hover:bg-[#283693]/20"
      >
        <PenLine className="size-3.5" />
        Insert Field
        <ChevronDown className="size-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-xl border shadow-xl p-4 w-72 space-y-3">
            <p className="text-xs font-semibold text-stone-500 uppercase">Insert Signing Field</p>

            {/* Field type */}
            <div className="space-y-1">
              <label className="text-xs text-stone-500">Field Type</label>
              <div className="grid grid-cols-3 gap-1">
                {FIELD_TYPES.map(ft => {
                  const Icon = FIELD_ICONS[ft.type] || Type
                  return (
                    <button
                      key={ft.type}
                      onClick={() => setFieldType(ft.type)}
                      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium transition-colors ${
                        fieldType === ft.type
                          ? 'bg-[#283693] text-white'
                          : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      <Icon className="size-3.5" />
                      {ft.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1">
              <label className="text-xs text-stone-500">Assigned To</label>
              <div className="grid grid-cols-2 gap-1">
                {FIELD_ROLES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setRole(r.value)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      role === r.value
                        ? 'bg-[#283693] text-white'
                        : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom label */}
            <div className="space-y-1">
              <label className="text-xs text-stone-500">Custom Label (optional)</label>
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder={`e.g. "${FIELD_TYPES.find(f => f.type === fieldType)?.label || 'Field'}"`}
                className="h-8 text-xs"
              />
            </div>

            <Button onClick={insertField} size="sm" className="w-full gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              <Plus className="size-3.5" />
              Insert Field
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function EditorToolbar({ editor }) {
  if (!editor) return null
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b bg-stone-50/50">
      <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
        <UnderlineIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
        <Strikethrough className="size-4" />
      </ToolbarButton>
      <div className="w-px h-5 bg-stone-200 mx-1" />
      <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List">
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <div className="w-px h-5 bg-stone-200 mx-1" />
      <ToolbarButton active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align Left">
        <AlignLeft className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align Center">
        <AlignCenter className="size-4" />
      </ToolbarButton>
      <ToolbarButton active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align Right">
        <AlignRight className="size-4" />
      </ToolbarButton>
      <div className="w-px h-5 bg-stone-200 mx-1" />
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
        <Redo2 className="size-4" />
      </ToolbarButton>
      <div className="w-px h-5 bg-stone-200 mx-1" />
      <select className="text-xs border rounded px-1.5 py-1 bg-white text-stone-600"
        onChange={e => {
          const level = parseInt(e.target.value)
          if (level === 0) editor.chain().focus().setParagraph().run()
          else editor.chain().focus().toggleHeading({ level }).run()
          e.target.value = ''
        }}
        value=""
      >
        <option value="" disabled>Heading</option>
        <option value="0">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>
      <div className="w-px h-5 bg-stone-200 mx-1" />
      <InsertFieldDropdown editor={editor} />
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────

export default function EditDocumentPage() {
  const { templateId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { currentUser } = useRole()

  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [converting, setConverting] = useState(false)
  const [htmlContent, setHtmlContent] = useState('')
  const [docTitle, setDocTitle] = useState('')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSaveTemplate() {
    if (!editor || !template) return
    setSaving(true)
    try {
      const html = editor.getHTML()
      await saveTemplateHtml(template.id, html)
      if (docTitle !== template.name) {
        await updateTemplate(template.id, { name: docTitle })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Failed to save: ' + (err.message || 'Unknown error'))
    } finally { setSaving(false) }
  }

  // Send dialog
  const [showSend, setShowSend] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendForm, setSendForm] = useState({ caseType: '', caseId: '', signers: [] })
  const [cases, setCases] = useState({ gc: [], ip: [] })

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Color,
      TextStyle,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      SignField,
    ],
    content: htmlContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
    },
  })

  useEffect(() => {
    if (editor && htmlContent) {
      editor.commands.setContent(htmlContent)
    }
  }, [editor, htmlContent])

  useEffect(() => {
    async function load() {
      try {
        const templates = await fetchTemplates()
        const tmpl = templates.find(t => t.id === Number(templateId))
        if (!tmpl) { setLoading(false); return }
        setTemplate(tmpl)
        setDocTitle(tmpl.name)

        const url = getTemplateFileUrl(tmpl.file_path)
        if (url && tmpl.file_name.endsWith('.html')) {
          setConverting(true)
          const response = await fetch(url)
          const html = await response.text()
          setHtmlContent(html)
          setConverting(false)
        } else if (url && (tmpl.file_name.endsWith('.docx') || tmpl.file_name.endsWith('.doc'))) {
          setConverting(true)
          const response = await fetch(url)
          const arrayBuffer = await response.arrayBuffer()
          const result = await mammoth.convertToHtml({ arrayBuffer })
          setHtmlContent(result.value)
          setConverting(false)
        } else if (url && tmpl.file_name.endsWith('.pdf')) {
          setHtmlContent('<p><em>PDF files cannot be edited directly. Please upload a .docx version of this template to enable editing.</em></p>')
        }
      } catch (err) {
        console.error('Failed to load template:', err)
      } finally { setLoading(false) }
    }
    load()

    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake()])
      .then(([gcs, ips]) => setCases({ gc: gcs, ip: ips }))
      .catch(() => {})
  }, [templateId])

  function addSigner() {
    setSendForm(prev => ({ ...prev, signers: [...prev.signers, { role: '', name: '', email: '', status: 'pending' }] }))
  }

  function updateSigner(idx, key, val) {
    setSendForm(prev => {
      const signers = [...prev.signers]
      signers[idx] = { ...signers[idx], [key]: val }
      return { ...prev, signers }
    })
  }

  function removeSigner(idx) {
    setSendForm(prev => ({ ...prev, signers: prev.signers.filter((_, i) => i !== idx) }))
  }

  function handleCaseSelect(caseType, caseId) {
    setSendForm(prev => ({ ...prev, caseType, caseId }))
    if (!caseId) return
    const list = caseType === 'ip' ? cases.ip : cases.gc
    const c = list.find(x => x.id === Number(caseId))
    if (!c) return
    const signers = []
    if (caseType === 'gc') {
      signers.push({ role: 'Surrogate', name: c.name || '', email: c.email || '', status: 'pending' })
    } else {
      signers.push({ role: 'Intended Parent 1', name: c.ip1Name || c.names || '', email: c.email || '', status: 'pending' })
      if (c.ip2Name) signers.push({ role: 'Intended Parent 2', name: c.ip2Name, email: c.ip2Email || '', status: 'pending' })
    }
    setSendForm(prev => ({ ...prev, signers }))
  }

  async function handleSend() {
    if (!editor || sendForm.signers.length === 0) return
    setSending(true)
    try {
      const editedHtml = editor.getHTML()

      const doc = await createDocument({
        templateId: Number(templateId),
        caseId: sendForm.caseId ? Number(sendForm.caseId) : null,
        caseType: sendForm.caseType || null,
        title: docTitle || template?.name || 'Untitled',
        signers: sendForm.signers,
        filePath: template?.file_path || null,
        createdBy: currentUser.name,
      })

      // Store edited HTML as document_hash (base64-encoded)
      const { updateDocument } = await import('@/lib/esign')
      const encoded = btoa(unescape(encodeURIComponent(editedHtml)))
      await updateDocument(doc.id, { document_hash: encoded })

      await sendDocument(doc.id)
      navigate('/e-signature')
    } catch (err) {
      alert('Failed to send: ' + (err.message || 'Unknown error'))
    } finally { setSending(false) }
  }

  if (loading || converting) {
    return (
      <div className="text-center py-12">
        <Loader2 className="size-8 animate-spin text-[#283693] mx-auto mb-3" />
        <p className="text-stone-400">{converting ? 'Converting document...' : 'Loading template...'}</p>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="space-y-6">
        <Link to="/e-signature" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to E-Signature
        </Link>
        <p className="text-center py-12 text-stone-400">Template not found.</p>
      </div>
    )
  }

  const caseOptions = sendForm.caseType === 'ip' ? cases.ip : sendForm.caseType === 'gc' ? cases.gc : []

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header — sticky */}
      <div className="flex items-center justify-between pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/e-signature" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back
          </Link>
          <div className="w-px h-6 bg-stone-200" />
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-[#283693]" />
            <Input value={docTitle} onChange={e => setDocTitle(e.target.value)} className="text-lg font-semibold border-none shadow-none px-1 h-auto focus-visible:ring-0 w-80" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => setPreview(!preview)}>
            <Eye className="size-4" /> {preview ? 'Edit' : 'Preview'}
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={handleSaveTemplate} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saved ? 'Saved!' : 'Save Template'}
          </Button>
          <Button className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }} onClick={() => setShowSend(true)}>
            <Send className="size-4" /> Send for Signature
          </Button>
        </div>
      </div>

      {/* Editor — toolbar sticky, content scrolls */}
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        {!preview && <div className="shrink-0 sticky top-0 z-10 bg-white"><EditorToolbar editor={editor} /></div>}
        <div className={`flex-1 overflow-y-auto bg-white ${preview ? 'pointer-events-none' : ''}`}>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Send Dialog */}
      <Dialog open={showSend} onOpenChange={setShowSend}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send "{docTitle}" for Signature</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Case Type</Label>
                <SelectUI value={sendForm.caseType} onValueChange={v => setSendForm(prev => ({ ...prev, caseType: v, caseId: '' }))}>
                  <SelectTriggerUI><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="gc">Surrogate (GC)</SelectItemUI>
                    <SelectItemUI value="ip">Intended Parent (IP)</SelectItemUI>
                  </SelectContentUI>
                </SelectUI>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Case</Label>
                <SelectUI value={sendForm.caseId ? String(sendForm.caseId) : ''} onValueChange={v => handleCaseSelect(sendForm.caseType, v)}>
                  <SelectTriggerUI><SelectValueUI placeholder="Select case..." /></SelectTriggerUI>
                  <SelectContentUI>
                    {caseOptions.map(c => <SelectItemUI key={c.id} value={String(c.id)}>{c.names || c.name}</SelectItemUI>)}
                  </SelectContentUI>
                </SelectUI>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-stone-500">Signers</Label>
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addSigner}>
                  <Plus className="size-3" /> Add Signer
                </Button>
              </div>
              {sendForm.signers.length === 0 && (
                <p className="text-xs text-stone-400 text-center py-3">Select a case to auto-populate signers, or add manually.</p>
              )}
              {sendForm.signers.map((s, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2 bg-stone-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-500">Signer #{i + 1}</span>
                    <button onClick={() => removeSigner(i)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Role" value={s.role} onChange={e => updateSigner(i, 'role', e.target.value)} className="text-xs h-8" />
                    <Input placeholder="Name" value={s.name} onChange={e => updateSigner(i, 'name', e.target.value)} className="text-xs h-8" />
                    <Input placeholder="Email" type="email" value={s.email} onChange={e => updateSigner(i, 'email', e.target.value)} className="text-xs h-8" />
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleSend} disabled={sending || sendForm.signers.length === 0}
              className="w-full gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {sending ? 'Sending...' : 'Send for Signature'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

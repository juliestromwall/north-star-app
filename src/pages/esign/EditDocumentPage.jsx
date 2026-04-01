import { useState, useEffect, useCallback, useRef } from 'react'
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
import BaseImage from '@tiptap/extension-image'
import mammoth from 'mammoth'
import {
  ArrowLeft, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, Send, Loader2, Save, FileText, Eye,
  Plus, Trash2, PenLine, User, Calendar, Hash, CheckSquare, Type, ChevronDown,
  ImageIcon, SeparatorHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import { useRole } from '@/context/RoleContext'
import { fetchTemplates, getTemplateFileUrl, createDocument, sendDocument, saveTemplateHtml, updateTemplate, getLetterhead } from '@/lib/esign'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { SignField, FIELD_TYPES, FIELD_ROLES } from '@/lib/signFieldExtension'

// ── Custom Image with resize + alignment ────────────────

const ResizableImage = BaseImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: el => el.getAttribute('width') || el.style.width?.replace('px', '') || null },
      alignment: { default: 'left', parseHTML: el => el.getAttribute('data-alignment') || 'left' },
    }
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const wrapper = document.createElement('div')
      wrapper.style.textAlign = node.attrs.alignment || 'left'
      wrapper.style.margin = '8px 0'
      wrapper.setAttribute('data-alignment', node.attrs.alignment || 'left')

      const container = document.createElement('span')
      container.style.display = 'inline-block'
      container.style.position = 'relative'
      container.style.lineHeight = '0'

      const img = document.createElement('img')
      img.src = node.attrs.src
      img.alt = node.attrs.alt || ''
      if (node.attrs.width) {
        img.style.width = node.attrs.width + 'px'
      }
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
      img.style.borderRadius = '4px'
      img.style.cursor = 'pointer'

      // Resize handle
      const handle = document.createElement('div')
      handle.style.cssText = 'position:absolute;bottom:0;right:0;width:12px;height:12px;background:#283693;border-radius:2px;cursor:nwse-resize;opacity:0;transition:opacity 0.15s;'
      container.addEventListener('mouseenter', () => { handle.style.opacity = '1' })
      container.addEventListener('mouseleave', () => { if (!resizing) handle.style.opacity = '0' })

      let resizing = false
      let startX = 0
      let startW = 0

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        resizing = true
        startX = e.clientX
        startW = img.offsetWidth

        const onMove = (ev) => {
          const newW = Math.max(50, startW + (ev.clientX - startX))
          img.style.width = newW + 'px'
        }
        const onUp = (ev) => {
          resizing = false
          handle.style.opacity = '0'
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
          const pos = getPos()
          if (typeof pos === 'number') {
            editor.chain().setNodeSelection(pos).updateAttributes('image', { width: Math.round(img.offsetWidth) }).run()
          }
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      })

      container.appendChild(img)
      container.appendChild(handle)
      wrapper.appendChild(container)

      return {
        dom: wrapper,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'image') return false
          img.src = updatedNode.attrs.src
          if (updatedNode.attrs.width) img.style.width = updatedNode.attrs.width + 'px'
          else img.style.width = ''
          wrapper.style.textAlign = updatedNode.attrs.alignment || 'left'
          return true
        },
      }
    }
  },
})

// ── Page Markers ────────────────────────────────────────

function PageMarkers({ editor }) {
  const [pageCount, setPageCount] = useState(1)

  useEffect(() => {
    if (!editor) return
    const PAGE_HEIGHT_PX = 11 * 96

    const update = () => {
      const el = editor.view.dom
      if (!el) return
      const height = el.scrollHeight
      setPageCount(Math.max(1, Math.ceil(height / PAGE_HEIGHT_PX)))
    }

    update()
    editor.on('update', update)
    const observer = new ResizeObserver(update)
    if (editor.view.dom) observer.observe(editor.view.dom)

    return () => {
      editor.off('update', update)
      observer.disconnect()
    }
  }, [editor])

  const PAGE_HEIGHT_PX = 11 * 96

  return (
    <div className="absolute left-0 top-0 w-full pointer-events-none" style={{ zIndex: 5, width: '8.5in', left: '50%', transform: 'translateX(-50%)' }}>
      {/* Page break lines between pages */}
      {Array.from({ length: pageCount - 1 }, (_, i) => (
        <div
          key={`break-${i}`}
          className="absolute left-0 right-0 flex items-center justify-center"
          style={{ top: (i + 1) * PAGE_HEIGHT_PX }}
        >
          <div className="w-full border-t-2 border-dashed border-stone-400/40 relative">
            <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-stone-400/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              Page {i + 1} / {pageCount}
            </span>
          </div>
        </div>
      ))}
      {/* Page numbers at bottom of each page */}
      {Array.from({ length: pageCount }, (_, i) => (
        <div
          key={`num-${i}`}
          className="absolute left-0 right-0 flex justify-center"
          style={{ top: (i + 1) * PAGE_HEIGHT_PX - 36 }}
        >
          <span className="text-[10px] text-stone-400 font-medium">{i + 1}</span>
        </div>
      ))}
    </div>
  )
}

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
  // Force re-render on selection/transaction changes so image toolbar shows
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!editor) return
    const handler = () => setTick(t => t + 1)
    editor.on('selectionUpdate', handler)
    editor.on('transaction', handler)
    return () => {
      editor.off('selectionUpdate', handler)
      editor.off('transaction', handler)
    }
  }, [editor])

  if (!editor) return null
  const imageActive = editor.isActive('image')
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
      <ToolbarButton onClick={() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => {
            editor.chain().focus().setImage({ src: reader.result }).run()
          }
          reader.readAsDataURL(file)
        }
        input.click()
      }} title="Insert Image">
        <ImageIcon className="size-4" />
      </ToolbarButton>
      {imageActive && (
        <>
          <div className="w-px h-5 bg-stone-200 mx-1" />
          <span className="text-[10px] text-stone-400 mr-1">Image:</span>
          <ToolbarButton active={editor.getAttributes('image').alignment === 'left'} onClick={() => editor.chain().focus().updateAttributes('image', { alignment: 'left' }).run()} title="Align Left">
            <AlignLeft className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton active={editor.getAttributes('image').alignment === 'center'} onClick={() => editor.chain().focus().updateAttributes('image', { alignment: 'center' }).run()} title="Center">
            <AlignCenter className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton active={editor.getAttributes('image').alignment === 'right'} onClick={() => editor.chain().focus().updateAttributes('image', { alignment: 'right' }).run()} title="Align Right">
            <AlignRight className="size-3.5" />
          </ToolbarButton>
          <select className="text-[10px] border rounded px-1 py-0.5 bg-white text-stone-600 ml-1"
            value={editor.getAttributes('image').width || ''}
            onChange={e => editor.chain().focus().updateAttributes('image', { width: e.target.value ? Number(e.target.value) : null }).run()}>
            <option value="">Auto</option>
            <option value="100">100px</option>
            <option value="200">200px</option>
            <option value="300">300px</option>
            <option value="400">400px</option>
            <option value="500">500px</option>
            <option value="600">600px</option>
            <option value="750">750px</option>
          </select>
        </>
      )}
      <ToolbarButton onClick={() => {
        editor.chain().focus().setHardBreak().run()
        editor.chain().focus().insertContent('<div class="page-break" contenteditable="false"><span>— Page Break —</span></div><p></p>').run()
      }} title="Insert Page Break">
        <SeparatorHorizontal className="size-4" />
      </ToolbarButton>
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
  const [letterheadUrl, setLetterheadUrl] = useState(null)
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
      ResizableImage.configure({ inline: false, allowBase64: true }),
      SignField,
    ],
    content: htmlContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
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
    getLetterhead().then(url => { if (url) setLetterheadUrl(url) }).catch(() => {})
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

      {/* Editor styles — paginated view */}
      <style>{`
        .esign-editor-scroll {
          background: #d4d4d8;
          padding: 24px;
        }
        .esign-editor .ProseMirror {
          background: white;
          width: 8.5in;
          min-height: 11in;
          margin: 0 auto;
          padding: 1in;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06);
          border-radius: 2px;
          position: relative;
          /* Page boundary lines every 11in */
          background-image:
            linear-gradient(to bottom,
              transparent calc(11in - 24px),
              rgba(0,0,0,0.04) calc(11in - 24px),
              rgba(0,0,0,0.04) calc(11in - 1px),
              transparent calc(11in - 1px),
              transparent 11in
            );
          background-size: 100% 11in;
          background-repeat: repeat-y;
          background-position: top left;
        }
        /* Page number markers */
        .esign-page-markers {
          position: absolute;
          top: 0;
          left: -40px;
          width: 36px;
          pointer-events: none;
        }
        .esign-page-marker {
          position: absolute;
          left: 0;
          width: 36px;
          text-align: center;
          font-size: 9px;
          font-weight: 700;
          color: #a1a1aa;
          background: #d4d4d8;
          border-radius: 4px;
          padding: 2px 0;
        }
        .esign-editor .page-break {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 24px -1in;
          padding: 0;
          height: 32px;
          background: #d4d4d8;
          user-select: none;
          cursor: default;
          position: relative;
        }
        .esign-editor .page-break::before,
        .esign-editor .page-break::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          height: 3px;
        }
        .esign-editor .page-break::before {
          top: 0;
          box-shadow: inset 0 2px 3px rgba(0,0,0,0.1);
        }
        .esign-editor .page-break::after {
          bottom: 0;
          box-shadow: inset 0 -2px 3px rgba(0,0,0,0.1);
        }
        .esign-editor .page-break span {
          font-size: 9px;
          font-weight: 700;
          color: #a1a1aa;
          text-transform: uppercase;
          letter-spacing: 0.15em;
        }
        .esign-editor img.ProseMirror-selectednode {
          outline: 2px solid #283693;
          outline-offset: 2px;
        }
        @page { margin: 0.75in 1in; @bottom-center { content: counter(page); font-size: 10px; color: #999; } }
        @page :first { margin-top: 0.5in; }
        @media print {
          .esign-editor .ProseMirror { box-shadow: none; width: auto; margin: 0; padding: 0; background-image: none; }
          .esign-editor-scroll { background: white; padding: 0; }
          .esign-page-markers, .page-markers-overlay { display: none; }
          .page-break { page-break-after: always; height: 0 !important; margin: 0 !important; background: none !important; }
          .page-break span, .page-break::before, .page-break::after { display: none; }
          .esign-letterhead-print { display: block !important; }
        }
      `}</style>

      {/* Editor — toolbar sticky, content scrolls */}
      <div className="rounded-2xl border shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        {!preview && <div className="shrink-0 sticky top-0 z-10 bg-white border-b"><EditorToolbar editor={editor} /></div>}
        <div className={`flex-1 overflow-y-auto esign-editor-scroll ${preview ? 'pointer-events-none' : ''}`}>
          <div className="esign-editor relative">
            {/* Letterhead — first page only */}
            {letterheadUrl && (
              <div className="flex justify-center" style={{ width: '8.5in', margin: '0 auto', background: 'white', paddingTop: '0.5in', paddingLeft: '1in', paddingRight: '1in', borderRadius: '2px 2px 0 0', boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)' }}>
                <img src={letterheadUrl} alt="Letterhead" style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain' }} />
              </div>
            )}
            <PageMarkers editor={editor} />
            <EditorContent editor={editor} />
          </div>
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

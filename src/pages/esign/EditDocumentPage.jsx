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
  ImageIcon, SeparatorHorizontal, Download,
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

// ── Preview Document (paginated with header/footer) ─────

function PreviewDocument({ editor, letterhead }) {
  // Get the actual rendered innerHTML from ProseMirror — preserves all inline styles
  const editorEl = editor?.view?.dom
  const html = editorEl ? editorEl.innerHTML : (editor?.getHTML() || '')
  const PAGE_H = 11 * 96 // 11in
  const HEADER_AREA = 0.5 * 96 // header starts at 0.5in
  const BODY_TOP = 1 * 96 // body at 1in
  const BODY_BOTTOM = 10 * 96 // body ends at 10in
  const FOOTER_TOP = 10.5 * 96 // footer at 10.5in
  const BODY_H = BODY_BOTTOM - BODY_TOP // 9in of content per page

  // We render the full HTML into a measuring div, then calculate how many pages
  const contentRef = useRef(null)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (contentRef.current) {
      const h = contentRef.current.scrollHeight
      setTotalPages(Math.max(1, Math.ceil(h / BODY_H)))
    }
  }, [html])

  const cs = editorEl ? window.getComputedStyle(editorEl) : null
  const contentStyle = cs ? { fontFamily: cs.fontFamily, fontSize: cs.fontSize, lineHeight: cs.lineHeight, color: cs.color } : {}

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .preview-content p { margin: 0.25em 0; }
        .preview-content ul { list-style-type: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .preview-content ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .preview-content li { margin: 0.25em 0; }
        .preview-content li p { margin: 0; }
        .preview-content img { max-width: 100%; height: auto; }
        .preview-content table { border-collapse: collapse; width: 100%; }
        .preview-content td, .preview-content th { border: 1px solid #ddd; padding: 6px 10px; }
        .preview-content mark { border-radius: 2px; padding: 1px 2px; }
        .preview-content a { color: #283693; text-decoration: underline; }
        .preview-content sign-field { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; border: 1.5px dashed #ccc; background: #f5f5f5; font-size: 12px; font-weight: 600; color: #666; }
      `}</style>
      {/* Hidden measuring div */}
      <div ref={contentRef} style={{ position: 'absolute', visibility: 'hidden', width: '6.5in', padding: 0, ...contentStyle }}>
        <div className="preview-content" dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      {/* Rendered pages */}
      {Array.from({ length: totalPages }, (_, pageIdx) => (
        <div
          key={pageIdx}
          style={{
            width: '8.5in',
            height: `${PAGE_H}px`,
            margin: '0 auto 24px',
            background: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Header — page 1 only */}
          {pageIdx === 0 && letterhead.header && (
            <div style={{ position: 'absolute', top: HEADER_AREA, left: 0, right: 0, textAlign: 'center' }}>
              <img src={letterhead.header} alt="Header" style={{ maxWidth: '220px', height: 'auto' }} />
            </div>
          )}

          {/* Body content — clipped to this page's slice */}
          <div style={{
            position: 'absolute',
            top: BODY_TOP,
            left: '1in',
            right: '1in',
            height: BODY_H,
            overflow: 'hidden',
          }}>
            <div
              className="preview-content"
              style={{ marginTop: -(pageIdx * BODY_H), ...contentStyle }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>

          {/* Footer — every page */}
          {letterhead.footer && (
            <div style={{ position: 'absolute', top: FOOTER_TOP, left: '0.75in', right: '0.75in', textAlign: 'center' }}>
              <img src={letterhead.footer} alt="Footer" style={{ width: '100%', height: 'auto' }} />
            </div>
          )}

          {/* Page number */}
          <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#71717a', fontWeight: 600 }}>
            {pageIdx + 1}
          </div>
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
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [letterhead, setLetterhead] = useState({ header: null, footer: null })
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
    getLetterhead().then(config => { if (config) setLetterhead(config) }).catch(() => {})
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
    <div className="flex flex-col h-[calc(100vh-120px)] esign-print-root">
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
          <Button variant="outline" className="gap-1.5" disabled={generatingPdf} onClick={async () => {
            const editorEl = editor?.view?.dom
            if (!editorEl) return
            setGeneratingPdf(true)
            try {
              const html2canvas = (await import('html2canvas')).default
              const { jsPDF } = await import('jspdf')

              // Letter size in points: 612 x 792
              const pageW = 612
              const pageH = 792
              const margin = 72 // 1in in points
              const contentW = pageW - margin * 2
              const contentH = pageH - margin * 2
              const footerH = letterhead.footer ? 24 : 0
              const usableH = contentH - footerH - 16 // space for footer + page number

              // Capture the editor content
              const canvas = await html2canvas(editorEl, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                width: editorEl.scrollWidth,
                height: editorEl.scrollHeight,
                windowWidth: editorEl.scrollWidth,
                windowHeight: editorEl.scrollHeight,
              })

              const imgData = canvas.toDataURL('image/jpeg', 0.92)
              const imgW = canvas.width
              const imgH = canvas.height

              // Scale: fit the editor width to the PDF content width
              const scale = contentW / (imgW / 2) // /2 because scale:2
              const scaledH = (imgH / 2) * scale
              const totalPages = Math.ceil(scaledH / usableH)

              const pdf = new jsPDF({ unit: 'pt', format: 'letter' })

              // Load footer image if available
              let footerImgData = null
              if (letterhead.footer) {
                try {
                  const fCanvas = document.createElement('canvas')
                  const fImg = new Image()
                  fImg.crossOrigin = 'anonymous'
                  await new Promise((res, rej) => { fImg.onload = res; fImg.onerror = rej; fImg.src = letterhead.footer })
                  fCanvas.width = fImg.naturalWidth
                  fCanvas.height = fImg.naturalHeight
                  fCanvas.getContext('2d').drawImage(fImg, 0, 0)
                  footerImgData = fCanvas.toDataURL('image/png')
                } catch {}
              }

              // Load header image if available
              let headerImgData = null
              if (letterhead.header) {
                try {
                  const hCanvas = document.createElement('canvas')
                  const hImg = new Image()
                  hImg.crossOrigin = 'anonymous'
                  await new Promise((res, rej) => { hImg.onload = res; hImg.onerror = rej; hImg.src = letterhead.header })
                  hCanvas.width = hImg.naturalWidth
                  hCanvas.height = hImg.naturalHeight
                  hCanvas.getContext('2d').drawImage(hImg, 0, 0)
                  headerImgData = hCanvas.toDataURL('image/png')
                } catch {}
              }

              for (let page = 0; page < totalPages; page++) {
                if (page > 0) pdf.addPage()

                const srcY = page * (usableH / scale) * 2 // source Y in canvas pixels
                const srcH = Math.min((usableH / scale) * 2, imgH - srcY)
                if (srcH <= 0) break

                // Create a slice of the canvas for this page
                const sliceCanvas = document.createElement('canvas')
                sliceCanvas.width = imgW
                sliceCanvas.height = srcH
                sliceCanvas.getContext('2d').drawImage(canvas, 0, srcY, imgW, srcH, 0, 0, imgW, srcH)
                const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92)

                let yOffset = margin

                // Header on page 1 only
                if (page === 0 && headerImgData) {
                  const hAspect = 200 / 73 // approximate aspect ratio
                  const hW = 150
                  const hH = hW / hAspect
                  pdf.addImage(headerImgData, 'PNG', (pageW - hW) / 2, margin - 10, hW, hH)
                  yOffset = margin + hH + 8
                }

                // Content slice
                const sliceDisplayH = (srcH / 2) * scale
                pdf.addImage(sliceData, 'JPEG', margin, yOffset, contentW, sliceDisplayH)

                // Footer on every page
                if (footerImgData) {
                  const fW = contentW * 0.8
                  const fH = 16
                  pdf.addImage(footerImgData, 'PNG', (pageW - fW) / 2, pageH - margin - footerH + 2, fW, fH)
                }

                // Page number
                pdf.setFontSize(9)
                pdf.setTextColor(113, 113, 122)
                pdf.text(String(page + 1), pageW / 2, pageH - margin + 8, { align: 'center' })
              }

              pdf.save((docTitle || 'document') + '.pdf')
            } catch (err) {
              alert('PDF generation failed: ' + err.message)
              console.error(err)
            }
            setGeneratingPdf(false)
          }}>
            {generatingPdf ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {generatingPdf ? 'Generating...' : 'Download PDF'}
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
        @media print {
          @page { size: letter; margin: 0.75in 1in; }

          /* The editor page content */
          .esign-editor .ProseMirror {
            box-shadow: none !important;
            width: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            min-height: auto !important;
            border-radius: 0 !important;
          }
          .esign-editor-scroll { background: white !important; padding: 0 !important; overflow: visible !important; height: auto !important; }
          .esign-editor { position: static !important; }

          /* Page breaks */
          .page-break { page-break-after: always !important; height: 0 !important; margin: 0 !important; padding: 0 !important; background: none !important; border: none !important; overflow: hidden !important; }
          .page-break * { display: none !important; }
        }
      `}</style>

      {/* Editor or Preview */}
      {preview ? (
        /* ── Preview Mode: scrollable paginated view with header/footer ── */
        <div className="rounded-2xl border shadow-sm flex-1 min-h-0 overflow-y-auto esign-editor-scroll">
          <PreviewDocument editor={editor} letterhead={letterhead} />
        </div>
      ) : (
        /* ── Edit Mode: clean editor, no header/footer overlays ── */
        <div className="rounded-2xl border shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="shrink-0 sticky top-0 z-10 bg-white border-b"><EditorToolbar editor={editor} /></div>
          <div className="flex-1 overflow-y-auto esign-editor-scroll">
            <div className="esign-editor">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      )}

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

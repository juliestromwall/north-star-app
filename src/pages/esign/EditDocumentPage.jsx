import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Send, Loader2, Save, FileText, Download, Plus, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import { useRole } from '@/context/RoleContext'
import {
  fetchTemplates, createDocument, sendDocument, updateTemplate, updateDocument,
} from '@/lib/esign'
import { supabase } from '@/lib/supabase'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import {
  exportDocAsPdf, getDocPlainText, parseFieldPlaceholders, copyGoogleDoc,
  getOrCreateTemplatesFolder, shareDocPublicly,
} from '@/lib/google'

export default function EditDocumentPage() {
  const { templateId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useRole()
  const userId = currentUser?.id

  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [docTitle, setDocTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Send dialog
  const [showSend, setShowSend] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendForm, setSendForm] = useState({ caseType: '', caseId: '', signers: [] })
  const [cases, setCases] = useState({ gc: [], ip: [] })

  // PDF download
  const [downloading, setDownloading] = useState(false)

  // Load template
  useEffect(() => {
    async function load() {
      try {
        const templates = await fetchTemplates()
        const tmpl = templates.find(t => t.id === Number(templateId))
        if (!tmpl) { setLoading(false); return }
        setTemplate(tmpl)
        setDocTitle(tmpl.name)

        // If this template has a Google Doc, make sure it's shared for embedding
        if (tmpl.google_doc_id && userId) {
          shareDocPublicly(userId, tmpl.google_doc_id).catch(() => {})
        }
      } catch (err) {
        console.error('Failed to load template:', err)
      } finally { setLoading(false) }
    }
    load()

    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake()])
      .then(([gcs, ips]) => setCases({ gc: gcs, ip: ips }))
      .catch(() => {})
  }, [templateId, userId])

  async function handleSaveTitle() {
    if (!template || !docTitle.trim()) return
    setSaving(true)
    try {
      await updateTemplate(template.id, { name: docTitle.trim() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Failed to save: ' + (err.message || 'Unknown error'))
    } finally { setSaving(false) }
  }

  async function handleDownloadPdf() {
    if (!template?.google_doc_id || !userId) return
    setDownloading(true)
    try {
      const blob = await exportDocAsPdf(userId, template.google_doc_id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (docTitle || 'document') + '.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Failed to download PDF: ' + err.message)
    }
    setDownloading(false)
  }

  // ── Send for Signature ────────────────────────────────

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
    if (!template?.google_doc_id || !userId || sendForm.signers.length === 0) return
    setSending(true)
    try {
      // 1. Export as PDF
      let pdfPath = null
      try {
        const pdfBlob = await exportDocAsPdf(userId, template.google_doc_id)
        pdfPath = `documents/sent_${template.id}_${Date.now()}.pdf`
        if (supabase) {
          const { error: uploadErr } = await supabase.storage.from('esign-documents').upload(pdfPath, pdfBlob, {
            contentType: 'application/pdf',
            cacheControl: '3600',
          })
          if (uploadErr) { console.error('PDF upload failed:', uploadErr); pdfPath = null }
        }
      } catch (e) { console.error('PDF export failed:', e); pdfPath = null }

      // 2. Copy the Google Doc as a frozen "sent" copy
      let sentDocId = null
      try {
        const folderId = await getOrCreateTemplatesFolder(userId)
        const sentCopy = await copyGoogleDoc(userId, template.google_doc_id, `[Sent] ${docTitle} - ${new Date().toLocaleDateString()}`, folderId)
        sentDocId = sentCopy.id
      } catch (e) { console.error('Doc copy failed:', e) }

      // 3. Parse field placeholders from the doc
      let fields = []
      try {
        const plainText = await getDocPlainText(userId, template.google_doc_id)
        fields = parseFieldPlaceholders(plainText)
      } catch (e) { console.error('Field parse failed:', e) }

      // 4. Create esign document record
      const doc = await createDocument({
        templateId: Number(templateId),
        caseId: sendForm.caseId ? Number(sendForm.caseId) : null,
        caseType: sendForm.caseType || null,
        title: docTitle || template?.name || 'Untitled',
        signers: sendForm.signers,
        filePath: pdfPath || template.google_doc_id,
        createdBy: currentUser.name,
      })

      // Store metadata
      if (doc) {
        await updateDocument(doc.id, {
          document_hash: JSON.stringify({
            googleDocId: sentDocId,
            templateDocId: template.google_doc_id,
            fields,
            pdfPath,
          }),
        })
      }

      // 5. Send
      await sendDocument(doc.id)
      navigate('/e-signature')
    } catch (err) {
      alert('Failed to send: ' + (err.message || 'Unknown error'))
    } finally { setSending(false) }
  }

  // ── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="size-8 animate-spin text-[#283693] mx-auto mb-3" />
        <p className="text-stone-400">Loading template...</p>
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

  const googleDocId = template.google_doc_id
  const embedUrl = googleDocId
    ? `https://docs.google.com/document/d/${googleDocId}/edit?embedded=true`
    : null

  const caseOptions = sendForm.caseType === 'ip' ? cases.ip : sendForm.caseType === 'gc' ? cases.gc : []

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/e-signature" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back
          </Link>
          <div className="w-px h-6 bg-stone-200" />
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-[#283693]" />
            <Input
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              onBlur={handleSaveTitle}
              className="text-lg font-semibold border-none shadow-none px-1 h-auto focus-visible:ring-0 w-80"
            />
          </div>
          {saved && <span className="text-xs text-emerald-600 font-medium">Saved!</span>}
        </div>
        <div className="flex gap-2">
          {googleDocId && (
            <Button variant="outline" className="gap-1.5" onClick={handleDownloadPdf} disabled={downloading}>
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download PDF
            </Button>
          )}
          <Button className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }} onClick={() => setShowSend(true)}>
            <Send className="size-4" /> Send for Signature
          </Button>
        </div>
      </div>

      {/* Google Doc or fallback message */}
      {embedUrl ? (
        <div className="flex-1 rounded-2xl border shadow-sm overflow-hidden bg-white">
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            title={docTitle}
            allow="clipboard-write"
          />
        </div>
      ) : (
        <div className="flex-1 rounded-2xl border shadow-sm flex items-center justify-center bg-stone-50">
          <div className="text-center space-y-3">
            <FileText className="size-12 text-stone-300 mx-auto" />
            <p className="text-stone-500 text-sm">This template was uploaded as a file.</p>
            <p className="text-stone-400 text-xs">To use the Google Docs editor, create a new template using "Create Template".</p>
          </div>
        </div>
      )}

      {/* Field placeholders help */}
      {googleDocId && (
        <div className="mt-2 px-1 shrink-0">
          <p className="text-[11px] text-stone-400">
            <span className="font-semibold">Signing fields:</span>{' '}
            Type these placeholders in the Google Doc where you need signatures:{' '}
            <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Signature:GC}}'}</code>{' '}
            <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Name:GC}}'}</code>{' '}
            <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Date:GC}}'}</code>{' '}
            <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Initials:GC}}'}</code>{' '}
            <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Checkbox:GC}}'}</code>{' '}
            <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Text:GC}}'}</code>{' '}
            — Replace <code className="bg-stone-100 px-1 rounded text-[10px]">GC</code> with{' '}
            <code className="bg-stone-100 px-1 rounded text-[10px]">IP1</code>,{' '}
            <code className="bg-stone-100 px-1 rounded text-[10px]">IP2</code>, or{' '}
            <code className="bg-stone-100 px-1 rounded text-[10px]">Admin</code> for other signers.
          </p>
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
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending ? 'Sending...' : 'Send for Signature'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

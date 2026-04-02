import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Send, Loader2, FileText, Download, Plus, Trash2, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from '@/components/ui/select'
import { useRole } from '@/context/RoleContext'
import { createDocument, sendDocument, updateDocument } from '@/lib/esign'
import { supabase } from '@/lib/supabase'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import {
  exportDocAsPdf, getDocPlainText, parseFieldPlaceholders, copyGoogleDoc,
  getOrCreateTemplatesFolder, getDocAsHtml, shareDocPublicly,
} from '@/lib/google'

export default function EditDocumentPage() {
  const { id: googleDocId } = useParams()
  const [searchParams] = useSearchParams()
  const showPreview = searchParams.get('preview') === '1'
  const navigate = useNavigate()
  const { currentUser } = useRole()
  const userId = currentUser?.id

  const [docTitle, setDocTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(showPreview)
  const [previewHtml, setPreviewHtml] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Send dialog
  const [showSend, setShowSend] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendForm, setSendForm] = useState({ caseType: '', caseId: '', signers: [] })
  const [cases, setCases] = useState({ gc: [], ip: [] })

  // PDF download
  const [downloading, setDownloading] = useState(false)

  // Load doc title from Drive and ensure it's shared for embedding
  useEffect(() => {
    if (!googleDocId || !userId) { setLoading(false); return }
    // Share for embedding
    shareDocPublicly(userId, googleDocId).catch(() => {})
    // Get title
    import('@/lib/google').then(({ getAccessToken }) => {
      getAccessToken(userId).then(token => {
        fetch(`https://www.googleapis.com/drive/v3/files/${googleDocId}?fields=name`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json()).then(data => {
          setDocTitle(data.name || 'Untitled')
        }).catch(() => {})
      }).catch(() => {})
    }).finally(() => setLoading(false))

    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake()])
      .then(([gcs, ips]) => setCases({ gc: gcs, ip: ips }))
      .catch(() => {})

    if (showPreview) loadPreview()
  }, [googleDocId, userId])

  async function loadPreview() {
    if (!userId || !googleDocId) return
    setLoadingPreview(true)
    try {
      const html = await getDocAsHtml(userId, googleDocId)
      setPreviewHtml(html)
    } catch (err) {
      setPreviewHtml('<p style="color:red">Failed to load preview: ' + err.message + '</p>')
    }
    setLoadingPreview(false)
  }

  async function togglePreview() {
    if (!preview) {
      await loadPreview()
    }
    setPreview(!preview)
  }

  async function handleDownloadPdf() {
    if (!googleDocId || !userId) return
    setDownloading(true)
    try {
      const blob = await exportDocAsPdf(userId, googleDocId)
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
    if (!googleDocId || !userId || sendForm.signers.length === 0) return
    setSending(true)
    try {
      // 1. Export as PDF and store in Supabase
      let pdfPath = null
      try {
        const pdfBlob = await exportDocAsPdf(userId, googleDocId)
        pdfPath = `documents/sent_${googleDocId}_${Date.now()}.pdf`
        if (supabase) {
          const { error: uploadErr } = await supabase.storage.from('esign-documents').upload(pdfPath, pdfBlob, {
            contentType: 'application/pdf',
            cacheControl: '3600',
          })
          if (uploadErr) { console.error('PDF upload failed:', uploadErr); pdfPath = null }
        }
      } catch (e) { console.error('PDF export failed:', e) }

      // 2. Copy the Google Doc as a frozen "sent" copy
      let sentDocId = null
      try {
        const folderId = await getOrCreateTemplatesFolder(userId)
        const sentCopy = await copyGoogleDoc(userId, googleDocId, `[Sent] ${docTitle} - ${new Date().toLocaleDateString()}`, folderId)
        sentDocId = sentCopy.id
      } catch (e) { console.error('Doc copy failed:', e) }

      // 3. Parse field placeholders
      let fields = []
      try {
        const plainText = await getDocPlainText(userId, googleDocId)
        fields = parseFieldPlaceholders(plainText)
      } catch (e) { console.error('Field parse failed:', e) }

      // 4. Create esign document record (use google doc ID as template reference)
      const doc = await createDocument({
        templateId: null,
        caseId: sendForm.caseId ? Number(sendForm.caseId) : null,
        caseType: sendForm.caseType || null,
        title: docTitle || 'Untitled',
        signers: sendForm.signers,
        filePath: pdfPath || googleDocId,
        createdBy: currentUser.name,
      })

      // Store metadata
      if (doc) {
        await updateDocument(doc.id, {
          document_hash: JSON.stringify({
            googleDocId: sentDocId,
            templateDocId: googleDocId,
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
        <p className="text-stone-400">Loading...</p>
      </div>
    )
  }

  const embedUrl = `https://docs.google.com/document/d/${googleDocId}/edit?embedded=true`
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
            <span className="text-lg font-semibold">{docTitle}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={togglePreview}>
            <Eye className="size-4" /> {preview ? 'Close Preview' : 'Preview'}
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Download PDF
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => window.open(`https://docs.google.com/document/d/${googleDocId}/edit`, '_blank')}>
            Edit in Google Docs
          </Button>
          <Button className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }} onClick={() => setShowSend(true)}>
            <Send className="size-4" /> Send for Signature
          </Button>
        </div>
      </div>

      {/* Content: Preview or Embedded Editor */}
      {preview ? (
        <div className="flex-1 rounded-2xl border shadow-sm overflow-y-auto bg-white">
          {loadingPreview ? (
            <div className="text-center py-12">
              <Loader2 className="size-6 animate-spin text-[#283693] mx-auto mb-2" />
              <p className="text-sm text-stone-400">Loading preview...</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-8 px-4">
              <style>{`
                .gdoc-preview img { max-width: 100%; height: auto; }
                .gdoc-preview table { border-collapse: collapse; width: 100%; }
                .gdoc-preview td, .gdoc-preview th { border: 1px solid #ddd; padding: 6px 10px; }
                .gdoc-preview { font-family: 'Arial', sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a2e; }
              `}</style>
              <div className="gdoc-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 rounded-2xl border shadow-sm overflow-hidden bg-white">
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            title={docTitle}
            allow="clipboard-write"
          />
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

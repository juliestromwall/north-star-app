import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Send, Loader2, FileText, Download, Plus, Trash2, Pencil,
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
  exportDocAsPdf, getDocPlainText, getDocAsHtml, parseFieldPlaceholders,
  shareDocPublicly, getAccessToken, sendEmail,
} from '@/lib/google'

export default function EditDocumentPage() {
  const { templateId: googleDocId } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useRole()
  const userId = currentUser?.id

  const [docTitle, setDocTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [iframeReady, setIframeReady] = useState(false)
  const [shareError, setShareError] = useState(null)

  // Send dialog
  const [showSend, setShowSend] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendForm, setSendForm] = useState({ caseType: '', caseId: '', signers: [] })
  const [cases, setCases] = useState({ gc: [], ip: [] })

  // PDF download
  const [downloading, setDownloading] = useState(false)

  // Load doc info and share for embedding
  useEffect(() => {
    if (!googleDocId || !userId) { setLoading(false); return }

    async function setup() {
      try {
        // Get doc title
        let token
        try {
          token = await getAccessToken(userId)
        } catch (e) {
          setShareError('Google not connected. Go to Settings and reconnect your Google account.')
          setLoading(false)
          return
        }

        const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${googleDocId}?fields=name`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const meta = await metaRes.json()
        if (!metaRes.ok) {
          setShareError(meta.error?.message || 'Could not find this document.')
          setLoading(false)
          return
        }
        setDocTitle(meta.name || 'Untitled')

        // Share the doc so the iframe can load it
        try {
          await shareDocPublicly(userId, googleDocId)
        } catch (e) {
          console.warn('Share failed (may already be shared):', e.message)
        }

        await new Promise(r => setTimeout(r, 1500))
        setIframeReady(true)
      } catch (err) {
        console.error('Setup failed:', err)
        setShareError(err?.message || 'Failed to load document')
      } finally {
        setLoading(false)
      }
    }

    setup()

    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake()])
      .then(([gcs, ips]) => setCases({ gc: gcs, ip: ips }))
      .catch(() => {})
  }, [googleDocId, userId])

  // PDF download
  async function handleDownloadPdf() {
    if (!googleDocId || !userId) return
    const docId = googleDocId
    setDownloading(true)
    try {
      const blob = await exportDocAsPdf(userId, docId)
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

  // Send for Signature
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
      // 1. Export the edited copy as PDF and store in Supabase
      let pdfPath = null
      try {
        const pdfBlob = await exportDocAsPdf(userId, googleDocId)
        pdfPath = `documents/sent_${Date.now()}.pdf`
        if (supabase) {
          try {
            const uploadResult = await supabase.storage.from('esign-documents').upload(pdfPath, pdfBlob, {
              contentType: 'application/pdf',
              cacheControl: '3600',
            })
            if (uploadResult?.error) {
              console.error('PDF upload failed:', uploadResult.error)
              pdfPath = null
            }
          } catch (uploadErr) {
            console.error('PDF upload exception:', uploadErr)
            pdfPath = null
          }
        }
      } catch (e) {
        console.error('PDF export failed:', e)
        pdfPath = null
      }

      // 2. Export as HTML (for inline signing fields) and parse field placeholders
      let docHtml = ''
      let fields = []
      try {
        docHtml = await getDocAsHtml(userId, googleDocId)
        const plainText = await getDocPlainText(userId, googleDocId)
        fields = parseFieldPlaceholders(plainText)
      } catch (e) { console.error('HTML/field export failed:', e) }

      // 3. Store HTML in Supabase storage
      let htmlPath = null
      if (docHtml && supabase) {
        try {
          const htmlBlob = new Blob([docHtml], { type: 'text/html' })
          htmlPath = `documents/sent_${Date.now()}.html`
          const uploadResult = await supabase.storage.from('esign-documents').upload(htmlPath, htmlBlob, {
            contentType: 'text/html',
            cacheControl: '3600',
          })
          if (uploadResult?.error) { console.error('HTML upload failed:', uploadResult.error); htmlPath = null }
        } catch (e) { console.error('HTML upload failed:', e); htmlPath = null }
      }

      // 4. Create esign document record
      const doc = await createDocument({
        templateId: null,
        caseId: sendForm.caseId ? Number(sendForm.caseId) : null,
        caseType: sendForm.caseType || null,
        title: docTitle || 'Untitled',
        signers: sendForm.signers,
        filePath: pdfPath || null,
        createdBy: currentUser.name,
      })

      // Store metadata
      if (doc) {
        await updateDocument(doc.id, {
          document_hash: JSON.stringify({
            templateDocId: googleDocId,
            fields,
            pdfPath,
            htmlPath,
          }),
        })
      }

      // 4. Send
      await sendDocument(doc.id)

      // 5. Email each signer with a link to sign
      const signUrl = `${window.location.origin}/e-signature/${doc.id}`
      for (const signer of sendForm.signers) {
        if (!signer.email) continue
        try {
          await sendEmail(userId, {
            to: signer.email,
            subject: `Please sign: ${docTitle || 'Document'}`,
            body: `
              <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="ABC Surrogacy" style="max-width: 180px;" />
                </div>
                <h2 style="color: #283693; margin-bottom: 8px;">Document Ready for Signature</h2>
                <p>Hi ${signer.name || ''},</p>
                <p><strong>${currentUser?.name || 'ABC Surrogacy'}</strong> has sent you a document to sign:</p>
                <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="font-weight: 600; margin: 0;">${docTitle || 'Document'}</p>
                  <p style="color: #666; font-size: 13px; margin: 4px 0 0;">Role: ${signer.role || 'Signer'}</p>
                </div>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${signUrl}" style="display: inline-block; background: #283693; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                    Review & Sign Document
                  </a>
                </div>
                <p style="color: #888; font-size: 12px; margin-top: 24px;">
                  This is a legally binding electronic signature request from Abundant Beginnings Company, LLC.
                  If you have questions, please contact us at info@abcsurrogacy.com.
                </p>
              </div>
            `,
          })
        } catch (emailErr) {
          console.error('Failed to email signer:', signer.email, emailErr)
        }
      }

      navigate('/e-signature')
    } catch (err) {
      alert('Failed to send: ' + (err.message || 'Unknown error'))
    } finally { setSending(false) }
  }

  // Render
  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="size-8 animate-spin text-[#283693] mx-auto mb-3" />
        <p className="text-stone-400">Preparing document...</p>
      </div>
    )
  }

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
          <Button variant="outline" className="gap-1.5" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Download PDF
          </Button>
          <Button className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }} onClick={() => setShowSend(true)}>
            <Send className="size-4" /> Send for Signature
          </Button>
        </div>
      </div>

      {/* Document Preview */}
      <div className="flex-1 rounded-2xl border shadow-sm overflow-hidden bg-white flex flex-col">
        {shareError ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
            <FileText className="size-12 text-red-300 mb-4" />
            <p className="text-red-600 font-medium mb-2">Failed to load document</p>
            <p className="text-sm text-stone-500 mb-4">{shareError}</p>
          </div>
        ) : !iframeReady ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="size-6 animate-spin text-[#283693]" />
          </div>
        ) : (
          <iframe
            src={`https://docs.google.com/document/d/${googleDocId}/edit`}
            className="w-full flex-1 border-0"
            title={docTitle}
          />
        )}
      </div>

      {/* Signing fields help */}
      <div className="mt-2 px-1 shrink-0">
        <p className="text-[11px] text-stone-400">
          <span className="font-semibold">Signing fields:</span>{' '}
          <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Signature:GC}}'}</code>{' '}
          <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Name:GC}}'}</code>{' '}
          <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Date:GC}}'}</code>{' '}
          <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Email:GC}}'}</code>{' '}
          <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Text:GC}}'}</code>{' '}
          — Replace GC with IP1, IP2, or Admin
        </p>
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
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending ? 'Sending...' : 'Send for Signature'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

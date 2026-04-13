import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
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
import { fetchMatchedJourney } from '@/lib/matching'
import { getAdminStaff } from '@/data/mock/users'
import {
  exportDocAsPdf, getDocPlainText, getDocAsHtml, parseFieldPlaceholders,
  shareDocPublicly, getAccessToken, sendEmail, copyGoogleDoc,
  getOrCreateDraftsFolder, deleteGoogleDriveFile,
} from '@/lib/google'

export default function EditDocumentPage() {
  const { templateId: googleDocId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { currentUser } = useRole()
  const userId = currentUser?.id

  const prefillCaseType = searchParams.get('caseType') || ''
  const prefillCaseId = searchParams.get('caseId') || ''
  const prefillJourneyId = searchParams.get('journeyId') || ''

  const adminUsers = getAdminStaff()

  const [docTitle, setDocTitle] = useState('')
  const [workingDocId, setWorkingDocId] = useState(null) // copy of template for editing
  const [loading, setLoading] = useState(true)
  const [iframeReady, setIframeReady] = useState(false)
  const [shareError, setShareError] = useState(null)

  // Send dialog
  const [showSend, setShowSend] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendForm, setSendForm] = useState({ caseType: prefillCaseType, caseId: prefillCaseId, signers: [], note: '' })
  const [cases, setCases] = useState({ gc: [], ip: [] })
  const [caseSearch, setCaseSearch] = useState('')
  const [caseDropdownOpen, setCaseDropdownOpen] = useState(false)
  const [requiredRoles, setRequiredRoles] = useState([]) // roles detected from doc placeholders
  const [loadingRoles, setLoadingRoles] = useState(false)

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

        // Copy the template into ABC Drafts folder so edits don't affect the original
        let editDocId = googleDocId
        try {
          const draftsFolderId = await getOrCreateDraftsFolder(userId)
          const copy = await copyGoogleDoc(userId, googleDocId, `[Draft] ${meta.name || 'Document'}`, draftsFolderId)
          if (copy?.id) editDocId = copy.id
        } catch (e) {
          console.warn('Copy failed, editing original:', e.message)
        }
        setWorkingDocId(editDocId)

        // Share the working copy so the iframe can load it
        try {
          await shareDocPublicly(userId, editDocId)
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
      .then(async ([gcs, ips]) => {
        setCases({ gc: gcs, ip: ips })
        // Auto-populate from journey if journeyId is present
        if (prefillJourneyId) {
          try {
            const journey = await fetchMatchedJourney(Number(prefillJourneyId))
            if (journey) {
              const gc = gcs.find(x => x.id === journey.gc_case_id)
              const ip = ips.find(x => x.id === journey.ip_case_id)
              const signers = []
              if (gc) signers.push({ role: 'Surrogate', name: gc.name || '', email: gc.email || '', status: 'pending' })
              if (gc?.partnerName) signers.push({ role: 'Partner', name: gc.partnerName, email: gc.partnerEmail || '', status: 'pending' })
              if (ip) {
                signers.push({ role: 'Intended Parent 1', name: ip.ip1Name || ip.names || '', email: ip.email || '', status: 'pending' })
                if (ip.ip2Name) signers.push({ role: 'Intended Parent 2', name: ip.ip2Name, email: ip.ip2Email || '', status: 'pending' })
              }
              setSendForm(prev => ({ ...prev, caseType: 'gc', caseId: String(journey.gc_case_id), signers }))
              setCaseSearch(gc?.name || '')
            }
          } catch (e) { console.error('Journey prefill failed:', e) }
        } else if (prefillCaseType && prefillCaseId) {
          // Prefill directly from fetched data (not state, which hasn't updated yet)
          const list = prefillCaseType === 'ip' ? ips : gcs
          const c = list.find(x => x.id === Number(prefillCaseId))
          if (c) {
            // Detect which roles the document requires
            let docRoles = []
            try {
              const editId = workingDocId || googleDocId
              if (editId) {
                const plainText = await getDocPlainText(userId, editId)
                const fields = parseFieldPlaceholders(plainText)
                const roleMap = { gc: 'Surrogate', ip1: 'Intended Parent 1', ip2: 'Intended Parent 2', admin: 'Admin', partner: 'Partner', parnter: 'Partner' }
                docRoles = [...new Set(fields.map(f => roleMap[f.role] || f.role))]
                setRequiredRoles(docRoles)
              }
            } catch {}

            const signers = []
            if (prefillCaseType === 'gc') {
              signers.push({ role: 'Surrogate', name: c.name || '', email: c.email || '', status: 'pending' })
              // Only add partner if the document has partner fields
              if (docRoles.includes('Partner')) {
                const confid = c.answers?._confidential || {}
                const partnerName = confid.spouseFullName || c.partnerName || ''
                const partnerEmail = confid.spouseEmail || c.partnerEmail || ''
                if (partnerName) signers.push({ role: 'Partner', name: partnerName, email: partnerEmail, status: 'pending' })
              }
            } else {
              signers.push({ role: 'Intended Parent 1', name: c.ip1Name || c.names || '', email: c.email || '', status: 'pending' })
              if (c.ip2Name && docRoles.includes('Intended Parent 2')) {
                signers.push({ role: 'Intended Parent 2', name: c.ip2Name, email: c.ip2Email || '', status: 'pending' })
              }
            }
            setSendForm(prev => ({ ...prev, caseType: prefillCaseType, caseId: prefillCaseId, signers }))
            setCaseSearch(c.names || c.name || '')
          }
        }
      })
      .catch(() => {})
  }, [googleDocId, userId])

  // PDF download
  async function handleDownloadPdf() {
    if (!userId) return
    const docId = workingDocId || googleDocId
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
      // Auto-fill name + email when role is selected
      if (key === 'role') {
        const caseList = prev.caseType === 'ip' ? cases.ip : cases.gc
        const selectedCase = caseList?.find(x => x.id === Number(prev.caseId))
        if (val === 'Partner' && selectedCase) {
          const confid = selectedCase.answers?._confidential || {}
          signers[idx].name = confid.spouseFullName || selectedCase.partnerName || selectedCase.answers?.spouseFullName || ''
          signers[idx].email = confid.spouseEmail || selectedCase.partnerEmail || selectedCase.answers?.spouseEmail || ''
        } else if (val === 'Surrogate' && selectedCase && prev.caseType === 'gc') {
          signers[idx].name = selectedCase.name || ''
          signers[idx].email = selectedCase.email || ''
        } else if (val === 'Intended Parent 1' && selectedCase && prev.caseType === 'ip') {
          signers[idx].name = selectedCase.ip1Name || selectedCase.names || ''
          signers[idx].email = selectedCase.email || ''
        } else if (val === 'Intended Parent 2' && selectedCase && prev.caseType === 'ip') {
          signers[idx].name = selectedCase.ip2Name || ''
          signers[idx].email = selectedCase.ip2Email || ''
        }
      }
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
    const hasPartnerRole = requiredRoles.includes('Partner')
    if (caseType === 'gc') {
      signers.push({ role: 'Surrogate', name: c.name || '', email: c.email || '', status: 'pending' })
      if (hasPartnerRole) {
        const confid = c.answers?._confidential || {}
        const partnerName = confid.spouseFullName || c.partnerName || ''
        const partnerEmail = confid.spouseEmail || c.partnerEmail || ''
        if (partnerName) signers.push({ role: 'Partner', name: partnerName, email: partnerEmail, status: 'pending' })
      }
    } else {
      signers.push({ role: 'Intended Parent 1', name: c.ip1Name || c.names || '', email: c.email || '', status: 'pending' })
      if (c.ip2Name) signers.push({ role: 'Intended Parent 2', name: c.ip2Name, email: c.ip2Email || '', status: 'pending' })
    }
    setSendForm(prev => ({ ...prev, signers }))
  }

  async function handleSend() {
    const editDocId = workingDocId || googleDocId
    if (!editDocId || !userId || sendForm.signers.length === 0) return
    setSending(true)
    try {
      // 1. Export the edited copy as PDF and store in Supabase
      let pdfPath = null
      try {
        const pdfBlob = await exportDocAsPdf(userId, editDocId)
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
        docHtml = await getDocAsHtml(userId, editDocId)
        const plainText = await getDocPlainText(userId, editDocId)
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
            templateDocId: googleDocId, // original template
            workingDocId: editDocId, // edited copy
            adminUserId: userId,
            fields,
            pdfPath,
            htmlPath,
          }),
        })
      }

      // 4. Send
      await sendDocument(doc.id)

      // 5. Email each signer with a secure token link
      const signUrl = doc.signing_token
        ? `${window.location.origin}/e-signature/sign/${doc.signing_token}`
        : `${window.location.origin}/e-signature/${doc.id}`
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
                  ${sendForm.note ? `<p style="color: #444; font-size: 13px; margin: 8px 0 0; white-space: pre-line;">${sendForm.note}</p>` : ''}
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

      // Don't delete draft copy yet — it's needed for signed PDF generation
      // It will stay in ABC Drafts folder until signing is complete
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
          <Button className="gap-1.5" style={{ backgroundColor: '#283693', color: '#fff' }} onClick={async () => {
            setShowSend(true)
            if (requiredRoles.length === 0 && (workingDocId || googleDocId) && userId) {
              setLoadingRoles(true)
              try {
                const plainText = await getDocPlainText(userId, workingDocId || googleDocId)
                const fields = parseFieldPlaceholders(plainText)
                const roleMap = { gc: 'Surrogate', ip1: 'Intended Parent 1', ip2: 'Intended Parent 2', admin: 'Admin', partner: 'Partner', parnter: 'Partner' }
                const roles = [...new Set(fields.map(f => roleMap[f.role] || f.role))]
                setRequiredRoles(roles)
              } catch (e) { console.error('Failed to detect roles:', e) }
              setLoadingRoles(false)
            }
          }}>
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
            src={`https://docs.google.com/document/d/${workingDocId || googleDocId}/edit`}
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
          <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Initials:GC}}'}</code>{' '}
          <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Text:GC}}'}</code>{' '}
          <code className="bg-stone-100 px-1 rounded text-[10px]">{'{{Checkbox:GC}}'}</code>{' '}
          — Replace GC with IP1, IP2, Partner, or Admin
        </p>
      </div>

      {/* Send Dialog */}
      <Dialog open={showSend} onOpenChange={v => { setShowSend(v); if (!v) { setCaseSearch(''); setCaseDropdownOpen(false) } }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Send "{docTitle}" for Signature</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Case Type</Label>
                <SelectUI value={sendForm.caseType} onValueChange={v => { setSendForm(prev => ({ ...prev, caseType: v, caseId: '' })); setCaseSearch(''); }}>
                  <SelectTriggerUI><SelectValueUI placeholder="Select..." /></SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="gc">Surrogate (GC)</SelectItemUI>
                    <SelectItemUI value="ip">Intended Parent (IP)</SelectItemUI>
                  </SelectContentUI>
                </SelectUI>
              </div>
              <div className="space-y-1 relative">
                <Label className="text-xs">Case</Label>
                <Input
                  placeholder={sendForm.caseType ? 'Search by name...' : 'Select case type first'}
                  value={caseSearch}
                  onChange={e => { setCaseSearch(e.target.value); setCaseDropdownOpen(true) }}
                  onFocus={() => sendForm.caseType && setCaseDropdownOpen(true)}
                  disabled={!sendForm.caseType}
                  className="text-sm"
                />
                {caseDropdownOpen && caseOptions.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                    {caseOptions
                      .filter(c => {
                        if (!caseSearch.trim()) return true
                        const q = caseSearch.toLowerCase()
                        return (c.names || c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
                      })
                      .map(c => (
                        <button key={c.id} type="button" className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-stone-50 text-left border-b last:border-0"
                          onClick={() => { handleCaseSelect(sendForm.caseType, String(c.id)); setCaseSearch(c.names || c.name || ''); setCaseDropdownOpen(false) }}>
                          <div className="w-7 h-7 rounded-full bg-[#283693]/10 text-[#283693] flex items-center justify-center text-[11px] font-bold shrink-0">
                            {(c.names || c.name || '?').charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{c.names || c.name}</p>
                            <p className="text-xs text-stone-400 truncate">{c.email || 'No email'}{c.assignedTo ? ` · ${c.assignedTo}` : ''}</p>
                          </div>
                        </button>
                      ))}
                    {caseOptions.filter(c => {
                      if (!caseSearch.trim()) return true
                      const q = caseSearch.toLowerCase()
                      return (c.names || c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
                    }).length === 0 && (
                      <p className="text-xs text-stone-400 text-center py-3">No cases match "{caseSearch}"</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Required roles from document */}
            {loadingRoles ? (
              <div className="flex items-center gap-2 text-xs text-stone-400"><Loader2 className="size-3 animate-spin" /> Detecting required signers...</div>
            ) : requiredRoles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs font-semibold text-stone-500 mr-1">Required:</span>
                {requiredRoles.map(role => {
                  const hasIt = sendForm.signers.some(s => s.role === role)
                  return (
                    <span key={role} className={`text-xs px-2 py-0.5 rounded-full font-medium ${hasIt ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                      {hasIt ? '✓' : '✗'} {role}
                    </span>
                  )
                })}
              </div>
            )}

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
                    <SelectUI value={s.role} onValueChange={v => updateSigner(i, 'role', v)}>
                      <SelectTriggerUI className="text-xs h-8"><SelectValueUI placeholder="Role..." /></SelectTriggerUI>
                      <SelectContentUI>
                        <SelectItemUI value="Surrogate">Surrogate</SelectItemUI>
                        <SelectItemUI value="Partner">Partner</SelectItemUI>
                        <SelectItemUI value="Intended Parent 1">Intended Parent 1</SelectItemUI>
                        <SelectItemUI value="Intended Parent 2">Intended Parent 2</SelectItemUI>
                        <SelectItemUI value="Admin">Admin</SelectItemUI>
                      </SelectContentUI>
                    </SelectUI>
                    {s.role === 'Admin' ? (
                      <SelectUI value={s.email || ''} onValueChange={v => {
                        const admin = adminUsers.find(a => a.email === v)
                        if (admin) { updateSigner(i, 'name', admin.name); updateSigner(i, 'email', admin.email) }
                      }}>
                        <SelectTriggerUI className="text-xs h-8 col-span-2"><SelectValueUI placeholder="Select admin..." /></SelectTriggerUI>
                        <SelectContentUI>
                          {adminUsers.map(a => (
                            <SelectItemUI key={a.id} value={a.email}>{a.name} — {a.email}</SelectItemUI>
                          ))}
                        </SelectContentUI>
                      </SelectUI>
                    ) : (
                      <>
                        <Input placeholder="Name" value={s.name} onChange={e => updateSigner(i, 'name', e.target.value)} className="text-xs h-8" />
                        <Input placeholder="Email" type="email" value={s.email} onChange={e => updateSigner(i, 'email', e.target.value)} className="text-xs h-8" />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Note to Signer (optional)</Label>
              <textarea
                value={sendForm.note}
                onChange={e => setSendForm(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Add a personal note that will appear in the email..."
                rows={3}
                className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            {(() => {
              const missingRoles = requiredRoles.filter(role => !sendForm.signers.some(s => s.role === role))
              const missingEmails = sendForm.signers.filter(s => !s.email?.trim())
              return missingRoles.length > 0 ? (
                <p className="text-xs text-red-500">Missing signers: {missingRoles.join(', ')}</p>
              ) : missingEmails.length > 0 ? (
                <p className="text-xs text-red-500">All signers must have an email address.</p>
              ) : null
            })()}

            <Button onClick={handleSend} disabled={sending || sendForm.signers.length === 0 || requiredRoles.some(role => !sendForm.signers.some(s => s.role === role)) || sendForm.signers.some(s => !s.email?.trim())}
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

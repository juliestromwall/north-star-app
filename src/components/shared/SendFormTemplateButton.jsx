import { useState, useEffect } from 'react'
import { FileSignature, Loader2, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { useRole } from '@/context/RoleContext'
import { FORM_TEMPLATES } from '@/lib/formTemplates'
import { supabase } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/authHeaders'

async function sendEsignEmail({ signerName, signerEmail, formTitle, formToken, senderName, senderEmail }) {
  const formUrl = `${window.location.origin}/e-signature/form/${formToken}`
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' })
    const res = await fetch('/api/send-esign-email', {
      method: 'POST',
      headers,
      body: JSON.stringify({ signerName, signerEmail, formTitle, formUrl, senderName, senderEmail }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.success === false) {
      console.error('E-sign email failed:', data)
      return { success: false, error: data.error || data.message || `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (err) {
    console.error('E-sign email failed:', err)
    return { success: false, error: err.message }
  }
}

export default function SendFormTemplateButton({ templateId, surrogate, partnerName, partnerEmail, adminName, adminEmail }) {
  const [sending, setSending] = useState(false)
  const [resending, setResending] = useState(false)
  const [result, setResult] = useState(null)
  const [existingDoc, setExistingDoc] = useState(null) // { status, formToken, signedAt }
  const [checking, setChecking] = useState(true)
  // Admin pre-fill dialog: opens BEFORE send when the template has adminFields
  // (e.g. Kaiser PHI release wants admin to enter the Step 1 date range).
  const [adminDialogOpen, setAdminDialogOpen] = useState(false)
  const [adminFieldValues, setAdminFieldValues] = useState({})
  const [adminDialogError, setAdminDialogError] = useState(null)
  const { currentUser } = useRole()

  const template = FORM_TEMPLATES[templateId]

  // Check if this form was already sent/signed for this case
  useEffect(() => {
    if (!template || !surrogate?.id || !supabase) { setChecking(false); return }
    supabase.from('esign_documents')
      .select('id, status, document_hash, signers, completed_at')
      .eq('case_id', surrogate.id)
      .then(({ data }) => {
        const match = (data || []).find(d => {
          try {
            const meta = JSON.parse(d.document_hash || '{}')
            return meta.templateId === templateId
          } catch { return false }
        })
        if (match) {
          try {
            const meta = JSON.parse(match.document_hash || '{}')
            const signer = (match.signers || [])[0]
            setExistingDoc({
              status: match.status,
              formToken: meta.formToken,
              signedAt: signer?.signedAt || match.completed_at || null,
            })
          } catch {
            setExistingDoc({ status: match.status })
          }
        }
      })
      .finally(() => setChecking(false))
  }, [surrogate?.id, templateId])

  if (!template) return null

  const isPartner = template.signerRole === 'partner'
  const isAdmin = template.signerRole === 'admin'
  const signerName = isAdmin ? (adminName || 'Agency Representative')
    : isPartner ? (partnerName || 'Partner')
    : (surrogate?.name || '')
  const signerEmail = isAdmin ? (adminEmail || '')
    : isPartner ? (partnerEmail || '')
    : (surrogate?.email || '')

  // Already signed (status can be 'signed', 'completed', or 'partially_signed' if multi-signer)
  const signedStatuses = ['signed', 'completed', 'partially_signed']
  if (existingDoc && signedStatuses.includes(existingDoc.status)) {
    const signedDate = existingDoc.signedAt
      ? new Date(existingDoc.signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null
    return (
      <div className="flex items-center gap-2 text-xs py-1">
        <CheckCircle2 className="size-4 text-green-500 shrink-0" />
        <span className="text-green-700 font-medium">
          {template.title} — Signed{signedDate ? ` on ${signedDate}` : ''}
        </span>
      </div>
    )
  }

  // Already sent, pending — show resend button
  if (existingDoc?.status === 'pending') {
    return (
      <div className="flex items-center gap-2 text-xs py-1">
        <Clock className="size-4 text-amber-500 shrink-0" />
        <span className="text-amber-700 font-medium">{template.title} — Pending</span>
        <button
          onClick={async () => {
            if (!existingDoc.formToken || !signerEmail) return
            setResending(true)
            const emailRes = await sendEsignEmail({
              signerName, signerEmail,
              formTitle: template.title,
              formToken: existingDoc.formToken,
              senderName: currentUser?.name,
              senderEmail: currentUser?.email,
            })
            setResending(false)
            if (emailRes.success) {
              setResult({ resent: true })
              setTimeout(() => setResult(null), 3000)
            } else {
              alert(`Resend failed: ${emailRes.error}`)
            }
          }}
          disabled={resending}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-[#1A3638] hover:underline ml-1"
        >
          {resending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          {resending ? 'Sending...' : 'Resend'}
        </button>
        {result?.resent && <span className="text-[10px] text-green-600 font-medium">Sent!</span>}
      </div>
    )
  }

  // Resolve the full signer list for this template. For multi-signer templates
  // (partnered releases, HIPAA with admin countersign), walk signerRoles and
  // map each role to name/email from the surrounding props.
  function resolveSigners() {
    if (template.multiSigner) {
      const roles = template.signerRoles || ['gc', 'partner']
      return roles.map(role => {
        if (role === 'gc') return { role, name: surrogate?.name || '', email: surrogate?.email || '', status: 'pending' }
        if (role === 'partner') return { role, name: partnerName || '', email: partnerEmail || '', status: 'pending' }
        if (role === 'admin') return { role, name: adminName || 'Agency Representative', email: adminEmail || '', status: 'pending' }
        return { role, name: '', email: '', status: 'pending' }
      })
    }
    return [{ role: template.signerRole, name: signerName, email: signerEmail, status: 'pending' }]
  }

  // Intercept Send when the template defines adminFields (e.g. Kaiser Step 1 date range).
  // Opens the dialog first; the dialog's submit then calls actuallySend().
  function handleSendClick() {
    if ((template.adminFields || []).length > 0) {
      // Pre-fill from any saved values on the existing pending doc, otherwise blank
      setAdminFieldValues(prev => Object.keys(prev).length ? prev : Object.fromEntries((template.adminFields || []).map(f => [f.id, ''])))
      setAdminDialogOpen(true)
      return
    }
    actuallySend()
  }

  async function actuallySend() {
    return handleSend()
  }

  async function handleSend() {
    if (!signerEmail) {
      alert(
        isAdmin ? 'This case has no assigned admin yet. Assign one in the surrogate header before sending.' :
        isPartner ? 'Partner email is required. Please add it in the Confidential section.' :
        'Surrogate email is missing.'
      )
      return
    }

    if (template.multiSigner) {
      const signers = resolveSigners()
      const missing = signers.find(s => !s.email)
      if (missing) {
        const lbl = missing.role === 'admin' ? 'Assigned admin email'
          : missing.role === 'partner' ? 'Partner email'
          : 'Surrogate email'
        alert(`${lbl} is required for this release. Please add it before sending.`)
        return
      }
    }

    setSending(true)
    setResult(null)
    try {
      const { createDocument, sendDocument, updateDocument } = await import('@/lib/esign')

      const formToken = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')

      const signers = resolveSigners()

      const isReleaseForm = template.layoutMode === 'doc-first' || template.layoutMode === 'pdf-overlay'
      const docTitle = isReleaseForm
        ? (template.multiSigner
            ? `${template.title} - ${surrogate?.name || ''}`
            : `${template.title} - ${signerName}`)
        : `Background Check Release Form - ${signerName}`

      const doc = await createDocument({
        templateId: null,
        caseId: surrogate.id,
        caseType: 'surrogate',
        title: docTitle,
        signers,
        filePath: null,
        createdBy: currentUser?.name || 'Admin',
      })

      // Bake admin pre-fill values into the doc metadata so the signer
      // sees them already on the PDF (e.g. Kaiser Step 1 date range).
      await updateDocument(doc.id, {
        document_hash: JSON.stringify({
          formToken,
          templateId: template.id,
          ...(Object.keys(adminFieldValues).length > 0 ? { adminValues: adminFieldValues } : {}),
        }),
      })

      await sendDocument(doc.id)

      // Send email(s). For multi-signer templates, every signer gets a link
      // to the same form — SignFormPage role-filters which slots they see.
      const emailRecipients = signers.map(s => ({ name: s.name, email: s.email }))

      for (const recipient of emailRecipients) {
        if (!recipient.email) continue
        const emailRes = await sendEsignEmail({
          signerName: recipient.name, signerEmail: recipient.email,
          formTitle: docTitle,
          formToken,
          senderName: currentUser?.name,
          senderEmail: currentUser?.email,
        })
        if (!emailRes.success) {
          setExistingDoc({ status: 'pending', formToken })
          setResult({ error: `Document created but email to ${recipient.email} failed: ${emailRes.error}` })
          return
        }
      }

      setExistingDoc({ status: 'pending', formToken })
      setResult({ success: true })
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setSending(false)
    }
  }

  if (result?.success) {
    return (
      <div className="flex items-center gap-2 text-xs py-1">
        <Clock className="size-4 text-amber-500 shrink-0" />
        <span className="text-amber-700 font-medium">{template.title} — Sent, pending signature</span>
      </div>
    )
  }

  if (result?.error) {
    return (
      <div className="flex flex-col gap-1 text-xs py-1">
        <span className="text-red-600 font-medium">⚠ {result.error}</span>
        <button onClick={() => setResult(null)} className="text-[#1A3638] hover:underline text-[10px] self-start">Try again</button>
      </div>
    )
  }

  if (checking) return null

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleSendClick}
        disabled={sending}
        className="gap-1.5 text-xs h-7"
      >
        {sending ? <Loader2 className="size-3 animate-spin" /> : <FileSignature className="size-3" />}
        {sending ? 'Sending...' : `Send ${template.title}`}
      </Button>

      {/* Admin pre-fill dialog (e.g. Kaiser Step 1 date range) */}
      <Dialog open={adminDialogOpen} onOpenChange={(v) => !sending && setAdminDialogOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send {template.title}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-stone-500">
            Fill in the fields below — they get pre-printed onto the PDF before it goes to the surrogate.
          </p>
          <div className="space-y-3">
            {(template.adminFields || []).map(f => (
              <div key={f.id} className="space-y-1">
                <label className="text-xs font-medium text-stone-600">{f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}</label>
                <Input
                  value={adminFieldValues[f.id] || ''}
                  onChange={(e) => { setAdminFieldValues(prev => ({ ...prev, [f.id]: e.target.value })); setAdminDialogError(null) }}
                  placeholder={f.placeholder || ''}
                  className="h-9"
                />
              </div>
            ))}
          </div>
          {adminDialogError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <span className="flex-1">{adminDialogError}</span>
              <button onClick={() => setAdminDialogError(null)} className="text-red-500 hover:text-red-700 font-semibold">&times;</button>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button
              size="sm"
              onClick={async () => {
                // Validate required adminFields
                const missing = (template.adminFields || []).filter(f => f.required && !(adminFieldValues[f.id] || '').trim())
                if (missing.length > 0) {
                  setAdminDialogError('Please fill in: ' + missing.map(f => f.label).join(', '))
                  return
                }
                setAdminDialogError(null)
                setAdminDialogOpen(false)
                await actuallySend()
              }}
              disabled={sending}
              className="gap-1.5"
              style={{ backgroundColor: '#1A3638' }}
            >
              {sending ? <Loader2 className="size-3 animate-spin" /> : <FileSignature className="size-3" />}
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

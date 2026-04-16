import { useState, useEffect } from 'react'
import { FileSignature, Loader2, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/context/RoleContext'
import { FORM_TEMPLATES } from '@/lib/formTemplates'
import { supabase } from '@/lib/supabase'

async function sendEsignEmail({ signerName, signerEmail, formTitle, formToken }) {
  const formUrl = `${window.location.origin}/e-signature/form/${formToken}`
  try {
    const res = await fetch('/api/send-esign-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signerName, signerEmail, formTitle, formUrl }),
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

export default function SendFormTemplateButton({ templateId, surrogate, partnerName, partnerEmail }) {
  const [sending, setSending] = useState(false)
  const [resending, setResending] = useState(false)
  const [result, setResult] = useState(null)
  const [existingDoc, setExistingDoc] = useState(null) // { status, formToken, signedAt }
  const [checking, setChecking] = useState(true)
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
  const signerName = isPartner ? (partnerName || 'Partner') : (surrogate?.name || '')
  const signerEmail = isPartner ? (partnerEmail || '') : (surrogate?.email || '')

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
            const emailRes = await sendEsignEmail({ signerName, signerEmail, formTitle: template.title, formToken: existingDoc.formToken })
            setResending(false)
            if (emailRes.success) {
              setResult({ resent: true })
              setTimeout(() => setResult(null), 3000)
            } else {
              alert(`Resend failed: ${emailRes.error}`)
            }
          }}
          disabled={resending}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-[#283693] hover:underline ml-1"
        >
          {resending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          {resending ? 'Sending...' : 'Resend'}
        </button>
        {result?.resent && <span className="text-[10px] text-green-600 font-medium">Sent!</span>}
      </div>
    )
  }

  async function handleSend() {
    if (!signerEmail) {
      alert(isPartner ? 'Partner email is required. Please add it in the Confidential section.' : 'Surrogate email is missing.')
      return
    }

    setSending(true)
    setResult(null)
    try {
      const { createDocument, sendDocument, updateDocument } = await import('@/lib/esign')

      const formToken = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')

      const docTitle = `Background Check Release Form - ${signerName}`

      const doc = await createDocument({
        templateId: null,
        caseId: surrogate.id,
        caseType: 'surrogate',
        title: docTitle,
        signers: [{ role: template.signerRole, name: signerName, email: signerEmail, status: 'pending' }],
        filePath: null,
        createdBy: currentUser?.name || 'Admin',
      })

      await updateDocument(doc.id, {
        document_hash: JSON.stringify({
          formToken,
          templateId: template.id,
        }),
      })

      await sendDocument(doc.id)

      // Send the actual email
      const emailRes = await sendEsignEmail({ signerName, signerEmail, formTitle: docTitle, formToken })
      if (!emailRes.success) {
        setExistingDoc({ status: 'pending', formToken })
        setResult({ error: `Document created but email failed: ${emailRes.error}` })
        return
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
        <button onClick={() => setResult(null)} className="text-[#283693] hover:underline text-[10px] self-start">Try again</button>
      </div>
    )
  }

  if (checking) return null

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleSend}
      disabled={sending}
      className="gap-1.5 text-xs h-7"
    >
      {sending ? <Loader2 className="size-3 animate-spin" /> : <FileSignature className="size-3" />}
      {sending ? 'Sending...' : `Send ${template.title}`}
    </Button>
  )
}

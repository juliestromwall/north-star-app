import { useState, useEffect } from 'react'
import { FileSignature, Loader2, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/context/RoleContext'
import { FORM_TEMPLATES } from '@/lib/formTemplates'
import { supabase } from '@/lib/supabase'

export default function SendFormTemplateButton({ templateId, surrogate, partnerName, partnerEmail }) {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [existingDoc, setExistingDoc] = useState(null) // { status: 'pending' | 'signed' }
  const [checking, setChecking] = useState(true)
  const { currentUser } = useRole()

  const template = FORM_TEMPLATES[templateId]

  // Check if this form was already sent/signed for this case
  useEffect(() => {
    if (!template || !surrogate?.id || !supabase) { setChecking(false); return }
    supabase.from('esign_documents')
      .select('id, status, document_hash')
      .eq('case_id', surrogate.id)
      .then(({ data }) => {
        const match = (data || []).find(d => {
          try {
            const meta = JSON.parse(d.document_hash || '{}')
            return meta.templateId === templateId
          } catch { return false }
        })
        if (match) setExistingDoc({ status: match.status })
      })
      .finally(() => setChecking(false))
  }, [surrogate?.id, templateId])

  if (!template) return null

  const isPartner = template.signerRole === 'partner'
  const signerName = isPartner ? (partnerName || 'Partner') : (surrogate?.name || '')
  const signerEmail = isPartner ? (partnerEmail || '') : (surrogate?.email || '')

  // Already signed
  if (existingDoc?.status === 'signed') {
    return (
      <div className="flex items-center gap-2 text-xs py-1">
        <CheckCircle2 className="size-4 text-green-500 shrink-0" />
        <span className="text-green-700 font-medium">{template.title} — Signed</span>
      </div>
    )
  }

  // Already sent, pending
  if (existingDoc?.status === 'pending') {
    return (
      <div className="flex items-center gap-2 text-xs py-1">
        <Clock className="size-4 text-amber-500 shrink-0" />
        <span className="text-amber-700 font-medium">{template.title} — Pending signature</span>
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

      const doc = await createDocument({
        templateId: null,
        caseId: surrogate.id,
        caseType: 'surrogate',
        title: template.title,
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

      setExistingDoc({ status: 'pending' })
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

import { useState } from 'react'
import { FileSignature, Loader2, CheckCircle2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/context/RoleContext'
import { FORM_TEMPLATES } from '@/lib/formTemplates'

export default function SendFormTemplateButton({ templateId, surrogate, partnerName, partnerEmail }) {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const { currentUser } = useRole()

  const template = FORM_TEMPLATES[templateId]
  if (!template) return null

  // Determine signer based on template role
  const isPartner = template.signerRole === 'partner'
  const signerName = isPartner ? (partnerName || 'Partner') : (surrogate?.name || '')
  const signerEmail = isPartner ? (partnerEmail || '') : (surrogate?.email || '')

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

      const link = `${window.location.origin}/e-signature/form/${formToken}`
      setResult({ success: true, link })
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setSending(false)
    }
  }

  if (result?.success) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <CheckCircle2 className="size-4 text-green-500" />
        <span className="text-green-700 font-medium">Sent to {signerEmail}</span>
        <button onClick={() => { navigator.clipboard.writeText(result.link); }} className="text-[#283693] hover:underline text-[10px]">Copy link</button>
      </div>
    )
  }

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

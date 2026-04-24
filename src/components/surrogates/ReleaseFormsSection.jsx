import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Shield, Send, Loader2, CheckCircle2, Clock, RefreshCw, AlertCircle } from 'lucide-react'
import { FORM_TEMPLATES } from '@/lib/formTemplates'
import { supabase } from '@/lib/supabase'
import { useRole } from '@/context/RoleContext'
import { sendReleaseFormsBatch } from '@/lib/releaseFormBatch'

/**
 * Resolve which templates to offer based on marital status, in display order.
 */
function resolveTemplateRows({ hasPartner }) {
  const rows = []
  // Background Check
  rows.push({ section: 'Background Check', templateId: 'gc_background_waiver' })
  if (hasPartner) rows.push({ section: 'Background Check', templateId: 'partner_background_waiver' })
  // HIPAA
  rows.push({ section: 'HIPAA', templateId: 'release_hipaa' })
  // General Psych
  rows.push({
    section: 'General Psych Release',
    templateId: hasPartner ? 'release_general_psych_partnered_gc' : 'release_general_psych_single_gc',
  })
  // Ellen Winters
  rows.push({
    section: 'Ellen Winters Psych Release',
    templateId: hasPartner ? 'release_ellen_winters_partnered_gc' : 'release_ellen_winters_single_gc',
  })
  return rows
}

async function sendSingleResendEmail({ formToken, formTitle, recipientName, recipientEmail, senderName, senderEmail }) {
  const formUrl = `${window.location.origin}/e-signature/form/${formToken}`
  const res = await fetch('/api/send-esign-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signerName: recipientName,
      signerEmail: recipientEmail,
      formTitle,
      formUrl,
      senderName,
      senderEmail,
    }),
  })
  const data = await res.json().catch(() => ({}))
  return { success: res.ok && data.success !== false, error: data.error }
}

export default function ReleaseFormsSection({ surrogate, hasPartner, partnerName, partnerEmail, adminName, adminEmail }) {
  const { currentUser } = useRole()
  const [existingDocs, setExistingDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(() => new Set())
  const [sending, setSending] = useState(false)
  const [resending, setResending] = useState(() => new Set()) // templateIds mid-resend
  const [result, setResult] = useState(null) // { type: 'success'|'error', msg }

  const rows = useMemo(() => resolveTemplateRows({ hasPartner }), [hasPartner])

  const refetch = useCallback(() => {
    if (!surrogate?.id || !supabase) { setLoading(false); return }
    setLoading(true)
    supabase.from('esign_documents')
      .select('id, status, document_hash, signers, completed_at, created_at')
      .eq('case_id', surrogate.id)
      .then(({ data }) => setExistingDocs(data || []))
      .finally(() => setLoading(false))
  }, [surrogate?.id])

  useEffect(() => { refetch() }, [refetch])

  /** Find the latest esign_documents row for a templateId, ignoring voided. */
  function docFor(templateId) {
    const matches = existingDocs.filter(d => {
      if (d.status === 'voided') return false
      try { return JSON.parse(d.document_hash || '{}').templateId === templateId } catch { return false }
    })
    // newest first
    matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return matches[0] || null
  }

  function statusFor(templateId) {
    const doc = docFor(templateId)
    if (!doc) return { kind: 'unsent' }
    const signedStatuses = ['signed', 'completed', 'partially_signed']
    if (signedStatuses.includes(doc.status)) {
      const signer = (doc.signers || [])[0]
      return {
        kind: doc.status === 'completed' ? 'completed' : 'partial',
        date: signer?.signedAt || doc.completed_at || null,
        doc,
      }
    }
    if (doc.status === 'pending') return { kind: 'pending', doc }
    return { kind: 'unsent' }
  }

  function toggleSelect(templateId, checked) {
    setSelected(prev => {
      const next = new Set(prev)
      if (checked) next.add(templateId); else next.delete(templateId)
      return next
    })
  }

  async function handleSendSelected() {
    if (!selected.size) return
    setSending(true)
    setResult(null)
    const res = await sendReleaseFormsBatch([...selected], {
      surrogate,
      partnerName,
      partnerEmail,
      adminName,
      adminEmail,
      senderName: currentUser?.name,
      senderEmail: currentUser?.email,
      existingDocs,
    })
    setSending(false)
    if (res.success) {
      setSelected(new Set())
      setResult({ type: 'success', msg: `Batch sent — ${res.createdDocIds?.length || 0} document${res.createdDocIds?.length === 1 ? '' : 's'} emailed.` })
      setTimeout(() => setResult(null), 4000)
      refetch()
    } else {
      setResult({ type: 'error', msg: res.error || 'Batch send failed.' })
    }
  }

  async function handleResend(templateId) {
    const status = statusFor(templateId)
    if (status.kind !== 'pending') return
    const meta = (() => { try { return JSON.parse(status.doc.document_hash || '{}') } catch { return {} } })()
    const formToken = meta.formToken
    const batchToken = meta.batchToken
    if (!formToken && !batchToken) return

    setResending(prev => new Set([...prev, templateId]))
    // Send to each signer on the doc. Prefer batch URL if doc is part of a batch.
    for (const signer of (status.doc.signers || [])) {
      if (!signer.email) continue
      const formUrl = batchToken
        ? `${window.location.origin}/e-signature/batch/${batchToken}`
        : `${window.location.origin}/e-signature/form/${formToken}`
      await fetch('/api/send-esign-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signerName: signer.name,
          signerEmail: signer.email,
          formTitle: status.doc.title,
          formUrl,
          senderName: currentUser?.name,
          senderEmail: currentUser?.email,
        }),
      }).catch(() => {})
    }
    setResending(prev => { const next = new Set(prev); next.delete(templateId); return next })
    setResult({ type: 'success', msg: 'Resent.' })
    setTimeout(() => setResult(null), 3000)
  }

  // Group rows by section for display
  const rowsBySection = rows.reduce((acc, row) => {
    if (!acc[row.section]) acc[row.section] = []
    acc[row.section].push(row)
    return acc
  }, {})

  const selectedCount = selected.size

  return (
    <Card id="app-sec-waivers">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="size-4 text-[#283693]" /> Release Forms
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Batch action bar */}
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
          <Button
            size="sm"
            disabled={sending || selectedCount === 0}
            onClick={handleSendSelected}
            className="gap-1.5"
            style={{ background: selectedCount ? 'linear-gradient(135deg, #ed148c, #283693)' : undefined }}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {sending ? 'Sending...' : `Send Selected${selectedCount ? ` (${selectedCount})` : ''}`}
          </Button>
          {selectedCount > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-xs text-stone-400 hover:underline">
              Clear selection
            </button>
          )}
          {result && (
            <div className={`flex items-center gap-1 text-xs ml-auto ${result.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {result.type === 'success' ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}
              {result.msg}
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-stone-400 py-4 text-center">Loading release forms…</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(rowsBySection).map(([section, sectionRows]) => (
              <div key={section}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">{section}</p>
                <div className="space-y-1.5">
                  {sectionRows.map(({ templateId }) => {
                    const tpl = FORM_TEMPLATES[templateId]
                    if (!tpl) return null
                    const status = statusFor(templateId)
                    const isChecked = selected.has(templateId)
                    const isResending = resending.has(templateId)

                    if (status.kind === 'completed') {
                      const signedDate = status.date
                        ? new Date(status.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                        : null
                      return (
                        <div key={templateId} className="flex items-center gap-2 text-xs py-1">
                          <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                          <span className="text-green-700 font-medium">
                            {tpl.title} — Signed{signedDate ? ` on ${signedDate}` : ''}
                          </span>
                        </div>
                      )
                    }

                    if (status.kind === 'partial') {
                      return (
                        <div key={templateId} className="flex items-center gap-2 text-xs py-1">
                          <Clock className="size-4 text-blue-500 shrink-0" />
                          <span className="text-blue-700 font-medium">
                            {tpl.title} — Partially signed (waiting for remaining signer{(status.doc?.signers || []).filter(s => s.status !== 'signed').length > 1 ? 's' : ''})
                          </span>
                          <label className="ml-auto flex items-center gap-1.5 cursor-pointer text-[11px] text-stone-500">
                            <Checkbox checked={isChecked} onCheckedChange={v => toggleSelect(templateId, v)} />
                            Re-send (voids old)
                          </label>
                        </div>
                      )
                    }

                    if (status.kind === 'pending') {
                      return (
                        <div key={templateId} className="flex items-center gap-2 text-xs py-1">
                          <Clock className="size-4 text-amber-500 shrink-0" />
                          <span className="text-amber-700 font-medium">{tpl.title} — Pending</span>
                          <button
                            onClick={() => handleResend(templateId)}
                            disabled={isResending}
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-[#283693] hover:underline ml-1"
                          >
                            {isResending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                            {isResending ? 'Sending...' : 'Resend'}
                          </button>
                          <label className="ml-auto flex items-center gap-1.5 cursor-pointer text-[11px] text-stone-500">
                            <Checkbox checked={isChecked} onCheckedChange={v => toggleSelect(templateId, v)} />
                            Re-send (voids old)
                          </label>
                        </div>
                      )
                    }

                    // unsent
                    return (
                      <label key={templateId} className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:bg-stone-50 rounded px-1 -mx-1">
                        <Checkbox checked={isChecked} onCheckedChange={v => toggleSelect(templateId, v)} />
                        <span className="text-stone-700 font-medium">{tpl.title}</span>
                        <span className="text-[10px] text-stone-400 ml-auto">Not sent</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

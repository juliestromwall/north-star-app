import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  FileText, CheckCircle2, Clock, Shield, Loader2, Mail,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { fetchDocument, signDocument, logAuditEvent } from '@/lib/esign'
import { supabase } from '@/lib/supabase'

// ── Inline Signature Pad ────────────────────────────────

function InlineSignaturePad({ value, onChange, signerName }) {
  const [mode, setMode] = useState('typed')
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)

  useEffect(() => {
    // Track mouse on window so drawing continues outside canvas
    function handleMove(e) {
      if (!drawingRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const rect = canvas.getBoundingClientRect()
      const x = Math.max(0, Math.min(canvas.width, (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left))
      const y = Math.max(0, Math.min(canvas.height, (e.clientY || e.touches?.[0]?.clientY || 0) - rect.top))
      ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a1a2e'
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    function handleUp() {
      if (!drawingRef.current) return
      drawingRef.current = false
      if (canvasRef.current) onChange({ type: 'drawn', image: canvasRef.current.toDataURL('image/png'), name: signerName })
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleUp)
    }
  }, [onChange, signerName])

  function startDraw(e) {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    drawingRef.current = true
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  return (
    <span className="inline-block align-middle my-2">
      <span className="border-2 border-dashed border-[#283693]/30 rounded-xl p-4 bg-[#283693]/5 inline-block" style={{ minWidth: 340 }}>
        <span className="flex gap-2 mb-3">
          <button onClick={() => setMode('typed')} className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${mode === 'typed' ? 'bg-[#283693] text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>Type Signature</button>
          <button onClick={() => setMode('drawn')} className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${mode === 'drawn' ? 'bg-[#283693] text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>Draw Signature</button>
        </span>
        {mode === 'typed' ? (
          <span className="block">
            <input type="text" value={value?.name || ''} onChange={e => onChange({ type: 'typed', name: e.target.value })}
              placeholder="Type your full legal name" className="w-full text-lg border-b-2 border-[#283693]/30 bg-transparent outline-none pb-2 font-serif italic placeholder:not-italic placeholder:text-stone-300 placeholder:font-sans placeholder:text-sm" />
            {value?.name && (
              <span className="block text-2xl font-serif italic text-[#1a1a2e] mt-3 text-center py-2">{value.name}</span>
            )}
          </span>
        ) : (
          <span className="block">
            <span className="rounded-lg border-2 border-stone-200 bg-white relative block overflow-hidden" style={{ cursor: 'crosshair' }}>
              <canvas ref={canvasRef} width={320} height={120} className="w-full touch-none block"
                onMouseDown={startDraw}
                onTouchStart={startDraw} />
              <span className="absolute bottom-3 left-4 right-4 h-px bg-stone-200" />
              <span className="absolute bottom-1 left-4 text-[9px] text-stone-300">Sign above this line</span>
            </span>
            <span className="flex justify-between mt-2">
              <button onClick={() => {
                const canvas = canvasRef.current;
                if (canvas) { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); onChange(null) }
              }} className="text-xs text-stone-400 hover:text-red-500 transition-colors">Clear signature</button>
            </span>
          </span>
        )}
      </span>
    </span>
  )
}

// ── Document with Inline Fields ─────────────────────────

function DocumentWithFields({ html, fields, signerRole, signerName, signerEmail, fieldValues, onFieldChange, signatureValue, onSignatureChange }) {
  function roleMatches(fieldRole) {
    const r = signerRole?.toLowerCase() || ''
    if (fieldRole === 'gc' && (r.includes('surrogate') || r.includes('gc'))) return true
    if (fieldRole === 'ip1' && (r.includes('intended parent 1') || r.includes('ip1') || (r.includes('intended parent') && !r.includes('2')))) return true
    if (fieldRole === 'ip2' && (r.includes('intended parent 2') || r.includes('ip2'))) return true
    if (fieldRole === 'admin' && (r.includes('admin') || r.includes('agency'))) return true
    return false
  }

  // Replace {{Field:Role}} placeholders with React components
  const parts = useMemo(() => {
    if (!html) return [{ type: 'html', content: '<p>Document content not available.</p>' }]
    const result = []
    const regex = /\{\{(\w+):(\w+)\}\}/g
    let lastIndex = 0
    let match
    let fieldIdx = 0

    while ((match = regex.exec(html)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'html', content: html.slice(lastIndex, match.index) })
      }
      result.push({
        type: 'field',
        fieldType: match[1].toLowerCase(),
        role: match[2].toLowerCase(),
        fieldId: `field_${fieldIdx}`,
        placeholder: match[0],
      })
      fieldIdx++
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < html.length) {
      result.push({ type: 'html', content: html.slice(lastIndex) })
    }
    return result
  }, [html])

  return (
    <div>
      <style>{`
        .signing-doc { font-family: 'Arial', sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a2e; }
        .signing-doc p { margin: 0.4em 0; }
        .signing-doc ul { list-style: disc; padding-left: 1.5em; }
        .signing-doc ol { list-style: decimal; padding-left: 1.5em; }
        .signing-doc li { margin: 0.3em 0; }
        .signing-doc table { border-collapse: collapse; width: 100%; }
        .signing-doc td, .signing-doc th { border: 1px solid #ddd; padding: 6px 10px; }
        .signing-doc img { max-width: 100%; height: auto; }
        .signing-doc a { color: #283693; }
      `}</style>
      <div className="signing-doc">
        {parts.map((part, i) => {
          if (part.type === 'html') {
            return <span key={i} dangerouslySetInnerHTML={{ __html: part.content }} />
          }

          const isMyField = roleMatches(part.role)
          const key = part.fieldId
          const val = fieldValues[key] || ''

          // Not this signer's field — show as gray placeholder
          if (!isMyField) {
            return (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-400 text-xs font-medium align-middle border border-stone-200 mx-0.5">
                {part.placeholder}
              </span>
            )
          }

          // Render interactive field based on type
          switch (part.fieldType) {
            case 'signature':
              return <InlineSignaturePad key={i} value={signatureValue} onChange={onSignatureChange} signerName={signerName} />
            case 'name':
              return <input key={i} type="text" value={val || signerName || ''} onChange={e => onFieldChange(key, e.target.value)}
                placeholder="Full name" className="inline-block w-[200px] text-sm border-b-2 border-blue-300 bg-blue-50/50 outline-none px-2 py-1 rounded-t align-middle mx-0.5" />
            case 'email':
              return <input key={i} type="email" value={val || signerEmail || ''} onChange={e => onFieldChange(key, e.target.value)}
                placeholder="email@example.com" className="inline-block w-[220px] text-sm border-b-2 border-sky-300 bg-sky-50/50 outline-none px-2 py-1 rounded-t align-middle mx-0.5" />
            case 'date':
              return <input key={i} type="text" value={val || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                readOnly className="inline-block w-[180px] text-sm border-b-2 border-green-300 bg-green-50/50 outline-none px-2 py-1 rounded-t align-middle mx-0.5" />
            case 'initials': {
              const defaultInit = signerName ? signerName.split(' ').map(w => w[0]).join('').toUpperCase() : ''
              return <input key={i} type="text" value={val || defaultInit} onChange={e => onFieldChange(key, e.target.value)}
                placeholder="Initials" maxLength={5} className="inline-block w-[80px] text-sm font-semibold text-center border-b-2 border-purple-300 bg-purple-50/50 outline-none px-2 py-1 rounded-t align-middle mx-0.5" />
            }
            case 'checkbox':
              return <label key={i} className="inline-flex items-center gap-1.5 align-middle mx-0.5 cursor-pointer">
                <input type="checkbox" checked={!!fieldValues[key]} onChange={e => onFieldChange(key, e.target.checked)} className="size-4 accent-[#283693]" />
              </label>
            case 'text':
              return <input key={i} type="text" value={val} onChange={e => onFieldChange(key, e.target.value)}
                placeholder="Enter text..." className="inline-block w-[200px] text-sm border-b-2 border-amber-300 bg-amber-50/50 outline-none px-2 py-1 rounded-t align-middle mx-0.5" />
            default:
              return <input key={i} type="text" value={val} onChange={e => onFieldChange(key, e.target.value)}
                placeholder={part.placeholder} className="inline-block w-[200px] text-sm border-b-2 border-stone-300 bg-stone-50/50 outline-none px-2 py-1 rounded-t align-middle mx-0.5" />
          }
        })}
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────

export default function SignDocumentPage() {
  const { id } = useParams()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)

  // Email verification
  const [signerEmail, setSignerEmail] = useState('')
  const [verified, setVerified] = useState(false)
  const [mySigner, setMySigner] = useState(null)

  // Signing state
  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [signatureValue, setSignatureValue] = useState(null)
  const [fieldValues, setFieldValues] = useState({})

  // Document HTML
  const [docHtml, setDocHtml] = useState('')
  const [loadingHtml, setLoadingHtml] = useState(false)

  // Load document
  useEffect(() => {
    if (!id) return
    const docId = Number(id)
    if (isNaN(docId)) { setLoading(false); return }
    fetchDocument(docId).then(d => setDoc(d)).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  // Load HTML when verified
  useEffect(() => {
    if (!verified || !doc) return
    setLoadingHtml(true)
    try {
      const meta = JSON.parse(doc.document_hash || '{}')
      if (meta.htmlPath && supabase) {
        const { data } = supabase.storage.from('esign-documents').getPublicUrl(meta.htmlPath)
        if (data?.publicUrl) {
          fetch(data.publicUrl)
            .then(r => r.text())
            .then(html => setDocHtml(html))
            .catch(() => {})
            .finally(() => setLoadingHtml(false))
          return
        }
      }
    } catch {}
    setLoadingHtml(false)
  }, [verified, doc])

  function handleVerify() {
    if (!doc || !signerEmail.trim()) return
    const found = doc.signers?.find(s => s.email.toLowerCase() === signerEmail.trim().toLowerCase())
    if (found) {
      setMySigner(found)
      setVerified(true)
      try { logAuditEvent(doc.id, 'viewed', found.name, found.email) } catch {}
      // Pre-fill fields
      const meta = JSON.parse(doc.document_hash || '{}')
      const fields = meta.fields || []
      const prefilled = {}
      fields.forEach(f => {
        const r = found.role?.toLowerCase() || ''
        const matches = (f.role === 'gc' && (r.includes('surrogate') || r.includes('gc'))) ||
          (f.role === 'ip1' && (r.includes('intended parent 1') || r.includes('ip1') || (r.includes('intended parent') && !r.includes('2')))) ||
          (f.role === 'ip2' && (r.includes('intended parent 2') || r.includes('ip2'))) ||
          (f.role === 'admin' && (r.includes('admin') || r.includes('agency')))
        if (!matches) return
        if (f.fieldType === 'name') prefilled[f.fieldId] = found.name
        if (f.fieldType === 'email') prefilled[f.fieldId] = found.email
        if (f.fieldType === 'date') prefilled[f.fieldId] = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      })
      setFieldValues(prefilled)
    } else {
      alert('This email is not listed as a signer on this document.')
    }
  }

  async function handleSign() {
    if (!doc || !mySigner || !agreed) return
    if (!signatureValue?.name && !signatureValue?.image) {
      alert('Please provide your signature.')
      return
    }
    setSigning(true)
    try {
      const signatureData = {
        type: signatureValue?.type || 'typed',
        name: signatureValue?.name || mySigner.name || '',
        image: signatureValue?.image || null,
        fieldValues,
      }
      const updated = await signDocument(doc.id, mySigner.email, signatureData)

      // If all signers done, generate a signed PDF from the rendered document
      // Generate signed PDF via Google Docs API and file to case
      if (updated.status === 'completed' && updated.case_id && supabase) {
        try {
          const meta = JSON.parse(updated.document_hash || '{}')
          const templateDocId = meta.templateDocId
          const adminUserId = meta.adminUserId

          if (templateDocId && adminUserId) {
            // Use Google Docs API to generate a filled PDF
            const { generateSignedPdf } = await import('@/lib/google')
            const pdfBlob = await generateSignedPdf(adminUserId, templateDocId, signatureData.fieldValues, updated.signers)

            // Upload signed PDF
            const signedPath = `documents/signed_${doc.id}_${Date.now()}.pdf`
            const { error: uploadErr } = await supabase.storage.from('esign-documents').upload(signedPath, pdfBlob, {
              contentType: 'application/pdf',
              cacheControl: '3600',
            })
            if (!uploadErr) {
              const { data: urlData } = supabase.storage.from('esign-documents').getPublicUrl(signedPath)
              if (urlData?.publicUrl) {
                await supabase.from('case_documents').insert({
                  surrogate_id: updated.case_id,
                  category: 'e-signature',
                  file_name: `[Signed] ${updated.title || 'Document'}.pdf`,
                  file_type: 'application/pdf',
                  storage_path: signedPath,
                  public_url: urlData.publicUrl,
                  uploaded_by: 'System (E-Sign)',
                })
              }
            }
          } else {
            // Fallback: file the sent PDF
            const pdfPath = meta.pdfPath || updated.file_path
            if (pdfPath) {
              const { data: urlData } = supabase.storage.from('esign-documents').getPublicUrl(pdfPath)
              if (urlData?.publicUrl) {
                await supabase.from('case_documents').insert({
                  surrogate_id: updated.case_id,
                  category: 'e-signature',
                  file_name: `[Signed] ${updated.title || 'Document'}.pdf`,
                  file_type: 'application/pdf',
                  storage_path: pdfPath,
                  public_url: urlData.publicUrl,
                  uploaded_by: 'System (E-Sign)',
                })
              }
            }
          }
        } catch (pdfErr) {
          console.error('Signed PDF generation failed:', pdfErr)
          // Last resort fallback
          try {
            const meta = JSON.parse(updated.document_hash || '{}')
            const pdfPath = meta.pdfPath || updated.file_path
            if (pdfPath) {
              const { data: urlData } = supabase.storage.from('esign-documents').getPublicUrl(pdfPath)
              if (urlData?.publicUrl) {
                await supabase.from('case_documents').insert({
                  surrogate_id: updated.case_id,
                  category: 'e-signature',
                  file_name: `[Signed] ${updated.title || 'Document'}.pdf`,
                  file_type: 'application/pdf',
                  storage_path: pdfPath,
                  public_url: urlData.publicUrl,
                  uploaded_by: 'System (E-Sign)',
                })
              }
            }
          } catch {}
        }
      }

      setDoc(updated)
      setSigned(true)
    } catch (err) {
      alert('Failed to sign: ' + (err.message || 'Unknown error'))
    } finally { setSigning(false) }
  }

  // Get parsed fields
  function getFields() {
    try { return JSON.parse(doc?.document_hash || '{}').fields || [] } catch { return [] }
  }

  // ── Render ────────────────────────────────────────────

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 className="size-8 animate-spin text-[#283693]" /></div>
  }

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <Card className="max-w-md rounded-2xl"><CardContent className="py-12 text-center">
          <FileText className="size-12 text-stone-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Document Not Found</h2>
          <p className="text-sm text-stone-500">This document doesn't exist or has been removed.</p>
        </CardContent></Card>
      </div>
    )
  }

  if (doc.status === 'voided') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <Card className="max-w-md rounded-2xl"><CardContent className="py-12 text-center">
          <FileText className="size-12 text-red-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-600 mb-2">Document Voided</h2>
          <p className="text-sm text-stone-500">This document has been voided and can no longer be signed.</p>
        </CardContent></Card>
      </div>
    )
  }

  if (signed || mySigner?.status === 'signed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <Card className="max-w-lg rounded-2xl border-emerald-200 bg-emerald-50/30"><CardContent className="py-12 text-center space-y-4">
          <CheckCircle2 className="size-16 text-emerald-500 mx-auto" />
          <h2 className="text-2xl font-bold text-emerald-700">Document Signed</h2>
          <p className="text-stone-600">Thank you! You can view a copy of this in your Documents.</p>
          <div className="flex items-center justify-center gap-2 text-xs text-stone-400 pt-4">
            <Shield className="size-3.5" /><span>Legally binding. Recorded with tamper-proof audit trail.</span>
          </div>
        </CardContent></Card>
      </div>
    )
  }

  // Email verification gate
  if (!verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <Card className="max-w-md rounded-2xl"><CardContent className="py-8 space-y-6">
          <div className="text-center">
            <img src="/abc-logo.png" alt="ABC Surrogacy" className="h-14 mx-auto mb-4" />
            <h2 className="text-xl font-bold">{doc.title}</h2>
            <p className="text-sm text-stone-500 mt-1">Sent {doc.sent_at ? new Date(doc.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}</p>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-stone-600 text-center">Enter your email to verify your identity and access the document.</p>
            <div className="flex gap-2">
              <Input type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerify()} placeholder="Your email address" className="flex-1" />
              <Button onClick={handleVerify} style={{ backgroundColor: '#283693', color: '#fff' }}><Mail className="size-4" /> Verify</Button>
            </div>
          </div>
          <div className="pt-2">
            <p className="text-xs font-semibold text-stone-500 uppercase mb-2">Signers</p>
            {(doc.signers || []).map((s, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
                {s.status === 'signed' ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Clock className="size-4 text-stone-300" />}
                <span className="font-medium">{s.name}</span>
                <span className="text-stone-400 text-xs">({s.role})</span>
                <span className="ml-auto text-xs text-stone-400">{s.status === 'signed' ? 'Signed' : 'Pending'}</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </div>
    )
  }

  // ── Signing view — document with inline fields ────────

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        {/* Header */}
        <div className="text-center">
          <img src="/abc-logo.png" alt="ABC Surrogacy" className="h-14 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-[#283693]">{doc.title}</h1>
          <p className="text-xs text-stone-400 mt-1">
            Signing as: <span className="font-semibold">{mySigner.name}</span> ({mySigner.role})
          </p>
        </div>

        {/* Signer progress */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {(doc.signers || []).map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              {s.status === 'signed' ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : s.email === mySigner.email ? <Clock className="size-3.5 text-amber-500" /> : <Clock className="size-3.5 text-stone-300" />}
              <span className={s.email === mySigner.email ? 'font-semibold text-[#283693]' : 'text-stone-500'}>{s.name}</span>
            </div>
          ))}
        </div>

        {/* Document with inline fields */}
        <Card className="rounded-2xl shadow-lg">
          <CardContent className="p-8">
            {loadingHtml ? (
              <div className="text-center py-12"><Loader2 className="size-6 animate-spin text-[#283693] mx-auto" /></div>
            ) : docHtml ? (
              <DocumentWithFields
                html={docHtml}
                fields={getFields()}
                signerRole={mySigner.role}
                signerName={mySigner.name}
                signerEmail={mySigner.email}
                fieldValues={fieldValues}
                onFieldChange={(key, val) => setFieldValues(prev => ({ ...prev, [key]: val }))}
                signatureValue={signatureValue}
                onSignatureChange={setSignatureValue}
              />
            ) : (
              <div className="text-center py-8 text-stone-400">
                <p>Document preview not available.</p>
                <p className="text-xs mt-2">The document content could not be loaded. Please contact the sender.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* If no signature field in the doc, show standalone pad */}
        {docHtml && !docHtml.includes('{{Signature:') && !docHtml.includes('{{signature:') && (
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-lg">Sign Document</CardTitle></CardHeader>
            <CardContent>
              <InlineSignaturePad value={signatureValue} onChange={setSignatureValue} signerName={mySigner.name} />
            </CardContent>
          </Card>
        )}

        {/* Agreement + Submit */}
        <Card className="rounded-2xl">
          <CardContent className="py-6 space-y-4">
            <div className="flex items-start gap-3 rounded-lg border p-4 bg-stone-50/50">
              <Checkbox checked={agreed} onCheckedChange={setAgreed} className="mt-0.5" />
              <div className="text-xs text-stone-600 leading-relaxed">
                I agree that my input and signature above represents my legal consent and that I am authorized to sign this document.
                I understand this is a legally binding electronic signature in accordance with the ESIGN Act and UETA.
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <Shield className="size-3.5 shrink-0" />
              <span>Protected under HIPAA. An audit trail records all signing activity.</span>
            </div>
            <Button onClick={handleSign} disabled={signing || !agreed || (!signatureValue?.name && !signatureValue?.image)}
              className="w-full gap-1.5 py-3 text-base" style={{ backgroundColor: '#283693', color: '#fff' }}>
              {signing ? <Loader2 className="size-5 animate-spin" /> : null}
              {signing ? 'Signing...' : 'Apply Signature'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

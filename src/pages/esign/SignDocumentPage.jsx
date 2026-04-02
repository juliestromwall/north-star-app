import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  FileText, CheckCircle2, Clock, Shield, Loader2, Mail,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { fetchDocument, signDocument, logAuditEvent, getDocumentFileUrl } from '@/lib/esign'
import { supabase } from '@/lib/supabase'

// ── Field Components ────────────────────────────────────

function SignatureField({ value, onChange, signerName }) {
  const [mode, setMode] = useState('typed')
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)

  function startDraw(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    setIsDrawing(true)
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo((e.clientX || e.touches?.[0]?.clientX) - rect.left, (e.clientY || e.touches?.[0]?.clientY) - rect.top)
  }

  function draw(e) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a2e'
    ctx.lineTo((e.clientX || e.touches?.[0]?.clientX) - rect.left, (e.clientY || e.touches?.[0]?.clientY) - rect.top)
    ctx.stroke()
  }

  function endDraw() {
    setIsDrawing(false)
    if (canvasRef.current) onChange({ type: 'drawn', image: canvasRef.current.toDataURL('image/png'), name: signerName })
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setMode('typed')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'typed' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-600'}`}>Type Signature</button>
        <button onClick={() => setMode('drawn')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'drawn' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-600'}`}>Draw Signature</button>
      </div>
      {mode === 'typed' ? (
        <div className="space-y-2">
          <Input value={value?.name || ''} onChange={e => onChange({ type: 'typed', name: e.target.value })} placeholder="Type your full legal name..." className="text-lg" />
          {value?.name && <div className="rounded-lg border bg-white p-6 text-center"><p className="text-3xl font-serif italic text-[#1a1a2e]">{value.name}</p></div>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-lg border bg-white relative">
            <canvas ref={canvasRef} width={500} height={150} className="w-full cursor-crosshair touch-none"
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw} />
            <div className="absolute bottom-0 left-4 right-4 h-px bg-stone-200" />
          </div>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => { canvasRef.current?.getContext('2d').clearRect(0, 0, 500, 150); onChange(null) }}>Clear</Button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────

export default function SignDocumentPage() {
  const { id } = useParams()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)

  // Email verification (for signers without accounts)
  const [signerEmail, setSignerEmail] = useState('')
  const [verified, setVerified] = useState(false)
  const [mySigner, setMySigner] = useState(null)

  // Signing state
  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [signatureValue, setSignatureValue] = useState(null)

  // Field values for {{Field:Role}} placeholders
  const [fieldValues, setFieldValues] = useState({})

  // Load document
  useEffect(() => {
    if (!id) return
    const docId = Number(id)
    if (isNaN(docId)) { setLoading(false); return }
    fetchDocument(docId).then(d => {
      setDoc(d)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  // Verify signer by email
  function handleVerify() {
    if (!doc || !signerEmail.trim()) return
    const found = doc.signers?.find(s => s.email.toLowerCase() === signerEmail.trim().toLowerCase())
    if (found) {
      setMySigner(found)
      setVerified(true)
      try { logAuditEvent(doc.id, 'viewed', found.name, found.email) } catch {}

      // Pre-fill name and email fields
      const fields = getFields()
      const prefilled = {}
      fields.forEach(f => {
        if (f.fieldType === 'name' && roleMatches(f.role, found.role)) prefilled[f.fieldId] = found.name
        if (f.fieldType === 'email' && roleMatches(f.role, found.role)) prefilled[f.fieldId] = found.email
        if (f.fieldType === 'date' && roleMatches(f.role, found.role)) prefilled[f.fieldId] = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      })
      setFieldValues(prefilled)
    } else {
      alert('This email is not listed as a signer on this document.')
    }
  }

  // Parse fields from document_hash metadata
  function getFields() {
    if (!doc?.document_hash) return []
    try {
      const meta = JSON.parse(doc.document_hash)
      return meta.fields || []
    } catch { return [] }
  }

  function roleMatches(fieldRole, signerRole) {
    const r = signerRole?.toLowerCase() || ''
    if (fieldRole === 'gc' && (r.includes('surrogate') || r.includes('gc'))) return true
    if (fieldRole === 'ip1' && (r.includes('intended parent 1') || r.includes('ip1') || (r.includes('intended parent') && !r.includes('2')))) return true
    if (fieldRole === 'ip2' && (r.includes('intended parent 2') || r.includes('ip2'))) return true
    if (fieldRole === 'admin' && (r.includes('admin') || r.includes('agency'))) return true
    return false
  }

  // Handle sign
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
      setDoc(updated)
      setSigned(true)
    } catch (err) {
      alert('Failed to sign: ' + (err.message || 'Unknown error'))
    } finally { setSigning(false) }
  }

  // Get PDF URL for preview
  function getPdfUrl() {
    if (!doc) return null
    try {
      const meta = JSON.parse(doc.document_hash || '{}')
      if (meta.pdfPath && supabase) {
        const { data } = supabase.storage.from('esign-documents').getPublicUrl(meta.pdfPath)
        return data?.publicUrl
      }
    } catch {}
    if (doc.file_path) return getDocumentFileUrl(doc.file_path)
    return null
  }

  // ── Render states ─────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="size-8 animate-spin text-[#283693]" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Card className="max-w-md rounded-2xl">
          <CardContent className="py-12 text-center">
            <FileText className="size-12 text-stone-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Document Not Found</h2>
            <p className="text-sm text-stone-500">This document doesn't exist or has been removed.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Voided
  if (doc.status === 'voided') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Card className="max-w-md rounded-2xl">
          <CardContent className="py-12 text-center">
            <FileText className="size-12 text-red-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-red-600 mb-2">Document Voided</h2>
            <p className="text-sm text-stone-500">This document has been voided and can no longer be signed.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Already signed
  if (signed || (mySigner?.status === 'signed')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <Card className="max-w-lg rounded-2xl border-emerald-200 bg-emerald-50/30">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="size-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold text-emerald-700">Document Signed</h2>
            <p className="text-stone-600">
              {mySigner?.name || 'You'} signed this document on {mySigner?.signedAt ? new Date(mySigner.signedAt).toLocaleString() : 'just now'}.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-stone-400 pt-4">
              <Shield className="size-3.5" />
              <span>This signature is legally binding and has been recorded with a tamper-proof audit trail.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Email verification gate
  if (!verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <Card className="max-w-md rounded-2xl">
          <CardContent className="py-8 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#283693]/10 flex items-center justify-center mx-auto mb-4">
                <FileText className="size-8 text-[#283693]" />
              </div>
              <h2 className="text-xl font-bold">{doc.title}</h2>
              <p className="text-sm text-stone-500 mt-1">
                Sent {doc.sent_at ? new Date(doc.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-stone-600 text-center">Enter your email to verify your identity and access the document.</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={signerEmail}
                  onChange={e => setSignerEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  placeholder="Your email address"
                  className="flex-1"
                />
                <Button onClick={handleVerify} style={{ backgroundColor: '#283693', color: '#fff' }}>
                  <Mail className="size-4" /> Verify
                </Button>
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
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Signing view ──────────────────────────────────────

  const fields = getFields()
  const myFields = fields.filter(f => roleMatches(f.role, mySigner.role))
  const pdfUrl = getPdfUrl()

  return (
    <div className="min-h-screen bg-stone-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        {/* Header */}
        <div className="text-center">
          <img src="/abc-logo.png" alt="ABC Surrogacy" className="h-16 mx-auto mb-4" />
        </div>

        {/* Document info */}
        <Card className="rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#283693]/10 flex items-center justify-center">
                <FileText className="size-6 text-[#283693]" />
              </div>
              <div>
                <CardTitle>{doc.title}</CardTitle>
                <p className="text-xs text-stone-400 mt-0.5">
                  Signing as: <span className="font-semibold text-[#283693]">{mySigner.name}</span> ({mySigner.role})
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 flex-wrap">
              {(doc.signers || []).map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs">
                  {s.status === 'signed' ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : s.email === mySigner.email ? <Clock className="size-3.5 text-amber-500" /> : <Clock className="size-3.5 text-stone-300" />}
                  <span className={s.email === mySigner.email ? 'font-semibold text-[#283693]' : 'text-stone-500'}>{s.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* PDF Preview */}
        {pdfUrl && (
          <Card className="rounded-2xl overflow-hidden">
            <iframe src={pdfUrl} className="w-full border-0" style={{ height: '600px' }} title="Document Preview" />
          </Card>
        )}

        {/* Fields to fill */}
        {myFields.length > 0 && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Complete Your Information</CardTitle>
              <p className="text-xs text-muted-foreground">Fill in the fields below before signing.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {myFields.map((field, i) => {
                const key = field.fieldId || `field_${i}`
                const val = fieldValues[key] || ''

                if (field.fieldType === 'signature') return null // handled separately below

                return (
                  <div key={key} className="space-y-1">
                    <label className="text-sm font-medium capitalize">
                      {field.fieldType === 'name' ? 'Full Name' :
                       field.fieldType === 'email' ? 'Email Address' :
                       field.fieldType === 'date' ? 'Date' :
                       field.fieldType === 'initials' ? 'Initials' :
                       field.fieldType === 'text' ? 'Text' :
                       field.fieldType}
                    </label>
                    {field.fieldType === 'checkbox' ? (
                      <div className="flex items-center gap-2">
                        <Checkbox checked={!!fieldValues[key]} onCheckedChange={v => setFieldValues(prev => ({ ...prev, [key]: v }))} />
                        <span className="text-sm text-stone-600">I agree</span>
                      </div>
                    ) : (
                      <Input
                        value={val}
                        onChange={e => setFieldValues(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={field.fieldType === 'email' ? 'email@example.com' : field.fieldType === 'initials' ? 'e.g. JS' : ''}
                        type={field.fieldType === 'email' ? 'email' : 'text'}
                        readOnly={field.fieldType === 'date'}
                      />
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Signature */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Sign Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SignatureField value={signatureValue} onChange={setSignatureValue} signerName={mySigner.name} />

            <div className="flex items-start gap-3 rounded-lg border p-4 bg-stone-50/50">
              <Checkbox checked={agreed} onCheckedChange={setAgreed} className="mt-0.5" />
              <div className="text-xs text-stone-600 leading-relaxed">
                I agree that my signature above represents my legal consent and that I am authorized to sign this document.
                I understand this is a legally binding electronic signature in accordance with the ESIGN Act and UETA.
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-stone-400">
              <Shield className="size-3.5 shrink-0" />
              <span>This document is protected under HIPAA. An audit trail records all signing activity.</span>
            </div>

            <Button
              onClick={handleSign}
              disabled={signing || !agreed || (!signatureValue?.name && !signatureValue?.image)}
              className="w-full gap-1.5 py-3 text-base"
              style={{ backgroundColor: '#283693', color: '#fff' }}
            >
              {signing ? <Loader2 className="size-5 animate-spin" /> : null}
              {signing ? 'Signing...' : 'Apply Signature'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

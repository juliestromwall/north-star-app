import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, FileText, CheckCircle2, Clock, Shield, Download, PenLine,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import EmptyState from '@/components/shared/EmptyState'
import { useRole } from '@/context/RoleContext'
import { fetchDocument, signDocument, logAuditEvent, getTemplateFileUrl, getDocumentFileUrl } from '@/lib/esign'
import { extractSignFields } from '@/lib/signFieldExtension'

// ── Field Components ────────────────────────────────────

function SignatureField({ fieldId, value, onChange, signerName }) {
  const [mode, setMode] = useState('typed')
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)

  function startDraw(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    setIsDrawing(true)
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(e) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function endDraw() {
    setIsDrawing(false)
    if (canvasRef.current) {
      onChange({ type: 'drawn', image: canvasRef.current.toDataURL('image/png'), name: signerName })
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    onChange(null)
  }

  return (
    <div className="inline-block align-middle my-1">
      <div className="border-2 border-dashed border-pink-300 rounded-lg p-3 bg-pink-50/50 min-w-[300px]">
        <div className="flex gap-1 mb-2">
          <button onClick={() => setMode('typed')}
            className={`text-[10px] px-2 py-0.5 rounded font-medium ${mode === 'typed' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-600'}`}>
            Type
          </button>
          <button onClick={() => setMode('drawn')}
            className={`text-[10px] px-2 py-0.5 rounded font-medium ${mode === 'drawn' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-600'}`}>
            Draw
          </button>
        </div>
        {mode === 'typed' ? (
          <div>
            <input
              type="text"
              value={value?.name || ''}
              onChange={e => onChange({ type: 'typed', name: e.target.value })}
              placeholder="Type your full legal name"
              className="w-full text-base border-b-2 border-stone-300 bg-transparent outline-none pb-1 font-serif italic"
            />
            {value?.name && (
              <p className="text-xl font-serif italic text-[#1a1a2e] mt-2 text-center">{value.name}</p>
            )}
          </div>
        ) : (
          <div>
            <div className="rounded border bg-white relative">
              <canvas ref={canvasRef} width={280} height={80}
                className="w-full cursor-crosshair touch-none"
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
              />
              <div className="absolute bottom-0 left-2 right-2 h-px bg-stone-200" />
            </div>
            <button onClick={clearCanvas} className="text-[10px] text-stone-400 hover:text-stone-600 mt-1">Clear</button>
          </div>
        )}
      </div>
    </div>
  )
}

function NameField({ value, onChange, signerName }) {
  return (
    <input
      type="text"
      value={value || signerName || ''}
      onChange={e => onChange(e.target.value)}
      placeholder="Full name"
      className="inline-block w-[200px] text-sm border-b-2 border-blue-300 bg-blue-50/50 outline-none px-2 py-1 rounded-t align-middle"
    />
  )
}

function DateField({ value, onChange }) {
  return (
    <input
      type="text"
      value={value || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      onChange={e => onChange(e.target.value)}
      className="inline-block w-[180px] text-sm border-b-2 border-green-300 bg-green-50/50 outline-none px-2 py-1 rounded-t align-middle"
      readOnly
    />
  )
}

function InitialsField({ value, onChange, signerName }) {
  const defaultInitials = signerName ? signerName.split(' ').map(w => w[0]).join('').toUpperCase() : ''
  return (
    <input
      type="text"
      value={value || defaultInitials}
      onChange={e => onChange(e.target.value)}
      placeholder="Initials"
      maxLength={5}
      className="inline-block w-[80px] text-sm font-semibold text-center border-b-2 border-purple-300 bg-purple-50/50 outline-none px-2 py-1 rounded-t align-middle"
    />
  )
}

function CheckboxField({ value, onChange }) {
  return (
    <label className="inline-flex items-center gap-1.5 align-middle cursor-pointer">
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
        className="size-4 accent-[#283693]" />
    </label>
  )
}

function TextField({ value, onChange }) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder="Enter text..."
      className="inline-block w-[200px] text-sm border-b-2 border-amber-300 bg-amber-50/50 outline-none px-2 py-1 rounded-t align-middle"
    />
  )
}

// ── Document with Interactive Fields ────────────────────

function InteractiveDocument({ html, signerRole, signerName, fieldValues, onFieldChange }) {
  // Parse the HTML and replace <sign-field> elements with React components
  // We use a simple approach: split on sign-field tags and render inline

  const parts = useMemo(() => {
    if (!html) return []
    const result = []
    // Match <sign-field ...>...</sign-field> tags
    const regex = /<sign-field([^>]*)>[^<]*<\/sign-field>/gi
    let lastIndex = 0
    let match

    while ((match = regex.exec(html)) !== null) {
      // Add HTML before the field
      if (match.index > lastIndex) {
        result.push({ type: 'html', content: html.slice(lastIndex, match.index) })
      }

      // Parse attributes
      const attrs = match[1]
      const getAttr = (name) => {
        const m = attrs.match(new RegExp(`data-${name}="([^"]*)"`, 'i'))
        return m ? m[1] : ''
      }

      result.push({
        type: 'field',
        fieldType: getAttr('field-type'),
        role: getAttr('role'),
        label: getAttr('label'),
        fieldId: getAttr('field-id'),
      })

      lastIndex = match.index + match[0].length
    }

    // Remaining HTML
    if (lastIndex < html.length) {
      result.push({ type: 'html', content: html.slice(lastIndex) })
    }

    return result
  }, [html])

  // Map signer roles to field roles
  const roleMatches = (fieldRole) => {
    const r = signerRole?.toLowerCase() || ''
    if (fieldRole === 'gc' && (r.includes('surrogate') || r.includes('gc'))) return true
    if (fieldRole === 'ip1' && (r.includes('intended parent 1') || r.includes('ip1') || (r.includes('intended parent') && !r.includes('2')))) return true
    if (fieldRole === 'ip2' && (r.includes('intended parent 2') || r.includes('ip2'))) return true
    if (fieldRole === 'admin' && (r.includes('admin') || r.includes('agency'))) return true
    return false
  }

  return (
    <div className="prose prose-sm max-w-none px-6 py-4">
      <style>{`
        .doc-content p { margin: 0.5em 0; }
        .doc-content ul { list-style-type: disc; padding-left: 1.5em; }
        .doc-content ol { list-style-type: decimal; padding-left: 1.5em; }
        .doc-content table { border-collapse: collapse; width: 100%; }
        .doc-content td, .doc-content th { border: 1px solid #e5e7eb; padding: 6px 10px; }
      `}</style>
      <div className="doc-content">
        {parts.map((part, i) => {
          if (part.type === 'html') {
            return <span key={i} dangerouslySetInnerHTML={{ __html: part.content }} />
          }

          const isMyField = roleMatches(part.role)
          const fieldKey = part.fieldId || `field_${i}`
          const val = fieldValues[fieldKey]

          // Not this signer's field — show as read-only placeholder
          if (!isMyField) {
            const ROLE_LABELS = { gc: 'GC', ip1: 'IP1', ip2: 'IP2', admin: 'Admin' }
            return (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-400 text-xs font-medium align-middle border border-stone-200">
                {part.label || `${part.fieldType}: ${ROLE_LABELS[part.role] || part.role}`}
              </span>
            )
          }

          // This signer's field — render interactive component
          const onChange = (v) => onFieldChange(fieldKey, v)

          switch (part.fieldType) {
            case 'signature':
              return <SignatureField key={i} fieldId={fieldKey} value={val} onChange={onChange} signerName={signerName} />
            case 'name':
              return <NameField key={i} value={val} onChange={onChange} signerName={signerName} />
            case 'date':
              return <DateField key={i} value={val} onChange={onChange} />
            case 'initials':
              return <InitialsField key={i} value={val} onChange={onChange} signerName={signerName} />
            case 'checkbox':
              return <CheckboxField key={i} value={val} onChange={onChange} />
            case 'text':
              return <TextField key={i} value={val} onChange={onChange} />
            default:
              return <TextField key={i} value={val} onChange={onChange} />
          }
        })}
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────

export default function SignDocumentPage() {
  const { id } = useParams()
  const { currentUser } = useRole()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [fieldValues, setFieldValues] = useState({})
  const [documentHtml, setDocumentHtml] = useState('')

  // Find current user's signer entry
  const mySigner = doc?.signers?.find(s =>
    s.email.toLowerCase() === currentUser?.email?.toLowerCase()
  )
  const alreadySigned = mySigner?.status === 'signed'

  useEffect(() => {
    if (!id) return
    fetchDocument(Number(id)).then(d => {
      setDoc(d)
      if (d) {
        logAuditEvent(d.id, 'viewed', currentUser?.name, currentUser?.email)

        // Try to load the document HTML (stored in document_hash as base64)
        if (d.document_hash && d.document_hash.length > 100) {
          try {
            const html = decodeURIComponent(escape(atob(d.document_hash)))
            setDocumentHtml(html)
          } catch {}
        }
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  function handleFieldChange(fieldId, value) {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }))
  }

  // Check if signer has filled all their required fields
  const myFields = useMemo(() => {
    if (!documentHtml || !mySigner) return []
    const fields = extractSignFields(documentHtml)
    const role = mySigner.role?.toLowerCase() || ''
    return fields.filter(f => {
      if (f.role === 'gc' && (role.includes('surrogate') || role.includes('gc'))) return true
      if (f.role === 'ip1' && (role.includes('intended parent 1') || role.includes('ip1') || (role.includes('intended parent') && !role.includes('2')))) return true
      if (f.role === 'ip2' && (role.includes('intended parent 2') || role.includes('ip2'))) return true
      if (f.role === 'admin' && (role.includes('admin') || role.includes('agency'))) return true
      return false
    })
  }, [documentHtml, mySigner])

  const hasSignatureField = myFields.some(f => f.fieldType === 'signature')
  const allFieldsFilled = myFields.every(f => {
    const val = fieldValues[f.fieldId || `field_${f.index}`]
    if (f.fieldType === 'checkbox') return true // checkboxes are optional
    if (f.fieldType === 'date') return true // auto-filled
    return !!val
  })

  // Find the signature field value for the sign call
  const signatureFieldValue = myFields.find(f => f.fieldType === 'signature')
  const sigValue = signatureFieldValue ? fieldValues[signatureFieldValue.fieldId || `field_${signatureFieldValue.index}`] : null

  async function handleSign() {
    if (!doc || !mySigner || !agreed) return
    setSigning(true)
    try {
      const signatureData = {
        type: sigValue?.type || 'typed',
        name: sigValue?.name || mySigner.name || currentUser?.name || '',
        image: sigValue?.image || null,
        fieldValues,
      }
      const updated = await signDocument(doc.id, mySigner.email, signatureData)
      setDoc(updated)
      setSigned(true)
    } catch (err) {
      alert('Failed to sign: ' + (err.message || 'Unknown error'))
    } finally { setSigning(false) }
  }

  if (loading) return <div className="text-center py-12 text-stone-400">Loading document...</div>

  if (!doc) {
    return (
      <div className="space-y-6">
        <Link to="/e-signature" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to E-Signature
        </Link>
        <EmptyState title="Document not found" description="This document doesn't exist or has been removed." />
      </div>
    )
  }

  const fileUrl = doc.file_path ? (getDocumentFileUrl(doc.file_path) || getTemplateFileUrl(doc.file_path)) : null

  // Already signed
  if (alreadySigned || signed) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/30">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle2 className="size-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-heading font-bold text-emerald-700">Document Signed</h2>
            <p className="text-stone-600">
              {mySigner?.name || 'You'} signed this document on {mySigner?.signedAt ? new Date(mySigner.signedAt).toLocaleString() : 'just now'}.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-stone-400 pt-4">
              <Shield className="size-3.5" />
              <span>This signature is legally binding and has been recorded with a tamper-proof audit trail.</span>
            </div>
          </CardContent>
        </Card>
        <Link to="/e-signature" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to E-Signature
        </Link>
      </div>
    )
  }

  // Voided
  if (doc.status === 'voided') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <EmptyState title="Document Voided" description="This document has been voided and can no longer be signed." />
        <Link to="/e-signature" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to E-Signature
        </Link>
      </div>
    )
  }

  // Not a signer — view only
  if (!mySigner) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 py-8">
        <Link to="/e-signature" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to E-Signature
        </Link>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{doc.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {documentHtml ? (
              <div className="rounded-lg border bg-white">
                <div className="prose prose-sm max-w-none px-6 py-4" dangerouslySetInnerHTML={{ __html: documentHtml }} />
              </div>
            ) : fileUrl ? (
              <Button variant="outline" className="gap-1.5" asChild>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="size-4" /> View Document
                </a>
              </Button>
            ) : null}
            <div className="pt-4">
              <p className="text-xs font-semibold text-stone-500 uppercase mb-2">Signing Progress</p>
              {(doc.signers || []).map((s, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.status === 'signed' ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                  <span className="font-medium">{s.name}</span>
                  <span className="text-stone-400">({s.role})</span>
                  <span className="ml-auto text-xs text-stone-400">
                    {s.status === 'signed' ? `Signed ${new Date(s.signedAt).toLocaleDateString()}` : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Signing view
  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8">
      <Link to="/e-signature" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to E-Signature
      </Link>

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
                Sent {doc.sent_at ? new Date(doc.sent_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                {' · '}Signing as: <span className="font-semibold text-[#283693]">{mySigner.name}</span> ({mySigner.role})
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Signing progress */}
          <div className="flex items-center gap-4 flex-wrap">
            {(doc.signers || []).map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                {s.status === 'signed' ? (
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                ) : s.email === mySigner.email ? (
                  <Clock className="size-3.5 text-amber-500" />
                ) : (
                  <Clock className="size-3.5 text-stone-300" />
                )}
                <span className={s.email === mySigner.email ? 'font-semibold text-[#283693]' : 'text-stone-500'}>{s.name}</span>
                <span className="text-stone-400">
                  {s.status === 'signed' ? '✓' : s.email === mySigner.email ? '(your turn)' : ''}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Document with interactive fields */}
      {documentHtml && myFields.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <PenLine className="size-3.5" />
              <span>Fill in the highlighted fields below, then sign at the bottom.</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t">
              <InteractiveDocument
                html={documentHtml}
                signerRole={mySigner.role}
                signerName={mySigner.name}
                fieldValues={fieldValues}
                onFieldChange={handleFieldChange}
              />
            </div>
          </CardContent>
        </Card>
      ) : documentHtml ? (
        <Card className="rounded-2xl">
          <CardContent className="p-0">
            <div className="prose prose-sm max-w-none px-6 py-4" dangerouslySetInnerHTML={{ __html: documentHtml }} />
          </CardContent>
        </Card>
      ) : fileUrl ? (
        <Card className="rounded-2xl">
          <CardContent className="py-6">
            <div className="rounded-lg border bg-stone-50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-stone-400" />
                <span className="text-sm font-medium">Review the document before signing</span>
              </div>
              <Button variant="outline" size="sm" className="gap-1" asChild>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="size-3.5" /> Open Document
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* If no fields in document, show standalone signature pad */}
      {!hasSignatureField && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Sign Document</CardTitle>
          </CardHeader>
          <CardContent>
            <SignatureField
              fieldId="standalone_sig"
              value={fieldValues.standalone_sig}
              onChange={v => handleFieldChange('standalone_sig', v)}
              signerName={mySigner.name}
            />
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
            <span>This document is transmitted securely and protected under HIPAA. An audit trail records all signing activity.</span>
          </div>

          <Button
            onClick={handleSign}
            disabled={signing || !agreed || (!hasSignatureField && !fieldValues.standalone_sig) || (hasSignatureField && !allFieldsFilled)}
            className="w-full gap-1.5 py-3 text-base"
            style={{ backgroundColor: '#283693', color: '#fff' }}
          >
            {signing ? 'Signing...' : 'Apply Signature'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

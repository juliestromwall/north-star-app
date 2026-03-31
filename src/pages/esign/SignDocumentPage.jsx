import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, FileText, CheckCircle2, Clock, Shield, Download,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import EmptyState from '@/components/shared/EmptyState'
import { useRole } from '@/context/RoleContext'
import { fetchDocument, signDocument, logAuditEvent, getTemplateFileUrl, getDocumentFileUrl } from '@/lib/esign'

export default function SignDocumentPage() {
  const { id } = useParams()
  const { currentUser } = useRole()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sigMode, setSigMode] = useState('typed') // 'typed' or 'drawn'
  const [typedName, setTypedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Find current user's signer entry
  const mySigner = doc?.signers?.find(s =>
    s.email.toLowerCase() === currentUser?.email?.toLowerCase()
  )
  const alreadySigned = mySigner?.status === 'signed'

  useEffect(() => {
    if (!id) return
    fetchDocument(Number(id)).then(d => {
      setDoc(d)
      if (d) logAuditEvent(d.id, 'viewed', currentUser?.name, currentUser?.email)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  // Canvas drawing
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

  function endDraw() { setIsDrawing(false) }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  async function handleSign() {
    if (!doc || !mySigner || !agreed) return
    setSigning(true)
    try {
      const signatureData = {
        type: sigMode,
        name: sigMode === 'typed' ? typedName : (mySigner.name || currentUser?.name || ''),
        image: sigMode === 'drawn' ? canvasRef.current?.toDataURL('image/png') : null,
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

  // Already signed view
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

  // Not a signer
  if (!mySigner) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <Link to="/e-signature" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to E-Signature
        </Link>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>{doc.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-stone-50 p-4 text-sm">
              <p className="font-semibold">Document Details</p>
              <p className="text-stone-500 mt-1">Status: {doc.status}</p>
              <p className="text-stone-500">Signers: {(doc.signers || []).map(s => s.name).join(', ')}</p>
              <p className="text-stone-500">Sent: {doc.sent_at ? new Date(doc.sent_at).toLocaleString() : '—'}</p>
            </div>
            {fileUrl && (
              <Button variant="outline" className="gap-1.5" asChild>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="size-4" /> View Document
                </a>
              </Button>
            )}
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
    <div className="max-w-2xl mx-auto space-y-6 py-8">
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
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Document preview/download */}
          {fileUrl && (
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
          )}

          {/* Signing progress */}
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase mb-2">Signing Progress</p>
            {(doc.signers || []).map((s, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 text-sm">
                {s.status === 'signed' ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : s.email === mySigner.email ? (
                  <Clock className="size-4 text-amber-500" />
                ) : (
                  <Clock className="size-4 text-stone-300" />
                )}
                <span className={`font-medium ${s.email === mySigner.email ? 'text-[#283693]' : ''}`}>{s.name}</span>
                <span className="text-stone-400 text-xs">({s.role})</span>
                <span className="ml-auto text-xs">
                  {s.status === 'signed' ? (
                    <span className="text-emerald-600">Signed</span>
                  ) : s.email === mySigner.email ? (
                    <span className="text-amber-600 font-semibold">Your turn</span>
                  ) : (
                    <span className="text-stone-400">Pending</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Signature capture */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Sign Document</CardTitle>
          <p className="text-xs text-muted-foreground">Signing as: <span className="font-semibold">{mySigner.name}</span> ({mySigner.role})</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Signature type toggle */}
          <div className="flex gap-2">
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${sigMode === 'typed' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              onClick={() => setSigMode('typed')}
            >
              Type Signature
            </button>
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${sigMode === 'drawn' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              onClick={() => setSigMode('drawn')}
            >
              Draw Signature
            </button>
          </div>

          {sigMode === 'typed' ? (
            <div className="space-y-2">
              <Input
                value={typedName}
                onChange={e => setTypedName(e.target.value)}
                placeholder="Type your full legal name..."
                className="text-lg"
              />
              {typedName && (
                <div className="rounded-lg border bg-white p-6 text-center">
                  <p className="text-3xl font-serif italic text-[#1a1a2e]">{typedName}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg border bg-white relative">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={150}
                  className="w-full cursor-crosshair touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                <p className="absolute bottom-2 left-4 text-[10px] text-stone-300">Sign above this line</p>
                <div className="absolute bottom-0 left-4 right-4 h-px bg-stone-200" />
              </div>
              <Button variant="outline" size="sm" className="text-xs" onClick={clearCanvas}>Clear</Button>
            </div>
          )}

          {/* Agreement checkbox */}
          <div className="flex items-start gap-3 rounded-lg border p-4 bg-stone-50/50">
            <Checkbox checked={agreed} onCheckedChange={setAgreed} className="mt-0.5" />
            <div className="text-xs text-stone-600 leading-relaxed">
              I agree that the signature above represents my legal signature and that I am authorized to sign this document.
              I understand this is a legally binding electronic signature in accordance with the ESIGN Act and UETA.
            </div>
          </div>

          {/* HIPAA notice */}
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <Shield className="size-3.5 shrink-0" />
            <span>This document is transmitted securely and protected under HIPAA. An audit trail records all signing activity.</span>
          </div>

          <Button
            onClick={handleSign}
            disabled={signing || !agreed || (sigMode === 'typed' && !typedName)}
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

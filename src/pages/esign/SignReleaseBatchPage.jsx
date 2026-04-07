import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, CheckCircle2, Loader2, Mail, Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchDocuments, signDocument, logAuditEvent } from '@/lib/esign'
import { supabase } from '@/lib/supabase'

// ── Signature Pad ──────────────────────────────────────
function SignaturePad({ value, onChange, signerName }) {
  const [mode, setMode] = useState('typed')
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)

  function getXY(canvas, e) {
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX || e.touches?.[0]?.clientX || 0
    const cy = e.clientY || e.touches?.[0]?.clientY || 0
    return { x: (cx - rect.left) * (canvas.width / rect.width), y: (cy - rect.top) * (canvas.height / rect.height) }
  }
  function handleDown(e) {
    e.preventDefault(); drawingRef.current = true
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); const { x, y } = getXY(canvas, e)
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  useEffect(() => {
    function handleMove(e) {
      if (!drawingRef.current) return
      const canvas = canvasRef.current; if (!canvas) return
      const ctx = canvas.getContext('2d'); const { x, y } = getXY(canvas, e)
      ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a2e'
      ctx.lineTo(x, y); ctx.stroke()
    }
    function handleUp() {
      if (!drawingRef.current) return; drawingRef.current = false
      if (canvasRef.current && mode === 'drawn') onChange({ type: 'drawn', image: canvasRef.current.toDataURL('image/png'), name: signerName })
    }
    window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove, { passive: false }); window.addEventListener('touchend', handleUp)
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleUp) }
  }, [mode, onChange, signerName])

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode('typed')} className={`text-xs px-3 py-1 rounded-full font-medium ${mode === 'typed' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>Type</button>
        <button type="button" onClick={() => setMode('drawn')} className={`text-xs px-3 py-1 rounded-full font-medium ${mode === 'drawn' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>Draw</button>
      </div>
      {mode === 'typed' ? (
        <input type="text" value={typeof value === 'object' ? value?.name || '' : value || ''}
          onChange={e => onChange({ type: 'typed', name: e.target.value })}
          placeholder="Type your full name"
          className="w-full text-xl py-3 px-4 border-b-2 border-[#283693]/30 bg-stone-50/50 outline-none rounded-t font-serif italic" />
      ) : (
        <div>
          <canvas ref={canvasRef} width={500} height={80} className="w-full border border-stone-200 rounded-lg bg-white cursor-crosshair touch-none" onMouseDown={handleDown} onTouchStart={handleDown} />
          <button type="button" onClick={() => { const c = canvasRef.current; if (c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); onChange(null) } }} className="text-xs text-stone-400 hover:text-red-500 mt-1">Clear</button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────
export default function SignReleaseBatchPage() {
  const { batchToken } = useParams()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [signerEmail, setSignerEmail] = useState('')
  const [verified, setVerified] = useState(false)
  const [mySigner, setMySigner] = useState(null)
  const [signatures, setSignatures] = useState({}) // { docId: signatureValue }
  const [docHtmls, setDocHtmls] = useState({}) // { docId: html }
  const [signing, setSigning] = useState(false)
  const [signedDocs, setSignedDocs] = useState(new Set())
  const [allDone, setAllDone] = useState(false)

  // Load all release docs for this batch
  useEffect(() => {
    if (!batchToken || !supabase) { setLoading(false); return }
    supabase.from('esign_documents')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        // Filter by batch token stored in document_hash
        const batchDocs = (data || []).filter(d => {
          try {
            const meta = JSON.parse(d.document_hash || '{}')
            return meta.batchToken === batchToken
          } catch { return false }
        })
        setDocs(batchDocs)
      })
      .finally(() => setLoading(false))
  }, [batchToken])

  // Verify email
  function handleVerify() {
    if (!signerEmail.trim()) return
    const email = signerEmail.trim().toLowerCase()
    // Check if this email is a signer on any of the docs
    const firstDoc = docs[0]
    if (!firstDoc) return
    const found = (firstDoc.signers || []).find(s => s.email?.toLowerCase() === email)
    if (found) {
      setMySigner(found)
      setVerified(true)
      // Load all HTML documents
      for (const doc of docs) {
        try {
          const meta = JSON.parse(doc.document_hash || '{}')
          if (meta.htmlPath && supabase) {
            const { data } = supabase.storage.from('esign-documents').getPublicUrl(meta.htmlPath)
            if (data?.publicUrl) {
              fetch(data.publicUrl).then(r => r.text()).then(html => {
                setDocHtmls(prev => ({ ...prev, [doc.id]: html }))
              }).catch(() => {})
            }
          }
        } catch {}
      }
      // Log audit
      for (const doc of docs) {
        logAuditEvent(doc.id, 'viewed', found.name, email, {}).catch(() => {})
      }
    } else {
      alert('This email is not listed as a signer on these documents.')
    }
  }

  async function handleSignAll() {
    if (!mySigner || signing) return
    // Check all docs have signatures
    const unsigned = docs.filter(d => !signedDocs.has(d.id) && !signatures[d.id])
    if (unsigned.length > 0) {
      alert(`Please sign all ${docs.length} release forms before submitting.`)
      return
    }

    setSigning(true)
    try {
      for (const doc of docs) {
        if (signedDocs.has(doc.id)) continue
        const sig = signatures[doc.id]
        if (!sig) continue

        const signatureData = {
          type: sig.type || 'typed',
          name: sig.name || mySigner.name || '',
          image: sig.image || null,
          fieldValues: {},
          placeholderValues: {
            '{{Signature:GC}}': sig.name || mySigner.name || '',
            '{{Name:GC}}': mySigner.name || '',
            '{{Date:GC}}': new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          },
        }

        await signDocument(doc.id, mySigner.email, signatureData)

        // Generate PDF from the signed HTML
        try {
          const html = docHtmls[doc.id]
          if (html && supabase) {
            // Replace placeholders with actual values in HTML
            let filledHtml = html
              .replace(/\{\{Signature:GC\}\}/g, sig.type === 'drawn' && sig.image
                ? `<img src="${sig.image}" style="height: 30px;" />`
                : `<span style="font-family: serif; font-style: italic; font-size: 18px; color: #283693;">${sig.name || mySigner.name}</span>`)
              .replace(/\{\{Name:GC\}\}/g, mySigner.name || '')
              .replace(/\{\{Date:GC\}\}/g, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))

            // Add audit trail
            const auditHtml = `
              <div style="margin-top: 40px; border-top: 2px solid #283693; padding-top: 16px; font-size: 11px; color: #6b7280;">
                <p style="font-weight: 700; color: #283693; font-size: 12px;">ELECTRONIC SIGNATURE CERTIFICATE</p>
                <p>Signed by: ${mySigner.name} (${mySigner.email})</p>
                <p>Date: ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</p>
                <p>Signature type: ${sig.type === 'drawn' ? 'Hand-drawn' : 'Typed'}</p>
                <p style="margin-top: 8px; font-size: 9px;">Electronically signed via ABC Surrogacy (app.abcsurrogacy.com) in accordance with the ESIGN Act and UETA.</p>
              </div>
            `
            filledHtml = filledHtml.replace('</div>\n</div>', auditHtml + '</div>\n</div>')

            // Upload signed HTML
            const signedBlob = new Blob([filledHtml], { type: 'text/html' })
            const signedPath = `documents/signed_release_${doc.id}_${Date.now()}.html`
            await supabase.storage.from('esign-documents').upload(signedPath, signedBlob, { contentType: 'text/html' })

            // Try PDF generation via html2pdf
            try {
              const html2pdf = (await import('html2pdf.js')).default
              const container = document.createElement('div')
              container.innerHTML = `<div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1a1a2e; font-size: 14px; line-height: 1.6;">${filledHtml}</div>`
              // Must be visible for html2canvas to render — use opacity trick
              container.style.position = 'fixed'
              container.style.top = '0'
              container.style.left = '0'
              container.style.width = '800px'
              container.style.zIndex = '-1'
              container.style.opacity = '0.01'
              container.style.pointerEvents = 'none'
              container.style.background = 'white'
              document.body.appendChild(container)

              // Wait for images and layout to render
              await new Promise(r => setTimeout(r, 500))

              const pdfBlob = await html2pdf().set({
                margin: [0.4, 0.4, 0.4, 0.4],
                filename: `${doc.title}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 800 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
              }).from(container).outputPdf('blob')

              document.body.removeChild(container)

              const pdfPath = `documents/signed_release_${doc.id}_${Date.now()}.pdf`
              await supabase.storage.from('esign-documents').upload(pdfPath, pdfBlob, { contentType: 'application/pdf' })
              const { data: pdfUrl } = supabase.storage.from('esign-documents').getPublicUrl(pdfPath)

              if (pdfUrl?.publicUrl && doc.case_id) {
                await supabase.from('case_documents').insert({
                  surrogate_id: doc.case_id,
                  category: 'e-signature',
                  file_name: `[Signed] ${doc.title}.pdf`,
                  file_type: 'application/pdf',
                  storage_path: pdfPath,
                  public_url: pdfUrl.publicUrl,
                  uploaded_by: 'System (E-Sign)',
                })
              }
            } catch (pdfErr) {
              console.error('PDF generation failed, saving HTML instead:', pdfErr)
              // Fallback: save HTML to case documents
              const { data: htmlUrl } = supabase.storage.from('esign-documents').getPublicUrl(signedPath)
              if (htmlUrl?.publicUrl && doc.case_id) {
                await supabase.from('case_documents').insert({
                  surrogate_id: doc.case_id,
                  category: 'e-signature',
                  file_name: `[Signed] ${doc.title}.html`,
                  file_type: 'text/html',
                  storage_path: signedPath,
                  public_url: htmlUrl.publicUrl,
                  uploaded_by: 'System (E-Sign)',
                })
              }
            }
          }
        } catch (fileErr) {
          console.error('Failed to file signed document:', fileErr)
        }

        setSignedDocs(prev => new Set([...prev, doc.id]))
      }
      setAllDone(true)
    } catch (err) {
      console.error('Signing failed:', err)
      alert('An error occurred. Some documents may not have been signed. Please try again.')
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="size-8 animate-spin text-[#283693]" /></div>
  }

  if (docs.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <FileText className="size-12 text-stone-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-stone-700">No documents found</h1>
        <p className="text-stone-500 mt-2">This signing link may have expired or the documents have already been signed.</p>
      </div>
    )
  }

  if (allDone) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <CheckCircle2 className="size-16 text-emerald-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-stone-800">All Release Forms Signed!</h1>
        <p className="text-stone-500 mt-2">Thank you! {docs.length} medical records release form{docs.length === 1 ? ' has' : 's have'} been signed and filed.</p>
        <p className="text-stone-400 text-sm mt-4">You may close this page.</p>
      </div>
    )
  }

  // Email verification
  if (!verified) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <Card className="rounded-2xl shadow-lg">
          <CardContent className="py-8 px-6 text-center space-y-4">
            <Shield className="size-10 text-[#283693] mx-auto" />
            <h1 className="text-xl font-bold text-stone-800">Verify Your Identity</h1>
            <p className="text-sm text-stone-500">Enter your email address to access {docs.length} medical records release form{docs.length === 1 ? '' : 's'}.</p>
            <div className="space-y-3 pt-2">
              <Input type="email" placeholder="your@email.com" value={signerEmail}
                onChange={e => setSignerEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                className="text-center" />
              <Button className="w-full gap-2" style={{ backgroundColor: '#283693' }} onClick={handleVerify}>
                <Mail className="size-4" /> Verify & Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Signing view — all forms stacked
  const pendingDocs = docs.filter(d => !signedDocs.has(d.id))
  const allSigned = pendingDocs.every(d => signatures[d.id])

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#283693]">Medical Records Release Forms</h1>
        <p className="text-stone-500 mt-1">Please review and sign each form below. {signedDocs.size > 0 && `${signedDocs.size} of ${docs.length} complete.`}</p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-stone-100">
          <div className="h-2 rounded-full bg-[#ed148c] transition-all duration-500" style={{ width: `${((Object.keys(signatures).length) / docs.length) * 100}%` }} />
        </div>
        <span className="text-xs text-stone-500 font-medium">{Object.keys(signatures).length}/{docs.length}</span>
      </div>

      {docs.map((doc, i) => {
        const html = docHtmls[doc.id] || ''
        const isSigned = signedDocs.has(doc.id)
        const hasSig = !!signatures[doc.id]
        const meta = JSON.parse(doc.document_hash || '{}')

        return (
          <Card key={doc.id} className={`rounded-2xl ${isSigned ? 'opacity-60' : ''}`}>
            <CardContent className="p-6 space-y-4">
              {/* Provider header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white bg-[#283693] rounded-full size-6 flex items-center justify-center">{i + 1}</span>
                  <div>
                    <p className="font-semibold text-stone-800">{meta.providerName || doc.title}</p>
                    <p className="text-xs text-stone-400">
                      {{ ob: 'Prenatal/OB Records', hospital: 'Labor & Delivery Records', mfm: 'MFM Records', ivf: 'IVF/Fertility Records' }[meta.providerType] || 'Medical Records'}
                    </p>
                  </div>
                </div>
                {isSigned && <CheckCircle2 className="size-5 text-emerald-500" />}
                {hasSig && !isSigned && <CheckCircle2 className="size-5 text-amber-400" />}
              </div>

              {/* Document content */}
              {html && (
                <div className="border rounded-lg p-4 bg-white max-h-[400px] overflow-y-auto text-sm" dangerouslySetInnerHTML={{ __html: html.replace(/\{\{Signature:GC\}\}/g, '<span style="color: #ed148c; font-weight: 600;">[Sign below]</span>').replace(/\{\{Name:GC\}\}/g, mySigner?.name || '').replace(/\{\{Date:GC\}\}/g, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })) }} />
              )}

              {/* Signature for this doc */}
              {!isSigned && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-stone-600 mb-2">Sign for: {meta.providerName}</p>
                  <SignaturePad
                    value={signatures[doc.id]}
                    onChange={v => setSignatures(prev => ({ ...prev, [doc.id]: v }))}
                    signerName={mySigner?.name || ''}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* Submit all */}
      <div className="flex flex-col items-center gap-3 pt-4">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" id="agree-batch" className="size-4 accent-[#283693]" />
          I agree that my electronic signature is legally binding
        </label>
        <Button size="lg" className="gap-2 text-base px-10" style={{ backgroundColor: '#ed148c' }}
          onClick={() => {
            const agreed = document.getElementById('agree-batch')?.checked
            if (!agreed) { alert('Please agree to the terms before signing.'); return }
            handleSignAll()
          }}
          disabled={signing || !allSigned}>
          {signing ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
          {signing ? 'Signing...' : `Sign All ${docs.length} Release Forms`}
        </Button>
      </div>
    </div>
  )
}

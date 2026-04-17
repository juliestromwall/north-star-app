import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, CheckCircle2, Loader2, Mail, Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { logAuditEvent, signDocument } from '@/lib/esign'
import { FORM_TEMPLATES, generateBackgroundWaiverHtml, generateIPBackgroundWaiverHtml, generateAuditTrailHtml } from '@/lib/formTemplates'

// ── Signature Pad ──
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

// ── Main Page ──
export default function SignFormPage() {
  const { formToken } = useParams()
  const [doc, setDoc] = useState(null)
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [signerEmail, setSignerEmail] = useState('')
  const [verified, setVerified] = useState(false)
  const [mySigner, setMySigner] = useState(null)
  const [fieldValues, setFieldValues] = useState({})
  const [signatures, setSignatures] = useState({})
  const [activeSigId, setActiveSigId] = useState(null)
  const [signing, setSigning] = useState(false)
  const [done, setDone] = useState(false)

  // Load document by token
  useEffect(() => {
    if (!formToken || !supabase) { setLoading(false); return }
    supabase.from('esign_documents')
      .select('*')
      .eq('status', 'pending')
      .then(({ data }) => {
        const found = (data || []).find(d => {
          try {
            const meta = JSON.parse(d.document_hash || '{}')
            return meta.formToken === formToken
          } catch { return false }
        })
        if (found) {
          setDoc(found)
          const meta = JSON.parse(found.document_hash || '{}')
          setTemplate(FORM_TEMPLATES[meta.templateId] || null)
        }
      })
      .finally(() => setLoading(false))
  }, [formToken])

  function handleVerify() {
    if (!signerEmail.trim() || !doc) return
    const email = signerEmail.trim().toLowerCase()
    const found = (doc.signers || []).find(s => s.email?.toLowerCase() === email)
    if (found) {
      setMySigner(found)
      setVerified(true)
      logAuditEvent(doc.id, 'viewed', found.name, email, {}).catch(() => {})
      // Prefill from case data (intake/profile)
      prefillFromCase(found, email).catch(() => {})
    } else {
      alert('This email is not listed as a signer on this document.')
    }
  }

  async function prefillFromCase(signer, email) {
    if (!doc?.case_id) return
    try {
      const { data: intake } = await supabase
        .from('intake_submissions')
        .select('answers')
        .eq('id', doc.case_id)
        .single()
      const a = intake?.answers || {}
      const app = a._application || {}
      const role = signer.role
      const prefill = {}
      // Determine which person we're filling for
      let firstName = '', lastName = '', phone = '', dob = ''
      if (role === 'gc') {
        firstName = a.firstName || ''
        lastName = a.lastName || ''
        phone = a.phone || ''
        dob = a.dob || ''
      } else if (role === 'partner') {
        firstName = app.spouseFirstName || ''
        lastName = app.spouseLastName || ''
        phone = app.spousePhone || ''
        dob = app.spouseDob || ''
      } else if (role === 'ip1') {
        firstName = a.primaryFirstName || ''
        lastName = a.primaryLastName || ''
        phone = a.primaryPhone || a.phone || ''
        dob = a.primaryDob || ''
      } else if (role === 'ip2') {
        firstName = a.ip2FirstName || ''
        lastName = a.ip2LastName || ''
        phone = a.ip2Phone || ''
        dob = a.ip2Dob || ''
      }
      if (firstName) prefill.firstName = firstName
      if (lastName) prefill.lastName = lastName
      if (phone) prefill.phone = phone
      if (dob) prefill.dob = dob
      if (Object.keys(prefill).length) {
        setFieldValues(prev => ({ ...prefill, ...prev }))
      }
    } catch (err) {
      console.error('Prefill failed:', err)
    }
  }

  function updateField(id, value) {
    setFieldValues(prev => ({ ...prev, [id]: value }))
  }

  async function handleSubmit() {
    if (!doc || !mySigner || !template || signing) return

    // Validate required fields
    const missing = template.fields.filter(f => f.required && !fieldValues[f.id])
    if (missing.length > 0) {
      alert(`Please fill in: ${missing.map(f => f.label).join(', ')}`)
      return
    }
    const unsignedSigs = template.signatures.filter(s => !signatures[s.id])
    if (unsignedSigs.length > 0) {
      alert(`Please sign: ${unsignedSigs.map(s => s.label).join(', ')}`)
      return
    }

    setSigning(true)
    try {
      // Generate filled PDF HTML
      const generateHtml = template.formType === 'ip_background' ? generateIPBackgroundWaiverHtml : generateBackgroundWaiverHtml
      const filledHtml = generateHtml(fieldValues, signatures, {
        signerName: mySigner.name,
        signerEmail: mySigner.email,
        forPdf: true,
      })
      const auditHtml = generateAuditTrailHtml(mySigner.name, mySigner.email, signatures)

      // Sign the document
      const signatureData = {
        type: 'form_template',
        fieldValues,
        signatures: Object.fromEntries(
          Object.entries(signatures).map(([k, v]) => [k, { type: v.type, name: v.name }])
        ),
      }
      await signDocument(doc.id, mySigner.email, signatureData)

      // Upload signed HTML
      const signedBlob = new Blob([filledHtml + auditHtml], { type: 'text/html' })
      const signedPath = `documents/signed_form_${doc.id}_${Date.now()}.html`
      await supabase.storage.from('esign-documents').upload(signedPath, signedBlob, { contentType: 'text/html' })

      // Generate PDF
      try {
        const html2canvas = (await import('html2canvas')).default
        const { jsPDF } = await import('jspdf')

        const overlay = document.createElement('div')
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:white;z-index:99999;display:flex;align-items:center;justify-content:center;'
        overlay.innerHTML = '<p style="color:#283693;font-size:18px;font-weight:600;">Generating PDF...</p>'
        document.body.appendChild(overlay)

        // Page 1: filled form
        const page1 = document.createElement('div')
        page1.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:white;z-index:99998;padding:20px 40px;'
        page1.innerHTML = filledHtml
        document.body.appendChild(page1)

        // Page 2: audit trail
        const page2 = document.createElement('div')
        page2.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:white;z-index:99997;'
        page2.innerHTML = auditHtml
        document.body.appendChild(page2)

        await new Promise(r => setTimeout(r, 800))

        const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
        const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })

        document.body.removeChild(page1)
        document.body.removeChild(page2)
        document.body.removeChild(overlay)

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' })
        const pageWidth = 8.5, pageHeight = 11

        const img1 = canvas1.toDataURL('image/jpeg', 0.95)
        const img1Height = (canvas1.height * pageWidth) / canvas1.width
        let yOff = 0
        while (yOff < img1Height) {
          if (yOff > 0) pdf.addPage()
          pdf.addImage(img1, 'JPEG', 0, -yOff, pageWidth, img1Height)
          yOff += pageHeight
        }

        pdf.addPage()
        const img2 = canvas2.toDataURL('image/jpeg', 0.95)
        const img2Height = (canvas2.height * pageWidth) / canvas2.width
        pdf.addImage(img2, 'JPEG', 0, 0, pageWidth, img2Height)

        const pdfBlob = pdf.output('blob')
        const pdfPath = `documents/signed_form_${doc.id}_${Date.now()}.pdf`
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
        console.error('PDF failed:', pdfErr)
      }

      // Auto-create task for the assigned case manager to request the background check
      try {
        if (doc.case_id) {
          const { data: caseRow } = await supabase
            .from('intake_submissions')
            .select('assigned_to')
            .eq('id', doc.case_id)
            .single()
          const assignee = caseRow?.assigned_to
          if (assignee) {
            const { createCaseTask } = await import('@/lib/db')
            await createCaseTask({
              case_id: doc.case_id,
              case_type: 'surrogate',
              title: `Request Background Check - ${mySigner.name}`,
              assigned_to: assignee,
              due_date: new Date().toISOString().split('T')[0],
              priority: 'high',
              status: 'open',
              created_by: 'system',
            })
          }
        }
      } catch (taskErr) { console.error('Auto-task creation failed:', taskErr) }

      setDone(true)
    } catch (err) {
      alert('Failed to submit: ' + err.message)
    } finally {
      setSigning(false)
    }
  }

  // ── Render ──
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-[#283693]" />
    </div>
  )

  if (!doc || !template) return (
    <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white flex items-center justify-center">
      <Card className="max-w-md"><CardContent className="p-8 text-center">
        <FileText className="size-12 text-stone-300 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-stone-700">Form Not Found</h2>
        <p className="text-sm text-stone-400 mt-2">This form link may have expired or already been completed.</p>
      </CardContent></Card>
    </div>
  )

  if (done) return (
    <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white flex items-center justify-center">
      <Card className="max-w-md"><CardContent className="p-8 text-center">
        <CheckCircle2 className="size-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-green-700">Form Submitted</h2>
        <p className="text-sm text-stone-500 mt-2">Your signed {template.title} has been submitted. A PDF copy has been saved to your case file.</p>
      </CardContent></Card>
    </div>
  )

  // ── Email Verification ──
  if (!verified) return (
    <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <img src="/abc-logo.png" alt="ABC Surrogacy" className="h-16 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#283693]">{template.title}</h2>
            <p className="text-sm text-stone-500 mt-1">Verify your email to continue</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-stone-600">Email Address</label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={signerEmail}
                  onChange={e => setSignerEmail(e.target.value)}
                  placeholder="your@email.com"
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                />
                <Button onClick={handleVerify} className="shrink-0" style={{ backgroundColor: '#283693' }}>
                  <Mail className="size-4 mr-1" /> Verify
                </Button>
              </div>
            </div>
            <p className="text-xs text-stone-400 flex items-center gap-1"><Shield className="size-3" /> Your information is encrypted and secure</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ── Form Filling ──
  const generatePreviewHtml = template.formType === 'ip_background' ? generateIPBackgroundWaiverHtml : generateBackgroundWaiverHtml
  const previewHtml = generatePreviewHtml(fieldValues, signatures, {
    signerName: mySigner.name,
    signerEmail: mySigner.email,
    forPdf: false,
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white">
      <div className="max-w-2xl mx-auto py-6 px-3 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <img src="/abc-logo.png" alt="ABC Surrogacy" className="h-8 sm:h-10 mb-2" />
            <h1 className="text-lg sm:text-xl font-bold text-[#283693]">{template.title}</h1>
            <p className="text-xs sm:text-sm text-stone-500">Signed in as {mySigner.name} ({mySigner.email})</p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={signing}
            className="gap-2 w-full sm:w-auto shrink-0"
            style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }}
          >
            {signing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {signing ? 'Submitting...' : 'Sign & Submit'}
          </Button>
        </div>

        {/* Form fields panel */}
        <Card className="mb-6">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-sm font-bold text-[#283693] uppercase tracking-wider mb-4">Fill in your information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {template.fields.map(f => {
                if (f.type === 'radio') {
                  return (
                    <div key={f.id} className="col-span-2 space-y-1">
                      <label className="text-xs font-medium text-stone-500">{f.label} {f.required && <span className="text-red-400">*</span>}</label>
                      <div className="flex gap-4">
                        {f.options.map(opt => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="radio" name={f.id} checked={fieldValues[f.id] === opt}
                              onChange={() => updateField(f.id, opt)}
                              className="accent-[#283693]" />
                            {opt === 'yes' ? 'Yes — receive a copy' : 'No — do not receive a copy'}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                }
                if (f.type === 'select') {
                  return (
                    <div key={f.id} className="space-y-1">
                      <label className="text-xs font-medium text-stone-500">{f.label} {f.required && <span className="text-red-400">*</span>}</label>
                      <select
                        value={fieldValues[f.id] || ''}
                        onChange={e => updateField(f.id, e.target.value)}
                        className="w-full h-9 text-sm border border-stone-200 rounded-md px-2 bg-white"
                      >
                        <option value="">Select…</option>
                        {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  )
                }
                return (
                  <div key={f.id} className="space-y-1">
                    <label className="text-xs font-medium text-stone-500">{f.label} {f.required && <span className="text-red-400">*</span>}</label>
                    <Input
                      type={f.type === 'date' ? 'date' : 'text'}
                      value={fieldValues[f.id] || ''}
                      onChange={e => {
                        let v = e.target.value
                        if (f.id === 'ssn') {
                          // Auto-format as xxx-xx-xxxx
                          const digits = v.replace(/\D/g, '').slice(0, 9)
                          if (digits.length <= 3) v = digits
                          else if (digits.length <= 5) v = `${digits.slice(0, 3)}-${digits.slice(3)}`
                          else v = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
                        }
                        updateField(f.id, v)
                      }}
                      placeholder={f.id === 'ssn' ? 'xxx-xx-xxxx' : undefined}
                      maxLength={f.id === 'ssn' ? 11 : undefined}
                      className="h-9"
                    />
                  </div>
                )
              })}
            </div>

            {/* Signatures */}
            <div className="mt-5 pt-5 border-t space-y-5">
              <h3 className="text-sm font-bold text-[#ed148c] uppercase tracking-wider">Signatures</h3>
              {template.signatures.map(s => (
                <div key={s.id} className="space-y-2">
                  <label className="text-xs font-medium text-stone-500">{s.label} <span className="text-red-400">*</span></label>
                  {activeSigId === s.id ? (
                    <div>
                      <SignaturePad
                        value={signatures[s.id]}
                        onChange={val => {
                          setSignatures(prev => ({ ...prev, [s.id]: val }))
                          // Only auto-close for drawn signatures (fires once on mouseup)
                          // Typed signatures fire on every keystroke — close via "Done" button
                          if (val?.type === 'drawn') setActiveSigId(null)
                        }}
                        signerName={mySigner.name}
                      />
                      <button onClick={() => setActiveSigId(null)} className="text-xs text-stone-400 hover:underline mt-1">Done</button>
                    </div>
                  ) : signatures[s.id] ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                      {signatures[s.id].type === 'drawn' && signatures[s.id].image ? (
                        <img src={signatures[s.id].image} alt="signature" style={{ height: 32 }} />
                      ) : (
                        <span className="text-sm font-serif italic text-[#283693]">{signatures[s.id].name || 'Signed'}</span>
                      )}
                      <button onClick={() => setActiveSigId(s.id)} className="text-xs text-stone-400 hover:underline ml-auto">Re-sign</button>
                    </div>
                  ) : (
                    <button onClick={() => setActiveSigId(s.id)} className="w-full p-3 border-2 border-dashed border-[#ed148c]/30 rounded-lg text-sm text-[#ed148c] hover:bg-[#ed148c]/5 transition-colors">
                      Click to sign
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Document Preview — hidden on mobile for cleaner UX, shown on desktop */}
        <Card className="hidden sm:block">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-4">Document Preview</h3>
            <div className="border rounded-xl p-6 bg-white text-sm overflow-x-auto [&_table]:w-full [&_td]:text-xs [&_td]:py-1" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </CardContent>
        </Card>

        {/* Mobile submit button at bottom */}
        <div className="sm:hidden pt-4 pb-8">
          <Button
            onClick={handleSubmit}
            disabled={signing}
            className="gap-2 w-full py-3 text-base"
            style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }}
          >
            {signing ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
            {signing ? 'Submitting...' : 'Sign & Submit'}
          </Button>
          <p className="text-[10px] text-stone-400 text-center mt-2">Electronically signed via ABC Surrogacy in accordance with the ESIGN Act.</p>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, CheckCircle2, Loader2, Mail, Shield, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { logAuditEvent, signDocument } from '@/lib/esign'
import { FORM_TEMPLATES, generateBackgroundWaiverHtml, generateIPBackgroundWaiverHtml, generateAuditTrailHtml, generateReleasePageHtml, generateReleaseFormHtml } from '@/lib/formTemplates'

// ── Inline Signature Pad (drawn + typed) ──
function SignaturePad({ value, onChange, signerName }) {
  const [mode, setMode] = useState('typed')
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)

  function getXY(canvas, e) {
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0
    const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0
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
export default function BatchSignFormPage() {
  const { batchToken } = useParams()
  const [docs, setDocs] = useState([])
  const [templates, setTemplates] = useState({}) // docId -> template
  const [loading, setLoading] = useState(true)
  const [signerEmail, setSignerEmail] = useState('')
  const [verified, setVerified] = useState(false)
  const [mySigner, setMySigner] = useState(null)
  // Per-doc state, keyed by doc.id
  const [stateByDoc, setStateByDoc] = useState({}) // { [docId]: { fieldValues, signatures, initials } }
  const [activeIdx, setActiveIdx] = useState(0)
  const [activeSigId, setActiveSigId] = useState(null)
  const [signedDocIds, setSignedDocIds] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const [validationError, setValidationError] = useState(null)

  // Load all docs with this batchToken
  useEffect(() => {
    if (!batchToken || !supabase) { setLoading(false); return }
    supabase.from('esign_documents')
      .select('*')
      .in('status', ['pending', 'partially_signed'])
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const batch = (data || []).filter(d => {
          try { return JSON.parse(d.document_hash || '{}').batchToken === batchToken } catch { return false }
        })
        setDocs(batch)
        const tpls = {}
        for (const d of batch) {
          try {
            const meta = JSON.parse(d.document_hash || '{}')
            const tpl = FORM_TEMPLATES[meta.templateId]
            if (tpl) tpls[d.id] = tpl
          } catch {}
        }
        setTemplates(tpls)
      })
      .finally(() => setLoading(false))
  }, [batchToken])

  function handleVerify() {
    if (!signerEmail.trim() || !docs.length) return
    const email = signerEmail.trim().toLowerCase()
    // Signer must appear on at least one doc
    let found = null
    for (const d of docs) {
      const match = (d.signers || []).find(s => s.email?.toLowerCase() === email)
      if (match) { found = match; break }
    }
    if (!found) {
      alert('This email is not listed as a signer on these documents.')
      return
    }
    setMySigner(found)
    setVerified(true)
    // Filter docs to only those where this email is a signer and hasn't signed yet
    const relevant = docs.filter(d => (d.signers || []).some(s =>
      s.email?.toLowerCase() === email && s.status !== 'signed'
    ))
    setDocs(relevant)
    for (const d of relevant) logAuditEvent(d.id, 'viewed', found.name, email, {}).catch(() => {})
    prefillAll(relevant, found, email).catch(() => {})
  }

  async function prefillAll(relevantDocs, signer, email) {
    const byDoc = {}
    for (const d of relevantDocs) {
      byDoc[d.id] = { fieldValues: {}, signatures: {}, initials: {} }
      if (!d.case_id) continue
      try {
        const { data: intake } = await supabase
          .from('intake_submissions').select('answers').eq('id', d.case_id).single()
        const a = intake?.answers || {}
        const app = a._application || {}
        const prefill = {}

        const role = signer.role
        let firstName = '', lastName = '', phone = '', dob = ''
        if (role === 'gc') { firstName = a.firstName || ''; lastName = a.lastName || ''; phone = a.phone || ''; dob = a.dob || '' }
        else if (role === 'partner') { firstName = app.spouseFirstName || ''; lastName = app.spouseLastName || ''; phone = app.spousePhone || ''; dob = app.spouseDob || '' }

        if (firstName) prefill.firstName = firstName
        if (lastName) prefill.lastName = lastName
        if (phone) prefill.phone = phone
        if (dob) prefill.dob = dob

        const tpl = templates[d.id]
        if (tpl?.layoutMode === 'doc-first') {
          const gcFull = [a.firstName, a.lastName].filter(Boolean).join(' ').trim()
          const partnerFull = [app.spouseFirstName, app.spouseLastName].filter(Boolean).join(' ').trim()
          const confidential = a._confidential || {}
          const streetLine = [confidential.streetAddress, confidential.aptNumber].filter(Boolean).join(' ').trim()
          const cityStateZipLine = [confidential.city, [confidential.state, confidential.zipCode].filter(Boolean).join(' ')].filter(Boolean).join(', ').trim()
          if (gcFull) prefill.gcName = gcFull
          if (a.email) prefill.gcEmail = a.email
          if (partnerFull) prefill.partnerName = partnerFull
          if (streetLine) prefill.streetAddress = streetLine
          if (cityStateZipLine) prefill.cityStateZip = cityStateZipLine
          if (role === 'admin' && signer.name) prefill.adminName = signer.name
        }
        byDoc[d.id].fieldValues = prefill
      } catch {}
    }
    setStateByDoc(byDoc)
  }

  function updateDocState(docId, patch) {
    setStateByDoc(prev => ({
      ...prev,
      [docId]: { ...(prev[docId] || { fieldValues: {}, signatures: {}, initials: {} }), ...patch },
    }))
  }

  /**
   * Validate + sign the currently-active doc.
   * Returns { ok: true } on success; { ok: false, error } on validation fail.
   * Callers MUST check `ok` — otherwise advancing to the next doc would
   * skip a doc that was never actually signed.
   */
  async function signCurrentDoc() {
    const doc = docs[activeIdx]
    if (!doc || !mySigner) return { ok: false, error: 'No active document' }
    const template = templates[doc.id]
    if (!template) return { ok: false, error: 'Template not recognized' }

    const state = stateByDoc[doc.id] || { fieldValues: {}, signatures: {}, initials: {} }
    const { fieldValues, signatures, initials } = state
    const isDocFirst = template.layoutMode === 'doc-first'

    // Collect required sig/init ids for my role
    let requiredSigIds = []
    let requiredInitIds = []
    if (isDocFirst) {
      for (const page of (template.pages || [])) {
        if (mySigner.role === 'gc') {
          requiredSigIds.push(...(page.gcSignatures || []).map(s => s.id))
          requiredInitIds.push(...(page.gcInitials || []).map(s => s.id))
        } else if (mySigner.role === 'partner') {
          requiredSigIds.push(...(page.partnerSignatures || []).map(s => s.id))
          requiredInitIds.push(...(page.partnerInitials || []).map(s => s.id))
        } else if (mySigner.role === 'admin') {
          requiredSigIds.push(...(page.adminSignatures || []).map(s => s.id))
          requiredInitIds.push(...(page.adminInitials || []).map(s => s.id))
        }
      }
    } else {
      requiredSigIds = (template.signatures || []).map(s => s.id)
    }

    const missingFields = (template.fields || []).filter(f => f.required && !fieldValues[f.id])
    if (missingFields.length) {
      return { ok: false, error: `Please fill in: ${missingFields.map(f => f.label).join(', ')}` }
    }
    const unsigned = requiredSigIds.filter(id => !signatures[id])
    if (unsigned.length) {
      return { ok: false, error: `Please sign all signature slots (${unsigned.length} remaining).` }
    }
    const missingInits = requiredInitIds.filter(id => !(initials[id] || '').trim())
    if (missingInits.length) {
      return { ok: false, error: `Please enter your initials on all required slots (${missingInits.length} remaining).` }
    }

    try {
      // Build filled HTML (matches SignFormPage)
      let filledHtml
      if (isDocFirst) {
        filledHtml = generateReleaseFormHtml(template, fieldValues, signatures, initials, {
          forPdf: true, signerRole: mySigner.role, signerName: mySigner.name,
        })
      } else {
        const gen = template.formType === 'ip_background' ? generateIPBackgroundWaiverHtml : generateBackgroundWaiverHtml
        filledHtml = gen(fieldValues, signatures, { signerName: mySigner.name, signerEmail: mySigner.email, forPdf: true })
      }
      const auditHtml = generateAuditTrailHtml(mySigner.name, mySigner.email, signatures)

      const signatureData = {
        type: 'form_template',
        fieldValues,
        initials,
        signatures: Object.fromEntries(
          Object.entries(signatures).map(([k, v]) => [k, { type: v.type, name: v.name }])
        ),
      }
      const updated = await signDocument(doc.id, mySigner.email, signatureData)

      // File the signed PDF only when EVERY signer is done on this doc
      const allSignersDone = updated?.status === 'completed'
      if (allSignersDone) {
        // Merge prior signers' data into the final render
        const mergedSigs = { ...signatures }
        const mergedInits = { ...initials }
        const mergedFields = { ...fieldValues }
        const signerDates = {}
        for (const s of (updated.signers || [])) {
          if (s.signedAt && s.role) {
            signerDates[s.role] = new Date(s.signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          }
          if (s.email?.toLowerCase() === mySigner.email?.toLowerCase()) continue
          if (s.formSignatures) for (const [k, v] of Object.entries(s.formSignatures)) if (!mergedSigs[k]) mergedSigs[k] = v
          if (s.formInitials) for (const [k, v] of Object.entries(s.formInitials)) if (!mergedInits[k]) mergedInits[k] = v
          if (s.fieldValues) for (const [k, v] of Object.entries(s.fieldValues)) if (mergedFields[k] === undefined || mergedFields[k] === '') mergedFields[k] = v
        }

        if (isDocFirst) {
          filledHtml = generateReleaseFormHtml(template, mergedFields, mergedSigs, mergedInits, {
            forPdf: true, signerRole: mySigner.role, signerName: mySigner.name, signerDates,
          })
        }

        const signedBlob = new Blob([filledHtml + auditHtml], { type: 'text/html' })
        const signedPath = `documents/signed_form_${doc.id}_${Date.now()}.html`
        await supabase.storage.from('esign-documents').upload(signedPath, signedBlob, { contentType: 'text/html' })

        try {
          const html2canvas = (await import('html2canvas')).default
          const { jsPDF } = await import('jspdf')
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' })
          const pageWidth = 8.5, pageHeight = 11

          if (isDocFirst) {
            const pagesArr = template.pages || []
            let pdfHasPage = false
            for (const page of pagesArr) {
              const pageDiv = document.createElement('div')
              pageDiv.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:white;z-index:99998;padding:40px;'
              pageDiv.innerHTML = generateReleasePageHtml(page.id, template, mergedFields, mergedSigs, mergedInits, {
                forPdf: true, signerRole: mySigner.role, signerName: mySigner.name, signerDates,
              })
              document.body.appendChild(pageDiv)
              await new Promise(r => setTimeout(r, 200))
              const c = await html2canvas(pageDiv, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
              document.body.removeChild(pageDiv)
              const img = c.toDataURL('image/jpeg', 0.95)
              const imgH = (c.height * pageWidth) / c.width
              if (pdfHasPage) pdf.addPage()
              pdfHasPage = true
              let yOff = 0
              while (yOff < imgH) {
                if (yOff > 0) pdf.addPage()
                pdf.addImage(img, 'JPEG', 0, -yOff, pageWidth, imgH)
                yOff += pageHeight
              }
            }
            const auditDiv = document.createElement('div')
            auditDiv.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:white;z-index:99997;'
            auditDiv.innerHTML = auditHtml
            document.body.appendChild(auditDiv)
            await new Promise(r => setTimeout(r, 200))
            const auditCanvas = await html2canvas(auditDiv, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
            document.body.removeChild(auditDiv)
            pdf.addPage()
            const auditImg = auditCanvas.toDataURL('image/jpeg', 0.95)
            pdf.addImage(auditImg, 'JPEG', 0, 0, pageWidth, (auditCanvas.height * pageWidth) / auditCanvas.width)
          } else {
            // Background waiver — render each section as its own PDF page to
            // avoid html2canvas slicing through the middle of a section box.
            const genHtml = template.formType === 'ip_background' ? generateIPBackgroundWaiverHtml : generateBackgroundWaiverHtml
            let bgPdfHasPage = false
            for (const sec of [1, 2, 3]) {
              const sHtml = genHtml(fieldValues, signatures, {
                signerName: mySigner.name, signerEmail: mySigner.email, forPdf: true, section: sec,
              })
              const sDiv = document.createElement('div')
              sDiv.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:white;z-index:99998;padding:20px 40px;'
              sDiv.innerHTML = sHtml
              document.body.appendChild(sDiv)
              await new Promise(r => setTimeout(r, 200))
              const sc = await html2canvas(sDiv, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
              document.body.removeChild(sDiv)
              const si = sc.toDataURL('image/jpeg', 0.95)
              const siH = (sc.height * pageWidth) / sc.width
              if (bgPdfHasPage) pdf.addPage()
              bgPdfHasPage = true
              let sy = 0
              while (sy < siH) { if (sy > 0) pdf.addPage(); pdf.addImage(si, 'JPEG', 0, -sy, pageWidth, siH); sy += pageHeight }
            }
            const auditDiv2 = document.createElement('div')
            auditDiv2.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:white;z-index:99997;'
            auditDiv2.innerHTML = auditHtml
            document.body.appendChild(auditDiv2)
            await new Promise(r => setTimeout(r, 200))
            const c2 = await html2canvas(auditDiv2, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
            document.body.removeChild(auditDiv2)
            pdf.addPage()
            const i2 = c2.toDataURL('image/jpeg', 0.95)
            pdf.addImage(i2, 'JPEG', 0, 0, pageWidth, (c2.height * pageWidth) / c2.width)
          }

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
          // Auto-task for the assigned admin once the whole batch completes.
          try {
            const { maybeCreateSigningCompletionTask } = await import('@/lib/batchCompletionTask')
            await maybeCreateSigningCompletionTask(updated)
          } catch (taskErr) { console.error('Batch completion task failed:', taskErr) }
        } catch (pdfErr) { console.error('PDF gen failed:', pdfErr) }
      }

      setSignedDocIds(prev => new Set([...prev, doc.id]))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: `Failed to submit: ${err.message || 'Unknown error'}` }
    }
  }

  async function handleSignCurrent() {
    if (submitting) return
    setValidationError(null)
    // Require the agreement checkbox before attempting submission
    const activeDocNow = docs[activeIdx]
    if (!activeDocNow) return
    const agreed = document.getElementById(`agree-${activeDocNow.id}`)?.checked
    if (!agreed) {
      setValidationError('Please agree to the terms before submitting.')
      return
    }
    setSubmitting(true)
    try {
      const res = await signCurrentDoc()
      if (!res?.ok) {
        setValidationError(res?.error || 'Could not submit this document.')
        return
      }
      // Only advance when the current doc was actually signed
      if (activeIdx < docs.length - 1) {
        setActiveIdx(activeIdx + 1)
        setActiveSigId(null)
      } else {
        setAllDone(true)
      }
    } finally { setSubmitting(false) }
  }

  // ── Render ──
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-[#283693]" />
    </div>
  )

  if (!docs.length) return (
    <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white flex items-center justify-center">
      <Card className="max-w-md"><CardContent className="p-8 text-center">
        <FileText className="size-12 text-stone-300 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-stone-700">Batch Not Found</h2>
        <p className="text-sm text-stone-400 mt-2">This signing link may have expired or all documents were already completed.</p>
      </CardContent></Card>
    </div>
  )

  if (allDone) return (
    <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white flex items-center justify-center">
      <Card className="max-w-md"><CardContent className="p-8 text-center">
        <CheckCircle2 className="size-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-green-700">All Documents Submitted</h2>
        <p className="text-sm text-stone-500 mt-2">Thank you. Your signed forms have been recorded.</p>
      </CardContent></Card>
    </div>
  )

  if (!verified) return (
    <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <img src="/abc-logo.png" alt="ABC Surrogacy" className="h-16 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#283693]">Sign {docs.length} Documents</h2>
            <p className="text-sm text-stone-500 mt-1">Verify your email to begin</p>
          </div>
          <ul className="text-xs text-stone-500 mb-4 space-y-1 list-disc pl-5">
            {docs.map(d => <li key={d.id}>{d.title}</li>)}
          </ul>
          <div className="space-y-3">
            <label className="text-sm font-medium text-stone-600">Email Address</label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={signerEmail}
                onChange={e => setSignerEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                placeholder="your@email.com"
              />
              <Button onClick={handleVerify} className="shrink-0" style={{ backgroundColor: '#283693' }}>
                <Mail className="size-4 mr-1" /> Verify
              </Button>
            </div>
            <p className="text-xs text-stone-400 flex items-center gap-1"><Shield className="size-3" /> Your information is encrypted and secure</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ── Active doc view ──
  const activeDoc = docs[activeIdx]
  const template = templates[activeDoc?.id]
  if (!template) return (
    <div className="p-6 text-sm text-stone-500">Document template not recognized. Please contact the sender.</div>
  )

  const state = stateByDoc[activeDoc.id] || { fieldValues: {}, signatures: {}, initials: {} }
  const { fieldValues, signatures, initials } = state
  const isDocFirst = template.layoutMode === 'doc-first'
  const alreadySignedHere = signedDocIds.has(activeDoc.id)

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white">
      <div className="max-w-3xl mx-auto py-6 px-3 sm:px-6">
        {/* Header + stepper */}
        <div className="text-center mb-4">
          <img src="/abc-logo.png" alt="ABC Surrogacy" className="h-10 sm:h-12 mx-auto mb-3" />
          <p className="text-xs text-stone-500">Document {activeIdx + 1} of {docs.length} &middot; Signing as {mySigner.name}</p>
          <h1 className="text-xl sm:text-2xl font-bold text-[#283693] mt-1">{template.title}</h1>
        </div>

        {/* Stepper pills */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap mb-5">
          {docs.map((d, i) => (
            <div key={d.id} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${
              signedDocIds.has(d.id) ? 'bg-green-100 text-green-700'
                : i === activeIdx ? 'bg-[#283693] text-white'
                : 'bg-stone-100 text-stone-500'
            }`}>
              {signedDocIds.has(d.id) ? <CheckCircle2 className="size-3" /> : <span>{i + 1}</span>}
              <span className="truncate max-w-[140px]">{templates[d.id]?.title || `Doc ${i + 1}`}</span>
            </div>
          ))}
        </div>

        {/* Background waiver (fields + sigs in a card) */}
        {!isDocFirst && (
          <Card className="mb-5">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-sm font-bold text-[#283693] uppercase tracking-wider mb-4">Fill in your information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(template.fields || []).map(f => (
                  <div key={f.id} className={`space-y-1 ${f.type === 'radio' || f.id === 'phone' ? 'sm:col-span-2' : ''}`}>
                    <label className="text-xs font-medium text-stone-500">{f.label} {f.required && <span className="text-red-400">*</span>}</label>
                    {f.type === 'radio' ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                        {f.options.map(opt => (
                          <label key={opt} className="flex items-center gap-1.5 text-sm">
                            <input type="radio" name={f.id} checked={fieldValues[f.id] === opt}
                              onChange={() => updateDocState(activeDoc.id, { fieldValues: { ...fieldValues, [f.id]: opt } })}
                              className="accent-[#283693]" />
                            {opt === 'yes' ? 'Yes' : opt === 'no' ? 'No' : opt}
                          </label>
                        ))}
                      </div>
                    ) : f.type === 'select' ? (
                      <select
                        value={fieldValues[f.id] || ''}
                        onChange={e => updateDocState(activeDoc.id, { fieldValues: { ...fieldValues, [f.id]: e.target.value } })}
                        className="block h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm">
                        <option value="">Select…</option>
                        {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <Input
                        type={f.type === 'date' ? 'date' : 'text'}
                        value={fieldValues[f.id] || ''}
                        onChange={e => {
                          let v = e.target.value
                          if (f.id === 'ssn') {
                            const digits = v.replace(/\D/g, '').slice(0, 9)
                            if (digits.length <= 3) v = digits
                            else if (digits.length <= 5) v = `${digits.slice(0, 3)}-${digits.slice(3)}`
                            else v = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
                          }
                          updateDocState(activeDoc.id, { fieldValues: { ...fieldValues, [f.id]: v } })
                        }}
                        className="h-10"
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Signatures */}
              <div className="mt-5 pt-5 border-t space-y-4">
                <h3 className="text-sm font-bold text-[#ed148c] uppercase tracking-wider">Signatures</h3>
                {(template.signatures || []).map(s => (
                  <div key={s.id} className="space-y-2">
                    <label className="text-xs font-medium text-stone-500">{s.label} <span className="text-red-400">*</span></label>
                    {activeSigId === s.id ? (
                      <div>
                        <SignaturePad
                          value={signatures[s.id]}
                          onChange={val => {
                            updateDocState(activeDoc.id, { signatures: { ...signatures, [s.id]: val } })
                            if (val?.type === 'drawn') setActiveSigId(null)
                          }}
                          signerName={mySigner.name}
                        />
                        <button onClick={() => setActiveSigId(null)} className="text-xs text-stone-400 hover:underline mt-1">Done</button>
                      </div>
                    ) : signatures[s.id] ? (
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <CheckCircle2 className="size-4 text-green-500" />
                        {signatures[s.id].type === 'drawn' && signatures[s.id].image ? (
                          <img src={signatures[s.id].image} alt="signature" style={{ height: 32 }} />
                        ) : (
                          <span className="text-sm font-serif italic text-[#283693]">{signatures[s.id].name || 'Signed'}</span>
                        )}
                        <button onClick={() => setActiveSigId(s.id)} className="text-xs text-stone-400 hover:underline ml-auto">Re-sign</button>
                      </div>
                    ) : (
                      <button onClick={() => setActiveSigId(s.id)} className="w-full p-3 border-2 border-dashed border-[#ed148c]/30 rounded-lg text-sm text-[#ed148c] hover:bg-[#ed148c]/5">Click to sign</button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Doc-first (release form) pages */}
        {isDocFirst && (template.fields || []).length > 0 && (
          <Card className="mb-5">
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-sm font-bold text-[#283693] uppercase tracking-wider mb-3">Your information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {template.fields.map(f => (
                  <div key={f.id} className="space-y-1">
                    <label className="block text-xs font-medium text-stone-500">{f.label} {f.required && <span className="text-red-400">*</span>}</label>
                    <Input
                      value={fieldValues[f.id] || ''}
                      onChange={e => updateDocState(activeDoc.id, { fieldValues: { ...fieldValues, [f.id]: e.target.value } })}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isDocFirst && (template.pages || []).map((page, pi) => {
          const pageHtml = generateReleasePageHtml(page.id, template, fieldValues, signatures, initials, {
            forPdf: false, signerRole: mySigner.role, signerName: mySigner.name,
          })
          const mySigs = mySigner.role === 'gc' ? (page.gcSignatures || [])
            : mySigner.role === 'partner' ? (page.partnerSignatures || [])
            : mySigner.role === 'admin' ? (page.adminSignatures || [])
            : []
          const myInits = mySigner.role === 'gc' ? (page.gcInitials || [])
            : mySigner.role === 'partner' ? (page.partnerInitials || [])
            : mySigner.role === 'admin' ? (page.adminInitials || [])
            : []
          return (
            <Card key={page.id} className="mb-5">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-white bg-[#283693] rounded-full size-7 flex items-center justify-center">{pi + 1}</span>
                  <div>
                    <p className="font-semibold text-stone-800 text-sm sm:text-base">{page.title}</p>
                    <p className="text-[11px] text-stone-400">Page {pi + 1} of {(template.pages || []).length}</p>
                  </div>
                </div>
                <div className="border rounded-lg p-3 sm:p-5 bg-white max-h-[420px] overflow-y-auto text-xs sm:text-sm" dangerouslySetInnerHTML={{ __html: pageHtml }} />

                {myInits.length > 0 && (
                  <div className="space-y-2 pt-3 border-t">
                    <h4 className="text-xs font-bold text-[#ed148c] uppercase tracking-wider">Your initials</h4>
                    {myInits.map(init => (
                      <div key={init.id} className="flex items-center gap-3">
                        <label className="text-xs font-medium text-stone-500 min-w-[120px]">Initials</label>
                        <Input
                          value={initials[init.id] || ''}
                          onChange={e => updateDocState(activeDoc.id, { initials: { ...initials, [init.id]: e.target.value.slice(0, 4).toUpperCase() } })}
                          placeholder="ABC" maxLength={4}
                          className="h-10 w-24 font-serif italic text-center"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {mySigs.length > 0 && (
                  <div className="space-y-3 pt-3 border-t">
                    <h4 className="text-xs font-bold text-[#ed148c] uppercase tracking-wider">Your signature</h4>
                    {mySigs.map(sig => (
                      <div key={sig.id}>
                        {activeSigId === sig.id ? (
                          <div>
                            <SignaturePad
                              value={signatures[sig.id]}
                              onChange={val => {
                                updateDocState(activeDoc.id, { signatures: { ...signatures, [sig.id]: val } })
                                if (val?.type === 'drawn') setActiveSigId(null)
                              }}
                              signerName={mySigner.name}
                            />
                            <button onClick={() => setActiveSigId(null)} className="text-xs text-stone-400 hover:underline mt-1">Done</button>
                          </div>
                        ) : signatures[sig.id] ? (
                          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <CheckCircle2 className="size-4 text-green-500" />
                            {signatures[sig.id].type === 'drawn' && signatures[sig.id].image ? (
                              <img src={signatures[sig.id].image} alt="signature" style={{ height: 32 }} />
                            ) : (
                              <span className="text-sm font-serif italic text-[#283693]">{signatures[sig.id].name || 'Signed'}</span>
                            )}
                            <button onClick={() => setActiveSigId(sig.id)} className="text-xs text-stone-400 hover:underline ml-auto">Re-sign</button>
                          </div>
                        ) : (
                          <button onClick={() => setActiveSigId(sig.id)} className="w-full p-3 border-2 border-dashed border-[#ed148c]/30 rounded-lg text-sm text-[#ed148c] hover:bg-[#ed148c]/5">Click to sign</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {/* Bottom actions: sign current, advance */}
        <div className="flex flex-col items-center gap-3 pt-2 pb-10">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" id={`agree-${activeDoc.id}`} className="size-4 accent-[#283693]" onChange={() => setValidationError(null)} />
            <span>I agree that my electronic signature is legally binding</span>
          </label>

          {/* In-platform validation banner (replaces browser alert). Stays
              visible until the signer fixes the issue — NO silent dismissal. */}
          {validationError && (
            <div role="alert" className="w-full max-w-md flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <svg className="size-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2L1 21h22L12 2zm0 7v4m0 3h.01" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
              <div className="flex-1 whitespace-pre-line">{validationError}</div>
              <button onClick={() => setValidationError(null)} className="text-red-500 hover:text-red-700 font-semibold">&times;</button>
            </div>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeIdx > 0 && (
              <Button variant="outline" onClick={() => { setValidationError(null); setActiveIdx(activeIdx - 1); setActiveSigId(null) }} className="gap-1">
                <ChevronLeft className="size-4" /> Back
              </Button>
            )}
            <Button
              onClick={handleSignCurrent}
              disabled={submitting || alreadySignedHere}
              size="lg"
              className="gap-2 flex-1 sm:flex-none sm:px-8"
              style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }}
            >
              {submitting ? <Loader2 className="size-5 animate-spin" />
                : activeIdx < docs.length - 1 ? <ChevronRight className="size-5" />
                : <CheckCircle2 className="size-5" />}
              {submitting
                ? 'Submitting...'
                : activeIdx < docs.length - 1 ? 'Sign & Continue'
                : 'Sign & Finish'}
            </Button>
          </div>
          <p className="text-[10px] text-stone-400 text-center">Electronically signed via ABC Surrogacy in accordance with the ESIGN Act.</p>
        </div>
      </div>
    </div>
  )
}

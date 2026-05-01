import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { FileText, CheckCircle2, Loader2, Mail, Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { logAuditEvent, signDocument } from '@/lib/esign'
import { FORM_TEMPLATES, generateBackgroundWaiverHtml, generateIPBackgroundWaiverHtml, generateAuditTrailHtml, generateReleasePageHtml, generateReleaseFormHtml } from '@/lib/formTemplates'
import PdfOverlaySigner from '@/components/esign/PdfOverlaySigner'
import { appendAuditTrailPage } from '@/lib/pdfOverlay'

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
  const [initials, setInitials] = useState({})
  const [activeSigId, setActiveSigId] = useState(null)
  const [signing, setSigning] = useState(false)
  const [done, setDone] = useState(false)
  const [validationError, setValidationError] = useState(null)

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
      } else if (/^householdMember\d+$/.test(role || '')) {
        // householdMember1 → adultHouseholdMembers[0], etc.
        const idx = Number(role.replace('householdMember', '')) - 1
        const m = (Array.isArray(app.adultHouseholdMembers) ? app.adultHouseholdMembers[idx] : null) || {}
        firstName = m.firstName || ''
        lastName = m.lastName || ''
        phone = m.phone || ''
        dob = '' // DOB not collected for household members in the app form
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

      // Release forms (doc-first layout) — prefill the shared person/address context
      const tpl = FORM_TEMPLATES[JSON.parse(doc.document_hash || '{}').templateId]
      if (tpl?.layoutMode === 'doc-first') {
        const gcFirstName = a.firstName || ''
        const gcLastName = a.lastName || ''
        const gcFull = [gcFirstName, gcLastName].filter(Boolean).join(' ').trim()
        const partnerFirstName = app.spouseFirstName || ''
        const partnerLastName = app.spouseLastName || ''
        const partnerFull = [partnerFirstName, partnerLastName].filter(Boolean).join(' ').trim()
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
    setValidationError(null)

    const isDocFirst = template.layoutMode === 'doc-first'

    // Validate required fields
    const missing = (template.fields || []).filter(f => f.required && !fieldValues[f.id])
    if (missing.length > 0) {
      setValidationError(`Please fill in: ${missing.map(f => f.label).join(', ')}`)
      return
    }

    // Gather required sig/initials ids based on layout
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

    const unsignedSigs = requiredSigIds.filter(id => !signatures[id])
    if (unsignedSigs.length > 0) {
      setValidationError(`Please sign all signature slots (${unsignedSigs.length} remaining).`)
      return
    }
    const missingInits = requiredInitIds.filter(id => !(initials[id] || '').trim())
    if (missingInits.length > 0) {
      setValidationError(`Please enter your initials on all required slots (${missingInits.length} remaining).`)
      return
    }

    setSigning(true)
    try {
      // Generate filled PDF HTML
      let filledHtml
      if (isDocFirst) {
        filledHtml = generateReleaseFormHtml(template, fieldValues, signatures, initials, {
          forPdf: true,
          signerRole: mySigner.role,
          signerName: mySigner.name,
        })
      } else {
        const generateHtml = template.formType === 'ip_background' ? generateIPBackgroundWaiverHtml : generateBackgroundWaiverHtml
        filledHtml = generateHtml(fieldValues, signatures, {
          signerName: mySigner.name,
          signerEmail: mySigner.email,
          forPdf: true,
        })
      }
      const auditHtml = generateAuditTrailHtml(mySigner.name, mySigner.email, signatures)

      // Sign the document
      const signatureData = {
        type: 'form_template',
        fieldValues,
        initials,
        signatures: Object.fromEntries(
          Object.entries(signatures).map(([k, v]) => [k, { type: v.type, name: v.name }])
        ),
      }
      const updated = await signDocument(doc.id, mySigner.email, signatureData)

      // Multi-signer forms (e.g. Partnered releases): don't file to the case's
      // Signed Documents folder until ALL parties have signed. Partial signings
      // would otherwise leave duplicate/incomplete PDFs in the folder.
      const allSignersDone = updated?.status === 'completed'
      if (!allSignersDone) {
        setDone(true)
        return
      }

      // Merge previous signers' stored sigs/initials/fieldValues so the final
      // PDF renders EVERYONE's marks, not just this last signer's.
      const mergedSignatures = { ...signatures }
      const mergedInitials = { ...initials }
      const mergedFieldValues = { ...fieldValues }
      const signerDates = {}
      for (const s of (updated.signers || [])) {
        if (s.signedAt && s.role) {
          signerDates[s.role] = new Date(s.signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        }
        if (s.email?.toLowerCase() === mySigner.email?.toLowerCase()) continue
        if (s.formSignatures) {
          for (const [k, v] of Object.entries(s.formSignatures)) {
            if (!mergedSignatures[k]) mergedSignatures[k] = v
          }
        }
        if (s.formInitials) {
          for (const [k, v] of Object.entries(s.formInitials)) {
            if (!mergedInitials[k]) mergedInitials[k] = v
          }
        }
        if (s.fieldValues) {
          for (const [k, v] of Object.entries(s.fieldValues)) {
            if (mergedFieldValues[k] === undefined || mergedFieldValues[k] === '') mergedFieldValues[k] = v
          }
        }
      }

      // Rebuild filled HTML with the merged state so all signers show in the PDF
      if (isDocFirst) {
        filledHtml = generateReleaseFormHtml(template, mergedFieldValues, mergedSignatures, mergedInitials, {
          forPdf: true,
          signerRole: mySigner.role,
          signerName: mySigner.name,
          signerDates,
        })
      }

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

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' })
        const pageWidth = 8.5, pageHeight = 11

        // Doc-first: render each template page as its own PDF page so content
        // doesn't get sliced through mid-paragraph the way a single tall image does.
        if (isDocFirst) {
          const pagesArr = template.pages || []
          let pdfHasPage = false
          for (let p = 0; p < pagesArr.length; p++) {
            const page = pagesArr[p]
            const pageDiv = document.createElement('div')
            pageDiv.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:white;z-index:99998;padding:40px;'
            pageDiv.innerHTML = generateReleasePageHtml(page.id, template, mergedFieldValues, mergedSignatures, mergedInitials, {
              forPdf: true,
              signerRole: mySigner.role,
              signerName: mySigner.name,
              signerDates,
            })
            document.body.appendChild(pageDiv)
            await new Promise(r => setTimeout(r, 200))
            const c = await html2canvas(pageDiv, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
            document.body.removeChild(pageDiv)
            const img = c.toDataURL('image/jpeg', 0.95)
            const imgH = (c.height * pageWidth) / c.width
            if (pdfHasPage) pdf.addPage()
            pdfHasPage = true
            // If a single template page spills beyond one letter page, chunk it.
            let yOffLocal = 0
            while (yOffLocal < imgH) {
              if (yOffLocal > 0) pdf.addPage()
              pdf.addImage(img, 'JPEG', 0, -yOffLocal, pageWidth, imgH)
              yOffLocal += pageHeight
            }
          }

          // Audit trail on its own page
          const page2 = document.createElement('div')
          page2.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:white;z-index:99997;'
          page2.innerHTML = auditHtml
          document.body.appendChild(page2)
          await new Promise(r => setTimeout(r, 200))
          const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
          document.body.removeChild(page2)
          document.body.removeChild(overlay)
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
          // Auto-task for the assigned admin once the whole batch completes.
          try {
            const { maybeCreateSigningCompletionTask } = await import('@/lib/batchCompletionTask')
            await maybeCreateSigningCompletionTask(updated)
          } catch (taskErr) { console.error('Batch completion task failed:', taskErr) }
          setDone(true)
          return
        }

        // Background-waiver path — render each section (intro+sig1, sig2, sig3)
        // as its own PDF page so we don't slice through the middle of a section.
        const genHtml = template.formType === 'ip_background' ? generateIPBackgroundWaiverHtml : generateBackgroundWaiverHtml
        let pdfHasPage = false
        for (const sec of [1, 2, 3]) {
          const sectionHtml = genHtml(fieldValues, signatures, {
            signerName: mySigner.name,
            signerEmail: mySigner.email,
            forPdf: true,
            section: sec,
          })
          const sectionDiv = document.createElement('div')
          sectionDiv.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:white;z-index:99998;padding:20px 40px;'
          sectionDiv.innerHTML = sectionHtml
          document.body.appendChild(sectionDiv)
          await new Promise(r => setTimeout(r, 200))
          const c = await html2canvas(sectionDiv, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
          document.body.removeChild(sectionDiv)
          const img = c.toDataURL('image/jpeg', 0.95)
          const imgH = (c.height * pageWidth) / c.width
          if (pdfHasPage) pdf.addPage()
          pdfHasPage = true
          // Single section should fit on one page; chunk defensively just in case
          let yOff = 0
          while (yOff < imgH) {
            if (yOff > 0) pdf.addPage()
            pdf.addImage(img, 'JPEG', 0, -yOff, pageWidth, imgH)
            yOff += pageHeight
          }
        }

        // Audit trail on its own page
        const auditDiv = document.createElement('div')
        auditDiv.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:white;z-index:99997;'
        auditDiv.innerHTML = auditHtml
        document.body.appendChild(auditDiv)
        await new Promise(r => setTimeout(r, 200))
        const canvas2 = await html2canvas(auditDiv, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
        document.body.removeChild(auditDiv)
        document.body.removeChild(overlay)

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
        // Auto-task for the assigned admin once the whole batch completes.
        try {
          const { maybeCreateSigningCompletionTask } = await import('@/lib/batchCompletionTask')
          await maybeCreateSigningCompletionTask(updated)
        } catch (taskErr) { console.error('Batch completion task failed:', taskErr) }
      } catch (pdfErr) {
        console.error('PDF failed:', pdfErr)
      }

      // Auto-create task for the assigned case manager to request the background check.
      // Only fires for the background-waiver templates — release forms skip this.
      try {
        if (doc.case_id && !isDocFirst) {
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
      setValidationError(`Failed to submit: ${err.message || 'Unknown error'}`)
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

  // ── PDF-overlay templates (e.g. Kaiser — picky facility, must use their PDF) ──
  if (template.layoutMode === 'pdf-overlay') {
    return <KaiserPdfOverlayBranch
      doc={doc}
      template={template}
      mySigner={mySigner}
      currentDocId={doc.id}
      onDone={() => setDone(true)}
      signing={signing}
      setSigning={setSigning}
    />
  }

  // ── Doc-first Release Forms (stacked pages with inline signatures) ──
  if (template.layoutMode === 'doc-first') {
    const pages = template.pages || []
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white">
        <div className="max-w-3xl mx-auto py-6 px-3 sm:px-6">
          <div className="text-center mb-6">
            <img src="/abc-logo.png" alt="ABC Surrogacy" className="h-10 sm:h-12 mx-auto mb-3" />
            <h1 className="text-xl sm:text-2xl font-bold text-[#283693]">{template.title}</h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-1">
              Signed in as {mySigner.name} ({mySigner.email}) &middot; {pages.length} page{pages.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Optional surrogate-provided fields (e.g. address on HIPAA) */}
          {(template.fields || []).length > 0 && (
            <Card className="mb-5">
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-sm font-bold text-[#283693] uppercase tracking-wider mb-3">Your information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {template.fields.map(f => (
                    <div key={f.id} className={`space-y-1 ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                      <label className="block text-xs font-medium text-stone-500">{f.label} {f.required && <span className="text-red-400">*</span>}</label>
                      <Input
                        value={fieldValues[f.id] || ''}
                        onChange={e => updateField(f.id, e.target.value)}
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {pages.map((page, i) => {
            const pageHtml = generateReleasePageHtml(page.id, template, fieldValues, signatures, initials, {
              forPdf: false,
              signerRole: mySigner.role,
              signerName: mySigner.name,
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
                    <span className="text-xs font-bold text-white bg-[#283693] rounded-full size-7 flex items-center justify-center">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-stone-800 text-sm sm:text-base">{page.title}</p>
                      <p className="text-[11px] text-stone-400">Page {i + 1} of {pages.length}</p>
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 sm:p-5 bg-white max-h-[420px] overflow-y-auto text-xs sm:text-sm"
                    dangerouslySetInnerHTML={{ __html: pageHtml }}
                  />

                  {/* Initials for this page */}
                  {myInits.length > 0 && (
                    <div className="space-y-2 pt-3 border-t">
                      <h4 className="text-xs font-bold text-[#ed148c] uppercase tracking-wider">Your initials</h4>
                      {myInits.map(init => (
                        <div key={init.id} className="flex items-center gap-3">
                          <label className="text-xs font-medium text-stone-500 min-w-[120px]">Initials</label>
                          <Input
                            value={initials[init.id] || ''}
                            onChange={e => setInitials(prev => ({ ...prev, [init.id]: e.target.value.slice(0, 4).toUpperCase() }))}
                            placeholder="ABC"
                            maxLength={4}
                            className="h-10 w-24 font-serif italic text-center"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Signatures for this page */}
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
                                  setSignatures(prev => ({ ...prev, [sig.id]: val }))
                                  if (val?.type === 'drawn') setActiveSigId(null)
                                }}
                                signerName={mySigner.name}
                              />
                              <button onClick={() => setActiveSigId(null)} className="text-xs text-stone-400 hover:underline mt-1">Done</button>
                            </div>
                          ) : signatures[sig.id] ? (
                            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                              <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                              {signatures[sig.id].type === 'drawn' && signatures[sig.id].image ? (
                                <img src={signatures[sig.id].image} alt="signature" style={{ height: 32 }} />
                              ) : (
                                <span className="text-sm font-serif italic text-[#283693]">{signatures[sig.id].name || 'Signed'}</span>
                              )}
                              <button onClick={() => setActiveSigId(sig.id)} className="text-xs text-stone-400 hover:underline ml-auto">Re-sign</button>
                            </div>
                          ) : (
                            <button onClick={() => setActiveSigId(sig.id)} className="w-full p-3 border-2 border-dashed border-[#ed148c]/30 rounded-lg text-sm text-[#ed148c] hover:bg-[#ed148c]/5 transition-colors">
                              Click to sign
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          <div className="flex flex-col items-center gap-3 pt-2 pb-10">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" id="agree-docfirst" className="size-4 accent-[#283693]" onChange={() => setValidationError(null)} />
              <span>I agree that my electronic signature is legally binding</span>
            </label>

            {/* In-platform validation banner (replaces browser alert) */}
            {validationError && (
              <div role="alert" className="w-full max-w-md flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <svg className="size-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2L1 21h22L12 2zm0 7v4m0 3h.01" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
                <div className="flex-1 whitespace-pre-line">{validationError}</div>
                <button onClick={() => setValidationError(null)} className="text-red-500 hover:text-red-700 font-semibold">&times;</button>
              </div>
            )}

            <Button
              onClick={() => {
                const agreed = document.getElementById('agree-docfirst')?.checked
                if (!agreed) { setValidationError('Please agree to the terms before submitting.'); return }
                handleSubmit()
              }}
              disabled={signing}
              size="lg"
              className="gap-2 w-full sm:w-auto sm:px-10"
              style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }}
            >
              {signing ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
              {signing ? 'Submitting...' : 'Sign & Submit'}
            </Button>
            <p className="text-[10px] text-stone-400 text-center">Electronically signed via ABC Surrogacy in accordance with the ESIGN Act.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Form Filling ──
  const generatePreviewHtml = template.formType === 'ip_background' ? generateIPBackgroundWaiverHtml : generateBackgroundWaiverHtml
  const previewHtml = generatePreviewHtml(fieldValues, signatures, {
    signerName: mySigner.name,
    signerEmail: mySigner.email,
    forPdf: false,
  })
  const getFieldLayoutClass = (field) => {
    if (field.type === 'radio' || field.id === 'phone') return 'sm:col-span-2'
    return ''
  }

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

        {/* In-platform validation banner (replaces browser alert) */}
        {validationError && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <svg className="size-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2L1 21h22L12 2zm0 7v4m0 3h.01" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
            <div className="flex-1 whitespace-pre-line">{validationError}</div>
            <button onClick={() => setValidationError(null)} className="text-red-500 hover:text-red-700 font-semibold">&times;</button>
          </div>
        )}

        {/* Form fields panel */}
        <Card className="mb-6">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-sm font-bold text-[#283693] uppercase tracking-wider mb-4">Fill in your information</h3>
            <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-4">
              {template.fields.map(f => {
                if (f.type === 'radio') {
                  return (
                    <div key={f.id} className="space-y-2 sm:col-span-2">
                      <label className="block text-xs font-medium leading-tight text-stone-500">{f.label} {f.required && <span className="text-red-400">*</span>}</label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
                        {f.options.map(opt => (
                          <label key={opt} className="flex items-start gap-2 cursor-pointer text-sm leading-tight">
                            <input type="radio" name={f.id} checked={fieldValues[f.id] === opt}
                              onChange={() => updateField(f.id, opt)}
                              className="mt-0.5 accent-[#283693]" />
                            {opt === 'yes' ? 'Yes — receive a copy' : 'No — do not receive a copy'}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                }
                if (f.type === 'select') {
                  return (
                    <div key={f.id} className={`min-w-0 space-y-2 ${getFieldLayoutClass(f)}`}>
                      <label className="block text-xs font-medium leading-tight text-stone-500">{f.label} {f.required && <span className="text-red-400">*</span>}</label>
                      <select
                        value={fieldValues[f.id] || ''}
                        onChange={e => updateField(f.id, e.target.value)}
                        className="block h-10 w-full min-w-0 rounded-md border border-stone-200 bg-white px-3 text-sm"
                      >
                        <option value="">Select…</option>
                        {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  )
                }
                return (
                  <div key={f.id} className={`min-w-0 space-y-2 ${getFieldLayoutClass(f)}`}>
                    <label className="block text-xs font-medium leading-tight text-stone-500">{f.label} {f.required && <span className="text-red-400">*</span>}</label>
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
                      className="h-10 w-full min-w-0"
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

        {/* Document Preview — signer must be able to see what they're
            signing on every device. */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-3 sm:mb-4">Document Preview</h3>
            <div className="border rounded-xl p-3 sm:p-6 bg-white text-xs sm:text-sm overflow-x-auto [&_table]:w-full [&_td]:text-xs [&_td]:py-1" dangerouslySetInnerHTML={{ __html: previewHtml }} />
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

// ── PDF-overlay branch (Kaiser-style "must use their exact PDF" forms) ──
// Wraps PdfOverlaySigner with the metadata-loading + filing logic that the
// other release forms get from SignFormPage.handleSubmit. Kept here so the
// signing UI stays inside SignFormPage and the route is unchanged.
function KaiserPdfOverlayBranch({ doc, template, mySigner, onDone, signing, setSigning }) {
  const [searchParams] = useSearchParams()
  const calibrate = searchParams.get('calibrate') === '1'
  const [gcCtx, setGcCtx] = useState(null)
  const [ipCtx, setIpCtx] = useState(null)
  const [adminValues, setAdminValues] = useState({})
  const [submitError, setSubmitError] = useState(null)

  const isIpForm = template?.signerRole === 'ip1' || template?.signerRole === 'ip2'

  // Pull signer context from the case's intake answers + admin pre-fill from doc metadata.
  //
  // - GC (Kaiser): walks _confidential / intake / _application / surrogate_profiles
  //   for address, since address can live in several places depending on onboarding flow.
  // - IP (background waiver): pulls from _ipContact (Application's Contact Info) and
  //   intake fallbacks; picks IP1 vs IP2 fields based on template.signerRole.
  useEffect(() => {
    if (!doc?.case_id || !supabase) return
    const meta = (() => { try { return JSON.parse(doc.document_hash || '{}') } catch { return {} } })()
    setAdminValues(meta.adminValues || {})

    async function load() {
      const { data: intake } = await supabase
        .from('intake_submissions')
        .select('answers, applicant_email')
        .eq('id', doc.case_id)
        .single()
      const a = intake?.answers || {}

      if (isIpForm) {
        // IP background waiver — assemble IP1 or IP2 context based on signer role.
        const c = a._ipContact || {}
        const isIp2 = template.signerRole === 'ip2'
        const firstName = (isIp2 ? (c.ip2FirstName || a.ip2FirstName) : (c.ip1FirstName || a.primaryFirstName)) || ''
        const lastName  = (isIp2 ? (c.ip2LastName  || a.ip2LastName)  : (c.ip1LastName  || a.primaryLastName))  || ''
        const dob       = (isIp2 ? (c.ip2Dob       || a.ip2Dob)       : (c.ip1Dob       || a.primaryDob))       || ''
        const email     = (isIp2 ? (c.ip2Email     || a.ip2Email)     : (c.ip1Email     || a.email))            || mySigner.email || ''
        const phone     = (isIp2 ? (c.ip2Phone     || a.ip2Phone)     : (c.ip1Phone     || a.phone))            || ''
        // Background-check info (SSN/DL) lives in _ipBackground if collected.
        // Falls back to '' so the signer types it inline on the PDF.
        const bg = a._ipBackground?.[isIp2 ? 'ip2' : 'ip1'] || a._ipBackground || {}
        setIpCtx({
          firstName,
          middleName: bg.middleName || '',
          lastName,
          fullName: [firstName, bg.middleName, lastName].filter(Boolean).join(' '),
          phone,
          dob,
          email,
          ssn: bg.ssn || '',
          dlNumber: bg.dlNumber || '',
          dlState: bg.dlState || '',
          dlExp: bg.dlExp || '',
        })
        return
      }

      // GC (Kaiser) — original logic
      const c = a._confidential || {}
      const app = a._application || {}
      const pickStreet = () =>
        [c.streetAddress, c.aptNumber].filter(Boolean).join(' ').trim() ||
        [a.streetAddress, a.aptNumber].filter(Boolean).join(' ').trim() ||
        [a.street, a.street2].filter(Boolean).join(' ').trim() ||
        [app.streetAddress, app.aptNumber].filter(Boolean).join(' ').trim() ||
        app.street || ''
      const pickCity     = () => c.city     || a.city     || app.city     || ''
      const pickState    = () => c.state    || a.state    || app.state    || ''
      const pickZip      = () => c.zipCode  || a.zipCode  || a.zip || app.zipCode || app.zip || ''
      const pickPhone    = () => a.phone    || app.phone  || c.phone || ''

      let street = pickStreet()
      let city   = pickCity()
      let state  = pickState()
      let zip    = pickZip()
      let phone  = pickPhone()

      if (!street || !city || !state || !zip || !phone) {
        const email = (a.email || intake?.applicant_email || '').toLowerCase()
        if (email) {
          try {
            const { data: profileRow } = await supabase
              .from('surrogate_profiles')
              .select('profile_data')
              .eq('email', email)
              .maybeSingle()
            const personal = profileRow?.profile_data?.personal || {}
            street = street || [personal.streetAddress, personal.aptNumber].filter(Boolean).join(' ').trim() || personal.address || ''
            city   = city   || personal.city   || ''
            state  = state  || personal.state  || ''
            zip    = zip    || personal.zipCode || personal.zip || ''
            phone  = phone  || personal.phone  || ''
          } catch (err) { console.warn('profile lookup failed:', err) }
        }
      }

      const fullName = [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || mySigner.name || ''
      setGcCtx({
        name: fullName,
        dob: a.dob || '',
        email: a.email || mySigner.email || '',
        phone,
        street,
        city,
        state,
        zipCode: zip,
      })
    }
    load().catch(() => {})
  }, [doc?.case_id, template?.signerRole])

  async function handleSign({ blob, signatures }) {
    if (signing) return
    setSigning(true)
    try {
      // Sign the doc record (status, history). For Kaiser the placeholderValues
      // double as a record of what got drawn onto the PDF.
      const signatureData = {
        type: 'pdf_overlay',
        name: signatures?.signature?.name || mySigner.name || '',
        image: signatures?.signature?.image || null,
        fieldValues: {},
        placeholderValues: {},
      }
      const updated = await signDocument(doc.id, mySigner.email, signatureData)

      // Append the ESIGN/UETA audit-trail page to the baked PDF — same
      // evidentiary cert page that gets attached to the doc-first releases.
      // Kaiser is single-signer, so we can finalize on this submit.
      const finalBlob = await appendAuditTrailPage(blob, {
        documentTitle: doc.title,
        documentId: doc.id,
        signerName: mySigner.name,
        signerEmail: mySigner.email,
        signatureType: signatures?.signature?.type || 'typed',
        signatureName: signatures?.signature?.name || mySigner.name || '',
        signedAt: new Date(),
        userAgent: navigator?.userAgent || '',
      })

      // Upload the audited PDF as the signed copy. Filename slug derives
      // from the template id so IP background waivers don't get tagged
      // "signed_kaiser_*" and so on for any future pdf-overlay form.
      const slug = String(template?.id || 'pdfoverlay').replace(/[^a-z0-9]+/gi, '_').slice(0, 40)
      const path = `documents/signed_${slug}_${doc.id}_${Date.now()}.pdf`
      const upload = await supabase.storage.from('esign-documents').upload(path, finalBlob, { contentType: 'application/pdf' })
      if (upload?.error) throw upload.error
      const { data: urlData } = supabase.storage.from('esign-documents').getPublicUrl(path)

      // File to the case's Signed Documents folder only when the doc is fully done.
      // Kaiser is single-signer, so this happens immediately after the surrogate signs.
      const allDone = updated?.status === 'completed'
      if (allDone && urlData?.publicUrl && doc.case_id) {
        await supabase.from('case_documents').insert({
          surrogate_id: doc.case_id,
          category: 'e-signature',
          file_name: `[Signed] ${doc.title}.pdf`,
          file_type: 'application/pdf',
          storage_path: path,
          public_url: urlData.publicUrl,
          uploaded_by: 'System (E-Sign)',
        })
        try {
          const { maybeCreateSigningCompletionTask } = await import('@/lib/batchCompletionTask')
          await maybeCreateSigningCompletionTask(updated)
        } catch (err) { console.error('Completion task failed:', err) }
      }
      onDone()
    } catch (err) {
      setSubmitError('Failed to submit: ' + (err.message || 'Unknown error'))
    } finally { setSigning(false) }
  }

  // Wait until at least one signer context is loaded. Kaiser flows
  // populate gcCtx; IP background waiver populates ipCtx.
  if (!gcCtx && !ipCtx) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#283693]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#283693]/5 to-white">
      <div className="text-center pt-6">
        <img src="/abc-logo.png" alt="ABC Surrogacy" className="h-10 sm:h-12 mx-auto mb-2" />
        <h1 className="text-xl sm:text-2xl font-bold text-[#283693]">{template.title}</h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          Signed in as {mySigner.name} ({mySigner.email})
          {calibrate && <span className="ml-2 text-pink-600 font-semibold">· CALIBRATE MODE</span>}
        </p>
      </div>
      {submitError && (
        <div role="alert" className="max-w-3xl mx-auto px-4 mb-3">
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="flex-1">{submitError}</span>
            <button onClick={() => setSubmitError(null)} className="text-red-500 hover:text-red-700 font-semibold">&times;</button>
          </div>
        </div>
      )}
      <PdfOverlaySigner
        template={template}
        gcCtx={gcCtx}
        ipCtx={ipCtx}
        adminValues={adminValues}
        onSign={handleSign}
        signing={signing}
        signerName={mySigner.name}
        calibrate={calibrate}
      />
    </div>
  )
}

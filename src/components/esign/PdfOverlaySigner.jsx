import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { bakePdfOverlay, loadTemplatePdf, resolveOverlayValue, valueForFieldName } from '@/lib/pdfOverlay'

// US state abbreviations for the License Issuing State dropdown on the
// IP background waiver. Two-letter postal codes — what fits Kaiser/RCS
// background-check forms.
const US_STATE_ABBR = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']

function formatSsn(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 9)
  if (d.length <= 3) return d
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

function formatPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}

// Convert ISO YYYY-MM-DD (from <input type="date">) → MM/DD/YYYY for the
// PDF AcroForm field, which is the format the release form expects.
function isoToMmddyyyy(iso) {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[2]}/${m[3]}/${m[1]}` : iso
}

// Reverse: MM/DD/YYYY → YYYY-MM-DD so <input type="date"> renders the
// prefilled value correctly. Returns '' if input isn't parseable.
function mmddyyyyToIso(s) {
  if (!s) return ''
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) {
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''
  }
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

/**
 * Renders a "pdf-overlay" template: shows the original PDF as the background
 * with absolute-positioned input + signature widgets sitting on top of the
 * underlines. On Sign & Submit, calls onComplete with a Blob of the original
 * PDF flattened with the typed values + signature drawn at the same coords.
 *
 * Calibration mode: append ?calibrate=1 to the URL — adds a 50pt grid +
 * coordinate-on-click logger so positions can be tweaked without a redeploy.
 */
export default function PdfOverlaySigner({ template, gcCtx, ipCtx, adminValues, onSign, signing, signerName, calibrate = false }) {
  const [pdfBytes, setPdfBytes] = useState(null)
  const [pageImages, setPageImages] = useState([]) // dataURLs
  const [pageDims, setPageDims] = useState([]) // [{ widthPt, heightPt }]
  const [renderedWidth, setRenderedWidth] = useState(720) // CSS pixels for display
  const [fieldValues, setFieldValues] = useState({})
  const [signatures, setSignatures] = useState({})
  const [activeSigId, setActiveSigId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [agreed, setAgreed] = useState(false)
  const [validationMsg, setValidationMsg] = useState(null)
  // AcroForm fields the signer needs to fill — captured from the PDF and
  // rendered as input overlays at each field's widget position. Populated
  // during load alongside the pre-fill flatten step.
  const [inputGeoms, setInputGeoms] = useState([]) // [{ name, page, rect, fieldType }]
  // True when the PDF carries the wantsCopy checkbox pair — drives the
  // radio question that surfaces above the signature card.
  const [hasWantsCopy, setHasWantsCopy] = useState(false)
  const containerRef = useRef(null)

  // Pre-fill fieldValues from gcCtx + adminValues so the PDF shows the
  // resolved text immediately (no flash of blank lines).
  useEffect(() => {
    const initial = {}
    for (const f of template.overlay || []) {
      const v = resolveOverlayValue(f, { gc: gcCtx, admin: adminValues, today: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }), fieldValues: {}, signatures: {} })
      if (v) initial[f.id] = v
    }
    // For form-above templates, prefill the AcroForm-named fields from
    // ipCtx so the structured form opens with what we already know
    // (First/Last/DOB/Phone). Empty fields wait for the IP to type.
    if (template.formMode === 'above' && template.formAboveFields && ipCtx) {
      for (const f of template.formAboveFields) {
        const raw = ipCtx[f.source]
        if (!raw) continue
        if (f.type === 'phone') initial[f.name] = formatPhone(raw)
        else if (f.type === 'ssn') initial[f.name] = formatSsn(raw)
        else if (f.type === 'date') {
          // Store as MM/DD/YYYY in fieldValues so the bake step sees the
          // canonical form expected by the PDF AcroForm field.
          const iso = mmddyyyyToIso(raw)
          initial[f.name] = iso ? isoToMmddyyyy(iso) : raw
        }
        else initial[f.name] = String(raw)
      }
    }
    setFieldValues(initial)
  }, [template, gcCtx, ipCtx, adminValues])

  // Signature widget geometry, extracted from the PDF's AcroForm signature
  // field. The live preview positions the signature pad at the field's
  // exact widget rect — no manual coord guessing.
  const [sigGeometry, setSigGeometry] = useState(null) // { pageIndex, rect: {x,y,width,height} }
  // Whether the PDF is fillable (has named AcroForm fields). When true we
  // pre-fill values via pdf-lib + flatten before pdfjs renders, so the
  // surrogate sees the values landing exactly on Kaiser's pre-printed lines.
  const [hasForm, setHasForm] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const buf = await loadTemplatePdf(template.pdfPath)
        if (cancelled) return
        setPdfBytes(buf) // ORIGINAL bytes — used by bake on submit

        // Pre-fill + flatten via pdf-lib so the rendered display matches
        // what the final signed PDF will look like. This sidesteps coord
        // guessing entirely — pdf-lib places each value at the exact
        // position of its named form field.
        const { PDFDocument } = await import('pdf-lib')
        const sourcePdf = await PDFDocument.load(buf, { ignoreEncryption: true })
        const form = sourcePdf.getForm()
        const fields = form.getFields()
        let displayBytes = buf

        if (fields.length > 0) {
          if (!cancelled) setHasForm(true)
          const collectedInputs = []
          let sawWantsCopy = false
          let firstSigField = null
          const ctx = {
            gc: gcCtx || {},
            ip: ipCtx || {},
            admin: adminValues || {},
            today: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
            fieldValues: {},
          }
          // Helper: locate which page a widget sits on
          const pages = sourcePdf.getPages()
          function pageIndexOfWidget(w) {
            const pageRef = w.P()
            for (let i = 0; i < pages.length; i++) {
              if (pages[i].ref === pageRef) return i
            }
            return 0
          }
          for (const field of fields) {
            const rawName = field.getName()
            const resolved = valueForFieldName(rawName, ctx)
            // Signature fields — capture for the dedicated sign card; bake
            // step iterates all widgets so 1 sign action covers all spots.
            if (resolved.isSignature) {
              if (!firstSigField) firstSigField = field
              continue
            }
            // Checkbox pair for "wish to receive a copy" — surfaces as a
            // radio question above the signature card. Don't draw anything
            // on the PDF; bake step ticks the right box at submit time.
            if (resolved.isCheckbox) {
              sawWantsCopy = true
              continue
            }
            // Text fields with a prefilled value: write it now so the
            // flatten step bakes it into the rendered image. The signer
            // sees the value on the PDF and doesn't need to re-type.
            if (resolved.text && typeof field.setText === 'function') {
              try { field.setText(String(resolved.text)) } catch {}
              continue
            }
            // Empty text fields: capture the first widget's position so
            // we can render an input overlay where the signer types their
            // value (Middle Name, SSN, DL #, etc. on the IP waiver). For
            // multi-widget fields, a single input fills all widgets at
            // bake time via setText() on the parent field.
            try {
              const widgets = field.acroField.getWidgets()
              if (widgets.length) {
                const r = widgets[0].getRectangle()
                collectedInputs.push({
                  name: rawName,
                  page: pageIndexOfWidget(widgets[0]),
                  rect: { x: r.x, y: r.y, width: r.width, height: r.height },
                })
              }
            } catch {}
          }
          if (firstSigField) {
            try {
              const widgets = firstSigField.acroField.getWidgets()
              if (widgets.length) {
                const r = widgets[0].getRectangle()
                if (!cancelled) setSigGeometry({ pageIndex: pageIndexOfWidget(widgets[0]), rect: { x: r.x, y: r.y, width: r.width, height: r.height } })
              }
            } catch {}
            try { form.removeField(firstSigField) } catch {}
          }
          if (!cancelled) setInputGeoms(collectedInputs)
          if (!cancelled) setHasWantsCopy(sawWantsCopy)
          try { form.flatten() } catch {}
          displayBytes = await sourcePdf.save()
        }

        // Render the (filled, flattened) PDF via pdfjs
        const pdfjs = await import('pdfjs-dist')
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
          pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        }
        const doc = await pdfjs.getDocument({ data: displayBytes.slice(0) }).promise
        const imgs = []
        const dims = []
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i)
          const viewport = page.getViewport({ scale: 2 })
          dims.push({ widthPt: viewport.width / 2, heightPt: viewport.height / 2 })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')
          await page.render({ canvasContext: ctx, viewport, canvas }).promise
          imgs.push(canvas.toDataURL('image/png'))
        }
        if (cancelled) return
        setPageImages(imgs)
        setPageDims(dims)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load PDF')
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [template.pdfPath, gcCtx, ipCtx, adminValues])

  // Watch container width to scale the overlay coordinates appropriately
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setRenderedWidth(entry.contentRect.width)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  function pdfToCss(pageIdx, x, y) {
    const dims = pageDims[pageIdx]
    if (!dims) return { left: 0, top: 0, scale: 1 }
    const scale = renderedWidth / dims.widthPt
    return {
      left: x * scale,
      // PDF origin = bottom-left; CSS = top-left
      top: (dims.heightPt - y) * scale,
      scale,
    }
  }

  function updateField(id, val) {
    setFieldValues(prev => ({ ...prev, [id]: val }))
  }

  async function handleSubmit() {
    setValidationMsg(null)

    // Collect every missing requirement up front, then show one message
    // listing them all — instead of bouncing the user one step at a time.
    const missing = []

    if (!agreed) missing.push('Agreement to the terms')

    // SSN is special: requires the full xxx-xx-xxxx form. Date fields
    // require the MM/DD/YYYY form. Helper validates each value type.
    function isFilled(val, type) {
      const s = String(val ?? '').trim()
      if (!s) return false
      if (type === 'ssn') return /^\d{3}-\d{2}-\d{4}$/.test(s)
      if (type === 'phone') return s.replace(/\D/g, '').length >= 10
      if (type === 'date') return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s) || /^\d{4}-\d{2}-\d{2}/.test(s)
      return true
    }

    // form-above templates: walk the structured form fields
    if (template.formMode === 'above' && Array.isArray(template.formAboveFields)) {
      for (const f of template.formAboveFields) {
        if (!f.required) continue
        if (!isFilled(fieldValues[f.name], f.type)) missing.push(f.label || f.name)
      }
    }

    // wantsCopy is required when the PDF has the checkbox pair
    if (hasWantsCopy && !fieldValues.wantsCopy) {
      missing.push('Receive-a-copy choice')
    }

    // Signature is required for any AcroForm PDF or any signature widget
    // in the coord overlay.
    if (hasForm) {
      if (!signatures.signature) missing.push('Signature')
    } else {
      for (const f of template.overlay || []) {
        if (f.type === 'signature') {
          if (!signatures[f.id]) missing.push('Signature')
          continue
        }
        if (f.required && !fieldValues[f.id]) missing.push(f.label || f.id)
      }
    }

    if (missing.length) {
      const unique = [...new Set(missing)]
      setValidationMsg(`Please complete the following before submitting: ${unique.join(' · ')}`)
      // Scroll the validation banner into view so the IP sees what's missing
      // even if they tapped Submit far below the form.
      try { containerRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }) } catch {}
      return
    }
    try {
      const blob = await bakePdfOverlay(pdfBytes, template.overlay || [], {
        gc: gcCtx,
        ip: ipCtx,
        admin: adminValues || {},
        today: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
        fieldValues,
        signatures,
      })
      onSign({ blob, fieldValues, signatures })
    } catch (err) {
      setValidationMsg('Failed to bake PDF: ' + err.message)
    }
  }

  // Coordinate-logger for calibrate mode
  function handlePageClick(e, pageIdx) {
    if (!calibrate) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dims = pageDims[pageIdx]
    if (!dims) return
    const scale = renderedWidth / dims.widthPt
    const xPt = ((e.clientX - rect.left) / scale).toFixed(0)
    const yPt = (dims.heightPt - (e.clientY - rect.top) / scale).toFixed(0)
    console.log(`[calibrate] page=${pageIdx} x=${xPt} y=${yPt}`)
    // eslint-disable-next-line no-alert
    navigator.clipboard?.writeText(`page: ${pageIdx}, x: ${xPt}, y: ${yPt},`)?.catch(() => {})
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="size-6 animate-spin text-[#1A3638]" />
      <span className="ml-2 text-sm text-stone-500">Loading PDF…</span>
    </div>
  )
  if (error) return (
    <div className="text-center py-12">
      <p className="text-sm text-red-600 font-medium">Couldn't load PDF</p>
      <p className="text-xs text-stone-400 mt-1">{error}</p>
    </div>
  )

  const formAbove = template.formMode === 'above'

  // ── Building-block JSX for the layout ──
  // Defined as variables so we can flip the order based on formMode (PDF
  // preview at the top for Kaiser-style overlay; PDF preview at the bottom
  // for form-above templates like the IP background waiver).

  const yourInformationCard = (formAbove && Array.isArray(template.formAboveFields) && template.formAboveFields.length > 0) ? (
    <Card className="mt-1 mb-2 border-2 border-[#1A3638]/30 shadow-sm">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[#1A3638] uppercase tracking-wider">Your information</h3>
          <p className="text-[11px] text-stone-500 mt-0.5">We've prefilled what we already have. Please fill in the rest.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {template.formAboveFields.map(f => {
            const val = fieldValues[f.name] || ''
            const onChange = (raw) => {
              let v = raw
              if (f.type === 'ssn') v = formatSsn(raw)
              else if (f.type === 'phone') v = formatPhone(raw)
              else if (f.type === 'date') v = isoToMmddyyyy(raw)
              updateField(f.name, v)
            }
            return (
              <div key={f.name} className={f.type === 'date' || f.type === 'state' ? '' : 'sm:col-span-1'}>
                <label className="block text-[11px] font-semibold text-stone-600 uppercase tracking-wide mb-1">
                  {f.label} {f.required && <span className="text-[#D4A853]">*</span>}
                </label>
                {f.type === 'state' ? (
                  <select
                    value={val}
                    onChange={(e) => updateField(f.name, e.target.value)}
                    className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3638]/40"
                  >
                    <option value="">Select…</option>
                    {US_STATE_ABBR.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : f.type === 'date' ? (
                  <input
                    type="date"
                    value={mmddyyyyToIso(val)}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3638]/40"
                  />
                ) : (
                  <input
                    type={f.type === 'phone' ? 'tel' : 'text'}
                    inputMode={f.type === 'ssn' || f.type === 'phone' ? 'numeric' : undefined}
                    placeholder={f.type === 'ssn' ? '123-45-6789' : f.type === 'phone' ? '555-555-5555' : ''}
                    value={val}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3638]/40"
                  />
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  ) : null

  // Radio + signature cards extracted so the layout can be reordered
  // based on formMode (above the PDF for formAbove templates; below the
  // PDF for Kaiser-style overlays).
  const wantsCopyCard = hasWantsCopy ? (
    <Card className="mt-5 mb-2 border-2 border-[#1A3638]/30 shadow-sm">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#1A3638] uppercase tracking-wider">Would you like a copy of the report?</h3>
        <p className="text-xs text-stone-500">Required. Pick one.</p>
        <div className="space-y-2">
          <label className={`flex items-start gap-2.5 p-3 rounded-lg border-2 cursor-pointer transition-colors ${fieldValues.wantsCopy === 'yes' ? 'border-[#1A3638] bg-[#1A3638]/5' : 'border-stone-200 hover:bg-stone-50'}`}>
            <input type="radio" name="wantsCopy" value="yes" checked={fieldValues.wantsCopy === 'yes'} onChange={() => updateField('wantsCopy', 'yes')} className="mt-0.5 accent-[#1A3638]" />
            <span className="text-xs text-stone-700 leading-relaxed">
              <strong>Yes</strong> — I wish to receive a copy of any report that is prepared. I understand that a copy of the report will be provided within three (3) business days of receipt of the report by First Star Surrogacy
            </span>
          </label>
          <label className={`flex items-start gap-2.5 p-3 rounded-lg border-2 cursor-pointer transition-colors ${fieldValues.wantsCopy === 'no' ? 'border-[#1A3638] bg-[#1A3638]/5' : 'border-stone-200 hover:bg-stone-50'}`}>
            <input type="radio" name="wantsCopy" value="no" checked={fieldValues.wantsCopy === 'no'} onChange={() => updateField('wantsCopy', 'no')} className="mt-0.5 accent-[#1A3638]" />
            <span className="text-xs text-stone-700 leading-relaxed">
              <strong>No</strong> — I do not wish to receive a copy of any report that is prepared, or any public records that may be obtained.
            </span>
          </label>
        </div>
      </CardContent>
    </Card>
  ) : null

  const signatureCard = (
    <Card className="mt-5 mb-2 border-2 border-[#D4A853]/30 shadow-sm">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#D4A853] uppercase tracking-wider">Your signature</h3>
          {signatures.signature && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="size-3.5" /> Signed
            </span>
          )}
        </div>
        {/* Drawn signatures swap to a preview + Re-sign button so the
            canvas isn't sitting there blank after the user lifted their
            pen. Typed signatures stay in the SignaturePad input the
            whole time so the user can keep typing past the first letter
            (and edit/correct without having to "Clear" first). */}
        {signatures.signature?.type === 'drawn' && signatures.signature.image ? (
          <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <img src={signatures.signature.image} alt="signature" style={{ height: 36 }} />
            <button onClick={() => setSignatures(p => ({ ...p, signature: null }))} className="text-xs text-stone-500 hover:text-red-500 underline">Re-sign</button>
          </div>
        ) : (
          <SignaturePad
            value={signatures.signature}
            signerName={signerName}
            onChange={(val) => setSignatures(p => ({ ...p, signature: val }))}
          />
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="max-w-3xl mx-auto py-4 px-2 sm:px-4">
      {validationMsg && (
        <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="flex-1">{validationMsg}</span>
          <button onClick={() => setValidationMsg(null)} className="text-red-500 hover:text-red-700 font-semibold">&times;</button>
        </div>
      )}

      {/* form-above templates: interactive cards FIRST, PDF as a read-only sample below */}
      {formAbove && yourInformationCard}
      {formAbove && wantsCopyCard}
      {formAbove && signatureCard}

      {formAbove && (
        <div className="mt-6 mb-2 text-center">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Sample of the document you're signing</p>
          <p className="text-[10px] text-stone-400 mt-0.5">The values you entered above will be filled into this PDF on submit.</p>
        </div>
      )}

      <div ref={containerRef} className="space-y-4">
        {pageImages.map((img, pi) => (
          <div key={pi} className="relative shadow-md ring-1 ring-stone-200 rounded-lg overflow-hidden bg-white"
            onClick={(e) => handlePageClick(e, pi)}
          >
            <img src={img} alt={`Page ${pi + 1}`} className="block w-full h-auto select-none" draggable={false} />

            {calibrate && pageDims[pi] && (() => {
              const { widthPt, heightPt } = pageDims[pi]
              const scale = renderedWidth / widthPt
              const lines = []
              for (let x = 0; x < widthPt; x += 50) lines.push({ k: 'v' + x, style: { position: 'absolute', left: x * scale, top: 0, bottom: 0, width: 1, background: 'rgba(237,20,140,0.2)' }, label: x, lpos: { left: x * scale + 2, top: 4 } })
              for (let y = 0; y < heightPt; y += 50) lines.push({ k: 'h' + y, style: { position: 'absolute', top: (heightPt - y) * scale, left: 0, right: 0, height: 1, background: 'rgba(40,54,147,0.2)' }, label: y, lpos: { top: (heightPt - y) * scale + 2, left: 4 } })
              return lines.map(L => <div key={L.k}><div style={L.style} /><span style={{ position: 'absolute', ...L.lpos, fontSize: 8, color: '#666', background: 'white', padding: '0 2px' }}>{L.label}</span></div>)
            })()}

            {/* AcroForm signature widget on the PDF removed — the dedicated
                "Your signature" card below the PDF is the single sign target
                for both desktop and mobile. The inline widget was visually
                noisy and redundant. */}

            {/* AcroForm text-field input overlays — for any field that
                wasn't pre-filled. Positioned at the field's first widget
                rect so the signer types directly on top of the underline.
                Suppressed for templates that render a structured form
                above the PDF (formMode='above') — the PDF is then a
                read-only sample. */}
            {hasForm && template.formMode !== 'above' && inputGeoms.filter(g => g.page === pi).map(g => {
              const { left, top, scale } = pdfToCss(pi, g.rect.x, g.rect.y)
              const w = g.rect.width * scale
              const h = g.rect.height * scale
              return (
                <input
                  key={g.name}
                  type="text"
                  value={fieldValues[g.name] || ''}
                  onChange={(e) => updateField(g.name, e.target.value)}
                  style={{
                    position: 'absolute',
                    left,
                    top: top - h * 0.85,
                    width: w,
                    height: h,
                    fontSize: Math.max(10, h * 0.55),
                    zIndex: 10,
                    background: 'rgba(255, 255, 220, 0.65)',
                    border: '1px solid rgba(237,20,140,0.3)',
                    borderRadius: 2,
                    padding: '0 4px',
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    color: '#000',
                  }}
                />
              )
            })}

            {/* Coord-overlay widgets (legacy fallback for non-fillable PDFs) */}
            {!hasForm && (template.overlay || []).filter(f => f.page === pi).map(field => {
              const { left, top, scale } = pdfToCss(pi, field.x, field.y)
              const w = (field.width || 200) * scale
              const h = (field.height || 22) * scale
              const fontPx = (field.fontSize || 11) * scale
              // Signature widget
              if (field.type === 'signature') {
                const sig = signatures[field.id]
                if (activeSigId === field.id) {
                  return (
                    <div key={field.id} style={{ position: 'absolute', left, top: top - h, width: Math.max(w, 220), zIndex: 30 }}>
                      <SignaturePad value={sig} signerName={signerName} onChange={(val) => { setSignatures(p => ({ ...p, [field.id]: val })); if (val?.type === 'drawn') setActiveSigId(null) }} />
                      <button onClick={() => setActiveSigId(null)} className="text-[10px] text-stone-400 hover:underline mt-0.5">Done</button>
                    </div>
                  )
                }
                if (sig?.type === 'drawn' && sig.image) {
                  return (
                    <button key={field.id} onClick={() => setActiveSigId(field.id)}
                      style={{ position: 'absolute', left, top: top - h, width: w, height: h, zIndex: 20 }}
                      className="border-2 border-emerald-400 bg-emerald-50/30 rounded flex items-center justify-center"
                      title="Click to re-sign"
                    >
                      <img src={sig.image} alt="signature" style={{ height: h - 4, width: 'auto' }} />
                    </button>
                  )
                }
                if (sig?.type === 'typed' && sig.name) {
                  return (
                    <button key={field.id} onClick={() => setActiveSigId(field.id)}
                      style={{ position: 'absolute', left, top: top - h, width: w, height: h, fontSize: fontPx + 2, zIndex: 20 }}
                      className="border-2 border-emerald-400 bg-emerald-50/30 rounded flex items-center justify-start px-2 font-serif italic text-[#1A3638]"
                      title="Click to re-sign"
                    >
                      {sig.name}
                    </button>
                  )
                }
                return (
                  <button key={field.id} onClick={() => setActiveSigId(field.id)}
                    style={{ position: 'absolute', left, top: top - h, width: w, height: h, zIndex: 20 }}
                    className="border-2 border-dashed border-[#D4A853] bg-[#D4A853]/10 rounded text-[10px] text-[#D4A853] font-semibold flex items-center justify-center hover:bg-[#D4A853]/20 transition-colors animate-pulse"
                  >
                    Click to sign
                  </button>
                )
              }

              // Text input — sit just above the underline
              return (
                <input
                  key={field.id}
                  type="text"
                  value={fieldValues[field.id] || ''}
                  onChange={(e) => updateField(field.id, e.target.value)}
                  style={{
                    position: 'absolute',
                    left,
                    top: top - h * 0.85,
                    width: w,
                    height: h,
                    fontSize: fontPx,
                    zIndex: 10,
                    background: 'rgba(255, 255, 220, 0.65)',
                    border: '1px solid rgba(237,20,140,0.3)',
                    borderRadius: 2,
                    padding: '0 4px',
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    color: '#000',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Cards below the PDF for the Kaiser-style overlay flow. For
          form-above templates, these were already rendered above the
          PDF — don't duplicate them. */}
      {!formAbove && wantsCopyCard}
      {!formAbove && signatureCard}

      {/* Footer */}
      <div className="flex flex-col items-center gap-3 pt-6 pb-10">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setValidationMsg(null) }} className="size-4 accent-[#1A3638]" />
          <span>I agree that my electronic signature is legally binding</span>
        </label>
        <Button
          onClick={handleSubmit}
          disabled={signing}
          size="lg"
          className="gap-2 sm:px-10"
          style={{ background: 'linear-gradient(135deg, #1F3A3C, #5A9EA2)' }}
        >
          {signing ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
          {signing ? 'Submitting…' : 'Sign & Submit'}
        </Button>
        <p className="text-[10px] text-stone-400 text-center">Electronically signed via First Star Surrogacy in accordance with the ESIGN Act.</p>
      </div>
    </div>
  )
}

// Tiny signature pad — same UX pattern as the rest of the e-sign flow
function SignaturePad({ value, onChange, signerName }) {
  const [mode, setMode] = useState('typed')
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const hasDrawnRef = useRef(false)

  function pointerToCanvas(e) {
    const c = canvasRef.current
    if (!c) return { x: 0, y: 0 }
    const rect = c.getBoundingClientRect()
    const cx = e.clientX ?? e.touches?.[0]?.clientX ?? 0
    const cy = e.clientY ?? e.touches?.[0]?.clientY ?? 0
    return {
      x: (cx - rect.left) * (c.width / rect.width),
      y: (cy - rect.top) * (c.height / rect.height),
    }
  }

  useEffect(() => {
    function move(e) {
      if (!drawingRef.current) return
      const c = canvasRef.current; if (!c) return
      const { x, y } = pointerToCanvas(e)
      const ctx = c.getContext('2d')
      ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a2e'
      ctx.lineTo(x, y); ctx.stroke()
      hasDrawnRef.current = true
    }
    function up() {
      if (!drawingRef.current) return
      drawingRef.current = false
      if (canvasRef.current && mode === 'drawn' && hasDrawnRef.current) {
        onChange({ type: 'drawn', image: canvasRef.current.toDataURL('image/png'), name: signerName })
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up) }
  }, [mode, onChange, signerName])

  function startDraw(e) {
    e.preventDefault()
    drawingRef.current = true
    const c = canvasRef.current; if (!c) return
    const { x, y } = pointerToCanvas(e)
    const ctx = c.getContext('2d')
    ctx.beginPath(); ctx.moveTo(x, y)
    ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke()
    hasDrawnRef.current = true
  }

  return (
    <Card className="rounded-xl border-2 border-[#1A3638]/40 shadow-lg">
      <CardContent className="p-3 space-y-2">
        <div className="flex gap-2">
          <button onClick={() => setMode('typed')} className={`text-xs px-3 py-1 rounded-full font-medium ${mode === 'typed' ? 'bg-[#1A3638] text-white' : 'bg-stone-100 text-stone-500'}`}>Type</button>
          <button onClick={() => setMode('drawn')} className={`text-xs px-3 py-1 rounded-full font-medium ${mode === 'drawn' ? 'bg-[#1A3638] text-white' : 'bg-stone-100 text-stone-500'}`}>Draw</button>
        </div>
        {mode === 'typed' ? (
          <Input value={value?.name || ''} onChange={(e) => onChange({ type: 'typed', name: e.target.value })} placeholder="Type your full name" className="text-lg font-serif italic" autoFocus />
        ) : (
          <div>
            <canvas ref={canvasRef} width={500} height={80} className="w-full border border-stone-200 rounded bg-white touch-none" onMouseDown={startDraw} onTouchStart={startDraw} />
            <button onClick={() => { const c = canvasRef.current; if (c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); hasDrawnRef.current = false; onChange(null) } }} className="text-xs text-stone-400 hover:text-red-500 mt-1">Clear</button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

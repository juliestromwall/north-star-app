import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { bakePdfOverlay, loadTemplatePdf, resolveOverlayValue, valueForFieldName } from '@/lib/pdfOverlay'

/**
 * Renders a "pdf-overlay" template: shows the original PDF as the background
 * with absolute-positioned input + signature widgets sitting on top of the
 * underlines. On Sign & Submit, calls onComplete with a Blob of the original
 * PDF flattened with the typed values + signature drawn at the same coords.
 *
 * Calibration mode: append ?calibrate=1 to the URL — adds a 50pt grid +
 * coordinate-on-click logger so positions can be tweaked without a redeploy.
 */
export default function PdfOverlaySigner({ template, gcCtx, adminValues, onSign, signing, signerName, calibrate = false }) {
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
  const containerRef = useRef(null)

  // Pre-fill fieldValues from gcCtx + adminValues so the PDF shows the
  // resolved text immediately (no flash of blank lines).
  useEffect(() => {
    const initial = {}
    for (const f of template.overlay || []) {
      const v = resolveOverlayValue(f, { gc: gcCtx, admin: adminValues, today: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }), fieldValues: {}, signatures: {} })
      if (v) initial[f.id] = v
    }
    setFieldValues(initial)
  }, [template, gcCtx, adminValues])

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
          for (const field of fields) {
            const rawName = field.getName()
            const name = rawName.trim().toLowerCase()
            if (name === 'gcsignature') continue
            const resolved = valueForFieldName(rawName, {
              gc: gcCtx || {},
              admin: adminValues || {},
              today: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
              fieldValues: {},
            })
            if (resolved.text && typeof field.setText === 'function') {
              try { field.setText(String(resolved.text)) } catch {}
            }
          }
          // Capture signature widget position before flattening removes it
          const sigField = fields.find(f => f.getName().trim().toLowerCase() === 'gcsignature')
          if (sigField) {
            try {
              const widgets = sigField.acroField.getWidgets()
              if (widgets.length) {
                const r = widgets[0].getRectangle()
                const pageRef = widgets[0].P()
                let pageIndex = 0
                const pages = sourcePdf.getPages()
                for (let i = 0; i < pages.length; i++) {
                  if (pages[i].ref === pageRef) { pageIndex = i; break }
                }
                if (!cancelled) setSigGeometry({ pageIndex, rect: { x: r.x, y: r.y, width: r.width, height: r.height } })
              }
            } catch {}
            try { form.removeField(sigField) } catch {}
          }
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
  }, [template.pdfPath, gcCtx, adminValues])

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
    if (!agreed) {
      setValidationMsg('Please agree to the terms before submitting.')
      return
    }
    // For AcroForm PDFs the only required input is the signature.
    // For coord-overlay PDFs, walk the template overlay.
    if (hasForm) {
      if (!signatures.signature) {
        setValidationMsg('Please sign before submitting.')
        return
      }
    } else {
      const missing = []
      for (const f of template.overlay || []) {
        if (f.type === 'signature') {
          if (!signatures[f.id]) missing.push('Signature')
          continue
        }
        if (f.required && !fieldValues[f.id]) missing.push(f.label || f.id)
      }
      if (missing.length) {
        setValidationMsg(`Please complete: ${[...new Set(missing)].join(', ')}`)
        return
      }
    }

    try {
      const blob = await bakePdfOverlay(pdfBytes, template.overlay || [], {
        gc: gcCtx,
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
      <Loader2 className="size-6 animate-spin text-[#283693]" />
      <span className="ml-2 text-sm text-stone-500">Loading PDF…</span>
    </div>
  )
  if (error) return (
    <div className="text-center py-12">
      <p className="text-sm text-red-600 font-medium">Couldn't load PDF</p>
      <p className="text-xs text-stone-400 mt-1">{error}</p>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto py-4 px-2 sm:px-4">
      {validationMsg && (
        <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span className="flex-1">{validationMsg}</span>
          <button onClick={() => setValidationMsg(null)} className="text-red-500 hover:text-red-700 font-semibold">&times;</button>
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

            {/* AcroForm-aware signature widget — pulls position straight from
                the PDF's named "gcSignature" field. No coord guessing.
                Only renders for fillable PDFs; coord-overlay PDFs use the
                template.overlay map below. */}
            {hasForm && sigGeometry?.pageIndex === pi && (() => {
              const { rect } = sigGeometry
              const { left, top, scale } = pdfToCss(pi, rect.x, rect.y + rect.height)
              const w = rect.width * scale
              const h = rect.height * scale
              const sigId = 'signature'
              const sig = signatures[sigId]
              if (activeSigId === sigId) {
                return (
                  <div style={{ position: 'absolute', left, top, width: Math.max(w, 260), zIndex: 30 }}>
                    <SignaturePad value={sig} signerName={signerName} onChange={(val) => { setSignatures(p => ({ ...p, [sigId]: val })); if (val?.type === 'drawn') setActiveSigId(null) }} />
                    <button onClick={() => setActiveSigId(null)} className="text-[10px] text-stone-400 hover:underline mt-0.5">Done</button>
                  </div>
                )
              }
              if (sig?.type === 'drawn' && sig.image) {
                return (
                  <button onClick={() => setActiveSigId(sigId)}
                    style={{ position: 'absolute', left, top, width: w, height: h, zIndex: 20 }}
                    className="border-2 border-emerald-400 bg-emerald-50/30 rounded flex items-center justify-center"
                    title="Click to re-sign">
                    <img src={sig.image} alt="signature" style={{ height: h - 4, width: 'auto' }} />
                  </button>
                )
              }
              if (sig?.type === 'typed' && sig.name) {
                return (
                  <button onClick={() => setActiveSigId(sigId)}
                    style={{ position: 'absolute', left, top, width: w, height: h, zIndex: 20 }}
                    className="border-2 border-emerald-400 bg-emerald-50/30 rounded flex items-center justify-start px-2 font-serif italic text-[#283693]"
                    title="Click to re-sign">
                    {sig.name}
                  </button>
                )
              }
              return (
                <button onClick={() => setActiveSigId(sigId)}
                  style={{ position: 'absolute', left, top, width: w, height: h, zIndex: 20 }}
                  className="border-2 border-dashed border-[#ed148c] bg-[#ed148c]/10 rounded text-[10px] text-[#ed148c] font-semibold flex items-center justify-center hover:bg-[#ed148c]/20 transition-colors animate-pulse">
                  Click to sign
                </button>
              )
            })()}

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
                      className="border-2 border-emerald-400 bg-emerald-50/30 rounded flex items-center justify-start px-2 font-serif italic text-[#283693]"
                      title="Click to re-sign"
                    >
                      {sig.name}
                    </button>
                  )
                }
                return (
                  <button key={field.id} onClick={() => setActiveSigId(field.id)}
                    style={{ position: 'absolute', left, top: top - h, width: w, height: h, zIndex: 20 }}
                    className="border-2 border-dashed border-[#ed148c] bg-[#ed148c]/10 rounded text-[10px] text-[#ed148c] font-semibold flex items-center justify-center hover:bg-[#ed148c]/20 transition-colors animate-pulse"
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

      {/* Dedicated "Your signature" card — primary entry point on mobile,
          where the inline coord-positioned widget on the PDF is too small
          to tap reliably. Wires the same signatures.signature state so
          desktop click-to-sign and this card stay in sync. */}
      <Card className="mt-5 mb-2 border-2 border-[#ed148c]/30 shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#ed148c] uppercase tracking-wider">Your signature</h3>
            {signatures.signature && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="size-3.5" /> Signed
              </span>
            )}
          </div>
          {signatures.signature?.type === 'drawn' && signatures.signature.image ? (
            <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <img src={signatures.signature.image} alt="signature" style={{ height: 36 }} />
              <button onClick={() => setSignatures(p => ({ ...p, signature: null }))} className="text-xs text-stone-500 hover:text-red-500 underline">Re-sign</button>
            </div>
          ) : signatures.signature?.type === 'typed' && signatures.signature.name ? (
            <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-lg font-serif italic text-[#283693]">{signatures.signature.name}</span>
              <button onClick={() => setSignatures(p => ({ ...p, signature: null }))} className="text-xs text-stone-500 hover:text-red-500 underline">Clear</button>
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

      {/* Footer */}
      <div className="flex flex-col items-center gap-3 pt-6 pb-10">
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setValidationMsg(null) }} className="size-4 accent-[#283693]" />
          <span>I agree that my electronic signature is legally binding</span>
        </label>
        <Button
          onClick={handleSubmit}
          disabled={signing}
          size="lg"
          className="gap-2 sm:px-10"
          style={{ background: 'linear-gradient(135deg, #ed148c, #283693)' }}
        >
          {signing ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
          {signing ? 'Submitting…' : 'Sign & Submit'}
        </Button>
        <p className="text-[10px] text-stone-400 text-center">Electronically signed via ABC Surrogacy in accordance with the ESIGN Act.</p>
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
    <Card className="rounded-xl border-2 border-[#283693]/40 shadow-lg">
      <CardContent className="p-3 space-y-2">
        <div className="flex gap-2">
          <button onClick={() => setMode('typed')} className={`text-xs px-3 py-1 rounded-full font-medium ${mode === 'typed' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>Type</button>
          <button onClick={() => setMode('drawn')} className={`text-xs px-3 py-1 rounded-full font-medium ${mode === 'drawn' ? 'bg-[#283693] text-white' : 'bg-stone-100 text-stone-500'}`}>Draw</button>
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

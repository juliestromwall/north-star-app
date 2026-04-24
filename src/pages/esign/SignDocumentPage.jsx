import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  FileText, CheckCircle2, Clock, Shield, Loader2, Mail,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { fetchDocument, fetchDocumentByToken, signDocument, logAuditEvent } from '@/lib/esign'
import { supabase } from '@/lib/supabase'

// ── Inline Signature Pad ────────────────────────────────

function InlineSignaturePad({ value, onChange, signerName }) {
  const [mode, setMode] = useState('typed')
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const hasDrawnRef = useRef(false)
  const modeRef = useRef(mode)
  modeRef.current = mode

  // Map pointer to canvas-internal coords. Canvas has fixed internal dims
  // (width/height attrs) but CSS stretches it; on desktop the rendered width
  // can differ from the internal width — without scaling, strokes clip/miss.
  function pointerToCanvas(e) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  useEffect(() => {
    function handleMove(e) {
      if (!drawingRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const { x, y } = pointerToCanvas(e)
      ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a1a2e'
      ctx.lineTo(x, y)
      ctx.stroke()
      hasDrawnRef.current = true
    }
    function handleUp() {
      if (!drawingRef.current) return
      drawingRef.current = false
      if (canvasRef.current && modeRef.current === 'drawn' && hasDrawnRef.current) {
        onChange({ type: 'drawn', image: canvasRef.current.toDataURL('image/png'), name: signerName })
      }
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
    const { x, y } = pointerToCanvas(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    // draw a tiny dot so a single click still produces a visible mark (and triggers save on mouseup)
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a2e'
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
    hasDrawnRef.current = true
  }

  const savedDrawn = value?.type === 'drawn' && !!value?.image

  return (
    <span className="block align-middle my-2 w-full max-w-[340px]">
      <span className="border-2 border-dashed border-[#283693]/30 rounded-xl p-4 bg-[#283693]/5 block w-full">
        <span className="flex gap-2 mb-3">
          <button onClick={() => { setMode('typed'); onChange(value?.name ? { type: 'typed', name: value.name } : null) }} className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${mode === 'typed' ? 'bg-[#283693] text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>Type Signature</button>
          <button onClick={() => { setMode('drawn'); onChange(null) }} className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${mode === 'drawn' ? 'bg-[#283693] text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>Draw Signature</button>
        </span>
        {mode === 'typed' ? (
          <span className="block">
            <input type="text" value={value?.name || ''} onChange={e => onChange({ type: 'typed', name: e.target.value, image: null })}
              placeholder="Type your full legal name" className="w-full text-lg border-b-2 border-[#283693]/30 bg-transparent outline-none pb-2 font-serif italic placeholder:not-italic placeholder:text-stone-300 placeholder:font-sans placeholder:text-sm" />
            {value?.name && (
              <span className="block text-2xl font-serif italic text-[#1a1a2e] mt-3 text-center py-2">{value.name}</span>
            )}
          </span>
        ) : (
          <span className="block">
            <span className={`rounded-lg border-2 bg-white relative block overflow-hidden transition-colors ${savedDrawn ? 'border-emerald-300' : 'border-stone-200'}`} style={{ cursor: 'crosshair' }}>
              <canvas ref={canvasRef} width={320} height={120} className="w-full touch-none block"
                onMouseDown={startDraw}
                onTouchStart={startDraw} />
              <span className="absolute bottom-3 left-4 right-4 h-px bg-stone-200" />
              <span className="absolute bottom-1 left-4 text-[9px] text-stone-300">Sign above this line</span>
              {savedDrawn && (
                <span className="absolute top-1.5 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-semibold">
                  <CheckCircle2 className="size-3" /> Saved
                </span>
              )}
            </span>
            <span className="flex justify-between mt-2">
              <button onClick={() => {
                const canvas = canvasRef.current;
                if (canvas) { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); hasDrawnRef.current = false; onChange(null) }
              }} className="text-xs text-stone-400 hover:text-red-500 transition-colors">Clear signature</button>
              {!savedDrawn && <span className="text-[10px] text-stone-400">Draw your signature above</span>}
            </span>
          </span>
        )}
      </span>
    </span>
  )
}

// ── Compact Initials Pad (type or draw) ────────────────
function InitialsPad({ value, onChange, optional }) {
  const [mode, setMode] = useState('typed')
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const modeRef = useRef(mode)
  modeRef.current = mode

  function pointerToCanvas(e) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  useEffect(() => {
    function handleMove(e) {
      if (!drawingRef.current || modeRef.current !== 'drawn') return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      const { x, y } = pointerToCanvas(e)
      ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a2e'
      ctx.lineTo(x, y); ctx.stroke()
    }
    function handleUp() {
      if (!drawingRef.current) return
      drawingRef.current = false
      if (canvasRef.current && modeRef.current === 'drawn') onChange(canvasRef.current.toDataURL('image/png'))
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleUp)
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); window.removeEventListener('touchmove', handleMove); window.removeEventListener('touchend', handleUp) }
  }, [onChange])

  function startDraw(e) {
    e.preventDefault()
    drawingRef.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = pointerToCanvas(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  return (
    <span className="inline-block align-middle my-1">
      <span className={`border-2 border-dashed rounded-lg p-2 inline-block ${optional ? 'border-stone-200 bg-stone-50/50' : 'border-purple-300 bg-purple-50/50'}`} style={{ minWidth: 120 }}>
        <span className="flex gap-1 mb-1">
          <button onClick={() => setMode('typed')} className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${mode === 'typed' ? 'bg-[#283693] text-white' : 'bg-white text-stone-500 border border-stone-200'}`}>Type</button>
          <button onClick={() => setMode('drawn')} className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${mode === 'drawn' ? 'bg-[#283693] text-white' : 'bg-white text-stone-500 border border-stone-200'}`}>Draw</button>
        </span>
        {mode === 'typed' ? (
          <input type="text" value={typeof value === 'string' && !value.startsWith('data:') ? value : ''} onChange={e => onChange(e.target.value)}
            placeholder={optional ? 'Optional' : 'Initials'} maxLength={5} className="w-full text-center text-lg font-serif italic bg-transparent outline-none border-b border-stone-300" />
        ) : (
          <span className="block">
            <canvas ref={canvasRef} width={100} height={40} className="w-full border border-stone-200 rounded bg-white touch-none block cursor-crosshair"
              onMouseDown={startDraw}
              onTouchStart={startDraw} />
            <button onClick={() => { const c = canvasRef.current; if (c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); onChange('') } }} className="text-[8px] text-stone-400 hover:text-red-500 mt-0.5">Clear</button>
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
    const f = fieldRole?.toLowerCase() || ''
    if (f === 'gc' && (r.includes('surrogate') || r.includes('gc'))) return true
    if (f === 'ip1' && (r.includes('intended parent 1') || r.includes('ip1') || (r.includes('intended parent') && !r.includes('2')))) return true
    if (f === 'ip2' && (r.includes('intended parent 2') || r.includes('ip2'))) return true
    if (f === 'admin' && (r.includes('admin') || r.includes('agency'))) return true
    if ((f === 'partner' || f === 'parnter') && r.includes('partner')) return true
    // Also try exact match (e.g. custom role codes)
    if (f === r) return true
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
        .signing-doc { font-family: 'Arial', sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a2e; max-width: 100%; overflow-wrap: break-word; word-break: break-word; }
        .signing-doc > div, .signing-doc > body, .signing-doc [style*="margin-left"], .signing-doc [style*="padding-left"] { margin-left: 0 !important; padding-left: 0 !important; margin-right: 0 !important; padding-right: 0 !important; }
        .signing-doc table { border-collapse: collapse; width: 100%; table-layout: auto; }
        .signing-doc td { overflow-wrap: break-word; }
        .signing-doc p { margin: 0.4em 0; }
        .signing-doc ul { list-style: disc; padding-left: 1.5em; }
        .signing-doc ol { list-style: decimal; padding-left: 1.5em; }
        .signing-doc li { margin: 0.3em 0; }
        .signing-doc td, .signing-doc th { border: 1px solid #ddd; padding: 6px 10px; }
        .signing-doc img { max-width: 100%; height: auto; }
        .signing-doc a { color: #283693; }
        @media (max-width: 640px) {
          .signing-doc { font-size: 13px; }
          /* Keep multi-column tables (Payment Structure etc.) intact — let them
             scroll horizontally instead of stacking into blocks, which scrambles
             the header→cell pairing and overlaps the colored row backgrounds. */
          .signing-doc table {
            display: block;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            max-width: 100%;
          }
          .signing-doc table > tbody,
          .signing-doc table > thead,
          .signing-doc table > tfoot {
            display: table;
            width: 100%;
            min-width: max-content;
          }
          .signing-doc td, .signing-doc th {
            white-space: normal;
            min-width: 120px;
          }
          .signing-doc [style*="display:flex"][style*="justify-content:space-between"] {
            display: block !important;
          }
          .signing-doc [data-field-id],
          .signing-doc [data-sig-id] {
            display: block !important;
            width: 100% !important;
            min-width: 0 !important;
            margin-top: 4px;
          }
          .signing-doc input[type="text"],
          .signing-doc input[type="email"] {
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
            margin: 4px 0 !important;
          }
        }
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
            case 'initials':
              return <InitialsPad key={i} value={val} onChange={v => onFieldChange(key, v)} />
            case 'optionalinitials':
              return <InitialsPad key={i} value={val} onChange={v => onFieldChange(key, v)} optional />
            case 'optionaltext':
              return <input key={i} type="text" value={val} onChange={e => onFieldChange(key, e.target.value)}
                placeholder="Optional" className="inline-block w-[180px] text-sm border-b-2 border-stone-200 bg-stone-50/50 outline-none px-2 py-1 rounded-t align-middle mx-0.5" />
            case 'checkbox':
              return <label key={i} className="inline-flex items-center gap-1.5 align-middle mx-0.5 cursor-pointer">
                <input type="checkbox" checked={!!fieldValues[key]} onChange={e => onFieldChange(key, e.target.checked)} className="size-4 accent-[#283693]" />
              </label>
            case 'text':
              return <input key={i} type="text" value={val} onChange={e => onFieldChange(key, e.target.value)}
                placeholder="Enter text..." className="inline-block w-[200px] text-sm border-b-2 border-amber-300 bg-amber-50/50 outline-none px-2 py-1 rounded-t align-middle mx-0.5" />
            default: {
              // Handle numbered variants: signature2, signature3, text1, text2, initials1, initials2, optionaltext1, etc.
              const ft = part.fieldType
              if (ft.startsWith('signature')) {
                return <InlineSignaturePad key={i} value={signatureValue} onChange={onSignatureChange} signerName={signerName} />
              }
              if (ft.startsWith('checkbox')) {
                return <label key={i} className="inline-flex items-center gap-1.5 align-middle mx-0.5 cursor-pointer">
                  <input type="checkbox" checked={!!fieldValues[key]} onChange={e => onFieldChange(key, e.target.checked)} className="size-4 accent-[#283693]" />
                </label>
              }
              if (ft.startsWith('initials') || ft.startsWith('optionalinitials')) {
                return <InitialsPad key={i} value={val} onChange={v => onFieldChange(key, v)} optional={ft.startsWith('optional')} />
              }
              if (ft.startsWith('text') || ft.startsWith('optionaltext')) {
                return <input key={i} type="text" value={val} onChange={e => onFieldChange(key, e.target.value)}
                  placeholder={ft.startsWith('optional') ? 'Optional' : 'Enter text...'} className={`inline-block w-[200px] text-sm border-b-2 outline-none px-2 py-1 rounded-t align-middle mx-0.5 ${ft.startsWith('optional') ? 'border-stone-200 bg-stone-50/50' : 'border-amber-300 bg-amber-50/50'}`} />
              }
              return <input key={i} type="text" value={val} onChange={e => onFieldChange(key, e.target.value)}
                placeholder={part.placeholder} className="inline-block w-[200px] text-sm border-b-2 border-stone-300 bg-stone-50/50 outline-none px-2 py-1 rounded-t align-middle mx-0.5" />
            }
          }
        })}
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────

export default function SignDocumentPage() {
  const { id, token } = useParams()
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

  // Load document — by token (secure) or by ID (legacy)
  useEffect(() => {
    if (token) {
      fetchDocumentByToken(token).then(d => setDoc(d)).catch(() => {}).finally(() => setLoading(false))
    } else if (id) {
      const docId = Number(id)
      if (isNaN(docId)) { setLoading(false); return }
      fetchDocument(docId).then(d => setDoc(d)).catch(() => {}).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [id, token])

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
        const fr = f.role?.toLowerCase() || ''
        const matches = (fr === 'gc' && (r.includes('surrogate') || r.includes('gc'))) ||
          (fr === 'ip1' && (r.includes('intended parent 1') || r.includes('ip1') || (r.includes('intended parent') && !r.includes('2')))) ||
          (fr === 'ip2' && (r.includes('intended parent 2') || r.includes('ip2'))) ||
          (fr === 'admin' && (r.includes('admin') || r.includes('agency'))) ||
          ((fr === 'partner' || fr === 'parnter') && r.includes('partner')) ||
          (fr === r)
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

  // Check if all required fields for this signer are filled
  function getIncompleteFields() {
    if (!doc || !mySigner) return []
    const meta = JSON.parse(doc.document_hash || '{}')
    const fields = meta.fields || []
    const signerRole = mySigner.role?.toLowerCase() || ''
    const missing = []
    let fieldIdx = 0

    // Parse the HTML to find all fields (same order as DocumentWithFields)
    const regex = /\{\{(\w+):(\w+)\}\}/g
    let match
    const htmlContent = docHtml || ''
    while ((match = regex.exec(htmlContent)) !== null) {
      const fieldType = match[1].toLowerCase()
      const role = match[2].toLowerCase()
      const fieldId = `field_${fieldIdx}`
      fieldIdx++

      // Check if this field belongs to this signer
      const r = signerRole
      const f = role
      const isMyField = (f === 'gc' && (r.includes('surrogate') || r.includes('gc'))) ||
        (f === 'ip1' && (r.includes('intended parent 1') || r.includes('ip1') || (r.includes('intended parent') && !r.includes('2')))) ||
        (f === 'ip2' && (r.includes('intended parent 2') || r.includes('ip2'))) ||
        (f === 'admin' && (r.includes('admin') || r.includes('agency'))) ||
        ((f === 'partner' || f === 'parnter') && r.includes('partner')) ||
        (f === r)

      if (!isMyField) continue

      // Check if field has a value
      if (fieldType === 'signature' || fieldType.startsWith('signature')) {
        if (!signatureValue?.name && !signatureValue?.image) missing.push('Signature')
      } else if (fieldType.startsWith('checkbox') || fieldType.startsWith('optionalinitials') || fieldType.startsWith('optionaltext')) {
        // These are optional — skip validation
      } else if (fieldType === 'date') {
        // Date is auto-filled
      } else {
        const val = fieldValues[fieldId]
        if (!val || !val.toString().trim()) {
          const label = fieldType.charAt(0).toUpperCase() + fieldType.slice(1)
          missing.push(label)
        }
      }
    }
    return [...new Set(missing)] // deduplicate
  }

  async function handleSign() {
    if (!doc || !mySigner || !agreed) return
    const incomplete = getIncompleteFields()
    if (incomplete.length > 0) {
      alert(`Please complete all required fields before signing:\n\n• ${incomplete.join('\n• ')}`)
      return
    }
    if (!signatureValue?.name && !signatureValue?.image) {
      alert('Please provide your signature.')
      return
    }
    setSigning(true)
    try {
      // Build placeholder-to-value mapping for the signed PDF
      const fields = getFields()
      const placeholderValues = {}
      for (const f of fields) {
        const val = fieldValues[f.fieldId]
        if (val !== undefined && val !== null) {
          placeholderValues[f.placeholder] = typeof val === 'boolean' ? (val ? '☑' : '☐') : String(val)
        }
      }
      const signatureData = {
        type: signatureValue?.type || 'typed',
        name: signatureValue?.name || mySigner.name || '',
        image: signatureValue?.image || null,
        fieldValues,
        placeholderValues,
      }
      const updated = await signDocument(doc.id, mySigner.email, signatureData)

      // If all signers done, generate a signed PDF from the rendered document
      // Generate signed PDF via Google Docs API and file to case
      if (updated.status === 'completed' && updated.case_id && supabase) {
        try {
          const meta = JSON.parse(updated.document_hash || '{}')
          // Use the working copy (edited draft) if available, otherwise fall back to original template
          const templateDocId = meta.workingDocId || meta.templateDocId
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
            // Clean up the draft copy from Google Drive (no longer needed)
            if (meta.workingDocId && meta.workingDocId !== meta.templateDocId) {
              const { deleteGoogleDriveFile } = await import('@/lib/google')
              deleteGoogleDriveFile(adminUserId, meta.workingDocId).catch(() => {})
            }
          } else {
            // Fallback: file the sent PDF or HTML
            const pdfPath = meta.pdfPath || updated.file_path
            const htmlPath = meta.htmlPath
            const filePath = pdfPath || htmlPath
            if (filePath) {
              const { data: urlData } = supabase.storage.from('esign-documents').getPublicUrl(filePath)
              if (urlData?.publicUrl) {
                await supabase.from('case_documents').insert({
                  surrogate_id: updated.case_id,
                  category: 'e-signature',
                  file_name: `[Signed] ${updated.title || 'Document'}${pdfPath ? '.pdf' : '.html'}`,
                  file_type: pdfPath ? 'application/pdf' : 'text/html',
                  storage_path: filePath,
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
            const filePath = meta.pdfPath || updated.file_path || meta.htmlPath
            if (filePath) {
              const { data: urlData } = supabase.storage.from('esign-documents').getPublicUrl(filePath)
              if (urlData?.publicUrl) {
                await supabase.from('case_documents').insert({
                  surrogate_id: updated.case_id,
                  category: 'e-signature',
                  file_name: `[Signed] ${updated.title || 'Document'}`,
                  file_type: filePath.endsWith('.pdf') ? 'application/pdf' : 'text/html',
                  storage_path: filePath,
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

  // Pull signer-facing title from metadata if the admin set one; fallback to internal title.
  let signerFacingTitle = doc?.title
  try {
    const meta = JSON.parse(doc?.document_hash || '{}')
    if (meta?.recipientTitle) signerFacingTitle = meta.recipientTitle
  } catch {}

  // Email verification gate
  if (!verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <Card className="max-w-md rounded-2xl"><CardContent className="py-8 space-y-6">
          <div className="text-center">
            <img src="/abc-logo.png" alt="ABC Surrogacy" className="h-14 mx-auto mb-4" />
            <h2 className="text-xl font-bold">{signerFacingTitle}</h2>
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
          <h1 className="text-xl font-bold text-[#283693]">{signerFacingTitle}</h1>
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
        <Card className="rounded-2xl shadow-lg overflow-hidden">
          <CardContent className="p-8 overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
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

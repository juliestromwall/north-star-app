/**
 * PDF overlay helper for templates with `layoutMode: 'pdf-overlay'`.
 *
 * Used for picky medical-records release forms where the receiving party
 * (e.g. Kaiser) requires their EXACT PDF — we can't re-render an HTML
 * facsimile. We render the original PDF as the background in the signing
 * UI, position widgets at known (x, y) coordinates, then on submit we use
 * pdf-lib to draw the typed values + signature image directly onto a
 * copy of the original PDF and save the flattened result.
 *
 * Coordinates are PDF-points, origin BOTTOM-LEFT, per pdf-lib convention.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

/**
 * Format DOB → "MM/DD/YYYY". Accepts ISO ("1991-10-15"), already-slashed,
 * or anything Date can parse. Returns input unchanged if we can't parse.
 */
function formatDob(raw) {
  if (!raw) return ''
  const s = String(raw).trim()
  // Already MM/DD/YYYY (or M/D/YYYY) — normalize to padded
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [m, d, y] = s.split('/')
    return `${m.padStart(2, '0')}/${d.padStart(2, '0')}/${y}`
  }
  // ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`
  // Fallback — let Date try
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
  }
  return s
}

/**
 * Format phone → "AAA    NNN-NNNN" (4 spaces between area code + main).
 * Kaiser's form pre-prints "Phone #: ( )" so the area code lands inside
 * the parens and the 7-digit number lands past the closing paren.
 */
function formatPhoneForKaiser(raw) {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length < 10) return String(raw)
  const area = digits.slice(-10, -7)
  const prefix = digits.slice(-7, -4)
  const line = digits.slice(-4)
  return `${area}    ${prefix}-${line}`
}

/**
 * Resolve the value for a single overlay field from the surrogate's
 * profile data + admin pre-fill values. Returns the raw string to draw
 * (or null/undefined if the field is a signature image — handled below).
 */
export function resolveOverlayValue(field, ctx) {
  const { gc = {}, admin = {}, today, signatures = {}, fieldValues = {} } = ctx

  // Admin pre-fill: e.g. Step 1 date range on the Kaiser form.
  if (field.adminField) return admin[field.adminField] || ''

  // Per-field manual override (from the live form input on the signing page).
  if (fieldValues[field.id] !== undefined && fieldValues[field.id] !== '') return fieldValues[field.id]

  // Signature is handled separately as an image, not a string.
  if (field.type === 'signature') return null

  // Auto-derived values from the GC profile / today.
  switch (field.source) {
    case 'gcName':       return gc.name || ''
    case 'gcDob':        return formatDob(gc.dob)
    case 'gcEmail':      return gc.email || ''
    case 'gcPhone':      return formatPhoneForKaiser(gc.phone)
    case 'gcStreet':     return gc.street || ''
    case 'gcCity':       return gc.city || ''
    case 'gcState':      return gc.state || ''
    case 'gcZipCode':    return gc.zipCode || ''
    case 'today':        return today || new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
    default:             return ''
  }
}

/**
 * AcroForm-aware name → context value lookup. Mirrors resolveOverlayValue
 * but keyed off the field's NAME (case-insensitive, trimmed) so the same
 * mapping works whether the template defines explicit overlay coords or
 * the PDF carries named form fields.
 */
export function valueForFieldName(rawName, ctx) {
  const name = String(rawName || '').trim().toLowerCase()
  const { gc = {}, admin = {}, today, fieldValues = {} } = ctx
  if (name === 'gcsignature') return { isSignature: true }
  // Live override from the signing-page input
  if (fieldValues[rawName] !== undefined && fieldValues[rawName] !== '') return { text: fieldValues[rawName] }
  switch (name) {
    case 'gcname':         return { text: gc.name || '' }
    case 'gcdob':          return { text: formatDob(gc.dob) }
    case 'gcstreet':       return { text: gc.street || '' }
    case 'gccity':         return { text: gc.city || '' }
    case 'gcstate':        return { text: gc.state || '' }
    case 'gczipcode':      return { text: gc.zipCode || '' }
    case 'gcphone':        return { text: formatPhoneForKaiser(gc.phone) }
    case 'gcemail':        return { text: gc.email || '' }
    case 'step1daterange': return { text: admin.step1DateRange || '' }
    case 'gcsigndate':     return { text: today || new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) }
    default:               return { text: '' }
  }
}

/**
 * Draw the overlay onto a copy of the original PDF and return a flattened
 * Blob that's safe to upload to Storage as the signed copy.
 *
 * Two paths:
 *  1. AcroForm path — when the PDF has named text fields. Fill by name,
 *     draw signature image at the signature field's widget rect, flatten.
 *     Pixel-perfect because the form fields know their own positions.
 *  2. Coordinate path — fallback for PDFs without form fields. Reads
 *     overlay coords from the template entry.
 *
 * @param pdfBytes  ArrayBuffer of the original template PDF
 * @param overlay   Array of { id, page, x, y, width, height, fontSize, type, source, adminField } from the template
 * @param ctx       { gc, admin, today, signatures, fieldValues }
 */
export async function bakePdfOverlay(pdfBytes, overlay, ctx = {}) {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const form = pdf.getForm()
  const fields = form.getFields()

  // ── AcroForm path ──
  if (fields.length > 0) {
    const helvOblique = await pdf.embedFont(StandardFonts.HelveticaOblique)
    for (const field of fields) {
      const rawName = field.getName()
      const resolved = valueForFieldName(rawName, ctx)

      if (resolved.isSignature) {
        const sig = ctx.signatures?.signature || ctx.signatures?.[rawName.trim()] || ctx.signatures?.[rawName]
        let geom = null
        try {
          const widgets = field.acroField.getWidgets()
          if (widgets.length) {
            const rect = widgets[0].getRectangle()
            const pageRef = widgets[0].P()
            let pageIndex = 0
            const pages = pdf.getPages()
            for (let i = 0; i < pages.length; i++) {
              if (pages[i].ref === pageRef) { pageIndex = i; break }
            }
            geom = { pageIndex, rect }
          }
        } catch {}
        if (geom) {
          const page = pdf.getPages()[geom.pageIndex]
          const { rect } = geom
          if (sig?.type === 'drawn' && sig.image) {
            try {
              const imgBytes = await fetch(sig.image).then(r => r.arrayBuffer())
              const png = await pdf.embedPng(imgBytes)
              page.drawImage(png, { x: rect.x, y: rect.y, width: rect.width, height: rect.height })
            } catch (err) { console.warn('Failed to embed drawn signature:', err) }
          } else if (sig?.name) {
            page.drawText(sig.name, {
              x: rect.x + 2,
              y: rect.y + Math.max(2, rect.height * 0.25),
              size: Math.min(rect.height - 4, 14),
              font: helvOblique,
              color: rgb(0.16, 0.21, 0.58),
            })
          }
        }
        // Remove signature field so the form-flatten step doesn't draw an empty box on top
        try { form.removeField(field) } catch {}
        continue
      }

      if (typeof field.setText === 'function' && resolved.text) {
        try { field.setText(String(resolved.text)) } catch (err) { console.warn(`setText(${rawName}) failed:`, err) }
      }
    }
    // Flatten so the values + signature image are baked permanently
    try { form.flatten() } catch (err) { console.warn('Form flatten failed:', err) }
    const finalBytes = await pdf.save()
    return new Blob([finalBytes], { type: 'application/pdf' })
  }

  // ── Coordinate path (legacy fallback) ──
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvOblique = await pdf.embedFont(StandardFonts.HelveticaOblique)
  const pages = pdf.getPages()

  for (const field of overlay) {
    const page = pages[field.page]
    if (!page) continue

    if (field.type === 'signature') {
      const sig = ctx.signatures?.[field.id]
      if (!sig) continue
      if (sig.type === 'drawn' && sig.image) {
        // Drawn signature — embed PNG and place at field rect
        try {
          const imgBytes = await fetch(sig.image).then(r => r.arrayBuffer())
          const png = await pdf.embedPng(imgBytes)
          const w = field.width || 240
          const h = field.height || 28
          page.drawImage(png, { x: field.x, y: field.y, width: w, height: h })
        } catch (err) {
          console.warn('Failed to embed drawn signature:', err)
        }
      } else if (sig.name) {
        // Typed signature — render as italic Helvetica
        page.drawText(sig.name, {
          x: field.x,
          y: field.y + 4,
          size: field.fontSize || 14,
          font: helvOblique,
          color: rgb(0.16, 0.21, 0.58), // ABC indigo
        })
      }
      continue
    }

    const value = resolveOverlayValue(field, ctx)
    if (!value) continue

    const text = String(value)
    const size = field.fontSize || 11
    page.drawText(text, {
      x: field.x,
      y: field.y,
      size,
      font: helv,
      color: rgb(0, 0, 0),
      maxWidth: field.width,
    })
  }

  const finalBytes = await pdf.save()
  return new Blob([finalBytes], { type: 'application/pdf' })
}

/** Helper: load the template PDF as ArrayBuffer */
export async function loadTemplatePdf(pdfPath) {
  const res = await fetch(pdfPath)
  if (!res.ok) throw new Error(`Failed to load template PDF (${res.status})`)
  return res.arrayBuffer()
}

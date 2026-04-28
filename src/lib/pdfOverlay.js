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
    case 'gcDob':        return gc.dob || ''
    case 'gcEmail':      return gc.email || ''
    case 'gcPhone':      return gc.phone || ''
    case 'gcStreet':     return gc.street || ''
    case 'gcCity':       return gc.city || ''
    case 'gcState':      return gc.state || ''
    case 'gcZipCode':    return gc.zipCode || ''
    case 'today':        return today || new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
    default:             return ''
  }
}

/**
 * Draw the overlay onto a copy of the original PDF and return a flattened
 * Blob that's safe to upload to Storage as the signed copy.
 *
 * @param pdfBytes  ArrayBuffer of the original template PDF
 * @param overlay   Array of { id, page, x, y, width, height, fontSize, type, source, adminField } from the template
 * @param ctx       { gc, admin, today, signatures, fieldValues } (see resolveOverlayValue)
 */
export async function bakePdfOverlay(pdfBytes, overlay, ctx = {}) {
  const pdf = await PDFDocument.load(pdfBytes)
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

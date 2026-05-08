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
 *
 * Returns one of:
 *  - { isSignature: true }                 → bake step embeds signature image at all widgets
 *  - { isCheckbox: true, checked: bool }   → bake step calls check()/uncheck() on the field
 *  - { text: '...' }                       → bake step calls setText() on the field
 */
export function valueForFieldName(rawName, ctx) {
  const name = String(rawName || '').trim().toLowerCase()
  const { gc = {}, ip = {}, admin = {}, today, fieldValues = {} } = ctx

  // Any field whose name contains "signature" is treated as a signature
  // widget — covers gcsignature (Kaiser) AND ip_signature (IP background
  // waiver, plus any future forms that follow the convention). The "name"
  // version (e.g. ip_signature_name) is the typed-name receipt and stays a
  // text field, which the suffix check rules out.
  if (name.includes('signature') && !name.endsWith('_name') && !name.endsWith('name')) {
    return { isSignature: true }
  }

  const todayStr = today || new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })

  // ── IP background waiver checkboxes (mutually exclusive: wantsCopy) ──
  if (name === 'ip_copy_yes') return { isCheckbox: true, checked: fieldValues.wantsCopy === 'yes' || fieldValues.wantsCopy === true }
  if (name === 'ip_copy_no')  return { isCheckbox: true, checked: fieldValues.wantsCopy === 'no'  || fieldValues.wantsCopy === false }

  // Live override from the signing-page input wins over derived values.
  // Page-2 sign-date field on the IP waiver was auto-named by PDFescape; map
  // it to today's date.
  if (rawName === 'text_25cowc' && (fieldValues[rawName] === undefined || fieldValues[rawName] === '')) {
    return { text: todayStr }
  }
  if (fieldValues[rawName] !== undefined && fieldValues[rawName] !== '') return { text: fieldValues[rawName] }

  // ── GC fields (Kaiser) ──
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
    case 'gcsigndate':     return { text: todayStr }
  }

  // ── IP background waiver fields ──
  switch (name) {
    case 'ip_first_name':       return { text: ip.firstName || '' }
    case 'ip_middle_name':      return { text: ip.middleName || '' }
    case 'ip_last_name':        return { text: ip.lastName || '' }
    case 'ip_phone':            return { text: ip.phone || '' }
    case 'ip_dob':              return { text: formatDob(ip.dob) }
    case 'ip_ssn':              return { text: ip.ssn || '' }
    case 'ip_dl_number':        return { text: ip.dlNumber || '' }
    case 'ip_dl_state':         return { text: ip.dlState || '' }
    case 'ip_dl_exp':           return { text: formatDob(ip.dlExp) }
    case 'ip_signature_name':   return { text: ip.fullName || [ip.firstName, ip.lastName].filter(Boolean).join(' ') || '' }
    case 'ip_sign_date':        return { text: todayStr }
  }

  return { text: '' }
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
        // Iterate ALL widgets — IP background waiver has the same
        // ip_signature field placed in 3 spots (top P1, bottom P1, P2);
        // we want the signature image at every location. Dedupe by
        // rounded position so a phantom-overlapping widget doesn't
        // double-stamp the signature at the same spot.
        let geoms = []
        const seenPos = new Set()
        try {
          const widgets = field.acroField.getWidgets()
          const pages = pdf.getPages()
          for (const w of widgets) {
            const rect = w.getRectangle()
            const pageRef = w.P()
            let pageIndex = 0
            for (let i = 0; i < pages.length; i++) {
              if (pages[i].ref === pageRef) { pageIndex = i; break }
            }
            const posKey = `${pageIndex}:${Math.round(rect.x)}:${Math.round(rect.y)}`
            if (seenPos.has(posKey)) continue
            seenPos.add(posKey)
            geoms.push({ pageIndex, rect })
          }
        } catch {}
        // Pre-embed the PNG once if drawn — avoids repeating the fetch+embed work.
        let png = null
        if (sig?.type === 'drawn' && sig.image) {
          try {
            const imgBytes = await fetch(sig.image).then(r => r.arrayBuffer())
            png = await pdf.embedPng(imgBytes)
          } catch (err) { console.warn('Failed to embed drawn signature:', err) }
        }
        // Empty the field BEFORE drawing so the upcoming form.flatten()
        // doesn't render the field's appearance stream on top of (or
        // alongside) our signature image. setText('') here is safer than
        // removeField — pdf-lib leaves the widget annotations behind on
        // removeField, which can still get rendered by flatten and stack
        // a second copy of the signature at the same widget position.
        try { if (typeof field.setText === 'function') field.setText('') } catch {}
        for (const { pageIndex, rect } of geoms) {
          const page = pdf.getPages()[pageIndex]
          // The drawn-signature canvas has white-space padding above/below the
          // ink. Pulling the image down by ~half the rect height lands the
          // visible signature on the underline rather than floating above it.
          const SIG_Y_OFFSET = -Math.round(rect.height * 0.5)
          if (png) {
            page.drawImage(png, { x: rect.x, y: rect.y + SIG_Y_OFFSET, width: rect.width, height: rect.height })
          } else if (sig?.name) {
            // Typed signature — baseline sits just above the underline
            page.drawText(sig.name, {
              x: rect.x + 2,
              y: rect.y - 2,
              size: Math.min(rect.height - 2, 14),
              font: helvOblique,
              color: rgb(0.16, 0.21, 0.58),
            })
          }
        }
        // Remove signature field so the form-flatten step doesn't draw an empty box on top
        try { form.removeField(field) } catch {}
        continue
      }

      if (resolved.isCheckbox) {
        try {
          if (typeof field.check === 'function' && typeof field.uncheck === 'function') {
            if (resolved.checked) field.check(); else field.uncheck()
          }
        } catch (err) { console.warn(`checkbox(${rawName}) failed:`, err) }
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

/**
 * Append an "Electronic Signature Certificate" page to a signed PDF blob.
 * This is the audit-trail evidence page that makes the signature ESIGN /
 * UETA defensible — same content the doc-first release forms attach.
 *
 * Drawn natively with pdf-lib (no html2canvas dance) so it's fast and
 * crisp, and we can keep the original baked PDF intact and just add a
 * trailing page.
 */
export async function appendAuditTrailPage(pdfBlob, audit) {
  const buf = await pdfBlob.arrayBuffer()
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true })
  const page = pdf.addPage([612, 792]) // US Letter
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const indigo = rgb(40 / 255, 54 / 255, 147 / 255)
  const grey = rgb(0.35, 0.35, 0.35)

  // Top accent bar
  page.drawRectangle({ x: 50, y: 750, width: 512, height: 2, color: indigo })

  // Heading
  page.drawText('ELECTRONIC SIGNATURE CERTIFICATE', {
    x: 50, y: 720, size: 14, font: helvBold, color: indigo,
  })

  const completed = (audit?.signedAt instanceof Date ? audit.signedAt : new Date())
    .toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    })
  const sigType = audit?.signatureType === 'drawn' ? 'Hand-drawn' : 'Typed'
  const sigDescriptor = audit?.signatureName ? `${sigType} — ${audit.signatureName}` : sigType

  const rows = [
    ['Document:',     audit?.documentTitle || ''],
    ['Document ID:',  audit?.documentId || ''],
    ['Completed:',    completed],
    ['Signer:',       audit?.signerName || ''],
    ['Email:',        audit?.signerEmail || ''],
    ['Signature:',    sigDescriptor],
    ['User Agent:',   audit?.userAgent || ''],
    ['IP Address:',   audit?.ipAddress || 'Captured at signing'],
  ]

  // Wrap a value into lines that fit a given width, at the given font size.
  // Word-aware where possible; falls back to char-by-char so a long UA
  // string (Mozilla/5.0 ... like Gecko) Chrome/142.0.0.0 Safari/537.36)
  // breaks instead of running off the page.
  function wrapValue(text, maxWidth, font, size) {
    const s = String(text || '')
    if (!s) return ['']
    const words = s.split(/(\s+)/) // keep separators so we can rejoin cleanly
    const lines = []
    let current = ''
    function flush() { if (current) { lines.push(current); current = '' } }
    for (const w of words) {
      const trial = current + w
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
        current = trial
        continue
      }
      // Word doesn't fit on the current line: emit current, then break the
      // word itself char-by-char if it's still too wide on its own.
      flush()
      if (font.widthOfTextAtSize(w, size) <= maxWidth) {
        current = w.replace(/^\s+/, '')
        continue
      }
      let chunk = ''
      for (const ch of w) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
          if (chunk) lines.push(chunk)
          chunk = ch
        } else {
          chunk += ch
        }
      }
      current = chunk
    }
    flush()
    return lines.length ? lines : ['']
  }

  const VALUE_X = 200
  const VALUE_MAX_WIDTH = 562 - VALUE_X
  const SIZE = 11
  const LINE_HEIGHT = 14
  let y = 685
  for (const [label, val] of rows) {
    if (!val) continue
    page.drawText(label, { x: 50, y, size: SIZE, font: helvBold, color: rgb(0, 0, 0) })
    const lines = wrapValue(val, VALUE_MAX_WIDTH, helv, SIZE)
    for (let i = 0; i < lines.length; i++) {
      page.drawText(lines[i], { x: VALUE_X, y: y - i * LINE_HEIGHT, size: SIZE, font: helv, color: rgb(0, 0, 0) })
    }
    // Reserve enough vertical space for the wrapped lines (min 22pt to keep
    // the row rhythm matching pre-wrap layout).
    y -= Math.max(22, lines.length * LINE_HEIGHT + 8)
  }

  // Footer disclaimer
  const footer1 = 'Electronically signed via North Star Surrogacy (app.northstarsurrogacy.com) in accordance with the'
  const footer2 = 'ESIGN Act and UETA. A tamper-proof audit trail has been recorded for each signature event.'
  page.drawLine({ start: { x: 50, y: y - 16 }, end: { x: 562, y: y - 16 }, thickness: 0.5, color: grey })
  page.drawText(footer1, { x: 50, y: y - 36, size: 9, font: helv, color: grey })
  page.drawText(footer2, { x: 50, y: y - 50, size: 9, font: helv, color: grey })

  const finalBytes = await pdf.save()
  return new Blob([finalBytes], { type: 'application/pdf' })
}

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Printer, Loader2, CheckCircle2 } from 'lucide-react'
import { fetchCaseDocuments } from '@/lib/db'
import { useRole } from '@/context/RoleContext'

// A system-created release form — these are the e-signed Release Forms,
// stored in the 'e-signature' category. (We intentionally only surface these
// in the fax picker, not arbitrary case documents.)
function isReleaseForm(d) {
  return d?.category === 'e-signature'
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const stripExt = (n) => (n || '').replace(/\.(pdf|html?)$/i, '')

// Pick the release form that matches this record's provider (e.g. clicking
// "Fax Release Form" on a "Western OBGYN" record defaults to the release form
// whose name includes "Western OBGYN"). Release forms are titled like
// "Medical Records Release - Prenatal/OB - Western OBGYN, …", so we check
// whether the release-form name CONTAINS the record's provider/clinic name.
// Returns null when there's no match — so records without a release form
// (PAP, OB Clearance, …) don't default to an unrelated form.
function matchReleaseForm(releaseForms, step, providerName) {
  // The record label is "{provider} - {year} {type}" — take the provider part.
  const labelProvider = String(step?.label || '').split(/\s+[—-]\s+/)[0]
  const candidates = [providerName, labelProvider].map(norm).filter(s => s.length > 3)
  for (const c of candidates) {
    const m = releaseForms.find(d => norm(stripExt(d.file_name)).includes(c))
    if (m) return m
  }
  return null
}

function fmtFax(v) {
  const digits = String(v || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

async function urlToBase64(url) {
  const res = await fetch(url)
  const blob = await res.blob()
  return await new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result.split(',')[1])
    r.readAsDataURL(blob)
  })
}

// Fax a medical-record release form to a provider, pre-filled with the
// provider's fax number saved on the record. Self-contained so it works
// wherever the Medical Records view is used. Admin-only (caller gates it).
export default function FaxReleaseFormDialog({ open, onClose, step, surrogateId, surrogateName, surrogateDob, caseType = 'gc', onSent }) {
  const { currentUser } = useRole()
  const provider = step?._provider || {}

  const [faxNumber, setFaxNumber] = useState('')
  const [toName, setToName] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [signatureHtml, setSignatureHtml] = useState('')
  const [docs, setDocs] = useState([])
  const [selectedDocId, setSelectedDocId] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [includeDL, setIncludeDL] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!open) return
    setFaxNumber(provider.fax || '')
    setToName(provider.name || 'Medical Records Dept.')
    // Same template as faxing from a document, so the user sees/edits exactly
    // what's going out on the cover page.
    setSubject(`STAT! First Star Surrogacy requesting ALL Medical Records for ${surrogateName || ''}${surrogateDob ? ` (DOB: ${surrogateDob})` : ''}`)
    setMessage(`Please find the attached medical records release form for patient ${surrogateName || ''}${surrogateDob ? ` (DOB: ${surrogateDob})` : ''}. Please send <b><u>ALL</u></b> medical records, reports, lab reports, discharge notes, and Doctor notes to either records@firststarsurrogacy.com or fax to: 612-524-7961.\n\nThank you so much!`)
    setUploadFile(null)
    setResult(null)
    // Fetch the current user's Gmail signature for the cover page.
    import('@/lib/google').then(({ getGmailSignature }) => {
      if (currentUser?.id) getGmailSignature(currentUser.id).then(html => setSignatureHtml(html || '')).catch(() => setSignatureHtml(''))
    }).catch(() => {})
    fetchCaseDocuments(surrogateId).then(list => {
      setDocs(list || [])
      const releaseForms = (list || []).filter(isReleaseForm)
      const match = matchReleaseForm(releaseForms, step, provider.name)
      setSelectedDocId(match ? String(match.id) : '')
    }).catch(() => setDocs([]))
  }, [open, surrogateId, surrogateName, surrogateDob, provider.fax, provider.name, currentUser?.id])

  const selectedDoc = docs.find(d => String(d.id) === String(selectedDocId))
  const releaseForms = docs.filter(isReleaseForm)
  const canSend = /^\d{3}-\d{3}-\d{4}$/.test(faxNumber) && (selectedDoc || uploadFile) && !sending

  async function handleSend() {
    setSending(true); setResult(null)
    try {
      const { sendFax } = await import('@/lib/fax')
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const coverHtml = `
        <div style="font-family: Arial, sans-serif; width: 816px; padding: 50px; color: #000;">
          <table style="width: 100%; border: 2px solid #000; border-collapse: collapse; margin-bottom: 30px;">
            <tr>
              <td style="text-align: center; padding: 25px; vertical-align: middle;">
                <img src="${window.location.origin}/first-star-logo.png" style="height: 90px; display: inline-block;" />
                <p style="font-size: 12px; margin: 8px 0 0 0;">Tel: 970-381-6847 &nbsp;&nbsp; Fax: 612-524-7961</p>
              </td>
              <td style="border-left: 2px solid #000; padding: 20px 30px; font-size: 40px; font-weight: 700; text-align: center; width: 120px; vertical-align: middle;">Fax</td>
            </tr>
          </table>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; width: 50%;"><strong>To:</strong> &nbsp; ${toName || ''}</td>
              <td style="padding: 10px 0;"><strong>From:</strong> &nbsp; ${currentUser?.name || 'First Star Surrogacy'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0;"><strong>Fax:</strong> &nbsp; ${faxNumber}</td>
              <td style="padding: 10px 0;"><strong>Date:</strong> &nbsp; ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            </tr>
          </table>
          <div style="margin-top: 10px; padding-top: 10px; border-top: 3px solid #000;">
            <p style="font-size: 16px; font-weight: 700; margin: 10px 0;"><strong>Subject:</strong> ${subject}</p>
          </div>
          <div style="border-top: 1px solid #000; margin-top: 10px; padding-top: 16px; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${message}</div>
          <div style="margin-top: 40px;">
            ${signatureHtml || `<div style="display: flex; align-items: flex-start; gap: 16px;"><img src="${window.location.origin}/first-star-logo.png" style="height: 50px;" onerror="this.style.display='none'" /><div style="font-size: 12px; line-height: 1.5;"><p style="margin: 0; font-weight: 700;">Jennifer Maatman</p><p style="margin: 0; font-style: italic;">Founder, First Star Surrogacy, LLC</p><p style="margin: 0;">O: 970-381-6847 &nbsp; F: 612-524-7961</p></div></div>`}
          </div>
          <div style="margin-top: 30px; padding: 12px; border: 1px solid #000; font-size: 9px; line-height: 1.4;">
            FIRST STAR SURROGACY, LLC does not and cannot give medical, insurance or legal advice. Nothing in this document or any communication written or verbal should in any way be considered medical, insurance or legal advice. If you have any questions, you should consult a qualified specialist.
          </div>
        </div>`

      const overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:white;z-index:99999;display:flex;align-items:center;justify-content:center;'
      overlay.innerHTML = '<p style="color:#1A3638;font-size:18px;font-weight:600;">Preparing fax...</p>'
      document.body.appendChild(overlay)
      const coverEl = document.createElement('div')
      coverEl.style.cssText = 'position:fixed;top:0;left:0;width:816px;background:white;z-index:99998;'
      coverEl.innerHTML = coverHtml
      document.body.appendChild(coverEl)
      await new Promise(r => setTimeout(r, 700))
      const coverCanvas = await html2canvas(coverEl, { scale: 2, useCORS: true, backgroundColor: '#fff' })
      document.body.removeChild(coverEl)
      document.body.removeChild(overlay)

      const coverPdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' })
      const cImg = coverCanvas.toDataURL('image/jpeg', 0.95)
      const cHeight = (coverCanvas.height * 8.5) / coverCanvas.width
      coverPdf.addImage(cImg, 'JPEG', 0, 0, 8.5, cHeight)
      const coverBase64 = coverPdf.output('datauristring').split(',')[1]

      // Release form (selected case doc or uploaded file)
      const additionalFiles = []
      let attachName = ''
      if (uploadFile) {
        const { fileToBase64 } = await import('@/lib/fax')
        additionalFiles.push({ fileName: uploadFile.name, fileContent: await fileToBase64(uploadFile) })
        attachName = uploadFile.name
      } else if (selectedDoc?.public_url) {
        additionalFiles.push({ fileName: selectedDoc.file_name, fileContent: await urlToBase64(selectedDoc.public_url) })
        attachName = selectedDoc.file_name
      }
      // Optional GC driver's license
      if (includeDL) {
        const dl = docs.find(d => d.category === 'photo-id' && d.doc_label === 'gc') || docs.find(d => d.category === 'photo-id')
        if (dl?.public_url) {
          try { additionalFiles.push({ fileName: dl.file_name, fileContent: await urlToBase64(dl.public_url) }) } catch { /* skip DL */ }
        }
      }

      const result = await sendFax({
        to: faxNumber.replace(/\D/g, ''),
        fileName: 'cover_page.pdf',
        fileContent: coverBase64,
        additionalFiles,
      })
      setResult({ success: true, faxId: result.faxId || result.Status })

      // Log to case emails
      try {
        const { supabase } = await import('@/lib/supabase')
        if (supabase && surrogateId) {
          await supabase.from('case_emails').insert({
            gmail_message_id: 'fax-' + Date.now(),
            case_id: surrogateId,
            case_type: caseType,
            subject: `Release form faxed to ${faxNumber}`,
            from_address: currentUser?.email || '',
            to_address: faxNumber,
            date: new Date().toISOString(),
            snippet: `Release form faxed by ${currentUser?.name || 'Admin'} to ${faxNumber}${toName ? ` (${toName})` : ''}\n\nFor record: ${step?.label || ''}\nAttachment: ${attachName}\n\nFax ID: ${result.faxId || result.Status}`,
            logged_by: currentUser?.id,
            logged_by_name: currentUser?.name || '',
            tag: 'fax',
          })
        }
      } catch (logErr) { console.error('Fax log failed:', logErr) }

      // Flip the record to "Faxed Request" + persist the fax number on it.
      onSent?.(step.id, faxNumber)
    } catch (err) {
      setResult({ error: err.message || 'Failed to send fax' })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Printer className="size-5 text-[#1A3638]" /> Fax Release Form</DialogTitle>
        </DialogHeader>
        {result?.success ? (
          <div className="text-center py-4 space-y-2">
            <CheckCircle2 className="size-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-stone-700">Fax queued successfully!</p>
            <p className="text-xs text-stone-400">Fax ID: {result.faxId}</p>
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-stone-500">Record: <strong className="text-stone-700">{step?.label}</strong></p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600">Fax Number *</label>
                <Input type="tel" placeholder="xxx-xxx-xxxx" value={faxNumber} onChange={e => setFaxNumber(fmtFax(e.target.value))} />
                {!provider.fax && <p className="text-[10px] text-amber-500">No fax saved on this record — enter it once and it'll be remembered.</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600">To (Recipient)</label>
                <Input value={toName} onChange={e => setToName(e.target.value)} placeholder="Medical Records Dept." />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-600">Release Form to send *</label>
              <select className="w-full text-sm rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[#1A3638]/30"
                value={uploadFile ? '__upload__' : selectedDocId} onChange={e => { if (e.target.value !== '__upload__') { setSelectedDocId(e.target.value); setUploadFile(null) } }}>
                <option value="">{releaseForms.length ? 'Select a release form…' : 'No system release forms found'}</option>
                {releaseForms.map(d => <option key={d.id} value={d.id}>{stripExt(d.file_name)}</option>)}
                {uploadFile && <option value="__upload__">{uploadFile.name} (upload)</option>}
              </select>
              <label className="text-[11px] text-[#1A3638] hover:underline cursor-pointer inline-block mt-1">
                or upload a file…
                <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setUploadFile(f); setSelectedDocId('') } }} />
              </label>
            </div>
            {/* Cover-page template — same as faxing from a document, editable */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-600">Subject</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-600">Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
                className="w-full text-sm rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-[#1A3638]/30 resize-none" />
            </div>
            {signatureHtml ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600">Your Signature (from Gmail)</label>
                <div className="border rounded-lg p-3 bg-stone-50 text-xs" dangerouslySetInnerHTML={{ __html: signatureHtml }} />
              </div>
            ) : (
              <p className="text-[10px] text-amber-500">No Gmail signature found — a default signature will be used.</p>
            )}
            <label className="flex items-center gap-2 cursor-pointer text-sm text-stone-700">
              <input type="checkbox" checked={includeDL} onChange={e => setIncludeDL(e.target.checked)} className="size-4 accent-[#1A3638]" />
              Include Driver's License (if on file)
            </label>
            {result?.error && <p className="text-xs text-red-500">{result.error}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" className="gap-1.5" style={{ backgroundColor: '#1A3638', color: '#fff' }} disabled={!canSend} onClick={handleSend}>
                {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}
                {sending ? 'Sending…' : 'Send Fax'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

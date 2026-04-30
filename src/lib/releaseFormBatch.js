/**
 * Batch-send for release forms. Creates one esign_documents row per selected
 * template, all sharing the same batchToken. Each unique recipient (gc,
 * partner, admin) receives ONE email listing every form they need to sign
 * with a single link to the batch-sign page.
 *
 * When re-batching a template whose previous doc is still pending, the old
 * doc is voided so the new batch is the only live copy.
 */
import { FORM_TEMPLATES } from './formTemplates'
import { supabase } from './supabase'
import { getAuthHeaders } from './authHeaders'

function randomToken(bytes = 16) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, '0')).join('')
}

function resolveSignersForTemplate(template, ctx) {
  const { surrogate, partnerName, partnerEmail, adminName, adminEmail, adultHouseholdMembers = [] } = ctx
  const mkSigner = role => {
    if (role === 'gc') return { role, name: surrogate?.name || '', email: surrogate?.email || '', status: 'pending' }
    if (role === 'partner') return { role, name: partnerName || '', email: partnerEmail || '', status: 'pending' }
    if (role === 'admin') return { role, name: adminName || 'Agency Representative', email: adminEmail || '', status: 'pending' }
    // householdMember1 → adultHouseholdMembers[0], etc. Index encoded in
    // the role suffix so each background waiver can route to its own
    // person without having to invent compound template ids.
    const memberMatch = /^householdMember(\d+)$/.exec(role || '')
    if (memberMatch) {
      const member = adultHouseholdMembers[Number(memberMatch[1]) - 1] || {}
      const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim()
      return { role, name, email: member.email || '', status: 'pending' }
    }
    return { role, name: '', email: '', status: 'pending' }
  }
  if (template.multiSigner) {
    const roles = template.signerRoles || ['gc', 'partner']
    return roles.map(mkSigner)
  }
  return [mkSigner(template.signerRole)]
}

function docTitleForTemplate(template, ctx) {
  const { surrogate } = ctx
  // Both doc-first (HIPAA, Psych, Ellen Winters) AND pdf-overlay (Kaiser)
  // get a "<Template Title> - <Surrogate Name>" doc title so the email
  // subject + the Signed Documents folder filename reflect the actual
  // form, not the legacy "Background Check Release Form" fallback.
  const isReleaseForm = template.layoutMode === 'doc-first' || template.layoutMode === 'pdf-overlay'
  if (isReleaseForm) {
    return `${template.title} - ${surrogate?.name || ''}`
  }
  // Background waivers keep the legacy title convention
  const signers = resolveSignersForTemplate(template, ctx)
  return `Background Check Release Form - ${signers[0]?.name || surrogate?.name || ''}`
}

async function sendBatchEmail({ recipientName, recipientEmail, formTitles, batchUrl, senderName, senderEmail }) {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' })
    const res = await fetch('/api/send-esign-email', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        signerName: recipientName,
        signerEmail: recipientEmail,
        formTitles, // array — send-esign-email renders a bulleted list
        formUrl: batchUrl,
        senderName,
        senderEmail,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.success === false) {
      return { success: false, error: data.error || data.message || `HTTP ${res.status}` }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * @param templateIds  Array of FORM_TEMPLATES keys to send
 * @param ctx          { surrogate, partnerName, partnerEmail, adminName, adminEmail, senderName, senderEmail, existingDocs }
 *                     existingDocs = array of already-pending esign_documents rows for this case
 * @returns { success, error, batchToken, createdDocIds }
 */
export async function sendReleaseFormsBatch(templateIds, ctx) {
  const { surrogate, senderName, senderEmail, existingDocs = [], adminValuesByTemplate = {} } = ctx

  if (!templateIds?.length) return { success: false, error: 'No templates selected' }
  if (!surrogate?.id) return { success: false, error: 'Missing surrogate case id' }
  if (!supabase) return { success: false, error: 'Supabase not configured' }

  const { createDocument, sendDocument, updateDocument, voidDocument } = await import('./esign')

  // Validate all signers up front
  const templates = templateIds.map(id => FORM_TEMPLATES[id]).filter(Boolean)
  for (const t of templates) {
    const signers = resolveSignersForTemplate(t, ctx)
    const missing = signers.find(s => !s.email)
    if (missing) {
      const lbl = missing.role === 'admin' ? 'Assigned admin email'
        : missing.role === 'partner' ? 'Partner email'
        : 'Surrogate email'
      return { success: false, error: `${lbl} is required (${t.title}).` }
    }
  }

  const batchToken = randomToken(16)
  const createdDocs = []

  // Void any existing pending docs for these templates (user opted to rebatch)
  for (const t of templates) {
    const stale = existingDocs.find(d => {
      try {
        const meta = JSON.parse(d.document_hash || '{}')
        return meta.templateId === t.id && d.status === 'pending'
      } catch { return false }
    })
    if (stale) {
      try { await voidDocument(stale.id, senderName || 'Admin') } catch (err) { console.error('Void old doc failed:', err) }
    }
  }

  // Create the new docs
  for (const t of templates) {
    const signers = resolveSignersForTemplate(t, ctx)
    const title = docTitleForTemplate(t, ctx)
    const formToken = randomToken(16)

    const doc = await createDocument({
      templateId: null,
      caseId: surrogate.id,
      caseType: 'surrogate',
      title,
      signers,
      filePath: null,
      createdBy: senderName || 'Admin',
    })

    const adminValues = adminValuesByTemplate[t.id] || null
    await updateDocument(doc.id, {
      document_hash: JSON.stringify({
        formToken,
        templateId: t.id,
        batchToken,
        ...(adminValues ? { adminValues } : {}),
      }),
    })

    await sendDocument(doc.id)
    createdDocs.push({ doc, template: t, signers, title })
  }

  // Group by unique recipient (case-insensitive email). Each recipient gets
  // one email listing ONLY the forms they're actually a signer on.
  const byEmail = new Map()
  for (const { signers, title } of createdDocs) {
    for (const signer of signers) {
      if (!signer.email) continue
      const key = signer.email.toLowerCase()
      if (!byEmail.has(key)) {
        byEmail.set(key, { name: signer.name, email: signer.email, titles: [] })
      }
      byEmail.get(key).titles.push(title)
    }
  }

  const batchUrl = `${window.location.origin}/e-signature/batch/${batchToken}`

  for (const { name, email, titles } of byEmail.values()) {
    const res = await sendBatchEmail({
      recipientName: name,
      recipientEmail: email,
      formTitles: titles,
      batchUrl,
      senderName,
      senderEmail,
    })
    if (!res.success) {
      return { success: false, error: `Email to ${email} failed: ${res.error}`, batchToken, createdDocIds: createdDocs.map(c => c.doc.id) }
    }
  }

  return { success: true, batchToken, createdDocIds: createdDocs.map(c => c.doc.id) }
}

/**
 * Auto-task creation when an e-sign batch (or single doc) is fully signed.
 *
 * - For release-form batches: one task when EVERY doc in the batch is at
 *   status='completed' and filed to the Signed Documents folder. Per-batch,
 *   not per-doc.
 * - For agency docs (clinic / hospital / OB releases) sent via the admin
 *   e-signature flow: one task when the doc is signed.
 *
 * Idempotent via a `completionTaskCreated` flag stored on the first doc's
 * document_hash — safe to call multiple times, e.g., from whichever signing
 * page files the final PDF.
 */
import { supabase } from './supabase'

function parseMeta(doc) {
  try { return JSON.parse(doc?.document_hash || '{}') } catch { return {} }
}

/**
 * @returns 'ip_background' | 'release' | 'clinic' | null — null means: don't auto-task.
 */
function classifyBatch(batchDocs) {
  // IP Background Waiver — template ids ip_background_waiver / ip2_background_waiver.
  // Distinct kind so the auto-task title + case_type can be IP-specific.
  const isIpBackground = batchDocs.some(d => {
    const t = parseMeta(d).templateId || ''
    return t === 'ip_background_waiver' || t === 'ip2_background_waiver'
  })
  if (isIpBackground) return 'ip_background'

  // Release forms come from the form-template registry — they carry a
  // templateId in document_hash. Covers HIPAA, Psych, Ellen Winters, and
  // background waivers (which share the "Release Forms" UI card).
  const hasFormTemplate = batchDocs.some(d => !!parseMeta(d).templateId)
  if (hasFormTemplate) return 'release'

  // Agency-flow docs: no templateId. Fall back to title-keyword detection
  // so clinic/hospital/OB release forms she sends via /e-signature can still
  // fire the right task.
  const allTitles = batchDocs.map(d => (d.title || '').toLowerCase()).join(' ')
  if (/clinic|hospital|\bob\b|obstetric|medical records? release/.test(allTitles)) return 'clinic'

  return null
}

async function getSurrogateName(caseId) {
  const { data } = await supabase
    .from('intake_submissions')
    .select('applicant_name, answers, assigned_to')
    .eq('id', caseId)
    .single()
  if (!data) return { name: 'Surrogate', assignedTo: null }
  const answers = data.answers || {}
  const name = data.applicant_name
    || [answers.firstName, answers.lastName].filter(Boolean).join(' ').trim()
    || 'Surrogate'
  return { name, assignedTo: data.assigned_to }
}

// IP-side equivalent. applicant_name on the intake row is already the
// "IP1 First Last & IP2 First Last" combined display label, so we can
// reuse it directly. Falls back to assembling from intake answers if
// applicant_name is empty.
async function getIpNames(caseId) {
  const { data } = await supabase
    .from('intake_submissions')
    .select('applicant_name, answers, assigned_to, intake_type')
    .eq('id', caseId)
    .single()
  if (!data) return { names: 'Intended Parents', assignedTo: null }
  const a = data.answers || {}
  const c = a._ipContact || {}
  const ip1 = [c.ip1FirstName || a.primaryFirstName, c.ip1LastName || a.primaryLastName].filter(Boolean).join(' ').trim()
  const ip2 = (a.hasPartner === 'yes' || a.hasPartner === true)
    ? [c.ip2FirstName || a.ip2FirstName, c.ip2LastName || a.ip2LastName].filter(Boolean).join(' ').trim()
    : ''
  const names = data.applicant_name
    || (ip2 ? `${ip1} & ${ip2}` : ip1)
    || 'Intended Parents'
  return { names, assignedTo: data.assigned_to }
}

export async function maybeCreateSigningCompletionTask(doc) {
  if (!supabase || !doc?.case_id) return

  const meta = parseMeta(doc)
  const batchToken = meta.batchToken

  // Load the full batch (or treat this doc as a batch of one)
  let batchDocs = [doc]
  if (batchToken) {
    const { data } = await supabase
      .from('esign_documents')
      .select('id, status, title, document_hash, case_id, created_at')
      .eq('case_id', doc.case_id)
    batchDocs = (data || []).filter(d => {
      const m = parseMeta(d)
      return m.batchToken === batchToken && d.status !== 'voided'
    })
    if (!batchDocs.length) batchDocs = [doc]
  }

  // Wait for every doc in the batch to be fully signed
  const allComplete = batchDocs.every(d => d.status === 'completed')
  if (!allComplete) return

  // Idempotency: flag on the first doc's document_hash
  batchDocs.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
  const anchor = batchDocs[0]
  const anchorMeta = parseMeta(anchor)
  if (anchorMeta.completionTaskCreated) return

  const kind = classifyBatch(batchDocs)
  if (!kind) return // not a release / clinic / IP background doc — skip auto-task

  // IP background waiver = IP case; everything else = surrogate case.
  let title, assignedTo, caseType
  if (kind === 'ip_background') {
    const r = await getIpNames(doc.case_id)
    assignedTo = r.assignedTo
    title = `Background Check Release complete for ${r.names}`
    caseType = 'ip'
  } else {
    const r = await getSurrogateName(doc.case_id)
    assignedTo = r.assignedTo
    title = kind === 'clinic'
      ? `Clinic/Hospital Release Forms Signed for ${r.name} - Saved in E-Signature Documents Folder`
      : `Release Forms Signed for ${r.name} - Saved in E-Signature Documents Folder`
    caseType = 'surrogate'
  }
  if (!assignedTo) return // no admin to assign to — bail quietly

  try {
    const { createCaseTask } = await import('./db')
    await createCaseTask({
      title,
      assigned_to: assignedTo,
      due_date: new Date().toISOString().split('T')[0],
      priority: 'medium',
      status: 'open',
      created_by: 'system',
      case_id: doc.case_id,
      case_type: caseType,
    })
  } catch (err) {
    console.error('Auto-task creation failed:', err)
    return // don't flag if the task itself failed
  }

  // Mark the anchor doc so a later sign-completion call on a sibling doesn't
  // re-create the task.
  try {
    await supabase
      .from('esign_documents')
      .update({ document_hash: JSON.stringify({ ...anchorMeta, completionTaskCreated: true }) })
      .eq('id', anchor.id)
  } catch (err) {
    console.error('Failed to mark completionTaskCreated flag:', err)
  }
}

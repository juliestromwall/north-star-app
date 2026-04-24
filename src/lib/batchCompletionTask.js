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
 * @returns 'release' | 'clinic' | null — null means: don't auto-task.
 */
function classifyBatch(batchDocs) {
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
  if (!kind) return // not a release or clinic doc — skip auto-task

  const { name: surrogateName, assignedTo } = await getSurrogateName(doc.case_id)
  if (!assignedTo) return // no admin to assign to — bail quietly

  const title = kind === 'clinic'
    ? `Clinic/Hospital Release Forms Signed for ${surrogateName} - Saved in E-Signature Documents Folder`
    : `Release Forms Signed for ${surrogateName} - Saved in E-Signature Documents Folder`

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
      case_type: 'surrogate',
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

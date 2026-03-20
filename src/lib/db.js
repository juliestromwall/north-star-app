import { supabase } from './supabase'

// Wrap a Supabase call with timeout. Returns null if Supabase is not configured.
async function withTimeout(buildQuery, ms = 12000) {
  if (!supabase) return null
  try {
    return await Promise.race([
      buildQuery(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
    ])
  } catch {
    return null
  }
}

// ── Admin Notes ──────────────────────────────────────────

export async function fetchActiveAdminNotes() {
  const result = await withTimeout(
    () => supabase.from('admin_notes').select('*, admin_note_dismissals(*)').eq('is_active', true).order('created_at', { ascending: false })
  )
  if (!result) return []
  if (result.error) throw result.error
  return result.data
}

export async function fetchAllAdminNotes() {
  const result = await withTimeout(
    () => supabase.from('admin_notes').select('*, admin_note_dismissals(*)').order('created_at', { ascending: false })
  )
  if (!result) return []
  if (result.error) throw result.error
  return result.data
}

export async function insertAdminNote(note) {
  const result = await withTimeout(
    () => supabase.from('admin_notes').insert(note).select().single()
  )
  if (!result) return null
  if (result.error) throw result.error
  return result.data
}

export async function updateAdminNote(id, updates) {
  const result = await withTimeout(
    () => supabase.from('admin_notes').update(updates).eq('id', id).select().single()
  )
  if (!result) return null
  if (result.error) throw result.error
  return result.data
}

export async function deleteAdminNote(id) {
  const result = await withTimeout(
    () => supabase.from('admin_notes').delete().eq('id', id)
  )
  if (!result) return
  if (result.error) throw result.error
}

export async function dismissAdminNote(noteId) {
  const result = await withTimeout(
    () => supabase.from('admin_note_dismissals').insert({ note_id: noteId }).select().single()
  )
  if (!result) return null
  if (result.error) throw result.error
  return result.data
}

// ── Intake Submissions ───────────────────────────────────

export async function fetchIntakeByEmail(email) {
  const result = await withTimeout(
    () => supabase.from('intake_submissions').select('answers').eq('applicant_email', email.trim().toLowerCase()).order('submitted_at', { ascending: false }).limit(1).single()
  )
  if (!result) return null
  if (result.error) return null
  return result.data?.answers || null
}

export async function checkEmailExists(email) {
  const result = await withTimeout(
    () => supabase.from('intake_submissions').select('id', { count: 'exact', head: true }).eq('applicant_email', email.trim().toLowerCase())
  )
  if (!result) return false
  if (result.error) return false
  return (result.count || 0) > 0
}

export async function insertIntakeSubmission(submission) {
  const result = await withTimeout(
    () => supabase.from('intake_submissions').insert(submission).select('id').single()
  )
  if (!result) return null
  if (result.error) throw result.error
  return result.data
}

export async function fetchIntakeSubmissions() {
  const result = await withTimeout(
    () => supabase.from('intake_submissions').select('*').order('submitted_at', { ascending: false }),
    20000
  )
  if (!result) return null
  if (result.error) throw result.error
  // Normalize snake_case rows to camelCase shape the UI expects
  return result.data.map(row => ({
    id: row.id,
    type: row.intake_type,
    submittedAt: row.submitted_at,
    status: row.status || (row.qualified ? 'qualified' : 'disqualified'),
    dqReasons: row.dq_reasons || [],
    tracking: {
      ...(row.tracking || {}),
      utm_source: row.utm_source,
      utm_medium: row.utm_medium,
      utm_campaign: row.utm_campaign,
      utm_content: row.utm_content,
      utm_term: row.utm_term,
      fbclid: row.fbclid,
      ttclid: row.ttclid,
      resolvedSource: row.resolved_source || row.tracking?.resolvedSource || null,
    },
    answers: row.answers || {},
    stateRegion: row.state_region || null,
  }))
}

export async function updateIntakeSubmissionStatus(id, status) {
  const result = await withTimeout(
    () => supabase.from('intake_submissions').update({ status }).eq('id', id).select().single()
  )
  if (!result) return null
  if (result.error) throw result.error
  return result.data
}

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

// ── Surrogates (from qualified intake submissions) ─────

export async function fetchSurrogatesFromIntake() {
  if (!supabase) return []
  const result = await withTimeout(
    () => supabase.from('intake_submissions')
      .select('*')
      .eq('intake_type', 'gc')
      .in('status', ['qualified', 'approved', 'reviewed', 'pending_review'])
      .order('submitted_at', { ascending: false }),
    20000
  )
  if (!result || result.error) return []
  return result.data.map(row => {
    const a = row.answers || {}
    const dob = a.dob ? new Date(a.dob) : null
    const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null
    return {
      id: row.id,
      name: `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unknown',
      email: row.applicant_email || a.email || '',
      age,
      location: [a.city, a.state].filter(Boolean).join(', ') || a.state || '',
      status: row.status === 'approved' ? 'active' : row.status === 'qualified' ? 'screening' : 'pending',
      intakeStatus: row.status,
      submittedAt: row.submitted_at,
      phone: a.phone || '',
      maritalStatus: a.maritalStatus || '',
      heightFt: a.heightFt,
      heightIn: a.heightIn,
      weightLbs: a.weightLbs,
      bmi: a.heightFt && a.weightLbs
        ? ((a.weightLbs / ((a.heightFt * 12 + (parseInt(a.heightIn) || 0)) ** 2)) * 703).toFixed(1)
        : null,
      healthyPregnancy: a.healthyPregnancy,
      hearAboutUs: a.hearAboutUs,
      preferredContact: a.preferredContact,
      userId: row.user_id || null,
      matchStage: null,
      dueDate: null,
      previousJourneys: 0,
      screening: { medical: 'not_started', psychological: 'not_started', background: 'not_started', homeStudy: 'not_started' },
    }
  })
}

// ── User Tasks ─────────────────────────────────────────

export async function fetchUserTasks(userId) {
  const result = await withTimeout(
    () => supabase.from('user_tasks').select('*').eq('user_id', userId).order('sort_order').order('assigned_at', { ascending: false })
  )
  if (!result) return []
  if (result.error) return []
  return result.data
}

export async function updateTaskStatus(taskId, status) {
  const updates = { status }
  if (status === 'completed') updates.completed_at = new Date().toISOString()
  const result = await withTimeout(
    () => supabase.from('user_tasks').update(updates).eq('id', taskId).select().single()
  )
  if (!result) return null
  if (result.error) throw result.error
  return result.data
}

export async function insertUserTask(task) {
  const result = await withTimeout(
    () => supabase.from('user_tasks').insert(task).select().single()
  )
  if (!result) return null
  if (result.error) throw result.error
  return result.data
}

export async function deleteUserTask(taskId) {
  const result = await withTimeout(
    () => supabase.from('user_tasks').delete().eq('id', taskId)
  )
  if (!result) return
  if (result.error) throw result.error
}

export async function fetchAllUserTasks() {
  const result = await withTimeout(
    () => supabase.from('user_tasks').select('*').order('assigned_at', { ascending: false }),
    20000
  )
  if (!result) return []
  if (result.error) return []
  return result.data
}

// ── Surrogate Profiles ──────────────────────────────────

export async function saveSurrogateProfile(userId, email, profileData) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('surrogate_profiles')
    .upsert({
      user_id: userId,
      email: email.trim().toLowerCase(),
      profile_data: profileData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchSurrogateProfile(userId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('surrogate_profiles')
    .select('profile_data, updated_at')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data
}

export async function fetchSurrogateProfileByEmail(email) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('surrogate_profiles')
    .select('profile_data, updated_at, user_id, status')
    .eq('email', email.trim().toLowerCase())
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  if (error) return null
  return data
}

export async function updateSurrogateProfileStatus(email, status) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('surrogate_profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('email', email.trim().toLowerCase())
    .select()
    .single()
  if (error) throw error
  return data
}

export async function adminUpdateSurrogateProfile(email, profileData) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('surrogate_profiles')
    .update({ profile_data: profileData, updated_at: new Date().toISOString() })
    .eq('email', email.trim().toLowerCase())
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Profile Photos (Supabase Storage) ───────────────────

const BUCKET = 'profile-photos'

export async function uploadProfilePhoto(userId, file) {
  if (!supabase) return null
  const ext = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path)
  return { path: data.path, url: urlData.publicUrl }
}

export async function deleteProfilePhoto(path) {
  if (!supabase) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

export async function listProfilePhotos(userId) {
  if (!supabase) return []
  const { data, error } = await supabase.storage.from(BUCKET).list(userId, {
    sortBy: { column: 'created_at', order: 'asc' },
  })
  if (error) return []
  return (data || [])
    .filter(f => f.id && !f.name.startsWith('.'))
    .map(f => {
      const path = `${userId}/${f.name}`
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      return { path, url: urlData.publicUrl, name: f.name }
    })
}

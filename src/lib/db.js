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

// ── App Config (shared key-value store) ──────────────────

export async function getAppConfig(key) {
  const result = await withTimeout(
    () => supabase.from('app_config').select('config_value').eq('config_key', key).single()
  )
  if (!result) return null
  if (result.error) return null
  return result.data?.config_value ?? null
}

export async function setAppConfig(key, value) {
  const result = await withTimeout(
    () => supabase.from('app_config').upsert(
      { config_key: key, config_value: value, updated_at: new Date().toISOString() },
      { onConflict: 'config_key' }
    ).select().single()
  )
  if (!result) return null
  if (result.error) return null
  return result.data
}

// ── Record Tracking (per-surrogate, stored in intake_submissions.answers) ──

export async function getRecordTracking(surrogateId) {
  const result = await withTimeout(
    () => supabase.from('intake_submissions').select('answers').eq('id', surrogateId).single()
  )
  if (!result) return null
  if (result.error) return null
  return result.data?.answers?._recordTracking ?? null
}

export async function setRecordTracking(surrogateId, tracking) {
  // First fetch current answers to merge
  const fetchResult = await withTimeout(
    () => supabase.from('intake_submissions').select('answers').eq('id', surrogateId).single()
  )
  if (!fetchResult || fetchResult.error) return null
  const currentAnswers = fetchResult.data?.answers || {}
  const updatedAnswers = { ...currentAnswers, _recordTracking: tracking }
  const result = await withTimeout(
    () => supabase.from('intake_submissions').update({ answers: updatedAnswers }).eq('id', surrogateId).select().single()
  )
  if (!result) return null
  if (result.error) return null
  return result.data
}

export async function getRecordTrackingBatch(surrogateIds) {
  if (!supabase || !surrogateIds.length) return {}
  const result = await withTimeout(
    () => supabase.from('intake_submissions').select('id, answers').in('id', surrogateIds)
  )
  if (!result || result.error || !result.data) return {}
  const map = {}
  for (const row of result.data) {
    map[row.id] = row.answers?._recordTracking || {}
  }
  return map
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
      matchNotes: a._matchNotes || '',
      userId: row.user_id || null,
      matchStage: null,
      dueDate: null,
      previousJourneys: 0,
      assignedTo: row.assigned_to || null,
      referralPartner: row.referral_partner || null,
      partnerName: a.spouseFullName || a.partnerName || '',
      partnerEmail: a.spouseEmail || '',
      screening: { medical: 'not_started', psychological: 'not_started', background: 'not_started', homeStudy: 'not_started' },
    }
  })
}

// ── Profile Photo URL lookup ─────────────────────────────

export async function getProfilePhotoUrls(userIds) {
  if (!supabase || !userIds.length) return {}
  const result = await withTimeout(
    () => supabase.from('surrogate_profiles')
      .select('user_id, profile_data')
      .in('user_id', userIds),
    15000
  )
  if (!result || result.error) return {}
  const map = {}
  for (const row of result.data) {
    const url = row.profile_data?.personal?.profilePhotoUrl
    if (url) map[row.user_id] = url
  }
  return map
}

// ── Intended Parents (from intake submissions) ─────────

export async function fetchIPsFromIntake() {
  if (!supabase) return []
  const result = await withTimeout(
    () => supabase.from('intake_submissions')
      .select('*')
      .eq('intake_type', 'ip')
      .order('submitted_at', { ascending: false }),
    20000
  )
  if (!result || result.error) return []
  return result.data.map(row => {
    const a = row.answers || {}
    const hasPartner = a.hasPartner === 'yes' || a.hasPartner === true
    const ip1Name = `${a.primaryFirstName || ''} ${a.primaryLastName || ''}`.trim()
    const ip2Name = hasPartner ? `${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim() : null
    const names = ip2Name ? `${ip1Name} & ${ip2Name}` : ip1Name
    const dob = a.primaryDob ? new Date(a.primaryDob) : null
    const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null
    return {
      id: row.id,
      names: names || 'Unknown',
      ip1Name,
      ip2Name,
      email: row.applicant_email || a.email || '',
      ip2Email: a.ip2Email || '',
      phone: a.phone || '',
      ip2Phone: a.ip2Phone || '',
      age,
      location: [a.city, a.stateProv].filter(Boolean).join(', ') || '',
      country: a.country || '',
      type: hasPartner ? 'Couple' : 'Single parent',
      status: row.status === 'approved' ? 'active' : row.status === 'qualified' ? 'new' : row.status,
      intakeStatus: row.status,
      submittedAt: row.submitted_at,
      hasRE: a.hasRE,
      reDoctorName: a.reDoctorName || '',
      hasFrozenEmbryos: a.hasFrozenEmbryos,
      frozenEmbryoDetails: a.frozenEmbryoDetails || '',
      usingEggDonor: a.usingEggDonor,
      usingSpermDonor: a.usingSpermDonor,
      wantsConsultation: a.wantsConsultation,
      hearAboutUs: a.hearAboutUs || '',
      assignedTo: row.assigned_to || null,
      matchStage: null,
      answers: a,
    }
  })
}

// ── Case Assignment ─────────────────────────────────────

export async function assignSurrogateToAdmin(submissionId, adminEmail) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('intake_submissions')
    .update({ assigned_to: adminEmail })
    .eq('id', submissionId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateIntakeSubmission(submissionId, updates) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('intake_submissions')
    .update(updates)
    .eq('id', submissionId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateReferralPartner(submissionId, partner) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('intake_submissions')
    .update({ referral_partner: partner || null })
    .eq('id', submissionId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function adminAddSurrogate(surrogateData) {
  if (!supabase) return null
  const submission = {
    intake_type: 'gc',
    status: 'qualified',
    qualified: true,
    applicant_name: `${surrogateData.firstName} ${surrogateData.lastName}`.trim(),
    applicant_email: surrogateData.email.trim().toLowerCase(),
    applicant_phone: surrogateData.phone,
    answers: {
      firstName: surrogateData.firstName,
      lastName: surrogateData.lastName,
      email: surrogateData.email,
      phone: surrogateData.phone,
      state: surrogateData.state,
      dob: surrogateData.dob,
    },
    submitted_at: new Date().toISOString(),
    assigned_to: surrogateData.assignedTo || null,
    referral_partner: surrogateData.referralPartner || null,
    state_region: surrogateData.state,
    dq_reasons: [],
  }
  const { data, error } = await supabase
    .from('intake_submissions')
    .insert(submission)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function adminAddIP(ipData) {
  if (!supabase) return null
  const hasPartner = !!(ipData.ip2FirstName && ipData.ip2FirstName.trim())
  const ip1Name = `${ipData.firstName} ${ipData.lastName}`.trim()
  const ip2Name = hasPartner ? `${ipData.ip2FirstName} ${ipData.ip2LastName}`.trim() : ''
  const submission = {
    intake_type: 'ip',
    status: 'qualified',
    qualified: true,
    applicant_name: hasPartner ? `${ip1Name} & ${ip2Name}` : ip1Name,
    applicant_email: ipData.email.trim().toLowerCase(),
    applicant_phone: ipData.phone,
    answers: {
      primaryFirstName: ipData.firstName,
      primaryLastName: ipData.lastName,
      email: ipData.email,
      phone: ipData.phone,
      country: ipData.country || 'United States',
      city: ipData.city || '',
      stateProv: ipData.state || '',
      hasPartner: hasPartner ? 'yes' : 'no',
      ...(hasPartner ? {
        ip2FirstName: ipData.ip2FirstName,
        ip2LastName: ipData.ip2LastName,
        ip2Email: ipData.ip2Email || '',
        ip2Phone: ipData.ip2Phone || '',
      } : {}),
    },
    submitted_at: new Date().toISOString(),
    assigned_to: ipData.assignedTo || null,
    state_region: ipData.state || '',
    dq_reasons: [],
  }
  const { data, error } = await supabase
    .from('intake_submissions')
    .insert(submission)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function unassignSurrogate(submissionId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('intake_submissions')
    .update({ assigned_to: null })
    .eq('id', submissionId)
    .select()
    .single()
  if (error) throw error
  return data
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

export async function fetchAllSurrogateProfiles() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('surrogate_profiles')
    .select('email, profile_data')
  if (error) return []
  return data || []
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

export async function fetchSurrogateProfilesByEmails(emails) {
  if (!supabase || !emails.length) return {}
  const { data, error } = await supabase
    .from('surrogate_profiles')
    .select('email, profile_data')
    .in('email', emails.map(e => e.trim().toLowerCase()))
  if (error || !data) return {}
  const map = {}
  for (const row of data) {
    map[row.email] = row.profile_data
  }
  return map
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
  const cleanEmail = email.trim().toLowerCase()
  // Try update first
  const { data: updated, error: updateErr } = await supabase
    .from('surrogate_profiles')
    .update({ profile_data: profileData, updated_at: new Date().toISOString() })
    .eq('email', cleanEmail)
    .select()
  // If no rows matched, insert a new row
  if (!updateErr && (!updated || updated.length === 0)) {
    const { data: inserted, error: insertErr } = await supabase
      .from('surrogate_profiles')
      .insert({ email: cleanEmail, profile_data: profileData, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (insertErr) throw insertErr
    return inserted
  }
  if (updateErr) throw updateErr
  return updated?.[0] || null
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

export async function getPortraitPhotoUrl(userId) {
  if (!supabase) return null
  const { data, error } = await supabase.storage.from(BUCKET).list(`${userId}/portrait`, {
    sortBy: { column: 'created_at', order: 'desc' },
    limit: 1,
  })
  if (error || !data || data.length === 0) return null
  const file = data.find(f => f.id && !f.name.startsWith('.'))
  if (!file) return null
  const path = `${userId}/portrait/${file.name}`
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return urlData?.publicUrl || null
}

// ── Case Documents ─────────────────────────────────────────

const DOC_BUCKET = 'case-documents'

export async function fetchCaseDocuments(surrogateId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('case_documents')
    .select('*')
    .eq('surrogate_id', surrogateId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

export async function uploadCaseDocument({ surrogateId, category, file, uploadedBy }) {
  if (!supabase) return null
  const ext = file.name.split('.').pop()
  const path = `${surrogateId}/${category}/${Date.now()}-${file.name}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(DOC_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (uploadError) throw uploadError
  const { data: urlData } = supabase.storage.from(DOC_BUCKET).getPublicUrl(uploadData.path)
  const { data, error } = await supabase
    .from('case_documents')
    .insert({
      surrogate_id: surrogateId,
      category,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path: uploadData.path,
      public_url: urlData.publicUrl,
      uploaded_by: uploadedBy,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCaseDocument(docId, updates) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('case_documents')
    .update(updates)
    .eq('id', docId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCaseDocument(docId, storagePath) {
  if (!supabase) return
  await supabase.storage.from(DOC_BUCKET).remove([storagePath])
  const { error } = await supabase.from('case_documents').delete().eq('id', docId)
  if (error) throw error
}

/** Upload a base64 PDF (e.g. from SRFax) as a case document */
export async function uploadBase64ToCaseDocuments({ surrogateId, category, fileName, base64Data, uploadedBy }) {
  if (!supabase) return null
  // Convert base64 to Blob
  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'application/pdf' })

  // Sanitize filename for storage path (remove spaces, pipes, special chars)
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${surrogateId}/${category}/${Date.now()}-${safeName}`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(DOC_BUCKET)
    .upload(path, blob, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' })
  if (uploadError) throw uploadError
  const { data: urlData } = supabase.storage.from(DOC_BUCKET).getPublicUrl(uploadData.path)
  const { data, error } = await supabase
    .from('case_documents')
    .insert({
      surrogate_id: surrogateId,
      category,
      file_name: fileName,
      file_type: 'application/pdf',
      file_size: blob.size,
      storage_path: uploadData.path,
      public_url: urlData.publicUrl,
      uploaded_by: uploadedBy,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Case Notes ─────────────────────────────────────────────

export async function fetchCaseNotes(surrogateId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('case_notes')
    .select('*')
    .eq('surrogate_id', surrogateId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

export async function insertCaseNote({ surrogateId, authorName, authorEmail, content }) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('case_notes')
    .insert({
      surrogate_id: surrogateId,
      author_name: authorName,
      author_email: authorEmail,
      content,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCaseNote(noteId, content) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('case_notes')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCaseNote(noteId) {
  if (!supabase) return
  const { error } = await supabase
    .from('case_notes')
    .delete()
    .eq('id', noteId)
  if (error) throw error
}

// ── Case Emails (logged Gmail messages) ─────────────────

export async function fetchCaseEmails(caseId) {
  const result = await withTimeout(
    () => supabase.from('case_emails').select('*').eq('case_id', caseId).order('date', { ascending: false })
  )
  if (!result) return []
  if (result.error) return []
  return result.data || []
}

export async function deleteCaseEmail(id) {
  if (!supabase) return
  const { error } = await supabase.from('case_emails').delete().eq('id', id)
  if (error) throw error
}

import { supabase } from './supabase'

// ── Profile Shares ────────────────────────────────────────

function generateToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

export async function createProfileShare({ caseId, caseType, sharedBy, sharedByEmail, sharedToEmail, sharedToName, message }) {
  if (!supabase) return null
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // 72 hours
  const { data, error } = await supabase
    .from('profile_shares')
    .insert({
      token,
      case_id: caseId,
      case_type: caseType,
      shared_by: sharedBy,
      shared_by_email: sharedByEmail,
      shared_to_email: sharedToEmail,
      shared_to_name: sharedToName,
      message: message || '',
      expires_at: expiresAt,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getProfileShare(token) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profile_shares')
    .select('*')
    .eq('token', token)
    .single()
  if (error) return null
  return data
}

export async function markShareViewed(token) {
  if (!supabase) return
  await supabase
    .from('profile_shares')
    .update({ viewed_at: new Date().toISOString() })
    .eq('token', token)
    .is('viewed_at', null)
}

export async function fetchSharesForCase(caseId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('profile_shares')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

// ── Match Questions ───────────────────────────────────────

export async function createMatchQuestion({ shareId, journeyId, caseId, caseType, askerName, askerEmail, question }) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('match_questions')
    .insert({
      share_id: shareId || null,
      journey_id: journeyId || null,
      case_id: caseId || null,
      case_type: caseType || null,
      asker_name: askerName,
      asker_email: askerEmail,
      question,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function answerMatchQuestion(id, answer, answeredBy) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('match_questions')
    .update({ answer, answered_by: answeredBy, answered_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchMatchQuestions({ shareId, journeyId, caseId }) {
  if (!supabase) return []
  let query = supabase.from('match_questions').select('*').order('created_at', { ascending: false })
  if (shareId) query = query.eq('share_id', shareId)
  if (journeyId) query = query.eq('journey_id', journeyId)
  if (caseId) query = query.eq('case_id', caseId)
  const { data, error } = await query
  if (error) return []
  return data || []
}

// ── Matched Journeys ──────────────────────────────────────

export async function createMatchedJourney({ gcCaseId, ipCaseId, assignedTo, createdBy }) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('matched_journeys')
    .insert({
      gc_case_id: gcCaseId,
      ip_case_id: ipCaseId,
      assigned_to: assignedTo || null,
      created_by: createdBy || '',
      journey_data: { lostWages: '', pumping: '', escrowMin: '', escrowBalance: '' },
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchMatchedJourneys() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('matched_journeys')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

export async function fetchMatchedJourney(id) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('matched_journeys')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function updateMatchedJourney(id, updates) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('matched_journeys')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function breakMatch(journeyId, { reason, brokenBy, gcCaseId, ipCaseId }) {
  if (!supabase) return null

  // 1. Get all journey notes to copy to both cases
  const { data: notes } = await supabase
    .from('journey_notes')
    .select('*')
    .eq('journey_id', journeyId)

  // 2. Store break record in both GC and IP intake_submissions answers
  for (const caseId of [gcCaseId, ipCaseId]) {
    const { data: row } = await supabase.from('intake_submissions').select('answers').eq('id', caseId).single()
    if (row?.answers) {
      const history = row.answers._matchHistory || []
      history.push({
        journeyId,
        partnerId: caseId === gcCaseId ? ipCaseId : gcCaseId,
        partnerType: caseId === gcCaseId ? 'ip' : 'gc',
        status: 'broken',
        reason,
        brokenBy,
        brokenAt: new Date().toISOString(),
        notes: (notes || []).map(n => ({ content: n.content, type: n.note_type, by: n.created_by, at: n.created_at })),
      })
      await supabase.from('intake_submissions').update({ answers: { ...row.answers, _matchHistory: history } }).eq('id', caseId)
    }
  }

  // 3. Delete journey notes
  await supabase.from('journey_notes').delete().eq('journey_id', journeyId)

  // 4. Delete the matched journey record
  await supabase.from('matched_journeys').delete().eq('id', journeyId)

  return true
}

// ── Journey Notes ─────────────────────────────────────────

export async function fetchJourneyNotes(journeyId, noteType) {
  if (!supabase) return []
  let query = supabase.from('journey_notes').select('*').eq('journey_id', journeyId).order('created_at', { ascending: false })
  if (noteType && noteType !== 'all') query = query.eq('note_type', noteType)
  const { data, error } = await query
  if (error) return []
  return data || []
}

export async function createJourneyNote({ journeyId, noteType, content, createdBy, createdByEmail }) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('journey_notes')
    .insert({
      journey_id: journeyId,
      note_type: noteType || 'shared',
      content,
      created_by: createdBy,
      created_by_email: createdByEmail,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateJourneyNote(id, content) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('journey_notes')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteJourneyNote(id) {
  if (!supabase) return
  await supabase.from('journey_notes').delete().eq('id', id)
}

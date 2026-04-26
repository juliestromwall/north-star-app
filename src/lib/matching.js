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

export function isActiveMatchedJourney(journey) {
  const status = String(journey?.status || '').toLowerCase()
  const stage = String(journey?.stage || '').toLowerCase()
  const state = `${status} ${stage}`
  return !/(broken|cancelled|canceled|failed|terminated|dissolved)/.test(state)
}

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
  // Promote any pre-match expenses logged on the surrogate's case into this new journey
  if (data?.id && gcCaseId) {
    try {
      const { attachSurrogateExpensesToJourney } = await import('./db')
      await attachSurrogateExpensesToJourney(gcCaseId, data.id)
    } catch (err) { console.error('Failed to attach pre-match expenses:', err) }
  }
  return data
}

export async function findJourneyByCaseId(caseId) {
  if (!supabase) return null
  // Check if this case is a GC or IP in any active journey
  const { data: gcMatches } = await supabase.from('matched_journeys').select('id,status,stage').eq('gc_case_id', caseId).order('created_at', { ascending: false })
  const gcMatch = (gcMatches || []).find(isActiveMatchedJourney)
  if (gcMatch) return gcMatch.id
  const { data: ipMatches } = await supabase.from('matched_journeys').select('id,status,stage').eq('ip_case_id', caseId).order('created_at', { ascending: false })
  const ipMatch = (ipMatches || []).find(isActiveMatchedJourney)
  if (ipMatch) return ipMatch.id
  return null
}

export async function fetchMatchedJourneys() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('matched_journeys')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return []
  return (data || []).filter(isActiveMatchedJourney)
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

// True if a journey is still active (i.e. not archived). Archived journeys keep all their data
// but their participants reappear in the case/matching lists so they can start a new journey.
export function isJourneyActive(j) {
  return !j?.journey_data?._archivedAt
}

// Archive a journey — preserve all data but release the GC and IP back into their respective lists.
// Stamps _archivedAt on the journey, logs a _matchHistory entry on both intake rows (so the
// existing "Previous Match" UI kicks in), and drops a case note on both sides.
export async function archiveJourney(journeyId, { reason, archivedBy, gcCaseId, ipCaseId, gcName, ipName }) {
  if (!supabase) return null

  const { data: journey } = await supabase.from('matched_journeys').select('*').eq('id', journeyId).single()
  if (!journey) return null
  const journeyData = journey.journey_data || {}
  const archivedAt = new Date().toISOString()

  // 1. Stamp archive metadata on the journey — keep all existing journey_data
  const updatedJourneyData = {
    ...journeyData,
    _archivedAt: archivedAt,
    _archivedBy: archivedBy || null,
    _archiveReason: reason || null,
  }
  await supabase.from('matched_journeys')
    .update({ journey_data: updatedJourneyData })
    .eq('id', journeyId)

  // 2. Append a completed-match entry to _matchHistory on both intake rows
  for (const caseId of [gcCaseId, ipCaseId]) {
    if (!caseId) continue
    const { data: row } = await supabase.from('intake_submissions').select('answers').eq('id', caseId).single()
    if (!row?.answers) continue
    const isGc = caseId === gcCaseId
    const history = Array.isArray(row.answers._matchHistory) ? row.answers._matchHistory : []
    history.push({
      journeyId,
      partnerId: isGc ? ipCaseId : gcCaseId,
      partnerName: isGc ? (ipName || 'Unknown IP') : (gcName || 'Unknown GC'),
      partnerType: isGc ? 'ip' : 'gc',
      status: 'completed',
      reason: reason || null,
      archivedBy: archivedBy || null,
      archivedAt,
      matchCreated: journey.created_at,
      assignedTo: journey.assigned_to,
      stage: journey.stage,
      journeyData: {
        escrowMin: journeyData.escrowMin, escrowBalance: journeyData.escrowBalance,
        ivfClinic: journeyData.ivfClinic, ivfDoctor: journeyData.ivfDoctor,
        obClinic: journeyData.obClinic, obDoctor: journeyData.obDoctor,
        deliveryHospital: journeyData.deliveryHospital,
        gcAttorneyName: journeyData.gcAttorneyName, ipAttorneyName: journeyData.ipAttorneyName,
        delivered: journeyData.delivered, deliveryDate: journeyData.deliveryDate,
        babyNames: journeyData.babyNames, babySexes: journeyData.babySexes,
      },
    })
    await supabase.from('intake_submissions')
      .update({ answers: { ...row.answers, _matchHistory: history } })
      .eq('id', caseId)
  }

  // 3. Drop a case note on both sides for visibility
  const noteContent = `Journey archived${reason ? ` — reason: ${reason}` : ''}. Both parties are now available for new matches.`
  for (const caseId of [gcCaseId, ipCaseId]) {
    if (!caseId) continue
    try {
      await supabase.from('case_notes').insert({
        surrogate_id: caseId,
        author_name: archivedBy || 'Admin',
        content: noteContent,
      })
    } catch (err) {
      console.warn('Failed to add archive case note:', err)
    }
  }

  return true
}

// Reverse of archiveJourney — used when a journey was archived by mistake.
// Strips the archive metadata off matched_journeys.journey_data, removes the
// matching entry from each side's _matchHistory, and drops an "unarchived"
// case note for audit. Stage/status on the journey are left alone.
export async function unarchiveJourney(journeyId, { unarchivedBy, gcCaseId, ipCaseId } = {}) {
  if (!supabase) return null

  const { data: journey } = await supabase.from('matched_journeys').select('*').eq('id', journeyId).single()
  if (!journey) return null
  const journeyData = journey.journey_data || {}

  // 1. Clear archive keys from journey_data
  const cleaned = { ...journeyData }
  delete cleaned._archivedAt
  delete cleaned._archivedBy
  delete cleaned._archiveReason
  await supabase.from('matched_journeys')
    .update({ journey_data: cleaned })
    .eq('id', journeyId)

  // 2. Remove the journeyId entry from _matchHistory on both sides
  const gcId = gcCaseId || journey.gc_case_id
  const ipId = ipCaseId || journey.ip_case_id
  for (const caseId of [gcId, ipId]) {
    if (!caseId) continue
    const { data: row } = await supabase.from('intake_submissions').select('answers').eq('id', caseId).single()
    if (!row?.answers) continue
    const history = Array.isArray(row.answers._matchHistory) ? row.answers._matchHistory : []
    const filtered = history.filter(e => Number(e.journeyId) !== Number(journeyId))
    if (filtered.length === history.length) continue
    await supabase.from('intake_submissions')
      .update({ answers: { ...row.answers, _matchHistory: filtered } })
      .eq('id', caseId)
  }

  // 3. Case note for audit trail
  const noteContent = `Journey unarchived${unarchivedBy ? ` by ${unarchivedBy}` : ''}.`
  for (const caseId of [gcId, ipId]) {
    if (!caseId) continue
    try {
      await supabase.from('case_notes').insert({
        surrogate_id: caseId,
        author_name: unarchivedBy || 'Admin',
        content: noteContent,
      })
    } catch (err) {
      console.warn('Failed to add unarchive case note:', err)
    }
  }

  return true
}

// Start a new surrogate case that inherits the application + profile from an existing case.
// Use this after delivery when the existing journey must stay open (e.g. escrow still in progress),
// but we want the surrogate back in the case list so she can begin a new round of profile work
// and the team can run a fresh checklist.
// - Creates a new intake_submissions row with the old row's answers copied, flagged with
//   _continuedFromCaseId/_continuedFromJourneyId for traceability.
// - The shared surrogate_profiles row (keyed by email) is automatically visible on the new case.
// - Stamps _newCaseStartedId/_newCaseStartedAt/_newCaseStartedBy on the old journey so the
//   admin can see the linkage from either side.
export async function startNewCaseFromJourney({ fromCaseId, journeyId, createdBy }) {
  if (!supabase) return null
  const { data: authData } = await supabase.auth.getSession()
  const token = authData?.session?.access_token
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await fetch('/api/start-new-case', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fromCaseId,
      journeyId,
      createdBy,
    }),
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Failed to start new case')
  }
  return payload.data || null
}

export async function breakMatch(journeyId, { reason, brokenBy, gcCaseId, ipCaseId, gcName, ipName }) {
  if (!supabase) return null

  // 1. Get journey data
  const { data: journey } = await supabase.from('matched_journeys').select('*').eq('id', journeyId).single()
  const journeyData = journey?.journey_data || {}

  // 2. Get all journey notes
  const { data: notes } = await supabase
    .from('journey_notes')
    .select('*')
    .eq('journey_id', journeyId)

  // 3. Get documents from both GC and IP cases
  const { data: gcDocs } = await supabase.from('case_documents').select('*').eq('surrogate_id', gcCaseId)
  const { data: ipDocs } = await supabase.from('case_documents').select('*').eq('surrogate_id', ipCaseId)
  const allJourneyDocs = [...(gcDocs || []), ...(ipDocs || [])]
  const existingDocKeysByCase = new Map()
  for (const caseId of [gcCaseId, ipCaseId]) {
    const docs = allJourneyDocs.filter(d => d.surrogate_id === caseId)
    existingDocKeysByCase.set(caseId, new Set(docs.map(d => `${d.storage_path || ''}|${d.file_name || ''}`)))
  }

  // 4. Store break record in both GC and IP intake_submissions answers
  for (const caseId of [gcCaseId, ipCaseId]) {
    const { data: row } = await supabase.from('intake_submissions').select('answers').eq('id', caseId).single()
    if (row?.answers) {
      const isGc = caseId === gcCaseId
      const history = row.answers._matchHistory || []
      history.push({
        journeyId,
        partnerId: isGc ? ipCaseId : gcCaseId,
        partnerName: isGc ? (ipName || 'Unknown IP') : (gcName || 'Unknown GC'),
        partnerType: isGc ? 'ip' : 'gc',
        status: 'broken',
        reason,
        brokenBy,
        brokenAt: new Date().toISOString(),
        matchCreated: journey?.created_at,
        assignedTo: journey?.assigned_to,
        stage: journey?.stage,
        journeyData: {
          escrowMin: journeyData.escrowMin, escrowBalance: journeyData.escrowBalance,
          ivfClinic: journeyData.ivfClinic, ivfDoctor: journeyData.ivfDoctor,
          obClinic: journeyData.obClinic, obDoctor: journeyData.obDoctor,
          deliveryHospital: journeyData.deliveryHospital,
          gcAttorneyName: journeyData.gcAttorneyName, gcAttorneyFirm: journeyData.gcAttorneyFirm,
          ipAttorneyName: journeyData.ipAttorneyName, ipAttorneyFirm: journeyData.ipAttorneyFirm,
          lostWages: journeyData.lostWages, pumping: journeyData.pumping,
        },
        checklistHistory: journeyData._checklistHistory || [],
        notes: (notes || []).map(n => ({ content: n.content, type: n.note_type, by: n.created_by, at: n.created_at })),
      })
      await supabase.from('intake_submissions').update({ answers: { ...row.answers, _matchHistory: history } }).eq('id', caseId)
    }

    // Copy documents uploaded during this journey from the other party into this case.
    // This preserves a Previous Journey copy after the match is broken.
    const matchCreated = journey?.created_at || '1970-01-01'
    const otherCaseId = caseId === gcCaseId ? ipCaseId : gcCaseId
    const existingDocKeys = existingDocKeysByCase.get(caseId) || new Set()
    const journeyDocsFromOther = allJourneyDocs.filter(d =>
      d.surrogate_id === otherCaseId &&
      d.created_at >= matchCreated &&
      d.doc_label !== 'previous-journey' &&
      !String(d.uploaded_by || '').startsWith('Previous Match')
    )
    for (const doc of journeyDocsFromOther) {
      try {
        const docKey = `${doc.storage_path || ''}|${doc.file_name || ''}`
        if (existingDocKeys.has(docKey)) continue
        await supabase.from('case_documents').insert({
          surrogate_id: caseId,
          category: doc.category,
          file_name: doc.file_name,
          file_type: doc.file_type,
          file_size: doc.file_size,
          storage_path: doc.storage_path,
          public_url: doc.public_url,
          doc_label: 'previous-journey',
          uploaded_by: `Previous Match (${brokenBy})`,
        })
        existingDocKeys.add(docKey)
      } catch (err) {
        console.warn('Failed to copy previous journey document:', err)
      }
    }

    // Also tag this case's own docs uploaded during the journey as Previous Journey.
    const ownJourneyDocs = allJourneyDocs.filter(d =>
      d.surrogate_id === caseId &&
      d.created_at >= matchCreated &&
      d.doc_label !== 'previous-journey' &&
      !String(d.uploaded_by || '').startsWith('Previous Match')
    )
    for (const doc of ownJourneyDocs) {
      try {
        await supabase.from('case_documents').update({
          doc_label: 'previous-journey',
          uploaded_by: `Previous Match (${brokenBy})`,
        }).eq('id', doc.id)
      } catch (err) {
        console.warn('Failed to tag previous journey document:', err)
      }
    }
  }

  // 5. Delete journey notes
  await supabase.from('journey_notes').delete().eq('journey_id', journeyId)

  // 6. Delete the matched journey record
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

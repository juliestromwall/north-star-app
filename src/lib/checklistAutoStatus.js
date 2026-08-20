// ── Automatic checklist step statuses ──────────────────────
// Some Intake checklist steps track work the applicant does in the portal
// rather than work an admin does, so they should keep themselves current:
//
//   started filling it out  → 'in_progress'  (pill reads "In Progress")
//   submitted it            → 'complete'     (pill reads "Submitted")
//
// The submitted state stores the lifecycle value 'complete' with an
// `_optionLabel` of "Submitted" — that's the same mechanism dropdown steps
// use to show a friendlier label than the raw status id. It matters because
// JourneyChecklistView only counts 'complete' / 'na' / 'skipped' toward the
// progress bar, and a submitted application is done as far as the applicant
// is concerned.
//
// Step ids are resolved by label, not hardcoded, because these steps are
// admin-editable in the checklist builder and their generated ids differ
// between environments. Fallback ids match the seeds in checklistStore.

import { supabase } from './supabase'
import { getAllChecklistSteps } from './checklistStore'

export const AUTO_STEPS = {
  profile: {
    // "Profile Complete" as configured today, then a looser both-words match
    // so a rename to e.g. "Complete Profile" still resolves. Deliberately not
    // a bare 'profile' match — that would grab "Profile Photos".
    match: [
      l => l.includes('profile complete'),
      l => l.includes('profile') && l.includes('complete'),
    ],
    fallbackId: 'profile_complete',
  },
  application: {
    match: [
      l => l.includes('application complete'),
      l => l.includes('application') && l.includes('complete'),
    ],
    fallbackId: 'app_complete',
  },
}

// Statuses that already represent "further along" than in_progress — never
// walk a step backwards from one of these when the applicant edits again.
const AT_OR_PAST_IN_PROGRESS = new Set([
  'in_progress', 'reviewing', 'submitted', 'complete', 'na', 'skipped',
])

/**
 * Find the configured step id for one of the AUTO_STEPS keys.
 * Matches on label across every stage of the user type (the step lives under
 * Intake today, but admins can move it). Returns the fallback id if the
 * checklist config hasn't loaded or has no matching step.
 */
export function resolveAutoStepId(which, userType = 'gc') {
  const spec = AUTO_STEPS[which]
  if (!spec) return null
  try {
    const steps = getAllChecklistSteps(userType)
    for (const matches of spec.match) {
      const hit = steps.find(s => matches(String(s.label || '').toLowerCase()))
      if (hit?.id) return hit.id
    }
  } catch {}
  return spec.fallbackId
}

/**
 * Build the updated `_recordTracking` blob for a step status change.
 * Pure — callers own the read and the write, so this works both for the
 * client (supabase-js) and for functions/api (REST + service role).
 *
 * Returns null when no write is needed (status already applied, or a
 * downgrade that should be ignored).
 */
export function buildTrackingUpdate(existingTracking, stepId, { status, optionLabel, note, by = 'System', date, noDowngrade }) {
  const tracking = existingTracking || {}
  const entry = tracking[stepId] || { history: [] }
  const current = entry.status || 'not_started'
  if (current === status && entry._optionLabel === optionLabel) return null
  if (noDowngrade && AT_OR_PAST_IN_PROGRESS.has(current)) return null
  const today = date || new Date().toISOString().split('T')[0]
  // `optionLabel` on the log row too — JourneyChecklistView's read path maps
  // it onto the timeline entry, so the history line reads "Submitted" rather
  // than the raw lifecycle label.
  const logEntry = { status, optionLabel, date: today, note, by }
  return {
    ...tracking,
    [stepId]: {
      ...entry,
      status,
      _optionLabel: optionLabel,
      history: [...(entry.history || []), logEntry],
    },
  }
}

/**
 * Read → merge → write a step status onto a case's `_recordTracking`.
 * Fails silently: this is bookkeeping that runs alongside the applicant's
 * real save, and it must never block or break that save.
 *
 * @param {string|number} caseId  intake_submissions.id
 * @param {object} opts  passed through to buildTrackingUpdate
 * @returns {Promise<boolean>} true if a write happened
 */
export async function logAutoStepStatus(caseId, stepId, opts) {
  if (!caseId || !stepId || !supabase) return false
  try {
    const { data: fresh, error: readErr } = await supabase
      .from('intake_submissions').select('answers').eq('id', caseId).single()
    if (readErr) return false
    const currentAnswers = fresh?.answers || {}
    const updatedTracking = buildTrackingUpdate(currentAnswers._recordTracking, stepId, opts)
    if (!updatedTracking) return false
    const { error: writeErr } = await supabase
      .from('intake_submissions')
      .update({ answers: { ...currentAnswers, _recordTracking: updatedTracking } })
      .eq('id', caseId)
    return !writeErr
  } catch {
    return false
  }
}

/** Mark an auto step as started by the applicant (never downgrades). */
export function markAutoStepStarted(caseId, which, { userType = 'gc', note } = {}) {
  const stepId = resolveAutoStepId(which, userType)
  return logAutoStepStatus(caseId, stepId, {
    status: 'in_progress',
    optionLabel: 'In Progress',
    note: note || 'Started by Applicant',
    noDowngrade: true,
  })
}

/** Mark an auto step as submitted by the applicant (reads as complete). */
export function markAutoStepSubmitted(caseId, which, { userType = 'gc', note } = {}) {
  const stepId = resolveAutoStepId(which, userType)
  return logAutoStepStatus(caseId, stepId, {
    status: 'complete',
    optionLabel: 'Submitted',
    note: note || 'Submitted by Applicant',
  })
}

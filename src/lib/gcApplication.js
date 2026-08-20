// GC Application wiring for the surrogate portal.
//
// The application itself lives in src/data/formTemplates/applicationGc.js —
// this module adapts it to the portal: which sections render generically,
// what gets pre-filled from the surrogate's profile and intake quiz, and how
// answers saved under the previous (ABC) section keys carry forward.

import applicationGc from '@/data/formTemplates/applicationGc'
import { sectionFields } from '@/components/portal/TemplateSectionForm'

// Sections rendered by TemplateSectionForm. `_clinicHospital` is excluded —
// the template marks it `customComponent: 'ClinicHospitalForm'` because it
// collects repeating per-pregnancy provider rows, which the portal already
// has a purpose-built form for.
export const GC_TEMPLATE_SECTIONS = applicationGc.sections.filter(s => !s.customComponent)

// Profile containers searched, in order, when resolving a bare field name.
// `narrative` holds the long-form profile answers; the rest are the
// structured profile sections.
const PROFILE_CONTAINERS = ['narrative', 'personal', 'health', 'fertility', 'general', 'employment', 'academic']

/** Resolve a dot-path (e.g. 'narrative.whyConsider') against profile data. */
function resolvePath(source, path) {
  if (!source || !path) return undefined
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), source)
}

/** Find a bare field name in whichever profile container holds it. */
function findProfileValue(profileData, key) {
  if (!profileData || !key) return undefined
  if (profileData[key] !== undefined && typeof profileData[key] !== 'object') return profileData[key]
  for (const container of PROFILE_CONTAINERS) {
    const v = profileData[container]?.[key]
    if (v !== undefined && v !== '') return v
  }
  return undefined
}

// Template field key → profile field name, for questions the profile already
// asks under a different name. Anything the template declares `prefillFrom`
// for is handled by that path and doesn't need an entry here.
const PROFILE_FIELD_MAP = {
  preferredName: 'firstName',
  maritalStatus: 'maritalStatus',
  spouseName: 'partnerName',
  spouseDob: 'partnerDob',
  partnerDuration: 'relationshipLength',
  weight: 'weight',
  occupation: 'occupation',
  employer: 'employer',
  educationLevel: 'educationLevel',
  regularMenstrualCycles: 'cycleLength',
  regularMenstrualCycles_details: 'cycleLengthDetails',
  abnormalPap: 'gynecologicalProblems',
  abnormalPap_details: 'gynecologicalProblemsDetails',
}

// Template field key → intake quiz answer. The quiz is the earliest thing the
// applicant fills in, so it seeds identity and contact details.
function quizPrefills(quiz) {
  if (!quiz) return {}
  const fullName = [quiz.firstName, quiz.lastName].filter(Boolean).join(' ')
  const heightFt = quiz.heightFt
  const heightIn = quiz.heightIn
  return {
    fullLegalName: fullName,
    preferredName: quiz.firstName || '',
    dob: quiz.dob || '',
    street: quiz.street || '',
    city: quiz.city || '',
    state: quiz.state || '',
    zipCode: quiz.zip || '',
    phone: quiz.phone || '',
    email: quiz.email || '',
    usCitizen: quiz.usCitizen === true ? 'yes' : quiz.usCitizen === false ? 'no' : '',
    howHeardAboutAgency: quiz.hearAbout || '',
    height: heightFt || heightIn ? `${heightFt || ''}'${heightIn || ''}"` : '',
    weight: quiz.weightLbs || '',
    totalPregnancies: quiz.numPregnancies ?? '',
    cSectionEver: quiz.numCsections === '' || quiz.numCsections == null
      ? ''
      : (Number(quiz.numCsections) > 0 ? 'yes' : 'no'),
    cSectionCount: quiz.numCsections ?? '',
    previouslySurrogate: quiz.previousSurrogate === true ? 'yes' : quiz.previousSurrogate === false ? 'no' : '',
    medications: quiz.takesPrescriptions === true ? 'yes' : quiz.takesPrescriptions === false ? 'no' : '',
    medications_details: quiz.prescriptionList || '',
    governmentAssistance: quiz.publicAssistance === true ? 'yes' : quiz.publicAssistance === false ? 'no' : '',
    pregnanciesHealthy: quiz.allHealthy === true ? 'yes' : quiz.allHealthy === false ? 'no' : '',
  }
}

/**
 * Build the { fieldKey: value } prefill map for one section.
 * Priority per field: template prefillFrom → profile field map → quiz.
 * The applicant's own saved answer always wins over all of these — that's
 * enforced in TemplateSectionForm, not here.
 */
export function buildSectionPrefills(section, { profileData, quizData } = {}) {
  const quiz = quizPrefills(quizData)
  const out = {}
  for (const field of sectionFields(section)) {
    let v
    if (field.prefillFrom) v = resolvePath(profileData, field.prefillFrom)
    if ((v === undefined || v === '') && PROFILE_FIELD_MAP[field.key]) {
      v = findProfileValue(profileData, PROFILE_FIELD_MAP[field.key])
    }
    if (v === undefined || v === '') v = quiz[field.key]
    if (v === undefined || v === null || v === '') continue
    // Profile yes/no answers are stored as booleans in places; normalize so
    // the yes/no pills light up.
    if (field.type === 'yesno' && typeof v === 'boolean') v = v ? 'yes' : 'no'
    out[field.key] = v
  }
  return out
}

// ── Legacy answer migration ────────────────────────────────
// Applications started before the template rollout stored answers under the
// old ABC section keys. Map the fields that survived onto their new homes so
// an in-flight applicant doesn't lose work. Old data is never deleted — it
// stays in `answers` for the admin view and as an audit trail.
const LEGACY_MAP = {
  _application: {
    _personalInfo: {
      fullLegalName: 'fullLegalName',
      dob: 'dob',
      street: 'street',
      city: 'city',
      state: 'state',
      zipCode: 'zipCode',
      phone: 'phone',
      email: 'email',
      spouseFullName: 'spouseName',
      spouseDob: 'spouseDob',
    },
    _healthHistory: {},
  },
  _confidential: {
    _personalInfo: {
      fullLegalName: 'fullLegalName',
      dob: 'dob',
      spouseFullName: 'spouseName',
    },
  },
  _profileFollowUp: {
    _pregnancyHistory: {
      cycleLength: 'regularMenstrualCycles',
      cycleLengthDetails: 'regularMenstrualCycles_details',
    },
  },
}

/**
 * Fold legacy answers into the new section keys.
 * Returns a new answers object, or null when there was nothing to migrate.
 * Never overwrites an answer the applicant has already given in the new form.
 */
export function migrateLegacyAnswers(answers) {
  if (!answers) return null
  let changed = false
  const next = { ...answers }
  for (const [oldKey, targets] of Object.entries(LEGACY_MAP)) {
    const old = answers[oldKey]
    if (!old || typeof old !== 'object') continue
    for (const [newKey, fieldMap] of Object.entries(targets)) {
      const dest = { ...(next[newKey] || {}) }
      let sectionChanged = false
      for (const [oldField, newField] of Object.entries(fieldMap)) {
        const v = old[oldField]
        if (v === undefined || v === null || v === '') continue
        if (dest[newField] !== undefined && dest[newField] !== '') continue
        dest[newField] = v
        sectionChanged = true
      }
      if (sectionChanged) { next[newKey] = dest; changed = true }
    }
  }
  return changed ? next : null
}

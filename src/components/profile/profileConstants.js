import {
  User, Home, Baby, Stethoscope, HeartPulse, Apple, Briefcase,
  Heart, Camera
} from 'lucide-react'

// ─────────────────────────────────────────────────────────
// Section definitions (extracted from SurrogateProfilePage)
// ─────────────────────────────────────────────────────────

const SECTION_META = [
  { key: 'personal', title: 'Personal Information', icon: User, description: 'Basic info, relationships, and household' },
  { key: 'pregnancyHistory', title: 'Pregnancy History', icon: Baby, description: 'Previous pregnancies and deliveries' },
  { key: 'fertility', title: 'Fertility Information', icon: Stethoscope, description: 'Reproductive health and fertility details' },
  { key: 'general', title: 'General Information', icon: Home, description: 'Housing, lifestyle, habits, and background' },
  { key: 'health', title: 'Health Information', icon: HeartPulse, description: 'Medical history, medications, and conditions' },
  { key: 'employment', title: 'Employment Information', icon: Briefcase, description: 'Work, income, and insurance details' },
  { key: 'interests', title: 'Interests', icon: Heart, description: 'Favorites, hobbies, and personality' },
  { key: 'academic', title: 'Academic Information', icon: Apple, description: 'Education and training' },
  { key: 'experiencedSurrogate', title: 'Experienced Surrogate Information', icon: Stethoscope, description: 'Previous surrogacy journey details' },
  { key: 'hopesWishes', title: 'Journey Hopes & Wishes', icon: Heart, description: 'Your surrogacy goals, preferences, and compensation' },
  { key: 'photos', title: 'Photos', icon: Camera, description: 'Share photos for your matching profile' },
]

// Required fields per section for completion tracking
const REQUIRED_FIELDS = {
  personal: ['firstName', 'city', 'state', 'heightFt', 'weight', 'maritalStatus'],
  pregnancyHistory: ['numberOfPregnancies'],
  fertility: ['sameBioFather', 'contraceptiveMethod', 'cycleLength'],
  general: ['smokeVape', 'alcoholDrugs', 'typicalDiet', 'exerciseFrequency', 'sleepHours', 'reliableVehicle'],
  health: ['mentalHealthDiagnosis', 'openToVaccinations'],
  employment: ['currentlyEmployed', 'healthInsurance'],
  interests: ['personality'],
  academic: ['educationLevel'],
  experiencedSurrogate: [],
  hopesWishes: ['reasonForSurrogacy', 'whenReadyToBegin', 'desiredCompensation'],
  photos: [],
}

function isPregnancyComplete(p) {
  if (!p.outcome || !p.dob || !p.gestationWeeks || !p.deliveryType) return false
  if (p.outcome === 'Live Birth' && !p.weight) return false
  return true
}

function countCompleted(data, sectionKey) {
  const fields = REQUIRED_FIELDS[sectionKey] || []
  if (fields.length === 0) return { filled: 0, total: 0, complete: false }
  let filled = 0
  for (const f of fields) {
    const val = data?.[sectionKey]?.[f]
    if (val !== undefined && val !== '' && val !== null) filled++
  }
  // Special: pregnancy section requires all pregnancy details filled
  if (sectionKey === 'pregnancyHistory') {
    const numPreg = parseInt(data?.pregnancyHistory?.numberOfPregnancies) || 0
    const pregnancies = data?.pregnancyHistory?.pregnancies || []
    if (numPreg < 1) return { filled: 0, total: 1, complete: false }
    const completedPregs = pregnancies.filter(p => isPregnancyComplete(p)).length
    const allPregsComplete = completedPregs >= numPreg
    return { filled: allPregsComplete ? numPreg + 1 : completedPregs, total: numPreg + 1, complete: allPregsComplete }
  }
  return { filled, total: fields.length, complete: filled === fields.length }
}

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming'
]

export {
  SECTION_META,
  REQUIRED_FIELDS,
  isPregnancyComplete,
  countCompleted,
  US_STATES,
}

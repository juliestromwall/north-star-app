import {
  User, Home, Baby, Stethoscope, HeartPulse, Apple, Briefcase,
  Heart, Camera, MessageCircle, Sparkles, Shield, Users, CalendarDays, Mail, Star
} from 'lucide-react'
import { GC_PROFILE_SECTIONS } from '@/data/profileNarrative'

const NARRATIVE_ICON_MAP = { Heart, Star, Baby, MessageCircle, Sparkles, Shield, Users, CalendarDays, Mail }

// ─────────────────────────────────────────────────────────
// Shared field labels — single source of truth for portal, admin, and preview
// ─────────────────────────────────────────────────────────
export const FIELD_LABELS = {
  // Personal
  firstName: 'First name (or nickname)', dob: 'Date of Birth', city: 'City', state: 'State',
  heightFt: 'Height (ft)', heightIn: 'Height (in)', weight: 'Weight (lbs)',
  maritalStatus: 'Current Marital/Relationship Status',
  monogamous: 'Are you currently in a monogamous relationship?',
  sexualPartners: 'How many sexual partners have you had in the past 6 months?',
  relationshipLength: 'How long have you been together?',
  partnerName: 'First name of your spouse or partner',
  partnerDob: "Spouse/Partner's Date of Birth",
  partnerUsCitizen: 'Is your Spouse/Partner a U.S. Citizen or Permanent Resident?',
  bmi: 'BMI',
  profilePhotoUrl: 'Profile Photo URL',
  householdMembers: 'Household Members',

  // Pregnancy History
  numberOfPregnancies: 'Total number of pregnancies',

  // Fertility
  sameBioFather: 'Is the biological father the same for all of your biological children?',
  sameBioFatherDetails: 'Please explain',
  infertilityTreatment: 'Have you ever been seen by a doctor for infertility treatment?',
  infertilityTreatmentDetails: 'Please provide details',
  gynecologicalProblems: 'Have you ever been diagnosed with any gynecological issues (such as endometriosis, ovarian cysts, fibroids, abnormal pap smears, etc.)?',
  gynecologicalProblemsDetails: 'Please provide details',
  breastfeeding: 'Are you currently breastfeeding?',
  breastfeedingStopDate: 'When do you expect to stop?',
  breastfeedingAdminNotes: 'Breastfeeding details',
  cycleLength: 'Are your cycles typically between 28 to 30 days?',
  cycleLengthDetails: 'What is your typical cycle length?',
  pregnancyMedication: 'Did you ever take medication (aside from prenatals) during pregnancy?',
  pregnancyMedicationList: 'Please list medications',
  willingToTravelNICU: 'Are you ok traveling to a hospital with at least a Level II NICU?',
  contraceptiveMethod: 'Which contraceptive method do you currently use?',
  lastPeriod: 'When was the start of your last period?',
  nearestNICU: 'What is the nearest hospital with a Level II or III NICU?',
  timeToConceive: 'How long after stopping contraceptives did it take to get pregnant?',
  pregnancyDetails: 'We want to hear all the details about your pregnancy(s). Be sure to describe in detail about any complications you experienced. Please share the ups and downs.',

  // General / Lifestyle
  homeOwnership: 'Do you own or rent your home?',
  homeDuration: 'How long have you lived in your current home?',
  childrenFullTime: 'Do your children live with you full time?',
  childrenSpecialNeeds: 'Do any of your children have special needs or medical conditions?',
  placedForAdoption: 'Have you ever placed a child for adoption?',
  planMoreChildren: 'Do you plan to have any more children of your own?',
  smokeVape: 'Do you currently smoke or vape?',
  smokingHistory: 'Do you have a history of smoking in the past?',
  householdSmoker: 'Does anyone else in your household currently smoke or vape?',
  alcoholDrugs: 'Do you drink alcohol or use recreational drugs?',
  advisedLimitSubstances: 'Have you ever been advised to limit your use of alcohol or any drugs?',
  householdControlledSubstances: 'Does anyone in your household drink alcohol, use controlled substances or recreational drugs?',
  gunsOwned: 'Do you own any guns?',
  gunsInHome: 'Are there any guns in your home?',
  gunsInHomeAdminNotes: 'Gun storage / details',
  religiousBackground: 'What is your religious background or faith tradition, if any?',
  comfortableDifferentReligion: 'Are you comfortable supporting Intended Parents regardless of their religious beliefs or background?',
  piercingsTattoos: 'Do you have any piercings or tattoos?',
  lastTattooDate: 'When did you have your last tattoo?',
  nonSterilePiercing: 'Have you been tattooed or had a non-sterile skin piercing in the last 12 months?',
  eatingDisorders: 'Do you have a history of eating disorders?',
  typicalDiet: 'Please describe your typical diet and eating habits. Do you cook at home? How often do you eat out? Do you have any special dietary restrictions?',
  exerciseFrequency: 'List the forms and frequency of regular exercise',
  religion: 'What is your current religious affiliation?',
  religionImportance: 'How important is religion to you?',
  ethnicity: 'What is your Ethnic Origin/Ancestry?',
  differenReligion: 'If the Intended Parents had a different religious belief, would you be comfortable?',
  criminalHistory: 'Have you or anyone in your household ever been arrested or convicted?',
  recentTravel: 'Have you traveled outside of the U.S. in the last 6 months?',
  travelPlans: 'Do you plan on traveling within or outside of the U.S.?',
  sleepIssues: 'Do you have any issues with sleeping?',
  sleepHours: 'How many hours do you typically sleep each night?',
  reliableVehicle: 'Do you have a reliable vehicle to drive?',
  autoInsurance: 'Do you have automobile insurance?',
  validLicense: 'Do you have a valid driver\'s license?',
  partnerFdaTests: 'Will your partner submit to the FDA required lab tests?',
  divorcedRelationship: 'If you are divorced or separated from the other parent(s) of your child(ren), please describe this relationship',

  // Health
  mentalHealthDiagnosis: 'Have you ever been formally or informally diagnosed with any mental health challenge (e.g. depression, anxiety, bipolar disorder, postpartum depression)?',
  mentalHealthDiagnosisDetails: 'Please provide details',
  mentalHealthHospitalization: 'Have you ever been hospitalized for a mental health challenge?',
  mentalHealthHospitalizationDetails: 'Please provide details',
  mentalHealthMedication: 'Do you currently or have you ever taken medication for a mental health challenge?',
  mentalHealthMedicationDetails: 'Please provide details',
  counselingTherapy: 'Are you currently or have you ever participated in counseling or psychotherapy?',
  counselingTherapyDetails: 'Please provide details',
  familyMentalHealth: 'Has anyone in your family ever had a mental health challenge such as depression, anxiety, alcoholism or drug abuse?',
  familyMentalHealthDetails: 'Please provide details',
  domesticViolence: 'Were you ever involved in a relationship where you experienced domestic violence?',
  domesticViolenceDetails: 'Please provide details',
  openToVaccinations: 'Are you open to being vaccinated if required for the surrogacy process?',
  covidVaccine: 'Have you received the Covid-19 vaccination?',
  covidVaccineWilling: 'Are you willing to receive the vaccination if recommended?',
  hadCovid: 'Have you had Covid-19 before?',
  covidBooster: 'Have you received the booster?',
  covidBoosterWilling: 'Are you comfortable getting the booster if requested?',
  allergies: 'Do you currently have any allergies?',
  allergyDetails: 'Please list allergies',
  medicalConditions: 'Do you currently have any medical conditions?',
  medicalConditionDetails: 'Please provide details',
  lastPhysical: 'When was your last annual physical?',
  lastPap: 'Most recent Pap and results',
  diseaseHistory: 'Health conditions history',
  diseaseHistoryDetails: 'Please explain any checked conditions',
  nonPrescriptionMeds: 'Non-prescription medication use (such as Tylenol, Advil, allergy/cold medication, etc.)',
  prescriptionMeds: 'Prescription medications taken in the past 5 years, their purpose and dates of use',
  currentMeds: 'Current medications and supplements',
  surgeries: 'Hospitalization/surgery history over past 5 years. Please list surgery and year.',

  // Employment
  currentlyEmployed: 'Are you currently employed?',
  employmentIndustry: 'Please share details on the industry you work in.',
  workHours: 'How many hours a week do you work, and what are your typical hours?',
  occupation: 'What specifically is your occupation/position?',
  lengthAtEmployer: 'How long have you worked for your current employer?',
  hourlyRate: 'What is your earned hourly rate?',
  weeklyIncome: 'What is your approximate weekly income?',
  partnerEmployed: 'Is your spouse/partner employed?',
  partnerOccupation: "Spouse/partner's occupation",
  partnerWorkHours: 'What hours and days does your spouse/partner work each week?',
  partnerWeeklyIncome: "Spouse/partner's approximate weekly income",
  governmentAssistance: 'Do you receive any government assistance (WIC, food stamps)?',
  governmentAssistanceDetails: 'Please explain',

  // Interests
  favoriteMusic: 'Favorite music', favoriteMovie: 'Favorite movie',
  favoriteBook: 'Favorite book', favoriteFoods: 'Favorite foods',
  favoriteColor: 'Favorite color', favoriteFlower: 'Favorite flower',
  pets: 'Do you have any pets, including chickens and livestock?',
  catLitter: 'If you have cats, who changes the litter box?',
  hobbies: 'What do you like to do in your free time?',
  collections: 'Do you collect anything special?',
  dreamTravel: 'Where would you most like to travel and why?',
  personality: 'How would you describe yourself? Please include a description of your personality and temperament.',

  // Academic (moved to Follow Up)
  educationLevel: 'Highest level of education',
  currentlyInSchool: 'Are you currently in school?',
  currentlyInSchoolDetails: 'Please provide details',

  // Updated fields
  partnerAgreesTermination: 'Would your spouse or support person support the decision for termination?',
  compensationNegotiable: 'Is your Surrogate Base Fee negotiable?',

  // Experienced Surrogate
  previousSurrogate: 'Have you ever been a surrogate before?',
  surrogacyTimes: 'How many times?',
  reName: 'What was the name of the Reproductive Doctor?',
  reLocation: 'What City/State was the IVF clinic located in?',
  reDates: 'What years were you seen there?',
  outcome: 'What was the outcome of this surrogacy journey?',
  weeksDelivered: 'Weeks when delivered',
  transfers: 'How many transfers until pregnant?',
  embryoSourceList: 'Embryo source (select all that apply)',
  overallExperience: 'Please describe the overall experience. What did you like and what would you like to avoid in your next journey?',

  // Hopes & Wishes
  usCitizen: 'Are you a U.S. Citizen or Permanent Resident?',
  contraceptiveMethod: 'Which contraceptive method do you currently use?',
  childrenSpecialNeeds: 'Do any of your children have special needs or medical conditions?',
  childrenSpecialNeedsDetails: 'Please explain',
  piercingsTattoos: 'Do you have any piercings or tattoos?',
  criminalHistory: 'Have you or anyone in your household ever been arrested or convicted?',
  criminalHistoryDetails: 'Please explain',
  travelPlans: 'Do you plan on traveling within or outside of the U.S. in the next 6 months?',
  travelPlansDetails: 'Please explain',
  reliableVehicle: 'Do you have a reliable vehicle to drive?',
  openToVaccinations: 'Are you open to vaccinations if recommended by the clinic?',
  vaccinesNotWilling: 'Please explain which vaccines you are not willing to receive',
  lastPap: 'When was your most recent Pap test completed and results?',
  healthInsurance: 'Do you currently have health insurance?',
  insuranceType: 'What type of insurance do you have?',
  educationLevel: 'Highest level of education',
  currentlyInSchool: 'Are you currently enrolled in school?',
  currentlyInSchoolDetails: 'Please provide details',
  reasonForSurrogacy: 'Why do you want to become a surrogate (or be a repeat surrogate), and how long have you been thinking about it?',
  compensationUse: 'How do you plan to use the money that you make from being a surrogate?',
  surrogacyFit: 'Please explain how you see surrogacy fitting into your life',
  supportSystem: 'Who will be your resource to help with your children for appointments / possible bed rest etc.? Please provide specific details on your support system.',
  threeTransferAttempts: 'Are you willing to have 3 transfer attempts with the same IP if that is what it takes to achieve a pregnancy?',
  reduceCaffeine: 'Are you willing to reduce the amount of caffeine and soda you consume during the pregnancy?',
  lifestyleChanges: 'Are you open to making other lifestyle changes at the request of the Intended Parents?',
  pumpBreastmilk: 'Are you open to pumping colostrum and breast milk for your IP if they were to request this?',
  idealIPs: 'Describe your ideal intended parent(s) for whom you would like to be a surrogate',
  preferredCommunication: 'What is the best form of communication that you are comfortable using?',
  ipInvolvement: 'How much involvement from the Intended Parents do you want during the pregnancy?',
  ipsAtAppointments: 'Would you be willing to have the Intended Parents at doctor appointments and in delivery room?',
  ipsAtAppointmentsDetails: 'Please explain',
  deliveryRoomOthers: 'Is there anyone else you would like to have in the delivery room (partner/spouse, friend, mom)?',
  ipsCantAttend: 'How do you feel about having Intended Parents who cannot attend doctor appointments and see you on a regular basis?',
  childCareTraveling: 'Who will care for your child(ren) when you need to travel for surrogacy?',
  ipsWithChildren: 'Are you willing to match with Intended Parents who already have children?',
  openLGBTQ: 'Are you open to matching with LGBTQ+ individual/couples?',
  openSingleIP: 'Are you willing to match with a single Intended Parent?',
  transferAnotherState: 'Are you willing to have the embryo transfer in another state?',
  transferAnotherStateDetails: 'Please explain',
  ipsOutsideUS: 'Are you willing to match with Intended Parents who live outside of the U.S.?',
  whenReadyToBegin: 'When are you ready to begin?',
  adminNotes: 'Agency Notes',
  postBirthRelationship: 'Ideal relationship with Intended Parent(s) post birth',
  cvsAmnio: 'If recommended by a physician, would you be willing to undergo CVS, amniocentesis or other diagnostic testing?',
  cvsAmnioDetails: 'Please explain',
  willingnessToTerminate: 'Willingness to terminate for a serious genetic or medical condition and follow IP(s) direction and doctor recommendation?',
  partnerAgreesTermination: 'Would your spouse or support person support the decision for termination?',
  conditionsWontTerminate: 'Are there any specific conditions where you would not terminate a pregnancy?',
  conditionsWontTerminateDetails: 'Please explain',
  embryosToTransfer: 'How many embryos are you in agreement to transfer at a time?',
  carryTwins: 'If the 1 transferred embryo splits, would you be in agreement to carrying twins?',
  desiredCompensation: 'Surrogate base fee',
  compensationNegotiable: 'Is this negotiable?',
  additionalComments: 'Message to potential Intended Parent(s)',
}

// ─────────────────────────────────────────────────────────
// Section definitions (extracted from SurrogateProfilePage)
// ─────────────────────────────────────────────────────────

const SECTION_META = [
  { key: 'profilePhotos', title: 'Profile Photo & Cover Image', icon: Camera, description: 'Your portrait and the banner image at the top of your profile' },
  ...GC_PROFILE_SECTIONS.map(s => ({
    key: s.key,
    title: s.title,
    icon: NARRATIVE_ICON_MAP[s.icon] || Heart,
    description: s.note || '',
    narrative: true,
  })),
  { key: 'photos', title: 'Photos', icon: Camera, description: 'Share photos for your matching profile' },
]

// Required fields per section for completion tracking.
// Each narrative section's required fields are its own question ids.
const REQUIRED_FIELDS = {
  profilePhotos: ['profilePhotoUrl', 'coverPhotoUrl'],
  ...Object.fromEntries(GC_PROFILE_SECTIONS.map(s => [
    s.key,
    s.questions.filter(q => q.type !== 'pregnancyHistory').map(q => q.id),
  ])),
  photos: [],
}

// Conditional required fields — only required if parent field has a specific value
const CONDITIONAL_REQUIRED = {}

function isPregnancyComplete(p) {
  if (!p.outcome || !p.dob || !p.gestationWeeks || !p.deliveryType) return false
  if (p.outcome === 'Live Birth' && !p.weight) return false
  return true
}

function countCompleted(data, sectionKey) {
  const fields = REQUIRED_FIELDS[sectionKey] || []
  if (fields.length === 0) return { filled: 0, total: 0, complete: false }

  // Special: pregnancyExperience also factors in the embedded structured
  // pregnancy history (numberOfPregnancies + per-pregnancy completeness)
  // alongside its narrative questions.
  if (sectionKey === 'pregnancyExperience') {
    const numPreg = parseInt(data?.pregnancyHistory?.numberOfPregnancies) || 0
    const pregnancies = data?.pregnancyHistory?.pregnancies || []
    const phTotal = numPreg < 1 ? 1 : numPreg + 1
    const phFilled = numPreg < 1
      ? 0
      : (() => {
          const done = pregnancies.filter(p => isPregnancyComplete(p)).length
          return done >= numPreg ? numPreg + 1 : done
        })()

    const narrative = data?.narrative || {}
    const narrativeFields = REQUIRED_FIELDS.pregnancyExperience || []
    let narrFilled = 0
    for (const f of narrativeFields) {
      const val = narrative[f]
      if (val !== undefined && val !== '' && val !== null) narrFilled++
    }
    const total = phTotal + narrativeFields.length
    const filled = phFilled + narrFilled
    return { filled, total, complete: total > 0 && filled === total }
  }

  // Special: experienced surrogate — when previousSurrogate === 'yes', every journey must have all fields filled
  if (sectionKey === 'experiencedSurrogate') {
    const es = data?.experiencedSurrogate || {}
    const prev = es.previousSurrogate
    // Base: previousSurrogate must be answered
    if (!prev) return { filled: 0, total: 1, complete: false }
    if (prev !== 'yes') return { filled: 1, total: 1, complete: true }
    const count = parseInt(es.surrogacyTimes) || 0
    const journeys = Array.isArray(es.journeys) ? es.journeys : []
    const perJourneyFields = ['reName', 'reLocation', 'reDates', 'outcome', 'embryoSourceList']
    // previousSurrogate (1) + surrogacyTimes (1) + overallExperience (1) + each journey's 5 fields
    const total = 3 + count * perJourneyFields.length
    let filled = 1 // previousSurrogate
    if (count > 0) filled++
    if (es.overallExperience) filled++
    for (let i = 0; i < count; i++) {
      const j = journeys[i] || {}
      for (const f of perJourneyFields) {
        const val = j[f]
        const isFilled = Array.isArray(val) ? val.length > 0 : (val !== undefined && val !== '' && val !== null)
        if (isFilled) filled++
      }
    }
    return { filled, total, complete: filled === total }
  }

  // Narrative sections all read from the shared `data.narrative` blob.
  const isNarrativeSection = GC_PROFILE_SECTIONS.some(s => s.key === sectionKey)

  // Build list of active required fields (base + visible conditionals)
  const conditionals = CONDITIONAL_REQUIRED[sectionKey] || {}
  const sectionData = isNarrativeSection ? (data?.narrative || {}) : (data?.[sectionKey] || {})
  const activeFields = [...fields]

  // Add conditional fields only when their parent triggers them
  // Rules may specify parentSection to reference a field in another section.
  for (const [field, rule] of Object.entries(conditionals)) {
    const parentData = rule.parentSection ? (data?.[rule.parentSection] || {}) : sectionData
    const parentVal = parentData[rule.parent]
    const matches = typeof rule.showWhen === 'function' ? rule.showWhen(parentVal) : parentVal === rule.showWhen
    if (matches) activeFields.push(field)
  }

  let filled = 0
  for (const f of activeFields) {
    const val = sectionData[f]
    if (val !== undefined && val !== '' && val !== null) filled++
  }

  if (sectionKey === 'personal') {
    const householdMembers = Array.isArray(sectionData.householdMembers) ? sectionData.householdMembers : []
    const isValidStepchildDob = (dob) => {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dob || '')) return false
      const [day, month, year] = String(dob).split('/').map(Number)
      const date = new Date(year, month - 1, day)
      return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      )
    }
    for (const member of householdMembers) {
      if (['Stepson', 'Stepdaughter'].includes(member?.relationship || '')) {
        if (isValidStepchildDob(member?.stepchildDob)) filled++
        activeFields.push(`householdMembers:${member.relationship}:stepchildDob`)
      }
    }
  }

  return { filled, total: activeFields.length, complete: filled === activeFields.length }
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

// Fields deleted from profile entirely
const DELETED_FIELDS = [
  'religion', 'religionImportance', 'ethnicity', 'differenReligion',
  'covidVaccine', 'covidVaccineWilling', 'hadCovid', 'covidBooster', 'covidBoosterWilling',
  'reLocation', // from experienced surrogate journeys
]

// Fields moved from their original sections to the Follow Up Questions form
const FOLLOW_UP_FIELDS = [
  // From Fertility
  { key: 'breastfeeding', type: 'yesno', section: 'fertility' },
  { key: 'breastfeedingStopDate', type: 'text', section: 'fertility', conditional: d => d.breastfeeding === 'yes' },
  { key: 'cycleLength', type: 'yesno', section: 'fertility' },
  { key: 'cycleLengthDetails', type: 'text', section: 'fertility', conditional: d => d.cycleLength === 'no' },
  { key: 'willingToTravelNICU', type: 'yesno', section: 'fertility' },
  { key: 'lastPeriod', type: 'text', section: 'fertility' },
  { key: 'nearestNICU', type: 'text', section: 'fertility' },
  { key: 'timeToConceive', type: 'text', section: 'fertility' },
  // From General
  { key: 'placedForAdoption', type: 'yesno', section: 'general' },
  { key: 'gunsOwned', type: 'yesno', section: 'general' },
  { key: 'nonSterilePiercing', type: 'yesno', section: 'general' },
  { key: 'eatingDisorders', type: 'yesno', section: 'general' },
  { key: 'recentTravel', type: 'yesno', section: 'general' },
  { key: 'sleepIssues', type: 'yesno', section: 'general' },
  { key: 'sleepHours', type: 'text', section: 'general' },
  { key: 'autoInsurance', type: 'yesno', section: 'general' },
  { key: 'validLicense', type: 'yesno', section: 'general' },
  { key: 'partnerFdaTests', type: 'yesno', section: 'general' },
  // From Health
  { key: 'lastPhysical', type: 'text', section: 'health' },
]

export {
  SECTION_META,
  REQUIRED_FIELDS,
  CONDITIONAL_REQUIRED,
  isPregnancyComplete,
  countCompleted,
  US_STATES,
  DELETED_FIELDS,
  FOLLOW_UP_FIELDS,
}

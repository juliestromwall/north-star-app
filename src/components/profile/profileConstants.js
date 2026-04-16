import {
  User, Home, Baby, Stethoscope, HeartPulse, Apple, Briefcase,
  Heart, Camera
} from 'lucide-react'

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
  breastfeeding: 'Are you currently breastfeeding/lactating?',
  breastfeedingStopDate: 'When do you expect to stop?',
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
  partnerOccupation: "Spouse/partner's occupation",
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
  lastPap: 'When was your last pap smear?',
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
  ipsOutsideUS: 'Are you willing to match with Intended Parents who live outside of the U.S.?',
  whenReadyToBegin: 'When are you ready to begin?',
  postBirthRelationship: 'Ideal relationship with Intended Parent(s) post birth',
  cvsAmnio: 'If recommended by a physician, would you be willing to undergo CVS, amniocentesis or other diagnostic testing?',
  cvsAmnioDetails: 'Please explain',
  willingnessToTerminate: 'Willingness to terminate for a serious genetic or medical condition and follow IP(s) direction and doctor recommendation?',
  partnerAgreesTermination: 'Would your spouse or support person support the decision for termination?',
  conditionsWontTerminate: 'Are there any specific conditions where you would not terminate a pregnancy? Please explain.',
  embryosToTransfer: 'How many embryos are you in agreement to transfer at a time?',
  carryTwins: 'If you only prefer to transfer 1 embryo and the embryo splits, would you be in agreement to carry twins?',
  desiredCompensation: 'Surrogate base fee',
  compensationNegotiable: 'Is this negotiable?',
  additionalComments: 'Message to potential Intended Parent(s)',
}

// ─────────────────────────────────────────────────────────
// Section definitions (extracted from SurrogateProfilePage)
// ─────────────────────────────────────────────────────────

const SECTION_META = [
  { key: 'personal', title: 'Personal Information', icon: User, description: 'Basic info, relationships, and household' },
  { key: 'followUp', title: 'Profile Follow Up Questions', icon: Stethoscope, description: 'Additional screening and eligibility questions' },
  { key: 'pregnancyHistory', title: 'Pregnancy History', icon: Baby, description: 'Previous pregnancies and deliveries' },
  { key: 'fertility', title: 'Fertility Information', icon: Stethoscope, description: 'Reproductive health and fertility details' },
  { key: 'general', title: 'General Information', icon: Home, description: 'Housing, lifestyle, habits, and background' },
  { key: 'health', title: 'Health Information', icon: HeartPulse, description: 'Medical history, medications, and conditions' },
  { key: 'employment', title: 'Employment Information', icon: Briefcase, description: 'Work, income, and insurance details' },
  { key: 'academic', title: 'Education', icon: Apple, description: 'Education and current schooling' },
  { key: 'interests', title: 'Interests', icon: Heart, description: 'Favorites, hobbies, and personality' },
  { key: 'experiencedSurrogate', title: 'Experienced Surrogate Information', icon: Stethoscope, description: 'Previous surrogacy journey details' },
  { key: 'hopesWishes', title: 'Journey Hopes & Wishes', icon: Heart, description: 'Your surrogacy goals, preferences, and compensation' },
  { key: 'photos', title: 'Photos', icon: Camera, description: 'Share photos for your matching profile' },
]

// Required fields per section for completion tracking
const REQUIRED_FIELDS = {
  personal: ['firstName', 'city', 'state', 'heightFt', 'weight', 'maritalStatus', 'sexualPartners', 'usCitizen'],
  followUp: [], // FollowUp questions are application-only, not part of profile completion
  pregnancyHistory: ['numberOfPregnancies'],
  fertility: ['sameBioFather', 'pregnancyDetails', 'infertilityTreatment', 'gynecologicalProblems', 'pregnancyMedication', 'contraceptiveMethod'],
  general: ['homeOwnership', 'homeDuration', 'childrenFullTime', 'planMoreChildren',
    'smokeVape', 'smokingHistory', 'householdSmoker', 'alcoholDrugs', 'advisedLimitSubstances',
    'householdControlledSubstances', 'typicalDiet', 'exerciseFrequency',
    'childrenSpecialNeeds', 'piercingsTattoos', 'criminalHistory', 'travelPlans', 'reliableVehicle'],
  health: ['mentalHealthDiagnosis', 'mentalHealthHospitalization', 'mentalHealthMedication',
    'counselingTherapy', 'familyMentalHealth', 'domesticViolence',
    'allergies', 'medicalConditions', 'surgeries', 'nonPrescriptionMeds', 'prescriptionMeds', 'currentMeds',
    'openToVaccinations', 'lastPap'],
  employment: ['currentlyEmployed', 'governmentAssistance', 'healthInsurance'],
  interests: ['favoriteMusic', 'favoriteMovie', 'favoriteBook', 'favoriteFoods',
    'favoriteColor', 'favoriteFlower', 'pets', 'catLitter', 'hobbies', 'dreamTravel', 'personality'],
  academic: ['educationLevel', 'currentlyInSchool'],
  experiencedSurrogate: ['previousSurrogate'],
  hopesWishes: ['reasonForSurrogacy', 'compensationUse', 'surrogacyFit', 'supportSystem',
    'threeTransferAttempts', 'reduceCaffeine', 'lifestyleChanges', 'pumpBreastmilk',
    'idealIPs', 'preferredCommunication', 'ipInvolvement', 'ipsAtAppointments',
    'deliveryRoomOthers', 'ipsCantAttend',
    'ipsWithChildren', 'openLGBTQ', 'openSingleIP', 'transferAnotherState', 'ipsOutsideUS',
    'childCareTraveling', 'whenReadyToBegin', 'postBirthRelationship',
    'cvsAmnio', 'willingnessToTerminate', 'conditionsWontTerminate',
    'embryosToTransfer', 'carryTwins', 'desiredCompensation'],
  photos: [],
}

// Conditional required fields — only required if parent field has a specific value
const CONDITIONAL_REQUIRED = {
  personal: {
    monogamous: { parent: 'maritalStatus', showWhen: v => !['Single', 'Divorced', 'Widowed', ''].includes(v || '') },
    relationshipLength: { parent: 'maritalStatus', showWhen: v => ['In a Relationship', 'Married', 'Domestic Partnership'].includes(v || '') },
    partnerName: { parent: 'maritalStatus', showWhen: v => ['In a Relationship', 'Married', 'Domestic Partnership'].includes(v || '') },
    partnerDob: { parent: 'maritalStatus', showWhen: v => ['In a Relationship', 'Married', 'Domestic Partnership'].includes(v || '') },
    partnerUsCitizen: { parent: 'maritalStatus', showWhen: v => ['In a Relationship', 'Married', 'Domestic Partnership'].includes(v || '') },
  },
  followUp: {},
  fertility: {
    sameBioFatherDetails: { parent: 'sameBioFather', showWhen: 'no' },
    infertilityTreatmentDetails: { parent: 'infertilityTreatment', showWhen: 'yes' },
    gynecologicalProblemsDetails: { parent: 'gynecologicalProblems', showWhen: 'yes' },
    pregnancyMedicationList: { parent: 'pregnancyMedication', showWhen: 'yes' },
  },
  general: {
    childrenFullTimeDetails: { parent: 'childrenFullTime', showWhen: 'no' },
    planMoreChildrenDetails: { parent: 'planMoreChildren', showWhen: 'yes' },
    smokingHistoryDetails: { parent: 'smokingHistory', showWhen: 'yes' },
    householdSmokerDetails: { parent: 'householdSmoker', showWhen: 'yes' },
    alcoholDrugsDetails: { parent: 'alcoholDrugs', showWhen: 'yes' },
    advisedLimitDetails: { parent: 'advisedLimitSubstances', showWhen: 'yes' },
    householdSubstancesDetails: { parent: 'householdControlledSubstances', showWhen: 'yes' },
    childrenSpecialNeedsDetails: { parent: 'childrenSpecialNeeds', showWhen: 'yes' },
    criminalHistoryDetails: { parent: 'criminalHistory', showWhen: 'yes' },
    travelPlansDetails: { parent: 'travelPlans', showWhen: 'yes' },
  },
  health: {
    mentalHealthDetails: { parent: 'mentalHealthDiagnosis', showWhen: 'yes' },
    mentalHealthHospDetails: { parent: 'mentalHealthHospitalization', showWhen: 'yes' },
    mentalHealthMedDetails: { parent: 'mentalHealthMedication', showWhen: 'yes' },
    counselingDetails: { parent: 'counselingTherapy', showWhen: 'yes' },
    familyMentalHealthDetails: { parent: 'familyMentalHealth', showWhen: 'yes' },
    domesticViolenceDetails: { parent: 'domesticViolence', showWhen: 'yes' },
  },
  employment: {
    employmentIndustry: { parent: 'currentlyEmployed', showWhen: 'yes' },
    workHours: { parent: 'currentlyEmployed', showWhen: 'yes' },
    occupation: { parent: 'currentlyEmployed', showWhen: 'yes' },
    lengthAtEmployer: { parent: 'currentlyEmployed', showWhen: 'yes' },
    hourlyRate: { parent: 'currentlyEmployed', showWhen: 'yes' },
    weeklyIncome: { parent: 'currentlyEmployed', showWhen: 'yes' },
    governmentAssistanceDetails: { parent: 'governmentAssistance', showWhen: 'yes' },
    insuranceType: { parent: 'healthInsurance', showWhen: 'yes' },
  },
  hopesWishes: {
    cvsAmnioDetails: { parent: 'cvsAmnio', showWhen: 'no' },
    ipsAtAppointmentsDetails: { parent: 'ipsAtAppointments', showWhen: 'No' },
  },
  academic: {
    currentlyInSchoolDetails: { parent: 'currentlyInSchool', showWhen: 'yes' },
  },
}

function isPregnancyComplete(p) {
  if (!p.outcome || !p.dob || !p.gestationWeeks || !p.deliveryType) return false
  if (p.outcome === 'Live Birth' && !p.weight) return false
  return true
}

function countCompleted(data, sectionKey) {
  const fields = REQUIRED_FIELDS[sectionKey] || []
  if (fields.length === 0) return { filled: 0, total: 0, complete: false }

  // Special: pregnancy section requires all pregnancy details filled
  if (sectionKey === 'pregnancyHistory') {
    const numPreg = parseInt(data?.pregnancyHistory?.numberOfPregnancies) || 0
    const pregnancies = data?.pregnancyHistory?.pregnancies || []
    if (numPreg < 1) return { filled: 0, total: 1, complete: false }
    const completedPregs = pregnancies.filter(p => isPregnancyComplete(p)).length
    const allPregsComplete = completedPregs >= numPreg
    return { filled: allPregsComplete ? numPreg + 1 : completedPregs, total: numPreg + 1, complete: allPregsComplete }
  }

  // Build list of active required fields (base + visible conditionals)
  const conditionals = CONDITIONAL_REQUIRED[sectionKey] || {}
  const sectionData = data?.[sectionKey] || {}
  const activeFields = [...fields]

  // Add conditional fields only when their parent triggers them
  for (const [field, rule] of Object.entries(conditionals)) {
    const parentVal = sectionData[rule.parent]
    const matches = typeof rule.showWhen === 'function' ? rule.showWhen(parentVal) : parentVal === rule.showWhen
    if (matches) activeFields.push(field)
  }

  let filled = 0
  for (const f of activeFields) {
    const val = sectionData[f]
    if (val !== undefined && val !== '' && val !== null) filled++
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
  // From Personal
  { key: 'usCitizen', type: 'yesno', section: 'personal' },
  { key: 'realId', type: 'yesno', section: 'personal' },
  { key: 'validPassport', type: 'yesno', section: 'personal' },
  { key: 'otherLanguages', type: 'yesno', section: 'personal' },
  { key: 'otherLanguagesDetails', type: 'text', section: 'personal', conditional: d => d.otherLanguages === 'yes' },
  // From Fertility
  { key: 'breastfeeding', type: 'yesno', section: 'fertility' },
  { key: 'breastfeedingStopDate', type: 'text', section: 'fertility', conditional: d => d.breastfeeding === 'yes' },
  { key: 'cycleLength', type: 'yesno', section: 'fertility' },
  { key: 'cycleLengthDetails', type: 'text', section: 'fertility', conditional: d => d.cycleLength === 'no' },
  { key: 'willingToTravelNICU', type: 'yesno', section: 'fertility' },
  { key: 'contraceptiveMethod', type: 'text', section: 'fertility' },
  { key: 'lastPeriod', type: 'text', section: 'fertility' },
  { key: 'nearestNICU', type: 'text', section: 'fertility' },
  { key: 'timeToConceive', type: 'text', section: 'fertility' },
  // From General
  { key: 'childrenSpecialNeeds', type: 'yesno', section: 'general' },
  { key: 'placedForAdoption', type: 'yesno', section: 'general' },
  { key: 'gunsOwned', type: 'yesno', section: 'general' },
  { key: 'piercingsTattoos', type: 'yesno', section: 'general' },
  { key: 'lastTattooDate', type: 'text', section: 'general', conditional: d => d.piercingsTattoos === 'yes' },
  { key: 'nonSterilePiercing', type: 'yesno', section: 'general' },
  { key: 'eatingDisorders', type: 'yesno', section: 'general' },
  { key: 'criminalHistory', type: 'yesno', section: 'general' },
  { key: 'recentTravel', type: 'yesno', section: 'general' },
  { key: 'travelPlans', type: 'yesno', section: 'general' },
  { key: 'sleepIssues', type: 'yesno', section: 'general' },
  { key: 'sleepHours', type: 'text', section: 'general' },
  { key: 'reliableVehicle', type: 'yesno', section: 'general' },
  { key: 'autoInsurance', type: 'yesno', section: 'general' },
  { key: 'validLicense', type: 'yesno', section: 'general' },
  { key: 'partnerFdaTests', type: 'yesno', section: 'general' },
  // From Health
  { key: 'openToVaccinations', type: 'yesno', section: 'health' },
  { key: 'lastPhysical', type: 'text', section: 'health' },
  { key: 'lastPap', type: 'text', section: 'health' },
  // From Employment
  { key: 'healthInsurance', type: 'yesno', section: 'employment' },
  { key: 'insuranceType', type: 'text', section: 'employment', conditional: d => d.healthInsurance === 'yes' },
  // From Academic (entire section moves)
  { key: 'educationLevel', type: 'text', section: 'academic' },
  { key: 'currentlyInSchool', type: 'yesno', section: 'academic' },
  { key: 'currentlyInSchoolDetails', type: 'text', section: 'academic', conditional: d => d.currentlyInSchool === 'yes' },
  // From Hopes & Wishes
  { key: 'compensationNegotiable', type: 'yesno', section: 'hopesWishes' },
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

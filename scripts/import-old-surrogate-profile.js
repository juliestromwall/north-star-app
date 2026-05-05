// Import an old ABC surrogate profile export into surrogate_profiles.profile_data.
//
// Usage:
//   node scripts/import-old-surrogate-profile.js --file "docs/imports/Alexis Yokum profile export.xlsx" --email atyoakum@gmail.com
//   node scripts/import-old-surrogate-profile.js --file "docs/imports/Alexis Yokum profile export.xlsx" --email atyoakum@gmail.com --apply

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'

config({ path: new URL('../.env', import.meta.url).pathname })

const args = new Map()
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]
  if (arg.startsWith('--')) {
    const key = arg.slice(2)
    const next = process.argv[i + 1]
    if (!next || next.startsWith('--')) args.set(key, true)
    else {
      args.set(key, next)
      i++
    }
  }
}

const file = args.get('file')
const email = String(args.get('email') || '').trim().toLowerCase()
const apply = args.has('apply')
const createIntake = args.has('create-intake')
const intakeNameOverride = String(args.get('name') || '').trim() // optional "First Last" if xlsx lacks it

if (!file || !email) {
  console.error('Usage: node scripts/import-old-surrogate-profile.js --file <xlsx> --email <email> [--apply] [--create-intake [--name "First Last"]]')
  process.exit(1)
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const SECTION_BY_KEY = {
  firstName: 'personal',
  city: 'personal',
  state: 'personal',
  dob: 'personal',
  heightFt: 'personal',
  heightIn: 'personal',
  weight: 'personal',
  maritalStatus: 'personal',
  monogamous: 'personal',
  sexualPartners: 'personal',
  relationshipLength: 'personal',
  partnerName: 'personal',
  partnerDob: 'personal',
  usCitizen: 'personal',
  partnerUsCitizen: 'personal',
  householdMembers: 'personal',

  numberOfPregnancies: 'pregnancyHistory',

  pregnancyDetails: 'fertility',
  infertilityTreatment: 'fertility',
  infertilityTreatmentDetails: 'fertility',
  gynecologicalProblems: 'fertility',
  gynecologicalProblemsDetails: 'fertility',
  contraceptiveMethod: 'fertility',
  timeToConceive: 'fertility',
  lastPeriod: 'fertility',
  cycleLength: 'fertility',
  cycleLengthDetails: 'fertility',
  pregnancyMedication: 'fertility',
  pregnancyMedicationList: 'fertility',
  sameBioFather: 'fertility',
  sameBioFatherDetails: 'fertility',
  nearestNICU: 'fertility',
  willingToTravelNICU: 'fertility',
  breastfeeding: 'fertility',
  breastfeedingStopDate: 'fertility',

  childrenFullTime: 'general',
  childrenFullTimeDetails: 'general',
  childrenSpecialNeeds: 'general',
  childrenSpecialNeedsDetails: 'general',
  placedForAdoption: 'general',
  divorcedRelationship: 'general',
  planMoreChildren: 'general',
  planMoreChildrenDetails: 'general',
  smokeVape: 'general',
  smokingHistory: 'general',
  smokingHistoryDetails: 'general',
  householdSmoker: 'general',
  householdSmokerDetails: 'general',
  alcoholDrugs: 'general',
  alcoholDrugsDetails: 'general',
  householdControlledSubstances: 'general',
  householdSubstancesDetails: 'general',
  gunsOwned: 'general',
  piercingsTattoos: 'general',
  lastTattooDate: 'general',
  advisedLimitSubstances: 'general',
  advisedLimitDetails: 'general',
  eatingDisorders: 'general',
  eatingDisordersDetails: 'general',
  typicalDiet: 'general',
  partnerFdaTests: 'general',
  criminalHistory: 'general',
  criminalHistoryDetails: 'general',
  recentTravel: 'general',
  travelPlans: 'general',
  travelPlansDetails: 'general',
  exerciseFrequency: 'general',
  sleepIssues: 'general',
  sleepIssuesDetails: 'general',
  sleepHours: 'general',
  reliableVehicle: 'general',
  autoInsurance: 'general',
  validLicense: 'general',
  nonSterilePiercing: 'general',
  homeOwnership: 'general',
  homeDuration: 'general',

  mentalHealthDiagnosis: 'health',
  mentalHealthDiagnosisDetails: 'health',
  mentalHealthHospitalization: 'health',
  mentalHealthHospitalizationDetails: 'health',
  mentalHealthMedication: 'health',
  mentalHealthMedicationDetails: 'health',
  counselingTherapy: 'health',
  counselingTherapyDetails: 'health',
  familyMentalHealth: 'health',
  familyMentalHealthDetails: 'health',
  domesticViolence: 'health',
  domesticViolenceDetails: 'health',
  nonPrescriptionMeds: 'health',
  prescriptionMeds: 'health',
  currentMeds: 'health',
  allergies: 'health',
  allergyDetails: 'health',
  medicalConditions: 'health',
  medicalConditionDetails: 'health',
  lastPhysical: 'health',
  lastPap: 'health',
  surgeries: 'health',
  diseaseHistory: 'health',
  diseaseHistoryDetails: 'health',
  openToVaccinations: 'health',

  currentlyEmployed: 'employment',
  employmentIndustry: 'employment',
  workHours: 'employment',
  occupation: 'employment',
  lengthAtEmployer: 'employment',
  hourlyRate: 'employment',
  weeklyIncome: 'employment',
  partnerOccupation: 'employment',
  partnerWeeklyIncome: 'employment',
  healthInsurance: 'employment',
  insuranceType: 'employment',
  governmentAssistance: 'employment',
  governmentAssistanceDetails: 'employment',

  favoriteMusic: 'interests',
  favoriteMovie: 'interests',
  favoriteBook: 'interests',
  favoriteFoods: 'interests',
  favoriteColor: 'interests',
  favoriteFlower: 'interests',
  pets: 'interests',
  catLitter: 'interests',
  hobbies: 'interests',
  collections: 'interests',
  dreamTravel: 'interests',
  personality: 'interests',

  educationLevel: 'academic',
  currentlyInSchool: 'academic',
  currentlyInSchoolDetails: 'academic',

  previousSurrogate: 'experiencedSurrogate',
  surrogacyTimes: 'experiencedSurrogate',
  overallExperience: 'experiencedSurrogate',

  reasonForSurrogacy: 'hopesWishes',
  compensationUse: 'hopesWishes',
  surrogacyFit: 'hopesWishes',
  supportSystem: 'hopesWishes',
  threeTransferAttempts: 'hopesWishes',
  reduceCaffeine: 'hopesWishes',
  lifestyleChanges: 'hopesWishes',
  lifestyleChangesDetails: 'hopesWishes',
  pumpBreastmilk: 'hopesWishes',
  idealIPs: 'hopesWishes',
  preferredCommunication: 'hopesWishes',
  ipInvolvement: 'hopesWishes',
  ipsAtAppointments: 'hopesWishes',
  ipsAtAppointmentsDetails: 'hopesWishes',
  deliveryRoomOthers: 'hopesWishes',
  ipsCantAttend: 'hopesWishes',
  ipsWithChildren: 'hopesWishes',
  openLGBTQ: 'hopesWishes',
  openSingleIP: 'hopesWishes',
  transferAnotherState: 'hopesWishes',
  ipsOutsideUS: 'hopesWishes',
  childCareTraveling: 'hopesWishes',
  whenReadyToBegin: 'hopesWishes',
  postBirthRelationship: 'hopesWishes',
  cvsAmnio: 'hopesWishes',
  cvsAmnioDetails: 'hopesWishes',
  willingnessToTerminate: 'hopesWishes',
  partnerAgreesTermination: 'hopesWishes',
  conditionsWontTerminate: 'hopesWishes',
  embryosToTransfer: 'hopesWishes',
  carryTwins: 'hopesWishes',
  desiredCompensation: 'hopesWishes',
  compensationNegotiable: 'hopesWishes',
  additionalComments: 'hopesWishes',
}

const YESNO_KEYS = new Set([
  'monogamous', 'usCitizen', 'partnerUsCitizen', 'infertilityTreatment', 'gynecologicalProblems',
  'cycleLength', 'pregnancyMedication', 'sameBioFather', 'willingToTravelNICU', 'breastfeeding',
  'childrenFullTime', 'childrenSpecialNeeds', 'placedForAdoption', 'planMoreChildren', 'smokeVape',
  'smokingHistory', 'householdSmoker', 'alcoholDrugs', 'householdControlledSubstances', 'gunsOwned',
  'piercingsTattoos', 'advisedLimitSubstances', 'eatingDisorders', 'partnerFdaTests', 'criminalHistory',
  'recentTravel', 'travelPlans', 'sleepIssues', 'reliableVehicle', 'autoInsurance', 'validLicense',
  'nonSterilePiercing', 'mentalHealthDiagnosis', 'mentalHealthHospitalization', 'mentalHealthMedication',
  'counselingTherapy', 'familyMentalHealth', 'domesticViolence', 'allergies', 'medicalConditions',
  'openToVaccinations', 'currentlyEmployed', 'healthInsurance', 'governmentAssistance',
  'currentlyInSchool', 'previousSurrogate', 'threeTransferAttempts', 'reduceCaffeine',
  'lifestyleChanges', 'pumpBreastmilk', 'ipsAtAppointments', 'ipsWithChildren', 'openLGBTQ',
  'openSingleIP', 'transferAnotherState', 'ipsOutsideUS', 'cvsAmnio', 'partnerAgreesTermination',
  'carryTwins', 'compensationNegotiable',
])

const DATE_KEYS = new Set(['dob', 'partnerDob', 'lastPeriod'])

const STATE_ABBREVS = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

const EXACT = new Map([
  ['first name', ['firstName']],
  ['date of birth', ['dob']],
  ['date of birth', ['dob']],
  ['date of birth', ['dob']],
  ['date of birth', ['dob']],
  ['current marital relationship status', ['maritalStatus']],
  ['are you currently in a monogamous relationship', ['monogamous']],
  ['how many sexual partners have you had in the past 6 months', ['sexualPartners']],
  ['if married or otherwise in a relationship how long have you been together', ['relationshipLength']],
  ['first name only of your spouse or partner', ['partnerName']],
  ['spouse partner s date of birth', ['partnerDob']],
  ['are you a u s citizen or permanent resident', ['usCitizen']],
  ['is your spouse partner a u s citizen or permanent resident', ['partnerUsCitizen']],
  ['number of pregnancies', ['numberOfPregnancies']],
  ['what were your pregnancies like please describe in detail and be sure to provide information if there were complications', ['pregnancyDetails']],
  ['have you ever been seen by a doctor for infertility treatment if yes please provide details', ['infertilityTreatment', 'infertilityTreatmentDetails']],
  ['have you ever been told of any gynecological problems endometriosis ovarian cysts fibroids abnormal pap smears etc if yes please provide details', ['gynecologicalProblems', 'gynecologicalProblemsDetails']],
  ['which contraceptive method do you currently use', ['contraceptiveMethod']],
  ['did it take you longer than 6 months to get pregnant on your own if yes please provide details', ['timeToConceive']],
  ['when was the start of your last period', ['lastPeriod']],
  ['what is your typical cycle length', ['cycleLengthDetails']],
  ['did you ever take medication aside from prenatals during pregnancy', ['pregnancyMedication']],
  ['is the biological father the same for all children please explain', ['sameBioFather', 'sameBioFatherDetails']],
  ['please list medications', ['pregnancyMedicationList']],
  ['what is the nearest hospital with a level ii or iii nicu', ['nearestNICU']],
  ['if only a level i is close to your home are you ok traveling if requested to a hospital with at least a level ii nicu', ['willingToTravelNICU']],
  ['are you currently breastfeeding lactating', ['breastfeeding']],
  ['do your children live with you full time if not please explain', ['childrenFullTime', 'childrenFullTimeDetails']],
  ['please list first names and relationship of all the people who live with you', ['householdMembers']],
  ['do any of your children have special needs or medical conditions e g autism developmental delays if so please briefly describe', ['childrenSpecialNeeds', 'childrenSpecialNeedsDetails']],
  ['have you ever placed a child for adoption if yes please provide details', ['placedForAdoption']],
  ['if you are divorced or separated from the other parent s of your child ren please describe this relationship', ['divorcedRelationship']],
  ['do you plan to have any more children of your own if yes please share your thoughts', ['planMoreChildren', 'planMoreChildrenDetails']],
  ['do you currently smoke or vape', ['smokeVape']],
  ['do you have a history of smoking in the past if yes for how long and when did you quit', ['smokingHistory', 'smokingHistoryDetails']],
  ['does anyone else in your household currently smoke or vape if yes please provide details who how often where and what are they smoking', ['householdSmoker', 'householdSmokerDetails']],
  ['do you drink alcohol or use recreational drugs please list frequency and type', ['alcoholDrugs', 'alcoholDrugsDetails']],
  ['does anyone in your household drink alcohol use controlled substances including pain killers anxiety meds sleeping medication etc or recreational drugs if yes what how often and when where', ['householdControlledSubstances', 'householdSubstancesDetails']],
  ['do you own any guns if yes how many and where do you keep them', ['gunsOwned']],
  ['do you have any piercings or tattoos if yes please list location and quantity for both', ['piercingsTattoos']],
  ['have you ever been advised to limit your use of alcohol or any drugs if yes please provide details', ['advisedLimitSubstances', 'advisedLimitDetails']],
  ['do you have a history of eating disorders if yes please explain', ['eatingDisorders', 'eatingDisordersDetails']],
  ['please describe your typical diet and eating habits do you cook at home how often do you eat out do you have any special dietary restrictions', ['typicalDiet']],
  ['if in a relationship will your partner submit to the fda required lab tests these tests include sexually transmitted disease testing and drug testing', ['partnerFdaTests']],
  ['have you or anyone in your household ever been arrested and or convicted of a crime misdemeanor felony if yes please provide dates and explain please note that it is standard practice for us to do background checks on all of our surrogates and their spouses and or partners', ['criminalHistory', 'criminalHistoryDetails']],
  ['have you traveled outside of the u s in the last 6 months if yes please explain when and where', ['recentTravel']],
  ['do you plan on traveling within or outside of the u s in the next 6 8 months if yes please explain when and where', ['travelPlans', 'travelPlansDetails']],
  ['list the forms and frequency of regular exercise', ['exerciseFrequency']],
  ['do you have any issues with sleeping if yes please explain', ['sleepIssues', 'sleepIssuesDetails']],
  ['how many hours do you typically sleep each night', ['sleepHours']],
  ['do you have a reliable vehicle to drive', ['reliableVehicle']],
  ['do you have automobile insurance', ['autoInsurance']],
  ['do you have a valid driver s license', ['validLicense']],
  ['have you ever been tattooed or had a non sterile skin piercing procedure in the last 12 months if yes you may be required to provide a copy of the license from the facility', ['nonSterilePiercing']],
  ['what month year did you have your last tattoo was it a licensed facility', ['lastTattooDate']],
  ['do you own or rent your home', ['homeOwnership']],
  ['how long have you lived in your current home', ['homeDuration']],
  ['have you ever been formally or informally diagnosed with any mental health issue for example depression anxiety bipolar disorder or postpartum depression if yes please provide details', ['mentalHealthDiagnosis', 'mentalHealthDiagnosisDetails']],
  ['have you ever been hospitalized for a mental health issue if yes please provide details', ['mentalHealthHospitalization', 'mentalHealthHospitalizationDetails']],
  ['do you currently or have you ever taken medication for a mental health issue if yes please list dates and medication type', ['mentalHealthMedication', 'mentalHealthMedicationDetails']],
  ['are you currently or have you ever participated in counseling or psychotherapy if yes please provide details', ['counselingTherapy', 'counselingTherapyDetails']],
  ['has anyone in your family ever had a mental health or nervous issue such as depression anxiety alcoholism or drug abuse if yes please explain', ['familyMentalHealth', 'familyMentalHealthDetails']],
  ['were you ever involved in a relationship where you experienced domestic violence if yes please explain', ['domesticViolence', 'domesticViolenceDetails']],
  ['do you use non prescription medications such as tylenol advil allergy cold medication etc if yes please explain which medication s how often', ['nonPrescriptionMeds']],
  ['please list any other prescription medications you ve taken in the past 5 years their purpose and dates of use', ['prescriptionMeds']],
  ['please list any current medications and supplements you take', ['currentMeds']],
  ['when was your last annual physical', ['lastPhysical']],
  ['most recent pap and results', ['lastPap']],
  ['please list any hospitalizations surgeries over the past 5 years include surgery and year', ['surgeries']],
  ['please indicate whether you have had any of the following conditions or diseases check all that apply', ['diseaseHistory']],
  ['please explain any checked conditions', ['diseaseHistoryDetails']],
  ['if required for the surrogacy process are you open to being vaccinated i e hep b flu varicella etc', ['openToVaccinations']],
  ['are you currently employed if yes please share details on the industry you work in', ['currentlyEmployed', 'employmentIndustry']],
  ['how many hours a week do you work and what are your typical hours', ['workHours']],
  ['what specifically is your occupation position', ['occupation']],
  ['how long have you worked for your current employer', ['lengthAtEmployer']],
  ['what is your earned hourly rate', ['hourlyRate']],
  ['what is your approximate weekly income', ['weeklyIncome']],
  ['spouse partner s occupation', ['partnerOccupation']],
  ['spouse partner s approximate weekly income', ['partnerWeeklyIncome']],
  ['do you have health insurance coverage if yes please provide name of provider', ['healthInsurance']],
  ['is it a private personal policy or through you or your spouse s employer', ['insuranceType']],
  ['do you receive any government assistance wic food stamps if yes please explain', ['governmentAssistance', 'governmentAssistanceDetails']],
  ['favorite music', ['favoriteMusic']],
  ['favorite movie', ['favoriteMovie']],
  ['favorite book', ['favoriteBook']],
  ['favorite foods', ['favoriteFoods']],
  ['favorite color', ['favoriteColor']],
  ['favorite flower', ['favoriteFlower']],
  ['do you have any pets including chickens and livestock', ['pets']],
  ['if you have cats who changes the litter box', ['catLitter']],
  ['what do you like to do in your free time', ['hobbies']],
  ['do you collect anything special', ['collections']],
  ['where would you most like to travel and why', ['dreamTravel']],
  ['how would you describe yourself please include a description of your personality and temperament', ['personality']],
  ['highest level of education and or type of vocational training', ['educationLevel']],
  ['are you currently in school if yes please explain', ['currentlyInSchool', 'currentlyInSchoolDetails']],
  ['have you ever been a surrogate before if yes how many times', ['previousSurrogate', 'surrogacyTimes']],
  ['please describe the overall experience what did you like and what would you like to avoid in your next journey', ['overallExperience']],
  ['why do you want to become a surrogate or be a repeat surrogate and how long have you been thinking about it', ['reasonForSurrogacy']],
  ['how do you plan to use the money that you make from being a surrogate', ['compensationUse']],
  ['please explain how you see surrogacy fitting into your life', ['surrogacyFit']],
  ['who will be your resource to help with your children for appointments possible bed rest etc please provide specific details on your support system', ['supportSystem']],
  ['are you willing to have 3 transfer attempts with the same ip if that is what it takes to achieve a pregnancy', ['threeTransferAttempts']],
  ['are you willing to reduce the amount of caffeine and soda you consume during the pregnancy', ['reduceCaffeine']],
  ['are you open to making other lifestyle changes at the request of the intended parents if yes please explain', ['lifestyleChanges', 'lifestyleChangesDetails']],
  ['are you open to pumping colostrum and breast milk for your ip if they were to request this', ['pumpBreastmilk']],
  ['describe ideal intended parent s for whom you would like to be a surrogate', ['idealIPs']],
  ['what is the best form of communication that you are comfortable using', ['preferredCommunication']],
  ['how much involvement from the intended parents do you want during the pregnancy', ['ipInvolvement']],
  ['would you be willing to have the intended parents at doctor appointments and in delivery room please explain', ['ipsAtAppointments', 'ipsAtAppointmentsDetails']],
  ['is there anyone else you would like to have in the delivery room partner spouse friend mom', ['deliveryRoomOthers']],
  ['how do you feel about having intended parents who cannot attend doctor appointments and see you on a regular basis', ['ipsCantAttend']],
  ['are you willing to match with intended parents who already have children', ['ipsWithChildren']],
  ['are you open to matching with lgbtq individual couples', ['openLGBTQ']],
  ['are you willing to match with a single intended parent', ['openSingleIP']],
  ['are you willing to have the embryo transfer in another state', ['transferAnotherState']],
  ['are you willing to match with intended parents who live outside of the u s', ['ipsOutsideUS']],
  ['who will care for your child ren when you need to travel for surrogacy', ['childCareTraveling']],
  ['when are you ready to begin', ['whenReadyToBegin']],
  ['ideal relationship with intended parent s post birth', ['postBirthRelationship']],
  ['if recommended by a physician would you be willing to undergo cvs amniocentesis or other diagnostic testing please explain', ['cvsAmnio', 'cvsAmnioDetails']],
  ['willingness to terminate for a serious genetic or medical condition and follow ip s direction and doctor recommendation', ['willingnessToTerminate']],
  ['would your partner agree and support the decision for termination', ['partnerAgreesTermination']],
  ['are there any specific conditions where you would not terminate a pregnancy please explain', ['conditionsWontTerminate']],
  ['how many embryos are you in agreement to transfer at a time', ['embryosToTransfer']],
  ['if you only prefer to transfer 1 embryo and the embryo splits would you be in agreement to carry twins', ['carryTwins']],
  ['surrogate base fee', ['desiredCompensation']],
  ['as an experienced surrogate what is your desired base compensation', ['desiredCompensation']],
  ['is this negotiable', ['compensationNegotiable']],
  ['what would you like to add or say to potential intended parent s who are considering working with you as their surrogate', ['additionalComments']],
])

const SKIP = new Set([
  'do you have a real id',
  'do you have a current valid passport',
  'do you or anyone in your household speak a language other than english',
  'what is your ethnic origin ancestry',
  'what is your current religious affiliation if you have one',
  'do you consider yourself to be either religious or spiritual',
  'how important is religion to you',
  'if the intended parents had a different religious belief system than yours would this create a problem please kindly share your thoughts and describe why',
  'blood type',
  'have you received the covid 19 vaccination',
  'are you willing to receive the vaccination if recommended by the fertility doctor ob or if your intended parents request this',
  'have you had covid 19 before',
  'have you received the booster',
  'are you comfortable getting this if requested',
])

for (const [question, keys] of [
  ['weight', ['weight']],
  ['do you currently have any medical problems or conditions we should be made aware of if yes please explain', ['medicalConditions', 'medicalConditionDetails']],
  ['when did you have your last annual physical done what were the results', ['lastPhysical']],
  ['when was your last pap what were the results', ['lastPap']],
  ['have you ever had surgery performed or been hospitalized overnight for any reason within the past 5 years please list surgery and year', ['surgeries']],
  ['if required for the surrogacy process are you open to being vaccinated i e hep b flu varicella etc if no please share your reasons', ['openToVaccinations']],
  ['do you currently have any allergies if yes please explain', ['allergies', 'allergyDetails']],
  ['current medications and supplements', ['currentMeds']],
  ['what specifically is your occupation position and your duties responsibilities', ['occupation']],
  ['what is your approximate weekly income paystubs will be necessary to verify when matched with intended parents', ['weeklyIncome']],
  ['if in a relationship what is your spouse partner s occupation', ['partnerOccupation']],
  ['if in a relationship what is your spouse partner s approximate weekly income', ['partnerWeeklyIncome']],
  ['do you have health insurance coverage if yes please provide name of provider i e kaiser blue cross or other', ['healthInsurance']],
  ['what s your favorite type of music', ['favoriteMusic']],
  ['what s your favorite movie', ['favoriteMovie']],
  ['what s your favorite book', ['favoriteBook']],
  ['what are your favorite foods', ['favoriteFoods']],
  ['what s your favorite color', ['favoriteColor']],
  ['what s your favorite flower', ['favoriteFlower']],
  ['do you have any pets including chickens and livestock if yes what kinds', ['pets']],
  ['do you have any hobbies', ['hobbies']],
  ['have you ever been a surrogate before', ['previousSurrogate']],
  ['why do you want to become a surrogate or be a repeat surrogate and how long have you been thinking about it please be specific with your answer', ['reasonForSurrogacy']],
  ['being a surrogate involves an extensive time commitment which typically includes fertility medication extensive testing pregnancy and childbirth and possible surgical procedures please explain how you see surrogacy fitting into your life', ['surrogacyFit']],
  ['there is a time commitment with this process who will be your resource to help with your children for appointments possible bed rest etc please provide specific details on your support system', ['supportSystem']],
  ['are you willing to reduce the amount of caffeine and soda you consume during the pregnancy coffee tea etc', ['reduceCaffeine']],
  ['are you open to making other lifestyle changes at the request of the intended parents please explain', ['lifestyleChanges', 'lifestyleChangesDetails']],
  ['what is the best form of communication that you are comfortable using where you can be reliable and consistent i e text email facetime', ['preferredCommunication']],
  ['would you be willing to have the intended parents at doctor appointments and in delivery room if not please explain', ['ipsAtAppointments', 'ipsAtAppointmentsDetails']],
  ['is there anyone else you would like to have in the delivery room such as your partner spouse friend mom', ['deliveryRoomOthers']],
  ['are you willing to give birth in another state', ['transferAnotherState']],
  ['who will care for your child ren if you need to travel for surrogacy please explain', ['childCareTraveling']],
  ['when are you ready to begin is there anything that would interfere with this start date i e upcoming trip family obligation', ['whenReadyToBegin']],
  ['ideally what kind of relationship would you like with the intended parents after the birth of the child ren', ['postBirthRelationship']],
  ['if recommended by a physician would you be willing to undergo cvs amniocentesis or other diagnostic testing to determine the presence of birth defects please explain', ['cvsAmnio', 'cvsAmnioDetails']],
  ['if it is determined that the the fetus you are carrying for the ips has a serious genetic or medical condition and the intended parents requested to terminate the pregnancy with the doctor s recommendation would you be willing to terminate the pregnancy please explain', ['willingnessToTerminate']],
  ['if you are in a relationship would your partner agree and support the decision for termination', ['partnerAgreesTermination']],
  ['are there any specific conditions in which you would not terminate a pregnancy please explain', ['conditionsWontTerminate']],
  ['how many embryos are you in agreement to transfer at a time 1 or 2 or doctor recommendation', ['embryosToTransfer']],
  ['what would you like to add or say to potential intended parent s who are considering working with you as their surrogate to help them get to know you better or reassure them', ['additionalComments']],
  ['how many times', ['surrogacyTimes']],
]) {
  EXACT.set(question, keys)
}

function normalizeQuestion(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeYesNo(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return ''
  if (['yes', 'y', 'true'].includes(normalized)) return 'yes'
  if (['no', 'n', 'false'].includes(normalized)) return 'no'
  return null
}

function splitYesNoDetails(value) {
  const yesNo = normalizeYesNo(value)
  if (yesNo) return { yesNo, details: '' }
  if (!String(value || '').trim()) return { yesNo: '', details: '' }
  return { yesNo: 'yes', details: String(value).trim() }
}

function normalizeDate(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!match) return raw
  let [, month, day, year] = match
  if (year.length === 2) year = Number(year) > 40 ? `19${year}` : `20${year}`
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function normalizeFieldValue(key, value) {
  if (YESNO_KEYS.has(key)) {
    const yesNo = normalizeYesNo(value)
    if (yesNo) return yesNo
  }
  if (DATE_KEYS.has(key)) return normalizeDate(value)
  if (key === 'weight') {
    const match = String(value || '').match(/\d+/)
    return match ? match[0] : value
  }
  if (key === 'state') {
    const cleaned = String(value || '').replace(/\(.+\)/, '').trim()
    const upper = cleaned.toUpperCase()
    return STATE_ABBREVS[upper] || cleaned
  }
  return value
}

function setProfile(profile, key, value) {
  if (value === undefined || value === null || String(value).trim() === '') return false
  const section = SECTION_BY_KEY[key]
  if (!section) return false
  profile[section] = profile[section] || {}
  if (key === 'householdMembers') {
    profile[section][key] = [{ name: String(value).trim(), relationship: 'Other' }]
    return true
  }
  profile[section][key] = String(normalizeFieldValue(key, value)).trim()
  return true
}

function setMapped(profile, keys, answer) {
  if (!keys?.length) return 0
  if (keys.length === 1) return setProfile(profile, keys[0], answer) ? 1 : 0

  const { yesNo, details } = splitYesNoDetails(answer)
  let count = 0
  if (yesNo) count += setProfile(profile, keys[0], yesNo) ? 1 : 0
  if (details) count += setProfile(profile, keys[1], details) ? 1 : 0
  return count
}

function importRows(rows) {
  const profile = {}
  const skipped = []
  const imported = []

  for (const [questionRaw, answerRaw] of rows) {
    const question = String(questionRaw || '').trim()
    const answer = String(answerRaw || '').trim()
    if (!question || !answer) continue

    const normalized = normalizeQuestion(question)
    if (normalized === 'city state') {
      const [city, ...stateParts] = answer.split(',')
      if (city?.trim()) {
        setProfile(profile, 'city', city)
        imported.push({ question, keys: ['city'] })
      }
      if (stateParts.join(',').trim()) {
        setProfile(profile, 'state', stateParts.join(',').replace(/\(.+\)/, '').trim())
        imported.push({ question, keys: ['state'] })
      }
      continue
    }
    if (normalized === 'height') {
      const match = answer.match(/(\d+)\s*(?:['"’,.]|,)?\s*(\d+)?/)
      if (match) {
        setProfile(profile, 'heightFt', match[1])
        if (match[2]) setProfile(profile, 'heightIn', match[2].replace(/\D/g, ''))
        imported.push({ question, keys: ['heightFt', 'heightIn'] })
      }
      continue
    }
    if (SKIP.has(normalized)) {
      skipped.push({ question, reason: 'field removed or not currently represented' })
      continue
    }
    const keys = EXACT.get(normalized)
    if (!keys) {
      skipped.push({ question, reason: 'no explicit mapping' })
      continue
    }
    const count = setMapped(profile, keys, answer)
    if (count > 0) imported.push({ question, keys })
  }

  if (profile.personal?.heightFt && profile.personal?.weight) {
    const ft = parseInt(profile.personal.heightFt) || 0
    const inch = parseInt(profile.personal.heightIn) || 0
    const weight = parseFloat(profile.personal.weight)
    const totalIn = ft * 12 + inch
    if (totalIn && weight) profile.personal.bmi = ((weight / (totalIn ** 2)) * 703).toFixed(1)
  }

  return { profile, imported, skipped }
}

const workbook = XLSX.readFile(file, { cellDates: true })
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }).slice(1)
const { profile, imported, skipped } = importRows(rows)

const { data: intakes, error: intakeError } = await supabase
  .from('intake_submissions')
  .select('id,intake_type,applicant_name,applicant_email,status,answers')
  .eq('applicant_email', email)
  .eq('intake_type', 'gc')
  .order('submitted_at', { ascending: false })
  .limit(1)

if (intakeError) throw intakeError
let intake = intakes?.[0]
if (!intake) {
  if (!createIntake) {
    console.error(`No surrogate intake found for ${email}`)
    console.error(`Hint: re-run with --create-intake to insert a minimal intake row from the xlsx data first.`)
    process.exit(1)
  }
  // Build a minimal intake row from what we already pulled out of the xlsx.
  const p = profile.personal || {}
  const householdStr = typeof p.householdMembers === 'string' ? p.householdMembers : ''
  const firstName = p.firstName || (intakeNameOverride.split(' ')[0] || '')
  // Try to parse the surrogate's last name from the household-members text
  // (e.g. "Steven Perrigo- husband. Luke Perrigo- son" → "Perrigo").
  const ln = householdStr.match(/\b\w+\s+(\w+)\s*-\s*(?:husband|son|daughter|wife|partner)/i)?.[1] || ''
  const finalLastName = intakeNameOverride.split(' ').slice(1).join(' ').trim() || ln || ''
  const display = [firstName, finalLastName].filter(Boolean).join(' ').trim() || email.split('@')[0]
  const intakeRow = {
    intake_type: 'gc',
    status: 'qualified',
    qualified: true,
    applicant_name: display,
    applicant_email: email,
    applicant_phone: '',
    answers: {
      firstName,
      lastName: finalLastName,
      email,
      dob: p.dob || '',
      city: p.city || '',
      state: p.state || '',
      heightFt: p.heightFt || '',
      heightIn: p.heightIn || '',
      weight: p.weight || '',
      maritalStatus: p.maritalStatus || '',
      _imported_from: file,
      _imported_at: new Date().toISOString(),
    },
    submitted_at: new Date().toISOString(),
    state_region: p.state || '',
    dq_reasons: [],
  }
  if (!apply) {
    console.log(`[dry] Would CREATE intake_submissions row:`)
    console.log(`      ${display} <${email}> · ${p.city || '?'}, ${p.state || '?'} · DOB ${p.dob || '?'}`)
    // Stub intake so the rest of the dry-run flow can show what profile data
    // would be merged. id is null on purpose — we never write in dry mode.
    intake = { id: null, applicant_name: display, applicant_email: email, intake_type: 'gc', status: 'qualified', answers: intakeRow.answers }
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from('intake_submissions')
      .insert(intakeRow)
      .select('id,intake_type,applicant_name,applicant_email,status,answers')
      .single()
    if (insertErr) {
      console.error('Failed to create intake row:', insertErr.message)
      process.exit(1)
    }
    intake = inserted
    console.log(`Created intake_submissions row id=${inserted.id} for ${display} <${email}>`)
  }
}

const { data: existingProfiles, error: profileError } = await supabase
  .from('surrogate_profiles')
  .select('id,profile_data')
  .eq('email', email)
  .order('updated_at', { ascending: false })
  .limit(1)

if (profileError) throw profileError

const existing = existingProfiles?.[0]
const existingData = existing?.profile_data || {}
const merged = { ...existingData }
for (const [section, values] of Object.entries(profile)) {
  merged[section] = { ...(merged[section] || {}), ...values }
}

const intakeAnswers = intake.answers || {}
merged.personal = merged.personal || {}
for (const [key, value] of Object.entries({
  firstName: intakeAnswers.firstName,
  dob: intakeAnswers.dob,
  city: intakeAnswers.city,
  state: intakeAnswers.state,
  heightFt: intakeAnswers.heightFt,
  heightIn: intakeAnswers.heightIn,
  weight: intakeAnswers.weightLbs || intakeAnswers.weight,
})) {
  if ((merged.personal[key] === undefined || merged.personal[key] === null || merged.personal[key] === '') && value) {
    merged.personal[key] = String(normalizeFieldValue(key, value)).trim()
  }
}
if (!merged.personal.bmi && merged.personal.heightFt && merged.personal.weight) {
  const ft = parseInt(merged.personal.heightFt) || 0
  const inch = parseInt(merged.personal.heightIn) || 0
  const weight = parseFloat(merged.personal.weight)
  const totalIn = ft * 12 + inch
  if (totalIn && weight) merged.personal.bmi = ((weight / (totalIn ** 2)) * 703).toFixed(1)
}

const summary = {
  mode: apply ? 'apply' : 'dry-run',
  intake: { id: intake.id, name: intake.applicant_name, email: intake.applicant_email, status: intake.status },
  existingProfileId: existing?.id || null,
  importedFieldCount: imported.reduce((sum, row) => sum + row.keys.length, 0),
  importedQuestionCount: imported.length,
  skippedQuestionCount: skipped.length,
  sections: Object.fromEntries(Object.entries(profile).map(([section, values]) => [section, Object.keys(values).length])),
  skipped: skipped.slice(0, 80),
}

console.log(JSON.stringify(summary, null, 2))

if (!apply) {
  console.log('\nDry run only. Re-run with --apply to write surrogate_profiles.')
  process.exit(0)
}

let writeResult
if (existing?.id) {
  writeResult = await supabase
    .from('surrogate_profiles')
    .update({ profile_data: merged, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
    .select('id,email,updated_at')
    .single()
} else {
  writeResult = await supabase
    .from('surrogate_profiles')
    .insert({ email, profile_data: merged, updated_at: new Date().toISOString() })
    .select('id,email,updated_at')
    .single()
}

if (writeResult.error) throw writeResult.error
console.log('\nImported profile:')
console.log(JSON.stringify(writeResult.data, null, 2))

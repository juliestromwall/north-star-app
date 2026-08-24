import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { supabase } from './supabase'
import { adminUpdateSurrogateProfile, fetchSurrogateProfileByEmail, uploadCaseDocument } from './db'

let pdfjsPromise = null

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then(pdfjsLib => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      return pdfjsLib
    })
  }
  return pdfjsPromise
}

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

function normalizeWhitespace(value) {
  return String(value || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function normalizeLabel(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function normalizeYesNo(value) {
  const v = String(value || '').trim().toLowerCase()
  if (/^yes\b/.test(v)) return 'yes'
  if (/^no\b|^nope\b/.test(v)) return 'no'
  if (['yes', 'y', 'true'].includes(v)) return 'yes'
  if (['no', 'n', 'false', 'none'].includes(v)) return 'no'
  return value || ''
}

function normalizeDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return raw
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  const ten = digits.length > 10 && digits.startsWith('1') ? digits.slice(1) : digits
  if (ten.length !== 10) return String(value || '').trim()
  return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`
}

function normalizeState(value) {
  const raw = String(value || '').replace(/\(.+\)/, '').trim()
  const upper = raw.toUpperCase()
  return STATE_ABBREVS[upper] || raw
}

function parseHeight(value) {
  const raw = String(value || '').trim()
  const feetInches = raw.match(/(\d+)\s*feet?\s*(\d+)?\s*inches?/i)
  if (feetInches) return { heightFt: feetInches[1], heightIn: feetInches[2] || '0' }
  const match = raw.match(/(\d+)\s*(?:['"'.]|,)?\s*(\d+)?/)
  if (!match) return {}
  return { heightFt: match[1], heightIn: match[2] || '0' }
}

function firstLine(value) {
  return String(value || '').split(/\n/).map(v => v.trim()).find(Boolean) || ''
}

function cleanBeValue(value) {
  return cleanText(value)
    .split(/\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^Surrogate Flags$/i.test(line))
    .filter(line => !/^Surrogate Follow Up Q&A$/i.test(line))
    .join('\n')
    .replace(/\bSc\s+hool\b/gi, 'School')
    .replace(/\bGE\s+D\b/gi, 'GED')
    .trim()
}

function beAnswer(value) {
  return cleanBeValue(value)
    .split(/\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^NOTE:/i.test(line))
    .pop() || ''
}

function last4(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.slice(-4)
}

function parseCityStateZip(value) {
  const raw = String(value || '').trim()
  const match = raw.match(/^(.+?),\s*([A-Za-z]{2}|[A-Za-z ]+)\s+(\d{5}(?:-\d{4})?)$/)
  if (!match) return { city: '', state: '', zipCode: '' }
  return { city: match[1].trim(), state: normalizeState(match[2]), zipCode: match[3] }
}

function sliceBetween(text, startPattern, endPattern) {
  const start = text.search(startPattern)
  if (start === -1) return ''
  const rest = text.slice(start)
  if (!endPattern) return rest
  const end = rest.slice(1).search(endPattern)
  return end === -1 ? rest : rest.slice(0, end + 1)
}

function merge(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (value !== undefined && value !== null && String(value).trim() !== '') target[key] = value
  }
}

function cleanText(text) {
  return String(text || '')
    .replace(/\f/g, '\n')
    .replace(/Page \d+ of \d+/g, '')
    .replace(/\bSurrogate\s+\d+\s*\|\s*Pg\s+\d+\s+of\s+\d+\b/gi, '')
    .replace(/\bSurrogate Photos\b/gi, '')
    .replace(/\n{3,}/g, '\n\n')
}

function textLines(text) {
  return cleanText(text)
    .split(/\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => !/^First Star Surrogacy\.$/i.test(l))
    .filter(l => !/^Los Angeles,/i.test(l))
    .filter(l => !/^Phone:/i.test(l))
    .filter(l => !/^Fax:/i.test(l))
    .filter(l => !/^https:\/\/www\.abcsurrogacy\.com\/?$/i.test(l))
}

function labelMatchAt(lines, index, label) {
  const target = normalizeLabel(label)
  let combined = ''
  for (let j = index; j < Math.min(lines.length, index + 4); j++) {
    combined = normalizeLabel(`${combined} ${lines[j]}`)
    if (combined === target) return { lineCount: j - index + 1, inlineValue: '' }
    if (combined.startsWith(`${target} `)) {
      return {
        lineCount: j - index + 1,
        inlineValue: lines[j].slice(lines[j].toLowerCase().indexOf(label.toLowerCase()) + label.length).trim(),
      }
    }
    if (target.startsWith(combined)) continue
    break
  }
  return null
}

function findLabels(lines, labels) {
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    for (const label of labels) {
      const match = labelMatchAt(lines, i, label)
      if (match) hits.push({ label, start: i, end: i + match.lineCount, inlineValue: match.inlineValue })
    }
  }
  return hits.sort((a, b) => a.start - b.start || b.end - a.end)
}

function valueAfter(text, label, labels) {
  const lines = textLines(text)
  const hits = findLabels(lines, labels)
  const hit = hits.find(h => h.label === label)
  if (!hit) return ''
  if (hit.inlineValue) return hit.inlineValue
  const next = hits.find(h => h.start >= hit.end && h.label !== label)
  return normalizeWhitespace(lines.slice(hit.end, next?.start ?? lines.length).join('\n'))
}

function extractByLabels(text, labels) {
  const out = {}
  for (const label of labels) out[label] = valueAfter(text, label, labels)
  return out
}

function detectSection(text) {
  if (/Surrogate Application - For Office Use Only/i.test(text) || /Admin Surrogate \d+ Profile - For Office Use Only/i.test(text)) return 'beProfile'
  if (/CLINIC & HOSPITAL FORM/i.test(text)) return 'clinicHospital'
  if (/CONFIDENTIAL PERSONAL INFORMATION/i.test(text)) return 'confidential'
  if (/Reference #1 - Family Member/i.test(text)) return 'references'
  if (/Employment Information/i.test(text)) return 'employment'
  if (/Basic Information/i.test(text)) return 'application'
  if (/Become A Surrogate/i.test(text)) return 'intake'
  return 'unknown'
}

function parseIntake(text) {
  const labels = [
    'First Name', 'Last Name', 'Date of Birth', 'State', 'Phone Number', 'E-mail',
    'Communication is a really important part of surrogacy. What is the best form of communication, where you can respond within 24 to 48 hours? (i.e. text, email, phone call)?',
    'Height', 'Weight', 'BMI',
    'Have you had a healthy pregnancy (ies) (no more than 5 vaginal or 2 c-sections)?',
    'How did you hear about First Star Surrogacy (ABC)?',
  ]
  const v = extractByLabels(text, labels)
  const height = parseHeight(v.Height)
  return {
    firstName: v['First Name'],
    lastName: v['Last Name'],
    dob: normalizeDate(v['Date of Birth']),
    state: normalizeState(v.State),
    phone: normalizePhone(v['Phone Number']),
    email: String(v['E-mail'] || '').trim().toLowerCase(),
    preferredContact: v[labels[6]],
    heightFt: height.heightFt,
    heightIn: height.heightIn,
    weightLbs: v.Weight?.replace(/[^\d.]/g, ''),
    healthyPregnancy: normalizeYesNo(v['Have you had a healthy pregnancy (ies) (no more than 5 vaginal or 2 c-sections)?']),
    hearAboutUs: v['How did you hear about First Star Surrogacy (ABC)?'],
  }
}

function parseApplication(text, intakeAnswers) {
  const labels = [
    'First name ONLY or nickname', 'Country', 'Street Address', 'City', 'State', 'Zip Code',
    'Date of birth', 'Height', 'Weight', 'BMI',
    'Are you a U.S. Citizen or Permanent Resident?',
    'Do you (or anyone in your household) speak a language other than English? If so, what language?',
    'Relationship Status', 'Do you have a spouse/partner?',
    'Are you currently in a monogamous (meaning one partner) relationship?',
    'How many sexual partners have you had in the past 6 months?',
    'If married or otherwise in a relationship, how long have you been together?',
    "Spouse/partner's first name", "Spouse/partner's last name",
    "Spouse/partner's e-mail address (must be different than yours)", "Spouse/Partner's Date of Birth",
  ]
  const v = extractByLabels(text, labels)
  const height = parseHeight(v.Height)
  return {
    _application: {
      fullLegalName: [intakeAnswers.firstName, intakeAnswers.lastName].filter(Boolean).join(' '),
      dob: normalizeDate(v['Date of birth']),
      street: v['Street Address'],
      city: v.City,
      state: normalizeState(v.State),
      zipCode: v['Zip Code'],
      hasSpouse: normalizeYesNo(v['Do you have a spouse/partner?']),
      spouseFirstName: v["Spouse/partner's first name"],
      spouseLastName: v["Spouse/partner's last name"],
      spouseEmail: String(v["Spouse/partner's e-mail address (must be different than yours)"] || '').trim().toLowerCase(),
      spouseDob: normalizeDate(v["Spouse/Partner's Date of Birth"]),
    },
    profilePersonal: {
      firstName: v['First name ONLY or nickname'],
      dob: normalizeDate(v['Date of birth']),
      city: v.City,
      state: normalizeState(v.State),
      heightFt: height.heightFt,
      heightIn: height.heightIn,
      weight: v.Weight?.replace(/[^\d.]/g, ''),
      usCitizen: normalizeYesNo(v['Are you a U.S. Citizen or Permanent Resident?']),
      maritalStatus: v['Relationship Status'],
      monogamous: normalizeYesNo(v['Are you currently in a monogamous (meaning one partner) relationship?']),
      sexualPartners: v['How many sexual partners have you had in the past 6 months?'],
      relationshipLength: v['If married or otherwise in a relationship, how long have you been together?'],
      partnerName: v["Spouse/partner's first name"],
      partnerDob: normalizeDate(v["Spouse/Partner's Date of Birth"]),
    },
  }
}

function parseConfidential(text) {
  const labels = [
    'Full Legal Name:', 'Maiden Last Name, if different:', 'Street Address:', 'City, State, Zip Code:',
    'How long have you lived at current address?', 'Own/ Rent:', 'Home Phone:',
    'Can confidential messages be left on your home answering machine?', 'Work Phone:',
    'May I speak freely when leaving messages at work?', 'Mobile Phone Number:',
    'Can confidential messages be left on your mobile phone voicemail?', 'E-mail address:',
    'Is your e-mail address confidential?', 'Social Security Number:', 'US Citizen:',
    'Driver’s License Number:', 'Driver’s License State:', 'Driver’s License Expiration Date:',
    'Your Age:', 'Date of Birth:', 'Height:', 'Weight:', 'Place of Birth:', 'Religion:',
    'Medical Insurance',
  ]
  const v = extractByLabels(text, labels)
  const spouseBlock = sliceBetween(text, /Spouse's Information/i, /Emergency Contact/i)
  const spouseLabels = [
    'Full legal name:', 'Length of relationship:', 'US Citizen:', 'Driver’s License Number:',
    'Driver’s License State:', 'Driver’s License Expiration Date:', 'Date of Birth:', 'Home Phone:',
    'Work Phone:', 'Cell Phone:', 'Social Security Number:',
  ]
  const spouse = extractByLabels(spouseBlock, spouseLabels)
  const emergencyBlock = sliceBetween(text, /Emergency Contact/i, /Acknowledgement/i)
  const emergency = extractByLabels(emergencyBlock, ['Name:', 'Home Phone:', 'Cell Phone:'])
  const cityStateZip = parseCityStateZip(v['City, State, Zip Code:'])
  const height = parseHeight(v.Height)
  const hasSpouseRaw = valueAfter(text, 'Do you have a spouse / partner?', ['Do you have a spouse / partner?', "Spouse's Information"])
  const spouseNames = String(spouse['Full legal name:'] || '').trim().split(/\s+/)

  return {
    _application: {
      fullLegalName: v['Full Legal Name:'],
      maidenName: v['Maiden Last Name, if different:'],
      dob: normalizeDate(v['Date of Birth:']),
      ssn4: last4(v['Social Security Number:']),
      religion: v['Religion:'],
      street: v['Street Address:'],
      city: cityStateZip.city,
      state: cityStateZip.state,
      zipCode: cityStateZip.zipCode,
      hasSpouse: hasSpouseRaw ? 'yes' : '',
      spouseFirstName: spouseNames[0] || '',
      spouseLastName: spouseNames.slice(1).join(' '),
      spouseDob: normalizeDate(spouse['Date of Birth:']),
      spousePhone: normalizePhone(spouse['Cell Phone:'] || spouse['Home Phone:']),
      emergencyName: emergency['Name:'],
      emergencyPhone: normalizePhone(emergency['Cell Phone:'] || emergency['Home Phone:']),
      emergencyRelationship: emergency['Name:'] ? 'Emergency contact' : '',
    },
    _confidential: {
      fullLegalName: v['Full Legal Name:'],
      maidenName: v['Maiden Last Name, if different:'],
      dob: normalizeDate(v['Date of Birth:']),
      ssn4: last4(v['Social Security Number:']),
      driversLicense: v['Driver’s License Number:'],
      religion: v['Religion:'],
      hasInsurance: '',
      hasSpouse: hasSpouseRaw ? 'yes' : '',
      spouseFullName: spouse['Full legal name:'],
      spousePhone: normalizePhone(spouse['Cell Phone:'] || spouse['Home Phone:']),
      emergencyName: emergency['Name:'],
      emergencyPhone: normalizePhone(emergency['Cell Phone:'] || emergency['Home Phone:']),
      emergencyRelationship: emergency['Name:'] ? 'Emergency contact' : '',
    },
    profilePersonal: {
      dob: normalizeDate(v['Date of Birth:']),
      city: cityStateZip.city,
      state: cityStateZip.state,
      heightFt: height.heightFt,
      heightIn: height.heightIn,
      weight: v.Weight?.replace(/[^\d.]/g, ''),
      usCitizen: normalizeYesNo(v['US Citizen:']),
      partnerName: spouse['Full legal name:']?.split(/\s+/)[0] || '',
      partnerDob: normalizeDate(spouse['Date of Birth:']),
      relationshipLength: spouse['Length of relationship:'],
    },
  }
}

function parseEmployment(text) {
  const labels = [
    'Are you currently employed?',
    'Please share details on the industry you work in.',
    'How many hours a week do you work, and what are your typical hours?',
    'What specifically is your occupation/position and your duties/responsibilities?',
    'How long have you worked for your current employer?',
    'What is your earned hourly rate?',
    'What is your approximate weekly income? (Paystubs will be necessary to verify when matched with Intended Parents)',
    'Spouse/Partner',
    "What is your spouse/partner's occupation?",
    "If in a relationship, what is your spouse/partner's approximate weekly income?",
    'Do you have health insurance coverage? If yes, please provide name of provider (i.e Kaiser, Blue Cross or other)',
    'Is it a private/personal policy or through you or your spouse’s employer?',
    'Do you receive any government assistance (WIC, food stamps)? If yes, please explain.',
  ]
  const v = extractByLabels(text, labels)
  return {
    employment: {
      currentlyEmployed: normalizeYesNo(v['Are you currently employed?']),
      employmentIndustry: v['Please share details on the industry you work in.'],
      workHours: v['How many hours a week do you work, and what are your typical hours?'],
      occupation: v['What specifically is your occupation/position and your duties/responsibilities?'],
      lengthAtEmployer: v['How long have you worked for your current employer?'],
      hourlyRate: v['What is your earned hourly rate?'],
      weeklyIncome: v['What is your approximate weekly income? (Paystubs will be necessary to verify when matched with Intended Parents)'],
      partnerOccupation: v["What is your spouse/partner's occupation?"],
      partnerWeeklyIncome: v["If in a relationship, what is your spouse/partner's approximate weekly income?"],
      healthInsurance: normalizeYesNo(v['Do you have health insurance coverage? If yes, please provide name of provider (i.e Kaiser, Blue Cross or other)']),
      insuranceType: v['Is it a private/personal policy or through you or your spouse’s employer?'],
      governmentAssistance: v['Do you receive any government assistance (WIC, food stamps)? If yes, please explain.'] ? 'yes' : '',
      governmentAssistanceDetails: v['Do you receive any government assistance (WIC, food stamps)? If yes, please explain.'],
    },
  }
}

function parseReferences(text) {
  const refs = {}
  const labels = ['Name:', 'Phone Number:', 'Email Address:', 'City, State:']
  const lines = textLines(text)
  for (let i = 0; i < lines.length; i++) {
    const refMatch = lines[i].match(/^Reference #(\d+)/i)
    if (!refMatch) continue
    const current = `ref${Number(refMatch[1])}`
    const end = lines.findIndex((candidate, idx) => idx > i && /^Reference #\d+/i.test(candidate))
    const block = lines.slice(i + 1, end === -1 ? lines.length : end).join('\n')
    const values = extractByLabels(block, labels)
    refs[`${current}_name`] = values['Name:']
    refs[`${current}_phone`] = normalizePhone(values['Phone Number:'])
    refs[`${current}_email`] = String(values['Email Address:'] || '').trim().toLowerCase()
    refs[`${current}_cityState`] = values['City, State:']
  }
  return { _references: refs }
}

function parseClinicHospital(text) {
  const labels = [
    'Name & location of your current OB/GYN or primary care physician',
    'Are you an experienced surrogate?',
    'For each pregnancy, please provide the names and locations for each clinic and hospital you received care.',
  ]
  const v = extractByLabels(text, labels)
  const pregnancies = []
  const lines = textLines(text)
  const deliveryIndexes = lines
    .map((line, idx) => ({ line, idx }))
    .filter(item => /^Delivery #\d+ Birth Date:/i.test(item.line))

  const pregLabels = ['OB Clinic name:', 'Address:', 'Hospital name:', 'Hospital Address:', 'Notes:', 'Add another delivery?']
  for (let i = 0; i < deliveryIndexes.length; i++) {
    const current = deliveryIndexes[i]
    const next = deliveryIndexes[i + 1]?.idx ?? lines.length
    const blockLines = lines.slice(current.idx, next)
    const nextLabelIdx = blockLines.findIndex((line, idx) => idx > 0 && pregLabels.some(label => normalizeLabel(line) === normalizeLabel(label)))
    const date = normalizeWhitespace(blockLines.slice(1, nextLabelIdx === -1 ? 2 : nextLabelIdx).join('\n'))
    const block = blockLines.join('\n')
    const values = extractByLabels(block, pregLabels)
    pregnancies.push({
      date: normalizeDate(date),
      outcome: 'Live Birth',
      receivedPrenatalCare: 'yes',
      wasSurrogacy: '',
      obClinicName: values['OB Clinic name:'],
      obDoctorName: '',
      obPhone: '',
      obAddress: values['Address:'],
      hospitalName: values['Hospital name:'],
      hospitalPhone: '',
      hospitalAddress: values['Hospital Address:'],
      sawMFM: '',
      mfmClinicName: '',
      mfmDoctorName: '',
      mfmPhone: '',
      mfmAddress: '',
      wasIVF: '',
      ivfClinicName: '',
      ivfDoctorName: '',
      ivfPhone: '',
      ivfAddress: '',
    })
  }

  return {
    _clinicHospital: {
      currentOBGYN: v['Name & location of your current OB/GYN or primary care physician'],
      currentOBPhone: '',
      currentOBAddress: '',
      experiencedSurrogate: normalizeYesNo(v['Are you an experienced surrogate?']),
      numberOfPregnancies: pregnancies.length ? String(pregnancies.length) : '',
      pregnancies,
    },
  }
}

function parseBeSurrogacyProfile(text) {
  const labels = [
    'Surrogate ID:', 'Name:', 'Phone #:', 'Email:', 'Age:', 'Height:', 'Weight:', 'Education:', 'Location:',
    'Prescreen Submitted On:', 'Full Questionnaire Submitted On:',
    "What's your first name?", "What's your last name?", 'What state do you live in?', 'What is your address?',
    'What is your current living situation?', 'How long have you been at your current residence?',
    'Phone number, so we can stay in touch?', 'Do you consent to receiving text messages from us?',
    "What's your date of birth?", 'What is your height?', 'What is your weight?',
    'What ethnicity/race best describes you (select all that may apply).', 'What is your citizenship status?',
    'Have you had at least one healthy, full term pregnancy and delivery?', 'What is the highest level of education you have completed?',
    'Are you currently employed?', 'Please provide the following information on your current employment.',
    'Do you have a valid driver\'s license?', 'Are you registered with an American Indian Tribe?',
    'Do you have a spouse or a partner?', 'If you have a spouse/partner, what is their full name?',
    'If you have a spouse/partner, what is their date of birth?',
    'If you have a spouse or partner, is your spouse/partner registered with an American Indian Tribe?',
    'Will your spouse/partner pass a criminal background check?', 'Which statement best describes your current relationship status?',
    'Will you pass a criminal background check?', 'Have you ever been arrested?',
    'Have you ever been convicted of any of the following (check all that may apply)',
    'Do you currently receive any of the following types of support or assistance (select all that may apply)?',
    'Do you have a solid support system to help you during a pregnancy, including childcare, transportation, emotional support, etc.?',
    'Do you live in a stable home environment and have a work schedule that would allow you to attend doctor\'s appointments during the week?',
    'Please describe your current household as it relates to raising your child(ren).',
    'Let’s hear it sister, how many healthy, live babies have you given birth to?',
    'Please provide the following information on each live birth.',
    'Have any of your pregnancies delivered at 36 weeks or less?', 'Have you ever been diagnosed with Gestational Diabetes?',
    'Not to make you feel stressed, but were there any miscarriages or abortions?', 'Have you ever had a C-section?',
    'What is the date of your most recent delivery?', 'Please indicate any of the following conditions you may be experiencing, or have experienced in the past (select all that may apply).',
    'Are you currently breastfeeding?', 'If you are currently breastfeeding, when do you plan on stopping?',
    'What is your current method of Birth Control?', 'What is the start date of your most recent menstrual cycle (LMP)?',
    'What was the date of your most recent PAP smear screening?', 'Did your last PAP smear results come back normal PAP?',
    'Have you ever applied to be a surrogate before?', 'What is the date of your last Annual Physical exam?',
    'What is your status regarding the COVID vaccine?', 'Do you get your annual flu shot?',
    'Are you up to date on all other vaccinations (TDAP, MMR, Varicella)?',
    'Please tell us about the status of your health insurance/medical coverage.',
    'Have you ever used any recreational drugs? (Yes, marijuana counts – remember it is not legal everywhere, yet!)',
    'Have you ever used tobacco products, including vape products?', 'Do you consume alcohol?',
    'Have you ever been diagnosed or treated for any mental health condition?',
    'Now Girl, no judgement at all BUT we want to make sure, have you ever been diagnosed with any of the following conditions (please select all that may apply)?',
    'Please list any prescription medication you are taking for mental health conditions (or indicate "N/A").',
    'Did you ever take any ANXIETY OR DEPRESSIONS medications WHILE you were pregnant?',
    'Have you ever been diagnosed with any of the following medical conditions (please select all that may apply)?',
    'In the last 12 months, please list all prescription medication you are taking or have taken for medical conditions (or indicate "N/A").',
    'In the last 12 months, please list all over-the-counter medication you are taking, or have taken, including supplements & vitamins (or indicate "N/A").',
    'Does your spouse/partner use tobacco products or recreational drugs?',
    'What type of Intended Parent(s) are you open to working with during your surrogacy journey? Please select all that apply.',
    'What areas of surrogacy do you have the most questions about, if any (please select all that may apply)?',
    'If you pass the pre-screening process, how soon are you available to start a surrogacy journey?',
    'Are you willing to carry multiples (twins/triplets)?',
    'Are you willing to have selective reduction (reduce triplets to twins or singleton pregnancy IF one of the babies shows signs of no viability)?',
    'Are you willing to terminate the pregnancy at the Intended Parent(s) request due to huge genetic, chromosomal, or developmental abnormalities discovered that would affect the babies viability or compatibility with life?',
    'Will you agree to terminate the pregnancy due to diagnosis of Down Syndrome if requested by IPs or doctors?',
    'Are you willing to terminate for severe, but surgically correctable, abnormalities (i.e. heart defects)?',
    'Are you willing to have an amniocentesis or CVS testing if requested by your doctor?', 'How did you hear about us?',
  ]
  const v = extractByLabels(text, labels)
  const header = extractByLabels(text, labels.slice(0, 11))
  const height = parseHeight(firstLine(v['What is your height?'] || header['Height:']))
  const location = firstLine(header['Location:'])
  const [cityFromLocation, stateFromLocation] = location.includes(',') ? location.split(',').map(s => s.trim()) : ['', '']
  const firstName = firstLine(v["What's your first name?"]) || firstLine(header['Name:']).split(/\s+/)[0] || ''
  const lastName = firstLine(v["What's your last name?"]) || firstLine(header['Name:']).split(/\s+/).slice(1).join(' ') || ''
  const addressLines = textLines(v['What is your address?'])
  const address = { street: '', city: '', zipCode: '' }
  for (const line of addressLines) {
    const streetMatch = line.match(/^Street\s+(.+)/i)
    const cityMatch = line.match(/^City\s+(.+)/i)
    const zipMatch = line.match(/^Zip Code\s+(.+)/i)
    if (streetMatch) address.street = streetMatch[1].trim()
    if (cityMatch) address.city = cityMatch[1].trim()
    if (zipMatch) address.zipCode = zipMatch[1].trim()
  }
  const employmentBlock = valueAfter(text, 'Please provide the following information on your current employment.', labels)
  const employer = firstLine(valueAfter(employmentBlock, 'Employer name:', ['Employer name:', 'Occupation:', 'Length of employment:', 'Annual income (salary or hourly):', 'Work status (full or part-time):', 'Please describe your job responsibilities:']))
  const occupation = firstLine(valueAfter(employmentBlock, 'Occupation:', ['Employer name:', 'Occupation:', 'Length of employment:', 'Annual income (salary or hourly):', 'Work status (full or part-time):', 'Please describe your job responsibilities:']))
  const lengthAtEmployer = firstLine(valueAfter(employmentBlock, 'Length of employment:', ['Employer name:', 'Occupation:', 'Length of employment:', 'Annual income (salary or hourly):', 'Work status (full or part-time):', 'Please describe your job responsibilities:']))
  const hourlyRate = firstLine(valueAfter(employmentBlock, 'Annual income (salary or hourly):', ['Employer name:', 'Occupation:', 'Length of employment:', 'Annual income (salary or hourly):', 'Work status (full or part-time):', 'Please describe your job responsibilities:']))
  const workStatus = firstLine(valueAfter(employmentBlock, 'Work status (full or part-time):', ['Employer name:', 'Occupation:', 'Length of employment:', 'Annual income (salary or hourly):', 'Work status (full or part-time):', 'Please describe your job responsibilities:']))
  const jobResponsibilities = firstLine(valueAfter(employmentBlock, 'Please describe your job responsibilities:', ['Employer name:', 'Occupation:', 'Length of employment:', 'Annual income (salary or hourly):', 'Work status (full or part-time):', 'Please describe your job responsibilities:']))

  const pregnancies = []
  const lines = textLines(text)
  for (const line of lines) {
    const match = line.match(/^Child\s+\d+\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d+)\s+(Singleton|Twins|Multiples|Triplets\+?)\s+(.+?)(?:\s+My biological|\s+Surrogate|$)/i)
    if (!match) continue
    pregnancies.push({
      outcome: 'Live Birth',
      wasSurrogacy: /surrogate/i.test(line) ? 'yes' : 'no',
      dob: normalizeDate(match[1]),
      gestationWeeks: match[2],
      gestationDays: '0',
      singleOrMultiples: /singleton/i.test(match[3]) ? 'Single' : match[3],
      weight: match[4].trim(),
      deliveryType: v['Have you ever had a C-section?'] === 'Yes' ? 'C-Section' : 'Vaginal',
    })
  }

  const assistance = cleanBeValue(v['Do you currently receive any of the following types of support or assistance (select all that may apply)?'])
  const assistanceItems = assistance.split(/\n/).map(line => line.trim()).filter(Boolean)
  const assistanceDetails = /Medicaid/i.test(assistance)
    ? 'Medicaid'
    : assistanceItems.filter(line => !/none of the above/i.test(line)).join('\n')
  const healthInsurance = cleanBeValue(v['Please tell us about the status of your health insurance/medical coverage.'])
  const intendedParents = cleanBeValue(v['What type of Intended Parent(s) are you open to working with during your surrogacy journey? Please select all that apply.'])
  const diseaseHistory = beAnswer(v['Have you ever been diagnosed with any of the following medical conditions (please select all that may apply)?'])
  const mentalConditions = beAnswer(v['Now Girl, no judgement at all BUT we want to make sure, have you ever been diagnosed with any of the following conditions (please select all that may apply)?'])
  const spouseFullName = firstLine(v['If you have a spouse/partner, what is their full name?'])
  const spouseNames = spouseFullName.split(/\s+/)
  const hasSpouse = normalizeYesNo(v['Do you have a spouse or a partner?'])
  const healthInsuranceText = healthInsurance.replace(/\s+/g, ' ')
  const hasInsurance = /do not currently have health insurance/i.test(healthInsuranceText) ? 'no' : healthInsurance ? 'yes' : ''
  const insuranceType = hasInsurance === 'no' ? 'No current health insurance' : healthInsurance

  const profileData = {
    personal: {
      firstName,
      dob: normalizeDate(firstLine(v["What's your date of birth?"])),
      city: address.city || cityFromLocation || 'Great falls',
      state: normalizeState(firstLine(v['What state do you live in?']) || stateFromLocation),
      heightFt: height.heightFt,
      heightIn: height.heightIn,
      weight: firstLine(v['What is your weight?'] || header['Weight:']).replace(/[^\d.]/g, ''),
      bmi: firstLine(valueAfter(text, 'BMI', ['BMI', 'Age'])),
      usCitizen: /us citizen/i.test(v['What is your citizenship status?'] || '') ? 'yes' : '',
      maritalStatus: firstLine(v['Which statement best describes your current relationship status?']),
      partnerName: spouseNames[0] || '',
      partnerDob: normalizeDate(firstLine(v['If you have a spouse/partner, what is their date of birth?'])),
    },
    general: {
      homeOwnership: firstLine(v['What is your current living situation?']),
      homeDuration: firstLine(v['How long have you been at your current residence?']),
      childrenFullTime: /live with me/i.test(v['Please describe your current household as it relates to raising your child(ren).'] || '') ? 'yes' : '',
      validLicense: normalizeYesNo(v['Do you have a valid driver\'s license?']),
      criminalHistory: v['Have you ever been arrested?'] === 'No' && v['Have you ever been convicted of any of the following (check all that may apply)'] === 'No' ? 'no' : '',
      supportSystem: beAnswer(v['Do you have a solid support system to help you during a pregnancy, including childcare, transportation, emotional support, etc.']),
      smokeVape: normalizeYesNo(v['Have you ever used tobacco products, including vape products?']),
      alcoholDrugs: normalizeYesNo(v['Have you ever used any recreational drugs? (Yes, marijuana counts – remember it is not legal everywhere, yet!)']),
    },
    pregnancyHistory: {
      numberOfPregnancies: pregnancies.length ? String(pregnancies.length) : firstLine(v['Let’s hear it sister, how many healthy, live babies have you given birth to?']),
      pregnancies,
    },
    fertility: {
      breastfeeding: normalizeYesNo(v['Are you currently breastfeeding?']),
      breastfeedingStopDate: v['If you are currently breastfeeding, when do you plan on stopping?'],
      contraceptiveMethod: v['What is your current method of Birth Control?'],
      lastPeriod: normalizeDate(firstLine(v['What is the start date of your most recent menstrual cycle (LMP)?'])),
      pregnancyDetails: beAnswer(v['Please indicate any of the following conditions you may be experiencing, or have experienced in the past (select all that may apply).']),
    },
    health: {
      lastPhysical: normalizeDate(firstLine(v['What is the date of your last Annual Physical exam?'])),
      lastPap: `${firstLine(v['What was the date of your most recent PAP smear screening?'])}${v['Did your last PAP smear results come back normal PAP?'] ? ` - Normal: ${firstLine(v['Did your last PAP smear results come back normal PAP?'])}` : ''}`,
      openToVaccinations: beAnswer(v['Are you up to date on all other vaccinations (TDAP, MMR, Varicella)?']),
      mentalHealthDiagnosis: mentalConditions && !/^none$/i.test(firstLine(mentalConditions)) ? 'yes' : 'no',
      mentalHealthDiagnosisDetails: mentalConditions,
      mentalHealthMedication: /n\/a|no/i.test(v['Please list any prescription medication you are taking for mental health conditions (or indicate "N/A").'] || '') ? 'no' : 'yes',
      mentalHealthMedicationDetails: beAnswer(v['Please list any prescription medication you are taking for mental health conditions (or indicate "N/A").']),
      medicalConditions: diseaseHistory && !/^none$/i.test(firstLine(diseaseHistory)) ? 'yes' : 'no',
      medicalConditionDetails: /^none$/i.test(diseaseHistory) ? '' : diseaseHistory,
      prescriptionMeds: beAnswer(v['In the last 12 months, please list all prescription medication you are taking or have taken for medical conditions (or indicate "N/A").']),
      currentMeds: beAnswer(v['In the last 12 months, please list all over-the-counter medication you are taking, or have taken, including supplements & vitamins (or indicate "N/A").']),
    },
    employment: {
      currentlyEmployed: normalizeYesNo(v['Are you currently employed?']),
      employmentIndustry: employer,
      occupation: [occupation, jobResponsibilities].filter(Boolean).join(' - '),
      lengthAtEmployer,
      hourlyRate,
      workHours: workStatus,
      healthInsurance: hasInsurance,
      insuranceType,
      governmentAssistance: assistanceDetails ? 'yes' : 'no',
      governmentAssistanceDetails: assistanceDetails,
    },
    academic: {
      educationLevel: firstLine(cleanBeValue(v['What is the highest level of education you have completed?'] || header['Education:'])),
    },
    hopesWishes: {
      idealIPs: intendedParents,
      openSingleIP: /single/i.test(intendedParents) ? 'yes' : '',
      ipsOutsideUS: /international/i.test(intendedParents) ? 'yes' : '',
      willingTwins: normalizeYesNo(v['Are you willing to carry multiples (twins/triplets)?']),
      selectiveReduction: normalizeYesNo(v['Are you willing to have selective reduction (reduce triplets to twins or singleton pregnancy IF one of the babies shows signs of no viability)?']),
      willingnessToTerminate: beAnswer(v['Are you willing to terminate the pregnancy at the Intended Parent(s) request due to huge genetic, chromosomal, or developmental abnormalities discovered that would affect the babies viability or compatibility with life?']),
      conditionsWontTerminate: beAnswer(v['Will you agree to terminate the pregnancy due to diagnosis of Down Syndrome if requested by IPs or doctors?']),
      cvsAmnio: normalizeYesNo(v['Are you willing to have an amniocentesis or CVS testing if requested by your doctor?']),
    },
  }

  return {
    application: {
      fullLegalName: [firstName, lastName].filter(Boolean).join(' '),
      dob: profileData.personal.dob,
      street: address.street,
      city: profileData.personal.city,
      state: profileData.personal.state,
      zipCode: /^\d/.test(address.zipCode) ? address.zipCode : '',
      hasSpouse,
      spouseFirstName: spouseNames[0] || '',
      spouseLastName: spouseNames.slice(1).join(' '),
      spouseDob: profileData.personal.partnerDob,
      hasInsurance,
      insuranceProvider: '',
      insurancePolicyNumber: '',
      insuranceGroupNumber: '',
      insurancePhone: '',
    },
    confidential: {
      fullLegalName: [firstName, lastName].filter(Boolean).join(' '),
      dob: profileData.personal.dob,
      hasSpouse,
      spouseFullName,
      spouseEmail: '',
      spousePhone: '',
      hasInsurance,
      insuranceProvider: '',
      insurancePolicyNumber: '',
      insuranceGroupNumber: '',
      insurancePhone: '',
    },
    employment: profileData.employment,
    intakeAnswers: {
      firstName,
      lastName,
      email: firstLine(header['Email:']).toLowerCase(),
      phone: normalizePhone(header['Phone #:'] || v['Phone number, so we can stay in touch?']),
      dob: profileData.personal.dob,
      state: profileData.personal.state,
      heightFt: profileData.personal.heightFt,
      heightIn: profileData.personal.heightIn,
      weightLbs: profileData.personal.weight,
      maritalStatus: profileData.personal.maritalStatus,
      healthyPregnancy: normalizeYesNo(v['Have you had at least one healthy, full term pregnancy and delivery?']),
      hearAboutUs: beAnswer(v['How did you hear about us?']),
    },
    profileData,
  }
}

function calculateBMI(personal) {
  const ft = parseInt(personal.heightFt) || 0
  const inch = parseInt(personal.heightIn) || 0
  const weight = parseFloat(personal.weight)
  const totalIn = ft * 12 + inch
  if (!totalIn || !weight) return ''
  return ((weight / (totalIn ** 2)) * 703).toFixed(1)
}

export async function extractPdfText(file) {
  const pdfjsLib = await loadPdfjs()
  const bytes = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
  const pages = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const rows = new Map()
    for (const item of content.items || []) {
      const text = String(item.str || '').trim()
      if (!text) continue
      const y = Math.round(item.transform?.[5] || 0)
      const x = Math.round(item.transform?.[4] || 0)
      const row = rows.get(y) || []
      row.push({ x, text })
      rows.set(y, row)
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) => row.sort((a, b) => a.x - b.x).map(i => i.text).join(' '))
    pages.push(lines.join('\n'))
  }
  return pages.join('\n\n')
}

export async function parseSurrogateApplicationPdfFiles(files) {
  const parsed = { intakeAnswers: {}, application: {}, confidential: {}, employment: {}, references: {}, clinicHospital: {}, profileData: {}, docs: [] }
  for (const file of files) {
    const text = await extractPdfText(file)
    const section = detectSection(text)
    parsed.docs.push({ file, section, text, textLength: text.length })
  }

  for (const doc of parsed.docs.filter(d => d.section === 'intake')) {
    merge(parsed.intakeAnswers, parseIntake(doc.text))
  }
  for (const doc of parsed.docs) {
    if (doc.section === 'application') {
      const result = parseApplication(doc.text, parsed.intakeAnswers)
      merge(parsed.application, result._application)
      parsed.profileData.personal = parsed.profileData.personal || {}
      merge(parsed.profileData.personal, result.profilePersonal)
    } else if (doc.section === 'confidential') {
      const result = parseConfidential(doc.text)
      merge(parsed.application, result._application)
      merge(parsed.confidential, result._confidential)
      parsed.profileData.personal = parsed.profileData.personal || {}
      merge(parsed.profileData.personal, result.profilePersonal)
    } else if (doc.section === 'employment') {
      const result = parseEmployment(doc.text)
      merge(parsed.employment, result.employment)
      parsed.profileData.employment = parsed.profileData.employment || {}
      merge(parsed.profileData.employment, result.employment)
    } else if (doc.section === 'references') {
      const result = parseReferences(doc.text)
      merge(parsed.references, result._references)
    } else if (doc.section === 'clinicHospital') {
      const result = parseClinicHospital(doc.text)
      merge(parsed.clinicHospital, result._clinicHospital)
    } else if (doc.section === 'beProfile') {
      const result = parseBeSurrogacyProfile(doc.text)
      merge(parsed.intakeAnswers, result.intakeAnswers)
      merge(parsed.application, result.application)
      merge(parsed.confidential, result.confidential)
      merge(parsed.employment, result.employment)
      for (const [section, values] of Object.entries(result.profileData || {})) {
        parsed.profileData[section] = parsed.profileData[section] || {}
        merge(parsed.profileData[section], values)
      }
    }
  }
  if (parsed.intakeAnswers.heightFt || parsed.intakeAnswers.weightLbs) {
    parsed.profileData.personal = parsed.profileData.personal || {}
    merge(parsed.profileData.personal, {
      firstName: parsed.intakeAnswers.firstName,
      dob: parsed.intakeAnswers.dob,
      state: parsed.intakeAnswers.state,
      heightFt: parsed.intakeAnswers.heightFt,
      heightIn: parsed.intakeAnswers.heightIn,
      weight: parsed.intakeAnswers.weightLbs,
    })
  }
  if (parsed.profileData.personal) {
    const bmi = calculateBMI(parsed.profileData.personal)
    if (bmi) parsed.profileData.personal.bmi = bmi
  }
  return parsed
}

export function getSurrogateApplicationImportSummary(parsed) {
  return {
    sectionsDetected: parsed.docs.map(d => ({ file: d.file.name, section: d.section })),
    intakeKeys: Object.keys(parsed.intakeAnswers || {}),
    applicationKeys: Object.keys(parsed.application || {}),
    confidentialKeys: Object.keys(parsed.confidential || {}),
    employmentKeys: Object.keys(parsed.employment || {}),
    referenceKeys: Object.keys(parsed.references || {}),
    clinicHospitalKeys: Object.keys(parsed.clinicHospital || {}),
    profileSections: Object.fromEntries(Object.entries(parsed.profileData || {}).map(([section, values]) => [section, Object.keys(values || {})])),
  }
}

export async function importSurrogateApplicationPdfFiles({ email, files, uploadedBy }) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail) throw new Error('Email is required.')
  if (!files?.length) throw new Error('Add at least one PDF.')

  const parsed = await parseSurrogateApplicationPdfFiles(files)
  const { data: intakes, error: intakeError } = await supabase
    .from('intake_submissions')
    .select('id,intake_type,applicant_name,applicant_email,status,answers')
    .eq('applicant_email', cleanEmail)
    .eq('intake_type', 'gc')
    .order('submitted_at', { ascending: false })
    .limit(1)
  if (intakeError) throw intakeError
  const intake = intakes?.[0]
  if (!intake) throw new Error(`No surrogate application found for ${cleanEmail}.`)

  const updatedAnswers = {
    ...(intake.answers || {}),
    ...parsed.intakeAnswers,
    _application: { ...(intake.answers?._application || {}), ...parsed.application },
    _confidential: { ...(intake.answers?._confidential || {}), ...parsed.confidential },
    _employment: { ...(intake.answers?._employment || {}), ...parsed.employment },
    _references: { ...(intake.answers?._references || {}), ...parsed.references },
    _clinicHospital: { ...(intake.answers?._clinicHospital || {}), ...parsed.clinicHospital },
  }
  const { error: updateError } = await supabase.from('intake_submissions').update({ answers: updatedAnswers }).eq('id', intake.id)
  if (updateError) throw updateError

  const existingProfile = await fetchSurrogateProfileByEmail(cleanEmail)
  const mergedProfile = { ...(existingProfile?.profile_data || {}) }
  for (const [section, values] of Object.entries(parsed.profileData || {})) {
    mergedProfile[section] = { ...(mergedProfile[section] || {}), ...values }
  }
  const profile = Object.keys(mergedProfile).length ? await adminUpdateSurrogateProfile(cleanEmail, mergedProfile) : null

  const uploaded = []
  for (const doc of parsed.docs) {
    const prefix = doc.section === 'unknown' ? 'application' : doc.section
    const namedFile = new File([doc.file], `${prefix} - ${doc.file.name}`, { type: doc.file.type || 'application/pdf' })
    uploaded.push(await uploadCaseDocument({
      surrogateId: intake.id,
      category: 'agency-documents',
      file: namedFile,
      uploadedBy: uploadedBy || 'Application PDF Import',
    }))
  }

  return { intake, profile, uploaded, parsed, summary: getSurrogateApplicationImportSummary(parsed) }
}

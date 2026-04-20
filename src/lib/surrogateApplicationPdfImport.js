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
  const match = raw.match(/(\d+)\s*(?:['"'.]|,)?\s*(\d+)?/)
  if (!match) return {}
  return { heightFt: match[1], heightIn: match[2] || '0' }
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
    .replace(/\n{3,}/g, '\n\n')
}

function textLines(text) {
  return cleanText(text)
    .split(/\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => !/^Abundant Beginnings Co\.$/i.test(l))
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
    'How did you hear about Abundant Beginnings Co. (ABC)?',
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
    hearAboutUs: v['How did you hear about Abundant Beginnings Co. (ABC)?'],
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
  const parsed = { intakeAnswers: {}, application: {}, references: {}, profileData: {}, docs: [] }
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
    } else if (doc.section === 'employment') {
      const result = parseEmployment(doc.text)
      parsed.profileData.employment = parsed.profileData.employment || {}
      merge(parsed.profileData.employment, result.employment)
    } else if (doc.section === 'references') {
      const result = parseReferences(doc.text)
      merge(parsed.references, result._references)
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
    referenceKeys: Object.keys(parsed.references || {}),
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
    _references: { ...(intake.answers?._references || {}), ...parsed.references },
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

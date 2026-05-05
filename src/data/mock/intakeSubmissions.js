// Mock intake submissions — GC and IP applications
// Tracks UTM params, social ad params (fbclid, ttclid), DQ logic results

export const mockIntakeSubmissions = []

// Helper: get display label for a source
export function getSourceLabel(source) {
  const labels = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    google: 'Google',
    referral: 'Referral',
    direct: 'Direct',
  }
  return labels[source] || source || 'Unknown'
}

// Helper: get display label for DQ reasons
export const DQ_REASON_LABELS = {
  bmi_out_of_range: 'BMI out of range',
  tobacco_use: 'Tobacco/nicotine use',
  drug_use: 'Recreational drug use',
  serious_medical_condition: 'Active medical condition',
  currently_pregnant: 'Currently pregnant',
  no_biological_children: 'No healthy pregnancy history',
  too_many_deliveries: '6 or more pregnancies',
  too_many_csections: 'More than 2 C-sections',
  excess_c_sections: 'More than 2 C-sections',
  govt_assistance: 'Receiving government assistance',
  age_out_of_range: 'Age out of range (21–40)',
  no_financing_plan: 'No financing plan confirmed',
  not_us_citizen_or_resident: 'Not a US Citizen or Legal Resident',
}

// Helper: resolve disqualifications for a GC form submission
export function getGCDisqualifications(answers) {
  const reasons = []
  // Age from DOB
  const age = answers.dob
    ? Math.floor((new Date() - new Date(answers.dob)) / (365.25 * 24 * 60 * 60 * 1000))
    : null
  if (age !== null && (age < 21 || age > 40)) reasons.push('age_out_of_range')
  // BMI
  if (answers.bmi != null && (answers.bmi < 19 || answers.bmi > 33)) reasons.push('bmi_out_of_range')
  // Healthy pregnancy check
  if (answers.healthyPregnancy === false) reasons.push('no_biological_children')
  // Too many deliveries
  if (answers.sixOrMoreDeliveries === true) reasons.push('too_many_deliveries')
  // Too many C-sections
  if (answers.moreThanTwoCsections === true) reasons.push('too_many_csections')
  // Not a US citizen or legal resident → hard disqualification (can't be a
  // surrogate in the program; should not get into the platform to start an app)
  if (answers.usCitizen === false || answers.usCitizen === 'no') reasons.push('not_us_citizen_or_resident')
  return reasons
}

// Helper: resolve disqualifications for an IP form submission
// IPs are never disqualified via the intake quiz
export function getIPDisqualifications(_answers) {
  return []
}

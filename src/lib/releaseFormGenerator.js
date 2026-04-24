/**
 * HIPAA-Compliant Medical Records Release Form Generator
 * Generates branded HTML forms for e-signature per provider
 * Compliant with 45 CFR 164.508, 42 CFR Part 2, and Cal. Civil Code 56.11
 */

const PROVIDER_TYPES = {
  ob: { label: 'Prenatal / OB-GYN', recordTypes: 'Prenatal care, office visits, lab results, ultrasounds, and all related obstetric records' },
  hospital: { label: 'Labor & Delivery', recordTypes: 'Admission, labor and delivery summary, discharge summary, operative notes, postpartum records, and all related hospital records' },
  mfm: { label: 'Maternal Fetal Medicine', recordTypes: 'High-risk pregnancy evaluations, specialist consultations, diagnostic testing, and all related MFM records' },
  ivf: { label: 'IVF / Fertility', recordTypes: 'IVF cycle records, embryo transfer reports, monitoring records, medication protocols, and all related fertility treatment records' },
}

/**
 * Extract unique providers from clinic/hospital form data
 * Returns array of { type, clinicName, doctorName, phone, address, pregnancyNum, deliveryDates }
 * deliveryDates collects every pregnancy date associated with this provider so
 * the release form can auto-render one "Dates of Service" range per pregnancy.
 */
export function extractProviders(clinicData) {
  const providerMap = new Map()

  const addOrMerge = (key, base, pregDate) => {
    if (!providerMap.has(key)) {
      providerMap.set(key, { ...base, deliveryDates: [] })
    }
    if (pregDate) providerMap.get(key).deliveryDates.push(pregDate)
  }

  for (const [i, p] of (clinicData.pregnancies || []).entries()) {
    const pregNum = i + 1
    const isNonDelivery = ['miscarriage', 'ectopic', 'ectopic pregnancy', 'termination', 'chemical', 'chemical pregnancy']
      .includes((p.outcome || '').toLowerCase())
    const skipRelease = isNonDelivery && p.receivedPrenatalCare === 'no'
    if (skipRelease) continue

    // OB / Prenatal
    if (p.obClinicName) {
      const key = `ob_${p.obClinicName.toLowerCase().trim()}`
      addOrMerge(key, { type: 'ob', clinicName: p.obClinicName, doctorName: p.obDoctorName, phone: p.obPhone, address: p.obAddress, pregnancyNum: pregNum }, p.date)
    }

    // Hospital
    if (p.hospitalName && !isNonDelivery) {
      const key = `hospital_${p.hospitalName.toLowerCase().trim()}`
      addOrMerge(key, { type: 'hospital', clinicName: p.hospitalName, doctorName: '', phone: p.hospitalPhone, address: p.hospitalAddress, pregnancyNum: pregNum }, p.date)
    }

    // MFM
    if ((p.sawMFM === 'yes' || p.sawMFM === true) && p.mfmClinicName) {
      const key = `mfm_${p.mfmClinicName.toLowerCase().trim()}`
      addOrMerge(key, { type: 'mfm', clinicName: p.mfmClinicName, doctorName: p.mfmDoctorName, phone: p.mfmPhone, address: p.mfmAddress, pregnancyNum: pregNum }, p.date)
    }

    // IVF
    if ((p.wasIVF === 'yes' || p.wasIVF === true || p.wasSurrogacy === 'yes' || p.wasSurrogacy === true) && p.ivfClinicName) {
      const key = `ivf_${p.ivfClinicName.toLowerCase().trim()}`
      addOrMerge(key, { type: 'ivf', clinicName: p.ivfClinicName, doctorName: p.ivfDoctorName, phone: p.ivfPhone, address: p.ivfAddress, pregnancyNum: pregNum }, p.date)
    }
  }

  return Array.from(providerMap.values())
}

/**
 * Format "Dates of Service" string for a provider.
 * For each recorded pregnancy date, produces a range of (date - 1 year) through
 * today, formatted as MM/DD/YYYY-MM/DD/YYYY. Multiple pregnancies are joined
 * with ", ". Returns an empty string if no dates are known.
 */
function formatDatesOfService(deliveryDates = []) {
  if (!deliveryDates.length) return ''
  const fmt = (d) => {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${mm}/${dd}/${yyyy}`
  }
  const today = new Date()
  const ranges = []
  for (const iso of deliveryDates) {
    if (!iso) continue
    // Parse the HTML date input (YYYY-MM-DD) as local time to avoid timezone drift
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) continue
    const start = new Date(y - 1, m - 1, d)
    ranges.push(`${fmt(start)}-${fmt(today)}`)
  }
  return ranges.join(', ')
}

/**
 * Generate HIPAA-compliant release form HTML for a single provider
 */
export function generateReleaseFormHtml(provider, patient, confidentialData) {
  const typeInfo = PROVIDER_TYPES[provider.type] || PROVIDER_TYPES.ob
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const expirationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 800px; margin: 0 auto; color: #000; line-height: 1.35; font-size: 11px;">

  <!-- Header -->
  <div style="text-align: center; padding-bottom: 10px; border-bottom: 2px solid #283693;">
    <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="Abundant Beginnings Co." style="height: 50px; margin-bottom: 4px;" onerror="this.style.display='none'" />
    <p style="color: #283693; font-size: 16px; font-weight: 700; margin: 0;">Abundant Beginnings Co.</p>
    <p style="font-size: 10px; margin: 2px 0 8px 0;">5627 Kanan Road #229, Agoura Hills, CA 91301 | O: 323-207-5762 | F: 323-843-9433</p>
    <p style="font-size: 14px; font-weight: 700; margin: 0; text-decoration: underline;">AUTHORIZATION TO RELEASE PROTECTED HEALTH INFORMATION</p>
    <p style="font-size: 11px; font-weight: 600; margin-top: 3px;">${typeInfo.label} Records</p>
  </div>

  <!-- Patient Information -->
  <div style="margin-top: 12px; padding: 8px 12px; border: 1px solid #000;">
    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
      <tr>
        <td style="padding: 2px 0; width: 50%;"><strong>Patient:</strong> ${patient.name || '{{Name:GC}}'}</td>
        <td style="padding: 2px 0;"><strong>DOB:</strong> ${confidentialData?.dob || '___________'}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0;"><strong>Other Name(s):</strong> ${confidentialData?.maidenName || 'N/A'}</td>
        <td style="padding: 2px 0;"><strong>Last 4 SSN:</strong> ${confidentialData?.ssn4 || '____'}</td>
      </tr>
    </table>
  </div>

  <!-- Authorization + Recipient combined -->
  <p style="margin: 10px 0 6px 0;">I authorize the release of <strong>healthcare information</strong> and <strong>reproductive health records</strong> of the patient named above for the purpose of <u>continuation of medical care</u> and evaluation for a gestational surrogacy arrangement to:</p>

  <div style="text-align: center; margin: 6px 0; padding: 8px; border: 2px solid #283693;">
    <p style="font-weight: 700; color: #283693; font-size: 13px; margin: 0;">Abundant Beginnings Co. C/O Desiree Melchiori</p>
    <p style="margin: 2px 0; font-size: 10px;">6329 Agua Dulce Court, Placerville, CA 95667 | Ph: 323-207-5762 | Fax: 323-843-9433 | records@abcsurrogacy.com</p>
  </div>

  <!-- Provider -->
  <div style="margin-top: 10px; padding: 8px 12px; border: 1px solid #000;">
    <p style="font-weight: 700; font-size: 10px; text-transform: uppercase; margin: 0 0 4px 0;">Provider to Release Records:</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
      <tr>
        <td style="padding: 2px 0; width: 50%;"><strong>Facility:</strong> ${provider.clinicName || '_______________'}</td>
        <td style="padding: 2px 0;"><strong>Doctor:</strong> ${provider.doctorName || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0;"><strong>Phone:</strong> ${provider.phone || '_______________'}</td>
        <td style="padding: 2px 0;"><strong>Address:</strong> ${provider.address || '_______________'}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding: 2px 0;"><strong>Dates of Service:</strong> ${formatDatesOfService(provider.deliveryDates) || '_______________'}</td>
      </tr>
    </table>
  </div>

  <!-- Records Description -->
  <div style="margin-top: 10px;">
    <p style="font-weight: 700; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 4px;">Information to Be Released:</p>
    <p style="font-size: 10px; margin: 0 0 4px 0;">${typeInfo.recordTypes}, including but not limited to:</p>
    <div style="columns: 2; column-gap: 16px; font-size: 10px;">
      <p style="margin: 1px 0;">&#9745; All PHI in medical record</p>
      <p style="margin: 1px 0;">&#9745; Office visit notes</p>
      <p style="margin: 1px 0;">&#9745; Lab results (incl. infectious disease, drug & nicotine)</p>
      <p style="margin: 1px 0;">&#9745; Rx / medication information</p>
      <p style="margin: 1px 0;">&#9745; Diagnostic imaging & ultrasounds</p>
      <p style="margin: 1px 0;">&#9745; Operative notes & procedure reports</p>
      <p style="margin: 1px 0;">&#9745; Admission & discharge summaries</p>
      <p style="margin: 1px 0;">&#9745; Clinical testing results</p>
      <p style="margin: 1px 0;">&#9745; Physician orders</p>
      <p style="margin: 1px 0;">&#9745; Postpartum flow sheets</p>
    </div>
  </div>

  <!-- Sensitive Info -->
  <div style="margin-top: 10px; padding: 8px 12px; border: 1px solid #000;">
    <p style="font-weight: 700; font-size: 10px; margin: 0 0 4px 0;">AUTHORIZATION FOR SENSITIVE INFORMATION</p>
    <p style="font-size: 10px; margin: 0 0 4px 0;">By signing below, I also authorize the release of the following sensitive health information if contained in my records:</p>
    <p style="font-size: 10px; margin: 1px 0;">&#9745; <strong>HIV/AIDS</strong> records &nbsp;&nbsp; &#9745; <strong>Genetic testing</strong> &nbsp;&nbsp; &#9745; <strong>Mental health</strong> records &nbsp;&nbsp; &#9745; <strong>Alcohol/drug info</strong> (42 CFR Part 2)</p>
  </div>

  <!-- Legal Terms — condensed -->
  <div style="margin-top: 10px; font-size: 9.5px; line-height: 1.4;">
    <p style="font-weight: 700; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 4px;">Terms and Conditions</p>
    <p style="margin: 2px 0;"><strong>Purpose:</strong> Evaluation and continuation of care related to a gestational surrogacy arrangement facilitated by Abundant Beginnings Co.</p>
    <p style="margin: 2px 0;"><strong>Expiration:</strong> This authorization expires on <strong>${expirationDate}</strong> (12 months from signature), or upon completion of the surrogacy arrangement, whichever occurs first.</p>
    <p style="margin: 2px 0;"><strong>Right to Revoke:</strong> I may revoke this authorization at any time in writing to the provider's medical records department. Revocation will not affect disclosures already made.</p>
    <p style="margin: 2px 0;"><strong>Voluntary:</strong> Signing is voluntary. Treatment, payment, enrollment, or eligibility for benefits will not be conditioned on signing.</p>
    <p style="margin: 2px 0;"><strong>Re-Disclosure:</strong> Once disclosed, information may no longer be protected by federal or state privacy laws and may be re-disclosed by the recipient.</p>
    <p style="margin: 2px 0;"><strong>Copy:</strong> Per 45 CFR 164.508(c)(4) and Cal. Civil Code 56.11(i), a copy of this completed authorization will be provided to the patient upon request.</p>
  </div>

  <!-- Signature Block -->
  <div style="margin-top: 16px; border-top: 2px solid #000; padding-top: 12px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 60%; padding-right: 30px; vertical-align: bottom;">
          <p style="font-size: 10px; margin-bottom: 3px;">Patient Signature:</p>
          <p style="font-size: 16px; margin: 0;">{{Signature:GC}}</p>
          <div style="border-bottom: 1px solid #000; margin-top: 3px;"></div>
        </td>
        <td style="width: 40%; vertical-align: bottom;">
          <p style="font-size: 10px; margin-bottom: 3px;">Date Signed:</p>
          <p style="margin: 0;">{{Date:GC}}</p>
          <div style="border-bottom: 1px solid #000; margin-top: 3px;"></div>
        </td>
      </tr>
    </table>
    <p style="font-size: 10px; margin-top: 8px;">Printed Name: {{Name:GC}}</p>
  </div>

  <!-- Footer -->
  <div style="margin-top: 16px; text-align: center; padding-top: 8px; border-top: 1px solid #000;">
    <p style="font-size: 8px; color: #333; margin: 0;">6329 Agua Dulce Court, Placerville, CA 95667 | O: 323-207-5762 | F: 323-843-9433 | abcsurrogacy.com</p>
    <p style="font-size: 7px; color: #555; margin: 2px 0 0 0;">Compliant with HIPAA (45 CFR 164.508), ESIGN Act, UETA, 42 CFR Part 2, and Cal. Civil Code 56.11.</p>
  </div>

</div>`
}

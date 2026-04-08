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
 * Returns array of { type, clinicName, doctorName, phone, address, pregnancyNum }
 */
export function extractProviders(clinicData) {
  const providers = []
  const seen = new Set()

  for (const [i, p] of (clinicData.pregnancies || []).entries()) {
    const pregNum = i + 1
    const isNonDelivery = ['miscarriage', 'ectopic', 'ectopic pregnancy', 'termination', 'chemical', 'chemical pregnancy']
      .includes((p.outcome || '').toLowerCase())
    const skipRelease = isNonDelivery && p.receivedPrenatalCare === 'no'
    if (skipRelease) continue

    // OB / Prenatal
    if (p.obClinicName) {
      const key = `ob_${p.obClinicName.toLowerCase().trim()}`
      if (!seen.has(key)) {
        seen.add(key)
        providers.push({ type: 'ob', clinicName: p.obClinicName, doctorName: p.obDoctorName, phone: p.obPhone, address: p.obAddress, pregnancyNum: pregNum })
      }
    }

    // Hospital
    if (p.hospitalName && !isNonDelivery) {
      const key = `hospital_${p.hospitalName.toLowerCase().trim()}`
      if (!seen.has(key)) {
        seen.add(key)
        providers.push({ type: 'hospital', clinicName: p.hospitalName, doctorName: '', phone: p.hospitalPhone, address: p.hospitalAddress, pregnancyNum: pregNum })
      }
    }

    // MFM
    if ((p.sawMFM === 'yes' || p.sawMFM === true) && p.mfmClinicName) {
      const key = `mfm_${p.mfmClinicName.toLowerCase().trim()}`
      if (!seen.has(key)) {
        seen.add(key)
        providers.push({ type: 'mfm', clinicName: p.mfmClinicName, doctorName: p.mfmDoctorName, phone: p.mfmPhone, address: p.mfmAddress, pregnancyNum: pregNum })
      }
    }

    // IVF
    if ((p.wasIVF === 'yes' || p.wasIVF === true || p.wasSurrogacy === 'yes' || p.wasSurrogacy === true) && p.ivfClinicName) {
      const key = `ivf_${p.ivfClinicName.toLowerCase().trim()}`
      if (!seen.has(key)) {
        seen.add(key)
        providers.push({ type: 'ivf', clinicName: p.ivfClinicName, doctorName: p.ivfDoctorName, phone: p.ivfPhone, address: p.ivfAddress, pregnancyNum: pregNum })
      }
    }
  }

  return providers
}

/**
 * Generate HIPAA-compliant release form HTML for a single provider
 */
export function generateReleaseFormHtml(provider, patient, confidentialData) {
  const typeInfo = PROVIDER_TYPES[provider.type] || PROVIDER_TYPES.ob
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const expirationDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 800px; margin: 0 auto; color: #000; line-height: 1.5; font-size: 13px;">

  <!-- Header -->
  <div style="text-align: center; padding-bottom: 16px; border-bottom: 2px solid #283693;">
    <p style="color: #283693; font-size: 18px; font-weight: 700; margin: 0; letter-spacing: 0.5px;">Abundant Beginnings Co.</p>
    <p style="font-size: 11px; margin: 4px 0 12px 0; color: #333;">5627 Kanan Road #229, Agoura Hills, CA 91301 | O: 323-207-5762 | F: 323-843-9433</p>
    <p style="font-size: 16px; font-weight: 700; margin: 0; text-decoration: underline;">AUTHORIZATION TO RELEASE PROTECTED HEALTH INFORMATION</p>
    <p style="font-size: 12px; font-weight: 600; margin-top: 4px;">${typeInfo.label} Records</p>
  </div>

  <!-- Patient Information -->
  <div style="margin-top: 20px; padding: 12px 16px; border: 1px solid #000;">
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <tr>
        <td style="padding: 3px 0; width: 50%;"><strong>Patient Name:</strong> ${patient.name || '{{Name:GC}}'}</td>
        <td style="padding: 3px 0;"><strong>Date of Birth:</strong> ${confidentialData?.dob || '_______________'}</td>
      </tr>
      <tr>
        <td style="padding: 3px 0;"><strong>Other Name(s) Used:</strong> ${confidentialData?.maidenName || 'N/A'}</td>
        <td style="padding: 3px 0;"><strong>Last 4 of SSN:</strong> ${confidentialData?.ssn4 || '____'}</td>
      </tr>
    </table>
  </div>

  <!-- Authorization Statement -->
  <div style="margin-top: 20px;">
    <p>I authorize the release of <strong>healthcare information</strong> and <strong>reproductive health records</strong> of the patient named above for the purpose of <u>continuation of medical care</u> and evaluation for a gestational surrogacy arrangement to:</p>
  </div>

  <!-- Recipient -->
  <div style="text-align: center; margin: 16px 0; padding: 12px; border: 2px solid #283693;">
    <p style="font-weight: 700; color: #283693; font-size: 15px; margin: 0;">Abundant Beginnings Co.</p>
    <p style="margin: 3px 0; font-size: 12px;">5627 Kanan Road #229, Agoura Hills, CA 91301</p>
    <p style="margin: 3px 0; font-size: 12px;">Phone: 323-207-5762 &nbsp;|&nbsp; Fax: 323-843-9433</p>
    <p style="margin: 3px 0; font-size: 12px;">Email: <strong>records@abcsurrogacy.com</strong></p>
  </div>

  <!-- Provider Being Released -->
  <div style="margin-top: 20px; padding: 12px 16px; border: 1px solid #000;">
    <p style="font-weight: 700; font-size: 12px; text-transform: uppercase; margin: 0 0 6px 0;">Provider to Release Records:</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <tr>
        <td style="padding: 3px 0; width: 50%;"><strong>Facility / Clinic:</strong> ${provider.clinicName || '_______________'}</td>
        <td style="padding: 3px 0;"><strong>Doctor:</strong> ${provider.doctorName || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 3px 0;"><strong>Phone:</strong> ${provider.phone || '_______________'}</td>
        <td style="padding: 3px 0;"><strong>Address:</strong> ${provider.address || '_______________'}</td>
      </tr>
    </table>
  </div>

  <!-- Records Description -->
  <div style="margin-top: 20px;">
    <p style="font-weight: 700; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px;">Description of Information to Be Released:</p>
    <p style="font-size: 12px;">${typeInfo.recordTypes}, including but not limited to:</p>
    <div style="columns: 2; column-gap: 20px; font-size: 11px; margin-top: 6px;">
      <p style="margin: 2px 0;">&#9745; All PHI in medical record</p>
      <p style="margin: 2px 0;">&#9745; Office visit notes</p>
      <p style="margin: 2px 0;">&#9745; Lab results (incl. infectious disease, drug & nicotine)</p>
      <p style="margin: 2px 0;">&#9745; Rx / medication information</p>
      <p style="margin: 2px 0;">&#9745; Diagnostic imaging & ultrasounds</p>
      <p style="margin: 2px 0;">&#9745; Operative notes & procedure reports</p>
      <p style="margin: 2px 0;">&#9745; Admission & discharge summaries</p>
      <p style="margin: 2px 0;">&#9745; Clinical testing results</p>
      <p style="margin: 2px 0;">&#9745; Physician orders</p>
      <p style="margin: 2px 0;">&#9745; Postpartum flow sheets</p>
    </div>
  </div>

  <!-- Sensitive Information Consent -->
  <div style="margin-top: 20px; padding: 12px 16px; border: 1px solid #000;">
    <p style="font-weight: 700; font-size: 12px; margin: 0 0 6px 0;">AUTHORIZATION FOR SENSITIVE INFORMATION</p>
    <p style="font-size: 11px; margin: 0 0 6px 0;">By signing below, I also authorize the release of the following categories of sensitive health information, if contained in my records:</p>
    <div style="font-size: 11px;">
      <p style="margin: 3px 0;">&#9745; <strong>HIV/AIDS</strong> - related records and test results</p>
      <p style="margin: 3px 0;">&#9745; <strong>Genetic testing</strong> - information and results</p>
      <p style="margin: 3px 0;">&#9745; <strong>Mental health</strong> - all related records</p>
      <p style="margin: 3px 0;">&#9745; <strong>Alcohol and drug information</strong> - (Prohibited Re-Disclosure: 42 CFR Part 2 prohibits unauthorized disclosure of these records)</p>
    </div>
  </div>

  <!-- Legal Terms -->
  <div style="margin-top: 20px; font-size: 11px; line-height: 1.6;">
    <p style="font-weight: 700; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px;">Terms and Conditions</p>

    <p><strong>Purpose:</strong> This authorization is for the purpose of evaluation and continuation of care related to a gestational surrogacy arrangement facilitated by Abundant Beginnings Co.</p>

    <p><strong>Expiration:</strong> This authorization expires on <strong>${expirationDate}</strong> (twelve months from date of signature), or upon completion of the surrogacy arrangement, whichever occurs first.</p>

    <p><strong>Right to Revoke:</strong> I understand that I may revoke this authorization at any time by submitting a written request to the medical records management department of the provider named above. Revocation will not affect any disclosures already made in reliance on this authorization.</p>

    <p><strong>Voluntary:</strong> I understand that signing this authorization is voluntary. My treatment, payment, enrollment, or eligibility for benefits will not be conditioned on whether I sign this authorization.</p>

    <p><strong>Re-Disclosure:</strong> I understand that once my health information is disclosed pursuant to this authorization, it may no longer be protected by federal or state privacy laws and may be subject to re-disclosure by the recipient.</p>

    <p><strong>Copy:</strong> I understand that I am entitled to receive a copy of this signed authorization upon request. Pursuant to 45 CFR 164.508(c)(4) and California Civil Code 56.11(i), a copy of this completed authorization will be provided to me.</p>
  </div>

  <!-- Signature Block -->
  <div style="margin-top: 28px; border-top: 2px solid #000; padding-top: 16px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 60%; padding-right: 40px; vertical-align: bottom;">
          <p style="font-size: 11px; margin-bottom: 4px;">Patient Signature:</p>
          <p style="font-size: 16px; margin: 0;">{{Signature:GC}}</p>
          <div style="border-bottom: 1px solid #000; margin-top: 4px;"></div>
        </td>
        <td style="width: 40%; vertical-align: bottom;">
          <p style="font-size: 11px; margin-bottom: 4px;">Date Signed:</p>
          <p style="margin: 0;">{{Date:GC}}</p>
          <div style="border-bottom: 1px solid #000; margin-top: 4px;"></div>
        </td>
      </tr>
    </table>
    <p style="font-size: 11px; margin-top: 12px;">Printed Name: {{Name:GC}}</p>
  </div>

  <!-- Footer -->
  <div style="margin-top: 28px; text-align: center; padding-top: 12px; border-top: 1px solid #000;">
    <p style="font-size: 9px; color: #333;">5627 Kanan Road #229, Agoura Hills, CA 91301 | O: 323-207-5762 | F: 323-843-9433 | abcsurrogacy.com</p>
    <p style="font-size: 8px; color: #555; margin-top: 3px;">This authorization complies with HIPAA (45 CFR 164.508), the ESIGN Act, UETA, 42 CFR Part 2, and California Civil Code 56.11.</p>
  </div>

</div>`
}

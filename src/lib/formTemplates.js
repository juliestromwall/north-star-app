/**
 * Form Templates — Fillable document templates for e-signature
 * Each template defines the legal text + labeled form fields inline.
 * Rendered as clean HTML forms (no Google Docs needed).
 */

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]

// Shared fields used for all background waivers — single source of truth, populates both sections
const BACKGROUND_WAIVER_FIELDS = [
  { id: 'firstName', label: 'First Name', type: 'text', required: true },
  { id: 'middleName', label: 'Middle Name', type: 'text', required: true },
  { id: 'lastName', label: 'Last Name', type: 'text', required: true },
  { id: 'phone', label: 'Contact Phone Number(s)', type: 'text', required: true },
  { id: 'ssn', label: 'Social Security Number', type: 'text', required: true },
  { id: 'dob', label: 'Date of Birth', type: 'date', required: true },
  { id: 'dlNumber', label: "Driver's License #", type: 'text', required: true },
  { id: 'dlState', label: 'License Issuing State', type: 'select', options: US_STATES, required: true },
  { id: 'dlExpiration', label: 'License Expiration Date', type: 'date', required: true },
  { id: 'wantCopy', label: 'Receive copy of report', type: 'radio', options: ['yes', 'no'], required: true },
]

const BACKGROUND_WAIVER_SIGNATURES = [
  { id: 'sig1', label: "Applicant's Signature (Section 1)" },
  { id: 'sig2', label: "Applicant's Signature (Section 2)" },
  { id: 'sig3', label: 'Signature (Driving Record Consent)' },
]

export const FORM_TEMPLATES = {
  gc_background_waiver: {
    id: 'gc_background_waiver',
    title: 'GC Background Waiver',
    description: 'Disclosure Authorization and Release — Background Investigation',
    signerRole: 'gc',
    fields: BACKGROUND_WAIVER_FIELDS,
    signatures: BACKGROUND_WAIVER_SIGNATURES,
  },
  partner_background_waiver: {
    id: 'partner_background_waiver',
    title: 'Partner Background Waiver',
    description: 'Disclosure Authorization and Release — Partner Background Investigation',
    signerRole: 'partner',
    fields: BACKGROUND_WAIVER_FIELDS,
    signatures: BACKGROUND_WAIVER_SIGNATURES,
  },
  ip_background_waiver: {
    id: 'ip_background_waiver',
    title: 'IP Background Waiver',
    description: 'Disclosure Authorization and Release — IP Background Investigation',
    signerRole: 'ip1',
    formType: 'ip_background',
    fields: BACKGROUND_WAIVER_FIELDS,
    signatures: BACKGROUND_WAIVER_SIGNATURES,
  },
  ip2_background_waiver: {
    id: 'ip2_background_waiver',
    title: 'IP2 Background Waiver',
    description: 'Disclosure Authorization and Release — IP2 Background Investigation',
    signerRole: 'ip2',
    formType: 'ip_background',
    fields: BACKGROUND_WAIVER_FIELDS,
    signatures: BACKGROUND_WAIVER_SIGNATURES,
  },
}

/**
 * Generate the Background Waiver HTML with form field placeholders.
 * Field values are passed in and rendered inline.
 * Used for both preview (interactive) and PDF (filled values).
 */
export function generateBackgroundWaiverHtml(values = {}, signatures = {}, options = {}) {
  const { signerName = '', signerEmail = '', forPdf = false } = options
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Derive full name from parts
  const fullName = [values.firstName, values.middleName, values.lastName].filter(Boolean).join(' ')

  function field(id, width = '200px') {
    let val = values[id] || ''
    if (id === 'fullName') val = fullName
    if (forPdf) {
      return `<span style="display:inline-block;min-width:${width};border-bottom:1px solid #333;padding:2px 4px;font-weight:500;">${val || '&nbsp;'.repeat(8)}</span>`
    }
    return `<span data-field-id="${id}" style="display:inline-block;min-width:${width};border-bottom:2px solid #283693;padding:2px 4px;color:#283693;font-weight:500;cursor:text;">${val || '(click to fill)'}</span>`
  }

  function sig(id) {
    const val = signatures[id]
    if (forPdf && val) {
      if (val.type === 'drawn' && val.image) {
        return `<img src="${val.image}" style="height:30px;vertical-align:middle;" />`
      }
      return `<span style="font-family:serif;font-style:italic;font-size:18px;color:#283693;">${val.name || ''}</span>`
    }
    if (forPdf) return '<span style="border-bottom:1px solid #333;display:inline-block;min-width:200px;">&nbsp;</span>'
    return `<span data-sig-id="${id}" style="display:inline-block;min-width:200px;border-bottom:2px dashed #ed148c;padding:2px 4px;color:#ed148c;font-style:italic;cursor:pointer;">${val?.name || '(click to sign)'}</span>`
  }

  function date() {
    return `<span style="font-weight:500;">${today}</span>`
  }

  const wantCopy = values.wantCopy
  const checkYes = forPdf ? (wantCopy === 'yes' ? '☑' : '☐') : `<span data-field-id="wantCopy" data-value="yes" style="cursor:pointer;font-size:16px;">${wantCopy === 'yes' ? '☑' : '☐'}</span>`
  const checkNo = forPdf ? (wantCopy === 'no' ? '☑' : '☐') : `<span data-field-id="wantCopy" data-value="no" style="cursor:pointer;font-size:16px;">${wantCopy === 'no' ? '☑' : '☐'}</span>`

  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.5; color: #000; max-width: 700px; margin: 0 auto;">

  <div style="text-align:center;margin-bottom:20px;">
    <img src="/abc-logo-horz.png" alt="Abundant Beginnings Co." style="height:50px;margin-bottom:8px;" crossorigin="anonymous" />
    <h1 style="font-size:16px;font-weight:700;margin:0;color:#283693;">DISCLOSURE AUTHORIZATION AND RELEASE</h1>
    <p style="font-size:10px;color:#666;margin:4px 0 0;">California Civil Code § 1786.16; 15 U.S.C. 1681(b)</p>
  </div>

  <p>You and/or your partner have submitted an application for gestational surrogacy with Abundant Beginnings Co. As part of this application process, a background investigation will be conducted. The purpose of the background investigation is to evaluate your suitability for surrogacy with Abundant Beginnings Co.</p>

  <p><strong>Abundant Beginnings Co.</strong> has specifically requested information regarding:</p>
  <ul style="margin:6px 0 12px 20px;padding:0;">
    <li>Past employers and/or education institutions;</li>
    <li>Criminal records;</li>
    <li>Institutions with information addressing credit worthiness, including, but not limited to a retail credit report provided by any of the commercial retail credit reporting companies;</li>
    <li>Department of Motor Vehicles Report</li>
  </ul>

  <p>The investigative consumer report may include information on your character, general reputation, personal characteristics, and/or mode of living. The report will be made by:</p>

  <div style="background:#f8f8f8;border:1px solid #ddd;border-radius:6px;padding:10px 14px;margin:10px 0;">
    <strong>RCS Investigations & Consulting, LLC</strong> &mdash; rcsinvestigations.com<br/>
    Address: P.O. Box 29798, Anaheim, CA 92809-9798<br/>
    Telephone: (714) 779-2300
  </div>

  <p style="font-size:10px;color:#555;">Any criminal background information obtained may be made available to you during regular business hours. You may either personally inspect the files upon furnishing proper identification and/or request to receive a copy of your file relating to your criminal history for a fee not to exceed the actual cost of copying. You may also obtain a summary of the information by telephone if you have made a written request. See Civil Code § 1786.10 and § 1786.22.</p>

  <p style="font-size:10px;color:#555;">The investigator will explain any information furnished to you as a result of the criminal background investigation. He/she will also provide a written explanation of any coded information contained in their files. You may be permitted to be accompanied by one other person of your choosing in personally inspecting the files.</p>

  <!-- SECTION 1: Applicant Info + First Signature -->
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:16px 0;">
    <table style="width:100%;font-size:11px;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;width:50%;"><strong>Full Name:</strong> ${field('fullName', '250px')}</td>
        <td style="padding:6px 0;"><strong>Phone:</strong> ${field('phone', '180px')}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>SSN:</strong> ${field('ssn', '150px')}</td>
        <td style="padding:6px 0;"><strong>Date of Birth:</strong> ${field('dob', '120px')}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Driver's License #:</strong> ${field('dlNumber', '150px')}</td>
        <td style="padding:6px 0;"><strong>State:</strong> ${field('dlState', '60px')} &nbsp; <strong>Exp:</strong> ${field('dlExpiration', '100px')}</td>
      </tr>
    </table>
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:flex-end;">
      <div><strong>Applicant's Signature:</strong><br/>${sig('sig1')}</div>
      <div><strong>Date:</strong> ${date()}</div>
    </div>
  </div>

  <!-- SECTION 2: Authorization -->
  <div style="border:1px solid #283693;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="font-size:10px;color:#666;margin:0 0 8px;">California Civil Code § 1786.16(b)(i)</p>
    <p>I, <strong>${fullName || signerName || '_______________'}</strong>, have been advised that Abundant Beginnings Co. will be requesting an investigative consumer report regarding me.</p>
    <p>I hereby authorize Abundant Beginnings Co. to procure an investigative consumer report regarding me for surrogacy purposes. I am aware that said report may include information regarding my character, general reputation, personal characteristics, and mode of living as well as a medical, criminal or civil history.</p>

    <div style="margin:12px 0;padding:10px;background:#f8f8f8;border-radius:6px;">
      <p style="margin:0 0 6px;">${checkYes} <strong>I wish to receive a copy</strong> of any report that is prepared. I understand that a copy of the report will be provided within three (3) business days of receipt of the report by Abundant Beginnings Co.</p>
      <p style="margin:0;">${checkNo} <strong>I do not wish to receive a copy</strong> of any report that is prepared, or any public records that may be obtained.</p>
    </div>

    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:flex-end;">
      <div><strong>Applicant's Signature:</strong><br/>${sig('sig2')}</div>
      <div><strong>Date:</strong> ${date()}</div>
    </div>
  </div>

  <!-- SECTION 3: Driving Record Consent -->
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:16px 0;">
    <h3 style="font-size:12px;font-weight:700;color:#283693;margin:0 0 8px;">SIGNED CONSENT TO PROCURE DRIVING RECORD</h3>
    <p style="font-size:10px;color:#666;margin:0 0 8px;">RCS Investigations & Consulting, LLC — #6002048</p>

    <p style="font-size:10px;">This driving record is being requested for the following reason:<br/>
    <strong>INSURANCE</strong> — For use by any insurer or insurance support organization, in connection with claims investigation activities, anti-fraud activities, rating or underwriting.<br/>
    To become a gestational surrogate with Abundant Beginnings Company, LLC.</p>

    <p>I authorize RCS Investigations and Consulting, LLC, or its agents, to obtain a copy of my driving record. I understand I have the right to inspect this document in accordance with the Fair Credit Reporting Act.</p>

    <table style="width:100%;font-size:11px;border-collapse:collapse;margin-top:10px;">
      <tr>
        <td style="padding:6px 0;"><strong>First:</strong> ${field('firstName', '150px')}</td>
        <td style="padding:6px 0;"><strong>Middle:</strong> ${field('middleName', '120px')}</td>
        <td style="padding:6px 0;"><strong>Last:</strong> ${field('lastName', '150px')}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Date of Birth:</strong> ${field('dob', '120px')}</td>
        <td style="padding:6px 0;"><strong>DL #:</strong> ${field('dlNumber', '150px')}</td>
        <td style="padding:6px 0;"><strong>State:</strong> ${field('dlState', '60px')}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;" colspan="3"><strong>Expiration:</strong> ${field('dlExpiration', '120px')}</td>
      </tr>
    </table>

    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:flex-end;">
      <div><strong>Signature:</strong><br/>${sig('sig3')}</div>
      <div><strong>Date:</strong> ${date()}</div>
    </div>
  </div>

</div>`
}

/**
 * Generate the IP Background Waiver HTML.
 * Different language from GC version — criminal/civil/DMV only, matching process.
 */
export function generateIPBackgroundWaiverHtml(values = {}, signatures = {}, options = {}) {
  const { signerName = '', forPdf = false } = options
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Derive full name from parts
  const fullName = [values.firstName, values.middleName, values.lastName].filter(Boolean).join(' ')

  function field(id, width = '200px') {
    let val = values[id] || ''
    if (id === 'fullName') val = fullName
    if (forPdf) return `<span style="display:inline-block;min-width:${width};border-bottom:1px solid #333;padding:2px 4px;font-weight:500;">${val || '&nbsp;'.repeat(8)}</span>`
    return `<span data-field-id="${id}" style="display:inline-block;min-width:${width};border-bottom:2px solid #283693;padding:2px 4px;color:#283693;font-weight:500;cursor:text;">${val || '(click to fill)'}</span>`
  }
  function sig(id) {
    const val = signatures[id]
    if (forPdf && val) {
      if (val.type === 'drawn' && val.image) return `<img src="${val.image}" style="height:30px;vertical-align:middle;" />`
      return `<span style="font-family:serif;font-style:italic;font-size:18px;color:#283693;">${val.name || ''}</span>`
    }
    if (forPdf) return '<span style="border-bottom:1px solid #333;display:inline-block;min-width:200px;">&nbsp;</span>'
    return `<span data-sig-id="${id}" style="display:inline-block;min-width:200px;border-bottom:2px dashed #ed148c;padding:2px 4px;color:#ed148c;font-style:italic;cursor:pointer;">${val?.name || '(click to sign)'}</span>`
  }
  function date() { return `<span style="font-weight:500;">${today}</span>` }

  const wantCopy = values.wantCopy
  const checkYes = forPdf ? (wantCopy === 'yes' ? '☑' : '☐') : `<span data-field-id="wantCopy" data-value="yes" style="cursor:pointer;font-size:16px;">${wantCopy === 'yes' ? '☑' : '☐'}</span>`
  const checkNo = forPdf ? (wantCopy === 'no' ? '☑' : '☐') : `<span data-field-id="wantCopy" data-value="no" style="cursor:pointer;font-size:16px;">${wantCopy === 'no' ? '☑' : '☐'}</span>`

  return `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.5; color: #000; max-width: 700px; margin: 0 auto;">

  <div style="text-align:center;margin-bottom:20px;">
    <img src="/abc-logo-horz.png" alt="Abundant Beginnings Co." style="height:50px;margin-bottom:8px;" crossorigin="anonymous" />
    <h1 style="font-size:16px;font-weight:700;margin:0;color:#283693;">DISCLOSURE AUTHORIZATION AND RELEASE</h1>
    <p style="font-size:10px;color:#666;margin:4px 0 0;">California Civil Code § 1786.16; 15 U.S.C. 1681(b)</p>
  </div>

  <p>You are exploring finding a surrogate with Abundant Beginnings Co. As part of this process, a background investigation will be conducted.</p>

  <p><strong>Abundant Beginnings Co.</strong> has specifically requested information regarding:</p>
  <ul style="margin:6px 0 12px 20px;padding:0;">
    <li>Criminal records</li>
    <li>Civil Records</li>
    <li>Department of Motor Vehicles Report</li>
  </ul>

  <p>The investigative consumer report may include information on your character, general reputation, and personal characteristics. The report will be made by RCS Investigations and Consulting. You will receive a call from them to conduct a short interview.</p>

  <div style="background:#f8f8f8;border:1px solid #ddd;border-radius:6px;padding:10px 14px;margin:10px 0;">
    <strong>RCS Investigations & Consulting, LLC</strong> &mdash; rcsinvestigations.com<br/>
    Address: P.O. Box 29798, Anaheim, CA 92809-9798<br/>
    Telephone: (714) 779-2300
  </div>

  <p style="font-size:10px;color:#555;">Any criminal background information obtained may be made available to you during regular business hours. You may either personally inspect the files upon furnishing proper identification and/or request to receive a copy of your file relating to your criminal history for a fee not to exceed the actual cost of copying. You may also obtain a summary of the information by telephone if you have made a written request. See Civil Code § 1786.10 and § 1786.22.</p>

  <p style="font-size:10px;color:#555;">The investigator will explain any information furnished to you as a result of the criminal background investigation. He/she will also provide a written explanation of any coded information contained in their files. You may be permitted to be accompanied by one other person of your choosing in personally inspecting the files.</p>

  <!-- SECTION 1 -->
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:16px 0;">
    <table style="width:100%;font-size:11px;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;width:50%;"><strong>Full Name:</strong> ${field('fullName', '250px')}</td>
        <td style="padding:6px 0;"><strong>Phone:</strong> ${field('phone', '180px')}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>SSN:</strong> ${field('ssn', '150px')}</td>
        <td style="padding:6px 0;"><strong>Date of Birth:</strong> ${field('dob', '120px')}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Driver's License #:</strong> ${field('dlNumber', '150px')}</td>
        <td style="padding:6px 0;"><strong>State:</strong> ${field('dlState', '60px')} &nbsp; <strong>Exp:</strong> ${field('dlExpiration', '100px')}</td>
      </tr>
    </table>
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:flex-end;">
      <div><strong>Applicant's Signature:</strong><br/>${sig('sig1')}</div>
      <div><strong>Date:</strong> ${date()}</div>
    </div>
  </div>

  <!-- SECTION 2 -->
  <div style="border:1px solid #283693;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="font-size:10px;color:#666;margin:0 0 8px;">California Civil Code § 1786.16(b)(i)</p>
    <p>I, <strong>${fullName || signerName || '_______________'}</strong>, have been advised that Abundant Beginnings Co. will be requesting an investigative consumer report regarding me.</p>
    <p>I hereby authorize Abundant Beginnings Co. to procure an investigative consumer report regarding me. I am aware that said report may include information regarding my character, general reputation, personal characteristics, and mode of living as well as a medical, criminal or civil history.</p>

    <div style="margin:12px 0;padding:10px;background:#f8f8f8;border-radius:6px;">
      <p style="margin:0 0 6px;">${checkYes} <strong>I wish to receive a copy</strong> of any report that is prepared. I understand that a copy of the report will be provided within three (3) business days of receipt of the report by Abundant Beginnings Co.</p>
      <p style="margin:0;">${checkNo} <strong>I do not wish to receive a copy</strong> of any report that is prepared, or any public records that may be obtained.</p>
    </div>

    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:flex-end;">
      <div><strong>Applicant's Signature:</strong><br/>${sig('sig2')}</div>
      <div><strong>Date:</strong> ${date()}</div>
    </div>
  </div>

  <!-- SECTION 3: Driving Record -->
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:16px 0;">
    <h3 style="font-size:12px;font-weight:700;color:#283693;margin:0 0 8px;">SIGNED CONSENT TO PROCURE DRIVING RECORD</h3>
    <p style="font-size:10px;color:#666;margin:0 0 8px;">RCS Investigations & Consulting, LLC — #6002048</p>

    <p style="font-size:10px;">My driving record is being requested for the following reason:<br/>
    <strong>Abundant Beginnings Company, LLC</strong> is requesting this as part of their matching process with a surrogate.</p>

    <p>I authorize RCS Investigations and Consulting, LLC, or its agents, to obtain a copy of my driving record. I understand I have the right to inspect this document in accordance with the Fair Credit Reporting Act.</p>

    <table style="width:100%;font-size:11px;border-collapse:collapse;margin-top:10px;">
      <tr>
        <td style="padding:6px 0;"><strong>First:</strong> ${field('firstName', '150px')}</td>
        <td style="padding:6px 0;"><strong>Middle:</strong> ${field('middleName', '120px')}</td>
        <td style="padding:6px 0;"><strong>Last:</strong> ${field('lastName', '150px')}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Date of Birth:</strong> ${field('dob', '120px')}</td>
        <td style="padding:6px 0;"><strong>DL #:</strong> ${field('dlNumber', '150px')}</td>
        <td style="padding:6px 0;"><strong>State:</strong> ${field('dlState', '60px')}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;" colspan="3"><strong>Expiration:</strong> ${field('dlExpiration', '120px')}</td>
      </tr>
    </table>

    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:flex-end;">
      <div><strong>Signature:</strong><br/>${sig('sig3')}</div>
      <div><strong>Date:</strong> ${date()}</div>
    </div>
  </div>

</div>`
}

export function generateAuditTrailHtml(signerName, signerEmail, signatureTypes = {}) {
  const signedAt = new Date()
  const sigEntries = Object.entries(signatureTypes).map(([id, sig]) =>
    `<tr><td style="padding:4px 0;"><strong>${id}:</strong></td><td>${sig.type === 'drawn' ? 'Hand-drawn' : 'Typed'} — ${sig.name || ''}</td></tr>`
  ).join('')

  return `
<div style="font-family: Arial, sans-serif; padding: 40px; color: #000; font-size: 12px; line-height: 1.5;">
  <div style="border-top: 2px solid #283693; padding-top: 20px;">
    <p style="font-weight: 700; color: #283693; font-size: 14px; margin: 0 0 12px 0;">ELECTRONIC SIGNATURE CERTIFICATE</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <tr><td style="padding: 4px 0; width: 180px;"><strong>Completed:</strong></td><td>${signedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</td></tr>
      <tr><td style="padding: 4px 0;"><strong>Signer:</strong></td><td>${signerName}</td></tr>
      <tr><td style="padding: 4px 0;"><strong>Email:</strong></td><td>${signerEmail}</td></tr>
      ${sigEntries}
      <tr><td style="padding: 4px 0;"><strong>IP Address:</strong></td><td>Captured at signing</td></tr>
    </table>
    <p style="margin-top: 16px; font-size: 10px; color: #555; border-top: 1px solid #ccc; padding-top: 12px;">
      Electronically signed via ABC Surrogacy (app.abcsurrogacy.com) in accordance with the ESIGN Act and UETA. A tamper-proof audit trail has been recorded for each signature event.
    </p>
  </div>
</div>`
}

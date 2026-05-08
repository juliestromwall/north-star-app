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
  { id: 'middleName', label: 'Middle Name', type: 'text', required: false },
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

// Above-PDF input form for the IP background waiver. The `name` matches the
// AcroForm field name in /public/ip-background-waiver.pdf so PdfOverlaySigner
// can route values straight into fieldValues by name. Types drive both UI
// (text vs date vs select vs masked SSN) and bake-time formatting.
const IP_BG_FORM_FIELDS = [
  { name: 'ip_first_name',  label: 'First Name',                required: true,  type: 'text',  source: 'firstName',  prefilled: true },
  { name: 'ip_middle_name', label: 'Middle Name',               required: true,  type: 'text',  source: 'middleName' },
  { name: 'ip_last_name',   label: 'Last Name',                 required: true,  type: 'text',  source: 'lastName',   prefilled: true },
  { name: 'ip_dob',         label: 'Date of Birth',             required: true,  type: 'date',  source: 'dob',        prefilled: true },
  { name: 'ip_phone',       label: 'Phone',                     required: true,  type: 'phone', source: 'phone',      prefilled: true },
  { name: 'ip_ssn',         label: 'Social Security Number',    required: true,  type: 'ssn',   source: 'ssn' },
  { name: 'ip_dl_number',   label: "Driver's License Number",   required: true,  type: 'text',  source: 'dlNumber' },
  { name: 'ip_dl_state',    label: 'Issuing State',             required: true,  type: 'state', source: 'dlState' },
  { name: 'ip_dl_exp',      label: 'License Expiration Date',   required: true,  type: 'date',  source: 'dlExp' },
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
  // One template per household-member slot (max 4). Each gets its own
  // signerRole so the batch send can route to the correct person from the
  // application's adultHouseholdMembers[] array.
  household_member_1_background_waiver: {
    id: 'household_member_1_background_waiver',
    title: 'Household Member #1 Background Waiver',
    description: 'Disclosure Authorization and Release — Household Member Background Investigation',
    signerRole: 'householdMember1',
    fields: BACKGROUND_WAIVER_FIELDS,
    signatures: BACKGROUND_WAIVER_SIGNATURES,
  },
  household_member_2_background_waiver: {
    id: 'household_member_2_background_waiver',
    title: 'Household Member #2 Background Waiver',
    description: 'Disclosure Authorization and Release — Household Member Background Investigation',
    signerRole: 'householdMember2',
    fields: BACKGROUND_WAIVER_FIELDS,
    signatures: BACKGROUND_WAIVER_SIGNATURES,
  },
  household_member_3_background_waiver: {
    id: 'household_member_3_background_waiver',
    title: 'Household Member #3 Background Waiver',
    description: 'Disclosure Authorization and Release — Household Member Background Investigation',
    signerRole: 'householdMember3',
    fields: BACKGROUND_WAIVER_FIELDS,
    signatures: BACKGROUND_WAIVER_SIGNATURES,
  },
  household_member_4_background_waiver: {
    id: 'household_member_4_background_waiver',
    title: 'Household Member #4 Background Waiver',
    description: 'Disclosure Authorization and Release — Household Member Background Investigation',
    signerRole: 'householdMember4',
    fields: BACKGROUND_WAIVER_FIELDS,
    signatures: BACKGROUND_WAIVER_SIGNATURES,
  },
  // IP background waivers — switched from HTML-form layout to pdf-overlay
  // mode (same as Kaiser). The signer sees the official release PDF with
  // input widgets overlaid at the AcroForm field positions. Name/phone/DOB
  // are prefilled from intake; the IP types Middle/SSN/DL/DL-state/DL-exp
  // inline. Signature applies to all 3 widget positions; "wish to receive
  // a copy" radio maps to the two checkbox fields.
  ip_background_waiver: {
    id: 'ip_background_waiver',
    title: 'IP Background Waiver',
    description: 'Disclosure Authorization and Release — IP Background Investigation',
    layoutMode: 'pdf-overlay',
    formMode: 'above',                       // structured form ABOVE the PDF; PDF is read-only sample
    signerRole: 'ip1',
    formType: 'ip_background',
    pdfPath: '/ip-background-waiver.pdf',
    adminFields: [],
    overlay: [],
    formAboveFields: IP_BG_FORM_FIELDS,
    fields: BACKGROUND_WAIVER_FIELDS,        // legacy — preserved for any in-flight non-overlay sends
    signatures: BACKGROUND_WAIVER_SIGNATURES,
  },
  ip2_background_waiver: {
    id: 'ip2_background_waiver',
    title: 'IP2 Background Waiver',
    description: 'Disclosure Authorization and Release — IP2 Background Investigation',
    layoutMode: 'pdf-overlay',
    formMode: 'above',
    signerRole: 'ip2',
    formType: 'ip_background',
    pdfPath: '/ip-background-waiver.pdf',
    adminFields: [],
    overlay: [],
    formAboveFields: IP_BG_FORM_FIELDS,
    fields: BACKGROUND_WAIVER_FIELDS,
    signatures: BACKGROUND_WAIVER_SIGNATURES,
  },

  // ── Release Forms (doc-first layout: document at top, signatures below) ──

  // Unified HIPAA — surrogate and agency admin sign the SAME document so the
  // signed PDF files to the case folder only after both have signed. Admin
  // and gc each get an email with their own link; SignFormPage role-filters
  // so each signer sees only their own signature slot.
  release_hipaa: {
    id: 'release_hipaa',
    title: 'HIPAA Authorization',
    description: 'HIPAA Privacy Acknowledgment and Consent',
    layoutMode: 'doc-first',
    signerRole: 'gc', // primary (email/label fallback), both roles listed below
    multiSigner: true,
    signerRoles: ['gc', 'admin'],
    pages: [{
      id: 'p1',
      title: 'HIPAA Privacy Acknowledgment',
      gcSignatures: [{ id: 'sig_gc_p1' }],
      adminSignatures: [{ id: 'sig_admin_p1' }],
    }],
    fields: [],
  },
  // Legacy — kept so in-flight docs created before the HIPAA merge continue
  // to render. New sends use `release_hipaa` above.
  release_hipaa_gc: {
    id: 'release_hipaa_gc',
    title: 'HIPAA Authorization',
    description: 'HIPAA Privacy Acknowledgment and Consent',
    layoutMode: 'doc-first',
    signerRole: 'gc',
    pages: [{ id: 'p1', title: 'HIPAA Privacy Acknowledgment', gcSignatures: [{ id: 'sig_gc_p1' }] }],
    fields: [],
  },
  release_hipaa_admin: {
    id: 'release_hipaa_admin',
    title: 'HIPAA Authorization — Agency Countersign',
    description: 'HIPAA Privacy Acknowledgment — Agency Representative Countersignature',
    layoutMode: 'doc-first',
    signerRole: 'admin',
    pages: [{ id: 'p1', title: 'HIPAA Privacy Acknowledgment', adminSignatures: [{ id: 'sig_admin_p1' }] }],
    fields: [],
  },
  release_general_psych_single_gc: {
    id: 'release_general_psych_single_gc',
    title: 'General Psych Release (Single)',
    description: 'Psychological Evaluation Release — Single',
    layoutMode: 'doc-first',
    signerRole: 'gc',
    pages: [{ id: 'p1', title: 'Psychological Evaluation Release', gcSignatures: [{ id: 'sig_gc_p1' }] }],
    fields: [],
  },
  // Single merged template for partnered General Psych — has BOTH gc and
  // partner signature slots on the shared page. One esign_documents row
  // is created with two signers; SignFormPage's role filter (line 210-218
  // in that file) shows each signer only their own slots.
  release_general_psych_partnered_gc: {
    id: 'release_general_psych_partnered_gc',
    title: 'General Psych Release (Partnered)',
    description: 'Psychological Evaluation Release — Partnered',
    layoutMode: 'doc-first',
    signerRole: 'gc',
    multiSigner: true,
    pages: [{
      id: 'p1',
      title: 'Psychological Evaluation Release',
      gcSignatures: [{ id: 'sig_gc_p1' }],
      partnerSignatures: [{ id: 'sig_partner_p1' }],
    }],
    fields: [],
  },
  // Kept as a legacy alias so any in-flight document referencing this
  // template ID continues to render. New sends use the merged template
  // above — see SendFormTemplateButton.handleSend.
  release_general_psych_partnered_partner: {
    id: 'release_general_psych_partnered_partner',
    title: 'General Psych Release (Partnered) — Partner',
    description: 'Psychological Evaluation Release — Partnered (Partner Copy)',
    layoutMode: 'doc-first',
    signerRole: 'partner',
    pages: [{ id: 'p1', title: 'Psychological Evaluation Release', partnerSignatures: [{ id: 'sig_partner_p1' }] }],
    fields: [],
  },
  release_ellen_winters_single_gc: {
    id: 'release_ellen_winters_single_gc',
    title: 'Ellen Winters Psych Release (Single)',
    description: 'Fertility Counseling Center Release Forms — Single',
    layoutMode: 'doc-first',
    signerRole: 'gc',
    pages: [
      { id: 'ew1', title: 'Informed Consent to Telemedicine', gcSignatures: [{ id: 'sig_gc_ew1' }] },
      { id: 'ew2', title: 'Release of Information, Liability & Notice of Privacy', gcSignatures: [{ id: 'sig_gc_ew2' }], gcInitials: [{ id: 'init_gc_ew2' }] },
      { id: 'ew3', title: 'Informed Consent for Third Party Assisted Reproduction', gcSignatures: [{ id: 'sig_gc_ew3' }] },
      { id: 'ew4', title: 'Release of Information (Ellen Winters Miller)', gcSignatures: [{ id: 'sig_gc_ew4' }] },
      { id: 'ew5', title: 'Referral for Psychological Testing', gcSignatures: [{ id: 'sig_gc_ew5' }], gcInitials: [{ id: 'init_gc_ew5' }] },
    ],
    fields: [],
  },
  // Single merged template for partnered Ellen Winters. Pages ew1-ew4 have
  // BOTH gc and partner slots so one doc serves both signers. Page ew5
  // (Referral for Psychological Testing) is surrogate-only — no partner
  // slot — so the partner's SignFormPage pass will show no required
  // signatures on that page and they can skip through it.
  release_ellen_winters_partnered_gc: {
    id: 'release_ellen_winters_partnered_gc',
    title: 'Ellen Winters Psych Release (Partnered)',
    description: 'Fertility Counseling Center Release Forms — Partnered',
    layoutMode: 'doc-first',
    signerRole: 'gc',
    multiSigner: true,
    pages: [
      { id: 'ew1', title: 'Informed Consent to Telemedicine', gcSignatures: [{ id: 'sig_gc_ew1' }], partnerSignatures: [{ id: 'sig_partner_ew1' }] },
      { id: 'ew2', title: 'Release of Information, Liability & Notice of Privacy', gcSignatures: [{ id: 'sig_gc_ew2' }], gcInitials: [{ id: 'init_gc_ew2' }], partnerSignatures: [{ id: 'sig_partner_ew2' }], partnerInitials: [{ id: 'init_partner_ew2' }] },
      { id: 'ew3', title: 'Informed Consent for Third Party Assisted Reproduction', gcSignatures: [{ id: 'sig_gc_ew3' }], partnerSignatures: [{ id: 'sig_partner_ew3' }] },
      { id: 'ew4', title: 'Release of Information (Ellen Winters Miller)', gcSignatures: [{ id: 'sig_gc_ew4' }], partnerSignatures: [{ id: 'sig_partner_ew4' }] },
      { id: 'ew5', title: 'Referral for Psychological Testing', gcSignatures: [{ id: 'sig_gc_ew5' }], gcInitials: [{ id: 'init_gc_ew5' }] },
    ],
    fields: [],
  },
  release_ellen_winters_partnered_partner: {
    id: 'release_ellen_winters_partnered_partner',
    title: 'Ellen Winters Psych Release (Partnered) — Partner',
    description: 'Fertility Counseling Center Release Forms — Partnered (Partner Copy)',
    layoutMode: 'doc-first',
    signerRole: 'partner',
    pages: [
      { id: 'ew1', title: 'Informed Consent to Telemedicine', partnerSignatures: [{ id: 'sig_partner_ew1' }] },
      { id: 'ew2', title: 'Release of Information, Liability & Notice of Privacy', partnerSignatures: [{ id: 'sig_partner_ew2' }], partnerInitials: [{ id: 'init_partner_ew2' }] },
      { id: 'ew3', title: 'Informed Consent for Third Party Assisted Reproduction', partnerSignatures: [{ id: 'sig_partner_ew3' }] },
      { id: 'ew4', title: 'Release of Information (Ellen Winters Miller)', partnerSignatures: [{ id: 'sig_partner_ew4' }] },
      // Page 5 (Referral for Psych Testing) is surrogate-only — not included in partner copy
    ],
    fields: [],
  },

  // ── Kaiser PDF overlay (picky medical-records facility — must use their exact PDF) ──
  // Unlike the other release forms (which we re-render as React HTML), this one
  // overlays input widgets on top of Kaiser's original PDF and uses pdf-lib to
  // bake the values back into the same PDF on submit.
  //
  // Coordinates are in PDF-points, origin BOTTOM-LEFT, US-Letter (612 × 792).
  // Tweak via /e-signature/form/<token>?calibrate=1 — that mode shows a grid
  // overlay so you can dial in positions without redeploying.
  release_kaiser: {
    id: 'release_kaiser',
    title: 'Kaiser PHI Authorization',
    description: 'Kaiser Permanente — Authorization for Use or Disclosure of PHI',
    layoutMode: 'pdf-overlay',
    signerRole: 'gc',
    pdfPath: '/kaiser-release.pdf',
    // Admin pre-fills these BEFORE sending. The signer sees them already on
    // the PDF when they open the link.
    adminFields: [
      { id: 'step1DateRange', label: 'Step 1 — Date range of records to release', type: 'text', required: true, placeholder: 'e.g. 01/01/2024 – present' },
    ],
    // Signer fields (GC). Each maps a {{Placeholder}} to PDF-page coordinates.
    // Coordinates calibrated against Kaiser's actual PDF via ?calibrate=1.
    overlay: [
      { id: 'patientName',  page: 0, x: 262, y: 765, width: 320, fontSize: 11, source: 'gcName',     placeholder: '{{Name:GC}}' },
      // DOB is rendered MM/DD/YYYY (Kaiser preference) — see resolveOverlayValue
      { id: 'birthDate',    page: 0, x: 417, y: 752, width: 110, fontSize: 11, source: 'gcDob',      placeholder: '{{DOB:GC}}' },
      { id: 'address',      page: 0, x: 237, y: 735, width: 340, fontSize: 11, source: 'gcStreet',   placeholder: '{{StreetAddress:GC}}' },
      { id: 'city',         page: 0, x: 222, y: 720, width: 160, fontSize: 11, source: 'gcCity',     placeholder: '{{City:GC}}' },
      { id: 'state',        page: 0, x: 400, y: 720, width: 80,  fontSize: 11, source: 'gcState',    placeholder: '{{State:GC}}' },
      { id: 'zipCode',      page: 0, x: 242, y: 704, width: 160, fontSize: 11, source: 'gcZipCode',  placeholder: '{{ZipCode:GC}}' },
      // Phone — formatted as "AAA    NNN-NNNN" so the area code lands inside
      // Kaiser's pre-printed "( )" and the 7-digit number lands past the ")".
      { id: 'phone',        page: 0, x: 411, y: 703, width: 140, fontSize: 11, source: 'gcPhone',    placeholder: '{{Phone:GC}}' },
      { id: 'email',        page: 0, x: 228, y: 688, width: 340, fontSize: 11, source: 'gcEmail',    placeholder: '{{Email:GC}}' },
      // Step 1 date range — admin pre-fill
      { id: 'step1DateRange', page: 0, x: 304, y: 509, width: 240, fontSize: 10, adminField: 'step1DateRange', placeholder: 'admin: step1DateRange' },
      // Date + Signature at the bottom
      { id: 'signedDate',   page: 0, x: 21,  y: 182, width: 80,  fontSize: 11, source: 'today',      placeholder: '{{Date:GC}}' },
      { id: 'signature',    page: 0, x: 104, y: 182, width: 250, height: 28, type: 'signature',      placeholder: '{{Signature:GC}}' },
    ],
    fields: [],
  },
}

/**
 * Generate the Background Waiver HTML with form field placeholders.
 * Field values are passed in and rendered inline.
 * Used for both preview (interactive) and PDF (filled values).
 */
export function generateBackgroundWaiverHtml(values = {}, signatures = {}, options = {}) {
  const { signerName = '', signerEmail = '', forPdf = false, section = null } = options
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Derive full name from parts
  const fullName = [values.firstName, values.middleName, values.lastName].filter(Boolean).join(' ')

  function field(id, width = '200px') {
    let val = values[id] || ''
    if (id === 'fullName') val = fullName
    if (forPdf) {
      return `<span style="display:inline-block;min-width:${width};border-bottom:1px solid #333;padding:2px 4px;font-weight:500;">${val || '&nbsp;'.repeat(8)}</span>`
    }
    return `<span data-field-id="${id}" style="display:inline-block;min-width:${width};border-bottom:2px solid #1A3638;padding:2px 4px;color:#1A3638;font-weight:500;">${val || '&nbsp;'}</span>`
  }

  function sig(id) {
    const val = signatures[id]
    if (forPdf && val) {
      if (val.type === 'drawn' && val.image) {
        return `<img src="${val.image}" style="height:30px;vertical-align:middle;" />`
      }
      return `<span style="font-family:serif;font-style:italic;font-size:18px;color:#1A3638;">${val.name || ''}</span>`
    }
    if (forPdf) return '<span style="border-bottom:1px solid #333;display:inline-block;min-width:200px;">&nbsp;</span>'
    if (val?.name) {
      return `<span style="display:inline-block;min-width:200px;border-bottom:1px solid #999;padding:2px 4px;font-family:serif;font-style:italic;color:#1A3638;">${val.name}</span>`
    }
    return `<span data-sig-id="${id}" style="display:inline-block;min-width:200px;border-bottom:2px dashed #D4A853;padding:2px 4px;">&nbsp;</span>`
  }

  function date() {
    return `<span style="font-weight:500;">${today}</span>`
  }

  const wantCopy = values.wantCopy
  const checkYes = forPdf ? (wantCopy === 'yes' ? '☑' : '☐') : `<span data-field-id="wantCopy" data-value="yes" style="cursor:pointer;font-size:16px;">${wantCopy === 'yes' ? '☑' : '☐'}</span>`
  const checkNo = forPdf ? (wantCopy === 'no' ? '☑' : '☐') : `<span data-field-id="wantCopy" data-value="no" style="cursor:pointer;font-size:16px;">${wantCopy === 'no' ? '☑' : '☐'}</span>`

  const wrapperOpen = `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.5; color: #000; max-width: 700px; margin: 0 auto;">`
  const wrapperClose = `</div>`

  const introHtml = `
  <div style="text-align:center;margin-bottom:20px;">
    <h1 style="font-size:16px;font-weight:700;margin:0;color:#1A3638;">DISCLOSURE AUTHORIZATION AND RELEASE</h1>
    <p style="font-size:10px;color:#666;margin:4px 0 0;">California Civil Code § 1786.16; 15 U.S.C. 1681(b)</p>
  </div>

  <p>You and/or your partner have submitted an application for gestational surrogacy with North Star Surrogacy As part of this application process, a background investigation will be conducted. The purpose of the background investigation is to evaluate your suitability for surrogacy with North Star Surrogacy</p>

  <p><strong>North Star Surrogacy</strong> has specifically requested information regarding:</p>
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

  <p style="font-size:10px;color:#555;">The investigator will explain any information furnished to you as a result of the criminal background investigation. He/she will also provide a written explanation of any coded information contained in their files. You may be permitted to be accompanied by one other person of your choosing in personally inspecting the files.</p>`

  const section1Html = `
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
  </div>`

  const section2Html = `
  <div style="border:1px solid #1A3638;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="font-size:10px;color:#666;margin:0 0 8px;">California Civil Code § 1786.16(b)(i)</p>
    <p>I, <strong>${fullName || signerName || '_______________'}</strong>, have been advised that North Star Surrogacy will be requesting an investigative consumer report regarding me.</p>
    <p>I hereby authorize North Star Surrogacy to procure an investigative consumer report regarding me for surrogacy purposes. I am aware that said report may include information regarding my character, general reputation, personal characteristics, and mode of living as well as a medical, criminal or civil history.</p>

    <div style="margin:12px 0;padding:10px;background:#f8f8f8;border-radius:6px;">
      <p style="margin:0 0 6px;">${checkYes} <strong>I wish to receive a copy</strong> of any report that is prepared. I understand that a copy of the report will be provided within three (3) business days of receipt of the report by North Star Surrogacy</p>
      <p style="margin:0;">${checkNo} <strong>I do not wish to receive a copy</strong> of any report that is prepared, or any public records that may be obtained.</p>
    </div>

    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:flex-end;">
      <div><strong>Applicant's Signature:</strong><br/>${sig('sig2')}</div>
      <div><strong>Date:</strong> ${date()}</div>
    </div>
  </div>`

  const section3Html = `
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:16px 0;">
    <h3 style="font-size:12px;font-weight:700;color:#1A3638;margin:0 0 8px;">SIGNED CONSENT TO PROCURE DRIVING RECORD</h3>
    <p style="font-size:10px;color:#666;margin:0 0 8px;">RCS Investigations & Consulting, LLC — #6002048</p>

    <p style="font-size:10px;">This driving record is being requested for the following reason:<br/>
    <strong>INSURANCE</strong> — For use by any insurer or insurance support organization, in connection with claims investigation activities, anti-fraud activities, rating or underwriting.<br/>
    To become a gestational surrogate with North Star Surrogacy, LLC.</p>

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
  </div>`

  // When a specific section is requested, return only that section (used by the
  // PDF generator to render each section on its own page — prevents html2canvas
  // from slicing a section mid-box when the full document crosses page bounds).
  if (section === 1) return `${wrapperOpen}${introHtml}${section1Html}${wrapperClose}`
  if (section === 2) return `${wrapperOpen}${section2Html}${wrapperClose}`
  if (section === 3) return `${wrapperOpen}${section3Html}${wrapperClose}`

  return `${wrapperOpen}${introHtml}${section1Html}${section2Html}${section3Html}${wrapperClose}`
}

/**
 * Generate the IP Background Waiver HTML.
 * Different language from GC version — criminal/civil/DMV only, matching process.
 */
export function generateIPBackgroundWaiverHtml(values = {}, signatures = {}, options = {}) {
  const { signerName = '', forPdf = false, section = null } = options
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Derive full name from parts
  const fullName = [values.firstName, values.middleName, values.lastName].filter(Boolean).join(' ')

  function field(id, width = '200px') {
    let val = values[id] || ''
    if (id === 'fullName') val = fullName
    if (forPdf) return `<span style="display:inline-block;min-width:${width};border-bottom:1px solid #333;padding:2px 4px;font-weight:500;">${val || '&nbsp;'.repeat(8)}</span>`
    return `<span data-field-id="${id}" style="display:inline-block;min-width:${width};border-bottom:2px solid #1A3638;padding:2px 4px;color:#1A3638;font-weight:500;">${val || '&nbsp;'}</span>`
  }
  function sig(id) {
    const val = signatures[id]
    if (forPdf && val) {
      if (val.type === 'drawn' && val.image) return `<img src="${val.image}" style="height:30px;vertical-align:middle;" />`
      return `<span style="font-family:serif;font-style:italic;font-size:18px;color:#1A3638;">${val.name || ''}</span>`
    }
    if (forPdf) return '<span style="border-bottom:1px solid #333;display:inline-block;min-width:200px;">&nbsp;</span>'
    if (val?.name) {
      return `<span style="display:inline-block;min-width:200px;border-bottom:1px solid #999;padding:2px 4px;font-family:serif;font-style:italic;color:#1A3638;">${val.name}</span>`
    }
    return `<span data-sig-id="${id}" style="display:inline-block;min-width:200px;border-bottom:2px dashed #D4A853;padding:2px 4px;">&nbsp;</span>`
  }
  function date() { return `<span style="font-weight:500;">${today}</span>` }

  const wantCopy = values.wantCopy
  const checkYes = forPdf ? (wantCopy === 'yes' ? '☑' : '☐') : `<span data-field-id="wantCopy" data-value="yes" style="cursor:pointer;font-size:16px;">${wantCopy === 'yes' ? '☑' : '☐'}</span>`
  const checkNo = forPdf ? (wantCopy === 'no' ? '☑' : '☐') : `<span data-field-id="wantCopy" data-value="no" style="cursor:pointer;font-size:16px;">${wantCopy === 'no' ? '☑' : '☐'}</span>`

  const wrapperOpen = `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.5; color: #000; max-width: 700px; margin: 0 auto;">`
  const wrapperClose = `</div>`

  const introHtml = `
  <div style="text-align:center;margin-bottom:20px;">
    <h1 style="font-size:16px;font-weight:700;margin:0;color:#1A3638;">DISCLOSURE AUTHORIZATION AND RELEASE</h1>
    <p style="font-size:10px;color:#666;margin:4px 0 0;">California Civil Code § 1786.16; 15 U.S.C. 1681(b)</p>
  </div>

  <p>You are exploring finding a surrogate with North Star Surrogacy As part of this process, a background investigation will be conducted.</p>

  <p><strong>North Star Surrogacy</strong> has specifically requested information regarding:</p>
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

  <p style="font-size:10px;color:#555;">The investigator will explain any information furnished to you as a result of the criminal background investigation. He/she will also provide a written explanation of any coded information contained in their files. You may be permitted to be accompanied by one other person of your choosing in personally inspecting the files.</p>`

  const section1Html = `
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
  </div>`

  const section2Html = `
  <div style="border:1px solid #1A3638;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="font-size:10px;color:#666;margin:0 0 8px;">California Civil Code § 1786.16(b)(i)</p>
    <p>I, <strong>${fullName || signerName || '_______________'}</strong>, have been advised that North Star Surrogacy will be requesting an investigative consumer report regarding me.</p>
    <p>I hereby authorize North Star Surrogacy to procure an investigative consumer report regarding me. I am aware that said report may include information regarding my character, general reputation, personal characteristics, and mode of living as well as a medical, criminal or civil history.</p>

    <div style="margin:12px 0;padding:10px;background:#f8f8f8;border-radius:6px;">
      <p style="margin:0 0 6px;">${checkYes} <strong>I wish to receive a copy</strong> of any report that is prepared. I understand that a copy of the report will be provided within three (3) business days of receipt of the report by North Star Surrogacy</p>
      <p style="margin:0;">${checkNo} <strong>I do not wish to receive a copy</strong> of any report that is prepared, or any public records that may be obtained.</p>
    </div>

    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:flex-end;">
      <div><strong>Applicant's Signature:</strong><br/>${sig('sig2')}</div>
      <div><strong>Date:</strong> ${date()}</div>
    </div>
  </div>`

  const section3Html = `
  <div style="background:#fafafa;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:16px 0;">
    <h3 style="font-size:12px;font-weight:700;color:#1A3638;margin:0 0 8px;">SIGNED CONSENT TO PROCURE DRIVING RECORD</h3>
    <p style="font-size:10px;color:#666;margin:0 0 8px;">RCS Investigations & Consulting, LLC — #6002048</p>

    <p style="font-size:10px;">My driving record is being requested for the following reason:<br/>
    <strong>North Star Surrogacy, LLC</strong> is requesting this as part of their matching process with a surrogate.</p>

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
  </div>`

  if (section === 1) return `${wrapperOpen}${introHtml}${section1Html}${wrapperClose}`
  if (section === 2) return `${wrapperOpen}${section2Html}${wrapperClose}`
  if (section === 3) return `${wrapperOpen}${section3Html}${wrapperClose}`

  return `${wrapperOpen}${introHtml}${section1Html}${section2Html}${section3Html}${wrapperClose}`
}

// ── Release Forms HTML Generators ────────────────────────────────────────

/**
 * Render a single release-form page.
 * - pageId:       one of the page ids declared on the template
 * - template:     the FORM_TEMPLATES entry
 * - values:       { gcName, gcEmail, partnerName, streetAddress, cityStateZip, ... }
 * - signatures:   { [sigId]: { type:'typed'|'drawn', name, image } }
 * - initials:     { [initId]: string }
 * - options:      { forPdf: boolean, signerRole: 'gc'|'partner', signerName }
 * Returns HTML string.
 */
export function generateReleasePageHtml(pageId, template, values = {}, signatures = {}, initials = {}, options = {}) {
  const { forPdf = false, signerRole = 'gc', signerName = '', signerDates = {} } = options
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const gcName = values.gcName || ''
  const partnerName = values.partnerName || ''
  const agencyName = 'North Star Surrogacy'

  function sigInline(sigId, forRole) {
    const isActive = forRole === signerRole
    const val = signatures[sigId]
    if (forPdf && val) {
      if (val.type === 'drawn' && val.image) return `<img src="${val.image}" style="height:26px;vertical-align:middle;" />`
      return `<span style="font-family:serif;font-style:italic;font-size:17px;color:#1A3638;">${val.name || ''}</span>`
    }
    if (forPdf) return '<span style="border-bottom:1px solid #333;display:inline-block;min-width:180px;">&nbsp;</span>'
    if (!isActive) {
      return `<span style="display:inline-block;min-width:180px;border-bottom:1px solid #ccc;padding:2px 4px;">&nbsp;</span>`
    }
    if (val?.name) {
      return `<span style="display:inline-block;min-width:180px;border-bottom:1px solid #999;padding:2px 4px;font-family:serif;font-style:italic;color:#1A3638;">${val.name}</span>`
    }
    return `<span data-sig-id="${sigId}" style="display:inline-block;min-width:180px;border-bottom:2px dashed #D4A853;padding:2px 4px;">&nbsp;</span>`
  }
  function initInline(initId, forRole) {
    const isActive = forRole === signerRole
    const val = initials[initId]
    if (forPdf) {
      return `<span style="border-bottom:1px solid #333;display:inline-block;min-width:40px;padding:1px 2px;font-weight:500;">${val || '&nbsp;&nbsp;&nbsp;'}</span>`
    }
    if (!isActive) {
      return `<span style="display:inline-block;min-width:40px;border-bottom:1px solid #ccc;color:#999;font-size:10px;font-style:italic;">—</span>`
    }
    return `<span data-init-id="${initId}" style="display:inline-block;min-width:40px;border-bottom:2px dashed #D4A853;padding:1px 2px;color:#D4A853;font-weight:600;cursor:pointer;">${val || '___'}</span>`
  }
  function nameVal(name) {
    if (!name) return `<span style="display:inline-block;min-width:160px;border-bottom:1px solid #333;">&nbsp;</span>`
    return `<span style="font-weight:500;">${name}</span>`
  }
  function dateVal(forRole) {
    const isActive = forRole === signerRole
    // In the final PDF, each role's date = the date that role actually signed.
    // signerDates is populated from doc.signers[].signedAt by the caller so prior
    // signers keep their original dates when a later signer regenerates the PDF.
    if (forPdf) {
      const storedDate = signerDates[forRole]
      if (storedDate) return `<span style="font-weight:500;">${storedDate}</span>`
      if (isActive) return `<span style="font-weight:500;">${today}</span>`
      return `<span style="border-bottom:1px solid #333;display:inline-block;min-width:100px;">&nbsp;</span>`
    }
    if (isActive) return `<span style="font-weight:500;color:#1A3638;">${today}</span>`
    const storedDate = signerDates[forRole]
    if (storedDate) return `<span style="font-weight:500;color:#666;">${storedDate}</span>`
    return `<span style="color:#999;font-size:10px;">—</span>`
  }
  function textField(id, placeholder = '') {
    const v = values[id] || ''
    if (forPdf) return `<span style="display:inline-block;min-width:200px;border-bottom:1px solid #333;padding:2px 4px;">${v || '&nbsp;'.repeat(8)}</span>`
    return `<span data-field-id="${id}" style="display:inline-block;min-width:200px;border-bottom:2px solid #1A3638;padding:2px 4px;color:#1A3638;font-weight:500;">${v || '&nbsp;'}</span>`
  }

  const logoOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const headerEWM = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px;text-decoration:none;">
      <tr>
        <td style="vertical-align:middle;width:60%;padding:0;">
          <img src="${logoOrigin}/fcc-logo.png" alt="Fertility Counseling Center" style="max-height:46px;width:auto;display:block;" />
        </td>
        <td style="vertical-align:middle;text-align:right;font-size:10px;color:#333;line-height:1.35;padding:0;text-decoration:none;">
          <div style="text-decoration:none;">www.fertilitycounselingcenter.com</div>
          <div style="text-decoration:none;">3151 Airway, Suite A-2</div>
          <div style="text-decoration:none;">Costa Mesa, California 92626</div>
          <div style="text-decoration:none;">Phone: (949) 307-6208 &middot; Fax: (949) 574-4887</div>
        </td>
      </tr>
    </table>`

  const wrap = (inner) => `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.55; color: #000; max-width: 720px; margin: 0 auto; text-decoration: none;">
${inner}
</div>`

  // ── HIPAA (unified two-signer doc + legacy single-signer copies) ──
  if ((template.id === 'release_hipaa' || template.id === 'release_hipaa_gc' || template.id === 'release_hipaa_admin') && pageId === 'p1') {
    const addressLine = [values.streetAddress, values.cityStateZip].filter(Boolean).join(', ')
    const adminName = values.adminName || ''
    return wrap(`
  <div style="text-align:center;margin-bottom:16px;">
    <h1 style="font-size:16px;font-weight:700;margin:0;color:#1A3638;">HIPAA PRIVACY ACKNOWLEDGMENT AND CONSENT</h1>
    <p style="font-size:11px;color:#666;margin:4px 0 0;font-style:italic;">(Surrogacy Program / Agency Use)</p>
  </div>
  <p>I, <strong>${nameVal(gcName)}</strong>, acknowledge that I have been informed of my privacy rights under the Health Insurance Portability and Accountability Act of 1996 (HIPAA).</p>
  <p>I understand that ${agencyName} may collect, use, and maintain protected health information (PHI) related to my participation in a surrogacy program for purposes including, but not limited to:</p>
  <ul style="margin:6px 0 12px 20px;padding:0;">
    <li>Coordination of services</li>
    <li>Communication regarding medical care</li>
    <li>Administrative operations</li>
    <li>Billing and payment processing</li>
    <li>Compliance with legal and contractual obligations related to surrogacy arrangements</li>
  </ul>
  <p>I understand that my protected health information will be maintained in accordance with applicable privacy and security standards and will only be shared as permitted by law or authorized by me in writing where required.</p>
  <p>I acknowledge that I may request additional information regarding privacy practices and that I may revoke certain permissions in writing when permitted by law.</p>
  <p>I understand that signing this acknowledgment does not authorize release of my medical records to third parties beyond what is permitted under HIPAA or separately authorized by me.</p>
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #ccc;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr>
        <td style="padding:8px 0;width:60%;"><strong>Surrogate Signature:</strong><br/>${sigInline('sig_gc_p1', 'gc')}</td>
        <td style="padding:8px 0;"><strong>Date Signed:</strong><br/>${dateVal('gc')}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;"><strong>Surrogate Name:</strong> ${nameVal(gcName)}</td>
        <td style="padding:8px 0;"><strong>Email:</strong> ${values.gcEmail ? `<span>${values.gcEmail}</span>` : `<span style="color:#999;">&nbsp;</span>`}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;" colspan="2"><strong>Address:</strong> ${addressLine ? `<span>${addressLine}</span>` : `<span style="display:inline-block;min-width:400px;border-bottom:1px solid #333;">&nbsp;</span>`}</td>
      </tr>
    </table>
    <div style="margin-top:20px;padding-top:14px;border-top:1px dashed #ccc;">
      <p style="font-size:11px;color:#555;margin:0 0 8px;"><strong>Agency / Organization Representative</strong></p>
      <table style="width:100%;font-size:12px;">
        <tr>
          <td style="padding:6px 0;width:60%;"><strong>Signature:</strong><br/>${sigInline('sig_admin_p1', 'admin')}</td>
          <td style="padding:6px 0;"><strong>Date:</strong><br/>${dateVal('admin')}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;" colspan="2"><strong>Name:</strong> ${adminName ? `<span>${adminName}</span>` : `<span style="display:inline-block;min-width:250px;border-bottom:1px solid #333;">&nbsp;</span>`}</td>
        </tr>
      </table>
    </div>
  </div>`)
  }

  // ── General Psych (Single) ──
  if (template.id === 'release_general_psych_single_gc' && pageId === 'p1') {
    return wrap(`
  <h1 style="font-size:15px;font-weight:700;margin:0 0 10px;color:#1A3638;">PSYCHOLOGICAL EVALUATION</h1>
  <p>An important factor in pursuing surrogacy is the psychological evaluation. This evaluation includes a clinical interview with the potential surrogate and her partner, if there is one, and typically takes 60–90 minutes. The evaluation is not confidential and a report is written and submitted to ${agencyName}.</p>
  <p>I understand that not every potential participant for third-party procedures will be accepted for participation. As necessary, I hereby authorize ${agencyName} to discuss the results of the clinical interview with members of the fertility treatment team and understand that the result of the evaluation will be used to assess my ability to participate. I hereby release ${agencyName} from any liability in the event that I am not accepted for treatment.</p>
  <p>I, <strong>${nameVal(gcName)}</strong> (potential surrogate name), hereby acknowledge that I have requested services as explained above from ${agencyName}. I understand that there are potential psychological risks posed by evaluation and emotional support. These may include risks that are presently unknown or unidentified. I understand that any psychological and emotional risks may vary widely among individuals, so it is impossible to accurately state the likelihood of my personal risk and I cannot expect any mental health professional (MHP) to state with certainty whether or not I may suffer any psychological consequences of support and evaluation. Fully understanding the above, I voluntarily agree to proceed with evaluation and/or support.</p>
  <p>I, as a participant, specifically waive the right to claim any conflict of interest on the part of the MHP, which may arise since Intended Parents may pay the third-party participant's fees. Further, I understand that the MHP may counsel and/or evaluate other proposed participants involved in my treatment. I understand that the MHP has a professional responsibility to each client, individually and regardless of the interests of other participants who might be involved. I acknowledge and agree that the MHP may give certain advice to one client, or make certain recommendations about a client, which may negatively impact the ultimate success of any proposed treatment for me or other participants. I specifically release the MHP from liability, and release and hold harmless said MHP to the extent that her actions are reasonably within standards of professional practice. None of the above may be construed, however, as a waiver of my right to pursue a negligence or malpractice claim.</p>
  <div style="margin-top:24px;padding-top:14px;border-top:1px solid #ccc;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr>
        <td style="padding:8px 0;width:60%;"><strong>Potential Surrogate:</strong> ${nameVal(gcName)}<br/>${sigInline('sig_gc_p1', 'gc')}</td>
        <td style="padding:8px 0;"><strong>Date:</strong><br/>${dateVal('gc')}</td>
      </tr>
    </table>
  </div>`)
  }

  // ── General Psych (Partnered) — GC or Partner version ──
  if ((template.id === 'release_general_psych_partnered_gc' || template.id === 'release_general_psych_partnered_partner') && pageId === 'p1') {
    const sigGcId = 'sig_gc_p1'
    const sigPartnerId = 'sig_partner_p1'
    return wrap(`
  <h1 style="font-size:15px;font-weight:700;margin:0 0 10px;color:#1A3638;">PSYCHOLOGICAL EVALUATION</h1>
  <p>An important factor in pursuing surrogacy is the psychological evaluation. This evaluation includes a clinical interview with the potential surrogate and her partner, if there is one, and typically takes 60–90 minutes. The evaluation is not confidential and a report is written and submitted to ${agencyName}.</p>
  <p>I/we understand that not every potential participant for third-party procedures will be accepted for participation. As necessary, I/we hereby authorize ${agencyName} to discuss the results of the clinical interview with members of the fertility treatment team and understand that the result of the evaluation will be used to assess my ability to participate. I/we hereby release ${agencyName} from any liability in the event that I am not accepted for treatment.</p>
  <p>I/we, <strong>${nameVal(gcName)}</strong> and <strong>${nameVal(partnerName)}</strong> (potential surrogate name/partner), hereby acknowledge that I/we have requested services as explained above from ${agencyName}. I/we understand that there are potential psychological risks posed by evaluation and emotional support. These may include risks that are presently unknown or unidentified. I/we understand that any psychological and emotional risks may vary widely among individuals, so it is impossible to accurately state the likelihood of my/our personal risk and I/we cannot expect any mental health professional (MHP) to state with certainty whether or not I/we may suffer any psychological consequences of support and evaluation. Fully understanding the above, I/we voluntarily agree to proceed with evaluation and/or support.</p>
  <p>I/we, as participants, specifically waive the right to claim any conflict of interest on the part of the MHP, which may arise since Intended Parents may pay the third-party participant's fees. Further, I/we understand that the MHP may counsel and/or evaluate other proposed participants involved in my/our treatment. I/we understand that the MHP has a professional responsibility to each client, individually and regardless of the interests of other participants who might be involved. I/we acknowledge and agree that the MHP may give certain advice to one client, or make certain recommendations about a client, which may negatively impact the ultimate success of any proposed treatment for me/us or other participants. I/we specifically release the MHP from liability, and release and hold harmless said MHP to the extent that her actions are reasonably within standards of professional practice. None of the above may be construed, however, as a waiver of my right to pursue a negligence or malpractice claim.</p>
  <div style="margin-top:24px;padding-top:14px;border-top:1px solid #ccc;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr>
        <td style="padding:10px 0;width:60%;"><strong>Potential Surrogate:</strong> ${nameVal(gcName)}<br/>${sigInline(sigGcId, 'gc')}</td>
        <td style="padding:10px 0;"><strong>Date:</strong><br/>${dateVal('gc')}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;"><strong>Spouse/Partner:</strong> ${nameVal(partnerName)}<br/>${sigInline(sigPartnerId, 'partner')}</td>
        <td style="padding:10px 0;"><strong>Date:</strong><br/>${dateVal('partner')}</td>
      </tr>
    </table>
  </div>`)
  }

  // ── Ellen Winters pages (shared between Single + Partnered; partner fields render based on template.id) ──
  const isEWPartnered = template.id === 'release_ellen_winters_partnered_gc' || template.id === 'release_ellen_winters_partnered_partner'
  const isEW = template.id === 'release_ellen_winters_single_gc' || isEWPartnered

  if (isEW) {
    const partnerBlock = (sigId) => isEWPartnered ? `
      <tr>
        <td style="padding:8px 0;">${nameVal(partnerName)}<br/><span style="font-size:10px;color:#666;">Spouse/Partner Printed Name</span></td>
        <td style="padding:8px 0;">${sigInline(sigId, 'partner')}<br/><span style="font-size:10px;color:#666;">Spouse/Partner Signature</span></td>
        <td style="padding:8px 0;">${dateVal('partner')}<br/><span style="font-size:10px;color:#666;">Date</span></td>
      </tr>` : ''

    if (pageId === 'ew1') {
      return wrap(`
  ${headerEWM}
  <h2 style="font-size:13px;font-weight:700;color:#000;text-align:center;margin:8px 0 12px;line-height:1.3;">INFORMED CONSENT TO<br/>PARTICIPATE IN TELEMEDICINE/TELEHEALTH SERVICES</h2>
  <p style="margin:8px 0;">I (We) <strong>${nameVal(gcName)}</strong>${isEWPartnered ? ` and <strong>${nameVal(partnerName)}</strong>` : ''} hereby consent to participate in telemedicine (video-conferencing or phone) with Ellen Winters Miller (EWM).</p>
  <ul style="margin:6px 0 10px 0;padding-left:22px;">
    <li style="margin-bottom:6px;">I understand that &ldquo;telemedicine/telehealth services&rdquo; can include a practice of health care delivery, diagnosis, consultation, treatment, psychological testing, transfer of medical data and education using interactive audio, video or data communication.</li>
    <li style="margin-bottom:6px;">While I am receiving services via telemedicine, I will be notified as to who is in the room.</li>
    <li style="margin-bottom:6px;">I understand my participation in telemedicine is voluntary; that I may refuse to participate or decide to stop my participation at any time and that, at this time, there are no known risks involved with receiving my care this way.</li>
    <li style="margin-bottom:6px;">Although I may sign other forms regarding Release of Information, I understand that the laws that protect confidentiality and privacy of my medical information also apply to telemedicine. There are both mandatory and permissible expectations to confidentiality, including, but not limited to reporting child, elder and dependent adult abuse; expressed threats of violence towards an ascertainable victim (including myself); and where I make my mental or emotional state an issue on a legal proceeding.</li>
    <li style="margin-bottom:6px;">I understand that there are risks and consequences from telemedicine, including, but not limited to the possibility that the transmissions of my information could be disrupted or distorted by technical failures; unauthorized persons could interrupt the transmission of my medical information; and/or unauthorized persons could access the electronic storage of my medical information.</li>
    <li style="margin-bottom:6px;">I understand that if a mental health testing instrument is administered to me electronically, my identity will be confirmed with a photo ID and that all testing modalities will adhere to those accepted by the test publishers.</li>
  </ul>
  <p style="margin:10px 0;">I have read this document and I hereby consent to participate in receiving services via telemedicine/telehealth services under the terms described above.</p>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:18px;border-top:1px solid #ccc;padding-top:10px;">
    <tr>
      <td style="padding:8px 0;">${nameVal(gcName)}<br/><span style="font-size:10px;color:#666;">Participant Printed Name</span></td>
      <td style="padding:8px 0;">${sigInline('sig_gc_ew1', 'gc')}<br/><span style="font-size:10px;color:#666;">Participant Signature</span></td>
      <td style="padding:8px 0;">${dateVal('gc')}<br/><span style="font-size:10px;color:#666;">Date</span></td>
    </tr>
    ${partnerBlock('sig_partner_ew1')}
  </table>`)
    }

    if (pageId === 'ew2') {
      return wrap(`
  ${headerEWM}
  <h2 style="font-size:13px;font-weight:700;color:#000;text-align:center;margin:8px 0 12px;line-height:1.3;">RELEASE OF INFORMATION, LIABILITY &amp; NOTICE OF PRIVACY</h2>
  <p>I (We) <strong>${nameVal(gcName)}</strong>${isEWPartnered ? ` and <strong>${nameVal(partnerName)}</strong>` : ''} agree to participate in a psycho-educational session or mental health screening (including psychological testing, if indicated) exclusively for the purposes of being an:</p>
  <p style="padding-left:20px;">☐ egg donor &nbsp;&nbsp; ☐ embryo donor &nbsp;&nbsp; ☐ sperm donor &nbsp;&nbsp; <strong>☒ gestational carrier (surrogate)</strong></p>
  <p>I (We) understand that my participation in this assessment is considered voluntary, non-diagnostic, and non-therapeutic and is conducted in partial completion of a third-party parenting contract and not subject to usual Notice of Privacy Practices. I (We) consent to EWM to disclose the following information:</p>
  <ol style="margin:6px 0 12px 24px;padding:0;">
    <li>A brief summary of my personal and professional life;</li>
    <li>A generalization of the matters I discussed with EWM;</li>
    <li>Whether EWM believes that I am a candidate as referenced above, in general;</li>
    <li>Whether EWM believes that I am a candidate as referenced above for the intended parents that have been presented by the Referring Agency/Clinic if applicable; and</li>
    <li>Any other elements of the mental health screening that EWM feels are relevant to my participation.</li>
  </ol>
  <p>I (We) hereby give consent for information gathered during this evaluation to be disclosed to the individual(s) or organizations to the following:</p>
  <p style="padding-left:20px;"><strong>${agencyName}</strong> &nbsp;&nbsp; Referring Agency/Professional &nbsp; / &nbsp; Treating Physician/Clinic</p>
  <p>I (We) understand there may be ongoing contact between Ellen Winters Miller (EWM) and such parties for the duration of my affiliation with those individuals or organizations and, as such, I (We) acknowledge that EWM's opinion relative to any of the above enumerated allowable disclosures may change.</p>
  <p>The notes and all other data collected by EWM remain the property of Ellen Winters Miller, L.M.F.T. and as such shall not be released to additional parties, including but not limited to, the candidate as referenced above and/or other mental health providers unless required by a federal, state or local law, rule or regulation. I (We) understand that this evaluation is based on information provided at the time of the assessment/interview and is confirmed as accurate by the presence of my signature on this document. I (We) am aware that my emotional and mental health status may change over time and that the findings based on the screening conducted today do not necessarily reflect the circumstances of my life at some point in the future. I (We) hereby release Ellen Winters Miller, L.M.F.T and its employees from any legal liability that may develop as a result of my decision to become an egg donor, embryo donor, sperm donor or gestational carrier. The results of any psychological screening conducted by EWM shall be considered 'invalid' exactly 12 months after the date EWM performed the screening. I (We) understand that all data, reports and records associated with this assessment may be destroyed on the date the contents are deemed invalid or anytime thereafter.</p>
  <p style="margin-top:12px;">${initInline('init_gc_ew2', 'gc')}${isEWPartnered ? ` ${initInline('init_partner_ew2', 'partner')}` : ''} I (We) have requested and received a copy of this document for my records.</p>
  <p>_______ I (We) have NOT requested nor received a copy of this document for my records.</p>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:18px;border-top:1px solid #ccc;padding-top:10px;">
    <tr>
      <td style="padding:8px 0;">${nameVal(gcName)}<br/><span style="font-size:10px;color:#666;">Participant Printed Name</span></td>
      <td style="padding:8px 0;">${sigInline('sig_gc_ew2', 'gc')}<br/><span style="font-size:10px;color:#666;">Participant Signature</span></td>
      <td style="padding:8px 0;">${dateVal('gc')}<br/><span style="font-size:10px;color:#666;">Date</span></td>
    </tr>
    ${partnerBlock('sig_partner_ew2')}
  </table>`)
    }

    if (pageId === 'ew3') {
      return wrap(`
  ${headerEWM}
  <h2 style="font-size:13px;font-weight:700;color:#000;text-align:center;margin:8px 0 12px;line-height:1.3;">INFORMED CONSENT FOR PARTICIPANTS IN<br/>THIRD PARTY ASSISTED REPRODUCTION</h2>
  <p>It is impossible to state with any degree of certainty or specificity the implications of your participation in a program where you will be the (please check all that apply):</p>
  <p style="padding-left:20px;">☐ Egg Donor &nbsp;&nbsp; ☐ Sperm Donor &nbsp;&nbsp; ☐ Embryo Donor &nbsp;&nbsp; <strong>☒ Gestational Carrier (Surrogate)</strong></p>
  <p>You will be having a consultation or psycho-educational session with Ellen Winters Miller, a California licensed mental health professional. This may include a discussion of your family history, potential personality difficulties and pathology that may make you an appropriate or inappropriate candidate. This session is based on the guidelines established by the American Society of Reproductive Medicine. Additionally, a discussion regarding your thoughts and feelings related to your role as a potential participant will occur, so that you can make a responsible and informed decision regarding becoming one.</p>
  <p>Depending on the procedure you are participating in, a number of areas of potential difficulty are discussed, including but not limited to:</p>
  <ol style="margin:6px 0 12px 24px;padding:0;">
    <li>Contact with the Intended Parents</li>
    <li>Planning for pregnancy and the ramifications on your personal/professional life.</li>
    <li>Discontinuity of the traditional biological connectedness experienced in the parent-child relationship</li>
    <li>Curiosity regarding the potential child or children.</li>
    <li>Possible feelings and questions that may arise in the future.</li>
    <li>Options and ramifications of choices regarding disclosure to family and friends.</li>
  </ol>
  <p>By signing this document, you acknowledge that you have been informed of the potential mental health risks involved with your participation in collaborative reproduction to the best of our ability at this time. You acknowledge that you are a willing participant and that neither Ellen Winters Miller, nor anyone else in a program with which she is associated, has acted in a coercive manner or pressured you to participate in any way.</p>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:18px;border-top:1px solid #ccc;padding-top:10px;">
    <tr>
      <td style="padding:8px 0;">${nameVal(gcName)}<br/><span style="font-size:10px;color:#666;">3rd Party Participant Printed Name</span></td>
      <td style="padding:8px 0;">${sigInline('sig_gc_ew3', 'gc')}<br/><span style="font-size:10px;color:#666;">Signature</span></td>
      <td style="padding:8px 0;">${dateVal('gc')}<br/><span style="font-size:10px;color:#666;">Date</span></td>
    </tr>
    ${partnerBlock('sig_partner_ew3')}
  </table>`)
    }

    if (pageId === 'ew4') {
      return wrap(`
  ${headerEWM}
  <h2 style="font-size:13px;font-weight:700;color:#000;text-align:center;margin:8px 0 12px;line-height:1.3;">RELEASE OF INFORMATION</h2>
  <p>I, (We) <strong>${nameVal(gcName)}</strong>${isEWPartnered ? `<br/>and <strong>${nameVal(partnerName)}</strong>` : ''}</p>
  <p>will be speaking with Ellen Winters Miller, M.A., L.M.F.T. (EWM) at the request of <strong>${agencyName}</strong>.</p>
  <p>I (We) understand that:</p>
  <p>There may be ongoing discussions between EWM and those persons noted above regarding me (us) as long as I am a participant in a program involving EWM.</p>
  <p>Documents regarding our current or previous conversations and/or screenings may be released to the persons listed above.</p>
  <p><strong>Additionally:</strong> many final contracts between surrogates and intended parents state:</p>
  <blockquote style="margin:8px 0 8px 20px;padding-left:12px;border-left:3px solid #ccc;color:#333;">
    <p>"Upon request, the Intended Parent shall be provided with a written psychological profile of the Surrogate."</p>
    <p>"The Surrogate represents that she has signed a psychotherapist release allowing the psychotherapist to disclose to the Intended Parents, Physician and/or Agency communications, verbal or non-verbal, made by the Surrogate, during the course of her discussions and/or counseling, including any opinions, perceptions or conclusions formed by the psychotherapist which could reasonably relate to the Surrogate's performance pursuant to the terms of the Surrogate Contract."</p>
  </blockquote>
  <p>This Release of Information fulfills the parameters listed above.</p>
  <p>A photocopy or facsimile of this form is to be considered as valid as the original.</p>
  <p>This authorization shall become effective on ${dateVal('gc')} and will expire one year from this date.</p>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:18px;border-top:1px solid #ccc;padding-top:10px;">
    <tr>
      <td style="padding:8px 0;width:60%;">${sigInline('sig_gc_ew4', 'gc')}<br/><span style="font-size:10px;color:#666;">Signature</span></td>
      <td style="padding:8px 0;">${dateVal('gc')}<br/><span style="font-size:10px;color:#666;">Date</span></td>
    </tr>
    ${isEWPartnered ? `
    <tr>
      <td style="padding:8px 0;">${sigInline('sig_partner_ew4', 'partner')}<br/><span style="font-size:10px;color:#666;">Spouse/Partner Signature</span></td>
      <td style="padding:8px 0;">${dateVal('partner')}<br/><span style="font-size:10px;color:#666;">Date</span></td>
    </tr>` : ''}
  </table>`)
    }

    if (pageId === 'ew5') {
      // Surrogate-only — only rendered for single or for GC copy of partnered
      return wrap(`
  ${headerEWM}
  <h2 style="font-size:13px;font-weight:700;color:#000;text-align:center;margin:8px 0 12px;line-height:1.3;">REFERRAL FOR PSYCHOLOGICAL TESTING AND<br/>RELEASE OF INFORMATION</h2>
  <p>I, <strong>${nameVal(gcName)}</strong> (Name of Prospective Gestational Candidate), understand that, at the request of <strong>${agencyName}</strong>, I am completing the Minnesota Multiphasic Personality Inventory-2 (MMPI) or the Personality Assessment Inventory (PAI). The interpretative results and narrative report from this testing will be issued to Ellen Winters Miller.</p>
  <p>By signing this document, I understand that Ellen Winters Miller may release information regarding the treatment considerations and suitability to be a gestational carrier, egg donor or sperm donor as reflected by this testing to the Agency/medical personnel/specific intended parents with whom I may be matched and to whom it may be relevant. She will NOT be releasing my responses on the testing instrument or the actual report to the Agency/medical personnel/specific intended parents with whom I may be matched or to myself.</p>
  <p>I acknowledge that I am a willing participant in this examination and that neither Ellen Winters Miller, nor anyone else in a program with which she is associated, has acted in a coercive manner or pressured me to participate in any way.</p>
  <p>A photocopy or facsimile of this form is to be considered as valid as the original.</p>
  <p>This authorization shall become effective on ${dateVal('gc')} and will expire one year from this date.</p>
  <p style="margin-top:12px;">${initInline('init_gc_ew5', 'gc')} I have requested and received a copy of this Referral for Testing.</p>
  <p>_______ I do not wish to receive a copy of this Referral for Testing.</p>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:18px;border-top:1px solid #ccc;padding-top:10px;">
    <tr>
      <td style="padding:8px 0;width:60%;">${nameVal(gcName)}<br/><span style="font-size:10px;color:#666;">Print Name</span></td>
      <td style="padding:8px 0;">${sigInline('sig_gc_ew5', 'gc')}<br/><span style="font-size:10px;color:#666;">Signature</span></td>
    </tr>
    <tr>
      <td style="padding:8px 0;" colspan="2">${dateVal('gc')}<br/><span style="font-size:10px;color:#666;">Date</span></td>
    </tr>
  </table>`)
    }
  }

  return `<div style="padding:20px;color:#999;">Unknown page: ${pageId}</div>`
}

/**
 * Generate the full combined HTML for a release form (all pages stacked with page breaks) — used for PDF output.
 */
export function generateReleaseFormHtml(template, values, signatures, initials, options = {}) {
  const pages = (template.pages || []).map(p =>
    `<div style="page-break-after:always;margin-bottom:40px;">${generateReleasePageHtml(p.id, template, values, signatures, initials, options)}</div>`
  )
  return pages.join('\n')
}

export function generateAuditTrailHtml(signerName, signerEmail, signatureTypes = {}) {
  const signedAt = new Date()
  const sigEntries = Object.entries(signatureTypes).map(([id, sig]) =>
    `<tr><td style="padding:4px 0;"><strong>${id}:</strong></td><td>${sig.type === 'drawn' ? 'Hand-drawn' : 'Typed'} — ${sig.name || ''}</td></tr>`
  ).join('')

  return `
<div style="font-family: Arial, sans-serif; padding: 40px; color: #000; font-size: 12px; line-height: 1.5;">
  <div style="border-top: 2px solid #1A3638; padding-top: 20px;">
    <p style="font-weight: 700; color: #1A3638; font-size: 14px; margin: 0 0 12px 0;">ELECTRONIC SIGNATURE CERTIFICATE</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <tr><td style="padding: 4px 0; width: 180px;"><strong>Completed:</strong></td><td>${signedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</td></tr>
      <tr><td style="padding: 4px 0;"><strong>Signer:</strong></td><td>${signerName}</td></tr>
      <tr><td style="padding: 4px 0;"><strong>Email:</strong></td><td>${signerEmail}</td></tr>
      ${sigEntries}
      <tr><td style="padding: 4px 0;"><strong>IP Address:</strong></td><td>Captured at signing</td></tr>
    </table>
    <p style="margin-top: 16px; font-size: 10px; color: #555; border-top: 1px solid #ccc; padding-top: 12px;">
      Electronically signed via North Star Surrogacy (app.northstarsurrogacy.com) in accordance with the ESIGN Act and UETA. A tamper-proof audit trail has been recorded for each signature event.
    </p>
  </div>
</div>`
}

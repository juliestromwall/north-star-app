// GC Application Template — First Star
// Source: docs/GC_APPLICATION_SPEC.md (2026-05-26 rebuild)
// Rendered by src/components/forms/FormRenderer.jsx
//
// Field schema:
//   key          — storage key inside answers[sectionKey][key]
//   label        — text shown to applicant
//   type         — text | textarea | yesno | select | date | email | tel | number | state
//   required     — boolean (only enforced when visible per showWhen)
//   group        — visual subsection label inside the section
//   span         — 'full' to span the full grid width (default: auto)
//   rows         — textarea row count (default: 3)
//   placeholder  — input placeholder text
//   options      — for type 'select': [{ value, label }]
//   showWhen     — { field, equals?, notEquals?, in?, notIn? } visibility predicate
//   prefillFrom  — dot-path into profileData (e.g. 'narrative.travelComfort')
//   help         — optional helper text below the field

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
]

const MARITAL_OPTIONS = [
  'Single','Married','Domestic Partner','Engaged','Separated','Divorced','Widowed',
].map(v => ({ value: v, label: v }))

const EDUCATION_OPTIONS = [
  { value: 'High School', label: 'High School' },
  { value: 'Some College', label: 'Some College' },
  { value: 'Associate', label: "Associate's Degree" },
  { value: 'Bachelor', label: "Bachelor's Degree" },
  { value: 'Master', label: "Master's Degree" },
  { value: 'Doctorate', label: 'Doctorate' },
  { value: 'Other', label: 'Other' },
]

const STATE_OPTIONS = US_STATES.map(s => ({ value: s, label: s }))

const yn = (key, label, opts = {}) => ({ key, label, type: 'yesno', required: true, ...opts })
const ynDetail = (key, label, opts = {}) => [
  yn(key, label, opts),
  { key: `${key}_details`, label: opts.detailLabel || 'Please describe', type: 'textarea', span: 'full', rows: 2,
    group: opts.group, showWhen: { field: key, equals: opts.detailWhen || 'yes' },
    prefillFrom: opts.prefillFrom ? `${opts.prefillFrom}_details` : undefined },
]
const ta = (key, label, opts = {}) => ({ key, label, type: 'textarea', required: true, span: 'full', rows: 3, ...opts })
const txt = (key, label, opts = {}) => ({ key, label, type: 'text', required: true, ...opts })

export default {
  id: 'applicationGc',
  title: 'GC Application',
  description: 'Application form completed after profile approval.',
  sections: [
    // ──────────────────────────────────────────────────────────────
    // 1. Personal Information
    // ──────────────────────────────────────────────────────────────
    {
      key: '_personalInfo',
      title: 'Personal Information',
      description: 'About you and your household',
      fields: [
        // Identity
        txt('fullLegalName', 'Full Legal Name', { group: 'Identity' }),
        { key: 'preferredName', label: 'Preferred Name / Nickname', type: 'text', group: 'Identity' },
        { key: 'dob', label: 'Date of Birth', type: 'date', required: true, group: 'Identity' },
        { key: 'pronouns', label: 'Pronouns', type: 'text', group: 'Identity', placeholder: 'she/her' },

        // Contact & Address
        txt('street', 'Street Address', { group: 'Contact & Address', span: 'full' }),
        txt('city', 'City', { group: 'Contact & Address' }),
        { key: 'state', label: 'State', type: 'select', required: true, group: 'Contact & Address', options: STATE_OPTIONS },
        txt('zipCode', 'Zip Code', { group: 'Contact & Address' }),
        { key: 'phone', label: 'Phone Number', type: 'tel', required: true, group: 'Contact & Address', placeholder: 'xxx-xxx-xxxx' },
        { key: 'email', label: 'Email Address', type: 'email', required: true, group: 'Contact & Address', placeholder: 'name@example.com' },

        // Relationship & Family
        { key: 'maritalStatus', label: 'Marital / Relationship Status', type: 'select', required: true, group: 'Relationship & Family', options: MARITAL_OPTIONS },
        txt('spouseName', "Spouse's Name", { group: 'Relationship & Family', showWhen: { field: 'maritalStatus', notEquals: 'Single' } }),
        { key: 'spouseDob', label: "Spouse's DOB", type: 'date', required: true, group: 'Relationship & Family', showWhen: { field: 'maritalStatus', notEquals: 'Single' } },
        txt('partnerDuration', 'How long have you been with your partner/spouse?', { group: 'Relationship & Family', span: 'full', placeholder: 'e.g. 5 years', showWhen: { field: 'maritalStatus', notEquals: 'Single' } }),
        ta('children', 'Do you have children? If yes, list ages.', { group: 'Relationship & Family', rows: 2 }),
        ta('household', 'Who lives in your household?', { group: 'Relationship & Family', rows: 2 }),

        // Logistics
        yn('reliableTransportation', 'Reliable transportation?', { group: 'Logistics' }),
        yn('usCitizen', 'U.S. citizen or permanent resident?', { group: 'Logistics' }),
        yn('willingToTravel', 'Willing to travel for appointments / transfer?', { group: 'Logistics', prefillFrom: 'narrative.travelComfort' }),
        { key: 'willingToTravel_details', label: 'Please describe (optional)', type: 'textarea', group: 'Logistics', span: 'full', rows: 2,
          showWhen: { field: 'willingToTravel', equals: 'yes' }, prefillFrom: 'narrative.travelComfort_details' },
        txt('languages', 'What languages do you speak?', { group: 'Logistics' }),
        txt('howHeardAboutAgency', 'How did you hear about our agency?', { group: 'Logistics' }),

        // Motivation
        ta('whyInterested', 'Why are you interested in becoming a surrogate?', { group: 'Motivation', prefillFrom: 'narrative.whyConsider' }),
        ta('motivates', 'What motivates you most about this journey?', { group: 'Motivation', prefillFrom: 'narrative.whyConsider' }),
        ta('hopingToGain', 'What are you hoping to gain personally or emotionally?', { group: 'Motivation', prefillFrom: 'narrative.hopingToGain' }),
      ],
    },

    // ──────────────────────────────────────────────────────────────
    // 2. Employment & Education
    // ──────────────────────────────────────────────────────────────
    {
      key: '_employment',
      title: 'Employment & Education',
      description: 'Work, education, and finances',
      fields: [
        txt('occupation', 'Current occupation', { group: 'Employment' }),
        txt('employer', 'Current employer', { group: 'Employment' }),
        txt('employmentDuration', 'How long employed there', { group: 'Employment' }),
        ta('workSchedule', 'What does your work schedule look like?', { group: 'Employment', rows: 2, prefillFrom: 'narrative.workChildcareSchedule' }),
        ...ynDetail('maternityLeave', 'Does your employer offer maternity leave benefits?', { group: 'Employment' }),
        ...ynDetail('workChangesPregnancy', 'Will your work responsibilities change during pregnancy?', { group: 'Employment' }),

        { key: 'educationLevel', label: 'Highest level of education completed', type: 'select', required: true, group: 'Education', options: EDUCATION_OPTIONS },

        yn('twoIncomeHousehold', 'Two-income household?', { group: 'Finances' }),
        ...ynDetail('bankruptcy', 'Ever filed for bankruptcy?', { group: 'Finances' }),
        ...ynDetail('governmentAssistance', 'Currently receiving government assistance?', { group: 'Finances' }),
      ],
    },

    // ──────────────────────────────────────────────────────────────
    // 3. Social & Family
    // ──────────────────────────────────────────────────────────────
    {
      key: '_social',
      title: 'Social & Family',
      description: 'Your relationships and lifestyle',
      fields: [
        // Partner / family
        ta('partnerRelationship', 'Describe your relationship with your partner/spouse.', { group: 'Relationships', rows: 3, required: false }),
        ta('partnerFeelings', 'How does your partner/spouse feel about surrogacy?', { group: 'Relationships', prefillFrom: 'narrative.partnerFamilyFeelings' }),
        ...ynDetail('familyFriendsSupport', 'Do your family and close friends support your decision?', { group: 'Relationships', prefillFrom: 'narrative.partnerFamilyFeelings' }),
        txt('primarySupportPerson', 'Who will be your primary support person during pregnancy and recovery?', { group: 'Relationships', span: 'full', prefillFrom: 'narrative.helpDuringPregnancyRecovery' }),

        // Parenting & lifestyle
        ta('parentingStyle', 'Describe your parenting style.', { group: 'Lifestyle' }),
        ta('familyActivities', 'What do you enjoy doing as a family?', { group: 'Lifestyle' }),
        ta('hobbies', 'What hobbies or interests are important to you?', { group: 'Lifestyle', prefillFrom: 'narrative.hobbies' }),
        ta('handleStress', 'How do you typically handle stress?', { group: 'Lifestyle', prefillFrom: 'narrative.selfCareDuringStress' }),
        ta('selfCare', 'What does self-care look like for you?', { group: 'Lifestyle', prefillFrom: 'narrative.selfCareDuringStress' }),

        // Values & traditions
        ...ynDetail('religiousBeliefs', 'Religious, spiritual, or cultural beliefs that may impact your journey?', { group: 'Values', prefillFrom: 'narrative.culturalReligiousBeliefs' }),
        ...ynDetail('familyTraditions', 'Family traditions or values especially important to you?', { group: 'Values', prefillFrom: 'narrative.importantValues' }),

        // Personality & communication
        ta('friendsPersonalityDesc', 'How would your friends describe your personality?', { group: 'Personality & Communication', prefillFrom: 'narrative.howOthersDescribe' }),
        ta('handleConflict', 'How do you typically handle conflict or disagreements?', { group: 'Personality & Communication', prefillFrom: 'narrative.conflictHandling' }),
        ta('relationshipWithIPs', 'What type of relationship are you hoping to have with Intended Parents?', { group: 'Personality & Communication', prefillFrom: 'narrative.relationshipHope' }),
        ta('commFrequency', 'How often would you ideally like communication during the journey?', { group: 'Personality & Communication', prefillFrom: 'narrative.communicationFreq' }),
        ...ynDetail('ongoingContactAfter', 'Are you hoping for ongoing contact after delivery?', { group: 'Personality & Communication', prefillFrom: 'narrative.openFutureContact' }),
      ],
    },

    // ──────────────────────────────────────────────────────────────
    // 4. Background
    // ──────────────────────────────────────────────────────────────
    {
      key: '_background',
      title: 'Background',
      description: 'Screening questions',
      fields: [
        ...ynDetail('criminalHistory', 'Have you or anyone in your household ever been arrested or convicted of a crime?', { group: 'Legal & Household' }),
        ...ynDetail('cpsInvolvement', 'Have you or anyone in your household ever had involvement with Child Protective Services?', { group: 'Legal & Household' }),
        ...ynDetail('legalDispute', 'Have you ever been involved in a legal dispute related to custody or family matters?', { group: 'Legal & Household' }),

        ...ynDetail('nicotineEver', 'Have you ever smoked cigarettes or used nicotine products?', { group: 'Substances', detailLabel: 'When did you stop, and how often did you use?' }),
        ...ynDetail('recreationalDrugs', 'Have you ever used recreational drugs?', { group: 'Substances' }),
        ...ynDetail('alcohol', 'Do you consume alcohol?', { group: 'Substances', detailLabel: 'How often?' }),
        ...ynDetail('substanceAbuse', 'Have you ever struggled with substance abuse?', { group: 'Substances' }),

        ...ynDetail('mentalHealthDx', 'Have you ever been diagnosed with depression, anxiety, PTSD, or another mental health condition?', { group: 'Mental Health', detailLabel: 'Which condition(s), when, and what treatment?' }),
        ...ynDetail('counselingTherapy', 'Have you ever attended counseling or therapy?', { group: 'Mental Health', detailLabel: 'When, and what was the reason?' }),
        ...ynDetail('mentalHealthMeds', 'Have you ever taken medication for mental health concerns?', { group: 'Mental Health', detailLabel: 'Which, when, and are you still taking them?' }),

        ...ynDetail('domesticViolence', 'Have you ever experienced domestic violence or abuse?', { group: 'Safety' }),
        // safeInHome — detail textarea shows when answer is 'no' (per spec)
        yn('safeInHome', 'Do you feel safe in your current relationship and home environment?', { group: 'Safety' }),
        { key: 'safeInHome_details', label: 'Please describe', type: 'textarea', group: 'Safety', span: 'full', rows: 2,
          showWhen: { field: 'safeInHome', equals: 'no' } },

        ta('socialMediaAccounts', 'List the social media accounts you actively use (platforms + handles).', { group: 'Social Media' }),
        ...ynDetail('ipsViewSocialMedia', 'Are you comfortable with Intended Parents viewing your social media?', { group: 'Social Media' }),

        // privateDiscussion is the one optional Q in this section
        yn('privateDiscussion', 'Is there anything in your personal background you would like to discuss privately?', { group: 'Private', required: false }),
        { key: 'privateDiscussion_details', label: 'What would you like to discuss?', type: 'textarea', group: 'Private', span: 'full', rows: 3,
          showWhen: { field: 'privateDiscussion', equals: 'yes' } },
      ],
    },

    // ──────────────────────────────────────────────────────────────
    // 5. Pregnancy History
    // Counts and outcomes up top, then the narrative questions. Per-pregnancy
    // provider detail is collected separately in the Clinic & Hospital Form.
    // ──────────────────────────────────────────────────────────────
    {
      key: '_pregnancyHistory',
      title: 'Pregnancy History',
      description: 'Your pregnancy and delivery experience',
      fields: [
        { key: 'totalPregnancies', label: 'How many times have you been pregnant?', type: 'number', required: true, group: 'Pregnancy Details' },
        { key: 'fullTermDeliveries', label: 'How many full-term deliveries have you had?', type: 'number', required: true, group: 'Pregnancy Details' },
        ta('pregnancyList', 'Please list all pregnancies, including year and outcome.', {
          group: 'Pregnancy Details', rows: 4,
          placeholder: 'e.g. 2019 — live birth, full term\n2021 — miscarriage at 9 weeks',
        }),
        ...ynDetail('lossesOrTerminations', 'Have you had any miscarriages, ectopic pregnancies, or terminations?', {
          group: 'Pregnancy Details', detailLabel: 'Please describe (year and circumstances)',
        }),
        yn('cSectionEver', 'Have you ever delivered via C-section?', { group: 'Pregnancy Details' }),
        { key: 'cSectionCount', label: 'How many C-sections have you had?', type: 'number', required: true,
          group: 'Pregnancy Details', showWhen: { field: 'cSectionEver', equals: 'yes' } },
        yn('vbac', 'Have you ever had a VBAC (vaginal birth after cesarean)?', {
          group: 'Pregnancy Details', showWhen: { field: 'cSectionEver', equals: 'yes' } }),

        ...ynDetail('complications', 'Pregnancy complications? (gestational diabetes, preeclampsia, hemorrhage, preterm labor)', { group: 'Pregnancy Details', prefillFrom: 'narrative.complicationsNarrative' }),
        ...ynDetail('pregnanciesHealthy', 'Were your pregnancies generally healthy?', { group: 'Pregnancy Details' }),
        ...ynDetail('nauseaOrBedrest', 'Did you experience significant nausea or bedrest during pregnancy?', { group: 'Pregnancy Details' }),
        ta('postpartumRecovery', 'How long was your postpartum recovery typically?', { group: 'Pregnancy Details', rows: 2, prefillFrom: 'narrative.recoveryAfterBirth' }),

        ...ynDetail('regularMenstrualCycles', 'Do you currently have regular menstrual cycles?', { group: 'Current Status', detailWhen: 'no', detailLabel: 'Please describe' }),
        ...ynDetail('birthControl', 'Are you currently taking birth control?', { group: 'Current Status', detailLabel: 'Type' }),
        ...ynDetail('advisedNotPregnantAgain', 'Have you ever been advised not to become pregnant again?', { group: 'Current Status' }),

        yn('previouslySurrogate', 'Have you ever previously been a surrogate?', { group: 'Surrogacy', prefillFrom: 'narrative.beenSurrogateBefore' }),
        { key: 'describePreviousSurrogacy', label: 'Describe your previous surrogacy journey', type: 'textarea', span: 'full', rows: 3, group: 'Surrogacy',
          showWhen: { field: 'previouslySurrogate', equals: 'yes' }, prefillFrom: 'narrative.beenSurrogateBefore_details' },
      ],
    },

    // ──────────────────────────────────────────────────────────────
    // 6. Health History
    // ──────────────────────────────────────────────────────────────
    {
      key: '_healthHistory',
      title: 'Health History',
      description: 'Medical history and lifestyle',
      fields: [
        // Body & providers
        txt('height', 'Height', { group: 'Body & Providers', placeholder: "5'6\"" }),
        { key: 'weight', label: 'Weight (lbs)', type: 'number', required: true, group: 'Body & Providers' },
        txt('pcp', 'Primary care physician name and clinic', { group: 'Body & Providers', span: 'full' }),
        txt('obGyn', 'OB/GYN name and clinic', { group: 'Body & Providers', span: 'full' }),

        // Current
        ...ynDetail('medications', 'Currently taking any medications?', { group: 'Current Treatment', detailLabel: 'List medications and dosage' }),
        ...ynDetail('vitaminsSupplements', 'Taking vitamins or supplements?', { group: 'Current Treatment', detailLabel: 'List vitamins/supplements' }),
        ...ynDetail('allergies', 'Allergies?', { group: 'Current Treatment', detailLabel: 'List allergies' }),

        // History
        ...ynDetail('surgeryHistory', 'Ever had surgery?', { group: 'Medical History', detailLabel: 'What surgeries and when?' }),
        ...ynDetail('bloodTransfusion', 'Ever received a blood transfusion?', { group: 'Medical History', detailLabel: 'When and why?' }),
        ...ynDetail('chronicConditions', 'Any chronic medical conditions?', { group: 'Medical History', detailLabel: 'List conditions' }),
        ...ynDetail('highBloodPressure', 'Ever diagnosed with high blood pressure?', { group: 'Medical History' }),
        ...ynDetail('diabetes', 'Ever diagnosed with diabetes or gestational diabetes?', { group: 'Medical History' }),
        ...ynDetail('thyroid', 'History of thyroid disorders?', { group: 'Medical History' }),
        ...ynDetail('migrainesPain', 'Migraines or chronic pain?', { group: 'Medical History' }),
        ...ynDetail('abnormalPap', 'Ever had abnormal pap smears?', { group: 'Medical History' }),
        ...ynDetail('sti', 'Ever had a sexually transmitted infection?', { group: 'Medical History' }),
        ...ynDetail('hospitalized', 'Ever been hospitalized?', { group: 'Medical History', detailLabel: 'When and why?' }),

        // Vaccines
        yn('covidVaccine', 'Have you received the COVID-19 vaccine?', { group: 'Vaccines' }),
        yn('routineVaccines', 'Are your routine vaccines up to date?', { group: 'Vaccines' }),
        ...ynDetail('vaccinesDuringJourney', 'Are you willing to receive vaccines during your surrogacy journey if recommended?', { group: 'Vaccines' }),

        // Lifestyle
        ...ynDetail('exerciseRegularly', 'Do you exercise regularly?', { group: 'Lifestyle', detailLabel: 'Type and frequency' }),
        ta('eatingHabits', 'How would you describe your eating habits?', { group: 'Lifestyle', rows: 2 }),
        ...ynDetail('dietaryRestrictions', 'Any dietary restrictions?', { group: 'Lifestyle', detailLabel: 'Please describe' }),

        // Family + concerns
        ...ynDetail('familyMedicalHistory', 'Significant family medical history we should know about?', { group: 'Family & Concerns', detailLabel: 'Please describe' }),
        ...ynDetail('healthConcernsEligibility', 'Anything regarding your health history you are concerned may affect eligibility?', { group: 'Family & Concerns', detailLabel: 'Please describe' }),
      ],
    },

    // ──────────────────────────────────────────────────────────────
    // 7. Surrogacy Journey Expectations
    // ──────────────────────────────────────────────────────────────
    {
      key: '_journeyExpectations',
      title: 'Surrogacy Journey Expectations',
      description: 'Your hopes, preferences, and boundaries',
      fields: [
        ta('bestFitIPs', 'What kind of Intended Parents do you feel would be the best fit for you?', { group: 'IP Preferences', prefillFrom: 'narrative.bestFitIPs' }),
        ...ynDetail('openSingleParents', 'Are you open to working with single parents?', { group: 'IP Preferences' }),
        ...ynDetail('openLGBTQ', 'Are you open to working with LGBTQ+ Intended Parents?', { group: 'IP Preferences' }),
        ...ynDetail('openInternational', 'Are you open to international Intended Parents?', { group: 'IP Preferences', prefillFrom: 'narrative.openOtherStateCountry' }),

        ta('communicationLevel', 'What level of communication are you hoping for during the journey?', { group: 'Communication & Involvement', prefillFrom: 'narrative.communicationFreq' }),
        ta('ipInvolvementPregnancy', 'How involved would you like Intended Parents to be during pregnancy?', { group: 'Communication & Involvement', prefillFrom: 'narrative.ipInvolvementDuringPregnancy' }),
        ta('ipAttendingAppts', 'How do you feel about Intended Parents attending appointments?', { group: 'Communication & Involvement', prefillFrom: 'narrative.ipAttendingAppointments' }),

        ...ynDetail('willingTwins', 'Are you willing to carry twins if medically approved?', { group: 'Medical Decisions' }),
        ta('selectiveReduction', 'What are your thoughts regarding selective reduction?', { group: 'Medical Decisions' }),
        ta('terminationMedical', 'What are your thoughts regarding termination for medical reasons?', { group: 'Medical Decisions' }),

        ...ynDetail('comfortableInjectables', 'Are you comfortable taking injectable medications and attending fertility appointments?', { group: 'Process Comfort' }),
        ...ynDetail('abstainSubstances', 'Are you willing to abstain from alcohol, nicotine, and recreational substances during the process?', { group: 'Process Comfort' }),
        ...ynDetail('psychAndBackground', 'Would you be willing to undergo psychological evaluation and background screening?', { group: 'Process Comfort' }),
        ...ynDetail('pumpingBreastMilk', 'Are you open to pumping breast milk after delivery?', { group: 'Process Comfort' }),

        ta('deliveryHopes', 'What are your hopes for the delivery experience?', { group: 'Delivery & Boundaries', prefillFrom: 'narrative.deliveryHopes' }),
        ta('whoPresentLaborDelivery', 'Who would you like present during labor and delivery?', { group: 'Delivery & Boundaries', prefillFrom: 'narrative.whoPresentLaborDelivery' }),
        ta('boundariesImportant', 'What boundaries are important for you during this journey?', { group: 'Delivery & Boundaries', prefillFrom: 'narrative.boundariesImportant' }),
        ta('feelRespectedSupported', 'What would make you feel respected and supported throughout the process?', { group: 'Delivery & Boundaries', prefillFrom: 'narrative.respectedSupported' }),

        ta('concernsFears', 'What concerns or fears do you have about surrogacy?', { group: 'Final Thoughts' }),
        ta('excitesMost', 'What excites you most about becoming a surrogate?', { group: 'Final Thoughts', prefillFrom: 'narrative.excitedAbout' }),
        { key: 'additionalHopes', label: 'Is there anything else you would like us to know about your hopes or expectations for this journey?', type: 'textarea', span: 'full', rows: 3, group: 'Final Thoughts' },
      ],
    },

    // ──────────────────────────────────────────────────────────────
    // 8. Clinic & Hospital Form
    // Special: renders the legacy ClinicHospitalForm widget (per-pregnancy
    // structured fields) via a `customComponent` escape hatch in the renderer.
    // ──────────────────────────────────────────────────────────────
    {
      key: '_clinicHospital',
      title: 'Clinic & Hospital Form',
      description: 'Provider information for each pregnancy',
      customComponent: 'ClinicHospitalForm',
    },
  ],
}

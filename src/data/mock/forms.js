// Mock form definitions for the in-app builder (/forms).
//
// 2026-05-26: replaced the four demo forms with the actual North Star GC
// Application — 124 fields across 7 CSV-sourced sections plus an 8th
// Clinic & Hospital section encoded from the legacy hand-coded widget.
// Single source of truth was src/data/formTemplates/applicationGc.js; the
// conversion below preserves field IDs (semantic keys, not f1/f2), section
// IDs, groups, prefillFrom dot-paths, and showWhen conditionals.
//
// Until Supabase persistence lands, saves in /forms/builder don't survive
// reload — edits to this data are temporary. For permanent changes, edit
// this file directly.

// ── Field helpers ────────────────────────────────────────
// Keep field defs terse. Spread `...ynD()` returns the yes/no field plus
// a conditional detail textarea shown when the answer matches.
const yn = (id, label, opts = {}) => ({ id, type: 'yesno', label, required: true, ...opts })
const ynD = (id, label, opts = {}) => ([
  yn(id, label, opts),
  {
    id: `${id}_details`,
    type: 'textarea',
    label: opts.detailLabel || 'Please describe',
    group: opts.group,
    showWhen: { field: id, op: 'equals', value: opts.detailWhen || 'yes' },
    prefillFrom: opts.prefillFrom ? `${opts.prefillFrom}_details` : undefined,
  },
])
const ta = (id, label, opts = {}) => ({ id, type: 'textarea', label, required: true, ...opts })
const txt = (id, label, opts = {}) => ({ id, type: 'text', label, required: true, ...opts })

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
const MARITAL = ['Single', 'Married', 'Domestic Partner', 'Engaged', 'Separated', 'Divorced', 'Widowed']
const EDUCATION = ['High School', 'Some College', "Associate's Degree", "Bachelor's Degree", "Master's Degree", 'Doctorate', 'Other']

export const mockFormDefinitions = [
  {
    id: 'form-surrogate-app',
    title: 'Surrogate Application',
    description: 'Application completed after profile approval.',
    status: 'draft',
    submissionCount: 0,
    createdAt: '2026-05-26',
    updatedAt: '2026-05-26',
    assignedRoles: ['surrogate'],
    sections: [
      // ──────────────────────────────────────────────────────────
      // 1. Personal Information
      // ──────────────────────────────────────────────────────────
      {
        id: '_personalInfo',
        title: 'Personal Information',
        fields: [
          // Identity
          txt('fullLegalName', 'Full Legal Name', { group: 'Identity' }),
          { id: 'preferredName', type: 'text', label: 'Preferred Name / Nickname', group: 'Identity' },
          { id: 'dob', type: 'date', label: 'Date of Birth', required: true, group: 'Identity' },
          { id: 'pronouns', type: 'text', label: 'Pronouns', placeholder: 'she/her', group: 'Identity' },

          // Contact & Address
          txt('street', 'Street Address', { group: 'Contact & Address' }),
          txt('city', 'City', { group: 'Contact & Address' }),
          { id: 'state', type: 'select', label: 'State', required: true, group: 'Contact & Address', options: US_STATES },
          txt('zipCode', 'Zip Code', { group: 'Contact & Address' }),
          txt('phone', 'Phone Number', { group: 'Contact & Address', placeholder: 'xxx-xxx-xxxx' }),
          txt('email', 'Email Address', { group: 'Contact & Address', placeholder: 'name@example.com' }),

          // Relationship & Family
          { id: 'maritalStatus', type: 'select', label: 'Marital / Relationship Status', required: true, group: 'Relationship & Family', options: MARITAL },
          txt('spouseName', "Spouse's Name", { group: 'Relationship & Family', showWhen: { field: 'maritalStatus', op: 'notEquals', value: 'Single' } }),
          { id: 'spouseDob', type: 'date', label: "Spouse's DOB", required: true, group: 'Relationship & Family', showWhen: { field: 'maritalStatus', op: 'notEquals', value: 'Single' } },
          txt('partnerDuration', 'How long have you been with your partner/spouse?', { group: 'Relationship & Family', placeholder: 'e.g. 5 years', showWhen: { field: 'maritalStatus', op: 'notEquals', value: 'Single' } }),
          ta('children', 'Do you have children? If yes, list ages.', { group: 'Relationship & Family' }),
          ta('household', 'Who lives in your household?', { group: 'Relationship & Family' }),

          // Logistics
          yn('reliableTransportation', 'Reliable transportation?', { group: 'Logistics' }),
          yn('usCitizen', 'U.S. citizen or permanent resident?', { group: 'Logistics' }),
          yn('willingToTravel', 'Willing to travel for appointments / transfer?', { group: 'Logistics', prefillFrom: 'narrative.travelComfort' }),
          { id: 'willingToTravel_details', type: 'textarea', label: 'Please describe (optional)', group: 'Logistics',
            showWhen: { field: 'willingToTravel', op: 'equals', value: 'yes' }, prefillFrom: 'narrative.travelComfort_details' },
          txt('languages', 'What languages do you speak?', { group: 'Logistics' }),
          txt('howHeardAboutAgency', 'How did you hear about our agency?', { group: 'Logistics' }),

          // Motivation
          ta('whyInterested', 'Why are you interested in becoming a surrogate?', { group: 'Motivation', prefillFrom: 'narrative.whyConsider' }),
          ta('motivates', 'What motivates you most about this journey?', { group: 'Motivation', prefillFrom: 'narrative.whyConsider' }),
          ta('hopingToGain', 'What are you hoping to gain personally or emotionally?', { group: 'Motivation', prefillFrom: 'narrative.hopingToGain' }),
        ],
      },

      // ──────────────────────────────────────────────────────────
      // 2. Employment & Education
      // ──────────────────────────────────────────────────────────
      {
        id: '_employment',
        title: 'Employment & Education',
        fields: [
          txt('occupation', 'Current occupation', { group: 'Employment' }),
          txt('employer', 'Current employer', { group: 'Employment' }),
          txt('employmentDuration', 'How long employed there', { group: 'Employment' }),
          ta('workSchedule', 'What does your work schedule look like?', { group: 'Employment', prefillFrom: 'narrative.workChildcareSchedule' }),
          ...ynD('maternityLeave', 'Does your employer offer maternity leave benefits?', { group: 'Employment' }),
          ...ynD('workChangesPregnancy', 'Will your work responsibilities change during pregnancy?', { group: 'Employment' }),
          { id: 'educationLevel', type: 'select', label: 'Highest level of education completed', required: true, group: 'Education', options: EDUCATION },
          yn('twoIncomeHousehold', 'Two-income household?', { group: 'Finances' }),
          ...ynD('bankruptcy', 'Ever filed for bankruptcy?', { group: 'Finances' }),
          ...ynD('governmentAssistance', 'Currently receiving government assistance?', { group: 'Finances' }),
        ],
      },

      // ──────────────────────────────────────────────────────────
      // 3. Social & Family
      // ──────────────────────────────────────────────────────────
      {
        id: '_social',
        title: 'Social & Family',
        fields: [
          { id: 'partnerRelationship', type: 'textarea', label: 'Describe your relationship with your partner/spouse.', group: 'Relationships' },
          ta('partnerFeelings', 'How does your partner/spouse feel about surrogacy?', { group: 'Relationships', prefillFrom: 'narrative.partnerFamilyFeelings' }),
          ...ynD('familyFriendsSupport', 'Do your family and close friends support your decision?', { group: 'Relationships', prefillFrom: 'narrative.partnerFamilyFeelings' }),
          txt('primarySupportPerson', 'Who will be your primary support person during pregnancy and recovery?', { group: 'Relationships', prefillFrom: 'narrative.helpDuringPregnancyRecovery' }),

          ta('parentingStyle', 'Describe your parenting style.', { group: 'Lifestyle' }),
          ta('familyActivities', 'What do you enjoy doing as a family?', { group: 'Lifestyle' }),
          ta('hobbies', 'What hobbies or interests are important to you?', { group: 'Lifestyle', prefillFrom: 'narrative.hobbies' }),
          ta('handleStress', 'How do you typically handle stress?', { group: 'Lifestyle', prefillFrom: 'narrative.selfCareDuringStress' }),
          ta('selfCare', 'What does self-care look like for you?', { group: 'Lifestyle', prefillFrom: 'narrative.selfCareDuringStress' }),

          ...ynD('religiousBeliefs', 'Religious, spiritual, or cultural beliefs that may impact your journey?', { group: 'Values', prefillFrom: 'narrative.culturalReligiousBeliefs' }),
          ...ynD('familyTraditions', 'Family traditions or values especially important to you?', { group: 'Values', prefillFrom: 'narrative.importantValues' }),

          ta('friendsPersonalityDesc', 'How would your friends describe your personality?', { group: 'Personality & Communication', prefillFrom: 'narrative.howOthersDescribe' }),
          ta('handleConflict', 'How do you typically handle conflict or disagreements?', { group: 'Personality & Communication', prefillFrom: 'narrative.conflictHandling' }),
          ta('relationshipWithIPs', 'What type of relationship are you hoping to have with Intended Parents?', { group: 'Personality & Communication', prefillFrom: 'narrative.relationshipHope' }),
          ta('commFrequency', 'How often would you ideally like communication during the journey?', { group: 'Personality & Communication', prefillFrom: 'narrative.communicationFreq' }),
          ...ynD('ongoingContactAfter', 'Are you hoping for ongoing contact after delivery?', { group: 'Personality & Communication', prefillFrom: 'narrative.openFutureContact' }),
        ],
      },

      // ──────────────────────────────────────────────────────────
      // 4. Background
      // ──────────────────────────────────────────────────────────
      {
        id: '_background',
        title: 'Background',
        fields: [
          ...ynD('criminalHistory', 'Have you or anyone in your household ever been arrested or convicted of a crime?', { group: 'Legal & Household' }),
          ...ynD('cpsInvolvement', 'Have you or anyone in your household ever had involvement with Child Protective Services?', { group: 'Legal & Household' }),
          ...ynD('legalDispute', 'Have you ever been involved in a legal dispute related to custody or family matters?', { group: 'Legal & Household' }),

          ...ynD('nicotineEver', 'Have you ever smoked cigarettes or used nicotine products?', { group: 'Substances', detailLabel: 'When did you stop, and how often did you use?' }),
          ...ynD('recreationalDrugs', 'Have you ever used recreational drugs?', { group: 'Substances' }),
          ...ynD('alcohol', 'Do you consume alcohol?', { group: 'Substances', detailLabel: 'How often?' }),
          ...ynD('substanceAbuse', 'Have you ever struggled with substance abuse?', { group: 'Substances' }),

          ...ynD('mentalHealthDx', 'Have you ever been diagnosed with depression, anxiety, PTSD, or another mental health condition?', { group: 'Mental Health', detailLabel: 'Which condition(s), when, and what treatment?' }),
          ...ynD('counselingTherapy', 'Have you ever attended counseling or therapy?', { group: 'Mental Health', detailLabel: 'When, and what was the reason?' }),
          ...ynD('mentalHealthMeds', 'Have you ever taken medication for mental health concerns?', { group: 'Mental Health', detailLabel: 'Which, when, and are you still taking them?' }),

          ...ynD('domesticViolence', 'Have you ever experienced domestic violence or abuse?', { group: 'Safety' }),
          yn('safeInHome', 'Do you feel safe in your current relationship and home environment?', { group: 'Safety' }),
          { id: 'safeInHome_details', type: 'textarea', label: 'Please describe', group: 'Safety',
            showWhen: { field: 'safeInHome', op: 'equals', value: 'no' } },

          ta('socialMediaAccounts', 'List the social media accounts you actively use (platforms + handles).', { group: 'Social Media' }),
          ...ynD('ipsViewSocialMedia', 'Are you comfortable with Intended Parents viewing your social media?', { group: 'Social Media' }),

          { id: 'privateDiscussion', type: 'yesno', label: 'Is there anything in your personal background you would like to discuss privately?', group: 'Private' },
          { id: 'privateDiscussion_details', type: 'textarea', label: 'What would you like to discuss?', group: 'Private',
            showWhen: { field: 'privateDiscussion', op: 'equals', value: 'yes' } },
        ],
      },

      // ──────────────────────────────────────────────────────────
      // 5. Pregnancy History
      // (pregnancySummary derived-summary field type isn't in the builder
      // schema yet; the structured pregnancy widget lives on the profile.
      // Editable narrative Qs below cover the same ground.)
      // ──────────────────────────────────────────────────────────
      {
        id: '_pregnancyHistory',
        title: 'Pregnancy History',
        fields: [
          ...ynD('complications', 'Pregnancy complications? (gestational diabetes, preeclampsia, hemorrhage, preterm labor)', { group: 'Pregnancy Details', prefillFrom: 'narrative.complicationsNarrative' }),
          ...ynD('pregnanciesHealthy', 'Were your pregnancies generally healthy?', { group: 'Pregnancy Details' }),
          ...ynD('nauseaOrBedrest', 'Did you experience significant nausea or bedrest during pregnancy?', { group: 'Pregnancy Details' }),
          ta('postpartumRecovery', 'How long was your postpartum recovery typically?', { group: 'Pregnancy Details', prefillFrom: 'narrative.recoveryAfterBirth' }),

          ...ynD('regularMenstrualCycles', 'Do you currently have regular menstrual cycles?', { group: 'Current Status', detailWhen: 'no', detailLabel: 'Please describe' }),
          ...ynD('birthControl', 'Are you currently taking birth control?', { group: 'Current Status', detailLabel: 'Type' }),
          ...ynD('advisedNotPregnantAgain', 'Have you ever been advised not to become pregnant again?', { group: 'Current Status' }),

          yn('previouslySurrogate', 'Have you ever previously been a surrogate?', { group: 'Surrogacy', prefillFrom: 'narrative.beenSurrogateBefore' }),
          { id: 'describePreviousSurrogacy', type: 'textarea', label: 'Describe your previous surrogacy journey', group: 'Surrogacy',
            showWhen: { field: 'previouslySurrogate', op: 'equals', value: 'yes' }, prefillFrom: 'narrative.beenSurrogateBefore_details' },
        ],
      },

      // ──────────────────────────────────────────────────────────
      // 6. Health History
      // ──────────────────────────────────────────────────────────
      {
        id: '_healthHistory',
        title: 'Health History',
        fields: [
          txt('height', 'Height', { group: 'Body & Providers', placeholder: "5'6\"" }),
          { id: 'weight', type: 'number', label: 'Weight (lbs)', required: true, group: 'Body & Providers' },
          txt('pcp', 'Primary care physician name and clinic', { group: 'Body & Providers' }),
          txt('obGyn', 'OB/GYN name and clinic', { group: 'Body & Providers' }),

          ...ynD('medications', 'Currently taking any medications?', { group: 'Current Treatment', detailLabel: 'List medications and dosage' }),
          ...ynD('vitaminsSupplements', 'Taking vitamins or supplements?', { group: 'Current Treatment', detailLabel: 'List vitamins/supplements' }),
          ...ynD('allergies', 'Allergies?', { group: 'Current Treatment', detailLabel: 'List allergies' }),

          ...ynD('surgeryHistory', 'Ever had surgery?', { group: 'Medical History', detailLabel: 'What surgeries and when?' }),
          ...ynD('bloodTransfusion', 'Ever received a blood transfusion?', { group: 'Medical History', detailLabel: 'When and why?' }),
          ...ynD('chronicConditions', 'Any chronic medical conditions?', { group: 'Medical History', detailLabel: 'List conditions' }),
          ...ynD('highBloodPressure', 'Ever diagnosed with high blood pressure?', { group: 'Medical History' }),
          ...ynD('diabetes', 'Ever diagnosed with diabetes or gestational diabetes?', { group: 'Medical History' }),
          ...ynD('thyroid', 'History of thyroid disorders?', { group: 'Medical History' }),
          ...ynD('migrainesPain', 'Migraines or chronic pain?', { group: 'Medical History' }),
          ...ynD('abnormalPap', 'Ever had abnormal pap smears?', { group: 'Medical History' }),
          ...ynD('sti', 'Ever had a sexually transmitted infection?', { group: 'Medical History' }),
          ...ynD('hospitalized', 'Ever been hospitalized?', { group: 'Medical History', detailLabel: 'When and why?' }),

          yn('covidVaccine', 'Have you received the COVID-19 vaccine?', { group: 'Vaccines' }),
          yn('routineVaccines', 'Are your routine vaccines up to date?', { group: 'Vaccines' }),
          ...ynD('vaccinesDuringJourney', 'Are you willing to receive vaccines during your surrogacy journey if recommended?', { group: 'Vaccines' }),

          ...ynD('exerciseRegularly', 'Do you exercise regularly?', { group: 'Lifestyle', detailLabel: 'Type and frequency' }),
          ta('eatingHabits', 'How would you describe your eating habits?', { group: 'Lifestyle' }),
          ...ynD('dietaryRestrictions', 'Any dietary restrictions?', { group: 'Lifestyle', detailLabel: 'Please describe' }),

          ...ynD('familyMedicalHistory', 'Significant family medical history we should know about?', { group: 'Family & Concerns', detailLabel: 'Please describe' }),
          // healthConcernsEligibility is the one optional Q in this section, inlined to avoid required:true default from yn()
          { id: 'healthConcernsEligibility', type: 'yesno', label: 'Anything regarding your health history you are concerned may affect eligibility?', group: 'Family & Concerns' },
          { id: 'healthConcernsEligibility_details', type: 'textarea', label: 'Please describe', group: 'Family & Concerns',
            showWhen: { field: 'healthConcernsEligibility', op: 'equals', value: 'yes' } },
        ],
      },

      // ──────────────────────────────────────────────────────────
      // 7. Surrogacy Journey Expectations
      // ──────────────────────────────────────────────────────────
      {
        id: '_journeyExpectations',
        title: 'Surrogacy Journey Expectations',
        fields: [
          ta('bestFitIPs', 'What kind of Intended Parents do you feel would be the best fit for you?', { group: 'IP Preferences', prefillFrom: 'narrative.bestFitIPs' }),
          ...ynD('openSingleParents', 'Are you open to working with single parents?', { group: 'IP Preferences' }),
          ...ynD('openLGBTQ', 'Are you open to working with LGBTQ+ Intended Parents?', { group: 'IP Preferences' }),
          ...ynD('openInternational', 'Are you open to international Intended Parents?', { group: 'IP Preferences', prefillFrom: 'narrative.openOtherStateCountry' }),

          ta('communicationLevel', 'What level of communication are you hoping for during the journey?', { group: 'Communication & Involvement', prefillFrom: 'narrative.communicationFreq' }),
          ta('ipInvolvementPregnancy', 'How involved would you like Intended Parents to be during pregnancy?', { group: 'Communication & Involvement', prefillFrom: 'narrative.ipInvolvementDuringPregnancy' }),
          ta('ipAttendingAppts', 'How do you feel about Intended Parents attending appointments?', { group: 'Communication & Involvement', prefillFrom: 'narrative.ipAttendingAppointments' }),

          ...ynD('willingTwins', 'Are you willing to carry twins if medically approved?', { group: 'Medical Decisions' }),
          ta('selectiveReduction', 'What are your thoughts regarding selective reduction?', { group: 'Medical Decisions' }),
          ta('terminationMedical', 'What are your thoughts regarding termination for medical reasons?', { group: 'Medical Decisions' }),

          ...ynD('comfortableInjectables', 'Are you comfortable taking injectable medications and attending fertility appointments?', { group: 'Process Comfort' }),
          ...ynD('abstainSubstances', 'Are you willing to abstain from alcohol, nicotine, and recreational substances during the process?', { group: 'Process Comfort' }),
          ...ynD('psychAndBackground', 'Would you be willing to undergo psychological evaluation and background screening?', { group: 'Process Comfort' }),
          ...ynD('pumpingBreastMilk', 'Are you open to pumping breast milk after delivery?', { group: 'Process Comfort' }),

          ta('deliveryHopes', 'What are your hopes for the delivery experience?', { group: 'Delivery & Boundaries', prefillFrom: 'narrative.deliveryHopes' }),
          ta('whoPresentLaborDelivery', 'Who would you like present during labor and delivery?', { group: 'Delivery & Boundaries', prefillFrom: 'narrative.whoPresentLaborDelivery' }),
          ta('boundariesImportant', 'What boundaries are important for you during this journey?', { group: 'Delivery & Boundaries', prefillFrom: 'narrative.boundariesImportant' }),
          ta('feelRespectedSupported', 'What would make you feel respected and supported throughout the process?', { group: 'Delivery & Boundaries', prefillFrom: 'narrative.respectedSupported' }),

          ta('concernsFears', 'What concerns or fears do you have about surrogacy?', { group: 'Final Thoughts' }),
          ta('excitesMost', 'What excites you most about becoming a surrogate?', { group: 'Final Thoughts', prefillFrom: 'narrative.excitedAbout' }),
          { id: 'additionalHopes', type: 'textarea', label: 'Is there anything else you would like us to know about your hopes or expectations for this journey?', group: 'Final Thoughts' },
        ],
      },

      // ──────────────────────────────────────────────────────────
      // 8. Clinic & Hospital
      // Encoded from the legacy hand-coded widget. The legacy form's
      // dynamic per-pregnancy array (OB clinic/doctor/hospital/MFM/IVF
      // per pregnancy) isn't representable in the current builder
      // schema — captured below at the summary level. Per-pregnancy
      // detail remains in the legacy widget on the surrogate portal
      // until the builder gains array-field support.
      // ──────────────────────────────────────────────────────────
      {
        id: '_clinicHospital',
        title: 'Clinic & Hospital',
        fields: [
          txt('currentOBGYN', 'Current OB/GYN doctor name', { group: 'Current OB/GYN' }),
          txt('currentOBPhone', 'Current OB/GYN phone', { group: 'Current OB/GYN' }),
          txt('currentOBAddress', 'Current OB/GYN address', { group: 'Current OB/GYN' }),

          { id: 'papDate', type: 'date', label: 'Date of last pap smear', required: true, group: 'Last Pap Smear' },
          txt('papDoctorName', "Doctor's name", { group: 'Last Pap Smear' }),
          txt('papClinicName', 'Clinic name', { group: 'Last Pap Smear' }),
          txt('papClinicCity', 'Clinic city', { group: 'Last Pap Smear' }),
          { id: 'papClinicState', type: 'select', label: 'Clinic state', required: true, group: 'Last Pap Smear', options: US_STATES },
          txt('papClinicPhone', 'Clinic phone', { group: 'Last Pap Smear' }),

          yn('experiencedSurrogate', 'Have you been a surrogate before?', { group: 'Pregnancy Count', prefillFrom: 'narrative.beenSurrogateBefore' }),
          { id: 'numberOfPregnancies', type: 'number', label: 'Total number of pregnancies', required: true, group: 'Pregnancy Count',
            helpText: 'Per-pregnancy provider details (OB clinic, doctor, hospital, MFM, IVF) are captured in the legacy widget on the surrogate portal until the builder supports array fields.' },
        ],
      },
    ],
  },
]

export const mockFormResponses = []

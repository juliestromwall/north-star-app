// Profile narrative question structure for both Surrogates (GC) and
// Intended Parents (IP). Each entry below maps a section title to its
// questions; each question has a stable storage `id`, a `label` shown
// to the applicant, a `type` (textarea / yesno / select / pregnancyHistory),
// and optionally a `followUp` (shown when the parent's value is 'yes').
//
// All answers persist under `profileData.narrative[id]`. Follow-up answers
// use `${id}_details` to keep the namespace flat.

export const GC_PROFILE_SECTIONS = [
  {
    key: 'gettingToKnowYou',
    title: 'Getting to Know You',
    icon: 'Heart',
    questions: [
      { id: 'aboutYouAndFamily', label: 'Tell us about yourself and your family.', type: 'textarea' },
      { id: 'typicalDay', label: 'What does a typical day look like for you?', type: 'textarea' },
      { id: 'hobbies', label: 'What are your hobbies, interests, or favorite ways to spend your time?', type: 'textarea' },
      { id: 'howOthersDescribe', label: 'How would your friends and family describe you?', type: 'textarea' },
      { id: 'familyMeans', label: 'What does family mean to you?', type: 'textarea' },
      { id: 'mostJoy', label: 'What brings you the most joy in life?', type: 'textarea' },
    ],
  },
  {
    key: 'surrogacyJourney',
    title: 'Your Surrogacy Journey',
    icon: 'Star',
    questions: [
      { id: 'whyConsider', label: 'What led you to consider becoming a surrogate?', type: 'textarea' },
      { id: 'excitedAbout', label: 'What excites you most about the journey?', type: 'textarea' },
      { id: 'hopingToGain', label: 'What are you hoping to gain from this experience emotionally or personally?', type: 'textarea' },
      { id: 'beenSurrogateBefore', label: 'Have you been a surrogate before?', type: 'yesno', followUp: { label: 'Tell us about your experience.', when: 'yes' } },
      { id: 'ipDrawnTo', label: 'What kind of Intended Parents do you feel naturally drawn to?', type: 'textarea' },
    ],
  },
  {
    key: 'pregnancyExperience',
    title: 'Pregnancy & Parenting Experience',
    icon: 'Baby',
    questions: [
      { id: 'pregnancyHistoryWidget', type: 'pregnancyHistory' },
      { id: 'previousPregnanciesNarrative', label: 'Tell us about your previous pregnancies and births.', type: 'textarea' },
      { id: 'enjoyedPregnancy', label: 'What did you enjoy most about pregnancy?', type: 'textarea' },
      { id: 'complicationsNarrative', label: 'Were there any complications during your pregnancies or deliveries?', type: 'textarea' },
      { id: 'recoveryAfterBirth', label: 'How would you describe your recovery after childbirth?', type: 'textarea' },
      { id: 'motherhoodTaught', label: 'What has motherhood taught you about yourself?', type: 'textarea' },
    ],
  },
  {
    key: 'relationshipComm',
    title: 'Relationship & Communication',
    icon: 'MessageCircle',
    questions: [
      { id: 'relationshipHope', label: 'What kind of relationship are you hoping to have with your Intended Parents?', type: 'textarea' },
      { id: 'communicationFreq', label: 'How often would you ideally like to communicate during the journey?', type: 'textarea' },
      { id: 'communicationStyle', label: 'What communication style works best for you?', type: 'textarea' },
      { id: 'conflictHandling', label: 'How do you typically handle conflict or misunderstandings?', type: 'textarea' },
      { id: 'respectedSupported', label: 'What does feeling respected and supported look like to you?', type: 'textarea' },
    ],
  },
  {
    key: 'valuesBeliefs',
    title: 'Values & Beliefs',
    icon: 'Sparkles',
    questions: [
      { id: 'importantValues', label: 'What values are most important to you?', type: 'textarea' },
      { id: 'culturalReligiousBeliefs', label: 'Are there any personal, cultural, or religious beliefs you would want Intended Parents to know about?', type: 'textarea' },
      { id: 'majorDecisionsApproach', label: 'How do you approach major decisions?', type: 'textarea' },
      { id: 'mutualRespect', label: 'What does mutual respect mean to you in a surrogacy relationship?', type: 'textarea' },
    ],
  },
  {
    key: 'preferencesBoundaries',
    title: 'Preferences & Boundaries',
    icon: 'Shield',
    questions: [
      { id: 'dealBreakers', label: 'Are there any deal-breakers for you in a match?', type: 'yesno', followUp: { label: 'Please explain any deal-breakers.', when: 'yes' } },
      { id: 'familyStructures', label: 'Are there any family structures or situations you feel especially comfortable or uncomfortable with?', type: 'yesno', followUp: { label: 'Please explain.', when: 'yes' } },
      {
        id: 'sensitiveTopicsView',
        label: 'How do you feel about topics such as selective reduction, termination, vaccination, or medical decision-making?',
        type: 'select',
        options: [
          { value: 'open_to_discuss', label: "I'm open to discussing all of these openly" },
          { value: 'have_firm_views', label: "I have firm views I'd want my IPs to know upfront" },
          { value: 'align_with_ips', label: "I'd prefer to align with my Intended Parents' views" },
          { value: 'case_by_case', label: "I'd like to discuss each topic case-by-case" },
        ],
        followUp: { id: 'sensitiveTopicsView_explain', label: 'Anything else you want to share?', when: 'any' },
      },
      { id: 'areasFlexible', label: 'Are there areas where you feel flexible?', type: 'yesno', followUp: { label: 'Please explain.', when: 'yes' } },
      { id: 'boundariesImportant', label: 'What boundaries are important for you to maintain during the journey?', type: 'textarea' },
    ],
  },
  {
    key: 'pregnancyBirthPrefs',
    title: 'Pregnancy & Birth Preferences',
    icon: 'Baby',
    questions: [
      { id: 'ipInvolvementDuringPregnancy', label: 'How involved would you like Intended Parents to be during the pregnancy?', type: 'textarea' },
      { id: 'ipAttendingAppointments', label: 'How do you feel about Intended Parents attending appointments?', type: 'textarea' },
      { id: 'deliveryHopes', label: 'What are your hopes for the delivery experience?', type: 'textarea' },
      { id: 'whoPresentLaborDelivery', label: 'Who would you want present during labor and delivery?', type: 'textarea' },
      { id: 'medicalInterventionsViews', label: 'What are your thoughts on induction, epidurals, C-sections, or other medical interventions?', type: 'textarea' },
    ],
  },
  {
    key: 'supportSystem',
    title: 'Support System',
    icon: 'Users',
    questions: [
      { id: 'supportSystemPeople', label: 'Who is part of your support system?', type: 'textarea' },
      { id: 'partnerFamilyFeelings', label: 'How does your partner/spouse/family feel about surrogacy?', type: 'textarea' },
      { id: 'helpDuringPregnancyRecovery', label: 'Who will help support you during pregnancy and recovery?', type: 'textarea' },
      { id: 'selfCareDuringStress', label: 'How do you care for yourself during stressful times?', type: 'textarea' },
    ],
  },
  {
    key: 'practicalConsiderations',
    title: 'Practical Considerations',
    icon: 'CalendarDays',
    questions: [
      { id: 'openOtherStateCountry', label: 'Are you open to working with Intended Parents from another state or country?', type: 'yesno', followUp: { label: 'Please explain.', when: 'yes' } },
      { id: 'travelComfort', label: 'Are you comfortable with travel for medical appointments or delivery?', type: 'yesno', followUp: { label: 'Please explain.', when: 'yes' } },
      { id: 'workChildcareSchedule', label: 'What does your work schedule and childcare situation look like?', type: 'textarea' },
      { id: 'schedulingConcerns', label: 'Are there any scheduling or logistical concerns we should know about?', type: 'yesno', followUp: { label: 'Please explain.', when: 'yes' } },
    ],
  },
  {
    key: 'afterBirth',
    title: 'After Birth & Beyond',
    icon: 'Heart',
    questions: [
      { id: 'relationshipAfterBirth', label: 'What are your hopes for your relationship with the Intended Parents after birth?', type: 'textarea' },
      { id: 'openFutureContact', label: 'Are you open to future contact, updates, or visits?', type: 'yesno', followUp: { label: 'Please explain.', when: 'yes' } },
      { id: 'journeyRemembered', label: 'How would you like your surrogacy journey to be remembered or talked about in the future?', type: 'textarea' },
    ],
  },
  {
    key: 'finalThoughts',
    title: 'Final Thoughts',
    icon: 'Star',
    questions: [
      { id: 'bestFitIPs', label: 'What kind of Intended Parents do you feel would be the best fit for you?', type: 'textarea' },
      { id: 'whatIPsToFeel', label: 'What would you want Intended Parents to feel after reading your profile?', type: 'textarea' },
    ],
  },
  {
    key: 'dearIP',
    title: 'Dear Intended Parent',
    icon: 'Mail',
    isLetter: true,
    questions: [
      { id: 'letterToIP', label: "Is there anything else you'd like to share from the heart?", type: 'textarea', isLetterBody: true },
    ],
  },
]

export const IP_PROFILE_SECTIONS = [
  {
    key: 'gettingToKnowYou',
    title: 'Getting to Know You',
    icon: 'Heart',
    questions: [
      { id: 'yourStory', label: "Tell us about you (and your partner, if applicable). What's your story?", type: 'textarea' },
      { id: 'typicalDay', label: 'What does a typical day look like in your life?', type: 'textarea' },
      { id: 'hobbies', label: 'What are your hobbies, interests, or things that bring you joy?', type: 'textarea' },
      { id: 'howOthersDescribe', label: 'How would your friends and family describe you?', type: 'textarea' },
      { id: 'familyMeans', label: 'What does family mean to you?', type: 'textarea' },
    ],
  },
  {
    key: 'journeyToSurrogacy',
    title: 'Journey to Surrogacy',
    icon: 'Star',
    questions: [
      { id: 'whyPursue', label: 'What led you to pursue surrogacy?', type: 'textarea' },
      { id: 'howLong', label: 'How long have you been on this path?', type: 'textarea' },
      { id: 'emotionalJourney', label: 'What has this journey been like for you emotionally?', type: 'textarea' },
      { id: 'surrogateUnderstand', label: 'Is there anything you want your surrogate to understand about your experience?', type: 'textarea' },
    ],
  },
  {
    key: 'relationshipComm',
    title: 'Relationship & Communication',
    icon: 'MessageCircle',
    questions: [
      { id: 'relationshipHope', label: 'What kind of relationship are you hoping to have with your surrogate?', type: 'textarea' },
      { id: 'communicationFreq', label: 'How often would you ideally like to communicate (texts, calls, visits)?', type: 'textarea' },
      { id: 'conflictHandling', label: 'How do you typically handle conflict or misunderstandings?', type: 'textarea' },
      { id: 'supportedLooksLike', label: 'What does feeling "supported" look like to you during this process?', type: 'textarea' },
      { id: 'longTermAfter', label: 'Are you hoping for a long-term relationship after birth? If so, what might that look like?', type: 'textarea' },
    ],
  },
  {
    key: 'valuesBeliefs',
    title: 'Values & Beliefs',
    icon: 'Sparkles',
    questions: [
      { id: 'importantValues', label: 'What values are most important in your life?', type: 'textarea' },
      { id: 'culturalReligiousBeliefs', label: 'Are there any personal, cultural, or religious beliefs that are important for your surrogate to know?', type: 'yesno', followUp: { label: 'Please explain.', when: 'yes' } },
      { id: 'bigDecisionsApproach', label: 'How do you approach big decisions as a family?', type: 'textarea' },
      { id: 'respectLooksLike', label: 'What does respect look like to you in a partnership like this?', type: 'textarea' },
    ],
  },
  {
    key: 'preferencesBoundaries',
    title: 'Preferences & Boundaries',
    icon: 'Shield',
    questions: [
      { id: 'specificViewsTopics', label: 'Are there any specific views or topics that are especially important to you in a match? (e.g., selective reduction, termination, medical decision-making)', type: 'yesno', followUp: { label: 'Please explain.', when: 'yes' } },
      { id: 'vaccinesMedsLifestyle', label: 'How do you feel about things like vaccines, medications, or lifestyle choices during pregnancy?', type: 'textarea' },
      { id: 'dealBreakers', label: 'Are there any deal-breakers for you in a match?', type: 'yesno', followUp: { label: 'Please explain.', when: 'yes' } },
      { id: 'areasFlexible', label: 'Are there areas where you feel flexible?', type: 'yesno', followUp: { label: 'Please explain.', when: 'yes' } },
    ],
  },
  {
    key: 'pregnancyBirth',
    title: 'Pregnancy & Birth',
    icon: 'Baby',
    questions: [
      { id: 'involvementDuringPregnancy', label: 'How involved would you like to be during the pregnancy?', type: 'textarea' },
      { id: 'attendAppointments', label: 'Would you like to attend appointments?', type: 'yesno', followUp: { label: 'In what capacity?', when: 'yes' } },
      { id: 'deliveryHopes', label: 'What are your hopes for the delivery experience?', type: 'textarea' },
      { id: 'whoPresentBirth', label: 'Who would you like present at the birth?', type: 'yesno', followUp: { label: 'Please explain.', when: 'any' } },
      { id: 'medicalInterventionsViews', label: 'What are your thoughts on induction, C-sections, or other medical interventions?', type: 'textarea' },
    ],
  },
  {
    key: 'practicalConsiderations',
    title: 'Practical Considerations',
    icon: 'CalendarDays',
    questions: [
      { id: 'locationOpenness', label: 'Where are you located, and are you open to working with a surrogate in another state?', type: 'yesno', followUp: { label: 'Please explain.', when: 'no' } },
      { id: 'travelComfort', label: 'Are you comfortable with travel expectations for medical appointments and delivery?', type: 'yesno', followUp: { label: 'Please explain.', when: 'no' } },
      { id: 'supportSystemInPlace', label: 'Do you have a support system in place?', type: 'yesno', followUp: { label: 'Please describe.', when: 'any' } },
    ],
  },
  {
    key: 'afterBirth',
    title: 'After Birth & Beyond',
    icon: 'Heart',
    questions: [
      { id: 'relationshipAfterBirth', label: 'What are your hopes for your relationship with your surrogate after birth?', type: 'textarea' },
      { id: 'talkAboutWithChild', label: 'How would you like to talk about your surrogate with your child as they grow?', type: 'textarea' },
      { id: 'openFutureContact', label: 'Are you open to future contact, updates, or visits?', type: 'yesno', followUp: { label: 'Please explain.', when: 'no' } },
    ],
  },
  {
    key: 'finalThoughts',
    title: 'Final Thoughts',
    icon: 'Star',
    questions: [
      { id: 'bestFitSurrogate', label: 'What kind of surrogate do you feel would be the best fit for your family?', type: 'textarea' },
      { id: 'whatSurrogateToFeel', label: 'What would you want a potential surrogate to feel after reading your profile?', type: 'textarea' },
    ],
  },
  {
    key: 'dearSurrogate',
    title: 'Dear Surrogate',
    icon: 'Mail',
    isLetter: true,
    questions: [
      { id: 'letterToSurrogate', label: "Is there anything else you'd like to share from the heart?", type: 'textarea', isLetterBody: true },
    ],
  },
]

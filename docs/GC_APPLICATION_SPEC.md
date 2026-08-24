# GC Application Spec — First Star

Source: `~/Downloads/GC Application Forms.xlsx` (7 tabs) + retained Clinic & Hospital section from existing ABC fork.

## Final section order (8 sections)

| # | Section | Storage key | Source | New? |
|---|---|---|---|---|
| 1 | Personal Information | `_personalInfo` | XLSX Tab 1 | Replaces existing `_application` |
| 2 | Employment & Education | `_employment` | XLSX Tab 2 | New |
| 3 | Social & Family | `_social` | XLSX Tab 3 | New |
| 4 | Background | `_background` | XLSX Tab 4 | New |
| 5 | Pregnancy History | `_pregnancyHistory` | XLSX Tab 5 | New (read-only summary derived from profile pregnancyHistory widget + a few narrative Qs) |
| 6 | Health History | `_healthHistory` | XLSX Tab 6 | New |
| 7 | Surrogacy Journey Expectations | `_journeyExpectations` | XLSX Tab 7 | New |
| 8 | Clinic & Hospital Form | `_clinicHospital` | existing | Kept as-is — moved to last per user request |

**Removed:** Profile Follow Up (`_profileFollowUp`), References (`_references`), Payment Preference (`_paymentPreference`), Social Media Release (`_socialMediaRelease`). **Existing data wiped** — no migration.

## Prefill behavior

When a question duplicates a profile narrative question, the application field is **prefilled from the profile, editable on the application, and writes only to the application copy** (profile is not updated by application edits). Prefill source shown in the `Prefill From` column points at `profileData.narrative.<id>`.

## Field types

| Type | Renders as |
|---|---|
| `text` | single-line `<Input>` |
| `textarea` | multi-line `<Textarea>` |
| `date` | date input |
| `tel` | phone input (auto-formatted) |
| `email` | email input |
| `number` | number input |
| `yesno` | YesNoButtons |
| `yesno+detail` | YesNoButtons + textarea follow-up shown on "yes" |
| `select` | `<Select>` with `options` |
| `address` | street / city / state / zip composite |

---

## 1. Personal Information (21 fields, storage `_personalInfo`)

| # | Field key | Label | Type | Req | Prefill From | Notes |
|---|---|---|---|---|---|---|
| 1 | fullLegalName | Full legal name | text | ✓ | — | |
| 2 | preferredName | Preferred name/nickname | text | — | — | |
| 3 | dob | Date of birth | date | ✓ | — | |
| 4 | pronouns | Pronouns | text | — | — | |
| 5 | address | Address | address | ✓ | — | Street/city/state/zip |
| 6 | phone | Phone number | tel | ✓ | — | |
| 7 | email | Email address | email | ✓ | — | |
| 8 | maritalStatus | Marital/relationship status | select | ✓ | — | Single, Married, Divorced, Widowed, Domestic Partner, Engaged, Separated |
| 9 | spouseName | Spouse's name | text | — | — | Shown when maritalStatus ≠ Single |
| 10 | spouseDob | Spouse's DOB | date | — | — | Same condition |
| 11 | partnerDuration | How long with partner/spouse | text | — | — | Same condition |
| 12 | children | Do you have children? List ages. | textarea | ✓ | — | |
| 13 | household | Who lives in your household? | textarea | ✓ | — | |
| 14 | reliableTransportation | Reliable transportation? | yesno | ✓ | — | |
| 15 | usCitizen | U.S. citizen or permanent resident? | yesno | ✓ | — | |
| 16 | willingToTravel | Willing to travel for appointments/transfer? | yesno+detail | ✓ | `practicalConsiderations.travelComfort` | Profile asks comfort with travel — prefill yes/no from the profile yesno; detail empty |
| 17 | languages | What languages do you speak? | text | ✓ | — | |
| 18 | howHeardAboutAgency | How did you hear about our agency? | text | ✓ | — | Could also prefill from intake `referralSource` — confirm in review |
| 19 | whyInterested | Why are you interested in becoming a surrogate? | textarea | ✓ | `surrogacyJourney.whyConsider` | |
| 20 | motivates | What motivates you most about this journey? | textarea | ✓ | `surrogacyJourney.whyConsider` | Same prefill — profile collapses these into one Q |
| 21 | hopingToGain | What are you hoping to gain personally or emotionally? | textarea | ✓ | `surrogacyJourney.hopingToGain` | |

---

## 2. Employment & Education (10 fields, storage `_employment`)

| # | Field key | Label | Type | Req | Prefill From | Notes |
|---|---|---|---|---|---|---|
| 1 | occupation | Current occupation | text | ✓ | — | |
| 2 | employer | Current employer | text | ✓ | — | |
| 3 | employmentDuration | How long employed there | text | ✓ | — | |
| 4 | workSchedule | What does your work schedule look like? | textarea | ✓ | `practicalConsiderations.workChildcareSchedule` | Profile asks schedule + childcare combined |
| 5 | maternityLeave | Employer offer maternity leave benefits? | yesno+detail | ✓ | — | |
| 6 | workChangesPregnancy | Will work responsibilities change during pregnancy? | yesno+detail | ✓ | — | |
| 7 | educationLevel | Highest level of education completed | select | ✓ | — | High School, Some College, Associate, Bachelor's, Master's, Doctorate, Other |
| 8 | twoIncomeHousehold | Two-income household? | yesno | ✓ | — | |
| 9 | bankruptcy | Ever filed for bankruptcy? | yesno+detail | ✓ | — | |
| 10 | governmentAssistance | Currently receiving government assistance? | yesno+detail | ✓ | — | |

---

## 3. Social & Family (16 fields, storage `_social`)

| # | Field key | Label | Type | Req | Prefill From | Notes |
|---|---|---|---|---|---|---|
| 1 | partnerRelationship | Describe your relationship with your partner/spouse | textarea | — | — | Shown only when has partner |
| 2 | partnerFeelings | How does your partner/spouse feel about surrogacy? | textarea | ✓ | `supportSystem.partnerFamilyFeelings` | |
| 3 | familyFriendsSupport | Do your family and close friends support your decision? | yesno+detail | ✓ | `supportSystem.partnerFamilyFeelings` | Profile lumps partner/family/friends — prefill the narrative text in detail |
| 4 | primarySupportPerson | Primary support person during pregnancy/recovery | text | ✓ | `supportSystem.helpDuringPregnancyRecovery` | |
| 5 | parentingStyle | Describe your parenting style | textarea | ✓ | — | |
| 6 | familyActivities | What do you enjoy doing as a family? | textarea | ✓ | — | |
| 7 | hobbies | What hobbies/interests are important to you? | textarea | ✓ | `gettingToKnowYou.hobbies` | |
| 8 | handleStress | How do you typically handle stress? | textarea | ✓ | `supportSystem.selfCareDuringStress` | |
| 9 | selfCare | What does self-care look like for you? | textarea | ✓ | `supportSystem.selfCareDuringStress` | Same prefill as #8 — profile collapses |
| 10 | religiousBeliefs | Religious/spiritual/cultural beliefs that may impact journey? | yesno+detail | ✓ | `valuesBeliefs.culturalReligiousBeliefs` | |
| 11 | familyTraditions | Family traditions/values especially important to you? | yesno+detail | ✓ | `valuesBeliefs.importantValues` | Loose mapping |
| 12 | friendsPersonalityDesc | How would friends describe your personality? | textarea | ✓ | `gettingToKnowYou.howOthersDescribe` | |
| 13 | handleConflict | How do you handle conflict or disagreements? | textarea | ✓ | `relationshipComm.conflictHandling` | |
| 14 | relationshipWithIPs | Type of relationship hoping to have with IPs | textarea | ✓ | `relationshipComm.relationshipHope` | |
| 15 | commFrequency | How often would you ideally like communication? | textarea | ✓ | `relationshipComm.communicationFreq` | |
| 16 | ongoingContactAfter | Hoping for ongoing contact after delivery? | yesno+detail | ✓ | `afterBirth.openFutureContact` | |

---

## 4. Background (15 fields, storage `_background`)

Sensitive screening section. **No profile prefills** — all new.

| # | Field key | Label | Type | Req | Notes |
|---|---|---|---|---|---|
| 1 | criminalHistory | You or anyone in household ever arrested or convicted? | yesno+detail | ✓ | Existed in old app — preserve answers if present |
| 2 | cpsInvolvement | You or household ever had CPS involvement? | yesno+detail | ✓ | |
| 3 | nicotineEver | Ever smoked cigarettes or used nicotine products? | yesno+detail | ✓ | Detail asks: when stopped, frequency |
| 4 | recreationalDrugs | Ever used recreational drugs? | yesno+detail | ✓ | |
| 5 | alcohol | Do you consume alcohol? If yes, how often? | yesno+detail | ✓ | Detail = frequency |
| 6 | substanceAbuse | Ever struggled with substance abuse? | yesno+detail | ✓ | |
| 7 | mentalHealthDx | Ever diagnosed with depression, anxiety, PTSD, etc.? | yesno+detail | ✓ | Detail = which, when, treatment |
| 8 | counselingTherapy | Ever attended counseling or therapy? | yesno+detail | ✓ | Detail = when, reason |
| 9 | mentalHealthMeds | Ever taken medication for mental health concerns? | yesno+detail | ✓ | Detail = which, when, ongoing |
| 10 | domesticViolence | Ever experienced domestic violence or abuse? | yesno+detail | ✓ | |
| 11 | safeInHome | Feel safe in current relationship and home? | yesno+detail | ✓ | Detail required only on "no" |
| 12 | legalDispute | Ever involved in legal dispute re custody or family? | yesno+detail | ✓ | |
| 13 | socialMediaAccounts | Social media accounts you actively use? | textarea | ✓ | List of platforms + handles, free text |
| 14 | ipsViewSocialMedia | Comfortable with IPs viewing your social media? | yesno+detail | ✓ | |
| 15 | privateDiscussion | Anything in your background to discuss privately? | yesno+detail | — | |

---

## 5. Pregnancy History (16 fields, storage `_pregnancyHistory`)

⚠ **Decision needed:** profile already has a structured Pregnancy History widget (`pregnancyHistory` array — year, outcome, weeks, weight, C-section flag, etc.). 8 of these questions are mechanically derivable. Two options:

- **A. Render derived fields as read-only summary at the top** ("Based on your profile: 3 pregnancies, 2 full-term deliveries, 1 C-section, 1 VBAC, 0 miscarriages"). Only ask narrative/extra Qs as editable.
- **B. Treat all 16 as editable application fields**, prefilled from derivations on first paint. Surrogate can correct if derivation is wrong.

Recommended: **A** — single source of truth, no derivation drift.

| # | Field key | Label | Type | Req | Prefill From | Notes |
|---|---|---|---|---|---|---|
| 1 | numPregnancies | How many times pregnant? | derived | — | profile pregnancyHistory.length | Read-only summary |
| 2 | listPregnancies | List all pregnancies (year + outcome) | derived | — | profile pregnancyHistory rows | Read-only summary |
| 3 | numFullTerm | Full-term deliveries | derived | — | derived | Read-only summary |
| 4 | losses | Miscarriages, ectopic, terminations? | derived | — | derived | Read-only summary |
| 5 | complications | Pregnancy complications (gestational diabetes, preeclampsia, hemorrhage, preterm)? | yesno+detail | ✓ | `pregnancyExperience.complicationsNarrative` | Editable on app |
| 6 | everCSection | Ever delivered via C-section? | derived | — | derived | Read-only |
| 7 | numCSections | How many C-sections? | derived | — | derived | Read-only |
| 8 | everVBAC | Ever had a VBAC? | derived | — | derived | Read-only |
| 9 | pregnanciesHealthy | Pregnancies generally healthy? | yesno+detail | ✓ | — | |
| 10 | nauseaOrBedrest | Significant nausea or bedrest? | yesno+detail | ✓ | — | |
| 11 | postpartumRecovery | How long was postpartum recovery typically? | textarea | ✓ | `pregnancyExperience.recoveryAfterBirth` | |
| 12 | regularMenstrualCycles | Currently regular menstrual cycles? | yesno+detail | ✓ | — | |
| 13 | birthControl | Currently taking birth control? Type? | yesno+detail | ✓ | — | Detail = type |
| 14 | advisedNotPregnantAgain | Ever advised not to become pregnant again? | yesno+detail | ✓ | — | |
| 15 | previouslySurrogate | Ever previously been a surrogate? | yesno | ✓ | `surrogacyJourney.beenSurrogateBefore` | |
| 16 | describePreviousSurrogacy | If yes, describe your previous surrogacy journey | textarea | — | `surrogacyJourney.beenSurrogateBefore_details` | Conditional on #15 = yes |

---

## 6. Health History (25 fields, storage `_healthHistory`)

Mostly objective screening Qs — no profile prefills.

| # | Field key | Label | Type | Req | Prefill From | Notes |
|---|---|---|---|---|---|---|
| 1 | height | Height | text | ✓ | — | E.g. "5'6\"" |
| 2 | weight | Weight | number | ✓ | — | lbs |
| 3 | pcp | Primary care physician name and clinic | text | ✓ | — | |
| 4 | obGyn | OB/GYN name and clinic | text | ✓ | — | |
| 5 | medications | Currently taking any medications? | yesno+detail | ✓ | — | |
| 6 | vitaminsSupplements | Vitamins or supplements? | yesno+detail | ✓ | — | |
| 7 | allergies | Allergies? | yesno+detail | ✓ | — | |
| 8 | surgeryHistory | Ever had surgery? | yesno+detail | ✓ | — | |
| 9 | bloodTransfusion | Ever received a blood transfusion? | yesno+detail | ✓ | — | |
| 10 | chronicConditions | Chronic medical conditions? | yesno+detail | ✓ | — | |
| 11 | highBloodPressure | Ever diagnosed with high blood pressure? | yesno+detail | ✓ | — | |
| 12 | diabetes | Ever diagnosed with diabetes or gestational diabetes? | yesno+detail | ✓ | — | |
| 13 | thyroid | History of thyroid disorders? | yesno+detail | ✓ | — | |
| 14 | migrainesPain | Migraines or chronic pain? | yesno+detail | ✓ | — | |
| 15 | abnormalPap | Ever had abnormal pap smears? | yesno+detail | ✓ | — | |
| 16 | sti | Ever had a sexually transmitted infection? | yesno+detail | ✓ | — | |
| 17 | covidVaccine | Received the COVID-19 vaccine? | yesno | ✓ | — | |
| 18 | routineVaccines | Routine vaccines up to date? | yesno | ✓ | — | |
| 19 | vaccinesDuringJourney | Willing to receive vaccines during journey? | yesno+detail | ✓ | — | |
| 20 | exerciseRegularly | Exercise regularly? | yesno+detail | ✓ | — | Detail = type/frequency |
| 21 | eatingHabits | How would you describe your eating habits? | textarea | ✓ | — | |
| 22 | dietaryRestrictions | Dietary restrictions? | yesno+detail | ✓ | — | |
| 23 | hospitalized | Ever been hospitalized? | yesno+detail | ✓ | — | |
| 24 | familyMedicalHistory | Significant family medical history? | yesno+detail | ✓ | — | |
| 25 | healthConcernsEligibility | Anything re health history concerned may affect eligibility? | yesno+detail | — | — | |

---

## 7. Clinic & Hospital Form (storage `_clinicHospital`)

**Kept as-is from existing app.** No changes from this CSV. Provider info per pregnancy.

---

## 8. Surrogacy Journey Expectations (21 fields, storage `_journeyExpectations`)

| # | Field key | Label | Type | Req | Prefill From | Notes |
|---|---|---|---|---|---|---|
| 1 | bestFitIPs | What kind of IPs would be the best fit for you? | textarea | ✓ | `finalThoughts.bestFitIPs` | Identical wording |
| 2 | openSingleParents | Open to working with single parents? | yesno+detail | ✓ | — | |
| 3 | openLGBTQ | Open to working with LGBTQ+ IPs? | yesno+detail | ✓ | — | |
| 4 | openInternational | Open to international IPs? | yesno+detail | ✓ | `practicalConsiderations.openOtherStateCountry` | Loose — profile lumps state + country |
| 5 | communicationLevel | What level of communication are you hoping for? | textarea | ✓ | `relationshipComm.communicationFreq` | |
| 6 | ipInvolvementPregnancy | How involved would you like IPs to be during pregnancy? | textarea | ✓ | `pregnancyBirthPrefs.ipInvolvementDuringPregnancy` | Identical wording |
| 7 | ipAttendingAppts | How do you feel about IPs attending appointments? | textarea | ✓ | `pregnancyBirthPrefs.ipAttendingAppointments` | Identical wording |
| 8 | willingTwins | Willing to carry twins if medically approved? | yesno+detail | ✓ | — | |
| 9 | selectiveReduction | Thoughts regarding selective reduction? | textarea | ✓ | — | Profile collapses this into `sensitiveTopicsView` — too coarse to prefill |
| 10 | terminationMedical | Thoughts regarding termination for medical reasons? | textarea | ✓ | — | Same as above |
| 11 | comfortableInjectables | Comfortable with injectables + fertility appts? | yesno+detail | ✓ | — | |
| 12 | abstainSubstances | Willing to abstain from alcohol, nicotine, recreational substances? | yesno+detail | ✓ | — | |
| 13 | psychAndBackground | Willing to undergo psych eval + background screening? | yesno+detail | ✓ | — | |
| 14 | pumpingBreastMilk | Open to pumping breast milk after delivery? | yesno+detail | ✓ | — | |
| 15 | deliveryHopes | Hopes for the delivery experience? | textarea | ✓ | `pregnancyBirthPrefs.deliveryHopes` | Identical wording |
| 16 | whoPresentLaborDelivery | Who would you like present during labor and delivery? | textarea | ✓ | `pregnancyBirthPrefs.whoPresentLaborDelivery` | Near-identical |
| 17 | boundariesImportant | Boundaries important for you during this journey? | textarea | ✓ | `preferencesBoundaries.boundariesImportant` | Near-identical |
| 18 | feelRespectedSupported | What would make you feel respected and supported? | textarea | ✓ | `relationshipComm.respectedSupported` | Near-identical |
| 19 | concernsFears | Concerns or fears about surrogacy? | textarea | ✓ | — | |
| 20 | excitesMost | What excites you most about becoming a surrogate? | textarea | ✓ | `surrogacyJourney.excitedAbout` | Near-identical |
| 21 | additionalHopes | Anything else about your hopes or expectations? | textarea | — | — | |

---

## Resolved decisions (2026-05-26)

1. **Migration:** wipe all legacy keys (`_application`, `_profileFollowUp`, `_confidential`, `_references`, `_paymentPreference`, `_socialMediaRelease`). No migration.
2. **Removed sections:** References, Payment Preference, Social Media Release — fully removed (not moved elsewhere).
3. **Pregnancy History:** read-only summary derived from profile pregnancyHistory widget (option A).
4. **Conditional follow-ups:** detail textarea shows on "yes" by default (`safeInHome` shows on "no"). Confirmed.
5. **Required fields:** all ✓ markings stand as drafted.
6. **Section order:** Clinic & Hospital moved to last (section 8) per user request.

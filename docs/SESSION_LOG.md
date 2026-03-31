# Session Log

## 2026-03-29 / 2026-03-30 (Full Day Session — Continued)

**Worked on:** IP Profile builder, Babies Born page, profile photo avatars, Supabase migration for all localStorage stores, medical records UX overhaul, stage statuses in admin settings, admin profile pregnancy editing, numerous bug fixes

**Changes made:**

IP Profile Builder:
- 5-section profile tab on IP detail page (Fertility, Surrogacy, Personal, Health, Personal History)
- Couples get IP1/IP2 tabs on per-person sections
- Edit/save per section, completion progress bar
- Data stored in answers._ipProfile via updateIntakeSubmission

Babies Born Page:
- /babies-born page with year-by-year births table, editable counts
- Line chart with gradient pink→blue, cumulative area fill
- Hero stats: Total Babies Born (222) + Currently Pregnant (13)
- Sidebar baby icon links to /babies-born, shows live total
- Historical data from ABC spreadsheet (2014-2026)

Profile Photo Avatars:
- ProfilePhotoUpload saves URL to profileData.personal.profilePhotoUrl
- SurrogateListPage loads avatar URLs from profiles
- SurrogateDetailPage auto-detects portrait photo from storage (getPortraitPhotoUrl)
- RoleContext enriches auth user with real name from intake_submissions + profile photo
- TopBar shows avatar image when available

Supabase Migration:
- New app_config table (key-value JSONB store)
- checklistStore: Supabase-backed with memory cache, async load on startup
- stageStatusStore: same pattern
- BabiesBornPage: loads/saves via getAppConfig/setAppConfig
- Record tracking: stored in intake_submissions.answers._recordTracking
- main.jsx fires loadChecklistConfig() + loadStageStatuses() at startup
- Auto-migration: existing localStorage data pushed to Supabase on first load

Medical Records UX:
- Record type badges: OB (blue), Delivery (purple), IVF (pink), PAP (amber)
- Badge displayed under custom record label
- "Deactivated" as a status option (not a toggle switch)
- Deactivated records: gray dot, dimmed, clickable to reactivate
- Counts exclude deactivated records
- Dashboard popup hides deactivated, shows custom labels + badges
- Default labels shortened to "OB 2026" format
- Click record name to rename (e.g. "Dr. Smith OB 2024")
- "+ Add Record" button with record type selection
- Tab shows count "Medical Records 1/6" (smaller text)
- Removed row numbers from records

Admin Profile Editing:
- numberOfPregnancies drives pregnancy array (number input, auto-resize)
- adminUpdateSurrogateProfile changed to upsert (creates row if none exists)
- Array fields initialize as [] not '' for empty profiles

Stage Statuses in Settings:
- New collapsible "Stage Statuses" section
- Stage tabs on left, status list on right
- Add, edit (inline), delete statuses per stage
- Delete confirmation: "Delete for all cases" or "Just hide going forward"
- Count badges per stage

Bug Fixes:
- avatarUrls undefined in SurrogateCard (passed as prop)
- hiddenFields.includes crash (Array.isArray check)
- Profile tab blank page (same hiddenFields fix)
- Pregnancy data not persisting (upsert fix)
- Duplicate checklist rows (removed hardcoded OB/Delivery/IVF summary rows)
- Tab count mismatch for medical records
- Surrogate name "Testing" on user side (enriched from intake_submissions)

**Next steps:**
- Journey Manager feature (JA/NL initials on matched journey cards)
- Fix dashboard checklist step data reconciliation for record-type steps
- Admin profile question labels to match surrogate form wording (waiting for ABC feedback)
- Twilio upgrade from trial for production texting
- Incoming SMS webhook for Twilio
- Per-admin Twilio numbers
- Share/send surrogate profiles externally
- Auto Emails, Gmail API, Google Calendar API
- Fax API, Contract/E-Signature API

**Open questions:**
- Dashboard OB Records step shows wrong status — step ID from checklist config doesn't match tracking keys (ob_records_0, etc.)
- Should IP cases have the same stage/status system as surrogates?
- How should Journey Manager assignment work on matched journeys?

---

## 2026-03-28 / 2026-03-29 (Full Day Session)

**Worked on:** Configurable checklists & milestones, admin settings (team management, collapsible sections), Twilio SMS integration, admin profile editor upgrade with visibility toggles, real admin staff names, various UX fixes

**Changes made:**

Configurable Checklists & Milestones:
- checklistStore.js: localStorage-backed CRUD for steps + milestones per (userType, stageId)
- Settings page: Checklists section with GC/IP/Matched Journeys tabs
- Each stage has drag-to-reorder steps, add/edit/delete, reset to defaults
- Milestones: add/edit/delete, expand to assign steps via checkboxes
- Milestones shown on case cards (filtered by surrogate's current stage)
- Dashboard screening sheet reads steps dynamically from checklistStore per stage
- SurrogateDetailPage: Overview tab shows horizontal milestone timeline (gradient pink→blue dots)
- Checklist tab title dynamic per stage (e.g. "Pre-Qualification Checklist")
- OB/Delivery/IVF record summaries only in Screening stage checklist
- IVF Records count fixed: only counts pregnancies where wasSurrogacy=yes
- N/A toggle button on medical record rows (for miscarriage cases)
- Checklists split: GC/IP show Pre-Qualification/Screening/Matching; Matched Journeys tab for journey stages

Admin Settings:
- Checklists section is collapsible (closed by default)
- Team Members section: add, edit, deactivate users with role selection (Master Admin, Admin, Marketing)
- Super Admin (developer) hidden from agency-visible user list
- Real ABC Surrogacy staff names: Julie Allgood, Nicole Lawson, Emily Rotter, Stacie Adler, Desiree Melchiori, Jennifer Rose
- Removed placeholder admin note seed data

Twilio SMS Integration:
- Cloudflare Pages Function at /api/sms/send (server-side Twilio API call)
- Cloudflare Pages Function at /api/sms/list (fetches sent & received messages)
- src/lib/sms.js: sendSMS() and fetchSMSMessages() helpers
- Text button on surrogate detail opens send dialog with success/error feedback
- Text Messages page at /text-messages: table of all SMS with direction, contact, case link, status, date
- Case matching: phone numbers matched to GC/IP cases from Supabase
- Read/unread tracking via localStorage (per message SID, inbound only)
- Blinking pink dot: sidebar "Text Messages" link, table rows, "Texts" tab on case detail
- Texts tab on surrogate detail: iMessage-style conversation thread with inline compose
- Default filter set to "Received" messages
- Polls for new messages every 60 seconds

Admin Profile Editor:
- ProfileTab rewritten with rich form controls (Yes/No dropdowns, proper Select fields)
- Add/Remove pregnancies, household members, surrogacy journeys
- PROFILE_SECTIONS expanded to include ALL fields from surrogate profile builder
- Eye/EyeOff toggle on every field to hide from IPs (_hiddenFields in profile_data)
- Hidden fields immediately saved to Supabase on toggle
- ProfilePreview respects _hiddenFields via HiddenFieldsContext + fp props
- All 88+ preview fields tagged with fp props for automatic hiding
- PDF and share views automatically exclude hidden fields

Other Fixes:
- Contact tab save now updates applicant_name + applicant_phone in Supabase
- Milestones wrap on surrogate cards when too many for one line
- "Screening" tab renamed to "Checklist"
- "Screening Checklists" → "Checklists" in settings

Shared Profile Components Created:
- src/components/profile/ProfileFields.jsx: reusable field components with optional wrapper prop
- src/components/profile/profileConstants.js: SECTION_META, REQUIRED_FIELDS, US_STATES, helpers

**Next steps:**
- Fix admin profile question labels to match exact surrogate form wording (300+ fields) — waiting for ABC feedback
- Complete field label mapping shared between admin and surrogate views
- IP Profile builder (matching profile, similar to surrogate)
- Ability to share/send profiles externally
- Auto Emails, Gmail API
- Google Calendar API
- Fax API, Contract/E-Signature API
- Logout sessions, TFA, User Settings
- Deactivate Profile questions feature refinement
- Persist checklist config to Supabase (currently localStorage)
- Twilio: upgrade from trial, set up incoming webhook, per-admin numbers

**Open questions:**
- Should admin profile labels exactly match surrogate form or use shorter labels? (waiting for ABC feedback)
- Should checklist configuration be per-admin or shared across agency?
- Twilio: upgrade plan needed for production texting to non-verified numbers
- Should IP cases have the same stage/status system as surrogates?

---

## 2026-03-27 (Late Night Session — IP Intake & Bot Protection Fix)

**Worked on:** IP intake form rebuild from PDF specs, IP confirmation page, IP admin cases (live Supabase), Turnstile fix, rapid-fill bot detection fix

**Changes made:**

IP Intake Form (rebuilt from Couple/Single IP PDF specs):
- Replaced familyType choice cards with Yes/No "Are you going through this journey with a partner?"
- Partner fields (name, DOB, email, phone) show conditionally when hasPartner=true
- Added conditional "What is your doctor's name?" field when hasRE=true
- Added conditional "How many frozen embryos?" field when hasFrozenEmbryos=true
- Changed "How did you hear" from choice cards to free-text textarea
- Removed agreeToConsultation checkbox
- Submit button label: "Submit application"
- IPs never disqualify (dqReasons always empty)

IP Confirmation Page:
- IPs always see simple thank-you: "Please be sure to check your spam folder... A member of our team will reach out to you within 48 hours."
- No password creation (ABC invites IPs manually when ready)
- No DQ path for IPs
- GC flow unchanged

IP Admin Cases (live Supabase):
- Added fetchIPsFromIntake() in db.js — queries intake_submissions where intake_type='ip'
- IPListPage now pulls live data from Supabase (replaced mockIntendedParents)
- Tile/list view, search by name/email/location, status & type filters
- Cards show RE doctor, embryo details, consultation preference
- IPDetailPage rebuilt with Overview (IP1, IP2, fertility), Contact (copy buttons), Intake Answers tabs
- Updated IPAnswerDetail in IntakeSubmissionsPage for new form fields

Bot Protection Fix:
- Rapid-fill detection was too aggressive (80ms/5 hits) — caught real users using autofill/tabbing
- Changed to 30ms/10 hits — still catches bots but not humans
- Fixed Turnstile by adding correct hostnames (app.abcsurrogacy.com, abc-surrogacy.pages.dev, localhost)

Deploy:
- Confirmed Cloudflare Pages auto-deploys on push to main
- Confirmed Supabase connection works on production
- Tested end-to-end: IP form → Supabase insert → admin list page

**Next steps:**
- Build IP Profile (matching profile builder, similar to surrogate profile)
- Text API integration (Twilio recommended, iMessage not possible)
- Fax API, Contract/E-Signature API
- Auto Emails, Gmail API integration
- Google Calendar API integration
- Logout sessions, TFA, User Settings
- Admin Images/Settings/Preferences
- Deactivate Profile questions
- Ability to send Profiles externally

**Open questions:**
- Which text messaging provider to use? (Twilio recommended, team wants personal numbers)
- Should IP cases have stages/statuses like surrogates?
- What fields should the IP matching profile include?

---

## 2026-03-27 (Evening Session)

**Worked on:** Admin dashboard tile updates, screening overview UX improvements, IP intake form rework, IP confirmation flow changes

**Changes made:**

IP Intake Form Rework:
- Removed family type selector (Couple/Same-sex/Single), replaced with partner yes/no question on step 3
- Added follow-up fields: RE doctor name (when hasRE=true), frozen embryo count (when hasFrozenEmbryos=true)
- Changed "How did you hear about us" from multi-choice cards to free-text textarea
- Removed consultation agreement checkbox (agreeToConsultation field)
- Updated phone placeholder to US format (+1 (555) 555-0100)
- Step 2 subtitle updated to remove "match you with a surrogate" wording
- Final step button changed from "Get my next steps" to "Submit application"
- Step 5 title changed to "Almost there!"

IP Confirmation Flow:
- IPs no longer see account creation prompt — shows "We'll be in touch" message instead (ABC will invite them manually)
- Navigation guard (beforeunload warning) skipped for IPs
- Next steps icons use IP color (#464DA0) instead of surrogate pink
- GC flow unchanged (still creates account on confirmation)

Admin Dashboard Tiles:
- Renamed "Active IPs" → "Intended Parents"
- Renamed "Pending Review" → "Matched Journeys" (with Heart icon)
- Clicking Surrogates tile when already selected no longer reverts to home view

Screening Overview UX:
- Removed "All" filter button — defaults to Pre-Qualification selected
- Limited stage filters to only Pre-Qualification, Screening, Matching (removed Journey Oversight/Ending/Closed)
- Replaced small pill-style filter buttons with card-style buttons matching /surrogates page (rounded-xl, colored numbers, uppercase labels)
- Empty state message when no surrogates in selected stage

Table Cleanup:
- Surrogate names bumped from text-xs to text-sm
- Location/age info bumped from text-[10px] to text-xs
- Map pin icon increased from size-2.5 to size-3
- BE referral logo increased from h-3.5 to h-4
- "SCREENING STEP" header bumped from text-[10px] to text-xs
- Header and row padding increased for more breathing room (py-2.5→py-3.5, px-3→px-4/px-5)

**Next steps:**
- Make Intended Parents, Matches in Progress, and Matched Journeys tiles clickable with their own views
- Build IP screening/management view (similar to surrogate screening overview)
- Improve screening table: inline status editing, column sorting
- Persist screening/record tracking to Supabase (currently localStorage)
- Build Case Updates section in navigation

**Open questions:**
- Should IP tile click show a similar screening sheet or a different view?
- Should screening checklists be configurable/assignable per case?
- How should Matched Journeys tile view differ from the /journeys page?

---

## 2026-03-27 (Continued Session)

**Worked on:** Screening & medical records tracking, PDF download, documents overhaul, matched journeys module, stage filtering, record logging UX

**Changes made:**

Screening & Medical Records Tracking:
- Built TrackingTable component — reusable table for step/status tracking with history
- Screening tab: 7 standard steps (PAP, OB Clearance, Records Reviewed, Background Check, Psych, Mitera, Insurance) + pregnancy-based prenatal/delivery steps
- Medical Records tab: auto-generated from pregnancy history (OB Records, Delivery Records per pregnancy, IVF Records for surrogacy pregnancies)
- Record statuses: Not Started, Requested, Request Received, Followed Up, Received, Reviewed, Complete
- Screening statuses: Not Started, Scheduled, Waiting on Surrogate, Waiting on Provider, In Progress, Followed Up, Needs Review, Under Review, Incomplete — Needs Resubmission, Complete, N/A
- Status logging with notes, date (MM-DD-YYYY format), admin name tracking
- Edit/delete log entries on hover
- Green row + checkmark when step is Complete
- Progress bar with completion count
- Overview tab shows same screening checklist as Screening tab
- Data stored in localStorage per surrogate

PDF Download:
- Replaced html2pdf.js (was freezing browser) with print-window approach
- Opens clean new tab with profile content + "Save as PDF" button
- Print styles: zero margins, edge-to-edge colors, no rounded corners
- Stats bar padding in print mode
- Preview footer hidden in print
- Bottom base fee section removed from preview (only in summary header)

Documents Overhaul:
- Fixed multi-file upload (was race condition with async state)
- Drag-and-drop files into folder cards with highlight animation
- ZIP file extraction: upload zip → extract client-side → rename/assign folders → preview files → batch upload with progress bar
- Parallel upload (5 at a time) with progress bar showing X/Y files
- Preview button on extracted files (images + PDFs) with prev/next navigation

Navigation & Modules:
- Matched Journeys page at /journeys — dashboard with tiles, list view, stage filters, search
- Sidebar: added "Matched Journeys" under Client Management
- Restored original Matching page (Kanban board) at /matching
- Stage stats on /surrogates now clickable to filter
- Stage counts reflect owner filter (My Cases shows only my counts)

Profile Tweaks:
- Removed Blood Type from profile (will be in application)
- Print CSS improvements for edge-to-edge PDF output

**Next steps:**
- Improve screening table UX — add column headers, inline log entry
- Screening steps: OB Records/Delivery Records show X/X completion, IVF only for experienced surrogates
- Build Case Updates section in navigation (Surrogate Updates, IP Updates, Matched Journey Updates)
- Build spreadsheet-style case update reports
- Persist record tracking to Supabase (currently localStorage)

**Open questions:**
- Should screening checklists be configurable/assignable per case?
- How should the Case Updates spreadsheet report aggregate data across surrogates?
- Should record tracking data move to Supabase now or after more iteration?

---

## 2026-03-26 / 2026-03-27 (Multi-Day Session)

**Worked on:** Complete surrogate profile restructure per ABC Surrogacy spreadsheet feedback, profile preview redesign, admin profile tab overhaul

**Changes made:**

Profile Restructure (9 → 11 sections):
- Personal Information: merged About Me + Family, added US citizen, Real ID, passport, languages, monogamous, partner citizenship, profile photo (solo) + cover photo (family)
- Pregnancy History: added per-pregnancy infection, birth defect, complications checklist with outcome-specific wording
- Fertility Information: removed redundant counts, deleted hospital stay, updated cycle/breastfeeding wording, added NICU questions
- General Information: expanded from Lifestyle — housing, custody, smoking/alcohol/substances detail, guns, tattoos, eating disorders, diet, FDA tests, ethnicity, religion, criminal history, travel, exercise, sleep, vehicle
- Health Information: "issue" → "challenge", deleted HepB/C & partner Covid questions, expanded disease checklist
- Employment Information: added industry, hours detail, insurance type
- Interests (NEW): favorites, pets, hobbies, collections, travel, personality
- Academic Information (NEW): education level, currently in school
- Experienced Surrogate Information (split from Surrogacy Preferences): per-journey structured cards with RE doctor, outcome, transfers, embryo source
- Journey Hopes & Wishes (split from Surrogacy Preferences): motivation, matching, medical decisions, compensation with negotiable flag and currency formatting

Conditional Logic:
- Partner/spouse questions hidden when Single, Divorced, Separated, Widowed — across Personal, General, Employment, and Hopes sections
- "In a Relationship" added as marital status option (quiz + profile)
- Monogamous question hidden for Single/Divorced/Widowed
- Experienced Surrogate section hidden from IP preview when answer is No
- Cycles to conceive only shown for non-surrogacy pregnancies
- Infection question wording varies by outcome type

Data Mapping & Migration:
- Quiz answers (DOB, height, weight, city, state, marital status, US citizen) pre-fill into profile
- Auto-migrate old about/family/lifestyle/preferences keys to new section keys
- Household members: structured table (name + relationship dropdown) with auto-fill of partner as person #1

Profile Preview Redesign:
- Switched from modal to inline rendering in content area
- 850px max-width matching letter-size PDF
- Cover photo hero with gradient overlay + photo gallery thumbnails
- Summary card: name, location, age, base fee, bio quote
- Quick stats bar: height, weight, BMI, blood type, status
- All 10 sections as styled cards with gradient headers, Yes/No pills, pregnancy cards, household grid
- "Not provided" shown for unfilled fields
- Compensation section with negotiable badge
- Button toggles between "Preview" and "Edit Profile"

Admin Profile Tab:
- PROFILE_SECTIONS updated to match new 10-section structure
- Preview uses same inline ProfilePreview component (shared via export)
- Edit expands section card to full-width with animated transition instead of dialog
- Cancel/Save inline in expanded card header, 3-column field grid
- Pregnancy edit uses proper dropdowns (outcome, delivery type, sex, multiples)
- Household edit uses name + relationship dropdown
- Scroll-to-section on edit click
- Complex array fields (pregnancies, household) render as numbered cards

Other:
- Base compensation auto-formats as currency ($xx,xxx) while typing
- Profile photo upload: solo photo + family cover photo side by side
- Cover photo hint: "Upload a favorite picture of you with your family or kids!"
- Profile photo hint: "Upload a favorite recent photo of just you!"
- Removed Still Birth from pregnancy complications checklist
- Added Celibacy, Vasectomy, Same Sex Partner as contraceptive options
- Added Cousin, Aunt, Uncle to household relationship options
- Combined Blood type + RH factor into single dropdown
- Generated CSV of all 170+ profile questions (docs/surrogate-profile-questions.csv)

**Next steps:**
- Add PDF download/email functionality for admins
- Build intended parent intake and management
- Connect matching module to real data
- Build Messages/Communication module
- Build screening workflow
- Persist stage/status to Supabase

**Open questions:**
- PDF generation approach — browser print, html2pdf, or server-side?
- Should profile changes notify the surrogate or admin?
- How should the admin PDF download/email flow work?

---

## 2026-03-24 (Full Day Session)

**Worked on:** Landing page routing, bot protection, surrogate list/detail page redesign with GTPAL, interactive hero tiles, stages & statuses system, rich text notes, documents tab, search engine blocking

**Changes made:**

Landing Page & Routing:
- Root URL (/) now shows ComingSoonPage ("Something beautiful is coming")
- Dashboard moved to /dashboard, all internal links updated
- Updated tagline to "Big things are on the way. / We can't wait to share them with you."

Bot Protection (4 layers):
- Honeypot hidden fields on both surrogate and IP intake forms
- Time-based validation (rejects < 15 seconds)
- Rapid-fill detection (inhumanly fast field changes)
- Cloudflare Turnstile CAPTCHA (site key configured in env + Cloudflare Pages)
- Bots get fake success page so they can't adapt

Surrogate List Page Redesign:
- Hero stats bar with stage counts (gradient colored per stage)
- Beautiful card design with Age/Height/BMI stats grid, GTPAL pregnancy display, screening progress
- Cards are fully clickable (navigate to case), assignment dropdown stops propagation
- "New" surrogates get animated pink ping dot on cards and table rows
- Grid/list view toggle, StageBadge replaces old StatusBadge
- Status settings gear icon for admin status management

Surrogate Detail Page Redesign:
- Interactive flip tiles: Age↔DOB, Height↔cm, Weight↔kg, BMI↔range, Relationship↔Partner
- Stage selector dropdown (6 stages, gradient colored, numbered)
- Status selector dropdown (configurable per stage)
- Pink ping dot on Status tile when "New"
- Email/Call/Text buttons with copy-to-clipboard (click text to flip back, click copy icon to copy)
- Text button highlighted with gradient when it's preferred contact method
- Milestone icon for Stage tile

Stages & Statuses System:
- 6 journey stages: Pre-Qualification, Screening, Matching, Journey Oversight, Journey Ending, Journey Closed
- Each stage has configurable statuses (Pre-Qual defaults: New, 1st/2nd/3rd Reach Out, Screening Call Scheduled/Complete, etc.)
- StatusSettingsDialog: admins can add/edit/delete statuses per stage with in-use warnings
- All stage/status data stored in localStorage (per surrogate)
- StageBadge component with gradient pink-to-blue stage colors

Contact Tab:
- Merged Quiz Answers + Contact Info into single "Contact" tab
- Proper form controls: state dropdown, marital status select, preferred contact select, yes/no toggles
- All fields editable and saved back to Supabase
- BE Referral toggle at bottom

Notes (Supabase Backend):
- case_notes table in Supabase with full CRUD
- Rich text editor (Tiptap): bold, italic, underline, strikethrough, text color (8 colors), highlight (6 colors), bullet/numbered lists, undo/redo
- Inline edit mode, delete with permanent confirmation modal
- Notes show author, timestamp, (edited) indicator

Documents Tab:
- 9 document categories: Photo IDs, Agency Agreement, Benefit Package, Medical Records, Insurance, Legal, Background Check, Psych Evaluation, Other
- Upload to Supabase Storage per category
- Full-screen preview overlay for images and PDFs (no new tabs)
- Rename files, move between categories
- Search bar filters documents, hides empty categories when searching
- Grid/list view toggle
- Drag-to-reorder category cards (persisted in localStorage)
- Delete with permanent confirmation modal

Search Engine Blocking:
- robots.txt disallowing all crawlers
- noindex/nofollow meta tag

**Next steps:**
- Create `case-documents` storage bucket in Supabase (public)
- Build screening workflow (admins update medical/psych/background/home study status with dates)
- Build intended parent intake and management
- Connect matching module to real data
- Build Messages/Communication module (text integration)
- Build email integration
- Move remaining stub pages to real implementations
- Persist stage/status to Supabase (currently localStorage only)

**Open questions:**
- Should stage/status changes trigger notifications?
- How will the text messaging integration work? (Twilio?)
- Should document categories be admin-configurable (like statuses)?
- How should screening status updates work? (toggle per step, or a form with dates?)

---

## 2026-03-23 (Full Day Session)

**Worked on:** Major surrogate dashboard improvements, mobile responsiveness, photo upload, profile sync to Supabase, admin surrogate management, case assignment, Be Surrogacy referrals

**Changes made:**

Dashboard & Navigation:
- Removed "My Match" from sidebar nav and dashboard cards
- Made ProfileProgressCard full-width with 72px progress ring, description, gradient bar, pink CTA
- CTA links to first incomplete profile section via URL hash
- Added clickable Quiz Results card → dialog showing actual quiz answers (only quiz fields)
- "You're all caught up" banner moves to top when no tasks assigned
- Forms page shows empty state for surrogates (no placeholder data)
- Added "Reviewed" status to intake submissions (admin filter + action buttons)

Mobile Responsiveness:
- Sidebar hidden on mobile, opens as Sheet drawer via hamburger menu
- TopBar has hamburger button, hides user name on small screens
- PageHeader stacks vertically on mobile with smaller text
- Profile card stacks vertically on small screens
- Reduced padding on mobile

Photo Upload (Supabase Storage):
- Created `profile-photos` bucket in Supabase Storage
- Real photo upload for Cover Photo (About Me) and Photos gallery
- HEIC support: accepts HEIC in file picker, converts via heic2any for Chrome
- Drag-to-reorder photos with @dnd-kit (desktop click+drag, mobile hold+drag)
- Click-to-edit with react-easy-crop (crop, zoom, rotate)
- Cover photo shown in gallery grid with pink "Cover" badge
- Renamed "Profile Photo" to "Cover Photo" in About Me

Profile Sync to Supabase:
- Created `surrogate_profiles` table (user_id, email, profile_data JSONB, status)
- Profile auto-saves to both localStorage and Supabase (debounced 2s)
- Existing localStorage data pushes to Supabase on first visit
- Admin can view full profile data with per-section completion tracking

Admin Surrogate Management:
- Surrogates list pulls real data from Supabase intake_submissions
- Admin dashboard stat cards pull live counts from Supabase
- Surrogate detail page fetches real data (contact, quiz answers, profile, photos)
- Profile tab: per-section edit dialogs, completion grid, Preview, Approve/Unapprove
- Profile approval locks surrogate from editing, shows green banner
- Overview tab: read-only by default, Edit button unlocks fields, Save/Cancel
- Quiz Answers tab shows only actual quiz fields

Case Assignment:
- `assigned_to` column on intake_submissions
- Surrogates list defaults to "My Cases" for all admins
- Owner filter: My Cases, All Cases (master/super only), Unassigned, by specific admin
- Assignment dropdown on each card and detail page hero
- Regular admins cannot see "All Cases"

Be Surrogacy Referrals:
- `referral_partner` column on intake_submissions
- (BE) logo badge on surrogate cards and detail page hero
- Toggle in editable contact section (read-only view shows Yes/No)
- Toggle in Add Surrogate dialog

Add Surrogate:
- "+ Add Surrogate" button opens dialog (name, email, phone, state, DOB, BE toggle)
- Auto-assigns to current admin, creates intake_submissions record

Gravida/Para:
- Calculated from pregnancy history profile data
- Shows G/P/M/T on list cards and detail hero
- Color coded: indigo=gravida, green=live births, amber=miscarriage, gray=termination
- Hidden until surrogate enters pregnancy data

Other:
- Google Tag Manager (GTM-KK2Q822N) installed on all pages
- Cleared all placeholder mock data (kept config constants)

**Next steps:**
- Build screening workflow
- Build intended parent intake and management
- Connect matching module to real data

**Open questions:**
- How should screening status updates work?
- Should the surrogate be notified when their profile is approved?

---

## 2026-03-03 (Evening)

**Worked on:** Time Clock page — admin clock in/out with pay periods

**Changes made:**
- Created `src/data/mock/timeClockData.js` — staff list, pay periods, time entries
- Created `src/pages/time-clock/TimeClockPage.jsx` — full time clock page
- Updated `src/App.jsx` — added real route

**Next steps:**
- Build remaining stub modules

---

## 2026-03-03

**Worked on:** Phase 3 — Matching profiles and photo gallery feature

**Changes made:**
- Photo gallery, share pages, matching profiles
- Updated docs

**Next steps:**
- Build matching module, documents, messages

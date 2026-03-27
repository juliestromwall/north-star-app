# Session Log

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

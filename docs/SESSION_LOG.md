# Session Log

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

Surrogate Quiz Updates:
- "See if you qualify" badge: gradient pink→navy background, white text
- Progress bar: gradient-filled pill with "Step X of Y" text above
- Logo size consistent across all intake pages (h-14)
- "Let's meet!" text updated per client request
- "Other" referral source shows text input for details

Other:
- Google Tag Manager (GTM-KK2Q822N) installed on all pages
- Cleared all placeholder mock data (kept config constants)
- Surrogate profile Preview button on profile page
- `app.abcsurrogacy.com` subdomain recommended over subfolder

**Next steps:**
- Build screening workflow (admins update medical/psych/background/home study status)
- Build intended parent intake and management
- Connect matching module to real data
- Build Documents module with file upload
- Build Messages/Communication module
- Move remaining stub pages to real implementations

**Open questions:**
- How should screening status updates work? (toggle per step, or a form?)
- Should the surrogate be notified when their profile is approved?
- How will matching work between surrogates and IPs?
- Should there be an audit log for admin actions (status changes, edits)?

---

## 2026-03-03 (Evening)

**Worked on:** Time Clock page — admin clock in/out with pay periods

**Changes made:**
- Created `src/data/mock/timeClockData.js` — staff list (from mockUsers), 4 bi-weekly pay periods (Jan 19 – Mar 15, 2026), ~25 time entries, helper functions (getCurrentPayPeriod, calculateHours, formatTime12h)
- Created `src/pages/time-clock/TimeClockPage.jsx` — full time clock page with clock in/out, live HH:MM:SS timer with pulsing green indicator, pay period summary card (total hours, days worked, avg daily), time entries table with prev/next period navigation, status badges (pending/approved/edited), edit entry dialog with time inputs and live hours preview, master_admin/super_admin staff selector dropdown
- Updated `src/App.jsx` — removed `/time-clock` from stubs array, added real route with TimeClockPage import
- Updated `docs/FEATURES.md` — added TimeClockPage and timeClockData entries + changelog

**Next steps:**
- Build remaining stub modules (Documents, Messages, HR Management, etc.)
- Connect time clock to backend when Supabase is configured
- Add timesheet approval workflow (admin approves pending entries)
- Add pay period report export

**Open questions:**
- Should time clock support break tracking (lunch breaks, etc.)?
- Should there be overtime calculation rules?

---

## 2026-03-03

**Worked on:** Phase 3 — Matching profiles and photo gallery feature

**Changes made:**
- Downloaded 16 stock photos from Pexels for 5 surrogates and 3 IPs (stored in `public/photos/`)
- Added `photos` arrays to mock data for all surrogates and IPs
- Created `PhotoGallery` component with hero mode (share pages) and grid mode (admin detail pages)
- Created `AddPhotosDialog` component with mock upload drop zone UI
- Built `SurrogateSharePage` — standalone branded matching profile with privacy-safe names, curated sections (About Me, Surrogacy Experience, Preferences, Medical Snapshot, Insurance), photo gallery, Copy Link, and Download PDF
- Built `IPSharePage` — standalone branded matching profile with privacy-safe names, About Us, natural-language preferences narrative, Budget Range
- Updated both admin detail pages with "Share Profile" button and Photos section in Overview tab
- Added standalone routes in App.jsx (`/surrogates/:id/share`, `/intended-parents/:id/share`)
- Added print CSS to `index.css` for PDF-friendly output
- Updated `docs/FEATURES.md` and `docs/PRODUCT.md`
- Verified all pages with Playwright screenshots

**Next steps:**
- Build the Matching module (currently a stub) — admin can browse candidates and propose matches
- Add egg donor profiles (similar structure to surrogates)
- Build Documents module with file upload/download UI
- Build Messages/Communication module

**Open questions:**
- Should share pages require a token/password for access, or remain open links?
- Will matching profiles need a "Request to Match" CTA button for the recipient?

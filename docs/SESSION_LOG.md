# Session Log

## 2026-04-03 (Case Import, Insurance Page, Sidebar Redesign, Dark Mode, Date Formatting)

**Worked on:** Case Import page for Super Admin (surrogate + IP with partner, file uploads, matched journey creation with match sheet import), Insurance spreadsheet page, sidebar redesign with liquid glass, centralized date formatting, dark mode (built then hidden)

**Changes made:**

Case Import (src/pages/admin/CaseImportPage.jsx):
- Full case import page at /case-import (Super Admin only)
- Case type: Surrogate or Intended Parent (IP2 partner fields shown inline when IP selected)
- Fields: first/last name, email, phone, state, DOB, application date
- Application date saves as submitted_at on the record + in answers.applicationDate
- File upload zones: Profile PDF, Application PDFs (multiple), Documents ZIP (auto-extracts), Notes Excel (parses Note/Author columns), Photos
- ZIP extraction via jszip (filters __MACOSX, hidden files)
- Excel notes import via xlsx (tries common column names)
- 50MB client-side file size validation (matches Supabase storage limit)
- Success screen with View Case / Import Another buttons

Create Matched Journey section (bottom of Case Import page):
- Searchable surrogate picker + searchable IP picker (type to filter)
- Original match date field + current stage dropdown
- Match Sheet Data import: collapsible accordion with Excel upload OR manual entry
- Excel parser maps ~60 column name variations to _matchSheetData fields (case-insensitive, flexible)
- Supports column-header format and key-value (Field/Value) format
- 29 editable match sheet fields in review grid
- Creates journey via createMatchedJourney, saves match_date + stage + match sheet data
- match_date column added to matched_journeys table (SQL migration)

Insurance Page (src/pages/insurance/InsurancePage.jsx):
- Full spreadsheet-style insurance management
- Surrogates as rows (only those with insurance records), fields as columns
- Columns: State, Status, Year, Carrier, Premium, Due Date, Website, Login, Password, Autopay, Autopay Date, Plan Start, Plan End, Binder Paid, OB, Hospital, Notes
- Per-row password visibility toggle (eyeball icon)
- EditableCell with inline editing (click to edit, Enter to save, Escape to cancel)
- Status dropdown: active_policy, policy_check, open_enrollment, complete
- Year dropdown (current year + 5)
- Dynamic tabs: Active Policies + status × year combinations
- Search searches across ALL tabs (bypasses status filter), clearable
- Admin filter dropdown populated from assigned case managers
- TabBanner for contextual messages per tab
- Insurance fields added to InsuranceTab.jsx (case-level): status, year, plan dates, binder, OB, hospital, notes
- DB migration: 8 new columns on surrogate_insurance table

Sidebar Redesign (continuing from previous session):
- Added Case Import nav item under Admin section (Upload icon, SUPER_ADMIN only)
- Navigation reorganization finalized

Date Formatting:
- Centralized formatDate(value) in src/lib/utils.js (MM/DD/YYYY)
- Swept across multiple files replacing local formatters
- Pink-styled dropdowns system-wide (select:focus, option:checked)

Dark Mode (built but hidden):
- Full dark mode CSS variables in .dark selector
- Toggle in TopBar (Moon/Sun icon) — removed at user request
- CSS preserved in index.css for future re-enablement
- localStorage persistence (abc_dark_mode)

DB functions updated (src/lib/db.js):
- adminAddSurrogate: now stores applicationDate in answers + uses it for submitted_at
- adminAddIP: same applicationDate handling, already supported IP2 partner fields

**Next steps:**
- Resolve file size limit for large PDF imports (Supabase storage limit is 50MB, old system profiles are larger)
  - Options: bump Supabase plan limit, or compress PDFs before upload
- Test full Case Import → Create Matched Journey flow end-to-end
- Test match sheet data appearing correctly on journey Match Sheets tab
- Build out Expense Tracking page
- Matching page redesign (user mentioned coming back to this)

**Open questions:**
- Supabase storage file size limit — user's old profiles exceed 50MB. Need Pro plan or compression
- Should application date show differently from submitted_at on the case list/detail pages?
- Expense Tracking scope and visibility (which roles?)

---

## 2026-04-03 (Journey Hero, Insurance, Attorneys, Draggable Tabs)

**Worked on:** Journey Detail page hero overhaul, attorney info, insurance tab, draggable tabs, hero UX fixes

**Changes made:**
- Attorney info for GC/IP in journey hero (editable, Email Attorney button, logged to case)
- Insurance Tab: policy details, payment logging, cancel policy (Supabase tables: surrogate_insurance + insurance_payments)
- Insurance indicator on hero cards (green icon, click opens dialog on journey)
- Draggable tabs (SortableTabsList) on Surrogate, IP, Journey pages — order saved per-case in Supabase
- Journey hero UX: Milestone icon in stage color, inline stage/status text, pregnancy only for Active Pregnancy+, gestational age large/bold, escrow closing date, clinics on own row
- GC/IP card fixes: age→DOB flip (MM/DD/YYYY), marital→partner flip, home→address flip, Text opens SMS dialog, IP shows both ages/DOBs/phones, FertilizedEggIcon for embryos

**Next steps:**
- Major layout redesign: 3-card hero (Journey purple | GC pink | IP blue) + persistent sidebar
- Journey-specific tasks, milestones as overview default, upcoming appointments, pinned notes, expenses
- Embryo transfer info, doctor appointments (future)
- Insurance dashboard page (future)

---

## 2026-04-03 (Complete Sidebar Redesign)

**Worked on:** Full sidebar navigation redesign — white background, liquid glass active state, icon updates, dock magnification, top bar cleanup, nav reorganization

**Changes made:**

Sidebar Design (src/components/layout/Sidebar.jsx, src/index.css):
- White background replacing old purple-pink glassmorphism gradient
- Liquid glass active state with ABC dot colors (green, blue, orange, pink) shimmer animation
- Dock magnification: hovered nav items scale up 15% with springy easing
- Section headers in indigo blue, pink solid line dividers
- Collapsible sidebar: click logo to toggle (full logo ↔ buggy icon)
- Subtle hover background tint + icon scale pop on nav items
- Logo enlarged (h-12 → h-16)
- CSS sidebar variables updated for white theme

Top Bar (src/components/layout/TopBar.jsx):
- Removed "Home" quick link
- Icon-only display (no text labels) for Email, Texts, Calendar
- Liquid glass active state matching sidebar
- Magnify on hover (120% scale)
- Text Messages uses MessagesSquare (two-bubble) icon

Navigation Reorganization (src/lib/navigation.js):
- New "Inbox" section (above Client Management): Email, Text Message, Fax
- Moved E-Signature from Forms & Documents to Operations
- Added Insurance placeholder to Operations
- Added Expense Tracking placeholder to Operations (for CC transaction logging by case managers)
- Hidden stubs: Forms, Documents, Messages, HR Management, Time Clock, Payroll, Finance (Financials/Reports)
- Kept: Intake/Applications, Marketing/Analytics, Admin/Settings

Icon Updates:
- Surrogates: Heart, Intended Parents: HeartHandshake, Matching: Puzzle, Matched Journeys: Route
- Messages: MessageCircle, E-Signature: PenLine, Payroll: Wallet
- Text Messages: MessagesSquare (two bubbles)
- Insurance: ShieldCheck, Expense Tracking: CreditCard
- Dashboard stat cards updated to match sidebar icons

New Files:
- public/abc-buggy.png — collapsed sidebar logo
- public/icons/matching.png, surrogate.png — unused ChatGPT-generated icons (kept for reference)
- src/components/layout/NavIcons.jsx — custom icon map (currently empty, all using lucide)

**Next steps:**
- Build Insurance page/feature
- Build Expense Tracking page (CC transaction logging, case-linked, admin-visible)
- Consider adding Calendar to sidebar or keeping it top-bar only
- Build out stub pages for new Operations items

**Open questions:**
- Should Expense Tracking be visible to all admins or just master_admin+?
- Insurance page scope: tracking surrogate insurance policies? Or broader?
- Should Calendar get its own sidebar section or stay top-bar only?

---

## 2026-04-03 (Match Sheets, Email Integration, Sidebar Redesign)

**Worked on:** Match Sheets feature for matched journeys (Attorney, Escrow, Clinic), email compose integration with auto-logging, glassmorphism sidebar redesign

**Changes made:**

Match Sheets (src/components/journeys/MatchSheetsTab.jsx):
- Attorney Match Sheet: header with logo/title/case manager, IP section (demographics, embryo creation with dropdown options), Surrogate section (demographics, spouse/partner, details), Journey Details (escrow, terms, psych), IVF Physician, Delivery Hospital
- Escrow Match Sheet: simplified layout — IP info, Surrogate info, Escrow Details (opening amount $5k, minimum $10k, fund after legal $100k)
- Clinic Match Sheet: IVF details, IP/Surrogate medical info, pregnancy history, fertility, insurance
- Custom EditableValue and EditableSelect components for inline editing
- Custom pink dropdown menus replacing native blue select
- PDF generation with page breaks (Surrogate on page 2, Journey Details on page 3)
- "Save to Documents" + "Send Match Sheet" buttons replacing "Download PDF"
- Send Match Sheet: generates PDF, attaches to email compose, auto-logs to journey
- Email subject format: "Attorney Match Sheet - IP(s) Name(s) with GC Name"
- Branded footer with abcsurrogacy.com banner image, address, phone numbers
- Date format: MM/DD/YYYY with support for MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD input
- Custom EmbryoIcon SVG component
- PartyBanner component for major section dividers (IP vs Surrogate vs Journey)
- Defaults: SeedTrust Escrow LLC, Max Counseling Sessions 15

Email Integration:
- Journey page: confirmation toast before emailing ("Email Nik L? email@...") with Confirm/Cancel
- Prevents accidental emailing wrong party (GC vs IP)
- IP page: email dropdown with both IP names, combines both emails in To field
- Surrogate page: added caseId to openDraft for auto-logging
- DraftContext: accepts caseType and initial attachments
- ComposeWindows: auto-loads cases when caseId pre-set, inserts email log directly
- Fixed crash-proof openDraft with triple try/catch for signature fetch

Sidebar Redesign (src/components/layout/Sidebar.jsx):
- Glassmorphism design: indigo → purple → pink gradient background
- Frosted glass active state with backdrop-blur and white border
- White logo area for clear branding
- Translucent badges and section headers
- Mobile sheet matches desktop styling

Other:
- Renamed "Benefit Package" folder to "Clinic" in surrogate documents
- Added phone numbers to admin mock users (src/data/mock/users.js)
- Fixed Desiree's email typo in mock users
- TrackingTable shared component: fixed scroll cutoff (overflow-hidden removed)

**Next steps:**
- Build journey Documents tab (duplicate surrogate document UX)
- Clinic Match Sheet needs same updates as Attorney (dropdowns, demographics, etc.)
- Email templates for match sheet emails
- Test PDF page breaks with real data
- Surrogate address/US citizen data may need profile completion

**Open questions:**
- Partner email/phone: currently pulls from profile, should also check intake confidential form fields
- "Previously Been a Surrogate" pulls from pregnancy history — verify data accuracy
- Email auto-logging to journey works but needs testing with real Gmail sends

---

## 2026-04-03 (Fax Integration — Full Build)

**Worked on:** SRFax API live integration, complete fax page UX overhaul with hero stats, table layout, filing workflow with medical records log updates, auto-advance navigation, sidebar badge

**Changes made:**

SRFax Credentials:
- Account number 288185 configured on Cloudflare Pages (SRFAX_ACCESS_ID + SRFAX_ACCESS_PWD)
- API confirmed working — 263 received faxes and 205 sent faxes loaded

Fax Page UX Overhaul (src/pages/fax/FaxPage.jsx):
- Hero stats bar: 4 clickable tiles (Received, Unread, Filed, Sent) with gradient background, act as filters
- Table layout with TrackingTable-style headers (10px uppercase stone-400)
- Received table columns: Fax Number, Document Name, Filed To (case link), Date Filed, Filed By, Log Updated, mark read/unread
- Sent table columns: Fax Number, Status, Pages, Date Faxed, Sent By
- Search by fax number or filed case name
- Mark All Read button
- Click row to preview (auto-marks as read)
- Pink animated dot + "New" badge on unread faxes

Fax Preview Modal:
- Near-fullscreen (95vw × 95vh), scrollable so filing panel can scroll out of view
- Sticky header with prev/next navigation arrows + counter (e.g., "3 / 263")
- "File to Case" button toggles inline filing panel
- Filing panel: rename document, select case type + searchable case selector
- Medical Records Log update: select record + status + note (collapsible section)
- Warning when case has no Medical Records tasks
- Inline amber warning if filing without updating log (Go Back / File Anyway)
- Auto-advance to next unread fax after filing (1.5s delay for success message)
- Closes modal when no more unread faxes

Send Fax Dialog:
- Two modes: Upload File or From Case (pick document from case documents)
- Case type selector (Surrogate/IP/Journey) + searchable case dropdown
- Cover page options (Standard, Company, Urgent, Confidential)
- "Send Fax" button on Surrogate, IP, and Journey Documents tabs

New Files:
- src/lib/faxState.js — localStorage-backed read/unread tracking + filing info (caseType, caseName, caseId, documentName, filedAt, filedBy, logUpdated)
- Updated src/lib/db.js — uploadBase64ToCaseDocuments() with filename sanitization

Sidebar:
- Unread fax count badge (violet) on Fax nav item
- Checks every 2 minutes via listFaxes API

**Next steps:**
- Test medical records log updates end-to-end (verify tracking data persists on case page)
- Add fax number per clinic for quick-send
- Log sent faxes to cases (like email logging)
- Fax delivery status tracking / notifications

**Open questions:**
- Should sent faxes be associated with cases (like email logging)?
- Should there be a default fax number per clinic/case for quick-send?
- Should fax filing data be stored in Supabase instead of localStorage for multi-user?

---

## 2026-04-03 (Fax Integration — Initial)

**Worked on:** SRFax API credentials setup, complete fax page overhaul with send-from-case, received fax preview, file-to-case functionality

**Changes made:**

SRFax Credentials:
- User added SRFAX_ACCESS_ID and SRFAX_ACCESS_PWD to Cloudflare Pages environment variables
- Redeployed to activate SRFax API

Fax Page Overhaul (src/pages/fax/FaxPage.jsx):
- Received tab (default) with inline PDF preview dialog, file-to-case button, download
- Sent tab with fax status and download
- Search by fax number
- Send Fax dialog with two document source modes: "Upload File" or "From Case"
- "From Case" mode: case type selector (Surrogate/IP/Journey), searchable case dropdown, pick document from case documents list
- Cover page options (Standard, Company, Urgent, Confidential)
- URL params support for prefill from case pages (caseType, caseId)

File to Medical Records Dialog:
- Preview received fax info (from number, pages, date)
- Rename document before filing
- Searchable case selector (Surrogate/IP/Journey)
- Files directly to "medical-records" category in case documents
- Confirmation with case name

Send Fax from Case Pages:
- Added "Send Fax" button to Surrogate Documents tab (next to Send for Signature)
- Added "Send Fax" button to IP Documents tab
- Added "Send Fax" button to Journey Documents tab
- All open /fax in new tab with case pre-selected

New db.js Helper:
- uploadBase64ToCaseDocuments() — converts base64 PDF to blob, uploads to Supabase storage, creates case_documents record

**Next steps:**
- Test with live SRFax data (verify credentials work — may need numeric account ID vs email)
- Test file-to-case flow end-to-end
- Add fax number to clinic/case data for quick-send
- Fax confirmation/delivery status tracking
- Batch fax to multiple numbers

**Open questions:**
- Are the SRFax credentials email-based or does it need a numeric account ID?
- Should there be a default fax number per clinic for quick-send?
- Should sent faxes be logged to the case (like emails)?

---

## 2026-04-02 (Continued — E-Signature Major Overhaul)

**Worked on:** Comprehensive E-Signature system improvements: signed PDF quality, audit trail redesign, form validation, signer role management, "Send for Signature" from case/journey pages, admin dropdown, journey auto-populate

**Changes made:**

Signed PDF Improvements:
- Typed signatures now render in "Dancing Script" handwriting font (dark blue)
- Drawn signatures uploaded to Supabase and inserted as inline images via Google Docs API
- Audit trail completely redesigned: compact 8pt font, fits on one page, page break separator
- Fixed Partner/Parnter typo handling in both signing page and PDF generation

Signing Page Validation:
- All {{Field:Role}} fields are now required before submission (name, initials, text, signature)
- Shows specific missing field names in alert
- Initials field no longer auto-fills — signers must type their own

Send Modal Improvements:
- Modal widened (sm:max-w-3xl), fixed shadcn Dialog sm:max-w-lg override
- Role field changed from text input to dropdown (Surrogate, Partner, IP1, IP2, Admin)
- Admin signer role shows dropdown of Master Admins and Admins (auto-fills name + email)
- Case selector is now searchable input with dropdown (shows name, email, assigned admin)
- Case type must be selected before case search is enabled
- Required signer roles auto-detected from document {{Field:Role}} placeholders
- Green/red badges show which roles are satisfied vs missing
- Send button disabled until all required roles have signers with emails
- Partner auto-populates from intake data (spouseFullName + spouseEmail)
- Added spouseEmail field to GC Application "Confidential Personal Information" section

E-Signature Page Restructured:
- Tabs renamed: "Sent Documents" + "Send for Signature" (was "Documents" + "Templates")
- Removed standalone "Send for Signature" button from Documents tab
- Case name in Documents table is now the clickable link to journey/case (not signer names)
- Signer names in Documents tab link to matched journey if matched, else individual case

Send for Signature from Case/Journey Pages:
- Added "Send for Signature" button to Surrogate, IP, and Journey Documents tabs
- Opens E-Signature page in new tab with case pre-selected
- Templates tab auto-shows with prefill banner
- Journey passes journeyId — auto-populates ALL parties (Surrogate, Partner, IP1, IP2)

Match Sheets:
- Reordered: Clinic → Escrow → Attorney (was Attorney → Clinic → Escrow)

**Next steps:**
- Test drawn signature images appearing in signed PDFs
- Email reminders for unsigned documents
- Build out IP and Journey Documents tabs (currently empty states)
- Copy-on-edit flow for templates
- Surrogate dashboard: view signed documents

**Open questions:**
- Should there be automatic reminders for unsigned documents? If so, how often?
- Should the IP Documents tab mirror the Surrogate Documents tab features?
- How should journey documents merge GC and IP documents with labels?

---

## 2026-04-02 (Continued — Matching, Journey UX, Email Fixes)

**Worked on:** Journey hero redesign (multiple iterations), matching pipeline cleanup, IP intake editing, email button dropdown with compose, log-to-case fix, Emails tab on journey, case_emails table creation

**Changes made:**

Journey Hero (multiple iterations):
- Compact inline layout: Stage/Status as pills with icons (Milestone + Circle)
- Lost Wages/Pumping as click-to-toggle chips
- Pregnancy status with gestational weeks + due date (MM/DD/YYYY)
- Escrow with cents, green/red based on minimum
- OB Clinic + Delivery Hospital (editable inline)
- Case Manager + Journey Manager stacked on right (spelled out)
- GC section: subtle "SURROGATE" label, avatar + name + age(→DOB flip) + relationship + address(click to copy) + flip-card contacts
- IP section: subtle "INTENDED PARENTS" label, same pattern + RE doctor + embryos + egg/sperm donor
- Super light pink/indigo background tints

Matching Pipeline:
- Matched cases hidden from /matching (only on /journeys)
- MATCHED badges removed
- IP color changed to ABC indigo (#283693)

Matched Journeys (/journeys):
- Cards: subtle SURROGATE/INTENDED PARENTS labels, tinted backgrounds, no arrow
- Added pregnancy status, escrow balance (green/red), case manager, journey manager to cards
- Removed gaps (Card gap-0 override)

IP Intake Answers:
- Now fully editable with all fields (name, DOB, email, phone, partner toggle, RE, embryos, donors, etc.)
- Save fetches fresh answers first, syncs to hero

Email Button Dropdown:
- Click Email on surrogate hero shows dropdown: "Email [Name]" (opens compose) or "Copy Email Address"
- Uses DraftContext/ComposeWindows system

Log to Case Fix:
- Fixed case selector: searchable grouped list (Matched Journeys, Surrogates, IPs)
- Was using applicant_name (didn't exist), now uses name/names
- Added matched journeys as a log target

Emails Tab on Journey:
- Added Emails tab to journey detail page
- Merges emails from journey + GC case + IP case (deduplicates)
- Created case_emails table migration (was missing from Supabase)

**Next steps:**
- Add Email dropdown to IP case hero (same as GC)
- Add Email dropdown to journey hero contact buttons
- Embed actual GC/IP profiles in journey Profiles tab (not just links)
- Journey checklist implementation
- Journey documents with GC/IP labels
- System email templates/notifications

**Open questions:**
- Should logged emails show on both the journey AND individual case Emails tabs?
- How should the compose modal pre-fill subject when emailing from a case?

---

## 2026-04-02 (Continued — E-Signature Signing Page)

**Worked on:** Public signing page, email notifications for signers, field placeholder rendering

**Changes made:**

Public Signing Page:
- /e-signature/:id is now a public route (no login required)
- Email verification gate: signer enters email to prove identity
- Shows document title, sent date, signer progress
- PDF preview via iframe if available
- {{Field:Role}} placeholders rendered as form inputs (Name, Email, Date, Initials, Text, Checkbox)
- Name/Email/Date fields auto-fill from signer data
- Signature pad (type or draw)
- Legal agreement checkbox with ESIGN/UETA language
- Standalone branded page (ABC logo, no app chrome)
- HIPAA notice and audit trail messaging

Email Notifications:
- Send for Signature now emails each signer via Gmail API
- Branded HTML email with ABC logo, document title, signer role
- "Review & Sign Document" button links to /e-signature/{docId}
- Legal footer text

Bug Fixes:
- Fixed "insert(...).catch is not a function" — Supabase query builders don't support .catch(), wrapped in try/catch
- Fixed undefined Google Doc ID in iframe (route param name mismatch: `id` vs `templateId`)
- Removed Google Drive draft copies on send
- Fixed audit log insert error

**Next steps:**
- After all signers complete, auto-save final PDF to case documents (create "E-Sign" folder)
- Add document preview from Documents tab (view sent PDF)
- Add email reminders for unsigned documents
- Copy-on-edit: when editing template for sending, copy first so template stays clean
- Handle case where signer has no fields — just show signature pad

**Open questions:**
- Should completed documents auto-file to case documents or require manual action?
- Should there be automatic reminders for unsigned documents? If so, how often?
- How should the copy-on-edit flow work? (Copy on load vs copy on send)

---

## 2026-04-01 / 2026-04-02 (Multi-Day Session — APIs + E-Signature)

**Worked on:** Gmail API, Google Calendar API, SRFax API, E-Signature overhaul with Google Docs integration, floating compose email windows, Gmail signature, unread email badge

**Changes made:**

Google OAuth & APIs:
- Google OAuth2 flow via Cloudflare Pages Functions (auth, callback, refresh, status, disconnect)
- Token storage in Supabase google_tokens table
- Gmail API: inbox, send with attachments, search, log to case, signature auto-insert
- Google Calendar API: multi-calendar, create/edit/delete events, replaced mock calendar
- SRFax API: send/receive/retrieve Cloudflare functions + client helpers + Fax page (awaiting credentials)
- Google Drive API: list docs from ABC Templates folder, export as PDF, share publicly, copy docs
- Connect/disconnect Google in Settings page

Email (/email):
- Gmail-style UI: folder sidebar (Inbox, Starred, Sent, Drafts, Spam, Trash + user labels)
- Sender avatars, unread indicators, checkboxes for bulk actions
- Bulk archive, trash, apply label
- Floating compose windows (Gmail-style, bottom-right anchored)
- Multiple simultaneous drafts with minimize/expand
- Rich text toolbar (bold, italic, underline, strikethrough, colors, highlights, lists, links)
- Gmail signature auto-inserted in compose/reply/forward
- Save as Gmail draft on close
- Case selector in compose to auto-log sent emails
- Unread email count badge on sidebar nav (Primary tab count)
- Emails tab on surrogate and IP detail pages showing logged emails

Calendar (/calendar):
- Rebuilt with Google Calendar API (replaced mock data)
- Multi-calendar support, create/edit/delete events
- Calendar selector sidebar with colored calendars

Fax (/fax):
- SRFax API integration (send with file upload, inbox/outbox, download, cover pages)
- Awaiting SRFax credentials to go live

E-Signature (major overhaul):
- Evolved through multiple approaches: Tiptap editor → Google Docs iframe → final hybrid approach
- Final approach: templates stored as Google Docs in "ABC Templates" Drive folder
- Templates tab syncs from Google Drive, shows all docs with Edit & Send button
- Edit page embeds Google Docs in iframe — full editing with toolbar, pagination, headers/footers
- Send for Signature: exports PDF to Supabase, creates document record, emails signers via Gmail
- Signing field placeholders: {{Signature:GC}}, {{Name:GC}}, {{Date:GC}}, {{Email:GC}}, {{Text:GC}}, {{Initials:GC}}, {{Checkbox:GC}}
- Template delete fix (FK constraint + error surfacing)
- Branded signature request email sent to signers with "Review & Sign Document" button
- Download PDF button exports directly from Google Drive API

**Next steps:**
- Make /e-signature/:id signing page work without login (public route for signers)
- Parse {{Field:Role}} placeholders and render as interactive form inputs on signing page
- After all signers complete, save final PDF to case documents (e-sign folder)
- Add ability to view sent document preview from Documents tab
- Copy-on-edit flow: when editing a template for sending, copy it first so template stays clean
- Clean up [Draft] copies from ABC Templates folder

**Open questions:**
- How should the signing page authenticate signers without an account? (email verification? link token?)
- Should completed documents auto-file to the case documents, or require manual action?
- Should there be email reminders for unsigned documents?

---

## 2026-04-01 (Full Day Session)

**Worked on:** Email bulk actions/counts/categories, Matching pipeline rebuild, Profile sharing, Journey detail page, Match creation, Match notes, Journey hero redesign, Application tab quiz editing

**Changes made:**

Email:
- Bulk actions toolbar (delete, archive, apply labels) when emails selected
- Gmail sidebar categories (Snoozed, Important, Social, Updates, Forums, Promotions, Purchases) under collapsible "More"
- Message counts for all folders/labels using getLabel() API
- Inbox unread count badge on header Email pill
- Pulsing pink dot on header Texts pill for unread SMS

Header:
- Quick-link pills: Home, Email, Texts, Calendar in top bar
- Removed these from sidebar nav

Matching Pipeline (/matching):
- Rebuilt with live Supabase data (replaced all mock data)
- Rich GC cards: profile photo, stage badge, Age/Height/BMI tiles, GTPAL, marital status
- Share Profile button: generates 72hr secure link, sends branded email via Gmail API
- Create Match dialog: select GC + IP → creates matched_journeys record
- Match History: expandable section on each card showing share history (sent to, by, when, viewed)
- Match Notes: clickable on hero cards + matching cards, stored in intake_submissions.answers._matchNotes
- Matched cases hidden from pipeline (only on /journeys)

Shared Profile Page (/share/:token):
- Public page, no login required
- Full surrogate ProfilePreview (or IP info)
- ABC logo at top, confidentiality notice, expiry countdown
- Question form personalized with admin's first name
- Expired/invalid link handling

Matched Journeys (/journeys):
- Rebuilt with live Supabase data
- Tile view: stacked mini-hero cards (pink GC / indigo IP)
- List view: table with all details
- Stage filter pills with counts
- Search by name

Journey Detail Page (/journeys/:id):
- Stacked hero: journey info on top, GC section, IP section
- Click-to-edit journey tiles (Lost Wages, Pumping, Escrow Min, Balance)
- Stage/Status as clickable tiles (last two on right)
- Case Manager + Journey Manager (Julie/Nicole only) dropdowns
- IP color: ABC indigo (#283693) throughout
- Profiles tab: GC/IP toggle
- Notes tab: Shared/GC/IP/All filter with colored labels
- Rich GC section: avatar, name, location, age, phone, email, preferred contact, Text/Email buttons, stat tiles
- Rich IP section: avatar, name, type, RE doctor, embryos, egg/sperm donor, Text/Email buttons

Application Tab:
- Surrogate Quiz section now fully editable with all 16 fields
- Proper form controls (dropdowns, Yes/No toggles, date picker)
- Save fetches fresh answers from Supabase first (prevents data loss)

Bug Fixes:
- Share email: fixed htmlBody→body param for sendEmail
- Match Notes: fetch fresh answers before saving to prevent data overwrite
- ProfilePreview: hideFooter prop for shared profile view

**Next steps:**
- Journey hero redesign: flip-card contact buttons (like GC case), remove height/weight/BMI, add relationship/address flip tiles, pregnancy status/due date/gestational weeks, escrow with cents + color coding, smaller pumping/lost wages tiles
- Embed GC/IP profiles directly in Profiles tab (not just links)
- Journey checklist implementation
- Journey documents with GC/IP labels
- System emails for notifications

**Open questions:**
- How should pregnancy due date / gestational weeks display and update?
- Should the journey auto-advance stage when pregnancy is confirmed?
- Should profile shares show a "Potential Match" on logged-in user's dashboard?

# Session Log

## 2026-04-06 (Continued — E-Sign Templates, Email Templates, Calendar Picker, Dashboard Fix)

**Worked on:** E-sign template preservation, email templates with auto-welcome, calendar picker for multiple calendars, dashboard appointment fixes

**Changes made:**

E-Signature Template Preservation:
- Copies template into "ABC Drafts" folder before editing (original untouched)
- Draft auto-deleted from Google Drive after successful send
- Added getOrCreateDraftsFolder() + deleteGoogleDriveFile() helpers
- ABC Drafts folder hidden from template list (separate from ABC Templates)

Email Templates:
- /api/welcome-email Cloudflare Function: auto-sends branded welcome to qualified surrogates
- Creates portal account + includes "Set Up Your Portal Password" button
- Triggered automatically on quiz qualification (non-blocking)
- Uses Resend API (needs RESEND_API_KEY + domain verification)
- 5 templates: GC Welcome, GC Screening Scheduled, GC Profile Reminder, IP Welcome, Match Introduction
- emailTemplates.js: template definitions + mergeTemplate() for field replacement
- "Send Template" button on case Emails tab → pick template → preview → Open in Compose

Calendar Picker:
- Loads user's writable Google Calendars
- Auto-defaults to "Appointments" calendar if exists
- Calendar dropdown when creating appointments
- Events fetched from both primary + Appointments calendar, deduped

Dashboard Appointments Fix:
- Searches both primary + Appointments calendar (was only primary)
- Shows from start of today (not yesterday)
- Shows case name as clickable link on each appointment

**Next steps:**
- Set up Resend: add RESEND_API_KEY to Cloudflare, verify abcsurrogacy.com domain
- Add email preview page for testing templates
- More email templates as needed
- Consider adding "Preview" button to Send Template dialog

**Open questions:**
- Resend vs Gmail API for welcome emails (Resend chosen for branded from address)
- Should auto-welcome also trigger for IPs?

---

## 2026-04-06 (Email UI, Compose Fix, Auto-Logout, Personal Tasks, Pregnancy Tracker Polish)

**Worked on:** Email compose case selector fix, CaseEmailsTab improvements, auto-logout on inactivity, personal dashboard tasks, pregnancy tracker refinements, login routing

**Changes made:**

Email Compose — Case Selector Fix:
- Fixed "GC: undefined" / "IP: undefined" — was using .applicant_name instead of .name/.names
- Cases grouped by type: Journeys (IP + GC names), Surrogates, Intended Parents
- Wider dropdown (180px), section headers

CaseEmailsTab Improvements:
- Click email subject to open full email (removed external link icon button)
- Sent/Received badges (blue/green) based on from_address matching current user
- Tag selection on Log to Case dialog: selected tag turns indigo with ring glow + scale

Auto-Logout on Inactivity:
- Admins: 6 hours, Users: 1 hour
- Tracks mouse, keyboard, scroll, touch — resets timer on any activity
- Redirects to /login?reason=idle with amber message
- Built into RoleContext (runs whenever authUser is set)

Login Routing:
- Root URL (/) now shows login page instead of Coming Soon
- /welcome also routes to login
- After login redirects to /dashboard (was / which looped)

Personal Dashboard Tasks:
- "+ Add Task" button on My Tasks section
- Dialog: title, due date, priority, notes
- Saved with case_type='personal', no case_id
- "Personal" vs "Case" badges on task list

Pregnancy Tracker Polish (from 2026-04-05 continued):
- Status auto-updates to "Pregnant" on heartbeat confirmation
- Transfer tabs: Transfer #3 | #2 | #1 (newest first, compact)
- Edit transfer: full form with beta, beta #2, heartbeat, babies, dropped cycle
- Delete transfer: system dialog (not browser confirm)
- Beta: forced Yes/No for second beta (no default), beta value field
- Beta HCG #2: extra timeline step when needed
- Heartbeat: number of babies field
- Pregnancy loss: miscarriage/ectopic/chemical/other — logs on transfer, clears status
- Mark Unsuccessful button, Dropped Cycle option
- 🤰 emoji on pregnancy banner (tried several custom images, settled on emoji)
- Pink belly line art icon on /journeys cards
- Removed GC insurance label from GC card, bigger attorney font
- Sticky notes on GC and IP cards (shared across all users via app_config)
- Confetti uses same dramatic settings as surrogate quiz (260 particles, ABC colors)

Dashboard Build Fix:
- Fixed IIFE syntax error in JSX from other session's calendar changes

**Next steps:**
- Customizable checklist log types: Status Dropdown (default), Text Field, Custom Dropdown, Database Lookup
- System/locked checklist steps with database lookups (IVF Clinic, OB Doctor, etc.)
- Step deactivation per case (already works via "Deactivate" status)
- Determine which steps need database lookup sources

**Open questions:**
- Which checklist steps need database lookup? (waiting for user to specify)
- Should locked/system steps be visually different in Settings?
- Checklist log type for each existing step needs to be defined

---

## 2026-04-05 (User Invites, Dynamic Admin Users, Password Reset, Login Branding)

**Worked on:** User invite system, dynamic admin users from Supabase Auth, password reset flow, login page branding, invite bug fixes

**Changes made:**

User Invite System:
- /api/invite Cloudflare Function: creates Supabase auth user + generates password reset link
- /api/user-status Function: checks if user has account + last login date
- /api/admin-users Function: lists all admin users from Supabase Auth
- Branded invite email via Gmail API (logo, gradient button, personalized greeting)
- "Invite to Portal" button on Surrogate and IP detail pages
- Auto-invite when adding admin from Settings → Team Management
- Invite date logged per case (_lastInvitedAt stored in answers via direct Supabase query by ID)
- Portal status: shows "Portal Active" + last login when user has set password
- Invite button hidden once user has logged in

Dynamic Admin Users (replaces hardcoded mockUsers):
- /api/admin-users returns admin/master_admin/super_admin users from Supabase Auth
- mockUsers array populated on app load via loadAdminUsers()
- getAdminStaff() function replaces all module-level ADMIN_STAFF constants
- Updated 11+ files to use getAdminStaff() instead of static constants
- 3-second timeout fallback if API is slow
- Marketing role excluded from admin dropdowns
- Removed all hardcoded fallback users

Password Reset:
- Forgot password flow on login page (Supabase resetPasswordForEmail)
- /reset-password page with branded UI matching login
- Expired link detection with friendly message
- Redirect URL config needed in Supabase

Login Page Branding:
- Gradient background (indigo → cream → pink)
- "Welcome back" with pink accent
- Frosted glass card, pink-to-indigo gradient button
- Removed surrogate quiz link

Bug Fixes:
- Fixed invite wiping case data (was using fetchIntakeByEmail which returned wrong format; now uses direct Supabase query by ID)
- Fixed IPTileCard crash (missing getAdminStaff import)
- Fixed Cloudflare Functions using @supabase/supabase-js SDK (rewrote to raw fetch)
- Fixed invite reset link missing /reset-password redirect

**Next steps:**
- Email templates (predefined with merge fields)
- Admin invite from Settings needs to persist to Supabase (currently only local state + auth)
- Consider storing admin users in a Supabase table instead of just auth.users
- Test invite flow end-to-end on production

**Open questions:**
- Should admin team members be stored in a dedicated table or just auth.users?
- Email templates: what templates are needed first?
- Should we add a "Resend Invite" button for surrogates/IPs who haven't set their password?

---

## 2026-04-04 (Password Reset, Login Brand, List Redesigns, AI Extraction, Email CSS)

**Worked on:** Password reset flow, branded login page, IP/Journey list redesigns, AI expense/task extraction fixes, email CSS isolation, admin user setup

**Changes made:**
- Password reset: forgot password flow on login + /reset-password page (Supabase resetPasswordForEmail)
- Login page: gradient background, "Welcome back" in brand colors, frosted glass card, pink-to-indigo gradient button
- IP list: hero stats, owner filter, pink ping for New, milestones, FertilizedEggIcon, assigned admin
- Journeys list: hero stats, owner filter matching surrogates/IPs pattern
- AI extraction: full email body via Gmail API, improved dollar detection prompt, error surfacing
- Email CSS: sandboxed iframe prevents style leaking (Amazon dark theme fix)
- Expense email viewer: 90vw modal, mail icon links to full email
- Admin setup: desiree@abcsurrogacy.com user created + role fixed via user_metadata
- Removed surrogate quiz link from login

**Next steps:**
- User invite system
- Email templates
- Configure Supabase redirect URL for password reset

---

## 2026-04-04 (Dashboard Redesign, Expense Tracking, Gmail Signature, Documents, Matching, Name Ordering)

**Worked on:** Complete dashboard redesign, expense tracking system, Gmail signature fix, document management for IP/Journey, matching improvements, break match document handling, name ordering (IP first), Case Updates page

**Changes made:**

Gmail Signature Fix:
- Signature rendered as raw HTML below Tiptap editor (not parsed through it)
- Preserves tables, borders, images, animated GIFs exactly like Gmail
- Signature shown in compose preview only, not included in sent body (Gmail auto-appends)
- Fixed MatchSheetsTab userId (was undefined, preventing signature load)

Expense Tracking System:
- /expenses page: Insurance-style spreadsheet with Expenses/Reconciled tabs
- Columns: Case (IP+GC name + manager), Date, Amount, Paid To, CC Last 4, Escrow (Y/N), Notes, Doc, Reconcile
- Currency input: payment terminal style (type 2424 → 24.24)
- Reconcile confirmation modal with case name, "+ Create Task" option
- Task creation from reconcile: assigned to case manager, due today, priority high
- task_created flag on expense persists across sessions (amber warning on re-reconcile)
- Attachment upload + eyeball preview (images inline, PDFs in iframe)
- Journey Expenses tab: inline editable rows (click any cell), add/delete, paperclip upload
- "+ Add Expense" button on journey Escrow section
- Submitted to Escrow Y/N toggle on add expense dialogs
- DB: journey_expenses table CRUD with attachment_url, cc_last4, submitted_to_escrow, task_created

Escrow Section Updates:
- "Close" renamed to "Escrow Close Date", displays MM/DD/YYYY
- Balance update date logged (small gray text)
- All date fields in journey hero now format MM/DD/YYYY via formatDate()

Document Management:
- Real DocumentsTab on IP cases and Journey pages (was empty state)
- Journey Documents merges GC + IP docs with source labels ("GC — Name", "IP — Name")
- Added folders: Escrow, Expenses, Photos
- Renamed "Agency Agreement" to "Agency Documents"
- Removed duplicate Send for Signature / Send Fax buttons on journey
- Break match: copies only journey-period docs (not pre-match), keeps original folder
- "Previous Match" amber badge on copied docs (based on uploaded_by field)
- Labels moved to detail line (below filename) to prevent truncation

Matching Improvements:
- Create Match dropdowns hide already-matched GCs and IPs
- After creating match, navigates to new journey page
- IP names displayed first everywhere (journeys, emails, expenses, case import)

Dashboard Redesign:
- Motivational quote of the day (zenquotes.io API)
- Collapsible Upcoming Appointments (Google Calendar, next 7 days) + My Tasks columns
- My Cases: only assigned cases, separated by type (Journeys, Surrogates, IPs)
- Uses identical card components from actual list pages (JourneyTileCard, SurrogateCard, IPTileCard)
- Grid/list view toggle
- Calculator widget (fully functional)
- Sticky Notes (per-user localStorage, color-coded)
- Removed Surrogate Screening Overview (moved to Case Updates)

New /case-updates Page:
- Surrogate Screening Overview moved here from dashboard
- Stage filter pills, checklist spreadsheet
- Added to nav under Client Management after Matched Journeys

**Next steps:**
- Large file import (Supabase 50MB limit for old system profiles)
- Matching page redesign
- Journey merged Documents tab improvements
- Password reset feature
- User invite system

**Open questions:**
- Supabase storage file size limit — old profiles exceed 50MB
- Should journey documents show source labels differently?
- Expense tracking: should reconciled expenses be editable?

---

## 2026-04-04 (Continued — Email Tags, AI Extraction, IP/Journey List Redesign, Email CSS Fix)

**Worked on:** Email tagging with AI-powered expense/task extraction, IP list page redesign, Journeys list page redesign, email CSS isolation, admin user setup

**Changes made:**

Email Tagging System:
- 13 email tags: Escrow, Expense, Medical Records, Monitoring, OB, Hospital, Legal, Matching, Task, Insurance, Transfer, Psych, General
- Tag selector on Log to Case dialog (pill buttons after case selection)
- Tag dropdown on Compose window (next to case selector for sent emails)
- CaseEmailsTab: tag badges on emails, filter bar by tag, search by subject/from/snippet
- SQL migration: tag column + index on case_emails

AI-Powered Extraction (Cloudflare Function + Claude Haiku):
- /api/ai/extract function calls Anthropic API
- Expense tag: AI reads full email body (6000 chars), extracts description, amount, paid_to, date, category, notes
- Task tag: AI extracts title, description, priority, due_date
- Editable confirmation cards (amber for expense, orange for task) before saving
- Expense: links to email via Gmail ID in notes, viewable from Expenses page mail icon
- Task: defaults assigned_to to current user, admin dropdown to reassign
- Full email body fetched via Gmail API for better extraction (not just snippet)
- Improved AI prompt explicitly searches for dollar amounts ($X.XX patterns)

Expense Page Email Viewer:
- Mail icon on expenses created from emails
- Click opens full email modal (90vw wide, from/to/cc/date/subject/body)
- Fetches live from Gmail API

Email CSS Isolation:
- Email HTML rendered in sandboxed iframe (was dangerouslySetInnerHTML)
- Prevents email CSS (e.g. Amazon dark theme) from leaking into app sidebar/nav

IP List Page Redesign:
- Hero stat boxes (Total + 6 stages) — clickable to filter
- Owner filter: My Cases / All / Unassigned / per-admin
- Blinking pink dot on "New" IP cases
- Milestone progress bar on cards
- FertilizedEggIcon for frozen embryos
- Assigned admin shown on cards
- Removed: "Submitted" date, "View Case" hover
- StageBadge replaces StatusBadge

Journeys List Page Redesign:
- Hero stat boxes (Total + 3 journey stages) — clickable to filter
- Owner filter: My Journeys / All / Unassigned / per-admin
- Stage counts update based on owner filter
- Cards unchanged

Admin User Setup:
- Created Supabase auth user for desiree@abcsurrogacy.com
- Fixed role assignment via user_metadata (defaults to surrogate without it)

**Next steps:**
- Password reset feature
- User invite system (for manually added users)
- Email templates
- Merged Documents tab on journey
- Default owner filter for surrogates page (master/super → all, admin → mine)

**Open questions:**
- Password reset: use Supabase built-in magic link or custom reset flow?
- User invite: send email with temp password or magic link?
- Email templates: predefined templates or free-form with merge fields?

---

## 2026-04-04 (E-Sign Security, Signature Fix, Case Tasks, Case Calendar, Email Tags Planning)

**Worked on:** Secure e-signature URLs, typed signature fix, case tasks system, case calendar with Google Calendar API integration, calendar page link improvements

**Changes made:**

E-Signature Security:
- Added signing_token column (64-char hex, crypto.getRandomValues) to esign_documents
- New route /e-signature/sign/:token for secure signing URLs
- fetchDocumentByToken() in esign.js
- EditDocumentPage sends token-based URLs in emails
- Legacy /e-signature/:id route kept for backwards compatibility
- SQL migration: scripts/esign-token-migration.sql

Typed Signature Fix:
- mouseup handler was firing in typed mode, overwriting typed value with blank canvas
- Added modeRef to track current mode in event handler closure
- Switching modes now resets signature value properly
- Typed onChange explicitly sets image: null to clear stale drawn data

Case Tasks System:
- New Supabase table: case_tasks (id, case_id, case_type, title, description, status, priority, due_date, assigned_to, created_by, completed_at/by)
- CaseTasksWidget: add tasks, cycle status (open→in_progress→complete), expand for notes, delete, overdue highlighting, completed section
- DashboardTasksWidget: "My Tasks" on admin dashboard with cross-case view, searchable case picker for adding tasks
- DB helpers: fetchCaseTasks, fetchMyTasks, fetchAllOpenTasks, createCaseTask, updateCaseTask, deleteCaseTask
- Added to Overview tab on Surrogate, IP, and Journey detail pages (below milestones)

Case Calendar Widget:
- CaseCalendarWidget shows appointments for a specific case using Google Calendar API
- Events tagged with extendedProperties.private.caseId for per-case filtering
- listCaseEvents() in google.js uses privateExtendedProperty filter
- Events created from a case appear on full Google Calendar automatically
- Add Appointment dialog: title, date, time/all-day, notes
- Event title format: "Appointment — Client Name"
- Event description: client name + case URL (Google auto-links it)
- Calendar page (/calendar): URLs in event popup are now clickable internal links
- Case widget: shows title only (no redundant link since already on the case)
- Two-column layout: Calendar (left) + Tasks (right), below milestones

Other Fixes:
- Insurance modal widened to max-w-4xl on journey page
- Insurance page: Pay Status column (PAID/UNPAID) frozen with name column
- Removed hyperlinks from GC/IP names in journey hero (since cases redirect to journey)
- Email compose: openDraft made synchronous to prevent blank page crashes
- Error boundary around ComposeWindows
- Fixed SelectItem empty string value crash
- Fixed Supabase insert .catch() crash

**Next steps:**
- Email tagging system: add tag selector to "Log to Case" dialog
- Tags: Escrow, Expense, Medical Records, Monitoring, OB, Hospital, Legal, Matching, Task
- AI-powered expense extraction from tagged "Expense" emails
- AI-powered task creation from tagged "Task" emails
- Tag-based filtering on case/journey email log
- Supabase migration: add tag column to case_emails table
- Merged Documents tab on journey (fetch from GC + IP + Journey)
- Expense tracking page buildout

**Open questions:**
- Which AI model/API to use for email parsing (Claude API via Cloudflare function?)
- Should expense logs go in a new table or extend an existing one?
- Should AI-generated tasks/expenses require confirmation before saving? (User said yes)
- Email tag storage: single tag per email or multiple tags?

---

## 2026-04-03 (Match-Centric Architecture, Journey Hero Redesign, Insurance, Attorneys)

**Worked on:** Complete journey detail page redesign, match-centric case architecture, attorney info, insurance tab, draggable tabs, provider modals, email compose fixes, checklist history, break match improvements

**Changes made:**

Journey Hero — 3-Card Layout:
- Journey Info (white, 60% left) + GC (pink, stacked right) + IP (blue, stacked right)
- Journey card: Stage with Milestone icon + status pill, escrow section, providers section (3 clickable cards → modal editors), managers at bottom, match date + break match top-right
- GC/IP cards: avatar (md), name (text-base black), age/marital/address flips, Text/Email/Call buttons top-right, insurance badge, attorney row
- Provider modals: Fertility Clinic (name, doctor, address broken out, coordinator + email, website), OB Clinic (name, doctor, phone, address, website), Hospital (name, phone, address, website)
- Pregnancy info only shows for Active Pregnancy status and beyond
- Email/Text confirmation toasts positioned near the card that triggered them
- SMS dialog for texting from journey page (Twilio)

Attorney Info:
- Editable attorney fields for GC and IP in journey hero (Name, Firm, Email, Phone)
- Click attorney name to edit, "Email Attorney" button (subtle, colored on hover)
- Batched save to prevent race conditions
- Logged to journey case when composing email

Insurance Tab:
- Full insurance management: policy details, payment logging, cancel policy
- Supabase tables: surrogate_insurance + insurance_payments
- Insurance indicator on hero cards, click opens dialog on journey
- Insurance page (/insurance): Pay Status column (PAID green / UNPAID red) frozen with name column

Draggable Tabs:
- SortableTabsList shared component using @dnd-kit
- Overview locked first, all others draggable
- Order persists per-case in Supabase app_config
- Applied to Surrogate, IP, and Journey detail pages

Match-Centric Architecture:
- Matched cases redirect to journey (/surrogates/:id → /journeys/:journeyId)
- Matched GCs/IPs removed from list pages
- Journey gets Application tab (GC/IP sub-tabs with full GCApplicationTab/IPApplicationTab)
- Journey gets full editable Profile tab (GCProfileTab exported from SurrogateDetailPage, IPProfileTab)
- Checklist history: stage change snapshots current checklist, "Previous Checklists" collapsible section
- Enhanced breakMatch(): saves journey data snapshot, partner names, checklist history, notes, copies documents to both cases as "previous-match"
- PreviousMatchTab shared component on Surrogate/IP detail pages (only shows if _matchHistory exists)
- Hyperlinks removed from GC/IP names in journey hero

Email Compose Fixes:
- openDraft made synchronous (was async, caused blank page crashes)
- Signature fetched in background and appended when ready
- Error boundary around ComposeWindows prevents app-wide crashes
- Fixed SelectItem empty string value crash in case selector
- Fixed Supabase insert .catch() crash (not a promise)
- Both IP emails shown on separate lines in confirmation

Other:
- FertilizedEggIcon SVG for embryos, EmbryoIcon for IVF clinic
- InsuranceCardIcon SVG
- fmtDate/formatDate helpers for MM/DD/YYYY
- Committed other session's changes (CaseImportPage, xlsx dependency, utils.js formatDate)

**Next steps:**
- Build merged Documents tab on journey (fetch from GC + IP + Journey, label by source)
- Journey-specific tasks system
- Upcoming appointments widget for journey overview
- Expense tracking page
- Matching page redesign
- Checklist history on individual cases (surrogate/IP stage changes)

**Open questions:**
- Should journey documents be a separate Supabase storage bucket or reuse case-documents?
- Expense tracking scope — which roles can view/edit?
- How should journey tasks relate to the dashboard?

---

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

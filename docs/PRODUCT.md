# Product

## Overview

**What:** North Star Surrogacy (North Star Surrogacy) — full business management platform for a surrogacy agency
**For:** Agency owners, staff, surrogates, surrogate partners, and intended parents

## User Roles

| Role | Access | Key Screens |
|------|--------|-------------|
| Super Admin | Everything + system tools. Sees all cases by default. | All modules + System page |
| Master Admin | Everything except system. Sees all cases by default. Can mark emails private. | All modules |
| Office Admin | Same as Admin + Settings access (notes, team, statuses, checklists). Own cases by default. | All modules + Settings |
| Admin | Operations, clients, forms, messaging. Own assigned cases by default. | Dashboard, Client Mgmt, Forms, Communication |
| Surrogate | Own journey, forms, messages, docs | Surrogate Dashboard, Forms, Documents, Messages, My Journey |
| Surrogate Partner | Read-only view of surrogate's journey | Partner Dashboard, Documents, Messages |
| Intended Parent | Own journey, shared profiles, messages | IP Dashboard, Forms, Documents, Messages, My Journey |
| Marketing | Read-only analytics + intake submissions view | Marketing Dashboard, Intake Submissions |
| Records Admin | Medical records summary only | Records Summary page (split-screen doc viewer + summary form) |

## Journey Stages

Every surrogate moves through 6 stages, each with configurable statuses:

| Stage | Purpose | Default Statuses |
|-------|---------|-----------------|
| Pre-Qualification | Initial contact and screening calls | New, 1st/2nd/3rd Reach Out, Screening Call Scheduled/Complete, Pending Profile Completion, Profile Complete, Zoom Call Scheduled |
| Screening | Medical, psych, background verification | Documents Requested/Received, Medical/Psych Scheduled/Complete, Background In Progress/Complete |
| Matching | Finding and confirming IP-surrogate match | Awaiting Match, Profile Shared, Meeting Scheduled/Complete, Match Confirmed |
| Holding | Temporarily paused cases | Admin-configurable |
| Not Qualified | Cases that don't meet requirements | Admin-configurable (blocks portal access) |
| Withdrawn | Applicants who opted out | Admin-configurable (blocks portal access) |

Journey stages (under /journeys, not on surrogate list):
| Journey Oversight | Active surrogacy journey management | Legal Review, Medical Clearance, Transfer Prep, Pregnant, Monitoring |
| Journey Ending | Delivery and wrap-up | Delivery Scheduled, Delivered, Post-Partum, Final Payments, Wrap-Up |
| Journey Closed | Case complete or withdrawn | Closed — Complete, Closed — Withdrawn, Closed — Disqualified |

Admins can add/edit/delete statuses per stage via Settings. New surrogates default to Pre-Qualification / New.
Moving a case to Not Qualified or Withdrawn shows a confirmation dialog and blocks portal access.
"Active Cases" button on list pages excludes Holding, Not Qualified, and Withdrawn.

## Key Flows

### Intended Parent: Profile → Application Lifecycle

The IP journey now mirrors the surrogate one with three gated handoffs:

1. **Intake** (`/intendedparentapply`) — IP fills the qualifying quiz, lands in admin Intended Parents list. Already supports country + non-US province handling.
2. **Portal invite** — admin clicks "Invite to Portal" on `IPDetailPage`. `/api/ip-invite` creates the auth user and sends "Welcome to your secure portal" via Resend (NOT Gmail — independent of admin Google connection state).
3. **Build Matching Profile** — IP logs in, dashboard shows "My Profile" progress card. They fill out fertility / surrogacy / personal info / health / history sections with auto-save. Photos upload to portrait/cover/gallery. When 100% complete, they click "Submit Profile for Review" → required-fields warning if incomplete, otherwise confirmation modal warning that editing will be locked. Submit fires `/api/notify-ip-profile-submitted` (admins notified) and creates a high-priority `case_tasks` row for the assigned admin.
4. **Admin reviews profile** — on `IPDetailPage`, header shows "Profile Submitted" badge. Admin opens the Profile tab, can click "Reopen for Editing" to bounce it back (clears `_approved`, sets `_profileReleasedAt`; IP sees an amber "Profile reopened for edits" banner). Or admin clicks "Approve" — header now shows "Profile Approved" + the **"Release Application"** button.
5. **Release Application** — admin clicks the button (in-app modal confirms), which sets `_applicationAvailable: true` and emails IP1 + IP2 via `/api/notify-ip-app-released` ("We have approved your North Star Surrogacy Profile. You can now complete the remaining forms"). IP dashboard now shows a prominent "You can now complete the remaining Application" card with a "Complete Application →" button at the top.
6. **Fill Application** — IP visits `/my-application`. Three sections (Contact / Clinic / References) with auto-save (1.5s debounce). All fields prefilled from intake → profile chain (the IP never re-enters DOB, clinic name, RE doctor, embryo info, donor info, etc.). Country swaps State→Province text for non-US.
7. **Submit Application** — when all 3 sections complete, "Application is 100% complete. Submit application?" modal pops automatically. On submit: emails admins ("📋 Intended Parent {name} has submitted their Application") and creates a `case_tasks` row with `case_type: 'ip'` assigned to the case admin. Header badge flips to "Application Submitted".

All state lives in `intake_submissions.answers` JSON (no schema migrations needed): `_profileSubmitted/_profileReleasedAt`, `_ipProfile._approved/_approvedAt`, `_applicationAvailable/_applicationSubmitted`. Application sections stored as `_ipContact`, `_ipClinic`, `_references`.

### Surrogate Intake → Admin Assignment
1. Surrogate visits /surrogatequiz → completes 5-step quiz (bot-protected)
2. Qualified surrogates auto-appear in admin Surrogates list at stage "Pre-Qualification" / status "New"
3. Admin assigns surrogate to themselves or another admin
4. Surrogate appears under "My Cases" for assigned admin

### Surrogate: Build Matching Profile
1. Dashboard → "Get Started" / "Continue" → links to first incomplete section
2. 11 sections: Personal Information, Pregnancy History, Fertility Information, General Information, Health Information, Employment Information, Interests, Academic Information, Experienced Surrogate Information, Journey Hopes & Wishes, Photos
3. Profile photo (solo) + Cover photo (family) in Personal Information, gallery photos in Photos section (drag to reorder, crop/rotate)
4. Auto-saves to localStorage + Supabase (admins can track progress)
5. Preview button toggles inline preview (850px, letter-size PDF width) showing full profile as IPs will see it
6. Quiz answers (DOB, height, weight, city, state, marital status, US citizen) auto-fill into profile
7. Partner/spouse questions conditionally shown based on relationship status
8. Experienced Surrogate section hidden from preview when not applicable
9. Household members entered as structured table (name + relationship dropdown)
10. Per-journey cards for experienced surrogate details
11. Base compensation auto-formats as currency ($xx,xxx)
12. When approved by admin, profile locks — surrogate sees green "Approved" banner

### Admin: Manage Surrogate Cases
1. Surrogates list defaults to "My Cases" — shows only assigned surrogates
2. Hero stats count surrogates by stage (gradient colored)
3. "New" surrogates get animated pink ping dot
4. Click card → detail page with hero (interactive flip tiles) + tabs
5. Tabs: Overview, Contact, Profile, Screening, Documents, Notes

### Admin: Change Stage & Status
1. Click Stage tile on hero → dropdown with 6 stages (numbered, colored)
2. Changing stage auto-sets status to the first default for that stage
3. Click Status tile → dropdown with statuses for current stage
4. Stage/status shown on list cards as StageBadge
5. Stage change snapshots current checklist into history (viewable as "Previous Checklists")

### Match-Centric Case Architecture
1. When a GC and IP are matched into a journey, individual case pages redirect to the journey
2. Matched GCs/IPs are removed from their respective list pages
3. All case management (Application, Profile, Documents, Notes, Emails) happens on the journey page
4. Application tab has GC/IP sub-tabs rendering full GCApplicationTab and IPApplicationTab
5. Profile tab has GC/IP sub-tabs with full editable profile builders
6. When a match is broken: journey data snapshot saved to both cases, documents copied as "Previous Match", both cases get a "Previous Match" tab showing history

### Profile Sharing & Questions
1. Admin shares a surrogate profile from the Matching page → generates 72-hour secure link
2. Email sent to IP with gradient "View {FirstName}'s Profile" button, HIPAA warning
3. IP views profile at /share/{token}, can ask questions (name, email, question form)
4. Question submission triggers:
   - Auto-email to sharing admin (💬 subject, table layout, HIPAA warning)
   - Case note logged on surrogate's case
   - Case note logged on IP's case (found by shared_to_email)
   - Question appears in Match History on Matching page
5. Admin can click "Pending — click to mark answered" to toggle question status

### Therapist Check-Ins
1. Therapist Jenny Oliver-Miramontes accesses /therapist-tracking (or shared external link with password)
2. For each milestone (10w, 20w, 30w, Birth Guidelines, Post Delivery) clicks "Check In"
3. Report Builder dialog opens (95vw wide):
   - Pre-filled therapist info (Jenny + LMFT + license)
   - Date/time auto-set to Pacific Time
   - Method dropdown (Phone/Video/In Person/Email)
   - Auto-filled Requested By: Case Manager (from journey assigned admin) + Company "North Star Surrogacy"
   - Rich text Communication Details
   - Pre-filled signature
4. "Save Draft" — saves for later (resumable). "Submit Report" — opens "Are you sure?" confirmation
5. On confirm:
   - Real PDF generated via html2pdf.js
   - PDF uploaded to surrogate's "Psych Evaluation" document folder
   - Auto-task created on matched journey (or surrogate case if not matched): "{GC Name} {Event} Complete - Needs Review"
   - Milestone date marked as today
   - PDF opens in new window for therapist to download
6. Completed reports viewable in read-only mode with Download PDF button (even after journey archived)

### Team Internal Messaging
1. Each admin sets their personal Twilio phone number in Settings
2. Team Chats page (under INBOX nav) lets admins create group chats with team members (max 10)
3. Sending a message from the app inserts to Supabase + sends Twilio SMS to all other group members
4. Admins can also use Toktiv app on their iPhone to send/receive Twilio texts and calls
5. Texts to surrogates/IPs from the app: "Send as" dropdown lets admin pick which Twilio number to use
6. Case Texts tab merges threads from ALL admin numbers with sender attribution

### Case Tasks
1. Tasks can be created on any case (Surrogate, IP, Journey) from the Overview tab
2. Tasks can also be created from the admin Dashboard with a searchable case picker
3. Each task has: title, notes, priority (low/normal/high/urgent), due date, assigned to
4. Status cycles: Open → In Progress → Complete
5. Overdue tasks highlighted in red with warning icon
6. Dashboard shows "My Tasks" — open tasks across all cases assigned to the logged-in admin

### Case Calendar (Google Calendar Integration)
1. Each case/journey has an Appointments widget on the Overview tab
2. Adding an appointment creates a Google Calendar event tagged with the case ID
3. Events tagged via extendedProperties.private.caseId — only case-specific events show
4. Events also appear on the admin's full Google Calendar (/calendar page)
5. Event title includes client name; description includes clickable case link
6. Calendar page event popup auto-links case URLs for navigation

### Email Tagging & AI Extraction
1. When logging an email to a case, admin can optionally tag it (Escrow, Expense, Medical Records, etc.)
2. Tags appear as colored badges on the case email log, filterable
3. "Expense" tag: AI reads full email, extracts amount/vendor/date → editable confirmation → saves expense
4. "Task" tag: AI reads email, extracts action item → editable confirmation → saves task assigned to current user
5. Sent emails from compose can also be tagged when logging to a case
6. AI uses Claude Haiku via Cloudflare Pages Function (/api/ai/extract)

### User Invites & Portal Access
1. Admins can invite surrogates and IPs to the portal from their case detail page
2. "Invite to Portal" creates Supabase auth account + sends branded email with password set link
3. After user sets password, invite button replaced with "Portal Active" + last login date
4. Adding admin staff from Settings → Team Management auto-sends invite
5. Admin users loaded dynamically from Supabase Auth (no hardcoded list)
6. Only admin/master_admin roles shown in assignment dropdowns

### Email Templates
1. Auto-welcome email sent to qualified surrogates on quiz completion (via Resend API)
2. Welcome email includes: ABC branding, next steps, portal setup button
3. Portal account auto-created with password reset link
4. "Send Template" button on case Emails tab for manual template sending
5. Templates: GC Welcome, GC Screening, GC Profile Reminder, IP Welcome, Match Intro
6. Merge fields: {{first_name}}, {{full_name}}, {{case_manager}}
7. Preview with merged fields before sending via compose

### E-Signature Template Preservation
1. Editing a template creates a copy in "ABC Drafts" folder (original untouched)
2. All edits happen on the draft copy
3. Draft auto-deleted after successful send
4. ABC Drafts folder separate from ABC Templates (not shown in template list)

### E-Signature Security
1. Each document gets a unique 64-char hex signing_token on creation
2. Signing URLs use /e-signature/sign/:token (unguessable, no sequential IDs)
3. Email to signers uses token-based URL
4. Legacy /e-signature/:id route kept for backwards compatibility
5. Email verification still required on top of token

### Admin: Manage Documents
1. Documents tab shows 9 category folders (Photo IDs, Agency Agreement, etc.)
2. Upload files directly to a category
3. Preview images/PDFs in full-screen overlay
4. Rename files, move between categories
5. Search filters by file name or category
6. Grid/list view toggle
7. Drag to reorder category cards

### Admin: Case Notes
1. Notes tab with rich text editor (bold, italic, colors, highlights, lists)
2. Create, edit inline, delete with permanent confirmation
3. Notes show author, timestamp, (edited) indicator
4. Stored in Supabase case_notes table

### Super Admin: Case Import
1. Navigate to /case-import (Super Admin only, under Admin nav section)
2. Select case type: Surrogate or Intended Parent
3. Fill in basic info (name, email, phone, state, DOB, application date)
4. For IPs: optionally add IP2 partner (first name, last name, email, phone)
5. Upload files: Profile PDF, Application PDFs, Documents ZIP (auto-extracted), Notes Excel (parsed), Photos
6. Click Import Case → creates case record in Supabase with application date as submitted_at
7. Scroll down to "Create Matched Journey" section
8. Search and select a Surrogate + IP from existing cases
9. Set original match date + current journey stage
10. Optionally import match sheet data via Excel or fill manually (29 fields)
11. Click Create Matched Journey → links cases, saves match date + stage + match sheet data

### Admin: Insurance Management
1. /insurance page shows all surrogates with insurance records as spreadsheet rows
2. Inline-editable cells for all fields (carrier, premium, dates, login/password, OB, hospital, etc.)
3. Per-row password visibility toggle
4. Status/year tabs: Active Policies + status × year combinations
5. Search across all tabs, admin filter by case manager
6. Case-level insurance on surrogate/journey detail pages via InsuranceTab

### Admin: Expense Tracking
1. /expenses page with Expenses and Reconciled tabs
2. Columns: Case (IP+GC + manager), Date, Amount, Paid To, CC Last 4, Escrow Y/N, Notes, Doc, Reconcile
3. Currency input: payment terminal style (digits shift left, always .00)
4. Reconcile confirmation modal shows case name, amount, payee
5. "+ Create Task" from reconcile modal (assigned to case manager, due today, high priority)
6. Task creation tracked on expense (amber warning on re-reconcile)
7. Attachment upload + eyeball preview
8. Journey Expenses tab: inline editable, add/delete, paperclip upload for missing docs
9. "+ Add Expense" on journey Escrow section

### Admin: Dashboard
1. Motivational quote of the day
2. Collapsible Upcoming Appointments (Google Calendar) + My Tasks columns
3. My Cases: only assigned cases, identical cards from list pages
4. Calculator widget, per-user sticky notes (saved in Supabase)
5. Personal tasks: + Add Task (title, due date, priority, notes), saved with case_type='personal'
6. Tasks show "Personal" or "Case" badge

### Session & Security
1. Root URL (/) routes to login page
2. Auto-logout on inactivity: admins 6 hours, users 1 hour
3. Activity tracked: mouse, keyboard, scroll, touch
4. Idle redirect to /login with "signed out due to inactivity" message

### Pregnancy Tracker (Journey Hero)
1. Timeline: Embryo Transfer → Beta HCG → (Beta #2 optional) → Heartbeat → Pregnant!
2. Log Embryo Transfer: date, embryo count, notes
3. Beta Results: value (number) + forced Yes/No for second beta
4. Beta #2: additional timeline step when second beta needed
5. Heartbeat Confirmation: date, number of babies, optional due date override
6. Due date auto-calculated: 5-day embryo, transfer + 261 days (Ferring wheel)
7. Confetti celebration on heartbeat confirmation (ABC brand colors)
8. Journey card gets pink border + 🤰 emoji when pregnant
9. Gestational age calculated and displayed
10. Record Pregnancy Loss: miscarriage, ectopic, chemical, other — clears status, logs on transfer
11. Mark Unsuccessful / Dropped Cycle options
12. Transfer tabs: newest first, old transfers collapsed
13. Edit/delete transfers with full field access
14. Status auto-updates to "Pregnant" on heartbeat confirmation

### Admin: Case Updates
1. /case-updates page under Client Management
2. Surrogate Screening Overview with stage filter pills
3. Checklist spreadsheet showing status per surrogate

### Admin: Contact & Intake Details
1. Contact tab merges quiz answers + contact info in one editable view
2. All fields use proper form controls matching quiz (dropdowns, toggles)
3. BE Referral toggle at bottom

### GTPAL Pregnancy Display
- Calculated from pregnancy history profile data
- Format: G6P5015 = 6 pregnancies, 5 term, 0 preterm, 1 loss, 5 living
- Shown on list cards and detail hero with colored chips

## Pages

| Page | Path | Roles | Status |
|------|------|-------|--------|
| Landing Page | / | public | Built (ComingSoonPage) |
| Login | /login | public | Built |
| Admin Dashboard | /dashboard | admin+ | Built (live Supabase counts) |
| Surrogate Dashboard | /dashboard | surrogate | Built (tasks, profile, quiz) |
| IP Dashboard | /dashboard | intended_parent | Built |
| Partner Dashboard | /dashboard | surrogate_partner | Built |
| Surrogates List | /surrogates | admin+ | Built (stages, statuses, search, grid/list) |
| Surrogate Detail | /surrogates/:id | admin+ | Built (interactive hero, application tab, documents, notes, photos) |
| Intended Parents List | /intended-parents | admin+ | Built (live Supabase, tile/list, search, filters) |
| IP Detail | /intended-parents/:id | admin+ | Built (hero with stage/status, application tab, profile, emails) |
| My Profile | /my-profile | surrogate | Built (Supabase sync, photo upload) |
| Forms List | /forms | all | Built |
| Surrogate Quiz | /surrogatequiz | public | Built (bot protected) |
| IP Intake | /intendedparentapply | public | Built (bot protected) |
| Intake Confirmation | /apply/confirmation | public | Built |
| Intake Submissions | /intake | admin+ | Built (live Supabase) |
| Marketing Dashboard | /marketing | marketing+ | Built |
| Matching | /matching | admin+ | Built (Kanban pipeline) |
| Matched Journeys | /journeys | admin+ | Built (dashboard, tile/list, stage filters) |
| Calendar | /calendar | admin+ | Built (Google Calendar API, multi-calendar, create/edit/delete) |
| Time Clock | /time-clock | admin+ | Built |
| Text Messages | /text-messages | admin+ | Built (Twilio SMS, read/unread, case matching) |
| Babies Born | /babies-born | admin+ | Built (yearly births, line chart, editable) |
| Settings | /settings | master_admin+ | Built (notes, team mgmt, statuses, checklists, Google connect) |
| CRM / Cases | /crm | admin+ | Stub |
| Documents | /documents | all | Stub (case-level docs built) |
| E-Signature | /e-signature | admin+ | Built (Google Docs templates, send with required role validation, public signing page, typed/drawn signatures, signed PDF via Google Docs API with handwriting fonts + inline signature images, compact audit trail, auto-file to case documents, "Send for Signature" from case/journey Documents tabs, admin dropdown, journey auto-populate all parties) |
| E-Sign Edit | /e-signature/edit/:templateId | admin+ | Built (Google Docs iframe editor, PDF export, send for signature) |
| E-Sign Sign | /e-signature/:id | public | Built (public route, email verification, field inputs, signature pad, PDF preview) |
| Messages | /messages | all | Stub |
| Email | /email | admin+ | Built (Gmail API, inbox/send/attachments, log to case) |
| Team Chats | /team-chats | admin+ | Built (group messaging via Twilio SMS, iMessage-style UI, max 10 members) |
| Therapist Tracking | /therapist-tracking | admin+ | Built (10/20/30 week + Birth Guidelines + Post Delivery check-ins, full Check-In Report Builder with PDF generation + auto-task) |
| Fax | /fax | admin+ | Built (SRFax API live, hero stats, table layout, send from case docs, fullscreen PDF preview with nav, file to Medical Records with rename + log update + auto-advance, filed case tracking, sidebar unread badge) |
| Psych Tracking | /psych-tracking | admin+ | Built (10/20/30 week + post-delivery check-ins, shareable external link) |
| Referral & Bonus Tracker | /referral-bonus-tracker | admin+ | Built (referrals from quiz, sign-on bonuses, clearance dates, payment tracking) |
| HR Management | /hr | master_admin+ | Stub |
| Payroll | /payroll | master_admin+ | Stub |

## Terminology

| Term | Meaning |
|------|---------|
| GC / Surrogate | Gestational carrier — woman carrying pregnancy for intended parents |
| IP | Intended parent(s) — person(s) seeking surrogacy |
| Match | Pairing of a surrogate with intended parent(s) |
| Journey | The full surrogacy process from application to delivery |
| Stage | One of 6 phases a surrogate moves through (Pre-Qualification → Journey Closed) |
| Status | Sub-state within a stage (e.g., "1st Reach Out" within Pre-Qualification) |
| GTPAL | Pregnancy notation: G=gravida(total), T=term births, P=preterm, A=abortions/losses, L=living |
| Be Surrogacy | Referral partner — surrogates referred through Be Surrogacy marked with (BE) badge |
| Case Assignment | Each surrogate is assigned to a specific admin who manages their journey |
| Profile Approval | Admin approves a surrogate's matching profile, locking it from further edits |
| Screening | 4-step verification: Medical, Psychological, Background Check, Home Study |
| Transfer | Embryo transfer procedure |
| Clearance | Medical or psychological clearance to proceed |
| Task | Action item on a profile — workflow-generated, staff-assigned, or self-created |
| Admin Note | Announcement published by master_admin, displayed as dashboard alert banners |
| Case Note | Per-surrogate note with rich text, stored in Supabase |
| UTM Parameters | URL tracking for marketing attribution |
| GTM | Google Tag Manager — marketing team manages pixels here |
| Turnstile | Cloudflare's bot protection CAPTCHA on intake forms |
| Application | Combined tab containing intake quiz/answers + multi-section forms (address, references, confidential info, clinic, social media release) |
| E-Signature | Full e-signature system: Google Docs templates in Drive, edit in-app via iframe, send for signature with role-based validation, public signing page with inline form fields, typed signatures in handwriting font, drawn signature images in PDF, compact audit trail certificate, auto-file signed PDF to case documents. Accessible from E-Signature page and case/journey Documents tabs. Admin signer dropdown, journey auto-populate (GC + Partner + IP1 + IP2). spouseEmail field in GC application. |
| IP Stage Labels | IPs have 4 stages only: Consultation (pre-qualification), Matching, Holding (portal active), Withdrawn (portal revoked). Matched Journey hidden. |
| Info Rows | Provider reference rows in case-updates journey checklist: IVF Clinic, Monitoring Clinic, IP Attorney, GC Attorney, OB Clinic, Delivery Hospital. Configurable position in Settings. Read-only, data from journey hero. |
| Screening Incentive | Payment to surrogates for completing screening. Tracked on Referrals & Incentives page. Venmo/Zelle preference collected on application. |
| Escrow | Financial account managed by escrow company (default SeedTrust). Expenses flow: if escrow opened → Paid To + CC Last 4; if not opened → agency pays directly via Venmo/Zelle. |
| Expenses to Pay | Non-escrow expenses requiring direct agency payment. Auto-creates task for Julie Allgood. Tracked on Expense Tracker "Expenses to Pay" tab. |
| Profile Follow Up Questions | Additional screening questions (35 fields) shown to surrogates after Personal Information in their application. Covers lifestyle, health, fertility, education, employment. |
| Psych Check-In Sheet | Password-protected shared page for external psych provider. HIPAA compliant — SHA-256 hashed password, no portal login required. |
| Experienced Surrogate | Quiz question (Yes/No) added to step 4. Pre-fills profile's experiencedSurrogate.previousSurrogate. Hides "Was this a surrogacy pregnancy?" in pregnancy history if "No". |
| Joint Task Assignment | "Julie & Nicole" combo option in task dropdowns — stores comma-separated emails so both see the task on their dashboards. Either can complete it. |
| Future Tasks | Tasks due more than 7 days out collapse into a "Future Tasks (N)" dropdown to keep the active list focused on the next week. |
| Agency Payments | 3rd Agency Payment auto-task fires when Medical Clearance is logged complete on a journey. 4th Agency Payment auto-task fires when heartbeat confirmed. Both joint to Julie & Nicole. |
| Reopen for Editing | Admin action on the Profile tab (`IPProfileTab` / surrogate equivalent) that bounces a submitted profile back to the user. Clears `_approved` + sets `_profileReleasedAt` so the profile unlocks for edits without losing data. No email fires. |
| Release Application | Admin action on `IPDetailPage` header (only after profile is approved). Sets `_applicationAvailable: true` and emails IP1 + IP2 with the "complete the remaining forms" template via Resend. Distinct from "Reopen for Editing" (which is about the profile). |
| IP Application | Three-section portal form on `/my-application` for IPs (separate from the matching profile): Contact Information, Clinic Information, Personal References. Auto-saves. Branches from `PortalApplicationPage` based on `intake_submissions.intake_type === 'ip'`. Surrogates see a different 6-section variant on the same page. |
| Prefill chain (IP) | Whenever the IP fills out the application, fields are prefilled from existing answer → matching profile → intake quiz, in that priority. The IP should never have to answer the same question twice across the journey. |
| 20-Week Check-In | Auto-task created on heartbeat confirmation. Calculated as 121 days post-transfer (5-day embryo: 2w5d at transfer + 17w2d = 20w0d). Joint task: Julie & Nicole. |
| Reference Check Auto-Task | When Reference Check on Screening Checklist is logged "Requested", auto-creates "Complete Reference Checks for {GC}" assigned to intake@northstarsurrogacy.com, due same day. |
| Mark Journey Complete | Admin action on JourneyDetailPage actions menu — gated on the "Escrow Closed" checklist step being marked complete. On confirm: sets journey status to `"Closed — Complete"`, stamps `journey_data._completedAt` + `_completedBy`, runs `archiveJourney()` to release participants and log match history. Bundles the existing archive flow with a completion stamp so we can distinguish "completed end-to-end" from a plain mid-journey archive. |
| Completed Journey | A matched journey where `journey_data._completedAt` is set (via Mark Complete). Both parties (GC + IP) are hidden from default `/surrogates` and `/intended-parents` lists, but searchable by name with a green "Completed Journey" badge. Source of truth: `fetchCompletedJourneys()` in `src/lib/matching.js`. |
| Sibling Journey | A new IP intake row spawned from a completed journey's IP, prefilled with the original answers — used when intended parents come back for a sibling. Triggered by the "Start Sibling Journey for <IP>" button on JourneyDetailPage (IP card section, visible only after Mark Complete) or on IPDetailPage hero. Wraps `startNewCaseFromJourney({ fromCaseId: ip_case_id })` which copies `intake_type` so it works for either side. The original journey stays archived as previous-match history; the new IP intake lands in matching as a fresh case. |
| Escrow Closed | Locked default checklist step in GC `journey-oversight` stage. Gates Mark Journey Complete — admin can't close out a journey until escrow has been closed after delivery. `isJourneyEscrowClosed(journey)` matches all steps with the label (case-insensitive) so duplicate-label situations work (e.g., a custom step renamed to "Escrow Closed" after the locked default was seeded). |
| Master Admin default = All Cases | Both `/surrogates` and `/intended-parents` list pages default Master Admins (and Super Admins) to the "All Cases" view. Other admins default to "My Cases". Old behavior was Super Admins only + a hardcoded email allowlist (`julie@northstarsurrogacy.com`, `nicole@northstarsurrogacy.com`); the allowlist is kept as a fallback for non-master admins who need the wider view. |
| Background section (IP Application) | New section under Contact Information on the IP application portal — collects "Have you ever been arrested or convicted of a crime?" Y/N + describe textarea (and the same for spouse/partner if `hasPartner`). Replaces equivalent questions previously on the IP intake form. Old intake values prefill. Required for section completion. Mirrored in admin `IPApplicationTab.jsx`. |
| Venmo Last 4 of Phone | When GC selects "Venmo" as Payment Preference on her Application, a "Last 4 Digits of Phone Number on the Venmo Account" field appears. Required (4 numeric digits). Used by the agency to confirm the right Venmo account before sending money. |

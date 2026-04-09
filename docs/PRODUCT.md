# Product

## Overview

**What:** ABC Surrogacy (Abundant Beginnings Company) — full business management platform for a surrogacy agency
**For:** Agency owners, staff, surrogates, surrogate partners, and intended parents

## User Roles

| Role | Access | Key Screens |
|------|--------|-------------|
| Super Admin | Everything + system tools | All modules + System page |
| Master Admin | Everything except system | All modules |
| Admin | Operations, clients, forms, messaging. Can only see own assigned cases by default. | Dashboard, Client Mgmt, Forms, Communication |
| Surrogate | Own journey, forms, messages, docs | Surrogate Dashboard, Forms, Documents, Messages, My Journey |
| Surrogate Partner | Read-only view of surrogate's journey | Partner Dashboard, Documents, Messages |
| Intended Parent | Own journey, shared profiles, messages | IP Dashboard, Forms, Documents, Messages, My Journey |
| Marketing | Read-only analytics + intake submissions view | Marketing Dashboard, Intake Submissions |

## Journey Stages

Every surrogate moves through 6 stages, each with configurable statuses:

| Stage | Purpose | Default Statuses |
|-------|---------|-----------------|
| Pre-Qualification | Initial contact and screening calls | New, 1st/2nd/3rd Reach Out, Screening Call Scheduled/Complete, Pending Profile Completion, Profile Complete, Zoom Call Scheduled |
| Screening | Medical, psych, background verification | Documents Requested/Received, Medical/Psych Scheduled/Complete, Background In Progress/Complete |
| Matching | Finding and confirming IP-surrogate match | Awaiting Match, Profile Shared, Meeting Scheduled/Complete, Match Confirmed |
| Journey Oversight | Active surrogacy journey management | Legal Review, Medical Clearance, Transfer Prep, Active Pregnancy, Monitoring |
| Journey Ending | Delivery and wrap-up | Delivery Scheduled, Delivered, Post-Partum, Final Payments, Wrap-Up |
| Journey Closed | Case complete or withdrawn | Closed — Complete, Closed — Withdrawn, Closed — Disqualified |

Admins can add/edit/delete statuses per stage via the Status Settings dialog. New surrogates default to Pre-Qualification / New.

## Key Flows

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
| Fax | /fax | admin+ | Built (SRFax API live, hero stats, table layout, send from case docs, fullscreen PDF preview with nav, file to Medical Records with rename + log update + auto-advance, filed case tracking, sidebar unread badge) |
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
| IP Stage Labels | IP stages use different names: Pre-Qualification→Screening, Screening→Holding, Matching stays same |

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
| Fax | /fax | admin+ | Built (SRFax API, send/inbox/outbox, awaiting credentials) |
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

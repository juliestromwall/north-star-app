# Product

## Overview

**What:** ABC Surrogacy (Abundant Beginnings Company) — full business management platform for a surrogacy agency
**For:** Agency owners, staff, surrogates, surrogate partners, and intended parents

## User Roles

| Role | Access | Key Screens |
|------|--------|-------------|
| Super Admin | Everything + system tools | All modules + System page |
| Master Admin | Everything except system | All modules |
| Admin | Operations, clients, forms, messaging | Dashboard, Client Mgmt, Forms, Communication |
| Surrogate | Own journey, forms, messages, docs | Surrogate Dashboard, Forms, Documents, Messages, My Journey |
| Surrogate Partner | Read-only view of surrogate's journey | Partner Dashboard, Documents, Messages, My Match |
| Intended Parent | Own journey, shared profiles, messages | IP Dashboard, Forms, Documents, Messages, My Journey |
| Marketing | Read-only analytics + intake submissions view | Marketing Dashboard, Intake Submissions |

## Key Flows

### Admin: Review Surrogate Application
1. Dashboard → Forms → Surrogate Application responses
2. View submission detail
3. Update status (Submitted → In Review → Approved/Rejected)

### Admin: Monitor Match Pipeline
1. Dashboard shows pipeline bar chart by stage
2. Click Match Queue for detailed management (stub)

### Surrogate: Complete Application
1. Dashboard → Forms → Surrogate Application → Fill Out
2. Multi-section form with progress bar
3. Save Draft or Submit

### Admin: Browse Surrogate Profiles
1. Sidebar → Surrogates → card grid with search + filters
2. Filter by status (Active/Screening/Pending) or match stage
3. Click card → full profile with Dashboard, Overview, Medical, Documents, Timeline, Notes tabs
4. Dashboard tab (default) shows stat cards, tasks, recent notes, journey progress
5. Cross-link to matched IP from detail hero

### Admin: Browse Intended Parent Profiles
1. Sidebar → Intended Parents → card grid with search + filters
2. Filter by status or family type (Same-sex/Heterosexual/Single parent)
3. Click card → full profile with Dashboard, Overview, Documents, Timeline, Notes tabs
4. Dashboard tab (default) shows stat cards, tasks, recent notes, journey progress
5. Cross-link to matched surrogate from detail hero

### Admin: Manage Profile Tasks
1. Surrogate or IP detail page → Dashboard tab
2. View open/completed task counts and current match stage
3. Check/uncheck tasks — stats update, completed tasks move to bottom with strikethrough
4. Click "+ Add Task" → fill title, category, source (staff/self), optional due date → submit
5. Tasks show category badge, source icon (workflow/staff/self), and due date
6. Unmatched profiles show "Not yet matched" empty state for journey progress

### Admin: Share Matching Profile
1. Surrogate or IP detail page → click "Share Profile" button
2. Opens standalone branded page in new tab (no admin chrome)
3. Privacy-safe: first name + last initial only, no contact info
4. Copy Link button copies URL to clipboard
5. Download PDF triggers browser print dialog

### Admin: Manage Match Pipeline
1. Sidebar → Matching → Kanban board with 10 stage columns
2. View stats: total matches, unmatched surrogates, unmatched IPs
3. Click match card → detail dialog with stage progress bar
4. Side-by-side surrogate + IP profiles with "View Full Profile" links
5. Advance Stage / Move Back buttons to move match through pipeline
6. Click "+ New Match" → select unmatched surrogate + IP → Create Match
7. New match appears in Profile Review column, stats update

### Form Builder: Create Custom Form
1. Forms → New Form
2. Add sections, add fields (10 types)
3. Configure labels, types, required, options
4. Reorder fields with up/down buttons
5. Preview mode toggle
6. Save Draft / Publish

### Surrogate: Build Matching Profile
1. Sidebar → My Profile → collapsible section cards
2. 9 sections: About Me, Family & Household, Pregnancy History, Fertility & Medical, Health & Wellness, Lifestyle, Employment & Finances, Surrogacy Preferences, Photos
3. Progress ring and bar show overall completion percentage
4. Each section header shows filled/total fields and checkmark when complete
5. Click section to expand, fill fields — data auto-saves to localStorage
6. Repeatable pregnancy cards with add/remove in Pregnancy History section

### Public: Apply as a Surrogate (GC Intake)
1. Visit /apply → click "Apply to be a Surrogate"
2. 5-step form: About You → Health & Lifestyle → Pregnancy History → Surrogacy Readiness → Final Details
3. DQ check at submission — disqualified applicants see compassionate messaging; qualified proceed
4. Confirmation page shows next steps (qualified) or compassionate denial (DQ)

### Public: Apply as an Intended Parent (IP Intake)
1. Visit /apply → click "Apply to be an Intended Parent"
2. 5-step form: About You → Your Journey → Preferences → Financial Readiness → Final Details
3. DQ check at submission — no confirmed financing plan triggers disqualification
4. Confirmation page shows next steps (qualified) or compassionate denial (DQ)

### Admin: Review Intake Submissions
1. Sidebar → Applications → filter by type (GC/IP), status, or source
2. Click row → detail dialog with all answers, DQ reasons highlighted
3. Action buttons: Approve / Reject / Mark Pending

### Marketing: View Analytics
1. Sidebar → Analytics → Marketing Dashboard
2. Toggle 30 / 60 / 90 / All time windows
3. View conversion funnel: total submissions, qualified, DQ, conversion rate
4. Source performance bar chart (Instagram, TikTok, Facebook, Google, Direct, Referral)
5. GC vs IP split, DQ reasons breakdown, recent submissions table (privacy-safe)

## Pages

| Page | Path | Roles | Status |
|------|------|-------|--------|
| Admin Dashboard | / | super_admin, master_admin, admin | Built |
| Surrogate Dashboard | / | surrogate | Built |
| IP Dashboard | / | intended_parent | Built |
| Partner Dashboard | / | surrogate_partner | Built |
| Forms List | /forms | all | Built |
| Form Builder | /forms/builder | admin+ | Built |
| Form Submission | /forms/:id/submit | all | Built |
| Form Responses | /forms/:id/responses | admin+ | Built |
| Surrogates List | /surrogates | admin+ | Built |
| Surrogate Detail | /surrogates/:id | admin+ | Built |
| Intended Parents List | /intended-parents | admin+ | Built |
| IP Detail | /intended-parents/:id | admin+ | Built |
| Surrogate Share | /surrogates/:id/share | public (link) | Built |
| IP Share | /intended-parents/:id/share | public (link) | Built |
| Matching | /matching | admin+ | Built |
| CRM / Cases | /crm | admin+ | Stub |
| Documents | /documents | all | Stub |
| E-Signature | /e-signature | admin+ | Stub |
| Messages | /messages | all | Stub |
| Email | /email | admin+ | Stub |
| Calendar | /calendar | admin+ | Built |
| HR Management | /hr | master_admin+ | Stub |
| Time Clock | /time-clock | admin+ | Built |
| Payroll | /payroll | master_admin+ | Stub |
| Financials | /financials | master_admin+ | Stub |
| Reports | /reports | master_admin+ | Stub |
| Settings | /settings | master_admin+ | Built |
| System | /system | super_admin | Stub |
| My Profile | /my-profile | surrogate | Built |
| My Match | /my-match | surrogate, partner, ip | Stub |
| Appointments | /appointments | surrogate, partner, ip | Stub |
| Apply Landing | /apply | public | Built |
| Surrogate Intake Form | /apply/surrogate | public | Built |
| IP Intake Form | /apply/intended-parent | public | Built |
| Intake Confirmation | /apply/confirmation | public | Built |
| Intake Submissions | /intake | admin+ | Built |
| Marketing Dashboard | /marketing | marketing, master_admin, super_admin | Built |

## Terminology

| Term | Meaning |
|------|---------|
| GC / Surrogate | Gestational carrier — woman carrying pregnancy for intended parents |
| IP | Intended parent(s) — person(s) seeking surrogacy |
| Match | Pairing of a surrogate with intended parent(s) |
| Journey | The full surrogacy process from application to delivery |
| Transfer | Embryo transfer procedure |
| Clearance | Medical or psychological clearance to proceed |
| Escrow | Trust account holding funds for surrogate compensation |
| Task | Action item on a profile — can be workflow-generated (from match stages), staff-assigned, or self-created |
| Task Category | Classification of a task: Medical, Legal, Admin, Financial, or Personal |
| Task Source | Origin of a task: workflow (auto-generated per match stage), staff (assigned by agency staff), self (created by user) |
| Admin Note | An announcement published by master_admin targeting all admins or specific admin users. Displayed as alert banners on the Dashboard. Dismissals persist in Supabase. Can be toggled active/inactive or deleted from Settings. |
| UTM Parameters | URL query parameters (utm_source, utm_medium, utm_campaign, etc.) used to track marketing campaign attribution |
| fbclid | Facebook/Instagram click ID — automatically appended to URLs from Facebook and Instagram ads |
| ttclid | TikTok click ID — automatically appended to URLs from TikTok ads |
| Intake Form | Public-facing multi-step application form for GC or IP applicants |
| DQ / Disqualification | Automatic rejection triggered when applicant responses fail eligibility criteria |
| Conversion Rate | Percentage of total intake submissions that result in a qualified (non-DQ) outcome |
| Source | Marketing channel or campaign that drove an applicant to the intake form |

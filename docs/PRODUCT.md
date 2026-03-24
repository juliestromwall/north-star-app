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

## Key Flows

### Surrogate Intake → Admin Assignment
1. Surrogate visits /surrogatequiz → completes 5-step quiz
2. Qualified surrogates auto-appear in admin Surrogates list
3. Admin assigns surrogate to themselves or another admin
4. Surrogate appears under "My Cases" for assigned admin

### Surrogate: Build Matching Profile
1. Dashboard → "Get Started" / "Continue" → links to first incomplete section
2. 9 sections: About Me, Family, Pregnancy History, Fertility, Health, Lifestyle, Employment, Preferences, Photos
3. Cover photo in About Me, gallery photos in Photos section (drag to reorder, crop/rotate)
4. Auto-saves to localStorage + Supabase (admins can track progress)
5. Preview button shows how IPs will see the profile
6. When approved by admin, profile locks — surrogate sees green "Approved" banner

### Admin: Manage Surrogate Cases
1. Surrogates list defaults to "My Cases" — shows only assigned surrogates
2. Master/Super admins can view "All Cases", filter by specific admin, or see "Unassigned"
3. Each card shows: name, location, status, age, submitted date, assignment dropdown, gravida/para, BE badge
4. Click card → detail page with tabs: Overview, Profile, Quiz Answers, Screening, Photos, Notes

### Admin: Edit Surrogate Contact Info
1. Surrogate detail → Overview tab → click "Edit" on Contact Information card
2. Fields unlock to editable inputs (email, phone, location, marital status, preferred contact)
3. Be Surrogacy referral toggle at bottom
4. "Save" persists to Supabase, "Cancel" reverts

### Admin: Review & Approve Profile
1. Surrogate detail → Profile tab
2. View completion percentage + per-section progress grid (click tile to scroll to section)
3. Each section has "Edit" button → dialog with all fields for that section
4. "Preview" shows matching profile as IPs would see it
5. "Approve" locks profile for surrogate, "Unapprove" unlocks

### Admin: Add Surrogate Manually
1. Surrogates list → "+ Add Surrogate"
2. Enter name, email, phone, state, DOB
3. Toggle Be Surrogacy referral on/off
4. Auto-assigns to current admin, creates intake record

### Be Surrogacy Referrals
1. Referral surrogates marked with (BE) logo badge on cards and detail page
2. Toggle in admin contact edit section or Add Surrogate dialog
3. Stored as `referral_partner = 'be_surrogacy'` on intake_submissions

### Surrogate: View Quiz Results
1. Dashboard → click "Quiz Results" card
2. Dialog shows only fields from the 5-step quiz (not profile fields)
3. Status shown as "Under Review"

### Admin: Review Intake Submissions
1. Sidebar → Applications → filter by type (GC/IP), status (including "Reviewed"), or source
2. Click row → detail dialog with all answers, DQ reasons highlighted
3. Status buttons: Pending Review, Reviewed, Qualified, Approved, Rejected

## Pages

| Page | Path | Roles | Status |
|------|------|-------|--------|
| Admin Dashboard | / | super_admin, master_admin, admin | Built (live Supabase counts) |
| Surrogate Dashboard | / | surrogate | Built (tasks, profile, quiz) |
| IP Dashboard | / | intended_parent | Built |
| Partner Dashboard | / | surrogate_partner | Built |
| Surrogates List | /surrogates | admin+ | Built (live Supabase, case assignment) |
| Surrogate Detail | /surrogates/:id | admin+ | Built (live data, profile mgmt) |
| Intended Parents List | /intended-parents | admin+ | Built (empty — needs IP intake) |
| IP Detail | /intended-parents/:id | admin+ | Built (needs live data) |
| My Profile | /my-profile | surrogate | Built (Supabase sync, photo upload) |
| Forms List | /forms | all | Built |
| Surrogate Quiz | /surrogatequiz | public | Built |
| IP Intake | /intended-parent-intake | public | Built |
| Intake Confirmation | /apply/confirmation | public | Built |
| Intake Submissions | /intake | admin+ | Built (live Supabase) |
| Marketing Dashboard | /marketing | marketing+ | Built |
| Matching | /matching | admin+ | Built (needs live data) |
| Calendar | /calendar | admin+ | Built |
| Time Clock | /time-clock | admin+ | Built |
| Settings | /settings | master_admin+ | Built |
| Documents | /documents | all | Stub |
| Messages | /messages | all | Stub |
| E-Signature | /e-signature | admin+ | Stub |
| Email | /email | admin+ | Stub |
| HR Management | /hr | master_admin+ | Stub |
| Payroll | /payroll | master_admin+ | Stub |

## Terminology

| Term | Meaning |
|------|---------|
| GC / Surrogate | Gestational carrier — woman carrying pregnancy for intended parents |
| IP | Intended parent(s) — person(s) seeking surrogacy |
| Match | Pairing of a surrogate with intended parent(s) |
| Journey | The full surrogacy process from application to delivery |
| Gravida/Para (G/P) | Pregnancy history: G=total pregnancies, P=live births, M=miscarriages, T=terminations |
| Be Surrogacy | Referral partner — surrogates referred through Be Surrogacy marked with (BE) badge |
| Case Assignment | Each surrogate is assigned to a specific admin who manages their journey |
| Profile Approval | Admin approves a surrogate's matching profile, locking it from further edits |
| Screening | 4-step verification: Medical, Psychological, Background Check, Home Study |
| Transfer | Embryo transfer procedure |
| Clearance | Medical or psychological clearance to proceed |
| Task | Action item on a profile — workflow-generated, staff-assigned, or self-created |
| Admin Note | Announcement published by master_admin, displayed as dashboard alert banners |
| UTM Parameters | URL tracking for marketing attribution (utm_source, utm_medium, etc.) |
| GTM | Google Tag Manager (GTM-KK2Q822N) — marketing team manages pixels here |

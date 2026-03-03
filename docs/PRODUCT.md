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

### Form Builder: Create Custom Form
1. Forms → New Form
2. Add sections, add fields (10 types)
3. Configure labels, types, required, options
4. Reorder fields with up/down buttons
5. Preview mode toggle
6. Save Draft / Publish

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
| Surrogates | /surrogates | admin+ | Stub |
| Intended Parents | /intended-parents | admin+ | Stub |
| Matching | /matching | admin+ | Stub |
| CRM / Cases | /crm | admin+ | Stub |
| Documents | /documents | all | Stub |
| E-Signature | /e-signature | admin+ | Stub |
| Messages | /messages | all | Stub |
| Email | /email | admin+ | Stub |
| Calendar | /calendar | admin+ | Stub |
| HR Management | /hr | master_admin+ | Stub |
| Time Clock | /time-clock | admin+ | Stub |
| Payroll | /payroll | master_admin+ | Stub |
| Financials | /financials | master_admin+ | Stub |
| Reports | /reports | master_admin+ | Stub |
| Settings | /settings | master_admin+ | Stub |
| System | /system | super_admin | Stub |
| My Profile | /my-profile | surrogate, ip | Stub |
| My Match | /my-match | surrogate, partner, ip | Stub |
| Appointments | /appointments | surrogate, partner, ip | Stub |

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

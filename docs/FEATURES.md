# Features

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| AppLayout | src/components/layout/AppLayout.jsx | Main layout with responsive Sidebar + TopBar + content area |
| Sidebar | src/components/layout/Sidebar.jsx | Dark navy sidebar, hidden on mobile with Sheet drawer |
| TopBar | src/components/layout/TopBar.jsx | Cream header with hamburger menu (mobile), role switcher |
| RoleSwitcher | src/components/layout/RoleSwitcher.jsx | Dropdown to switch between 6 demo roles |
| RoleContext | src/context/RoleContext.jsx | React context providing role state, auth, mock users |
| PageHeader | src/components/shared/PageHeader.jsx | Reusable page title + subtitle + actions |
| StatCard | src/components/shared/StatCard.jsx | Dashboard stat card with title, value, icon |
| StatusBadge | src/components/shared/StatusBadge.jsx | Colored badge for legacy status display |
| StageBadge | src/components/shared/StageBadge.jsx | Colored badge showing journey stage + status (gradient pink-to-blue) |
| EmptyState | src/components/shared/EmptyState.jsx | Empty state placeholder with icon and message |
| ProfileAvatar | src/components/shared/ProfileAvatar.jsx | Initials-based avatar with pastel colors |
| InfoRow | src/components/shared/InfoRow.jsx | Labeled key-value row with icon |
| ScreeningStatusItem | src/components/shared/ScreeningStatusItem.jsx | Screening step with color-coded status icon |
| RichTextEditor | src/components/shared/RichTextEditor.jsx | Tiptap-based editor with bold, italic, underline, strikethrough, text color (8), highlight color (6), lists, undo/redo |
| StatusSettingsDialog | src/components/surrogates/StatusSettingsDialog.jsx | Admin dialog to manage statuses per stage (add/edit/delete with in-use warnings) |
| ProfilePreview | src/pages/profile/SurrogateProfilePage.jsx | Exported component showing full surrogate profile as IPs will see it — used inline on both surrogate and admin sides (850px, letter-size PDF width) |
| ProfileFields | src/components/profile/ProfileFields.jsx | Reusable field components (Field, TextField, TextAreaField, SelectField, YesNoField, CheckboxGroupField, CurrencyField, HouseholdMembers) with optional wrapper prop for admin toggle-off |
| profileConstants | src/components/profile/profileConstants.js | Shared profile constants (SECTION_META, REQUIRED_FIELDS, US_STATES) and helpers (isPregnancyComplete, countCompleted) |
| HouseholdMembers | src/components/profile/ProfileFields.jsx | Structured table for entering household members with name + relationship dropdown |
| CurrencyField | src/components/profile/ProfileFields.jsx | Auto-formatting currency input ($xx,xxx) for compensation fields |
| TrackingTable | src/pages/surrogates/SurrogateDetailPage.jsx | Reusable table for step/status tracking with log history, edit/delete, admin attribution, progress bar |
| MatchedJourneysPage | src/pages/journeys/MatchedJourneysPage.jsx | Dashboard for matched surrogacy journeys with tile/list views, stage filters, search |
| ComingSoonPage | src/pages/ComingSoonPage.jsx | Public landing page at root URL |
| AdminDashboard | src/pages/dashboard/AdminDashboard.jsx | Live stats (Surrogates, Intended Parents, Matches in Progress, Matched Journeys), clickable Surrogates tile → Screening Overview with card-style stage filters (Pre-Qualification/Screening/Matching), spreadsheet table, match pipeline, quick actions |
| SurrogateDashboard | src/pages/dashboard/SurrogateDashboard.jsx | Profile card with CTA, Quiz Results dialog, tasks, contact |
| IPListPage | src/pages/intended-parents/IPListPage.jsx | Live Supabase data. Tile/list view, search by name/email/location, status & type filters, RE/embryo/consultation info on cards |
| IPDetailPage | src/pages/intended-parents/IPDetailPage.jsx | Live Supabase data. Hero with contact buttons, Overview (IP1, IP2, fertility details), Contact (copy-to-clipboard), Profile, Intake Answers tabs |
| IPProfileTab | src/components/intended-parents/IPProfileTab.jsx | Comprehensive IP profile builder: 5 collapsible sections (Fertility, Surrogacy, Personal, Health, Personal History). Shared sections for couples + per-person sections with IP1/IP2 tabs. Edit/save per section, progress bar, stored in answers._ipProfile |
| SurrogateListPage | src/pages/surrogates/SurrogateListPage.jsx | Live Supabase data. Stage-based hero stats, StageBadge on cards, animated ping dot for "New" surrogates, drag-to-reorder, grid/list view, search, status settings gear |
| SurrogateDetailPage | src/pages/surrogates/SurrogateDetailPage.jsx | Hero with interactive flip tiles, Stage+Status selectors, Text/Email/Call buttons. Tabs: Overview (screening checklist), Contact, Profile (inline preview + PDF download), Screening, Medical Records, Documents (drag-drop, ZIP extract), Notes |
| SurrogateProfilePage | src/pages/profile/SurrogateProfilePage.jsx | 9-section collapsible profile builder with Supabase sync, photo upload |
| FormsListPage | src/pages/forms/FormsListPage.jsx | Admin: form definitions. Surrogate: empty state |
| IntakeLandingPage | src/pages/intake/IntakeLandingPage.jsx | Public /surrogatequiz landing |
| SurrogateIntakeForm | src/pages/intake/SurrogateIntakeForm.jsx | 5-step quiz with bot protection |
| IPIntakeForm | src/pages/intake/IPIntakeForm.jsx | 5-step IP intake with partner yes/no, RE doctor & embryo follow-ups, free-text referral source, bot protection |
| IntakeConfirmationPage | src/pages/intake/IntakeConfirmationPage.jsx | Post-submission: GCs create account, IPs see "we'll be in touch" (no account creation) |
| IntakeSubmissionsPage | src/pages/intake/IntakeSubmissionsPage.jsx | Admin intake review with live Supabase data |
| MarketingDashboard | src/pages/marketing/MarketingDashboard.jsx | Analytics with source breakdown |
| MatchingPage | src/pages/matching/MatchingPage.jsx | Kanban pipeline board |
| CalendarPage | src/pages/calendar/CalendarPage.jsx | Monthly calendar view |
| TimeClockPage | src/pages/time-clock/TimeClockPage.jsx | Clock in/out with pay period tracking |
| SettingsPage | src/pages/SettingsPage.jsx | Admin notes management |

## Bot Protection

| Layer | Location | Description |
|-------|----------|-------------|
| Honeypot | src/lib/botProtection.jsx | Hidden field bots auto-fill, humans never see |
| Time-based | src/lib/botProtection.jsx | Rejects form submissions under 15 seconds |
| Rapid-fill | src/lib/botProtection.jsx | Detects inhumanly fast field changes |
| Cloudflare Turnstile | src/lib/botProtection.jsx | CAPTCHA widget, activated via VITE_TURNSTILE_SITE_KEY env var |

## Stages & Statuses

| Stage | Color | Default Statuses |
|-------|-------|-----------------|
| Pre-Qualification | #ed148c (pink) | New, 1st/2nd/3rd Reach Out, Screening Call Scheduled/Complete, Pending Profile Completion, Profile Complete, Zoom Call Scheduled |
| Screening | #c4219a | Documents Requested/Received, Medical/Psych Scheduled/Complete, Background In Progress/Complete |
| Matching | #9b2ea7 | Awaiting Match, Profile Shared, Meeting Scheduled/Complete, Match Confirmed |
| Journey Oversight | #723bb4 | Legal Review, Medical Clearance, Transfer Prep, Active Pregnancy, Monitoring |
| Journey Ending | #4d3da4 | Delivery Scheduled, Delivered, Post-Partum, Final Payments, Wrap-Up |
| Journey Closed | #283693 (indigo) | Closed — Complete/Withdrawn/Disqualified |

Config: `src/lib/constants.js` (SURROGATE_STAGES, DEFAULT_STATUSES_BY_STAGE)
Store: `src/lib/stageStatusStore.js` (localStorage-backed CRUD for config + per-surrogate data)

## Supabase Integration

| Feature | Table/Bucket | Status |
|---------|-------------|--------|
| Intake submissions | intake_submissions | Live |
| Surrogate profiles | surrogate_profiles | Live |
| Photo storage | profile-photos bucket | Live |
| Admin notes | admin_notes + admin_note_dismissals | Live |
| User tasks | user_tasks | Live |
| Case notes | case_notes | Live |
| Case documents | case_documents + case-documents bucket | Live |
| Auth | auth.users | Live |

## External Integrations

| Integration | Status |
|------------|--------|
| Google Tag Manager (GTM-57W6436V) | Installed |
| Cloudflare Turnstile | Configured (site key in env) |
| Cloudflare Pages | Hosting |
| Supabase Auth | Live |
| Supabase Storage | Live (profile-photos, case-documents) |
| Twilio SMS | Trial (send/receive via Cloudflare Pages Functions) |

## Changelog

| Date | Change |
|------|--------|
| 2026-03-30 | Babies Born page (/babies-born) with line chart, editable year data. Profile photo avatars on list/detail/topbar. Supabase migration for all localStorage stores (app_config table). Medical records: type badges, custom labels, deactivate-as-status, add records, dashboard popup fixes. Stage Statuses in admin settings with CRUD. Admin profile upsert fix. Number-driven pregnancy editing. |
| 2026-03-27 | IP Profile tab: 5-section profile builder (Fertility, Surrogacy, Personal, Health, Personal History) with collapsible cards, per-person IP1/IP2 tabs for couples, edit/save per section, completion progress bar. Data stored in answers._ipProfile via updateIntakeSubmission. |
| 2026-03-28 | Configurable checklists & milestones (Settings UI, per-stage, GC/IP/Journey tabs). Twilio SMS integration (send/receive, text messages page, case thread, unread tracking). Admin profile editor: rich forms, add/remove arrays, field visibility toggles (_hiddenFields). Team management in Settings. Real admin staff names. Medical records: IVF count fix, N/A toggle. Milestone timeline on overview tab. |
| 2026-03-27 | IP intake form rebuilt from PDF specs (partner yes/no, conditional RE doctor/embryo fields, free-text referral). IP confirmation: simple thank-you, no password, no DQ. IP admin pages live from Supabase (list with tile/list view, detail with overview/contact/intake tabs). Bot protection fix: rapid-fill threshold loosened (30ms/10), Turnstile hostnames fixed. |
| 2026-03-27 | Dashboard: renamed tiles (Intended Parents, Matched Journeys), clickable Surrogates → screening overview with card-style stage filters, table UX cleanup. IP intake: partner yes/no, RE/embryo follow-ups, free-text referral. IP confirmation: no account creation. |
| 2026-03-27 | Profile restructure (9→11 sections per ABC spreadsheet), inline preview (850px PDF-width), admin profile tab overhaul with animated edit expansion, per-journey experienced surrogate cards, household structured table, conditional partner questions, currency formatting, profile/cover photo uploads |
| 2026-03-24 | Landing page routing, bot protection (4 layers), surrogate page redesign with GTPAL/interactive tiles, stages & statuses system, rich text notes, documents tab with preview/search/drag-reorder, search engine blocking |
| 2026-03-23 | Mobile responsiveness, photo upload, profile sync, admin management, case assignment, referrals |
| 2026-03-20 | Surrogate Profile page: 9-section builder |
| 2026-03-18 | Intake forms, DQ logic, marketing analytics |
| 2026-03-03 | Time Clock, Calendar, Matching, share pages, photo gallery |
| 2026-03-02 | Initial prototype |

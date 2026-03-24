# Features

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| AppLayout | src/components/layout/AppLayout.jsx | Main layout with responsive Sidebar (hidden on mobile, Sheet drawer) + TopBar + content area |
| Sidebar | src/components/layout/Sidebar.jsx | Dark navy sidebar, hidden on mobile with Sheet drawer, auto-closes on nav |
| TopBar | src/components/layout/TopBar.jsx | Cream header with hamburger menu (mobile), role switcher, user info |
| RoleSwitcher | src/components/layout/RoleSwitcher.jsx | Dropdown to switch between 6 demo roles |
| RoleContext | src/context/RoleContext.jsx | React context providing role state, auth, mock users |
| PageHeader | src/components/shared/PageHeader.jsx | Reusable page title + subtitle + actions, responsive stacking |
| StatCard | src/components/shared/StatCard.jsx | Dashboard stat card with title, value, icon |
| StatusBadge | src/components/shared/StatusBadge.jsx | Colored badge for status display |
| EmptyState | src/components/shared/EmptyState.jsx | Empty state placeholder with icon and message |
| ProfileAvatar | src/components/shared/ProfileAvatar.jsx | Initials-based avatar with pastel colors derived from name hash |
| InfoRow | src/components/shared/InfoRow.jsx | Labeled key-value row with icon |
| ScreeningStatusItem | src/components/shared/ScreeningStatusItem.jsx | Screening step with color-coded status icon |
| AdminDashboard | src/pages/dashboard/AdminDashboard.jsx | Live stats from Supabase, match pipeline, quick actions |
| SurrogateDashboard | src/pages/dashboard/SurrogateDashboard.jsx | Full-width profile card with CTA to first incomplete section, Quiz Results dialog, "You're all caught up" banner, tasks, contact card |
| SurrogateListPage | src/pages/surrogates/SurrogateListPage.jsx | Live data from Supabase. Case assignment (My Cases/All/Unassigned/by admin), tile/list view, search, status filter, Add Surrogate dialog, BE referral badge, gravida/para display |
| SurrogateDetailPage | src/pages/surrogates/SurrogateDetailPage.jsx | Real data from Supabase. Hero with assignment dropdown + BE badge. Tabs: Overview (editable contact, BE toggle, screening), Profile (completion tracking, per-section edit, preview, approve/unapprove), Quiz Answers, Screening, Photos, Notes |
| SurrogateProfilePage | src/pages/profile/SurrogateProfilePage.jsx | 9-section collapsible profile builder. Auto-saves to localStorage + Supabase. Cover photo + gallery with drag reorder + crop/rotate. Preview button. Locks when approved. Hash-based section navigation. |
| FormsListPage | src/pages/forms/FormsListPage.jsx | Admin: form definitions table. Surrogate: empty state (forms appear when assigned) |
| IntakeLandingPage | src/pages/intake/IntakeLandingPage.jsx | Public /surrogatequiz landing with gradient "5 minutes" badge |
| SurrogateIntakeForm | src/pages/intake/SurrogateIntakeForm.jsx | 5-step quiz with gradient pill progress bar, "Other" text field for referral |
| IntakeConfirmationPage | src/pages/intake/IntakeConfirmationPage.jsx | Post-submission with account creation, updated "Let's meet!" text |
| IntakeSubmissionsPage | src/pages/intake/IntakeSubmissionsPage.jsx | Admin intake review with "Reviewed" status, live Supabase data |
| MarketingDashboard | src/pages/marketing/MarketingDashboard.jsx | Analytics with source breakdown, DQ reasons, time filters |
| MatchingPage | src/pages/matching/MatchingPage.jsx | Kanban pipeline board with 10 stage columns |
| CalendarPage | src/pages/calendar/CalendarPage.jsx | Monthly calendar view with event types |
| TimeClockPage | src/pages/time-clock/TimeClockPage.jsx | Clock in/out with pay period tracking |
| SettingsPage | src/pages/SettingsPage.jsx | Admin notes management |
| PhotoGallery | src/components/shared/PhotoGallery.jsx | Hero + grid photo display modes |
| SurrogateSharePage | src/pages/surrogates/SurrogateSharePage.jsx | Standalone branded matching profile |
| IPSharePage | src/pages/intended-parents/IPSharePage.jsx | Standalone branded IP matching profile |

## Supabase Integration

| Feature | Table/Bucket | Status |
|---------|-------------|--------|
| Intake submissions | intake_submissions | Live — quiz submissions, status, DQ reasons, UTM tracking, assigned_to, referral_partner |
| Surrogate profiles | surrogate_profiles | Live — profile_data JSONB, status (draft/approved), auto-sync from localStorage |
| Photo storage | profile-photos bucket | Live — cover photos, gallery photos, public URLs |
| Admin notes | admin_notes + admin_note_dismissals | Live — publish, dismiss, toggle |
| User tasks | user_tasks | Live — surrogate to-do items |
| Auth | auth.users | Live — surrogate signup/login via quiz completion |

## External Integrations

| Integration | Status |
|------------|--------|
| Google Tag Manager (GTM-KK2Q822N) | Installed on all pages |
| Supabase Auth | Live for surrogate signup |
| Supabase Storage | Live for profile photos |

## Changelog

| Date | Change |
|------|--------|
| 2026-03-23 | Full day: mobile responsiveness, photo upload with HEIC/crop/reorder, profile sync to Supabase, admin surrogate management with real data, case assignment, Be Surrogacy referrals, Add Surrogate, gravida/para, quiz progress pill, GTM, cleared mock data |
| 2026-03-20 | Surrogate Profile page: 9-section collapsible builder with progress tracking |
| 2026-03-18 | Intake form system: GC + IP forms, DQ logic, confirmation, ad tracking, admin review, marketing analytics |
| 2026-03-03 | Time Clock, Calendar, Admin Notes, Matching module, share pages, photo gallery, list/tile views |
| 2026-03-02 | Initial prototype: project scaffold, brand theme, 6-role app shell, 4 dashboards, forms module |

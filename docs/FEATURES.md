# Features

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| AppLayout | src/components/layout/AppLayout.jsx | Main layout with Sidebar + TopBar + content area |
| Sidebar | src/components/layout/Sidebar.jsx | Dark navy sidebar with role-filtered navigation |
| TopBar | src/components/layout/TopBar.jsx | Cream header with role switcher and user info |
| RoleSwitcher | src/components/layout/RoleSwitcher.jsx | Dropdown to switch between 6 demo roles |
| RoleContext | src/context/RoleContext.jsx | React context providing role state and mock users |
| PageHeader | src/components/shared/PageHeader.jsx | Reusable page title + subtitle + actions |
| StatCard | src/components/shared/StatCard.jsx | Dashboard stat card with title, value, icon |
| StatusBadge | src/components/shared/StatusBadge.jsx | Colored badge for status display |
| EmptyState | src/components/shared/EmptyState.jsx | Empty state placeholder with icon and message |
| AdminDashboard | src/pages/dashboard/AdminDashboard.jsx | Stats, match pipeline, activity, milestones, quick actions |
| SurrogateDashboard | src/pages/dashboard/SurrogateDashboard.jsx | Journey stepper, match info, next steps, messages |
| IPDashboard | src/pages/dashboard/IPDashboard.jsx | Journey banner, milestones, messages |
| PartnerDashboard | src/pages/dashboard/PartnerDashboard.jsx | Read-only partner view of surrogate journey |
| DashboardRouter | src/pages/dashboard/DashboardRouter.jsx | Routes to correct dashboard based on role |
| FormsListPage | src/pages/forms/FormsListPage.jsx | Table of form definitions with status and actions |
| FormBuilderPage | src/pages/forms/FormBuilderPage.jsx | Section-based form builder with 10 field types |
| FormSubmissionPage | src/pages/forms/FormSubmissionPage.jsx | Multi-section form fill with progress bar |
| FormResponsesPage | src/pages/forms/FormResponsesPage.jsx | Submission table with status management and detail view |
| FormFieldRenderer | src/components/forms/FormFieldRenderer.jsx | Renders form field by type (text, select, radio, etc.) |
| StubPage | src/pages/stubs/StubPage.jsx | "Coming Soon" placeholder for unbuilt modules |
| ProfileAvatar | src/components/shared/ProfileAvatar.jsx | Initials-based avatar with pastel colors derived from name, supports sm/md/lg/xl sizes |
| InfoRow | src/components/shared/InfoRow.jsx | Labeled key-value row with icon, used in detail page cards |
| ScreeningStatusItem | src/components/shared/ScreeningStatusItem.jsx | Screening step with color-coded status icon and label |
| TimelineItem | src/components/shared/TimelineItem.jsx | Timeline entry with dot connector, date, event, and type badge |
| SurrogateListPage | src/pages/surrogates/SurrogateListPage.jsx | Filterable surrogate list with tile/list view toggle, search, status, and match stage filters |
| SurrogateDetailPage | src/pages/surrogates/SurrogateDetailPage.jsx | Full surrogate profile with hero section and 6 tabs (Dashboard, Overview, Medical, Documents, Timeline, Notes) |
| IPListPage | src/pages/intended-parents/IPListPage.jsx | Filterable IP list with tile/list view toggle, search, status, and type filters |
| IPDetailPage | src/pages/intended-parents/IPDetailPage.jsx | Full IP profile with hero section and 5 tabs (Dashboard, Overview, Documents, Timeline, Notes) |
| PhotoGallery | src/components/shared/PhotoGallery.jsx | Photo display with hero mode (large + thumbnails) for share pages and grid mode for admin pages |
| AddPhotosDialog | src/components/shared/AddPhotosDialog.jsx | Mock photo upload dialog with drop zone UI |
| SurrogateSharePage | src/pages/surrogates/SurrogateSharePage.jsx | Standalone branded matching profile for surrogates — privacy names, curated sections, print-friendly |
| IPSharePage | src/pages/intended-parents/IPSharePage.jsx | Standalone branded matching profile for IPs — privacy names, preferences narrative, print-friendly |

| MatchingPage | src/pages/matching/MatchingPage.jsx | Kanban pipeline board with 10 stage columns, stats row, match management |
| MatchCard | src/pages/matching/MatchCard.jsx | Match card showing surrogate + heart + IP with date info |
| KanbanColumn | src/pages/matching/KanbanColumn.jsx | Single stage column with header badge and match card list |
| MatchDetailDialog | src/pages/matching/MatchDetailDialog.jsx | Match detail with stage progress bar, side-by-side profiles, advance/back controls |
| NewMatchDialog | src/pages/matching/NewMatchDialog.jsx | Two-panel dialog to select unmatched surrogate + IP and create a match |
| ProfileDashboardTab | src/components/shared/ProfileDashboardTab.jsx | Shared dashboard tab for surrogate/IP detail pages — stat cards, task list, recent notes, journey stepper |
| AddTaskDialog | src/components/shared/AddTaskDialog.jsx | Dialog to create a new task with title, category, source, and optional due date |
| mockTasks | src/data/mock/tasks.js | Mock task data with workflow templates per match stage, task categories, and ~23 tasks across profiles |
| Supabase Client | src/lib/supabase.js | Supabase client init (gracefully returns null if env vars not set) |
| DB Helpers | src/lib/db.js | Supabase query helpers with timeout wrapper (admin notes CRUD + dismissals) |
| SQL Schema | scripts/schema.sql | PostgreSQL schema with RLS policies for admin_notes and admin_note_dismissals |
| AdminNotes (Dashboard) | src/pages/dashboard/AdminDashboard.jsx | Indigo alert banners between header and stat cards. Fetches active notes from Supabase, dismiss with optimistic UI. |
| SettingsPage | src/pages/SettingsPage.jsx | Notes management for master_admin/super_admin: publish dialog (title, message, target), notes list with active/inactive toggle, delete, dismissal counts |
| CalendarPage | src/pages/calendar/CalendarPage.jsx | Mock Google Calendar-style monthly view with colored event pills, prev/next navigation, event detail dialog, upcoming sidebar |
| calendarEvents | src/data/mock/calendarEvents.js | Mock calendar events (20 events across Mar–May 2026) with 5 event types: appointment, milestone, meeting, legal, admin |
| IntakeLandingPage | src/pages/intake/IntakeLandingPage.jsx | Public /apply page with two cards (Apply as Surrogate / Apply as Intended Parent), captures UTM + fbclid + ttclid tracking params to sessionStorage |
| SurrogateIntakeForm | src/pages/intake/SurrogateIntakeForm.jsx | Public 5-step GC intake form (/apply/surrogate): About You, Health & Lifestyle (BMI auto-calc), Pregnancy History, Surrogacy Readiness, Final Details. DQ logic at submission. |
| IPIntakeForm | src/pages/intake/IPIntakeForm.jsx | Public 5-step IP intake form (/apply/intended-parent): About You, Your Journey, Preferences, Financial Readiness, Final Details. DQ on no financing plan. |
| IntakeConfirmationPage | src/pages/intake/IntakeConfirmationPage.jsx | Post-submission confirmation page (/apply/confirmation). Warm qualified flow with next steps or compassionate DQ messaging. |
| IntakeSubmissionsPage | src/pages/intake/IntakeSubmissionsPage.jsx | Admin intake review page (/intake). Filterable table (type/status/source), detail dialog with all answers + DQ reasons highlighted, approve/reject/pending actions. |
| MarketingDashboard | src/pages/marketing/MarketingDashboard.jsx | Analytics dashboard (/marketing) for marketing + master_admin + super_admin. 30/60/90/all-time toggle, stat cards, source bar chart, GC/IP split, DQ breakdown, recent submissions. |
| intakeSubmissions | src/data/mock/intakeSubmissions.js | 20 mock intake submissions (11 GC, 9 IP) with UTM/fbclid/ttclid tracking, DQ reasons, statuses, and helper functions |
| TimeClockPage | src/pages/time-clock/TimeClockPage.jsx | Admin time clock page (/time-clock): clock in/out with live HH:MM:SS timer and pulsing indicator, bi-weekly pay period summary (total hours, days worked, avg daily), time entries table with prev/next period navigation, status badges (pending/approved/edited), edit entry dialog with time inputs and live hours preview, master_admin/super_admin staff selector dropdown |
| timeClockData | src/data/mock/timeClockData.js | Mock data for time clock: staff list (from mockUsers), 4 bi-weekly pay periods (Jan 19 – Mar 15, 2026), ~25 time entries across staff/periods, helper functions (getCurrentPayPeriod, calculateHours, formatTime12h) |

## Changelog

| Date | Change |
|------|--------|
| 2026-03-18 | Intake form system: public GC + IP multi-step forms with DQ logic, confirmation page, ad tracking (UTM/fbclid/ttclid). Admin intake submissions review page. Marketing analytics dashboard. Marketing role + mock user added. |
| 2026-03-03 | Time Clock page: admin clock in/out with live timer, bi-weekly pay period tracking, time entries table with edit dialog, staff selector for master admins. Mock data (no backend). |
| 2026-03-03 | Calendar page: monthly grid view with 5 event types, event detail dialog, upcoming sidebar, month navigation |
| 2026-03-03 | Admin Notes: Supabase integration (client, db helpers, schema). Settings page with notes management (publish, toggle, delete). Dashboard alert banners for admin users. |
| 2026-03-03 | List/Tile view toggle for Surrogates and Intended Parents — toggle between card grid and compact table view, clickable rows navigate to detail pages |
| 2026-03-03 | Phase 5: Profile Dashboard tab + task system — Dashboard as default tab on detail pages, stat cards, checkable tasks (workflow/staff/self sources), add task dialog, recent notes, journey progress stepper |
| 2026-03-03 | Phase 4: Matching module — Kanban pipeline board with 10 stage columns, match cards, detail dialog with advance/back, new match creation from unmatched candidates |
| 2026-03-03 | Phase 3: Matching profiles + photo gallery — share pages for surrogates & IPs, photo gallery component, stock photos, print CSS |
| 2026-03-03 | Phase 2: Surrogate & IP profile pages — enriched mock data (10 surrogates, 8 IPs), 4 shared components, list + detail views with search/filters/tabs |
| 2026-03-02 | Initial prototype: project scaffold, brand theme, 6-role app shell, 4 dashboards, full forms module, 19 stubbed modules |

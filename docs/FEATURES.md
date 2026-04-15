# Features

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| AppLayout | src/components/layout/AppLayout.jsx | Main layout with responsive Sidebar + TopBar + content area |
| Sidebar | src/components/layout/Sidebar.jsx | Glassmorphism sidebar with indigo-purple-pink gradient, frosted glass active states, white logo area, hidden on mobile with Sheet drawer |
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
| SurrogateDashboard | src/pages/dashboard/SurrogateDashboard.jsx | Profile card, application CTA (3 states: not reviewed/reviewed/app released), tasks |
| PortalApplicationPage | src/pages/portal/PortalApplicationPage.jsx | 5-section application form (Personal Info, Confidential, References, Clinic/Hospital, Social Media Release) with validation, accordion, submit flow, read-only after submission |
| PortalDocumentsPage | src/pages/portal/PortalDocumentsPage.jsx | Surrogate portal documents: signed e-sign docs + user uploads |
| SignReleaseBatchPage | src/pages/esign/SignReleaseBatchPage.jsx | Batch signing page for medical records releases — one link, verify once, sign all, PDF generation per form |
| ReleaseFormGenerator | src/lib/releaseFormGenerator.js | HIPAA-compliant HTML release form generator per provider (OB, Hospital, MFM, IVF) |
| AISummaryButton | src/components/shared/AISummaryButton.jsx | Shared AI case summary button — used on surrogate, IP, journey hero sections + Case Updates |
| ReferralBonusTrackerPage | src/pages/referrals/ReferralBonusTrackerPage.jsx | Referral ($4K) and sign-on bonus ($4K) tracking with split payments at medical/legal clearance |
| RecordsSummaryPage | src/pages/records/RecordsSummaryPage.jsx | List of surrogates needing records summary (from checklist "Requested" status) |
| RecordsSummaryWorkspace | src/pages/records/RecordsSummaryWorkspace.jsx | Split-screen: PDF doc viewer (left) + GC Medical Records Summary form (right). PDF merge, page removal, preview, export. Pre-fills from profile. |
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
| CalendarPage | src/pages/calendar/CalendarPage.jsx | Google Calendar-style with sidebar calendar selector, colored events, upcoming sidebar |
| ESignaturePage | src/pages/esign/ESignaturePage.jsx | "Sent Documents" tab (status, signers, audit, void) + "Send for Signature" tab (Google Drive templates). Case names link to journeys. Searchable case selector, role dropdowns, admin user picker, required role validation from doc placeholders |
| EditDocumentPage | src/pages/esign/EditDocumentPage.jsx | Google Docs iframe editor, send modal with auto-detected required roles, admin dropdown, journey auto-populate, searchable case selector. Supports prefill from case/journey URL params |
| SignDocumentPage | src/pages/esign/SignDocumentPage.jsx | Public signing page: email verification, inline {{Field:Role}} form inputs, signature pad (type/draw), required field validation, ESIGN/UETA compliance. Generates signed PDF via Google Docs API with handwriting fonts and inline signature images |
| GCApplicationTab | src/components/surrogates/GCApplicationTab.jsx | 6 collapsible form sections (Quiz, Application, References, Confidential, Clinic, Social Media) with search |
| IPApplicationTab | src/components/intended-parents/IPApplicationTab.jsx | 4 collapsible form sections (Intake, Contact Info, Clinic, References) with search |
| EmailPage | src/pages/email/EmailPage.jsx | Gmail integration: inbox, read, compose/send with attachments, search, log to case |
| FaxPage | src/pages/fax/FaxPage.jsx | SRFax integration: hero stats (Received/Unread/Filed/Sent filters), table layout with TrackingTable-style headers, send fax (upload or from case docs), near-fullscreen PDF preview with prev/next nav, inline file-to-case with rename + medical records log update, auto-advance to next unread, mark read/unread, filed case tracking (case link, date, admin, log updated Y/N), "Send Fax" on Surrogate/IP/Journey Documents tabs, sidebar unread badge |
| faxState | src/lib/faxState.js | localStorage-backed fax read/unread tracking + filing info (case, document name, admin, log updated) |
| CaseEmailsTab | src/components/shared/CaseEmailsTab.jsx | Reusable tab showing logged emails for a case (used in surrogate & IP detail pages) |
| SignDocumentPage | src/pages/esign/SignDocumentPage.jsx | Public signing page: email verification, PDF preview, {{Field:Role}} inputs, signature pad, ESIGN/UETA compliance |
| ComposeWindows | src/components/shared/ComposeWindows.jsx | Gmail-style floating compose windows with minimize, multi-draft, rich text, signature, case logging, auto-load cases for pre-set caseId |
| DraftContext | src/context/DraftContext.jsx | React context for managing email draft state, supports initial attachments and caseType |
| MatchSheetsTab | src/components/journeys/MatchSheetsTab.jsx | Attorney/Clinic/Escrow match sheets with inline editing, custom dropdowns, PDF generation with page breaks, Save to Documents + Send Match Sheet actions, branded footer |
| TrackingTable | src/components/shared/TrackingTable.jsx | Shared tracking table with expand/collapse, history log, edit/delete, rename labels, progress bar (used by surrogate, journey, IP checklists) |
| InsurancePage | src/pages/insurance/InsurancePage.jsx | Spreadsheet-style insurance management: inline-editable cells, per-row password toggle, status/year tabs, cross-tab search, admin filter, TabBanner |
| InsuranceTab | src/components/shared/InsuranceTab.jsx | Case-level insurance management on surrogate/journey detail pages: status, year, plan dates, binder, OB, hospital, notes |
| CaseImportPage | src/pages/admin/CaseImportPage.jsx | Super Admin case import: surrogate or IP (with IP2 partner), file uploads (PDF, ZIP, Excel notes, photos), matched journey creation with searchable case pickers, match sheet Excel import with 60+ column mappings |
| ExpensesPage | src/pages/expenses/ExpensesPage.jsx | Insurance-style expense spreadsheet: Expenses/Reconciled tabs, inline editing, CC last 4, escrow Y/N, doc preview, reconcile confirmation with task creation, admin/date filters |
| CaseUpdatesPage | src/pages/case-updates/CaseUpdatesPage.jsx | Surrogate Screening Overview (moved from dashboard): stage filter pills, checklist spreadsheet per surrogate |
| JourneyTileCard | src/pages/journeys/MatchedJourneysPage.jsx | Exported journey card component: IP+GC sections, milestones, escrow, pregnancy, managers. Reused on dashboard |
| SurrogateCard | src/pages/surrogates/SurrogateListPage.jsx | Exported surrogate card component: avatar, GTPAL, stage badge, location. Reused on dashboard |
| IPTileCard | src/pages/intended-parents/IPListPage.jsx | Exported IP card component: RE doctor, frozen embryos, milestone progress, type badge. Reused on dashboard |
| SortableTabsList | src/components/shared/SortableTabsList.jsx | Draggable tab reordering with @dnd-kit, Overview locked first, order persists per-case in Supabase app_config |
| PreviousMatchTab | src/components/shared/PreviousMatchTab.jsx | Displays broken match history: partner name, dates, reason, journey data snapshot, notes, checklist history. Only shown when _matchHistory exists |
| InsuranceCardIcon | src/components/shared/InsuranceTab.jsx | SVG icon for insurance card display |
| CaseTasksWidget | src/components/shared/CaseTasksWidget.jsx | Case-level task management: add/complete/delete tasks, priority, due dates, notes, overdue highlighting. Shows on Overview tab |
| DashboardTasksWidget | src/components/shared/CaseTasksWidget.jsx | Dashboard "My Tasks" widget: cross-case task view, searchable case picker for adding tasks from dashboard |
| CaseCalendarWidget | src/components/shared/CaseCalendarWidget.jsx | Per-case Google Calendar appointments: add/edit/delete with in-app confirmation dialog, past appointments modal (loads 2 years back), tagged with extendedProperties for filtering, syncs to full Google Calendar, multi-calendar fallback for edit/delete |
| TimeClockPage | src/pages/time-clock/TimeClockPage.jsx | Clock in/out with pay period tracking |
| SettingsPage | src/pages/SettingsPage.jsx | Admin notes, team management, stage statuses, checklists, Google integration connect/disconnect |
| PsychTrackingPage | src/pages/psych/PsychTrackingPage.jsx | Psych check-in tracking for surrogates with active pregnancy tracker. Columns: Surrogate, Contact (email+phone), Due Date, 10/20/30 Week (Due/Completed), Delivery Date, Post Delivery. Auto-calculates milestone dates from due date. Manual entry modal. Token-based shareable external link. |
| SharedPsychTrackingPage | src/pages/psych/SharedPsychTrackingPage.jsx | Public shared view of psych tracking — no login required, validates share token, full read/write access to check-in dates |
| IPProfilePage | src/pages/profile/IPProfilePage.jsx | Full IP profile builder mirroring GC profile pattern. Basic Information section (profile + cover photo), 5 collapsible sections (Fertility, Surrogacy, Personal, Health, History). Per-person IP1/IP2 tabs for personal sections. Always-editable inline fields with 2s debounce auto-save. Pre-fills from intake quiz answers. Stored in answers._ipProfile. |
| IPDashboard (redesigned) | src/pages/dashboard/IPDashboard.jsx | Welcome banner, pending tasks badge, "My Intake Answers" card with dialog (matches surrogate "Quiz Results" pattern), To Do + Completed task sections, coordinator card, contact card |
| Pregnancy Birth Logging | src/pages/journeys/JourneyDetailPage.jsx | "Log Birth" dialog on pregnancy banner. Fields: delivery date, type, per-baby name/sex/weight/length, notes. Auto-updates status to "Delivered", swaps 🤰 emoji for baby-boy.png/baby-girl.png based on first baby's sex. New "Delivered" timeline step. Edit Birth Details opens full form pre-filled. Auto-updates babies_born counter. |
| ReferralBonusTrackerPage | src/pages/referrals/ReferralBonusTrackerPage.jsx | Referral & sign-on bonus tracking: 4 tabs (Referrals, Sign-On Bonuses, Paid Referrals, Paid Bonuses). Auto-detects referrals from quiz "Friend or family" source, pulls Legal/Medical Clearance dates from journey checklists, mark half/fully paid with confirmation dialogs, expense-tracker table styling |

| FloatingStickyNotes | src/components/shared/FloatingStickyNotes.jsx | Draggable persistent post-it notes with neon colors, drag-to-resize height, minimize to TopBar pills (via React portal), per-user Supabase storage. Admin-only. |
| SignFormPage | src/pages/esign/SignFormPage.jsx | E-sign page for form templates (Background Waivers). Email verification, labeled form fields, 3 signature pads, live document preview, PDF generation with audit trail. Route: /e-signature/form/:formToken |
| SendFormTemplateButton | src/components/shared/SendFormTemplateButton.jsx | Reusable button to send form templates. Checks esign_documents for existing signed/pending status. Shows green "Signed", amber "Pending", or send button. |
| formTemplates | src/lib/formTemplates.js | Form template definitions + HTML generators for Background Waivers (GC, Partner, IP, IP2). Clean HTML forms replacing Google Docs placeholders. |
| AdminPhotosSection | src/pages/surrogates/SurrogateDetailPage.jsx | Unified photo grid with PROFILE/COVER badges, crop/rotate/resize editor, inactive toggle for shared profiles |
| PhotoLightbox | src/pages/profile/SurrogateProfilePage.jsx | Full-screen photo lightbox modal with arrows, thumbnails, counter — used in ProfilePreview |
| IPDashboard | src/pages/dashboard/IPDashboard.jsx | Real IP portal dashboard: case info, partner info, coordinator, quick links |
| IPProfilePage | src/pages/profile/IPProfilePage.jsx | Read-only IP profile view: personal, partner, location, fertility info |
| ProfileRouter | src/pages/profile/ProfileRouter.jsx | Routes /my-profile to IPProfilePage or SurrogateProfilePage based on role |
| findCaseByEmail | src/lib/db.js | Helper that finds intake case by primary email OR partner ip2Email (supports IP couple logins) |
| JourneyUpdateButton | src/components/shared/JourneyUpdateButton.jsx | Timestamped journey update log — button on hero cards, compact icon on case-updates. Modal with add/view/delete updates. Per-case in app_config. |
| ProviderInfoButton | src/components/shared/ProviderInfoButton.jsx | Provider info modal — IVF/Monitoring Clinic, IP/GC Attorney, Escrow, Insurance, OB/MFM/Delivery Hospital. Reads from journey_data. |
| QuickNote | src/components/shared/QuickNote.jsx | Collapsible auto-saving text area above tabs on all case pages. Yellow-tinted, per-case in app_config. |
| FIELD_LABELS | src/components/profile/profileConstants.js | Single source of truth for 150+ surrogate profile field labels — used by portal, admin, and preview. |

## Bot Protection

| Layer | Location | Status |
|-------|----------|--------|
| Time-based | src/lib/botProtection.jsx | ACTIVE — rejects submissions under 15 seconds |
| Rapid-fill | src/lib/botProtection.jsx | ACTIVE — detects inhumanly fast field changes |
| Honeypot | src/lib/botProtection.jsx | DISABLED — Safari mobile autofills hidden fields |
| Cloudflare Turnstile | src/lib/botProtection.jsx | DISABLED — fails to load on some browsers/ad blockers |

## API Endpoints (Cloudflare Functions)

| Endpoint | File | Description |
|----------|------|-------------|
| /api/welcome-email | functions/api/welcome-email.js | Surrogate welcome email (Resend) — no account creation |
| /api/ip-welcome-email | functions/api/ip-welcome-email.js | IP welcome email with warm copy + 48hr timeline |
| /api/notify-new-application | functions/api/notify-new-application.js | GC admin notification (GC_APPLICATION_NOTIFY_EMAIL) |
| /api/notify-ip-application | functions/api/notify-ip-application.js | IP admin notification with all answers (IP_APPLICATION_NOTIFY_EMAIL) |
| /api/notify-question | functions/api/notify-question.js | Email admin when question asked on shared profile |
| /api/check-portal-access | functions/api/check-portal-access.js | Server-side check if surrogate/IP case is in blocked stage |
| /api/set-password | functions/api/set-password.js | Sets password for existing auth user (service role) |
| /api/user-status | functions/api/user-status.js | Check if user has portal account + last login |
| /api/user-status-batch | functions/api/user-status-batch.js | Batch last-login lookup for surrogate list cards |
| /api/invite | functions/api/invite.js | Create auth user + generate reset link for portal invite |

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
| Google OAuth tokens | google_tokens | Live |
| Logged emails | case_emails | Live |
| E-sign templates | esign_templates | Live |
| E-sign documents | esign_documents | Live |
| E-sign audit log | esign_audit_log | Live |
| Insurance | surrogate_insurance + insurance_payments | Live |
| Matched journeys | matched_journeys (incl. match_date, journey_data._matchSheetData) | Live |
| Profile shares | profile_shares | Live |
| Match questions | match_questions | Live |
| Journey notes | journey_notes | Live |

## External Integrations

| Integration | Status |
|------------|--------|
| Google Tag Manager (GTM-57W6436V) | Installed |
| Cloudflare Turnstile | Configured (site key in env) |
| Cloudflare Pages | Hosting |
| Supabase Auth | Live |
| Supabase Storage | Live (profile-photos, case-documents, esign-documents) |
| Twilio SMS | Trial (send/receive via Cloudflare Pages Functions) |
| Google OAuth2 | Live (Gmail + Calendar + Drive scopes, token storage in Supabase) |
| Gmail API | Live (inbox, send with attachments, log to case, signature, draft saving) |
| Google Calendar API | Live (view/create/edit/delete events, multi-calendar) |
| Google Drive API | Live (list/create/copy/export docs, ABC Templates folder sync) |
| SRFax API | Ready (send/receive/retrieve, awaiting credentials) |

## Changelog

| Date | Change |
|------|--------|
| 2026-04-14 | Gmail inbox integration on case Emails tab (Logged/Inbox toggle, unread indicators, attachment preview in new tab, Save to Case with folder picker, log dialog with tags). Journey Update log button on all hero cards + case-updates. Provider Info modal on case-updates. Quick Note above tabs on all case pages. FIELD_LABELS map (150+ fields) for consistent labels across portal/admin/preview. AI Summary icon-only on case-updates. |
| 2026-04-13 | IP profile: GC-style PVSection cards, ages in header pills, first names only, full state names, Heart/HeartPulse icons. GC admin photos: Profile/Cover/Gallery upload with drag-reorder/crop/rotate. IP stages: Consultation/Matching/Holding/Withdrawn only. Checklist statuses: +Started/+Followed Up/+Note. Checklists moved to Overview tab (GC/IP/Journey). Case-updates: matched GCs/IPs hidden from individual tabs, appointment badges with full log modal. Appointments: follow-up tracking (✅ in Calendar title), notes per appointment, read-only Calendar API Note. AI summary: MM/DD/YYYY dates, split appointments, birth data, checklist logs, email snippets. Journey info rows: Monitoring Clinic on hero, Settings config for 6 provider info rows, violet-tinted rendering in case-updates. |
| 2026-04-13 | Records summary: DOB as MM/DD/YYYY, removed COVID section + occupation/lives with, smart pregnancy fields for miscarriage/termination (prenatal care conditional), OB Clearance moved to labs, PDF page breaks fixed (browser print with break-inside:avoid), line breaks preserved. Email sharing: body_html stored in DB so all admins can view, private email flag for master admins, lock toggle in log dialog. Office Admin role (settings access). Dashboard/list pages default to all cases for super/master admin. IP_STAGES separated from SURROGATE_STAGES. |
| 2026-04-10 | Floating draggable sticky notes (per-user, all pages, minimize to TopBar). Removed dashboard calculator + sticky notes. Removed Couple/Single badge from IP cards/details. Bot protection: disabled rapid-fill (Safari mobile false positive), only time check active. Surrogate admin notification email now includes "How They Heard" with referral name or other text. |
| 2026-04-09 — 2026-04-10 | Editable checklist log dates (past dates for case imports). Psych Tracking page (/psych-tracking) under Operations between Insurance Tracking and Expense Tracking. Renamed Insurance → Insurance Tracking. Token-based shareable psych tracking link with full read/write external access. Pregnancy tracker birth logging (delivery date/type, per-baby name/sex/weight/length, notes), 🤰 emoji replaced with baby-boy.png/baby-girl.png after birth, new "Delivered" timeline step, "Pregnant!" timeline colored by baby sex (pink girl/blue boy/green unknown), babies_born counter auto-updates. IP portal redesign matching surrogate dashboard pattern. Full IP profile builder (5 collapsible sections, always-editable inline fields, IP1/IP2 tabs, intake pre-fill, profile + cover photo upload). |
| 2026-04-08 | Referral & Bonus Tracker (/referral-bonus-tracker): 4-tab page (Referrals, Sign-On Bonuses, Paid Referrals, Paid Bonuses). Auto-detects referrals from quiz "Friend or family" source with referrer name. Pulls Legal/Medical Clearance dates from journey checklists. $1,000 default amounts. Mark half-paid and fully-paid with confirmation dialogs. Payment dates logged, paid items move to paid tabs. Expense-tracker table styling. AI Case Summary improvements: structured sections, gestational age, escrow, insurance, expenses, pregnancy losses. |
| 2026-04-06 | E-sign fixes: signed PDF uses draft copy, matchCase true, typed initials, cross-run placeholder search, draft kept until signing complete. Match sheet emails: attorney picker, escrow/clinic templates with prefilled To/CC/body. Baby sex+name tracking. Partner auto-fill from confidential section, only when document requires Partner. OptionalInitials/OptionalText placeholders. Compose paragraph spacing. |
| 2026-04-06 | E-sign: template copies in ABC Drafts folder, auto-deleted after send. Email templates: auto-welcome for qualified GCs (Resend API), 5 templates with merge fields, Send Template button on case Emails tab. Calendar picker (multi-calendar, Appointments default). Dashboard: searches both primary + Appointments calendar, case name links. |
| 2026-04-06 | Email compose: fixed case selector names (grouped by Journeys/Surrogates/IPs). CaseEmailsTab: clickable subjects, Sent/Received badges, better tag selection UI. Auto-logout (admins 6hr, users 1hr). Root URL → login. Personal dashboard tasks (+ Add Task, case_type='personal'). Pregnancy tracker: transfer tabs, edit all fields, beta values, beta #2, babies count, dropped cycle, system delete dialog, auto-status "Pregnant". GC/IP sticky notes on journey cards. |
| 2026-04-05 | User invite system (/api/invite, /api/user-status, /api/admin-users). Branded invite emails. Dynamic admin users from Supabase Auth (getAdminStaff replaces hardcoded mockUsers). Portal status on hero cards (active/last login). Auto-invite on admin add. Invite date logging. |
| 2026-04-04 | Password reset (forgot password + /reset-password page). Branded login page (gradient bg, pink-indigo button, frosted glass). IP list redesign (hero stats, owner filter, pink ping, milestones, egg icon). Journeys list redesign (hero stats, owner filter). AI extraction fixes (full email body, dollar detection). Email CSS sandboxed iframe. Expense email viewer modal. |
| 2026-04-04 | Dashboard redesign: quote of the day, collapsible appointments/tasks, My Cases with identical cards from list pages (exported JourneyTileCard, SurrogateCard, IPTileCard), calculator, per-user sticky notes. Expense tracking: /expenses spreadsheet, journey tab, CC last 4, escrow Y/N, reconcile with task creation, attachment upload/preview. Gmail signature as raw HTML below editor. Documents on IP/Journey pages with source labels. Break match copies only journey-period docs. "Previous Match" labels on docs. IP names first everywhere. Case Updates page. |
| 2026-04-04 | Email tagging (13 tags on log + compose, filter on case tab). AI expense/task extraction via Claude Haiku (Cloudflare function, editable confirmation, full email body parsing). Expense email viewer modal. Email CSS isolation (sandboxed iframe). IP list redesign (hero stats, owner filter, pink ping, milestones, egg icon, assigned admin). Journeys list redesign (hero stats, owner filter). |
| 2026-04-04 | Secure e-signature URLs (signing_token, /e-signature/sign/:token). Typed signature fix (mode tracking). Case tasks system (CaseTasksWidget + DashboardTasksWidget, case_tasks table). Case calendar widget (per-case Google Calendar events with extendedProperties filtering, appointment CRUD). Calendar page clickable case links. Insurance Pay Status column. |
| 2026-04-03 | Match-centric architecture: matched cases redirect to journey, removed from lists. Journey 3-card hero (Journey info + GC pink + IP blue stacked). Attorney info with Email Attorney. Provider modals (IVF/OB/Hospital with broken-out address + website). Insurance tab + Pay Status column on /insurance page. Draggable tabs per-case. Checklist history on stage change. Enhanced break match (saves snapshot + copies docs). PreviousMatchTab. Application/Profile tabs on journey with GC/IP sub-tabs. Email compose crash fixes (sync openDraft, error boundaries). |
| 2026-04-03 | Case Import: Super Admin import page (/case-import) for surrogates and IPs (with IP2 partner). File uploads (PDF, ZIP extract, Excel notes, photos). Create Matched Journey section with searchable pickers, original match date, stage selector, match sheet Excel import (60+ column mappings). Insurance: spreadsheet page with inline editing, per-row passwords, status/year tabs, cross-tab search. Sidebar: liquid glass active state, dock magnification, nav reorganization. Date formatting centralized (MM/DD/YYYY). Dark mode built then hidden. |
| 2026-04-03 | Fax: SRFax API live (account 288185). Full UX overhaul — hero stats bar (Received/Unread/Filed/Sent as clickable filters), table layout with TrackingTable-style headers, near-fullscreen PDF preview with prev/next navigation + auto-advance to next unread after filing, inline file-to-case panel with rename + medical records log update (select record + status + note), warnings for missing log updates and cases without records tasks, filed case tracking (case link, date, admin, log Y/N), mark read/unread, "Send Fax" from case Documents tabs, sidebar unread badge. New faxState.js for localStorage-backed read/filing tracking. |
| 2026-04-02 | E-Signature: Google Docs iframe editing (full toolbar, pagination, headers/footers in-app), templates synced from Google Drive ABC Templates folder, signature request emails via Gmail API, signing field placeholders ({{Signature:GC}} etc.), PDF export from Drive, template delete fix. Email: Gmail-style floating compose with minimize/multi-draft/rich text/signature/draft saving, unread badge, bulk actions. Calendar: Google Calendar API integration. Fax: SRFax page ready. |
| 2026-03-31 | E-Signature feature (template upload/edit/tag/delete, .docx→HTML editor, send for signature, type/draw signature, audit trail, HIPAA compliant). Admin profile UX overhaul (toggle buttons, dropdowns, checkboxes, currency). Photos section on admin profile tab (lightbox, hide/delete). Application tabs for GC (6 collapsible form sections with search) and IP (4 sections). Add IP button. IP detail redesign (hero tiles, stage/status selectors). Stage statuses split by GC/IP/Journey. Calendar Google-style with calendar selector sidebar. Dashboard OB records fix. |
| 2026-03-31 | Google OAuth integration (Gmail + Calendar scopes, token storage, connect/disconnect in Settings). Email page (/email) with Gmail inbox, read, compose/send with attachments, search, log-to-case. Calendar page rebuilt with Google Calendar API (multi-calendar, create/edit/delete events). Fax page (/fax) with SRFax API (send with cover pages, inbox/outbox, download). Emails tab on surrogate & IP detail pages. Case emails Supabase table. Fax nav link added. |
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

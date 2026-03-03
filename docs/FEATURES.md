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
| SurrogateListPage | src/pages/surrogates/SurrogateListPage.jsx | Filterable card grid of surrogates with search, status, and match stage filters |
| SurrogateDetailPage | src/pages/surrogates/SurrogateDetailPage.jsx | Full surrogate profile with hero section and 5 tabs (Overview, Medical, Documents, Timeline, Notes) |
| IPListPage | src/pages/intended-parents/IPListPage.jsx | Filterable card grid of intended parents with search, status, and type filters |
| IPDetailPage | src/pages/intended-parents/IPDetailPage.jsx | Full IP profile with hero section and 4 tabs (Overview, Documents, Timeline, Notes) |

## Changelog

| Date | Change |
|------|--------|
| 2026-03-03 | Phase 2: Surrogate & IP profile pages — enriched mock data (10 surrogates, 8 IPs), 4 shared components, list + detail views with search/filters/tabs |
| 2026-03-02 | Initial prototype: project scaffold, brand theme, 6-role app shell, 4 dashboards, full forms module, 19 stubbed modules |

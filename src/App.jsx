import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import DashboardRouter from './pages/dashboard/DashboardRouter'
import FormsListPage from './pages/forms/FormsListPage'
import FormBuilderPage from './pages/forms/FormBuilderPage'
import FormSubmissionPage from './pages/forms/FormSubmissionPage'
import FormResponsesPage from './pages/forms/FormResponsesPage'
import SurrogateListPage from './pages/surrogates/SurrogateListPage'
import SurrogateDetailPage from './pages/surrogates/SurrogateDetailPage'
import IPListPage from './pages/intended-parents/IPListPage'
import IPDetailPage from './pages/intended-parents/IPDetailPage'
import SurrogateSharePage from './pages/surrogates/SurrogateSharePage'
import IPSharePage from './pages/intended-parents/IPSharePage'
import MatchingPage from './pages/matching/MatchingPage'
import StubPage from './pages/stubs/StubPage'
import SettingsPage from './pages/SettingsPage'
import CalendarPage from './pages/calendar/CalendarPage'
import TimeClockPage from './pages/time-clock/TimeClockPage'
import IntakeLandingPage from './pages/intake/IntakeLandingPage'
import SurrogateIntakeForm from './pages/intake/SurrogateIntakeForm'
import IPIntakeForm from './pages/intake/IPIntakeForm'
import IntakeConfirmationPage from './pages/intake/IntakeConfirmationPage'
import IntakeSubmissionsPage from './pages/intake/IntakeSubmissionsPage'
import MarketingDashboard from './pages/marketing/MarketingDashboard'
import LoginPage from './pages/auth/LoginPage'

const stubs = [
  { path: '/crm', title: 'CRM / Cases' },
  { path: '/documents', title: 'Documents' },
  { path: '/e-signature', title: 'E-Signature' },
  { path: '/messages', title: 'Messages' },
  { path: '/email', title: 'Email' },
  { path: '/hr', title: 'HR Management' },
  { path: '/payroll', title: 'Payroll' },
  { path: '/financials', title: 'Financials' },
  { path: '/reports', title: 'Reports' },
  { path: '/system', title: 'System' },
  { path: '/my-profile', title: 'My Profile' },
  { path: '/my-match', title: 'My Match' },
  { path: '/appointments', title: 'Appointments' },
]
// Note: /intake and /marketing are NOT stubs — they are fully built pages

export default function App() {
  return (
    <Routes>
      {/* Public pages — no auth required */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/surrogates/:id/share" element={<SurrogateSharePage />} />
      <Route path="/intended-parents/:id/share" element={<IPSharePage />} />
      <Route path="/surrogatequiz" element={<IntakeLandingPage />} />
      <Route path="/apply/surrogate" element={<SurrogateIntakeForm />} />
      <Route path="/intendedparentapply" element={<IPIntakeForm />} />
      <Route path="/apply/confirmation" element={<IntakeConfirmationPage />} />

      {/* Authenticated app */}
      <Route element={<AppLayout />}>
        <Route index element={<DashboardRouter />} />
        <Route path="/forms" element={<FormsListPage />} />
        <Route path="/forms/builder" element={<FormBuilderPage />} />
        <Route path="/forms/builder/:formId" element={<FormBuilderPage />} />
        <Route path="/forms/:formId/submit" element={<FormSubmissionPage />} />
        <Route path="/forms/:formId/responses" element={<FormResponsesPage />} />
        <Route path="/surrogates" element={<SurrogateListPage />} />
        <Route path="/surrogates/:id" element={<SurrogateDetailPage />} />
        <Route path="/intended-parents" element={<IPListPage />} />
        <Route path="/intended-parents/:id" element={<IPDetailPage />} />
        <Route path="/matching" element={<MatchingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/time-clock" element={<TimeClockPage />} />
        <Route path="/intake" element={<IntakeSubmissionsPage />} />
        <Route path="/marketing" element={<MarketingDashboard />} />
        {stubs.map(s => (
          <Route
            key={s.path}
            path={s.path}
            element={<StubPage path={s.path} title={s.title} />}
          />
        ))}
      </Route>
    </Routes>
  )
}

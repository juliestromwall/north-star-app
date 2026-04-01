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
import MatchedJourneysPage from './pages/journeys/MatchedJourneysPage'
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
import ComingSoonPage from './pages/ComingSoonPage'
import SurrogateProfilePage from './pages/profile/SurrogateProfilePage'
import TextMessagesPage from './pages/messages/TextMessagesPage'
import BabiesBornPage from './pages/babies/BabiesBornPage'
import ESignaturePage from './pages/esign/ESignaturePage'
import SignDocumentPage from './pages/esign/SignDocumentPage'
import EditDocumentPage from './pages/esign/EditDocumentPage'
import EmailPage from './pages/email/EmailPage'
import FaxPage from './pages/fax/FaxPage'

const stubs = [
  { path: '/crm', title: 'CRM / Cases' },
  { path: '/documents', title: 'Documents' },
  { path: '/messages', title: 'Messages' },
  { path: '/hr', title: 'HR Management' },
  { path: '/payroll', title: 'Payroll' },
  { path: '/financials', title: 'Financials' },
  { path: '/reports', title: 'Reports' },
  { path: '/system', title: 'System' },
  { path: '/my-match', title: 'My Match' },
  { path: '/appointments', title: 'Appointments' },
]
// Note: /intake and /marketing are NOT stubs — they are fully built pages

export default function App() {
  return (
    <Routes>
      {/* Public pages — no auth required */}
      <Route index element={<ComingSoonPage />} />
      <Route path="/welcome" element={<ComingSoonPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/surrogates/:id/share" element={<SurrogateSharePage />} />
      <Route path="/intended-parents/:id/share" element={<IPSharePage />} />
      <Route path="/surrogatequiz" element={<IntakeLandingPage />} />
      <Route path="/apply/surrogate" element={<SurrogateIntakeForm />} />
      <Route path="/intendedparentapply" element={<IPIntakeForm />} />
      <Route path="/apply/confirmation" element={<IntakeConfirmationPage />} />

      {/* Authenticated app */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardRouter />} />
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
        <Route path="/journeys" element={<MatchedJourneysPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/time-clock" element={<TimeClockPage />} />
        <Route path="/intake" element={<IntakeSubmissionsPage />} />
        <Route path="/marketing" element={<MarketingDashboard />} />
        <Route path="/my-profile" element={<SurrogateProfilePage />} />
        <Route path="/text-messages" element={<TextMessagesPage />} />
        <Route path="/babies-born" element={<BabiesBornPage />} />
        <Route path="/email" element={<EmailPage />} />
        <Route path="/fax" element={<FaxPage />} />
        <Route path="/e-signature" element={<ESignaturePage />} />
        <Route path="/e-signature/edit/:templateId" element={<EditDocumentPage />} />
        <Route path="/e-signature/:id" element={<SignDocumentPage />} />
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

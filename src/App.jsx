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
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import ComingSoonPage from './pages/ComingSoonPage'
import SurrogateProfilePage from './pages/profile/SurrogateProfilePage'
import TextMessagesPage from './pages/messages/TextMessagesPage'
import BabiesBornPage from './pages/babies/BabiesBornPage'
import ESignaturePage from './pages/esign/ESignaturePage'
import SignDocumentPage from './pages/esign/SignDocumentPage'
import EditDocumentPage from './pages/esign/EditDocumentPage'
import SignReleaseBatchPage from './pages/esign/SignReleaseBatchPage'
import EmailPage from './pages/email/EmailPage'
import FaxPage from './pages/fax/FaxPage'
import SharedProfilePage from './pages/matching/SharedProfilePage'
import JourneyDetailPage from './pages/journeys/JourneyDetailPage'
import InsurancePage from './pages/insurance/InsurancePage'
import CaseImportPage from './pages/admin/CaseImportPage'
import ExpensesPage from './pages/expenses/ExpensesPage'
import CaseUpdatesPage from './pages/case-updates/CaseUpdatesPage'
import ReferralBonusTrackerPage from './pages/referrals/ReferralBonusTrackerPage'
import RecordsSummaryPage from './pages/records/RecordsSummaryPage'
import RecordsSummaryWorkspace from './pages/records/RecordsSummaryWorkspace'
import PsychTrackingPage from './pages/psych/PsychTrackingPage'
import SharedPsychTrackingPage from './pages/psych/SharedPsychTrackingPage'
import PortalDocumentsPage from './pages/portal/PortalDocumentsPage'
import PortalApplicationPage from './pages/portal/PortalApplicationPage'

const stubs = [
  { path: '/crm', title: 'CRM / Cases' },
  { path: '/documents', title: 'Documents' }, // admin documents (stub)
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
      <Route index element={<LoginPage />} />
      <Route path="/welcome" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/surrogates/:id/share" element={<SurrogateSharePage />} />
      <Route path="/intended-parents/:id/share" element={<IPSharePage />} />
      <Route path="/surrogatequiz" element={<IntakeLandingPage />} />
      <Route path="/apply/surrogate" element={<SurrogateIntakeForm />} />
      <Route path="/intendedparentapply" element={<IPIntakeForm />} />
      <Route path="/apply/confirmation" element={<IntakeConfirmationPage />} />
      <Route path="/share/:token" element={<SharedProfilePage />} />
      <Route path="/psych-tracking/share/:token" element={<SharedPsychTrackingPage />} />
      <Route path="/e-signature/:id" element={<SignDocumentPage />} />
      <Route path="/e-signature/sign/:token" element={<SignDocumentPage />} />
      <Route path="/e-signature/release/:batchToken" element={<SignReleaseBatchPage />} />

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
        <Route path="/my-documents" element={<PortalDocumentsPage />} />
        <Route path="/my-application" element={<PortalApplicationPage />} />
        <Route path="/text-messages" element={<TextMessagesPage />} />
        <Route path="/babies-born" element={<BabiesBornPage />} />
        <Route path="/email" element={<EmailPage />} />
        <Route path="/fax" element={<FaxPage />} />
        <Route path="/journeys/:id" element={<JourneyDetailPage />} />
        <Route path="/e-signature" element={<ESignaturePage />} />
        <Route path="/e-signature/edit/:templateId" element={<EditDocumentPage />} />
        <Route path="/insurance" element={<InsurancePage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/case-updates" element={<CaseUpdatesPage />} />
        <Route path="/referral-bonus-tracker" element={<ReferralBonusTrackerPage />} />
        <Route path="/records-summary" element={<RecordsSummaryPage />} />
        <Route path="/records-summary/:id" element={<RecordsSummaryWorkspace />} />
        <Route path="/psych-tracking" element={<PsychTrackingPage />} />
        <Route path="/case-import" element={<CaseImportPage />} />
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

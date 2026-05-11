import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import StubPage from './pages/stubs/StubPage'

// Route-level code splitting — every page below loads as its own JS chunk
// only when the user navigates to it. The initial bundle drops from ~4MB
// to the shell + login page, and going to /journeys/:id only downloads
// the journey page's code (not every other page in the app). Big perf win
// for cold loads — most pages were never going to be hit in a given session.
const ResetPasswordPage      = lazy(() => import('./pages/auth/ResetPasswordPage'))
const SurrogateSharePage     = lazy(() => import('./pages/surrogates/SurrogateSharePage'))
const IPSharePage            = lazy(() => import('./pages/intended-parents/IPSharePage'))
const IntakeLandingPage      = lazy(() => import('./pages/intake/IntakeLandingPage'))
const SurrogateIntakeForm    = lazy(() => import('./pages/intake/SurrogateIntakeForm'))
const IPIntakeForm           = lazy(() => import('./pages/intake/IPIntakeForm'))
const IntakeConfirmationPage = lazy(() => import('./pages/intake/IntakeConfirmationPage'))
const SharedProfilePage      = lazy(() => import('./pages/matching/SharedProfilePage'))
const SharedPsychTrackingPage = lazy(() => import('./pages/psych/SharedPsychTrackingPage'))
const SignDocumentPage       = lazy(() => import('./pages/esign/SignDocumentPage'))
const SignReleaseBatchPage   = lazy(() => import('./pages/esign/SignReleaseBatchPage'))
const BatchSignFormPage      = lazy(() => import('./pages/esign/BatchSignFormPage'))
const SignFormPage           = lazy(() => import('./pages/esign/SignFormPage'))

const DashboardRouter        = lazy(() => import('./pages/dashboard/DashboardRouter'))
const AdminCasesSummaryPage  = lazy(() => import('./pages/dashboard/AdminCasesSummaryPage'))
const FormsListPage          = lazy(() => import('./pages/forms/FormsListPage'))
const FormBuilderPage        = lazy(() => import('./pages/forms/FormBuilderPage'))
const FormSubmissionPage     = lazy(() => import('./pages/forms/FormSubmissionPage'))
const FormResponsesPage      = lazy(() => import('./pages/forms/FormResponsesPage'))
const SurrogateListPage      = lazy(() => import('./pages/surrogates/SurrogateListPage'))
const SurrogateDetailPage    = lazy(() => import('./pages/surrogates/SurrogateDetailPage'))
const FollowUpReviewPage     = lazy(() => import('./pages/surrogates/FollowUpReviewPage'))
const IPListPage             = lazy(() => import('./pages/intended-parents/IPListPage'))
const IPDetailPage           = lazy(() => import('./pages/intended-parents/IPDetailPage'))
const MatchingPage           = lazy(() => import('./pages/matching/MatchingPage'))
const MatchedJourneysPage    = lazy(() => import('./pages/journeys/MatchedJourneysPage'))
const SettingsPage           = lazy(() => import('./pages/SettingsPage'))
const CalendarPage           = lazy(() => import('./pages/calendar/CalendarPage'))
const TimeClockPage          = lazy(() => import('./pages/time-clock/TimeClockPage'))
const IntakeSubmissionsPage  = lazy(() => import('./pages/intake/IntakeSubmissionsPage'))
const MarketingDashboard     = lazy(() => import('./pages/marketing/MarketingDashboard'))
const ProfileRouter          = lazy(() => import('./pages/profile/ProfileRouter'))
const TextMessagesPage       = lazy(() => import('./pages/messages/TextMessagesPage'))
const TeamChatsPage          = lazy(() => import('./pages/messages/TeamChatsPage'))
const BabiesBornPage         = lazy(() => import('./pages/babies/BabiesBornPage'))
const ESignaturePage         = lazy(() => import('./pages/esign/ESignaturePage'))
const EditDocumentPage       = lazy(() => import('./pages/esign/EditDocumentPage'))
const EmailPage              = lazy(() => import('./pages/email/EmailPage'))
const FaxPage                = lazy(() => import('./pages/fax/FaxPage'))
const JourneyDetailPage      = lazy(() => import('./pages/journeys/JourneyDetailPage'))
const InsurancePage          = lazy(() => import('./pages/insurance/InsurancePage'))
const CaseImportPage         = lazy(() => import('./pages/admin/CaseImportPage'))
const ExpensesPage           = lazy(() => import('./pages/expenses/ExpensesPage'))
const CaseUpdatesPage        = lazy(() => import('./pages/case-updates/CaseUpdatesPage'))
const ReferralBonusTrackerPage = lazy(() => import('./pages/referrals/ReferralBonusTrackerPage'))
const RecordsSummaryPage     = lazy(() => import('./pages/records/RecordsSummaryPage'))
const RecordsSummaryWorkspace = lazy(() => import('./pages/records/RecordsSummaryWorkspace'))
const PsychTrackingPage      = lazy(() => import('./pages/psych/PsychTrackingPage'))
const PortalDocumentsPage    = lazy(() => import('./pages/portal/PortalDocumentsPage'))
const PortalApplicationPage  = lazy(() => import('./pages/portal/PortalApplicationPage'))

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

function PageLoading() {
  return <div className="flex items-center justify-center min-h-[40vh] text-stone-400 text-sm">Loading…</div>
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Public pages — no auth required */}
        <Route index element={<LoginPage />} />
        <Route path="/welcome" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/surrogates/:id/share" element={<SurrogateSharePage />} />
        <Route path="/intended-parents/:id/share" element={<IPSharePage />} />
        <Route path="/getstarted" element={<IntakeLandingPage />} />
        <Route path="/getstarted/surrogate" element={<SurrogateIntakeForm />} />
        <Route path="/getstarted/intendedparent" element={<IPIntakeForm />} />
        <Route path="/getstarted/confirmation" element={<IntakeConfirmationPage />} />
        {/* Legacy redirects — keep any old links / embeds working */}
        <Route path="/surrogatequiz" element={<Navigate to="/getstarted" replace />} />
        <Route path="/apply/surrogate" element={<Navigate to="/getstarted/surrogate" replace />} />
        <Route path="/intendedparentapply" element={<Navigate to="/getstarted/intendedparent" replace />} />
        <Route path="/apply/confirmation" element={<Navigate to="/getstarted/confirmation" replace />} />
        <Route path="/share/:token" element={<SharedProfilePage />} />
        <Route path="/therapist-tracking/share/:token" element={<SharedPsychTrackingPage />} />
        <Route path="/e-signature/:id" element={<SignDocumentPage />} />
        <Route path="/e-signature/sign/:token" element={<SignDocumentPage />} />
        <Route path="/e-signature/release/:batchToken" element={<SignReleaseBatchPage />} />
        <Route path="/e-signature/batch/:batchToken" element={<BatchSignFormPage />} />
        <Route path="/e-signature/form/:formToken" element={<SignFormPage />} />

        {/* Authenticated app */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardRouter />} />
          <Route path="/dashboard/cases-summary" element={<AdminCasesSummaryPage />} />
          <Route path="/forms" element={<FormsListPage />} />
          <Route path="/forms/builder" element={<FormBuilderPage />} />
          <Route path="/forms/builder/:formId" element={<FormBuilderPage />} />
          <Route path="/forms/:formId/submit" element={<FormSubmissionPage />} />
          <Route path="/forms/:formId/responses" element={<FormResponsesPage />} />
          <Route path="/surrogates" element={<SurrogateListPage />} />
          <Route path="/surrogates/:id" element={<SurrogateDetailPage />} />
          <Route path="/surrogates/:id/follow-up-review" element={<FollowUpReviewPage />} />
          <Route path="/intended-parents" element={<IPListPage />} />
          <Route path="/intended-parents/:id" element={<IPDetailPage />} />
          <Route path="/matching" element={<MatchingPage />} />
          <Route path="/journeys" element={<MatchedJourneysPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/time-clock" element={<TimeClockPage />} />
          <Route path="/intake" element={<IntakeSubmissionsPage />} />
          <Route path="/marketing" element={<MarketingDashboard />} />
          <Route path="/my-profile" element={<ProfileRouter />} />
          <Route path="/my-documents" element={<PortalDocumentsPage />} />
          <Route path="/my-application" element={<PortalApplicationPage />} />
          <Route path="/text-messages" element={<TextMessagesPage />} />
          <Route path="/team-chats" element={<TeamChatsPage />} />
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
          <Route path="/therapist-tracking" element={<PsychTrackingPage />} />
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
    </Suspense>
  )
}

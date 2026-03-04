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
import StubPage from './pages/stubs/StubPage'

const stubs = [
  { path: '/matching', title: 'Matching' },
  { path: '/crm', title: 'CRM / Cases' },
  { path: '/documents', title: 'Documents' },
  { path: '/e-signature', title: 'E-Signature' },
  { path: '/messages', title: 'Messages' },
  { path: '/email', title: 'Email' },
  { path: '/calendar', title: 'Calendar' },
  { path: '/hr', title: 'HR Management' },
  { path: '/time-clock', title: 'Time Clock' },
  { path: '/payroll', title: 'Payroll' },
  { path: '/financials', title: 'Financials' },
  { path: '/reports', title: 'Reports' },
  { path: '/settings', title: 'Settings' },
  { path: '/system', title: 'System' },
  { path: '/my-profile', title: 'My Profile' },
  { path: '/my-match', title: 'My Match' },
  { path: '/appointments', title: 'Appointments' },
]

export default function App() {
  return (
    <Routes>
      {/* Standalone share pages — no AppLayout */}
      <Route path="/surrogates/:id/share" element={<SurrogateSharePage />} />
      <Route path="/intended-parents/:id/share" element={<IPSharePage />} />

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

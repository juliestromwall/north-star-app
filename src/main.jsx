import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { RoleProvider } from './context/RoleContext'
import { AdminNotesProvider } from './context/AdminNotesContext'
import { TooltipProvider } from './components/ui/tooltip'
import './index.css'
import App from './App'
import { loadChecklistConfig } from './lib/checklistStore'
import { loadStageStatuses } from './lib/stageStatusStore'

// Initialize dark mode from localStorage before render to prevent flash
if (localStorage.getItem('abc_dark_mode') === 'true') {
  document.documentElement.classList.add('dark')
}

// Pre-load shared configs from Supabase BEFORE mounting React. This closes
// the race condition where components could read defaults from the sync
// fallback and accidentally overwrite real Supabase data on the next save.
Promise.all([
  loadStageStatuses(),
  loadChecklistConfig(),
])
  .catch(() => {}) // save() guard handles failure case
  .finally(() => {
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <BrowserRouter>
          <RoleProvider>
            <AdminNotesProvider>
              <TooltipProvider>
                <App />
              </TooltipProvider>
            </AdminNotesProvider>
          </RoleProvider>
        </BrowserRouter>
      </StrictMode>,
    )
  })

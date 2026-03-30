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

// Pre-load shared configs from Supabase into memory caches (fire-and-forget)
loadChecklistConfig().catch(() => {})
loadStageStatuses().catch(() => {})

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

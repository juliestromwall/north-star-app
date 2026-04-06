import { useState, Component } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { DraftProvider } from '@/context/DraftContext'
import ComposeWindows from '@/components/shared/ComposeWindows'
import { loadAdminUsers } from '@/data/mock/users'

class ComposeErrorBoundary extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err) { console.error('ComposeWindows crashed:', err) }
  render() { return this.state.hasError ? null : this.props.children }
}

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminLoaded, setAdminLoaded] = useState(false)
  const location = useLocation()

  // Load admin users from Supabase on mount
  useEffect(() => { loadAdminUsers().then(() => setAdminLoaded(true)).catch(() => setAdminLoaded(true)) }, [])

  // Close mobile sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <DraftProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-auto">
            <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              {adminLoaded ? <Outlet /> : <div className="text-center py-12 text-stone-400 text-sm">Loading...</div>}
            </div>
          </main>
        </div>
      </div>
      <ComposeErrorBoundary><ComposeWindows /></ComposeErrorBoundary>
    </DraftProvider>
  )
}

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { ROLES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { fetchSurrogateProfileByEmail, findCaseByEmail, getAppConfig } from '@/lib/db'

const MOCK_USERS = {
  [ROLES.SUPER_ADMIN]: {
    id: 'u1',
    name: 'Dev Admin',
    email: 'dev@abcsurrogacy.com',
    role: ROLES.SUPER_ADMIN,
    avatar: null,
  },
  [ROLES.MASTER_ADMIN]: {
    id: 'u2',
    name: 'Julie Allgood',
    email: 'julie@abcsurrogacy.com',
    role: ROLES.MASTER_ADMIN,
    avatar: null,
  },
  [ROLES.ADMIN]: {
    id: 'u4',
    name: 'Emily Rotter',
    email: 'emily@abcsurrogacy.com',
    role: ROLES.ADMIN,
    avatar: null,
  },
  [ROLES.SURROGATE]: {
    id: 'u4',
    name: 'Emily Carter',
    email: 'emily.carter@email.com',
    role: ROLES.SURROGATE,
    avatar: null,
  },
  [ROLES.SURROGATE_PARTNER]: {
    id: 'u5',
    name: 'David Carter',
    email: 'david.carter@email.com',
    role: ROLES.SURROGATE_PARTNER,
    avatar: null,
  },
  [ROLES.INTENDED_PARENT]: {
    id: 'u6',
    name: 'Michael & James Rivera',
    email: 'rivera.family@email.com',
    role: ROLES.INTENDED_PARENT,
    avatar: null,
  },
  [ROLES.MARKETING]: {
    id: 'u7',
    name: 'Casey Rivera',
    email: 'casey@abcsurrogacy.com',
    role: ROLES.MARKETING,
    avatar: null,
  },
}

const RoleContext = createContext(null)

export function RoleProvider({ children }) {
  const [currentRole, setCurrentRole] = useState(ROLES.MASTER_ADMIN)
  const [authUser, setAuthUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [portalBlocked, setPortalBlocked] = useState(false)
  const lastActivityKeyRef = useRef(null)

  // Listen for Supabase auth state changes
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const user = session.user
        const role = user.user_metadata?.role || ROLES.SURROGATE
        let displayName = user.user_metadata?.full_name || user.email
        let avatar = null

        // Enrich: fetch real name + profile photo
        try {
          if (supabase) {
            if (role === ROLES.INTENDED_PARENT) {
              // For IPs: get name from intake case (primary or partner)
              const ipCase = await findCaseByEmail(user.email)
              if (ipCase?.answers) {
                const a = ipCase.answers
                const isPrimary = ipCase.intake_type === 'ip' && user.email.toLowerCase() === (a.email || '').toLowerCase()
                if (isPrimary) {
                  displayName = [a.primaryFirstName, a.primaryLastName].filter(Boolean).join(' ') || displayName
                } else {
                  displayName = [a.ip2FirstName, a.ip2LastName].filter(Boolean).join(' ') || displayName
                }
              }
            } else {
              const profile = await fetchSurrogateProfileByEmail(user.email)
              if (profile?.profile_data?.personal?.firstName) {
                displayName = [profile.profile_data.personal.firstName, profile.profile_data.personal.lastName].filter(Boolean).join(' ')
              }
              if (profile?.profile_data?.personal?.profilePhotoUrl) {
                avatar = profile.profile_data.personal.profilePhotoUrl
              }
            }
            // For admins: load avatar from user preferences
            if (!avatar && [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.OFFICE_ADMIN].includes(role)) {
              try {
                const prefs = await getAppConfig(`user_prefs_${user.id}`)
                if (prefs?.avatarUrl) avatar = prefs.avatarUrl
              } catch {}
            }
          }
        } catch {}

        // Check if portal access is blocked (surrogates + IPs)
        if (role === ROLES.SURROGATE || role === ROLES.INTENDED_PARENT) {
          try {
            const checkRes = await fetch('/api/check-portal-access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: user.email }),
            })
            const checkData = await checkRes.json()
            if (checkData.blocked) {
              setPortalBlocked(true)
              await supabase.auth.signOut()
              setAuthLoading(false)
              return
            }
          } catch {}
        }

        setAuthUser({
          id: user.id,
          name: displayName,
          email: user.email,
          role,
          avatar,
        })
        setCurrentRole(role)
      }
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const user = session.user
        const role = user.user_metadata?.role || ROLES.SURROGATE

        // Check portal access for surrogates on every auth change
        if (role === ROLES.SURROGATE) {
          try {
            const checkRes = await fetch('/api/check-portal-access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: user.email }),
            })
            const checkData = await checkRes.json()
            if (checkData.blocked) {
              setPortalBlocked(true)
              await supabase.auth.signOut()
              return
            }
          } catch {}
        }

        setAuthUser({
          id: user.id,
          name: user.user_metadata?.full_name || user.email,
          email: user.email,
          role,
          avatar: null,
        })
        setCurrentRole(role)
      } else {
        setAuthUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    if (supabase) {
      await supabase.auth.signOut()
    }
    setAuthUser(null)
    setCurrentRole(ROLES.MASTER_ADMIN)
  }

  // ── Auto-logout on inactivity ──
  const idleTimer = useRef(null)
  const ADMIN_ROLES_SET = new Set([ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN, ROLES.ADMIN, ROLES.OFFICE_ADMIN])
  const ADMIN_TIMEOUT = 3 * 60 * 60 * 1000  // 3 hours
  const USER_TIMEOUT = 30 * 60 * 1000       // 30 minutes
  const getTimeoutMs = useCallback(() => ADMIN_ROLES_SET.has(currentRole) ? ADMIN_TIMEOUT : USER_TIMEOUT, [currentRole])

  const forceIdleLogout = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    const key = lastActivityKeyRef.current
    if (key) localStorage.removeItem(key)
    signOut()
    window.location.href = '/login?reason=idle'
  }, [])

  const resetIdleTimer = useCallback(() => {
    if (!authUser) return
    if (idleTimer.current) clearTimeout(idleTimer.current)
    const timeout = getTimeoutMs()
    const key = lastActivityKeyRef.current
    if (key) localStorage.setItem(key, String(Date.now()))
    idleTimer.current = setTimeout(() => {
      forceIdleLogout()
    }, timeout)
  }, [authUser, getTimeoutMs, forceIdleLogout])

  useEffect(() => {
    if (!authUser) return
    lastActivityKeyRef.current = `abc_last_activity_${authUser.id}`
    const checkForExpiredIdle = () => {
      const key = lastActivityKeyRef.current
      if (!key) return
      const raw = localStorage.getItem(key)
      const last = Number(raw || 0)
      if (last && Date.now() - last > getTimeoutMs()) {
        forceIdleLogout()
        return
      }
      resetIdleTimer()
    }

    const events = ['mousedown', 'keydown', 'touchstart']
    const handler = () => resetIdleTimer()
    events.forEach(e => window.addEventListener(e, handler, { passive: true }))
    window.addEventListener('focus', checkForExpiredIdle)
    document.addEventListener('visibilitychange', checkForExpiredIdle)
    resetIdleTimer() // start the timer
    return () => {
      events.forEach(e => window.removeEventListener(e, handler))
      window.removeEventListener('focus', checkForExpiredIdle)
      document.removeEventListener('visibilitychange', checkForExpiredIdle)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [authUser, getTimeoutMs, resetIdleTimer, forceIdleLogout])

  // Use auth user if logged in, otherwise fall back to mock user for dev
  const currentUser = authUser || MOCK_USERS[currentRole]

  const isAdmin = [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN, ROLES.OFFICE_ADMIN, ROLES.ADMIN].includes(currentRole)
  const isSuperAdmin = currentRole === ROLES.SUPER_ADMIN
  const isMasterAdmin = currentRole === ROLES.MASTER_ADMIN
  const isOfficeAdmin = currentRole === ROLES.OFFICE_ADMIN
  const isMarketing = currentRole === ROLES.MARKETING
  const canViewMarketing = [ROLES.MARKETING, ROLES.MASTER_ADMIN, ROLES.SUPER_ADMIN].includes(currentRole)
  const canEditSettings = [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN, ROLES.OFFICE_ADMIN].includes(currentRole)

  return (
    <RoleContext.Provider value={{
      currentRole,
      setCurrentRole,
      currentUser,
      authUser,
      authLoading,
      isAuthenticated: !!authUser,
      portalBlocked,
      isAdmin,
      isSuperAdmin,
      isMasterAdmin,
      isOfficeAdmin,
      isMarketing,
      canViewMarketing,
      canEditSettings,
      signOut,
      allUsers: MOCK_USERS,
    }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (!context) throw new Error('useRole must be used within RoleProvider')
  return context
}

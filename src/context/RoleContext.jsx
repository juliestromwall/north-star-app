import { createContext, useContext, useEffect, useState } from 'react'
import { ROLES } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { fetchSurrogateProfileByEmail } from '@/lib/db'

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

        // Enrich: fetch real name from intake_submissions + profile photo
        try {
          if (supabase) {
            const { data: intake } = await supabase.from('intake_submissions')
              .select('applicant_name')
              .eq('applicant_email', user.email.toLowerCase())
              .order('submitted_at', { ascending: false })
              .limit(1)
              .single()
            if (intake?.applicant_name) displayName = intake.applicant_name

            const profile = await fetchSurrogateProfileByEmail(user.email)
            if (profile?.profile_data?.personal?.profilePhotoUrl) {
              avatar = profile.profile_data.personal.profilePhotoUrl
            }
          }
        } catch {}

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const user = session.user
        const role = user.user_metadata?.role || ROLES.SURROGATE
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

  // Use auth user if logged in, otherwise fall back to mock user for dev
  const currentUser = authUser || MOCK_USERS[currentRole]

  const isAdmin = [ROLES.SUPER_ADMIN, ROLES.MASTER_ADMIN, ROLES.ADMIN].includes(currentRole)
  const isSuperAdmin = currentRole === ROLES.SUPER_ADMIN
  const isMasterAdmin = currentRole === ROLES.MASTER_ADMIN
  const isMarketing = currentRole === ROLES.MARKETING
  const canViewMarketing = [ROLES.MARKETING, ROLES.MASTER_ADMIN, ROLES.SUPER_ADMIN].includes(currentRole)

  return (
    <RoleContext.Provider value={{
      currentRole,
      setCurrentRole,
      currentUser,
      authUser,
      authLoading,
      isAuthenticated: !!authUser,
      isAdmin,
      isSuperAdmin,
      isMasterAdmin,
      isMarketing,
      canViewMarketing,
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

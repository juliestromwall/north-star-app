import { createContext, useContext, useState } from 'react'
import { ROLES } from '@/lib/constants'

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
    name: 'Julie Thompson',
    email: 'julie@abcsurrogacy.com',
    role: ROLES.MASTER_ADMIN,
    avatar: null,
  },
  [ROLES.ADMIN]: {
    id: 'u3',
    name: 'Sarah Mitchell',
    email: 'sarah@abcsurrogacy.com',
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

  const currentUser = MOCK_USERS[currentRole]

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
      isAdmin,
      isSuperAdmin,
      isMasterAdmin,
      isMarketing,
      canViewMarketing,
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

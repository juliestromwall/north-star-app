import { useRole } from '@/context/RoleContext'
import { ROLES } from '@/lib/constants'
import SurrogateProfilePage from './SurrogateProfilePage'
import IPProfilePage from './IPProfilePage'

export default function ProfileRouter() {
  const { currentRole } = useRole()

  if (currentRole === ROLES.INTENDED_PARENT) {
    return <IPProfilePage />
  }

  return <SurrogateProfilePage />
}

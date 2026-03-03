import { useRole } from '@/context/RoleContext'
import { ROLES } from '@/lib/constants'
import AdminDashboard from './AdminDashboard'
import SurrogateDashboard from './SurrogateDashboard'
import IPDashboard from './IPDashboard'
import PartnerDashboard from './PartnerDashboard'

export default function DashboardRouter() {
  const { currentRole } = useRole()

  switch (currentRole) {
    case ROLES.SUPER_ADMIN:
    case ROLES.MASTER_ADMIN:
    case ROLES.ADMIN:
      return <AdminDashboard />
    case ROLES.SURROGATE:
      return <SurrogateDashboard />
    case ROLES.INTENDED_PARENT:
      return <IPDashboard />
    case ROLES.SURROGATE_PARTNER:
      return <PartnerDashboard />
    default:
      return <AdminDashboard />
  }
}

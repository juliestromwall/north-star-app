import EmptyState from '@/components/shared/EmptyState'

export default function CaseCalendarWidget({ caseId, caseType }) {
  return <EmptyState title="Calendar" description="Upcoming appointments for this case." />
}

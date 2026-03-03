export const mockMatches = [
  { id: 'm1', surrogateId: 's1', ipId: 'ip1', stage: 'Active Pregnancy', startDate: '2025-08-20', dueDate: '2026-05-12' },
  { id: 'm2', surrogateId: 's2', ipId: 'ip2', stage: 'Transfer Prep', startDate: '2025-10-01', dueDate: null },
  { id: 'm3', surrogateId: 's3', ipId: 'ip3', stage: 'Medical Clearance', startDate: '2025-11-15', dueDate: null },
  { id: 'm4', surrogateId: 's5', ipId: 'ip4', stage: 'Match Confirmed', startDate: '2025-12-01', dueDate: null },
  { id: 'm5', surrogateId: 's6', ipId: 'ip5', stage: 'Introduction', startDate: '2026-01-20', dueDate: null },
  { id: 'm6', surrogateId: 's9', ipId: 'ip6', stage: 'Active Pregnancy', startDate: '2025-07-15', dueDate: '2026-03-28' },
  { id: 'm7', surrogateId: 's10', ipId: 'ip7', stage: 'Legal', startDate: '2025-11-20', dueDate: null },
]

export const matchPipelineCounts = {
  'Profile Review': 2,
  'Introduction': 1,
  'Meeting Scheduled': 0,
  'Meeting Complete': 0,
  'Match Confirmed': 1,
  'Legal': 1,
  'Medical Clearance': 1,
  'Transfer Prep': 1,
  'Active Pregnancy': 2,
  'Delivered': 0,
}

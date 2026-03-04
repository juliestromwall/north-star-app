// Mock data for the Time Clock feature
import { mockUsers } from './users'

export const STAFF = mockUsers

export const PAY_PERIODS = [
  { id: 'pp1', startDate: '2026-01-19', endDate: '2026-02-01', label: 'Jan 19 – Feb 1' },
  { id: 'pp2', startDate: '2026-02-02', endDate: '2026-02-15', label: 'Feb 2 – Feb 15' },
  { id: 'pp3', startDate: '2026-02-16', endDate: '2026-03-01', label: 'Feb 16 – Mar 1' },
  { id: 'pp4', startDate: '2026-03-02', endDate: '2026-03-15', label: 'Mar 2 – Mar 15' },
]

export function getCurrentPayPeriod() {
  const today = new Date().toISOString().slice(0, 10)
  return PAY_PERIODS.find((pp) => today >= pp.startDate && today <= pp.endDate) || PAY_PERIODS[PAY_PERIODS.length - 1]
}

export function calculateHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return 0
  const [inH, inM] = clockIn.split(':').map(Number)
  const [outH, outM] = clockOut.split(':').map(Number)
  return Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 100) / 100
}

export function formatTime12h(time24) {
  if (!time24) return '—'
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

// ~25 mock time entries across staff and pay periods
export const INITIAL_TIME_ENTRIES = [
  // PP1: Jan 19 – Feb 1
  { id: 't01', staffId: 'u2', date: '2026-01-19', clockIn: '08:55', clockOut: '17:10', status: 'approved' },
  { id: 't02', staffId: 'u2', date: '2026-01-20', clockIn: '09:02', clockOut: '17:05', status: 'approved' },
  { id: 't03', staffId: 'u3', date: '2026-01-19', clockIn: '09:00', clockOut: '17:00', status: 'approved' },
  { id: 't04', staffId: 'u3', date: '2026-01-21', clockIn: '08:45', clockOut: '16:50', status: 'approved' },
  { id: 't05', staffId: 'u4', date: '2026-01-20', clockIn: '09:15', clockOut: '17:30', status: 'approved' },
  { id: 't06', staffId: 'u5', date: '2026-01-22', clockIn: '08:30', clockOut: '16:45', status: 'approved' },

  // PP2: Feb 2 – Feb 15
  { id: 't07', staffId: 'u2', date: '2026-02-02', clockIn: '09:00', clockOut: '17:15', status: 'approved' },
  { id: 't08', staffId: 'u2', date: '2026-02-03', clockIn: '08:50', clockOut: '17:00', status: 'approved' },
  { id: 't09', staffId: 'u3', date: '2026-02-04', clockIn: '09:10', clockOut: '17:20', status: 'approved' },
  { id: 't10', staffId: 'u4', date: '2026-02-05', clockIn: '09:00', clockOut: '16:55', status: 'approved' },
  { id: 't11', staffId: 'u5', date: '2026-02-06', clockIn: '08:40', clockOut: '17:10', status: 'pending' },
  { id: 't12', staffId: 'u5', date: '2026-02-10', clockIn: '09:05', clockOut: '17:00', status: 'pending' },

  // PP3: Feb 16 – Mar 1
  { id: 't13', staffId: 'u2', date: '2026-02-16', clockIn: '09:00', clockOut: '17:00', status: 'approved' },
  { id: 't14', staffId: 'u2', date: '2026-02-18', clockIn: '08:45', clockOut: '17:15', status: 'pending' },
  { id: 't15', staffId: 'u3', date: '2026-02-17', clockIn: '09:00', clockOut: '17:05', status: 'pending' },
  { id: 't16', staffId: 'u3', date: '2026-02-20', clockIn: '09:20', clockOut: '17:30', status: 'pending' },
  { id: 't17', staffId: 'u4', date: '2026-02-19', clockIn: '08:55', clockOut: '16:50', status: 'approved' },
  { id: 't18', staffId: 'u5', date: '2026-02-23', clockIn: '09:00', clockOut: '17:00', status: 'pending' },

  // PP4: Mar 2 – Mar 15 (current period)
  { id: 't19', staffId: 'u2', date: '2026-03-02', clockIn: '08:50', clockOut: '17:05', status: 'pending' },
  { id: 't20', staffId: 'u2', date: '2026-03-03', clockIn: '09:00', clockOut: null, status: 'pending' },
  { id: 't21', staffId: 'u3', date: '2026-03-02', clockIn: '09:05', clockOut: '17:10', status: 'pending' },
  { id: 't22', staffId: 'u3', date: '2026-03-03', clockIn: '09:10', clockOut: null, status: 'pending' },
  { id: 't23', staffId: 'u4', date: '2026-03-02', clockIn: '09:00', clockOut: '17:00', status: 'pending' },
  { id: 't24', staffId: 'u5', date: '2026-03-02', clockIn: '08:45', clockOut: '16:55', status: 'pending' },
  { id: 't25', staffId: 'u5', date: '2026-03-03', clockIn: '08:30', clockOut: null, status: 'pending' },
]

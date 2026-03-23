// Mock data for the Time Clock feature
import { mockUsers } from './users'

export const STAFF = mockUsers

export const PAY_PERIODS = []

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

export const INITIAL_TIME_ENTRIES = []

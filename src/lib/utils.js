import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Format any date value to MM/DD/YYYY.
 * Accepts: Date object, ISO string, YYYY-MM-DD, or any parseable date string.
 * Returns '—' for null/undefined/invalid.
 */
export function formatDate(value) {
  if (!value) return '—'
  // If it's a YYYY-MM-DD string, parse without timezone shift
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${m}/${d}/${y}`
  }
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return '—'
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const y = date.getFullYear()
  return `${m}/${d}/${y}`
}

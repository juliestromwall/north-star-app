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

/**
 * Format a phone/fax number as the user types: 5551234567 → 555-123-4567.
 *
 * Intended for an input's onChange, so the dashes appear while typing and
 * backspace still works (removing the last digit re-renders without the
 * trailing dash).
 *
 * Anything that isn't a plain 10-digit US number is passed through untouched —
 * provider records routinely carry an extension ("555-123-4567 x22") or an
 * international number, and silently stripping those would lose the part of
 * the number that actually reaches the office.
 */
export function formatPhoneInput(value) {
  const raw = value == null ? '' : String(value)
  // Letters mean an extension or a note ("ext", "x22", "call front desk").
  if (/[a-zA-Z]/.test(raw)) return raw
  // A leading + means an international number with its own grouping rules.
  if (raw.trim().startsWith('+')) return raw

  const digits = raw.replace(/\D/g, '')
  // More than 10 digits is not a US number this format can describe; leave the
  // typing alone rather than truncating it.
  if (digits.length > 10) return raw

  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`

  const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 10) {
    // The number is complete, so keep anything typed after the last digit —
    // otherwise the space in "555-123-4567 x22" is swallowed on the keystroke
    // before the "x" arrives, and the extension ends up jammed against it.
    const tail = raw.match(/\d(\D*)$/)?.[1] ?? ''
    return formatted + tail
  }
  return formatted
}

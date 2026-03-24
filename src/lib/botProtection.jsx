import { useState, useRef, useCallback, useEffect } from 'react'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

// Minimum seconds a real human would take to complete the form
const MIN_FORM_TIME_SECONDS = 15

// Track rapid field changes — bots fill forms inhumanly fast
const RAPID_FILL_THRESHOLD_MS = 80  // < 80ms between field changes = suspicious
const RAPID_FILL_MAX_COUNT = 5       // 5+ rapid fills in a row = bot

/**
 * Hook that provides multi-layer bot protection for intake forms.
 *
 * Returns:
 * - honeypotProps: spread onto a hidden input
 * - trackFieldChange: call on every field update
 * - validateSubmission: call before submitting — returns { ok, reason }
 * - turnstileToken: the Turnstile token (null until solved)
 * - TurnstileWidget: component to render in the form
 * - HoneypotField: component to render (hidden from humans)
 */
export function useBotProtection(startTimeRef) {
  const [honeypotValue, setHoneypotValue] = useState('')
  const [turnstileToken, setTurnstileToken] = useState(null)
  const lastFieldChangeRef = useRef(Date.now())
  const rapidFillCountRef = useRef(0)
  const maxRapidFillRef = useRef(0)

  const trackFieldChange = useCallback(() => {
    const now = Date.now()
    const delta = now - lastFieldChangeRef.current
    if (delta < RAPID_FILL_THRESHOLD_MS) {
      rapidFillCountRef.current++
      if (rapidFillCountRef.current > maxRapidFillRef.current) {
        maxRapidFillRef.current = rapidFillCountRef.current
      }
    } else {
      rapidFillCountRef.current = 0
    }
    lastFieldChangeRef.current = now
  }, [])

  const validateSubmission = useCallback(() => {
    // 1. Honeypot check — bots fill hidden fields
    if (honeypotValue) {
      return { ok: false, reason: 'honeypot' }
    }

    // 2. Time-based check — form completed too fast
    const elapsed = (Date.now() - startTimeRef.current) / 1000
    if (elapsed < MIN_FORM_TIME_SECONDS) {
      return { ok: false, reason: 'too_fast' }
    }

    // 3. Rapid-fill detection — inhumanly fast field changes
    if (maxRapidFillRef.current >= RAPID_FILL_MAX_COUNT) {
      return { ok: false, reason: 'rapid_fill' }
    }

    // 4. Turnstile check — if configured, token must exist
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      return { ok: false, reason: 'turnstile_missing' }
    }

    return { ok: true, reason: null }
  }, [honeypotValue, turnstileToken, startTimeRef])

  return {
    honeypotValue,
    setHoneypotValue,
    trackFieldChange,
    validateSubmission,
    turnstileToken,
    setTurnstileToken,
  }
}

/**
 * Hidden honeypot field — invisible to humans, irresistible to bots.
 * Uses multiple layers of hiding so screen readers also skip it.
 */
export function HoneypotField({ value, onChange }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        width: 0,
        height: 0,
        overflow: 'hidden',
        opacity: 0,
        tabIndex: -1,
      }}
    >
      <label htmlFor="website_url">Website</label>
      <input
        type="text"
        id="website_url"
        name="website_url"
        autoComplete="off"
        tabIndex={-1}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

/**
 * Cloudflare Turnstile widget — only renders if VITE_TURNSTILE_SITE_KEY is set.
 * Loads the script on mount and renders the challenge.
 */
export function TurnstileWidget({ onToken }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return

    // Load Turnstile script if not already loaded
    const existingScript = document.querySelector('script[src*="turnstile"]')
    if (!existingScript) {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad'
      script.async = true
      document.head.appendChild(script)
    }

    function renderWidget() {
      if (!containerRef.current || widgetIdRef.current != null) return
      if (!window.turnstile) return

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => onToken(token),
        'error-callback': () => onToken(null),
        'expired-callback': () => onToken(null),
        theme: 'light',
        size: 'flexible',
      })
    }

    // If turnstile is already loaded, render immediately
    if (window.turnstile) {
      renderWidget()
    } else {
      // Otherwise wait for the onload callback
      window.onTurnstileLoad = renderWidget
    }

    return () => {
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [onToken])

  if (!TURNSTILE_SITE_KEY) return null

  return (
    <div ref={containerRef} className="flex justify-center my-2" />
  )
}

import { useState, useRef, useCallback, useEffect } from 'react'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

// Minimum seconds a real human would take to complete the form
const MIN_FORM_TIME_SECONDS = 15

// Track rapid field changes — bots fill forms inhumanly fast
const RAPID_FILL_THRESHOLD_MS = 30  // < 30ms between field changes = suspicious
const RAPID_FILL_MAX_COUNT = 10      // 10+ rapid fills in a row = bot
const MIN_FIELD_CHANGES = 4

function parseBrowser(ua) {
  const isIOS = /iphone|ipad|ipod/i.test(ua)
  if (/edg\//i.test(ua)) return 'Edge'
  if (isIOS && /crios|fxios|safari/i.test(ua)) return 'Safari'
  if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) return 'Chrome'
  if (/firefox|fxios/i.test(ua)) return 'Firefox'
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari'
  if (/opera|opr/i.test(ua)) return 'Opera'
  return 'Other'
}

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
  const fieldChangeCountRef = useRef(0)
  const browserRef = useRef(typeof navigator !== 'undefined' ? parseBrowser(navigator.userAgent || '') : 'Other')

  const trackFieldChange = useCallback(() => {
    fieldChangeCountRef.current++
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
    const elapsed = (Date.now() - startTimeRef.current) / 1000
    if (honeypotValue?.trim()) {
      return { ok: false, reason: 'honeypot' }
    }

    if (elapsed < MIN_FORM_TIME_SECONDS) {
      return { ok: false, reason: 'too_fast' }
    }

    if (maxRapidFillRef.current >= RAPID_FILL_MAX_COUNT) {
      return { ok: false, reason: 'rapid_fill' }
    }

    if (fieldChangeCountRef.current < MIN_FIELD_CHANGES) {
      return { ok: false, reason: 'too_few_interactions' }
    }

    if (TURNSTILE_SITE_KEY && browserRef.current !== 'Safari' && !turnstileToken) {
      return { ok: false, reason: 'turnstile_required' }
    }

    return { ok: true, reason: null }
  }, [honeypotValue, startTimeRef, turnstileToken])

  const getBotCheckPayload = useCallback(() => ({
    honeypotValue,
    turnstileToken,
    elapsedSeconds: Math.round((Date.now() - startTimeRef.current) / 1000),
    fieldChangeCount: fieldChangeCountRef.current,
    maxRapidFillCount: maxRapidFillRef.current,
    browser: browserRef.current,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent || '' : '',
  }), [honeypotValue, startTimeRef, turnstileToken])

  return {
    honeypotValue,
    setHoneypotValue,
    trackFieldChange,
    validateSubmission,
    turnstileToken,
    setTurnstileToken,
    getBotCheckPayload,
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
      <label htmlFor="abc_hp_field">Do not fill</label>
      <input
        type="text"
        id="abc_hp_field"
        name="abc_hp_field"
        autoComplete="new-password"
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

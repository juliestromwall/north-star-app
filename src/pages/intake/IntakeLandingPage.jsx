import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Heart, Lock, Shield, Star } from 'lucide-react'
import { useIframeHeightReporter } from '@/lib/embed'

function parseDevice(ua) {
  if (/tablet|ipad/i.test(ua)) return 'Tablet'
  if (/mobile|iphone|android.*mobile/i.test(ua)) return 'Mobile'
  return 'Desktop'
}
function parseBrowser(ua) {
  if (/edg\//i.test(ua)) return 'Edge'
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) return 'Chrome'
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari'
  if (/firefox/i.test(ua)) return 'Firefox'
  if (/opera|opr/i.test(ua)) return 'Opera'
  return 'Other'
}
function parseOS(ua) {
  if (/windows/i.test(ua)) return 'Windows'
  if (/mac os/i.test(ua)) return 'macOS'
  if (/iphone|ipad/i.test(ua)) return 'iOS'
  if (/android/i.test(ua)) return 'Android'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Other'
}
function captureTrackingParams(searchParams) {
  const fbclid = searchParams.get('fbclid')
  const ttclid = searchParams.get('ttclid')
  const utm_source = searchParams.get('utm_source')
  const ua = navigator.userAgent || ''
  const tracking = {
    utm_source,
    utm_medium: searchParams.get('utm_medium'),
    utm_campaign: searchParams.get('utm_campaign'),
    utm_content: searchParams.get('utm_content'),
    utm_term: searchParams.get('utm_term'),
    fbclid: fbclid || null,
    ttclid: ttclid || null,
    resolvedSource: utm_source || (fbclid ? 'facebook' : null) || (ttclid ? 'tiktok' : null) || 'direct',
    device: parseDevice(ua), browser: parseBrowser(ua), os: parseOS(ua),
    language: navigator.language || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    screenWidth: window.screen.width, screenHeight: window.screen.height,
    viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
    landingUrl: window.location.href, landedAt: new Date().toISOString(),
  }
  sessionStorage.setItem('intakeTrackingData', JSON.stringify(tracking))
}

export default function IntakeLandingPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  useIframeHeightReporter()

  useEffect(() => { captureTrackingParams(searchParams) }, [searchParams])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1F3A3C' }}>
      {/* Header */}
      <header className="flex items-center justify-center px-6 py-6 border-b border-white/10">
        <img src="/north-star-logo-white.png" alt="North Star Surrogacy" className="h-36 sm:h-44 w-auto" />
      </header>

      {/* Hero */}
      <div className="max-w-2xl mx-auto px-5 pt-16 pb-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6 text-[11px] font-semibold tracking-[0.25em] uppercase"
          style={{ backgroundColor: 'rgba(212, 168, 83, 0.18)', color: '#D4A853', border: '1px solid rgba(212, 168, 83, 0.35)' }}>
          <Star className="w-3.5 h-3.5" /> Begin Your Journey
        </span>
        <h1 className="text-4xl sm:text-5xl text-white leading-[1.15] font-light tracking-tight"
          style={{ fontFamily: "'Libre Franklin', sans-serif" }}>
          Ready to get started?
        </h1>
        <div className="mt-6 w-16 h-0.5 mx-auto rounded-full" style={{ backgroundColor: '#D4A853' }} />
        <p className="mt-7 text-base sm:text-lg text-white/80 leading-relaxed max-w-xl mx-auto">
          Whether you're hoping to grow your family or to help another family grow,
          we'd love to hear from you. Tell us a little about yourself and our team
          will reach out within 48 hours — no commitment, just a conversation.
        </p>
        <div className="flex items-center justify-center gap-6 mt-7 flex-wrap">
          {[
            { Icon: Lock, label: 'Private' },
            { Icon: Shield, label: 'Confidential' },
            { Icon: Heart, label: 'Trauma-informed' },
          ].map(({ Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-white/60 font-medium tracking-wide">
              <Icon className="w-3.5 h-3.5" /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* Two-card chooser */}
      <div className="max-w-3xl mx-auto px-5 pb-20 grid sm:grid-cols-2 gap-5">
        <PathCard
          onClick={() => navigate('/getstarted/surrogate')}
          eyebrow="For Surrogates"
          title="I'd like to be a surrogate"
          body="Help an intended family welcome a baby into the world. You'll be supported, respected, and well-compensated every step of the way."
        />
        <PathCard
          onClick={() => navigate('/getstarted/intendedparent')}
          eyebrow="For Intended Parents"
          title="I'm hoping to grow my family"
          body="Begin the path to parenthood with a trauma-informed agency built on lived experience and clinical insight."
        />
      </div>

      {/* Footer */}
      <footer className="py-7 text-center text-xs text-white/40 border-t border-white/10">
        © {new Date().getFullYear()} North Star Surrogacy · Guiding your path to parenthood
      </footer>
    </div>
  )
}

function PathCard({ onClick, eyebrow, title, body }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-2xl p-7 transition-all duration-200 hover:shadow-xl"
      style={{ background: 'rgba(255, 255, 255, 0.95)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] mb-4" style={{ color: '#D4A853' }}>{eyebrow}</p>
      <h2 className="text-xl mb-3 leading-snug" style={{ fontFamily: "'Libre Franklin', sans-serif", color: '#1A3638', fontWeight: 600 }}>
        {title}
      </h2>
      <p className="text-sm leading-relaxed mb-6" style={{ color: '#1A3638', opacity: 0.7 }}>
        {body}
      </p>
      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#1F3A3C' }}>
        Get started
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </div>
    </button>
  )
}

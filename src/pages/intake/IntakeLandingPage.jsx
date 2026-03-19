import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Clock, Lock, Shield } from 'lucide-react'

function captureTrackingParams(searchParams) {
  const fbclid = searchParams.get('fbclid')
  const ttclid = searchParams.get('ttclid')
  const utm_source = searchParams.get('utm_source')
  const tracking = {
    utm_source,
    utm_medium: searchParams.get('utm_medium'),
    utm_campaign: searchParams.get('utm_campaign'),
    utm_content: searchParams.get('utm_content'),
    utm_term: searchParams.get('utm_term'),
    fbclid: fbclid || null,
    ttclid: ttclid || null,
    resolvedSource:
      utm_source ||
      (fbclid ? 'facebook' : null) ||
      (ttclid ? 'tiktok' : null) ||
      'direct',
  }
  sessionStorage.setItem('intakeTrackingData', JSON.stringify(tracking))
}

const STATS = [
  { stat: '220+', label: 'Babies born' },
  { stat: '15+', label: 'Years of experience' },
  { stat: '98%', label: 'Client satisfaction' },
]

export default function IntakeLandingPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    captureTrackingParams(searchParams)
  }, [searchParams])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#faf8f5' }}>
      {/* Header */}
      <header className="flex items-center justify-center px-6 py-5 bg-white border-b border-stone-100">
        <img src="/abc-logo.png" alt="Abundant Beginnings Co." className="h-14 w-auto" />
      </header>

      {/* Hero */}
      <div className="max-w-2xl mx-auto px-5 pt-14 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-white border border-stone-200 rounded-full px-4 py-1.5 mb-6 text-xs text-stone-500 font-medium shadow-sm">
          <Clock className="w-3.5 h-3.5" />
          About 5 minutes · No commitment
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-stone-900 leading-tight mb-4">
          Could surrogacy be{' '}
          <span style={{ color: '#FFB3AB' }}>your next chapter?</span>
        </h1>
        <p className="text-stone-500 text-lg leading-relaxed max-w-lg mx-auto">
          Take our quick fit quiz and find out — whether you want to carry for a family or are ready to grow your own.
        </p>
        <div className="flex items-center justify-center gap-5 mt-5 flex-wrap">
          {[
            { Icon: Lock, label: 'Private' },
            { Icon: Shield, label: 'No commitment' },
          ].map(({ Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-stone-400 font-medium">
              <Icon className="w-3.5 h-3.5" />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Quiz entry cards */}
      <div className="max-w-2xl mx-auto px-5 pb-16 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* GC card */}
        <button
          type="button"
          onClick={() => navigate('/apply/surrogate')}
          className="group text-left bg-white rounded-2xl border-2 border-stone-200 hover:shadow-lg transition-all duration-200 p-7 flex flex-col"
          style={{ ['--hover-border']: '#FFB3AB' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#FFB3AB'}
          onMouseLeave={e => e.currentTarget.style.borderColor = ''}
        >
          <div className="text-4xl mb-4 select-none" aria-hidden>🤰</div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">
            I Want to Be a Surrogate
          </h2>
          <p className="text-sm text-stone-500 leading-relaxed flex-1 mb-6">
            Discover if you could help a loving family begin their journey — while earning $40,000–$60,000+ and being supported every step of the way.
          </p>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#FFB3AB' }}>
            Take the quiz
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        {/* IP card */}
        <button
          type="button"
          onClick={() => navigate('/apply/intended-parent')}
          className="group text-left bg-white rounded-2xl border-2 border-stone-200 hover:shadow-lg transition-all duration-200 p-7 flex flex-col"
          onMouseEnter={e => e.currentTarget.style.borderColor = '#464DA0'}
          onMouseLeave={e => e.currentTarget.style.borderColor = ''}
        >
          <div className="text-4xl mb-4 select-none" aria-hidden>👨‍👩‍👧</div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">
            We're Ready to Start a Family
          </h2>
          <p className="text-sm text-stone-500 leading-relaxed flex-1 mb-6">
            See if surrogacy with Abundant Beginnings is the right fit for your family's journey — and get personalized next steps.
          </p>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#464DA0' }}>
            Take the quiz
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </button>
      </div>

      {/* Trust bar */}
      <div className="border-t border-stone-200 bg-white py-10">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-7">
            Why families choose Abundant Beginnings
          </p>
          <div className="grid grid-cols-3 gap-6">
            {STATS.map(({ stat, label }) => (
              <div key={label}>
                <div className="text-2xl sm:text-3xl font-bold" style={{ color: '#FFB3AB' }}>{stat}</div>
                <div className="text-xs text-stone-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-stone-400">
        © {new Date().getFullYear()} Abundant Beginnings Co. ·{' '}
        <a href="#" className="underline hover:text-stone-600">Privacy Policy</a>
      </footer>
    </div>
  )
}

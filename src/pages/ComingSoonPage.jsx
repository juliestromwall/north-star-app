import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #fdf8f3 0%, #f0f1fa 100%)' }}>
      <div className="max-w-lg w-full text-center space-y-8">
        <img src="/abc-logo.png" alt="Abundant Beginnings Co." className="h-20 w-auto mx-auto" />

        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
            <span style={{ color: '#283693' }}>Something</span>{' '}
            <span style={{ color: '#ed148c' }}>beautiful</span>{' '}
            <span style={{ color: '#283693' }}>is coming.</span>
          </h1>
          <p className="text-lg text-stone-500 leading-relaxed">
            We're building the future of surrogacy management. Our new platform is almost ready.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild className="gap-2 rounded-xl px-6 h-12 text-base" style={{ backgroundColor: '#ed148c', color: '#fff' }}>
            <Link to="/surrogatequiz">
              Apply as a Surrogate <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2 rounded-xl px-6 h-12 text-base border-[#283693] text-[#283693]">
            <Link to="/login">
              Team Login
            </Link>
          </Button>
        </div>

        <p className="text-sm text-stone-400">
          Questions? Reach us at{' '}
          <a href="mailto:info@abcsurrogacy.com" className="text-[#283693] underline font-medium">
            info@abcsurrogacy.com
          </a>
        </p>
      </div>
    </div>
  )
}

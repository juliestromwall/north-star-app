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
            Big things are on the way. We can't wait to share them with you.
          </p>
        </div>
      </div>
    </div>
  )
}

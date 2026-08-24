import { useParams } from 'react-router-dom'
import {
  Briefcase, Globe, Church, Users, DollarSign, Copy, Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import PhotoGallery from '@/components/shared/PhotoGallery'
import { mockIntendedParents } from '@/data/mock/intendedParents'

function getPrivacyNames(fullNames) {
  // "Michael & James Rivera" → "Michael & James R."
  // "David Chen" → "David C."
  const parts = fullNames.trim().split(' ')
  const lastName = parts[parts.length - 1]
  const lastInitial = lastName[0] + '.'

  const ampIdx = parts.indexOf('&')
  if (ampIdx !== -1) {
    const firstNames = parts.slice(0, ampIdx + 2).join(' ')
    return firstNames.replace(parts[ampIdx + 1], parts[ampIdx + 1]) + ' ' + lastInitial
  }
  return `${parts[0]} ${lastInitial}`
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl bg-white shadow-sm border border-border p-6 space-y-4">
      <h2 className="text-lg font-heading font-semibold text-abc-navy">{title}</h2>
      {children}
    </div>
  )
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="size-9 rounded-full bg-abc-indigo/10 flex items-center justify-center shrink-0">
        <Icon className="size-4 text-abc-indigo" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

export default function IPSharePage() {
  const { id } = useParams()
  const ip = mockIntendedParents.find(p => p.id === id)

  if (!ip) {
    return (
      <div className="min-h-screen bg-abc-cream flex items-center justify-center">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    )
  }

  const privacyNames = getPrivacyNames(ip.names)

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
  }

  const handleDownloadPDF = () => {
    window.print()
  }

  // Build a natural-language preferences description
  const prefParts = []
  if (ip.preferences.surrogateAge) prefParts.push(`aged ${ip.preferences.surrogateAge}`)
  if (ip.preferences.surrogateLocation && ip.preferences.surrogateLocation !== 'Any US state') {
    prefParts.push(`located in the ${ip.preferences.surrogateLocation.replace(' preferred', '').toLowerCase()}`)
  }
  if (ip.preferences.experiencedPreferred) prefParts.push('with previous surrogacy experience')
  if (ip.preferences.openToMultiples) prefParts.push('and are open to multiples')

  const prefDescription = prefParts.length
    ? `They are looking for a surrogate ${prefParts.join(', ')}.`
    : null

  return (
    <div className="min-h-screen bg-abc-cream">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-border print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src="/first-star-logo.png" alt="First Star Surrogacy" className="h-8" />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyLink}>
              <Copy className="size-3.5" /> Copy Link
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleDownloadPDF}>
              <Download className="size-3.5" /> Download PDF
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Photo Gallery */}
        <PhotoGallery photos={ip.photos} mode="hero" />

        {/* Names & Bio */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-heading font-bold text-abc-navy">
            Meet {privacyNames}
          </h1>
          <p className="text-muted-foreground">
            Ages {ip.ages} &middot; {ip.location}
          </p>
          <p className="text-base italic text-abc-navy/80 max-w-xl mx-auto mt-3">
            "{ip.bio}"
          </p>
        </div>

        {/* About Us */}
        <Section title="About Us">
          <div className="grid grid-cols-2 gap-4">
            <InfoTile icon={Users} label="Family Type" value={ip.type} />
            <InfoTile icon={Globe} label="Ethnicity" value={ip.ethnicity} />
            <InfoTile icon={Church} label="Religion" value={ip.religion} />
            <InfoTile icon={Briefcase} label="Occupation" value={ip.occupation} />
          </div>
        </Section>

        {/* What We're Looking For */}
        {prefDescription && (
          <Section title="What We're Looking For">
            <p className="text-sm leading-relaxed text-abc-navy/80">{prefDescription}</p>
          </Section>
        )}

        {/* Budget Range */}
        <Section title="Budget Range">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-abc-indigo/10 flex items-center justify-center">
              <DollarSign className="size-4 text-abc-indigo" />
            </div>
            <span className="text-lg font-heading font-semibold text-abc-navy">{ip.budget}</span>
          </div>
        </Section>

        {/* Footer */}
        <div className="text-center py-8 space-y-3">
          <img src="/first-star-logo.png" alt="First Star Surrogacy" className="h-6 mx-auto opacity-60" />
          <p className="text-sm text-muted-foreground">
            Interested in learning more? <span className="font-medium text-abc-indigo">Contact your coordinator at First Star Surrogacy.</span>
          </p>
        </div>
      </main>
    </div>
  )
}

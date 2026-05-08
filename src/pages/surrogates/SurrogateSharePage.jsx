import { useParams } from 'react-router-dom'
import {
  GraduationCap, Briefcase, Heart, Baby, Ruler, Weight,
  Droplets, Activity, Shield, CheckCircle2, Copy, Download, Users, User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import PhotoGallery from '@/components/shared/PhotoGallery'
import { mockSurrogates } from '@/data/mock/surrogates'

function getPrivacyName(fullName) {
  const parts = fullName.trim().split(' ')
  if (parts.length < 2) return fullName
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl bg-white shadow-sm border border-border p-6 space-y-4">
      <h2 className="text-lg font-heading font-semibold text-abc-navy">{title}</h2>
      {children}
    </div>
  )
}

function StatBox({ label, value, icon: Icon }) {
  return (
    <div className="flex flex-col items-center text-center p-4 rounded-lg bg-abc-cream/60">
      {Icon && <Icon className="size-5 text-abc-indigo mb-1.5" />}
      <span className="text-lg font-heading font-bold text-abc-navy">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
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

function Pill({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-abc-indigo/10 text-abc-indigo text-sm font-medium px-3 py-1">
      {children}
    </span>
  )
}

export default function SurrogateSharePage() {
  const { id } = useParams()
  const surrogate = mockSurrogates.find(s => s.id === id)

  if (!surrogate) {
    return (
      <div className="min-h-screen bg-abc-cream flex items-center justify-center">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    )
  }

  const privacyName = getPrivacyName(surrogate.name)
  const allCleared = Object.values(surrogate.screening).every(s => s === 'cleared')

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
  }

  const handleDownloadPDF = () => {
    window.print()
  }

  const preferences = []
  if (surrogate.preferences.willingToCarryMultiples) preferences.push('Open to Multiples')
  if (surrogate.preferences.openToSameSex) preferences.push('Open to Same-Sex Couples')
  if (surrogate.preferences.openToSingleParent) preferences.push('Open to Single Parents')

  return (
    <div className="min-h-screen bg-abc-cream">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-border print:hidden">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src="/north-star-logo.png" alt="North Star Surrogacy" className="h-8" />
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
        <PhotoGallery photos={surrogate.photos} mode="hero" />

        {/* Name & Bio */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-heading font-bold text-abc-navy">
            Meet {privacyName}
          </h1>
          <p className="text-muted-foreground">
            {surrogate.age} years old &middot; {surrogate.location}
          </p>
          <p className="text-base italic text-abc-navy/80 max-w-xl mx-auto mt-3">
            "{surrogate.bio}"
          </p>
        </div>

        {/* About Me */}
        <Section title="About Me">
          <div className="grid grid-cols-2 gap-4">
            <InfoTile icon={GraduationCap} label="Education" value={surrogate.education} />
            <InfoTile icon={Briefcase} label="Occupation" value={surrogate.occupation} />
            <InfoTile icon={Heart} label="Marital Status" value={surrogate.maritalStatus} />
            <InfoTile icon={Baby} label="Children" value={`${surrogate.children.length} child${surrogate.children.length !== 1 ? 'ren' : ''}`} />
          </div>
        </Section>

        {/* Surrogacy Experience */}
        <Section title="Surrogacy Experience">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-abc-coral/20 text-abc-navy text-sm font-medium px-4 py-2">
              {surrogate.previousJourneys > 0
                ? `${surrogate.previousJourneys} Previous Journey${surrogate.previousJourneys > 1 ? 's' : ''}`
                : 'First-Time Surrogate'}
            </span>
            {allCleared && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 text-green-800 text-sm font-medium px-4 py-2">
                <CheckCircle2 className="size-4" /> All Screenings Cleared
              </span>
            )}
          </div>
        </Section>

        {/* Preferences */}
        {preferences.length > 0 && (
          <Section title="Preferences">
            <div className="flex flex-wrap gap-2">
              {preferences.map(pref => (
                <Pill key={pref}>{pref}</Pill>
              ))}
            </div>
          </Section>
        )}

        {/* Medical Snapshot */}
        <Section title="Medical Snapshot">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox icon={Ruler} label="Height" value={surrogate.height} />
            <StatBox icon={Weight} label="Weight" value={surrogate.weight} />
            <StatBox icon={Activity} label="BMI" value={surrogate.bmi} />
            <StatBox icon={Droplets} label="Blood Type" value={surrogate.bloodType} />
          </div>
        </Section>

        {/* Insurance */}
        <Section title="Insurance">
          <div className="flex items-center gap-2">
            {surrogate.insurance.hasSurrogacyCoverage ? (
              <>
                <CheckCircle2 className="size-5 text-green-600" />
                <span className="text-sm font-medium">Has surrogacy-friendly insurance</span>
              </>
            ) : (
              <>
                <Shield className="size-5 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Insurance does not cover surrogacy</span>
              </>
            )}
          </div>
        </Section>

        {/* Footer */}
        <div className="text-center py-8 space-y-3">
          <img src="/north-star-logo.png" alt="North Star Surrogacy" className="h-6 mx-auto opacity-60" />
          <p className="text-sm text-muted-foreground">
            Interested in learning more? <span className="font-medium text-abc-indigo">Contact your coordinator at North Star Surrogacy.</span>
          </p>
        </div>
      </main>
    </div>
  )
}

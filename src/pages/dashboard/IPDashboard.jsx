import { useState, useEffect } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Heart, FileText, ArrowRight, Loader2, User, Mail, Phone, MapPin, CheckCircle2, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { findCaseByEmail } from '@/lib/db'

export default function IPDashboard() {
  const { currentUser } = useRole()
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser?.email) { setLoading(false); return }
    findCaseByEmail(currentUser.email).then(data => {
      if (data) setCaseData(data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [currentUser?.email])

  const firstName = currentUser?.name?.split(' ')[0] || 'there'
  const a = caseData?.answers || {}
  const hasPartner = a.hasPartner === true || a.hasPartner === 'yes'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-stone-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${firstName}`}
        subtitle="Your family-building journey with ABC Surrogacy"
      />

      {/* Status Banner */}
      <Card className="bg-gradient-to-r from-[#283693] to-[#4a4fbf] text-white">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-full bg-white/20 flex items-center justify-center">
              <Heart className="size-7" />
            </div>
            <div>
              <p className="text-lg font-heading font-bold">Welcome to Your Portal</p>
              <p className="text-white/80">We're here to support you every step of the way.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Case Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="size-4" /> Your Information</CardTitle>
          </CardHeader>
          <CardContent>
            {caseData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-stone-400 uppercase">Primary</p>
                  <div className="flex items-center gap-2 text-sm"><User className="size-3.5 text-stone-400" /> {[a.primaryFirstName, a.primaryLastName].filter(Boolean).join(' ') || '—'}</div>
                  <div className="flex items-center gap-2 text-sm"><Mail className="size-3.5 text-stone-400" /> {a.email || '—'}</div>
                  <div className="flex items-center gap-2 text-sm"><Phone className="size-3.5 text-stone-400" /> {a.phone || '—'}</div>
                </div>
                {hasPartner && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-stone-400 uppercase">Partner</p>
                    <div className="flex items-center gap-2 text-sm"><User className="size-3.5 text-stone-400" /> {[a.ip2FirstName, a.ip2LastName].filter(Boolean).join(' ') || '—'}</div>
                    <div className="flex items-center gap-2 text-sm"><Mail className="size-3.5 text-stone-400" /> {a.ip2Email || '—'}</div>
                    <div className="flex items-center gap-2 text-sm"><Phone className="size-3.5 text-stone-400" /> {a.ip2Phone || '—'}</div>
                  </div>
                )}
                {(a.city || a.stateProv || a.country) && (
                  <div className="flex items-center gap-2 text-sm sm:col-span-2 pt-2 border-t border-stone-100">
                    <MapPin className="size-3.5 text-stone-400" /> {[a.city, a.stateProv, a.country].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-stone-400 text-center py-6">No case data found. Please contact the agency if you need assistance.</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2" asChild>
                  <Link to="/my-documents">
                    <FileText className="size-4" /> My Documents
                    <ArrowRight className="size-4 ml-auto" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Coordinator */}
          {caseData?.assigned_to && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Your Coordinator</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-[#283693]/10 flex items-center justify-center">
                    <User className="size-5 text-[#283693]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{caseData.assigned_to}</p>
                    <a href={`mailto:${caseData.assigned_to}`} className="text-xs text-[#283693] hover:underline">{caseData.assigned_to}</a>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-stone-50 border-dashed">
            <CardContent className="py-6 text-center">
              <p className="text-sm text-stone-500">Need help? Contact us at</p>
              <a href="mailto:info@abcsurrogacy.com" className="text-sm font-semibold text-[#283693] hover:underline">info@abcsurrogacy.com</a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

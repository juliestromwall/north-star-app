import { useState, useEffect } from 'react'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { User, Mail, Phone, MapPin, Heart, Loader2, Baby, Stethoscope } from 'lucide-react'
import { findCaseByEmail } from '@/lib/db'

export default function IPProfilePage() {
  const { currentUser } = useRole()
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser?.email) { setLoading(false); return }
    findCaseByEmail(currentUser.email).then(data => {
      if (data) setCaseData(data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [currentUser?.email])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-stone-400" />
      </div>
    )
  }

  const a = caseData?.answers || {}
  const hasPartner = a.hasPartner === true || a.hasPartner === 'yes'

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Your information on file with ABC Surrogacy"
      />

      <div className="max-w-3xl space-y-6">
        {/* Primary Parent */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="size-4" /> Primary Parent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name" value={[a.primaryFirstName, a.primaryLastName].filter(Boolean).join(' ')} />
              <Field label="Date of Birth" value={a.primaryDob} />
              <Field label="Email" value={a.email} />
              <Field label="Phone" value={a.phone ? `${a.phoneCountry || ''} ${a.phone}`.trim() : ''} />
            </div>
          </CardContent>
        </Card>

        {/* Partner */}
        {hasPartner && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Heart className="size-4 text-pink-500" /> Partner</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name" value={[a.ip2FirstName, a.ip2LastName].filter(Boolean).join(' ')} />
                <Field label="Date of Birth" value={a.ip2Dob} />
                <Field label="Email" value={a.ip2Email} />
                <Field label="Phone" value={a.ip2Phone ? `${a.ip2PhoneCountry || ''} ${a.ip2Phone}`.trim() : ''} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Location */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="size-4" /> Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Country" value={a.country} />
              <Field label="City" value={a.city} />
              <Field label="State / Province" value={a.stateProv} />
              <Field label="Zip / Postal Code" value={a.zipCode} />
              {a.street && <Field label="Street Address" value={[a.street, a.street2].filter(Boolean).join(', ')} className="sm:col-span-2" />}
            </div>
          </CardContent>
        </Card>

        {/* Fertility */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Stethoscope className="size-4" /> Fertility Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Working with an RE?" value={a.hasRE === true ? 'Yes' : a.hasRE === false ? 'No' : '—'} />
              {a.hasRE && <Field label="RE Doctor" value={a.reDoctorName} />}
              <Field label="Frozen Embryos?" value={a.hasFrozenEmbryos === true ? 'Yes' : a.hasFrozenEmbryos === false ? 'No' : '—'} />
              {a.hasFrozenEmbryos && <Field label="Details" value={a.frozenEmbryoDetails} />}
              <Field label="Using Egg Donor?" value={a.usingEggDonor === true ? 'Yes' : a.usingEggDonor === false ? 'No' : '—'} />
              <Field label="Using Sperm Donor?" value={a.usingSpermDonor === true ? 'Yes' : a.usingSpermDonor === false ? 'No' : '—'} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-stone-50 border-dashed rounded-2xl">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-stone-500">Need to update your information? Contact us at</p>
            <a href="mailto:info@abcsurrogacy.com" className="text-sm font-semibold text-[#283693] hover:underline">info@abcsurrogacy.com</a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Field({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-0.5">{label}</p>
      <p className="text-sm text-stone-800">{value || '—'}</p>
    </div>
  )
}

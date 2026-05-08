import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function ProviderRow({ label, name, details }) {
  if (!name && !details) return (
    <div className="py-2.5 px-3">
      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-sm text-stone-300 italic">Not set</p>
    </div>
  )
  return (
    <div className="py-2.5 px-3">
      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-sm font-medium text-stone-800">{name || '—'}</p>
      {details && <p className="text-xs text-stone-500 mt-0.5">{details}</p>}
    </div>
  )
}

export default function ProviderInfoButton({ journeyData = {}, gcInsurance, compact = false }) {
  const [open, setOpen] = useState(false)
  const jd = journeyData

  const providers = [
    {
      label: 'IVF Clinic',
      name: jd.ivfClinic,
      details: [jd.ivfDoctor && `Dr. ${jd.ivfDoctor}`, jd.ivfCoordinator && `Coord: ${jd.ivfCoordinator}`, [jd.ivfCity, jd.ivfState].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    },
    {
      label: 'Monitoring Clinic',
      name: jd.monitoringClinic,
      details: [jd.monitoringDoctor && `Dr. ${jd.monitoringDoctor}`, jd.monitoringPhone, [jd.monitoringCity, jd.monitoringState].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    },
    { type: 'divider' },
    {
      label: 'IP Attorney',
      name: jd.ipAttorneyName,
      details: [jd.ipAttorneyEmail, jd.ipAttorneyPhone, jd.ipAttorneyFirm].filter(Boolean).join(' · '),
    },
    {
      label: 'GC Attorney',
      name: jd.gcAttorneyName,
      details: [jd.gcAttorneyEmail, jd.gcAttorneyPhone, jd.gcAttorneyFirm].filter(Boolean).join(' · '),
    },
    { type: 'divider' },
    {
      label: 'Escrow Company',
      name: jd.escrowCompany || 'SeedTrust Escrow, LLC',
      details: null,
    },
    {
      label: 'Insurance Company',
      name: gcInsurance?.company || gcInsurance?.insurance_company || '',
      details: gcInsurance?.plan_name || '',
    },
    { type: 'divider' },
    {
      label: 'OB Clinic',
      name: jd.obClinic,
      details: [jd.obDoctor && `Dr. ${jd.obDoctor}`, jd.obPhone, [jd.obCity, jd.obState].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    },
    {
      label: 'MFM Clinic',
      name: jd.mfmClinic || '',
      details: [jd.mfmDoctor && `Dr. ${jd.mfmDoctor}`, jd.mfmPhone].filter(Boolean).join(' · '),
    },
    {
      label: 'Delivery Hospital',
      name: jd.deliveryHospital,
      details: [jd.deliveryHospitalPhone, [jd.deliveryHospitalCity, jd.deliveryHospitalState].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
    },
  ]

  if (compact) {
    return (
      <>
        <button onClick={() => setOpen(true)} title="Provider Information" className="text-stone-400 hover:text-[#1A3638] transition-colors">
          <Building2 className="size-3.5" />
        </button>
        <ProviderDialog open={open} onOpenChange={setOpen} providers={providers} />
      </>
    )
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title="Provider Information" className="text-stone-400 hover:text-[#1A3638] transition-colors">
        <Building2 className="size-3.5" />
      </button>
      <ProviderDialog open={open} onOpenChange={setOpen} providers={providers} />
    </>
  )
}

function ProviderDialog({ open, onOpenChange, providers }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[75vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-stone-400" /> Provider Information
          </DialogTitle>
        </DialogHeader>
        <div className="divide-y divide-stone-100">
          {providers.map((p, i) =>
            p.type === 'divider' ? <div key={i} className="h-px" /> : <ProviderRow key={i} label={p.label} name={p.name} details={p.details} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

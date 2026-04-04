import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ChevronDown, Heart, Calendar, DollarSign, Scale, Stethoscope, Hospital, FileText } from 'lucide-react'
import { RichTextDisplay } from '@/components/shared/RichTextEditor'
import { formatDate } from '@/lib/utils'

export default function PreviousMatchTab({ matchHistory }) {
  if (!matchHistory || matchHistory.length === 0) return null

  return (
    <div className="space-y-4">
      {matchHistory.map((match, idx) => (
        <PreviousMatchCard key={idx} match={match} index={idx} total={matchHistory.length} />
      ))}
    </div>
  )
}

function PreviousMatchCard({ match, index, total }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(total === 1) // auto-open if only one
  const jd = match.journeyData || {}

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <button onClick={() => setDetailsOpen(!detailsOpen)} className="flex items-center justify-between w-full text-left">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="size-4 text-stone-400" />
            Previous Match — {match.partnerName || 'Unknown'}
          </CardTitle>
          <div className="flex items-center gap-3 text-xs text-stone-400">
            <span>Matched {formatDate(match.matchCreated)} — Broken {formatDate(match.brokenAt)}</span>
            <ChevronDown className={`size-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>
      </CardHeader>

      {detailsOpen && (
        <CardContent className="space-y-4">
          {/* Break info */}
          <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm">
            <p className="text-red-700 font-medium">Broken by {match.brokenBy}</p>
            <p className="text-red-600 text-xs mt-1">{match.reason}</p>
          </div>

          {/* Journey details */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-stone-400 text-xs">Stage at Break</span>
              <p className="font-medium">{match.stage || '—'}</p>
            </div>
            <div>
              <span className="text-stone-400 text-xs">Assigned To</span>
              <p className="font-medium">{match.assignedTo || '—'}</p>
            </div>
          </div>

          {/* Financial */}
          {(jd.escrowMin || jd.escrowBalance) && (
            <div className="space-y-1">
              <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-1"><DollarSign className="size-3" /> Escrow</p>
              <div className="flex gap-4 text-sm">
                {jd.escrowMin && <span className="text-stone-500">Min: <span className="font-medium text-stone-700">{jd.escrowMin}</span></span>}
                {jd.escrowBalance && <span className="text-stone-500">Balance: <span className="font-medium text-stone-700">{jd.escrowBalance}</span></span>}
              </div>
            </div>
          )}

          {/* Providers */}
          {(jd.ivfClinic || jd.obClinic || jd.deliveryHospital) && (
            <div className="space-y-1">
              <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Providers</p>
              <div className="flex flex-wrap gap-4 text-sm">
                {jd.ivfClinic && <span className="text-stone-600"><Stethoscope className="size-3 inline mr-1" />{jd.ivfClinic}{jd.ivfDoctor ? ` — Dr. ${jd.ivfDoctor}` : ''}</span>}
                {jd.obClinic && <span className="text-stone-600"><Stethoscope className="size-3 inline mr-1" />{jd.obClinic}{jd.obDoctor ? ` — Dr. ${jd.obDoctor}` : ''}</span>}
                {jd.deliveryHospital && <span className="text-stone-600"><Hospital className="size-3 inline mr-1" />{jd.deliveryHospital}</span>}
              </div>
            </div>
          )}

          {/* Attorneys */}
          {(jd.gcAttorneyName || jd.ipAttorneyName) && (
            <div className="space-y-1">
              <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold flex items-center gap-1"><Scale className="size-3" /> Attorneys</p>
              <div className="flex flex-wrap gap-4 text-sm">
                {jd.gcAttorneyName && <span className="text-stone-600">GC: {jd.gcAttorneyName}{jd.gcAttorneyFirm ? ` (${jd.gcAttorneyFirm})` : ''}</span>}
                {jd.ipAttorneyName && <span className="text-stone-600">IP: {jd.ipAttorneyName}{jd.ipAttorneyFirm ? ` (${jd.ipAttorneyFirm})` : ''}</span>}
              </div>
            </div>
          )}

          {/* Other info */}
          <div className="flex gap-4 text-sm text-stone-500">
            {jd.lostWages && <span>Lost Wages: <span className="font-medium text-stone-700">{jd.lostWages === 'yes' ? 'Yes' : 'No'}</span></span>}
            {jd.pumping && <span>Pumping: <span className="font-medium text-stone-700">{jd.pumping === 'yes' ? 'Yes' : 'No'}</span></span>}
          </div>

          {/* Notes */}
          {match.notes?.length > 0 && (
            <div className="space-y-2">
              <button onClick={() => setNotesOpen(!notesOpen)}
                className="flex items-center gap-1.5 text-xs font-semibold text-stone-400 uppercase tracking-wider hover:text-stone-600">
                <FileText className="size-3" /> Journey Notes ({match.notes.length})
                <ChevronDown className={`size-3 transition-transform ${notesOpen ? 'rotate-180' : ''}`} />
              </button>
              {notesOpen && (
                <div className="space-y-2 pl-4 border-l-2 border-stone-100">
                  {match.notes.map((note, i) => (
                    <div key={i} className="text-sm">
                      <div className="flex items-center gap-2 text-xs text-stone-400 mb-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${note.type === 'gc' ? 'bg-pink-500' : note.type === 'ip' ? 'bg-[#283693]' : 'bg-stone-500'}`}>
                          {note.type === 'gc' ? 'GC' : note.type === 'ip' ? 'IP' : 'SHARED'}
                        </span>
                        <span>{note.by}</span>
                        <span>{formatDate(note.at)}</span>
                      </div>
                      <RichTextDisplay content={note.content} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Checklist history */}
          {match.checklistHistory?.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Completed Checklists</p>
              <div className="flex flex-wrap gap-2">
                {match.checklistHistory.map((snap, i) => (
                  <span key={i} className="text-xs bg-stone-100 text-stone-600 rounded-full px-2.5 py-1">
                    {snap.stageLabel} — {formatDate(snap.completedAt)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

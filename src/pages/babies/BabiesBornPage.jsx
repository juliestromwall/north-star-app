import { useState, useEffect } from 'react'
import { Baby, Heart, Plus, Pencil, Check, X, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import PageHeader from '@/components/shared/PageHeader'
import { getAppConfig, setAppConfig } from '@/lib/db'

const STORAGE_KEY = 'abc_babies_born'
const SUPABASE_KEY = 'babies_born'

// Historical data from North Star Surrogacy spreadsheet
const DEFAULT_DATA = {
  startDate: '5/2013',
  years: [
    { year: 2014, births: 4, twins: 0, notes: '' },
    { year: 2015, births: 11, twins: 0, notes: '' },
    { year: 2016, births: 15, twins: 0, notes: '' },
    { year: 2017, births: 13, twins: 2, notes: '' },
    { year: 2018, births: 23, twins: 3, notes: '' },
    { year: 2019, births: 22, twins: 0, notes: '' },
    { year: 2020, births: 16, twins: 0, notes: '' },
    { year: 2021, births: 24, twins: 1, notes: '' },
    { year: 2022, births: 10, twins: 1, notes: '' },
    { year: 2023, births: 16, twins: 0, notes: '' },
    { year: 2024, births: 34, twins: 1, notes: '' },
    { year: 2025, births: 28, twins: 0, notes: '' },
    { year: 2026, births: 6, twins: 0, notes: '' },
  ],
  currentPregnant: 13,
}

function loadFromLS() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveToLS(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

function saveData(data) {
  saveToLS(data)
  setAppConfig(SUPABASE_KEY, data).catch(() => {})
}

export default function BabiesBornPage() {
  const [data, setData] = useState(() => loadFromLS() || DEFAULT_DATA)

  // Load from Supabase on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const remote = await getAppConfig(SUPABASE_KEY)
        if (cancelled) return
        if (remote) {
          setData(remote)
          saveToLS(remote)
          try { localStorage.removeItem(STORAGE_KEY) } catch {}
        } else {
          // Migration: push current data to Supabase
          const local = loadFromLS()
          const toSave = local || DEFAULT_DATA
          setAppConfig(SUPABASE_KEY, toSave).catch(() => {})
          if (local) {
            try { localStorage.removeItem(STORAGE_KEY) } catch {}
          }
        }
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [])
  const [editingYear, setEditingYear] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editPregnant, setEditPregnant] = useState(false)
  const [pregnantVal, setPregnantVal] = useState(data.currentPregnant)

  const totalBirths = data.years.reduce((sum, y) => sum + (y.births || 0), 0)

  function startEdit(yearData) {
    setEditForm({ births: yearData.births, twins: yearData.twins, notes: yearData.notes || '' })
    setEditingYear(yearData.year)
  }

  function saveEdit() {
    const updated = {
      ...data,
      years: data.years.map(y =>
        y.year === editingYear
          ? { ...y, births: parseInt(editForm.births) || 0, twins: parseInt(editForm.twins) || 0, notes: editForm.notes }
          : y
      ),
    }
    setData(updated)
    saveData(updated)
    setEditingYear(null)
  }

  function addYear() {
    const maxYear = Math.max(...data.years.map(y => y.year))
    const newYear = maxYear + 1
    const updated = { ...data, years: [...data.years, { year: newYear, births: 0, twins: 0, notes: '' }] }
    setData(updated)
    saveData(updated)
  }

  function savePregnant() {
    const updated = { ...data, currentPregnant: parseInt(pregnantVal) || 0 }
    setData(updated)
    saveData(updated)
    setEditPregnant(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Babies Born"
        subtitle={`North Star Surrogacy — started ${data.startDate}`}
      />

      {/* Hero stats */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="rounded-2xl bg-gradient-to-br from-[#D4A853]/5 to-[#1A3638]/5 border-0">
          <CardContent className="flex items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4A853] to-[#1A3638] flex items-center justify-center shadow-lg">
              <Baby className="size-8 text-white" />
            </div>
            <div>
              <p className="text-4xl font-bold text-stone-800">{totalBirths}</p>
              <p className="text-sm text-stone-500 font-medium">Total Babies Born</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-gradient-to-br from-pink-50 to-rose-50 border-0">
          <CardContent className="flex items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-lg">
              <Heart className="size-8 text-white" />
            </div>
            <div className="flex items-center gap-3">
              {editPregnant ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={pregnantVal}
                    onChange={e => setPregnantVal(e.target.value)}
                    className="w-20 h-10 text-2xl font-bold text-center"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') savePregnant(); if (e.key === 'Escape') setEditPregnant(false) }}
                  />
                  <button onClick={savePregnant} className="p-1 rounded hover:bg-emerald-50 text-emerald-600"><Check className="size-5" /></button>
                  <button onClick={() => setEditPregnant(false)} className="p-1 rounded hover:bg-stone-100 text-stone-400"><X className="size-5" /></button>
                </div>
              ) : (
                <div className="cursor-pointer group" onClick={() => { setPregnantVal(data.currentPregnant); setEditPregnant(true) }}>
                  <p className="text-4xl font-bold text-stone-800 group-hover:text-pink-600 transition-colors">{data.currentPregnant}</p>
                  <p className="text-sm text-stone-500 font-medium">Currently Pregnant</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Year-by-year table */}
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Births by Year</CardTitle>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={addYear}>
            <Plus className="size-4" /> Add Year
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-y border-stone-200">
                  <th className="text-left py-3 px-5 font-semibold text-stone-500 w-24">Year</th>
                  <th className="text-center py-3 px-4 font-semibold text-stone-500 w-28">Births</th>
                  <th className="text-center py-3 px-4 font-semibold text-stone-500 w-28">Twins</th>
                  <th className="text-left py-3 px-4 font-semibold text-stone-500">Notes</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {data.years.map(y => {
                  const isEditing = editingYear === y.year
                  return (
                    <tr key={y.year} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors cursor-pointer" onClick={() => !isEditing && startEdit(y)}>
                      <td className="py-3 px-5">
                        <span className="font-bold text-[#1A3638]">{y.year}</span>
                      </td>
                      {isEditing ? (
                        <>
                          <td className="py-2 px-4 text-center">
                            <Input type="number" min="0" value={editForm.births} onChange={e => setEditForm(f => ({ ...f, births: e.target.value }))} className="w-20 h-8 text-center mx-auto" />
                          </td>
                          <td className="py-2 px-4 text-center">
                            <Input type="number" min="0" value={editForm.twins} onChange={e => setEditForm(f => ({ ...f, twins: e.target.value }))} className="w-20 h-8 text-center mx-auto" />
                          </td>
                          <td className="py-2 px-4">
                            <Input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="h-8" placeholder="e.g. 2 twins" />
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={saveEdit} className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"><Check className="size-4" /></button>
                              <button onClick={() => setEditingYear(null)} className="p-1.5 rounded hover:bg-stone-100 text-stone-400"><X className="size-4" /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 text-center">
                            <span className="text-lg font-bold text-stone-800">{y.births}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {y.twins > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-50 text-pink-600 border border-pink-200">
                                {y.twins} twin{y.twins > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-stone-500">{y.notes || <span className="text-stone-300 italic text-xs">Click to edit</span>}</td>
                          <td className="py-3 px-4" />
                        </>
                      )}
                    </tr>
                  )
                })}
                {/* Total row */}
                <tr className="bg-gradient-to-r from-[#1A3638]/5 to-[#D4A853]/5 border-t-2 border-[#1A3638]/20">
                  <td className="py-4 px-5 font-bold text-[#1A3638]">Total</td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-2xl font-bold text-[#1A3638]">{totalBirths}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="font-bold text-pink-600">{data.years.reduce((s, y) => s + (y.twins || 0), 0)}</span>
                  </td>
                  <td className="py-4 px-4" colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Line chart */}
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Our Journey of Growth</CardTitle>
            <p className="text-sm text-stone-400">{totalBirths} families grown since 2013</p>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const years = data.years
            const maxB = Math.max(...years.map(y => y.births || 0), 1)
            const chartH = 220
            const chartW = '100%'
            const padL = 40
            const padR = 20
            const padT = 20
            const padB = 40
            // Calculate cumulative total for area chart
            let cumulative = 0
            const cumulativeData = years.map(y => { cumulative += (y.births || 0); return cumulative })
            const maxCum = Math.max(...cumulativeData, 1)

            const getX = (i) => padL + (i / (years.length - 1)) * (1000 - padL - padR)
            const getYBirths = (v) => padT + (1 - v / maxB) * (chartH - padT - padB)
            const getYCum = (v) => padT + (1 - v / maxCum) * (chartH - padT - padB)

            // Births line points
            const birthPoints = years.map((y, i) => `${getX(i)},${getYBirths(y.births || 0)}`).join(' ')
            // Cumulative area
            const cumPoints = cumulativeData.map((v, i) => `${getX(i)},${getYCum(v)}`).join(' ')
            const cumArea = `${getX(0)},${chartH - padB} ${cumPoints} ${getX(years.length - 1)},${chartH - padB}`

            return (
              <div className="relative">
                <svg viewBox={`0 0 1000 ${chartH}`} className="w-full" style={{ height: '280px' }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4A853" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#1A3638" stopOpacity="0.03" />
                    </linearGradient>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#D4A853" />
                      <stop offset="100%" stopColor="#1A3638" />
                    </linearGradient>
                    <linearGradient id="cumLineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#D4A853" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#1A3638" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>

                  {/* Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                    <line key={pct} x1={padL} y1={padT + pct * (chartH - padT - padB)} x2={1000 - padR} y2={padT + pct * (chartH - padT - padB)} stroke="#e7e5e4" strokeWidth="1" strokeDasharray={pct === 1 ? '' : '4,4'} />
                  ))}

                  {/* Cumulative area fill */}
                  <polygon points={cumArea} fill="url(#areaGrad)" />

                  {/* Cumulative line */}
                  <polyline points={cumPoints} fill="none" stroke="url(#cumLineGrad)" strokeWidth="2" strokeLinejoin="round" />

                  {/* Births per year line */}
                  <polyline points={birthPoints} fill="none" stroke="url(#lineGrad)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

                  {/* Data points + labels for births */}
                  {years.map((y, i) => {
                    const x = getX(i)
                    const yPos = getYBirths(y.births || 0)
                    return (
                      <g key={y.year}>
                        {/* Dot */}
                        <circle cx={x} cy={yPos} r="5" fill="white" stroke="#D4A853" strokeWidth="2.5" />
                        {/* Birth count label */}
                        <text x={x} y={yPos - 12} textAnchor="middle" className="text-[11px] font-bold" fill="#1A3638">{y.births}</text>
                        {/* Year label */}
                        <text x={x} y={chartH - 10} textAnchor="middle" className="text-[10px]" fill="#a8a29e">{y.year}</text>
                      </g>
                    )
                  })}

                  {/* Cumulative labels at start and end */}
                  <text x={getX(0) - 5} y={getYCum(cumulativeData[0]) - 8} textAnchor="end" className="text-[10px]" fill="#a8a29e">{cumulativeData[0]}</text>
                  <text x={getX(years.length - 1) + 5} y={getYCum(cumulativeData[cumulativeData.length - 1]) - 8} textAnchor="start" className="text-[11px] font-bold" fill="#1A3638">{cumulativeData[cumulativeData.length - 1]} total</text>
                </svg>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 rounded-full bg-gradient-to-r from-[#D4A853] to-[#1A3638]" />
                    <span className="text-xs text-stone-500">Births per year</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-3 rounded-sm bg-gradient-to-b from-[#D4A853]/15 to-[#1A3638]/5" />
                    <span className="text-xs text-stone-500">Cumulative total</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}

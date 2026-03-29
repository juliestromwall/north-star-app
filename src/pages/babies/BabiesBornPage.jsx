import { useState } from 'react'
import { Baby, Heart, Plus, Pencil, Check, X, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import PageHeader from '@/components/shared/PageHeader'

const STORAGE_KEY = 'abc_babies_born'

// Historical data from ABC Surrogacy spreadsheet
const DEFAULT_DATA = {
  startDate: '5/2013',
  years: [
    { year: 2014, births: 0, twins: 0, notes: '' },
    { year: 2015, births: 4, twins: 0, notes: '' },
    { year: 2016, births: 11, twins: 0, notes: '' },
    { year: 2017, births: 15, twins: 0, notes: '' },
    { year: 2018, births: 13, twins: 2, notes: '2 twins' },
    { year: 2019, births: 23, twins: 3, notes: '3 twins' },
    { year: 2020, births: 22, twins: 0, notes: '' },
    { year: 2021, births: 16, twins: 0, notes: '' },
    { year: 2022, births: 24, twins: 1, notes: '1 twin' },
    { year: 2023, births: 10, twins: 1, notes: '1 twin' },
    { year: 2024, births: 16, twins: 0, notes: '' },
    { year: 2025, births: 34, twins: 1, notes: '1 twin' },
    { year: 2026, births: 28, twins: 0, notes: '' },
  ],
  currentPregnant: 13,
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export default function BabiesBornPage() {
  const [data, setData] = useState(() => loadData() || DEFAULT_DATA)
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
        subtitle={`ABC Surrogacy — started ${data.startDate}`}
      />

      {/* Hero stats */}
      <div className="grid grid-cols-2 gap-6">
        <Card className="rounded-2xl bg-gradient-to-br from-[#ed148c]/5 to-[#283693]/5 border-0">
          <CardContent className="flex items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ed148c] to-[#283693] flex items-center justify-center shadow-lg">
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
                    <tr key={y.year} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                      <td className="py-3 px-5">
                        <span className="font-bold text-[#283693]">{y.year}</span>
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
                          <td className="py-3 px-4 text-stone-500">{y.notes || ''}</td>
                          <td className="py-3 px-4">
                            <button onClick={() => startEdit(y)} className="p-1.5 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Pencil className="size-3.5" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
                {/* Total row */}
                <tr className="bg-gradient-to-r from-[#283693]/5 to-[#ed148c]/5 border-t-2 border-[#283693]/20">
                  <td className="py-4 px-5 font-bold text-[#283693]">Total</td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-2xl font-bold text-[#283693]">{totalBirths}</span>
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

      {/* Chart visualization */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Growth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1.5 h-48">
            {data.years.map(y => {
              const maxBirths = Math.max(...data.years.map(yr => yr.births || 1))
              const pct = ((y.births || 0) / maxBirths) * 100
              return (
                <div key={y.year} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer" onClick={() => startEdit(y)}>
                  <span className="text-[10px] font-bold text-stone-500 opacity-0 group-hover:opacity-100 transition-opacity">{y.births}</span>
                  <div
                    className="w-full rounded-t-lg transition-all duration-300 group-hover:opacity-80"
                    style={{
                      height: `${Math.max(pct, 4)}%`,
                      background: `linear-gradient(180deg, #ed148c, #283693)`,
                    }}
                  />
                  <span className="text-[9px] text-stone-400 font-medium">{String(y.year).slice(2)}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

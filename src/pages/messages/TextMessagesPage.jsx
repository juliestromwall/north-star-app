import { useState, useEffect, useMemo } from 'react'
import { Search, MessageSquare, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PageHeader from '@/components/shared/PageHeader'
import { fetchSMSMessages } from '@/lib/sms'

function formatPhone(num) {
  if (!num) return ''
  const clean = num.replace(/[^\d]/g, '')
  if (clean.length === 11 && clean.startsWith('1')) {
    return `(${clean.slice(1,4)}) ${clean.slice(4,7)}-${clean.slice(7)}`
  }
  if (clean.length === 10) {
    return `(${clean.slice(0,3)}) ${clean.slice(3,6)}-${clean.slice(6)}`
  }
  return num
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const STATUS_STYLES = {
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  queued: 'bg-amber-100 text-amber-700 border-amber-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  undelivered: 'bg-red-100 text-red-700 border-red-200',
  received: 'bg-violet-100 text-violet-700 border-violet-200',
}

export default function TextMessagesPage() {
  const [messages, setMessages] = useState([])
  const [fromNumber, setFromNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [directionFilter, setDirectionFilter] = useState('all')

  const loadMessages = () => {
    setLoading(true)
    setError(null)
    fetchSMSMessages()
      .then(data => {
        setMessages(data.messages || [])
        setFromNumber(data.fromNumber || '')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadMessages() }, [])

  const filtered = useMemo(() => {
    return messages.filter(m => {
      const q = search.toLowerCase()
      if (q && !m.body?.toLowerCase().includes(q) && !m.from?.includes(q) && !m.to?.includes(q)) return false
      if (directionFilter !== 'all' && m.direction !== directionFilter) return false
      return true
    })
  }, [messages, search, directionFilter])

  // Group by unique contact numbers
  const contacts = useMemo(() => {
    const map = {}
    for (const m of messages) {
      const contact = m.direction === 'outbound' ? m.to : m.from
      if (!map[contact]) map[contact] = { number: contact, count: 0, lastDate: m.date, lastMessage: m.body }
      map[contact].count++
    }
    return Object.values(map).sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate))
  }, [messages])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Text Messages"
        subtitle={fromNumber ? `Twilio number: ${formatPhone(fromNumber)}` : 'Loading...'}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={loadMessages} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input placeholder="Search messages, phone numbers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Messages</SelectItem>
            <SelectItem value="outbound">Sent</SelectItem>
            <SelectItem value="inbound">Received</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-stone-400">Loading messages...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="size-8 text-stone-200 mx-auto mb-2" />
          <p className="text-sm text-stone-400">{messages.length === 0 ? 'No text messages yet.' : 'No messages match your search.'}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left py-3 px-4 font-medium text-stone-500 w-10" />
                <th className="text-left py-3 px-4 font-medium text-stone-500">Contact</th>
                <th className="text-left py-3 px-4 font-medium text-stone-500">Message</th>
                <th className="text-left py-3 px-4 font-medium text-stone-500 w-36">Status</th>
                <th className="text-left py-3 px-4 font-medium text-stone-500 w-48">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.sid} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                  <td className="py-3 px-4">
                    {m.direction === 'outbound' ? (
                      <ArrowUpRight className="size-4 text-blue-500" title="Sent" />
                    ) : (
                      <ArrowDownLeft className="size-4 text-violet-500" title="Received" />
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-stone-800">
                      {formatPhone(m.direction === 'outbound' ? m.to : m.from)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-stone-600 max-w-md truncate">{m.body}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[m.status] || 'bg-stone-100 text-stone-500 border-stone-200'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-stone-500 text-xs">{formatDate(m.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, MessageSquare, RefreshCw, CheckCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PageHeader from '@/components/shared/PageHeader'
import { fetchSMSMessages } from '@/lib/sms'
import { fetchSurrogatesFromIntake, fetchIPsFromIntake } from '@/lib/db'
import { getUnreadSMSCount, markSMSRead, isMessageRead } from '@/lib/smsReadState'

function cleanDigits(num) {
  if (!num) return ''
  const d = num.replace(/[^\d]/g, '')
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d
}

function formatPhone(num) {
  const clean = cleanDigits(num)
  if (clean.length === 10) return `(${clean.slice(0,3)}) ${clean.slice(3,6)}-${clean.slice(6)}`
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

function UnreadDot() {
  return (
    <span className="relative flex size-2.5 ml-1">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
      <span className="relative inline-flex rounded-full size-2.5 bg-pink-500" />
    </span>
  )
}

export default function TextMessagesPage() {
  const [messages, setMessages] = useState([])
  const [fromNumber, setFromNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [directionFilter, setDirectionFilter] = useState('inbound')
  const [expandedSid, setExpandedSid] = useState(null)
  const [caseMap, setCaseMap] = useState({}) // phone digits → { name, id, type }
  const [, setTick] = useState(0)
  const forceUpdate = useCallback(() => setTick(t => t + 1), [])

  // Load cases to match phone numbers
  useEffect(() => {
    Promise.all([fetchSurrogatesFromIntake(), fetchIPsFromIntake()]).then(([gcs, ips]) => {
      const map = {}
      for (const s of gcs || []) {
        if (s.phone) map[cleanDigits(s.phone)] = { name: s.name, id: s.id, type: 'gc', path: `/surrogates/${s.id}` }
      }
      for (const ip of ips || []) {
        if (ip.phone) map[cleanDigits(ip.phone)] = { name: ip.names, id: ip.id, type: 'ip', path: `/intended-parents/${ip.id}` }
        if (ip.ip2Phone) map[cleanDigits(ip.ip2Phone)] = { name: ip.ip2Name || ip.names, id: ip.id, type: 'ip', path: `/intended-parents/${ip.id}` }
      }
      setCaseMap(map)
    }).catch(() => {})
  }, [])

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
      const contactNum = m.direction === 'outbound' ? m.to : m.from
      const caseInfo = caseMap[cleanDigits(contactNum)]
      if (q && !m.body?.toLowerCase().includes(q) && !contactNum?.includes(q) && !caseInfo?.name?.toLowerCase().includes(q)) return false
      if (directionFilter !== 'all' && m.direction !== directionFilter) return false
      return true
    })
  }, [messages, search, directionFilter, caseMap])

  const unreadCount = useMemo(() => {
    return messages.filter(m => m.direction === 'inbound' && !isMessageRead(m.sid)).length
  }, [messages])

  const handleMarkRead = (sid) => {
    markSMSRead(sid)
    forceUpdate()
  }

  const handleMarkAllRead = () => {
    for (const m of messages) markSMSRead(m.sid)
    forceUpdate()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="flex items-center gap-2">Text Messages {unreadCount > 0 && <span className="text-sm font-bold text-pink-500 bg-pink-50 px-2 py-0.5 rounded-full">{unreadCount} unread</span>}</span>}
        subtitle={fromNumber ? `Twilio number: ${formatPhone(fromNumber)}` : 'Loading...'}
        actions={
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleMarkAllRead}>
                <CheckCheck className="size-4" /> Mark All Read
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={loadMessages} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input placeholder="Search messages, names, phone numbers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
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
                <th className="text-left py-3 px-4 font-medium text-stone-500 w-8" />
                <th className="text-left py-3 px-4 font-medium text-stone-500 w-20" />
                <th className="text-left py-3 px-4 font-medium text-stone-500">Contact</th>
                <th className="text-left py-3 px-4 font-medium text-stone-500">Case</th>
                <th className="text-left py-3 px-4 font-medium text-stone-500">Message</th>
                <th className="text-left py-3 px-4 font-medium text-stone-500 w-28">Status</th>
                <th className="text-left py-3 px-4 font-medium text-stone-500 w-44">Date</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const contactNum = m.direction === 'outbound' ? m.to : m.from
                const caseInfo = caseMap[cleanDigits(contactNum)]
                const unread = m.direction === 'inbound' && !isMessageRead(m.sid)
                const isExpanded = expandedSid === m.sid
                return (
                  <tr
                    key={m.sid}
                    className={`border-b border-stone-100 cursor-pointer transition-colors ${unread ? 'bg-pink-50/40 hover:bg-pink-50' : 'hover:bg-stone-50'}`}
                    onClick={() => { setExpandedSid(isExpanded ? null : m.sid); if (unread) handleMarkRead(m.sid) }}
                  >
                    <td className="py-3 px-4">
                      {unread && <UnreadDot />}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${m.direction === 'outbound' ? 'text-stone-400' : 'text-[#283693]'}`}>
                        {m.direction === 'outbound' ? 'Sent' : 'Received'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-stone-800">{formatPhone(contactNum)}</span>
                    </td>
                    <td className="py-3 px-4">
                      {caseInfo ? (
                        <Link
                          to={caseInfo.path}
                          onClick={e => e.stopPropagation()}
                          className="text-[#283693] font-medium hover:underline"
                        >
                          {caseInfo.name}
                        </Link>
                      ) : (
                        <span className="text-stone-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-stone-600">
                      {isExpanded ? (
                        <div className="whitespace-pre-wrap break-words max-w-lg">{m.body}</div>
                      ) : (
                        <div className="truncate max-w-xs">{m.body}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[m.status] || 'bg-stone-100 text-stone-500 border-stone-200'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-500 text-xs">{formatDate(m.date)}</td>
                    <td className="py-3 px-2">
                      {unread && (
                        <button
                          onClick={e => { e.stopPropagation(); handleMarkRead(m.sid) }}
                          className="p-1 rounded hover:bg-stone-100 text-stone-400 hover:text-emerald-600"
                          title="Mark as read"
                        >
                          <CheckCheck className="size-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, Plus, Send, Users, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import PageHeader from '@/components/shared/PageHeader'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import { useRole } from '@/context/RoleContext'
import { fetchAdminPhones } from '@/lib/sms'

// ── Helpers ──

function formatTime(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today - msgDay) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

function formatPreviewTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today - msgDay) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return formatTime(dateStr)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function isSameDay(a, b) {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

// ── Main Component ──

export default function TeamChatsPage() {
  const { currentUser } = useRole()
  const [groups, setGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [messages, setMessages] = useState([])
  const [composing, setComposing] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [adminPhones, setAdminPhones] = useState([])
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const pollRef = useRef(null)

  const selectedGroup = groups.find(g => g.id === selectedGroupId)

  // ── Load admin phones ──
  useEffect(() => {
    fetchAdminPhones().then(setAdminPhones).catch(() => {})
  }, [])

  // ── Load groups ──
  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/team-chats/list')
      const data = await res.json()
      if (data.groups) setGroups(data.groups)
    } catch {}
    setLoadingGroups(false)
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  // ── Load messages for selected group ──
  const loadMessages = useCallback(async (groupId) => {
    if (!groupId) return
    try {
      const res = await fetch(`/api/team-chats/messages?groupId=${groupId}`)
      const data = await res.json()
      if (data.messages) setMessages(data.messages)
    } catch {}
    setLoadingMessages(false)
  }, [])

  useEffect(() => {
    if (selectedGroupId) {
      setLoadingMessages(true)
      loadMessages(selectedGroupId)
    } else {
      setMessages([])
    }
  }, [selectedGroupId, loadMessages])

  // ── Poll for new messages every 10 seconds ──
  useEffect(() => {
    if (!selectedGroupId) return
    pollRef.current = setInterval(() => {
      loadMessages(selectedGroupId)
      loadGroups() // also refresh group list for latest previews
    }, 10000)
    return () => clearInterval(pollRef.current)
  }, [selectedGroupId, loadMessages, loadGroups])

  // ── Auto-scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ──
  const handleSend = async () => {
    const body = composing.trim()
    if (!body || !selectedGroupId || sending) return

    setSending(true)
    setComposing('')

    // Find sender's phone
    const senderPhone = adminPhones.find(p => p.id === currentUser.id)?.phone || null

    // Build memberPhones for SMS notifications
    const memberPhones = (selectedGroup?.member_ids || [])
      .map(id => {
        const phone = adminPhones.find(p => p.id === id)
        return phone ? { id: phone.id, phone: phone.phone } : null
      })
      .filter(Boolean)

    try {
      const res = await fetch('/api/team-chats/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroupId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderPhone,
          body,
          memberPhones,
        }),
      })
      const newMsg = await res.json()
      if (res.ok) {
        setMessages(prev => [...prev, newMsg])
        loadGroups() // refresh sidebar previews
      }
    } catch {}
    setSending(false)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Create group ──
  const handleCreateGroup = async (name, memberIds) => {
    try {
      const res = await fetch('/api/team-chats/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          memberIds,
          createdBy: currentUser.id,
        }),
      })
      const group = await res.json()
      if (res.ok) {
        await loadGroups()
        setSelectedGroupId(group.id)
      }
    } catch {}
    setShowNewChat(false)
  }

  // ── Build member name map ──
  const memberNameMap = {}
  for (const p of adminPhones) {
    memberNameMap[p.id] = p.name
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Team Chats"
        actions={
          <Button onClick={() => setShowNewChat(true)} size="sm">
            <Plus className="size-4 mr-1" /> New Chat
          </Button>
        }
      />

      <div className="flex rounded-2xl border border-stone-200 bg-white overflow-hidden" style={{ height: 'calc(100vh - 180px)' }}>
        {/* ── Left Panel: Group List ── */}
        <div className={`w-full sm:w-80 shrink-0 border-r border-stone-200 flex flex-col ${selectedGroupId ? 'hidden sm:flex' : 'flex'}`}>
          <div className="p-3 border-b border-stone-100">
            <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">Conversations</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingGroups ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full size-6 border-2 border-stone-300 border-t-[#283693]" />
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <MessageCircle className="size-10 text-stone-300 mb-3" />
                <p className="text-sm font-medium text-stone-500">No chats yet</p>
                <p className="text-xs text-stone-400 mt-1">Start a team chat to message your colleagues</p>
              </div>
            ) : (
              groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`w-full text-left p-3 border-b border-stone-50 hover:bg-stone-50 transition-colors ${
                    selectedGroupId === group.id ? 'bg-stone-100' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-full bg-[#283693]/10 flex items-center justify-center shrink-0">
                      <Users className="size-5 text-[#283693]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-stone-800 truncate">{group.name}</p>
                        {group.lastMessage?.sent_at && (
                          <span className="text-[10px] text-stone-400 shrink-0">{formatPreviewTime(group.lastMessage.sent_at)}</span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {group.member_ids?.length || 0} member{(group.member_ids?.length || 0) !== 1 ? 's' : ''}
                      </p>
                      {group.lastMessage && (
                        <p className="text-xs text-stone-500 mt-1 truncate">
                          <span className="font-medium">{group.lastMessage.sender_name}:</span>{' '}
                          {group.lastMessage.body}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right Panel: Messages ── */}
        <div className={`flex-1 flex flex-col ${!selectedGroupId ? 'hidden sm:flex' : 'flex'}`}>
          {!selectedGroupId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <MessageCircle className="size-12 text-stone-200 mb-3" />
              <p className="text-sm font-medium text-stone-400">Select a conversation</p>
              <p className="text-xs text-stone-300 mt-1">Choose a chat from the sidebar to start messaging</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-stone-200 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedGroupId(null)}
                    className="sm:hidden p-1 -ml-1 text-stone-400 hover:text-stone-600"
                  >
                    <ArrowLeft className="size-5" />
                  </button>
                  <div>
                    <h2 className="text-sm font-semibold text-stone-800">{selectedGroup?.name}</h2>
                    <p className="text-xs text-stone-400">
                      {(selectedGroup?.member_ids || [])
                        .map(id => memberNameMap[id] || id.slice(0, 8))
                        .join(', ')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full size-6 border-2 border-stone-300 border-t-[#283693]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-sm text-stone-400">No messages yet. Say something!</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.sender_id === currentUser.id
                    const showDate = i === 0 || !isSameDay(messages[i - 1].sent_at, msg.sent_at)
                    const showSenderName = !isMe && (i === 0 || messages[i - 1].sender_id !== msg.sender_id || showDate)

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex justify-center my-3">
                            <span className="text-[10px] text-stone-400 bg-stone-100 px-3 py-1 rounded-full">
                              {formatDateLabel(msg.sent_at)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${showSenderName && !isMe ? 'mt-3' : 'mt-0.5'}`}>
                          <div className={`flex items-end gap-2 max-w-[75%] ${isMe ? 'flex-row-reverse' : ''}`}>
                            {!isMe && showSenderName && (
                              <ProfileAvatar name={msg.sender_name || 'Unknown'} size="sm" className="mb-5 shrink-0" />
                            )}
                            {!isMe && !showSenderName && <div className="size-8 shrink-0" />}
                            <div>
                              {showSenderName && !isMe && (
                                <p className="text-[10px] text-stone-400 ml-1 mb-0.5">{msg.sender_name}</p>
                              )}
                              <div
                                className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                                  isMe
                                    ? 'bg-[#283693] text-white rounded-br-md'
                                    : 'bg-stone-100 text-stone-800 rounded-bl-md'
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                                <p className={`text-[10px] mt-1 ${isMe ? 'text-white/60' : 'text-stone-400'}`}>
                                  {formatTime(msg.sent_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose bar */}
              <div className="p-3 border-t border-stone-200 shrink-0">
                <div className="flex items-end gap-2">
                  <Textarea
                    ref={textareaRef}
                    value={composing}
                    onChange={e => setComposing(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    className="resize-none min-h-[40px] max-h-32 text-sm rounded-xl"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!composing.trim() || sending}
                    size="icon"
                    className="shrink-0 rounded-xl bg-[#283693] hover:bg-[#283693]/90 size-10"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── New Chat Dialog ── */}
      <NewChatDialog
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        onCreate={handleCreateGroup}
        adminPhones={adminPhones}
        currentUserId={currentUser.id}
      />
    </div>
  )
}

// ── New Chat Dialog Component ──

function NewChatDialog({ open, onClose, onCreate, adminPhones, currentUserId }) {
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [creating, setCreating] = useState(false)

  // Auto-include current user
  useEffect(() => {
    if (open) {
      setName('')
      setSelectedIds(new Set([currentUserId]))
    }
  }, [open, currentUserId])

  const toggleMember = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        // Don't allow deselecting yourself
        if (id === currentUserId) return next
        next.delete(id)
      } else {
        if (next.size >= 10) return next
        next.add(id)
      }
      return next
    })
  }

  const handleCreate = async () => {
    if (!name.trim() || selectedIds.size < 2) return
    setCreating(true)
    await onCreate(name.trim(), Array.from(selectedIds))
    setCreating(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Team Chat</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-stone-700 mb-1 block">Group Name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Case Updates, Office Chat"
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700 mb-2 block">
              Members ({selectedIds.size}/10)
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {adminPhones.length === 0 ? (
                <p className="text-sm text-stone-400 py-4 text-center">No team members with phone numbers found</p>
              ) : (
                adminPhones.map(admin => {
                  const isCurrentUser = admin.id === currentUserId
                  return (
                    <label
                      key={admin.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-stone-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedIds.has(admin.id)}
                        onCheckedChange={() => toggleMember(admin.id)}
                        disabled={isCurrentUser}
                      />
                      <ProfileAvatar name={admin.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-700 truncate">
                          {admin.name}{isCurrentUser ? ' (you)' : ''}
                        </p>
                        <p className="text-xs text-stone-400 truncate">{admin.email}</p>
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || selectedIds.size < 2 || creating}
            className="rounded-xl bg-[#283693] hover:bg-[#283693]/90"
          >
            {creating ? 'Creating...' : 'Create Chat'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

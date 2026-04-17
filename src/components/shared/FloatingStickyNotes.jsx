import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Minimize2, GripHorizontal, StickyNote } from 'lucide-react'
import { useRole } from '@/context/RoleContext'
import { getAppConfig, setAppConfig } from '@/lib/db'
import { ADMIN_ROLES } from '@/lib/constants'

const COLORS = [
  { id: 'yellow', bg: '#faff00', border: '#d4e600', text: '#3d4000', shadow: 'shadow-yellow-400/40', dot: '#e6f000' },
  { id: 'pink', bg: '#ff4dff', border: '#e600e6', text: '#fff', shadow: 'shadow-pink-400/40', dot: '#ff1aff' },
  { id: 'blue', bg: '#00e5ff', border: '#00b8d4', text: '#003340', shadow: 'shadow-cyan-400/40', dot: '#00cfeb' },
  { id: 'green', bg: '#39ff14', border: '#2dd40e', text: '#0a3300', shadow: 'shadow-green-400/40', dot: '#30e610' },
  { id: 'purple', bg: '#bf5fff', border: '#a033e6', text: '#fff', shadow: 'shadow-purple-400/40', dot: '#ad40f0' },
]

function getColor(id) {
  return COLORS.find(c => c.id === id) || COLORS[0]
}

function DraggableNote({ note, onUpdate, onDelete, onMinimize }) {
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.text)
  const dragOffset = useRef({ x: 0, y: 0 })
  const resizeStart = useRef({ y: 0, h: 0 })
  const noteRef = useRef(null)
  const color = getColor(note.color)

  function handleMouseDown(e) {
    if (e.target.closest('.note-content') || e.target.closest('button')) return
    e.preventDefault()
    setDragging(true)
    const rect = noteRef.current.getBoundingClientRect()
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handleTouchStart(e) {
    if (e.target.closest('.note-content') || e.target.closest('button')) return
    setDragging(true)
    const rect = noteRef.current.getBoundingClientRect()
    const touch = e.touches[0]
    dragOffset.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }

  useEffect(() => {
    if (!dragging) return
    function handleMove(e) {
      const clientX = e.clientX ?? e.touches?.[0]?.clientX
      const clientY = e.clientY ?? e.touches?.[0]?.clientY
      if (clientX == null) return
      const x = Math.max(0, Math.min(clientX - dragOffset.current.x, window.innerWidth - 200))
      const y = Math.max(0, Math.min(clientY - dragOffset.current.y, window.innerHeight - 100))
      onUpdate(note.id, { x, y })
    }
    function handleUp() {
      setDragging(false)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleUp)
    }
  }, [dragging])

  // Resize drag
  function handleResizeStart(e) {
    e.preventDefault()
    e.stopPropagation()
    setResizing(true)
    const clientY = e.clientY ?? e.touches?.[0]?.clientY
    resizeStart.current = { y: clientY, h: note.height || noteRef.current?.offsetHeight || 120 }
  }

  useEffect(() => {
    if (!resizing) return
    function handleMove(e) {
      const clientY = e.clientY ?? e.touches?.[0]?.clientY
      if (clientY == null) return
      const newH = Math.max(80, resizeStart.current.h + (clientY - resizeStart.current.y))
      onUpdate(note.id, { height: newH })
    }
    function handleUp() { setResizing(false) }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleUp)
    }
  }, [resizing])

  function handleSave() {
    setEditing(false)
    onUpdate(note.id, { text })
  }

  return (
    <div
      ref={noteRef}
      className={`fixed z-[60] w-52 rounded-lg shadow-lg ${color.shadow} transition-shadow ${dragging ? 'shadow-xl scale-[1.03]' : 'hover:shadow-xl'} flex flex-col`}
      style={{
        left: note.x ?? 100,
        top: note.y ?? 100,
        height: note.height ? `${note.height}px` : 'auto',
        minHeight: 80,
        backgroundColor: color.bg,
        borderLeft: `4px solid ${color.border}`,
        cursor: dragging ? 'grabbing' : 'default',
        userSelect: (dragging || resizing) ? 'none' : 'auto',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Header — drag handle + controls */}
      <div className="flex items-center justify-between px-2 py-1.5 cursor-grab active:cursor-grabbing" style={{ color: color.text }}>
        <GripHorizontal className="size-3.5 opacity-40" />
        <div className="flex items-center gap-0.5">
          {/* Color picker */}
          <div className="flex items-center gap-0.5 mr-1">
            {COLORS.map(c => (
              <button key={c.id} onClick={() => onUpdate(note.id, { color: c.id })}
                className={`size-3 rounded-full border ${note.color === c.id ? 'ring-1 ring-offset-1' : ''}`}
                style={{ backgroundColor: c.border, borderColor: c.border, ringColor: c.text }} />
            ))}
          </div>
          <button onClick={() => onMinimize(note.id)} className="p-0.5 rounded hover:bg-black/10" title="Minimize">
            <Minimize2 className="size-3" />
          </button>
          <button onClick={() => onDelete(note.id)} className="p-0.5 rounded hover:bg-black/10" title="Delete">
            <X className="size-3" />
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="note-content px-3 pb-3 flex-1 overflow-y-auto">
        {editing ? (
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Escape') handleSave() }}
            className="w-full h-full bg-transparent border-none outline-none resize-none text-xs leading-relaxed"
            style={{ color: color.text, minHeight: 40 }}
            placeholder="Type your note..."
          />
        ) : (
          <p
            className="text-xs leading-relaxed whitespace-pre-wrap min-h-[40px] cursor-text"
            style={{ color: color.text }}
            onClick={() => setEditing(true)}
          >
            {note.text || <span className="opacity-40 italic">Click to add text...</span>}
          </p>
        )}
      </div>
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
        className="h-2 cursor-ns-resize flex items-center justify-center shrink-0 rounded-b-lg"
        style={{ backgroundColor: `${color.border}30` }}
      >
        <div className="w-8 h-[2px] rounded-full" style={{ backgroundColor: `${color.border}80` }} />
      </div>
    </div>
  )
}

export default function FloatingStickyNotes() {
  const { currentUser, currentRole } = useRole()
  const [notes, setNotes] = useState([])
  const [loaded, setLoaded] = useState(false)
  const isAdmin = ADMIN_ROLES.includes(currentRole)
  const normalizedEmail = currentUser?.email?.trim().toLowerCase() || ''
  const configKey = currentUser?.id ? `floating_notes_${currentUser.id}` : `floating_notes_${normalizedEmail || 'default'}`
  const legacyConfigKey = normalizedEmail ? `floating_notes_${normalizedEmail}` : null

  function readLocalBackup(keys) {
    for (const key of keys) {
      try {
        const saved = JSON.parse(localStorage.getItem(`abc_${key}`) || 'null')
        if (Array.isArray(saved) && saved.length > 0) return saved
      } catch {
        // Ignore corrupt browser backups and keep checking the other keys.
      }
    }
    return null
  }

  function writeLocalBackups(keys, value) {
    for (const key of keys) {
      try {
        localStorage.setItem(`abc_${key}`, JSON.stringify(value))
      } catch {
        // Browser storage can be unavailable in private mode; Supabase remains primary.
      }
    }
  }

  // Load from Supabase
  useEffect(() => {
    const keys = [configKey, legacyConfigKey].filter(Boolean)
    if (!isAdmin || keys.length === 0) {
      setTimeout(() => {
        setNotes([])
        setLoaded(true)
      }, 0)
      return
    }
    let cancelled = false
    setTimeout(() => {
      if (!cancelled) setLoaded(false)
    }, 0)
    Promise.all(keys.map(key => getAppConfig(key).catch(() => null))).then(async results => {
      if (cancelled) return
      const remote = results.find(saved => Array.isArray(saved) && saved.length > 0)
        || results.find(saved => Array.isArray(saved))
      const backup = readLocalBackup(keys)
      const resolved = Array.isArray(remote) && remote.length > 0 ? remote : (backup || remote || [])
      setNotes(resolved)
      writeLocalBackups(keys, resolved)
      if (resolved.length > 0) {
        await Promise.all(keys.map(key => setAppConfig(key, resolved).catch(() => null)))
      }
    }).catch(() => {
      if (!cancelled) setNotes(readLocalBackup(keys) || [])
    }).finally(() => {
      if (!cancelled) setLoaded(true)
    })
    return () => { cancelled = true }
  }, [configKey, legacyConfigKey, isAdmin])

  // Save to Supabase (debounced)
  const saveTimer = useRef(null)
  const saveNotes = useCallback((updated) => {
    setNotes(updated)
    const keys = [configKey, legacyConfigKey].filter(Boolean)
    writeLocalBackups(keys, updated)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      Promise.all(keys.map(key => setAppConfig(key, updated).catch(() => null)))
    }, 1000)
  }, [configKey, legacyConfigKey])

  if (!isAdmin || !loaded) return null

  function addNote() {
    const newNote = {
      id: Date.now().toString(),
      text: '',
      color: COLORS[notes.length % COLORS.length].id,
      x: 120 + (notes.length % 4) * 30,
      y: 120 + (notes.length % 4) * 30,
      minimized: false,
    }
    saveNotes([...notes, newNote])
  }

  function updateNote(id, updates) {
    saveNotes(notes.map(n => n.id === id ? { ...n, ...updates } : n))
  }

  function deleteNote(id) {
    saveNotes(notes.filter(n => n.id !== id))
  }

  function minimizeNote(id) {
    saveNotes(notes.map(n => n.id === id ? { ...n, minimized: true } : n))
  }

  function restoreNote(id) {
    saveNotes(notes.map(n => n.id === id ? { ...n, minimized: false } : n))
  }

  const activeNotes = notes.filter(n => !n.minimized)
  const minimizedNotes = notes.filter(n => n.minimized)

  return (
    <>
      {/* Floating notes */}
      {activeNotes.map(note => (
        <DraggableNote
          key={note.id}
          note={note}
          onUpdate={updateNote}
          onDelete={deleteNote}
          onMinimize={minimizeNote}
        />
      ))}
      {/* Minimized bar — positioned in the top bar after nav icons */}
      <MinimizedBar notes={minimizedNotes} onRestore={restoreNote} onAdd={addNote} />
    </>
  )
}

export function MinimizedBar({ notes, onRestore, onAdd }) {
  const [target, setTarget] = useState(null)
  useEffect(() => {
    // Wait for TopBar to render the portal target
    const el = document.getElementById('sticky-notes-bar')
    if (el) {
      const timer = setTimeout(() => setTarget(el), 0)
      return () => clearTimeout(timer)
    }
    else {
      const timer = setTimeout(() => setTarget(document.getElementById('sticky-notes-bar')), 500)
      return () => clearTimeout(timer)
    }
  }, [])

  const content = (
    <>
      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border shadow-sm transition-colors"
        style={{ backgroundColor: '#faff00', borderColor: '#d4e600', color: '#3d4000' }}
        title="Add sticky note"
      >
        <StickyNote className="size-3" />
        <Plus className="size-2.5" />
      </button>
      {notes.map(note => {
        const color = getColor(note.color)
        return (
          <button
            key={note.id}
            onClick={() => onRestore(note.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border shadow-sm hover:scale-105 transition-all max-w-[120px]"
            style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}
            title={note.text || 'Empty note'}
          >
            <StickyNote className="size-3 shrink-0" />
            <span className="truncate">{note.text?.slice(0, 15) || 'Note'}</span>
          </button>
        )
      })}
    </>
  )

  if (target) return createPortal(content, target)
  return null
}

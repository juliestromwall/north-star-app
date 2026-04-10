import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Minimize2, GripHorizontal, StickyNote } from 'lucide-react'
import { useRole } from '@/context/RoleContext'
import { getAppConfig, setAppConfig } from '@/lib/db'
import { ADMIN_ROLES } from '@/lib/constants'

const COLORS = [
  { id: 'yellow', bg: '#fef9c3', border: '#fde047', text: '#854d0e', shadow: 'shadow-yellow-200/50' },
  { id: 'pink', bg: '#fce7f3', border: '#f9a8d4', text: '#9d174d', shadow: 'shadow-pink-200/50' },
  { id: 'blue', bg: '#dbeafe', border: '#93c5fd', text: '#1e40af', shadow: 'shadow-blue-200/50' },
  { id: 'green', bg: '#dcfce7', border: '#86efac', text: '#166534', shadow: 'shadow-green-200/50' },
  { id: 'purple', bg: '#f3e8ff', border: '#c4b5fd', text: '#6b21a8', shadow: 'shadow-purple-200/50' },
]

function getColor(id) {
  return COLORS.find(c => c.id === id) || COLORS[0]
}

function DraggableNote({ note, onUpdate, onDelete, onMinimize }) {
  const [dragging, setDragging] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.text)
  const dragOffset = useRef({ x: 0, y: 0 })
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

  function handleSave() {
    setEditing(false)
    onUpdate(note.id, { text })
  }

  return (
    <div
      ref={noteRef}
      className={`fixed z-[60] w-52 rounded-lg shadow-lg ${color.shadow} transition-shadow ${dragging ? 'shadow-xl scale-[1.03]' : 'hover:shadow-xl'}`}
      style={{
        left: note.x ?? 100,
        top: note.y ?? 100,
        backgroundColor: color.bg,
        borderLeft: `4px solid ${color.border}`,
        cursor: dragging ? 'grabbing' : 'default',
        userSelect: dragging ? 'none' : 'auto',
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
      <div className="note-content px-3 pb-3">
        {editing ? (
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Escape') handleSave() }}
            className="w-full bg-transparent border-none outline-none resize-none text-xs leading-relaxed"
            style={{ color: color.text, minHeight: 60 }}
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
      {/* Paper fold effect */}
      <div className="absolute bottom-0 right-0 size-4" style={{
        background: `linear-gradient(135deg, transparent 50%, ${color.border}40 50%)`,
        borderRadius: '0 0 8px 0',
      }} />
    </div>
  )
}

export default function FloatingStickyNotes() {
  const { currentUser, currentRole } = useRole()
  const [notes, setNotes] = useState([])
  const [loaded, setLoaded] = useState(false)
  const isAdmin = ADMIN_ROLES.includes(currentRole)
  const configKey = `floating_notes_${currentUser?.email || 'default'}`

  // Load from Supabase
  useEffect(() => {
    if (!currentUser?.email) return
    getAppConfig(configKey).then(saved => {
      if (saved && Array.isArray(saved)) setNotes(saved)
    }).catch(() => {}).finally(() => setLoaded(true))
  }, [configKey])

  // Save to Supabase (debounced)
  const saveTimer = useRef(null)
  const saveNotes = useCallback((updated) => {
    setNotes(updated)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setAppConfig(configKey, updated).catch(() => {})
    }, 1000)
  }, [configKey])

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
      <MinimizedBar notes={minimizedNotes} onRestore={restoreNote} onDelete={deleteNote} onAdd={addNote} />
    </>
  )
}

export function MinimizedBar({ notes, onRestore, onDelete, onAdd }) {
  const [target, setTarget] = useState(null)
  useEffect(() => {
    // Wait for TopBar to render the portal target
    const el = document.getElementById('sticky-notes-bar')
    if (el) setTarget(el)
    else {
      const timer = setTimeout(() => setTarget(document.getElementById('sticky-notes-bar')), 500)
      return () => clearTimeout(timer)
    }
  }, [])

  const content = (
    <>
      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-[10px] font-semibold border border-yellow-300 shadow-sm transition-colors"
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

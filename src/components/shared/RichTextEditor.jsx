import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Highlight } from '@tiptap/extension-highlight'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Underline } from '@tiptap/extension-underline'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter,
  List, ListOrdered, Palette, Undo2, Redo2,
} from 'lucide-react'
import { useState } from 'react'

const TEXT_COLORS = [
  { color: '#000000', label: 'Black' },
  { color: '#283693', label: 'Indigo' },
  { color: '#ed148c', label: 'Pink' },
  { color: '#ef4444', label: 'Red' },
  { color: '#f59e0b', label: 'Amber' },
  { color: '#10b981', label: 'Green' },
  { color: '#8b5cf6', label: 'Purple' },
  { color: '#6b7280', label: 'Gray' },
]

const HIGHLIGHT_COLORS = [
  { color: '#fef08a', label: 'Yellow' },
  { color: '#bbf7d0', label: 'Green' },
  { color: '#bfdbfe', label: 'Blue' },
  { color: '#fbcfe8', label: 'Pink' },
  { color: '#fcd6bb', label: 'Orange' },
  { color: '#ddd6fe', label: 'Purple' },
]

function ToolbarButton({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-stone-200 text-stone-900' : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'}`}
    >
      {children}
    </button>
  )
}

function ColorPicker({ open, onToggle, onClose, colors, onSelect, onClear, icon: Icon, title }) {
  return (
    <div className="relative">
      <ToolbarButton active={open} onClick={onToggle} title={title}>
        <Icon className="size-3.5" />
      </ToolbarButton>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg border shadow-lg p-2 flex gap-1.5 flex-wrap w-max">
            {colors.map(c => (
              <button
                key={c.color}
                className="size-6 rounded-full border border-stone-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: c.color }}
                title={c.label}
                onClick={() => { onSelect(c.color); onClose() }}
              />
            ))}
            <button
              className="size-6 rounded-full border border-stone-200 hover:scale-110 transition-transform flex items-center justify-center text-[10px] text-stone-400"
              onClick={() => { onClear(); onClose() }}
              title="Remove"
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function RichTextEditor({ content, onChange, placeholder = 'Write something...', minHeight = '120px' }) {
  const [colorOpen, setColorOpen] = useState(false)
  const [highlightOpen, setHighlightOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Color,
      TextStyle,
      Underline,
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none px-3 py-2 text-sm',
        style: `min-height: ${minHeight}`,
      },
    },
  })

  if (!editor) return null

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* Editor styles for lists */}
      <style>{`
        .tiptap ul { list-style-type: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .tiptap ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .tiptap li { margin: 0.25em 0; }
        .tiptap li p { margin: 0; }
        .tiptap p { margin: 0.25em 0; }
        .tiptap mark { border-radius: 2px; padding: 1px 2px; }
      `}</style>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-stone-100 bg-stone-50/50 flex-wrap">
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <UnderlineIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough className="size-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-stone-200 mx-1" />

        {/* Text color */}
        <ColorPicker
          open={colorOpen}
          onToggle={() => { setColorOpen(!colorOpen); setHighlightOpen(false) }}
          onClose={() => setColorOpen(false)}
          colors={TEXT_COLORS}
          onSelect={color => editor.chain().focus().setColor(color).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
          icon={Palette}
          title="Text color"
        />

        {/* Highlight color */}
        <ColorPicker
          open={highlightOpen}
          onToggle={() => { setHighlightOpen(!highlightOpen); setColorOpen(false) }}
          onClose={() => setHighlightOpen(false)}
          colors={HIGHLIGHT_COLORS}
          onSelect={color => editor.chain().focus().toggleHighlight({ color }).run()}
          onClear={() => editor.chain().focus().unsetHighlight().run()}
          icon={Highlighter}
          title="Highlight color"
        />

        <div className="w-px h-4 bg-stone-200 mx-1" />

        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
          <ListOrdered className="size-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-stone-200 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo2 className="size-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}

export function RichTextDisplay({ content }) {
  if (!content) return null
  return (
    <>
      <style>{`
        .note-display ul { list-style-type: disc; padding-left: 1.5em; margin: 0.25em 0; }
        .note-display ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.25em 0; }
        .note-display li { margin: 0.15em 0; }
        .note-display li p { margin: 0; }
        .note-display p { margin: 0.15em 0; }
        .note-display mark { border-radius: 2px; padding: 1px 2px; }
      `}</style>
      <div
        className="note-display text-sm text-stone-700"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </>
  )
}

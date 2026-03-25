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
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const COLORS = [
  '#000000', '#283693', '#ed148c', '#ef4444', '#f59e0b',
  '#10b981', '#8b5cf6', '#6b7280',
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

export default function RichTextEditor({ content, onChange, placeholder = 'Write something...', minHeight = '120px' }) {
  const [colorOpen, setColorOpen] = useState(false)

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
        class: 'prose prose-sm max-w-none focus:outline-none px-3 py-2',
        style: `min-height: ${minHeight}`,
      },
    },
  })

  if (!editor) return null

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
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

        <ToolbarButton active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} title="Highlight">
          <Highlighter className="size-3.5" />
        </ToolbarButton>

        {/* Color picker */}
        <div className="relative">
          <ToolbarButton active={colorOpen} onClick={() => setColorOpen(!colorOpen)} title="Text color">
            <Palette className="size-3.5" />
          </ToolbarButton>
          {colorOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setColorOpen(false)} />
              <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg border shadow-lg p-2 flex gap-1">
                {COLORS.map(color => (
                  <button
                    key={color}
                    className="size-6 rounded-full border border-stone-200 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => { editor.chain().focus().setColor(color).run(); setColorOpen(false) }}
                  />
                ))}
                <button
                  className="size-6 rounded-full border border-stone-200 hover:scale-110 transition-transform flex items-center justify-center text-[10px] text-stone-400"
                  onClick={() => { editor.chain().focus().unsetColor().run(); setColorOpen(false) }}
                  title="Remove color"
                >
                  ✕
                </button>
              </div>
            </>
          )}
        </div>

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
    <div
      className="prose prose-sm max-w-none text-stone-700"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

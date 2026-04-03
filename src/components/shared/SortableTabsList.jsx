import { useState, useEffect } from 'react'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { getAppConfig, setAppConfig } from '@/lib/db'

function SortableTab({ id, children, isLocked, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isLocked,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      {!isLocked && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing px-0.5 text-stone-300 hover:text-stone-500 opacity-0 group-hover/tabs:opacity-100 transition-opacity"
          tabIndex={-1}
        >
          <GripVertical className="size-3" />
        </button>
      )}
      <TabsTrigger value={id} {...props}>{children}</TabsTrigger>
    </div>
  )
}

/**
 * Sortable tabs list. Overview is always locked first.
 *
 * @param {string} configKey - Unique key for persisting order, e.g. "surrogate_123"
 * @param {Array<{value: string, label: React.ReactNode}>} tabs - Tab definitions
 */
export default function SortableTabsList({ configKey, tabs }) {
  const [order, setOrder] = useState(tabs.map(t => t.value))
  const [loaded, setLoaded] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Load saved order
  useEffect(() => {
    if (!configKey) { setLoaded(true); return }
    getAppConfig(`tab_order_${configKey}`).then(saved => {
      if (saved && Array.isArray(saved)) {
        // Merge: keep saved order, append any new tabs not in saved
        const allValues = tabs.map(t => t.value)
        const validSaved = saved.filter(v => allValues.includes(v))
        const missing = allValues.filter(v => !validSaved.includes(v))
        // Ensure 'overview' stays first
        const merged = ['overview', ...validSaved.filter(v => v !== 'overview'), ...missing.filter(v => v !== 'overview')]
        setOrder(merged)
      }
    }).catch(() => {}).finally(() => setLoaded(true))
  }, [configKey])

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    // Don't allow dropping into position 0 (overview is locked)
    const oldIndex = order.indexOf(active.id)
    let newIndex = order.indexOf(over.id)
    if (newIndex === 0) newIndex = 1 // can't replace overview
    if (oldIndex === 0) return // can't move overview

    const newOrder = arrayMove(order, oldIndex, newIndex)
    setOrder(newOrder)
    // Persist
    if (configKey) {
      setAppConfig(`tab_order_${configKey}`, newOrder).catch(() => {})
    }
  }

  // Sort tabs by current order
  const sortedTabs = [...tabs].sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value))

  if (!loaded) {
    return (
      <TabsList>
        {tabs.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
      </TabsList>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={horizontalListSortingStrategy}>
        <TabsList className="group/tabs">
          {sortedTabs.map(t => (
            <SortableTab key={t.value} id={t.value} isLocked={t.value === 'overview'} className={t.className}>
              {t.label}
            </SortableTab>
          ))}
        </TabsList>
      </SortableContext>
    </DndContext>
  )
}

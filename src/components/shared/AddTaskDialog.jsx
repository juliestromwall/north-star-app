import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { TASK_CATEGORIES } from '@/data/mock/tasks'

const EMPTY = { title: '', category: '', source: 'staff', dueDate: '' }

export default function AddTaskDialog({ onAddTask }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.category) return
    onAddTask({
      id: `t-${Date.now()}`,
      title: form.title.trim(),
      category: form.category,
      source: form.source,
      completed: false,
      dueDate: form.dueDate || null,
      createdDate: new Date().toISOString().split('T')[0],
      assignedBy: form.source === 'staff' ? 'Julie S.' : null,
    })
    setForm(EMPTY)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="size-3.5" /> Add Task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="Task title..."
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TASK_CATEGORIES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff Assigned</SelectItem>
                <SelectItem value="self">Self Created</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Due Date (optional)</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={e => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full" disabled={!form.title.trim() || !form.category}>
            Add Task
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { useState } from 'react'
import { ListTodo, CheckCircle2, Target, Zap, UserPlus, User, Calendar } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import StatCard from '@/components/shared/StatCard'
import AddTaskDialog from '@/components/shared/AddTaskDialog'
import { mockTasks, TASK_CATEGORIES } from '@/data/mock/tasks'
import { MATCH_STAGES } from '@/lib/constants'

const SOURCE_ICONS = {
  workflow: Zap,
  staff: UserPlus,
  self: User,
}

const SOURCE_LABELS = {
  workflow: 'Workflow',
  staff: 'Staff',
  self: 'Self',
}

export default function ProfileDashboardTab({ profileId, profileType, notes, matchStage }) {
  const [tasks, setTasks] = useState(
    mockTasks.filter(t => t.profileId === profileId && t.profileType === profileType)
  )

  const openCount = tasks.filter(t => !t.completed).length
  const completedCount = tasks.filter(t => t.completed).length

  function toggleTask(id) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  function addTask(task) {
    setTasks(prev => [...prev, { ...task, profileId, profileType }])
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return new Date(b.createdDate) - new Date(a.createdDate)
  })

  const recentNotes = [...(notes || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3)

  const currentStageIndex = matchStage ? MATCH_STAGES.indexOf(matchStage) : -1

  return (
    <div className="space-y-6 mt-4">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Open Tasks" value={openCount} icon={ListTodo} />
        <StatCard title="Completed" value={completedCount} icon={CheckCircle2} />
        <StatCard
          title="Current Stage"
          value={matchStage || 'Not Matched'}
          icon={Target}
        />
      </div>

      {/* Tasks Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tasks</CardTitle>
          <AddTaskDialog onAddTask={addTask} />
        </CardHeader>
        <CardContent>
          {sortedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet. Add one to get started.</p>
          ) : (
            <div className="space-y-2">
              {sortedTasks.map(task => {
                const SourceIcon = SOURCE_ICONS[task.source]
                const cat = TASK_CATEGORIES[task.category]
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`flex-shrink-0 size-5 rounded border-2 flex items-center justify-center transition-colors ${
                        task.completed
                          ? 'bg-abc-indigo border-abc-indigo text-white'
                          : 'border-muted-foreground/30 hover:border-abc-indigo'
                      }`}
                    >
                      {task.completed && <CheckCircle2 className="size-3" />}
                    </button>
                    <span className={`flex-1 text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </span>
                    {task.dueDate && !task.completed && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="size-3" />
                        {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {cat && (
                      <Badge variant="outline" className={`text-xs ${cat.color}`}>
                        {cat.label}
                      </Badge>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground" title={SOURCE_LABELS[task.source]}>
                      <SourceIcon className="size-3.5" />
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Two-Column: Recent Notes + Journey Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <div className="space-y-3">
                {recentNotes.map((note, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{note.author}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{note.text}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Journey Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Journey Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {currentStageIndex < 0 ? (
              <p className="text-sm text-muted-foreground">Not yet matched — journey tracking begins after a match is confirmed.</p>
            ) : (
              <div className="space-y-0">
                {MATCH_STAGES.map((stage, i) => {
                  const isCompleted = i < currentStageIndex
                  const isCurrent = i === currentStageIndex
                  const isFuture = i > currentStageIndex
                  const isLast = i === MATCH_STAGES.length - 1
                  return (
                    <div key={stage} className="flex items-start gap-3">
                      {/* Connector line + dot */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex-shrink-0 size-5 rounded-full flex items-center justify-center text-xs ${
                            isCompleted
                              ? 'bg-abc-indigo text-white'
                              : isCurrent
                                ? 'bg-abc-coral text-white ring-2 ring-abc-coral/30'
                                : 'bg-muted border-2 border-muted-foreground/20'
                          }`}
                        >
                          {isCompleted && <CheckCircle2 className="size-3" />}
                          {isCurrent && <span className="size-2 rounded-full bg-white" />}
                        </div>
                        {!isLast && (
                          <div className={`w-0.5 h-6 ${isCompleted ? 'bg-abc-indigo' : 'bg-muted-foreground/20'}`} />
                        )}
                      </div>
                      <span
                        className={`text-sm pt-0.5 ${
                          isCompleted
                            ? 'text-muted-foreground'
                            : isCurrent
                              ? 'font-semibold text-foreground'
                              : 'text-muted-foreground/60'
                        }`}
                      >
                        {stage}
                        {isCurrent && (
                          <span className="ml-2 text-xs text-abc-coral font-normal">Current</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { mockFormDefinitions } from '@/data/mock/forms'
import { fetchFormTemplates, seedFormTemplatesIfEmpty } from '@/lib/db'
import { Plus, Pencil, Eye, FileBarChart, FileText, Loader2 } from 'lucide-react'

// Normalize Supabase row → mock-shape so the rest of the page works
// without changes. Supabase uses snake_case + jsonb columns.
function normalizeDbRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    submissionCount: row.submission_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignedRoles: row.assigned_roles || [],
    sections: row.sections || [],
  }
}

export default function FormsListPage() {
  const { isAdmin, currentUser } = useRole()
  const [forms, setForms] = useState(null) // null = loading; [] = empty; [...] = loaded

  // Try Supabase; fall back to mock if the table doesn't exist yet (i.e.
  // the migration hasn't been run) or Supabase isn't configured. Admins
  // get a first-visit seed so the GC Application lands in the DB
  // automatically once the migration runs.
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (isAdmin) {
        await seedFormTemplatesIfEmpty(mockFormDefinitions)
      }
      const dbRows = await fetchFormTemplates()
      if (cancelled) return
      if (dbRows && dbRows.length > 0) {
        setForms(dbRows.map(normalizeDbRow))
      } else {
        setForms(mockFormDefinitions)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isAdmin])

  // Non-admins only see forms explicitly assigned to them (none yet — no backend)
  // When backend is connected, this will fetch user-specific form assignments
  const visibleForms = useMemo(() => {
    if (forms == null) return null
    if (isAdmin) return forms
    return [] // No forms until admin assigns them via backend
  }, [forms, isAdmin])

  if (visibleForms == null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-stone-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forms"
        subtitle={isAdmin ? 'Manage form definitions and review submissions' : 'Forms assigned to you'}
        actions={isAdmin && (
          <Button asChild>
            <Link to="/forms/builder"><Plus className="size-4" /> New Form</Link>
          </Button>
        )}
      />

      {visibleForms.length === 0 && !isAdmin ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="font-medium text-stone-600">No forms right now</p>
              <p className="text-sm text-stone-400 mt-1">
                When your team assigns forms for you to complete, they'll appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form Name</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead>Submissions</TableHead>}
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleForms.map(form => (
                  <TableRow key={form.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{form.title}</p>
                        <p className="text-xs text-muted-foreground">{form.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={form.status} />
                    </TableCell>
                    {isAdmin && (
                      <TableCell>{form.submissionCount}</TableCell>
                    )}
                    <TableCell className="text-muted-foreground text-sm">{form.updatedAt}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {form.status === 'published' && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/forms/${form.id}/submit`}>
                              <Eye className="size-4" />
                              {isAdmin ? 'Preview' : 'Fill Out'}
                            </Link>
                          </Button>
                        )}
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/forms/builder/${form.id}`}>
                                <Pencil className="size-4" />
                              </Link>
                            </Button>
                            {form.submissionCount > 0 && (
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={`/forms/${form.id}/responses`}>
                                  <FileBarChart className="size-4" />
                                </Link>
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

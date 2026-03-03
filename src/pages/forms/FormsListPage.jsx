import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useRole } from '@/context/RoleContext'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { mockFormDefinitions } from '@/data/mock/forms'
import { Plus, Pencil, Eye, FileBarChart } from 'lucide-react'

export default function FormsListPage() {
  const { isAdmin } = useRole()
  const [forms] = useState(mockFormDefinitions)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forms"
        subtitle={isAdmin ? 'Manage form definitions and review submissions' : 'Complete and view your forms'}
        actions={isAdmin && (
          <Button asChild>
            <Link to="/forms/builder"><Plus className="size-4" /> New Form</Link>
          </Button>
        )}
      />

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
              {forms.map(form => (
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
    </div>
  )
}

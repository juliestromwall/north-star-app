import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { mockFormDefinitions, mockFormResponses } from '@/data/mock/forms'
import { ArrowLeft, Eye } from 'lucide-react'

export default function FormResponsesPage() {
  const { formId } = useParams()
  const form = mockFormDefinitions.find(f => f.id === formId)
  const [responses, setResponses] = useState(
    mockFormResponses.filter(r => r.formId === formId)
  )
  const [selectedResponse, setSelectedResponse] = useState(null)

  if (!form) {
    return (
      <div className="space-y-6">
        <PageHeader title="Form Not Found" />
        <Button variant="outline" asChild>
          <Link to="/forms"><ArrowLeft className="size-4" /> Back to Forms</Link>
        </Button>
      </div>
    )
  }

  const allFields = form.sections.flatMap(s => s.fields)

  const updateStatus = (responseId, newStatus) => {
    setResponses(prev =>
      prev.map(r => r.id === responseId ? { ...r, status: newStatus } : r)
    )
    if (selectedResponse?.id === responseId) {
      setSelectedResponse(prev => ({ ...prev, status: newStatus }))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${form.title} — Responses`}
        subtitle={`${responses.length} submission${responses.length !== 1 ? 's' : ''}`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/forms"><ArrowLeft className="size-4" /> Back to Forms</Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Submitted By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {responses.map(resp => (
                <TableRow key={resp.id}>
                  <TableCell className="font-medium">{resp.submittedBy}</TableCell>
                  <TableCell className="text-muted-foreground">{resp.submittedAt}</TableCell>
                  <TableCell>
                    <StatusBadge status={resp.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Select
                        value={resp.status}
                        onValueChange={(val) => updateStatus(resp.id, val)}
                      >
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedResponse(resp)}
                      >
                        <Eye className="size-4" /> View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {responses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No submissions yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Response Detail Dialog */}
      <Dialog open={!!selectedResponse} onOpenChange={() => setSelectedResponse(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedResponse && (
            <>
              <DialogHeader>
                <DialogTitle>Submission by {selectedResponse.submittedBy}</DialogTitle>
                <DialogDescription>
                  Submitted {selectedResponse.submittedAt} — <StatusBadge status={selectedResponse.status} />
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {form.sections.map(section => (
                  <div key={section.id}>
                    <h3 className="font-heading font-semibold text-sm mb-3 text-abc-indigo">{section.title}</h3>
                    <div className="space-y-3">
                      {section.fields.map(field => {
                        const answer = selectedResponse.answers[field.id]
                        return (
                          <div key={field.id} className="grid grid-cols-2 gap-2">
                            <p className="text-sm text-muted-foreground">{field.label}</p>
                            <p className="text-sm font-medium">
                              {answer
                                ? Array.isArray(answer) ? answer.join(', ') : String(answer)
                                : <span className="text-muted-foreground italic">Not answered</span>
                              }
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

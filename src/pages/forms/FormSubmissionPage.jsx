import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import PageHeader from '@/components/shared/PageHeader'
import FormFieldRenderer, { passesShowWhen } from '@/components/forms/FormFieldRenderer'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { mockFormDefinitions } from '@/data/mock/forms'
import { ArrowLeft, ArrowRight, Send, Save } from 'lucide-react'

export default function FormSubmissionPage() {
  const { formId } = useParams()
  const form = mockFormDefinitions.find(f => f.id === formId)
  const [currentSection, setCurrentSection] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

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

  const sections = form.sections
  const section = sections[currentSection]
  const isFirst = currentSection === 0
  const isLast = currentSection === sections.length - 1

  const handleFieldChange = (fieldId, value) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }))
  }

  const handleSubmit = () => {
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <PageHeader title={form.title} subtitle="Submission complete" />
        <Card>
          <CardContent className="py-16 text-center">
            <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Send className="size-8 text-green-600" />
            </div>
            <h2 className="text-lg font-heading font-semibold mb-2">Form Submitted Successfully</h2>
            <p className="text-muted-foreground mb-6">Your submission has been received and will be reviewed by our team.</p>
            <Button asChild>
              <Link to="/forms">Back to Forms</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={form.title}
        subtitle={form.description}
        actions={
          <Button variant="outline" asChild>
            <Link to="/forms"><ArrowLeft className="size-4" /> Back</Link>
          </Button>
        }
      />

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        {sections.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrentSection(i)}
            className="flex-1 group"
          >
            <div className={`h-2 rounded-full transition-colors ${
              i <= currentSection ? 'bg-abc-indigo' : 'bg-muted'
            }`} />
            <p className={`text-xs mt-1 truncate ${
              i === currentSection ? 'text-abc-indigo font-medium' : 'text-muted-foreground'
            }`}>
              {s.title}
            </p>
          </button>
        ))}
      </div>

      {/* Current Section */}
      <Card>
        <CardHeader>
          <CardTitle>{section.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Section {currentSection + 1} of {sections.length}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(() => {
              let lastGroup = null
              return section.fields
                .filter(f => passesShowWhen(f, answers))
                .map(field => {
                  // Emit a group divider when the group label changes.
                  const showGroup = field.group && field.group !== lastGroup
                  if (showGroup) lastGroup = field.group
                  return (
                    <div key={field.id} className="space-y-4">
                      {showGroup && (
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t first:border-t-0 first:pt-0">
                          {field.group}
                        </p>
                      )}
                      <FormFieldRenderer
                        field={field}
                        value={answers[field.id]}
                        onChange={handleFieldChange}
                      />
                    </div>
                  )
                })
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentSection(prev => prev - 1)}
          disabled={isFirst}
        >
          <ArrowLeft className="size-4" /> Previous
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Save className="size-4" /> Save Draft
          </Button>
          {isLast ? (
            <Button onClick={handleSubmit}>
              <Send className="size-4" /> Submit
            </Button>
          ) : (
            <Button onClick={() => setCurrentSection(prev => prev + 1)}>
              Next <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

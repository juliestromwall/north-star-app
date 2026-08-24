// Email templates for case-level sending
// Each template has: id, name, subject (with merge fields), body (HTML with merge fields)
// Merge fields: {{first_name}}, {{full_name}}, {{case_manager}}, {{ip_names}}, {{gc_name}}, {{portal_link}}

export const EMAIL_TEMPLATES = [
  {
    id: 'gc_welcome',
    name: 'GC — Welcome & Quiz Received',
    forType: 'gc',
    subject: 'We received your application, {{first_name}}!',
    body: `
      <p>Hi {{first_name}},</p>
      <p>Thank you so much for taking the time to complete our surrogacy quiz! We're thrilled that you're interested in becoming a surrogate with <strong>First Star Surrogacy</strong></p>
      <p><strong>What happens next?</strong></p>
      <ol>
        <li>Our team is reviewing your quiz results now</li>
        <li>A case manager will reach out to you shortly to schedule a screening call</li>
        <li>We'll guide you through every step of the process</li>
      </ol>
      <p>In the meantime, if you have any questions, don't hesitate to reach out to us at <a href="mailto:info@northstarsurrogacy.com">info@northstarsurrogacy.com</a>.</p>
      <p>We're so excited to get to know you!</p>
      <p>Warmly,<br/>The First Star Surrogacy Team</p>
    `,
  },
  {
    id: 'gc_screening_scheduled',
    name: 'GC — Screening Call Scheduled',
    forType: 'gc',
    subject: 'Your screening call is scheduled, {{first_name}}!',
    body: `
      <p>Hi {{first_name}},</p>
      <p>Great news! Your screening call has been scheduled with your case manager, <strong>{{case_manager}}</strong>.</p>
      <p>During this call, we'll:</p>
      <ul>
        <li>Get to know you better</li>
        <li>Answer any questions you have about the surrogacy process</li>
        <li>Discuss next steps in your journey</li>
      </ul>
      <p>If you need to reschedule, please let us know as soon as possible.</p>
      <p>We look forward to speaking with you!</p>
      <p>Warmly,<br/>{{case_manager}}<br/>First Star Surrogacy</p>
    `,
  },
  {
    id: 'gc_profile_reminder',
    name: 'GC — Complete Your Profile',
    forType: 'gc',
    subject: 'Complete your surrogate profile, {{first_name}}',
    body: `
      <p>Hi {{first_name}},</p>
      <p>We noticed your surrogate profile hasn't been completed yet. Your profile is an important part of the matching process — it helps intended parents get to know you!</p>
      <p>Log in to your portal to complete your profile:</p>
      <p style="text-align: center;"><a href="https://app.firststarsurrogacy.com/login" style="display: inline-block; background: linear-gradient(135deg, #1F3A3C, #5A9EA2); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Complete My Profile</a></p>
      <p>If you need help or have questions, your case manager <strong>{{case_manager}}</strong> is here for you.</p>
      <p>Warmly,<br/>The First Star Surrogacy Team</p>
    `,
  },
  {
    id: 'ip_welcome',
    name: 'IP — Welcome & Application Received',
    forType: 'ip',
    subject: 'Welcome to Abundant Beginnings, {{first_name}}!',
    body: `
      <p>Hi {{first_name}},</p>
      <p>Thank you for reaching out to <strong>First Star Surrogacy</strong>! We're honored that you're considering us to help grow your family.</p>
      <p><strong>What happens next?</strong></p>
      <ol>
        <li>Our team is reviewing your application</li>
        <li>We'll be in touch shortly to schedule an introductory call</li>
        <li>We'll discuss your preferences and the surrogacy journey ahead</li>
      </ol>
      <p>If you have any questions in the meantime, please don't hesitate to reach out at <a href="mailto:info@northstarsurrogacy.com">info@northstarsurrogacy.com</a>.</p>
      <p>We can't wait to help you on this journey!</p>
      <p>Warmly,<br/>The First Star Surrogacy Team</p>
    `,
  },
  {
    id: 'match_intro',
    name: 'Match Introduction',
    forType: 'journey',
    subject: 'Exciting news — you\'ve been matched!',
    body: `
      <p>Hi {{first_name}},</p>
      <p>We have wonderful news! After careful consideration, we believe we've found a great match for you.</p>
      <p>Your case manager <strong>{{case_manager}}</strong> will be reaching out to schedule a meeting so everyone can get acquainted. This is an exciting milestone in your surrogacy journey!</p>
      <p>If you have any questions before your meeting, don't hesitate to reach out.</p>
      <p>Warmly,<br/>{{case_manager}}<br/>First Star Surrogacy</p>
    `,
  },
]

/**
 * Merge template fields with case data
 */
export function mergeTemplate(template, data) {
  let subject = template.subject
  let body = template.body

  const replacements = {
    '{{first_name}}': data.firstName || '',
    '{{full_name}}': data.fullName || '',
    '{{case_manager}}': data.caseManager || 'your case manager',
    '{{ip_names}}': data.ipNames || '',
    '{{gc_name}}': data.gcName || '',
    '{{portal_link}}': 'https://app.firststarsurrogacy.com/login',
  }

  for (const [key, val] of Object.entries(replacements)) {
    subject = subject.replaceAll(key, val)
    body = body.replaceAll(key, val)
  }

  return { subject, body }
}

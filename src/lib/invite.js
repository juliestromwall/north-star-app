import { sendEmail } from './google'

/**
 * Invite a user to the portal.
 * 1. Calls /api/invite to create Supabase auth user + get reset link
 * 2. Sends branded invite email via Gmail API
 *
 * @param {string} userId - Current admin's Supabase user ID (for sending email)
 * @param {object} opts - { email, name, role, portalType }
 *   portalType: 'surrogate' | 'intended_parent' | 'admin'
 */
export async function inviteUser(userId, { email, name, role, portalType }) {
  // 1. Create user + get reset link
  const res = await fetch('/api/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, role }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'Failed to create invite')

  const resetLink = result.resetLink
  if (!resetLink) throw new Error('Could not generate invite link')

  // 2. Build branded email
  const portalLabel = portalType === 'admin' ? 'team member' : portalType === 'intended_parent' ? 'intended parent' : 'surrogate'
  const subject = `You're invited to your ABC Surrogacy portal`

  const body = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="text-align: center; padding: 32px 24px 16px;">
        <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="Abundant Beginnings Co." style="max-width: 200px;" />
      </div>

      <div style="padding: 0 32px 32px;">
        <h1 style="color: #283693; font-size: 24px; margin: 0 0 8px; text-align: center;">
          Welcome to your <span style="color: #ed148c;">secure portal</span>
        </h1>
        <p style="color: #78716c; text-align: center; font-size: 14px; margin: 0 0 24px;">
          Abundant Beginnings Co. has set up your ${portalLabel} account
        </p>

        <div style="background: linear-gradient(135deg, #fef9fb, #f0f1fa); border-radius: 12px; padding: 20px; margin: 0 0 24px;">
          <p style="margin: 0; font-size: 14px; color: #44403c;">
            Hi${name ? ' ' + name.split(' ')[0] : ''},
          </p>
          <p style="margin: 8px 0 0; font-size: 14px; color: #44403c; line-height: 1.6;">
            Your account has been created at <strong>app.abcsurrogacy.com</strong>.
            Click the button below to set your password and access your portal.
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 14px 40px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Set Your Password
          </a>
        </div>

        <p style="color: #a8a29e; font-size: 12px; text-align: center; margin-top: 24px; line-height: 1.5;">
          This link will expire in 24 hours. If you didn't expect this invitation,
          you can safely ignore this email.
        </p>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />

        <p style="color: #a8a29e; font-size: 11px; text-align: center;">
          Abundant Beginnings Company, LLC · abcsurrogacy.com
        </p>
      </div>
    </div>
  `

  // 3. Send via Gmail
  await sendEmail(userId, { to: email, subject, body })

  return { success: true, userId: result.userId }
}

// Cloudflare Pages Function — POST /api/notify-ip-application
// Notifies admin when a new intended parent application is submitted

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

function yn(val) {
  if (val === true) return 'Yes'
  if (val === false) return 'No'
  return '—'
}

function row(label, value) {
  if (!value && value !== false) return ''
  const display = typeof value === 'boolean' ? yn(value) : (value || '—')
  return `<tr style="border-bottom: 1px solid #f0f0f0;">
    <td style="padding: 8px 0; color: #78716c; width: 180px; font-size: 13px;"><strong>${label}</strong></td>
    <td style="padding: 8px 0; color: #1a1a2e; font-size: 13px;">${display}</td>
  </tr>`
}

export async function onRequestPost(context) {
  const { env } = context
  const resendKey = env.RESEND_API_KEY
  const fromEmail = env.WELCOME_FROM_EMAIL || 'noreply@abcsurrogacy.com'
  const notifyEmails = (env.IP_APPLICATION_NOTIFY_EMAIL || 'juliestromwall@gmail.com')
    .split(',').map(e => e.trim()).filter(Boolean)

  const { answers } = await context.request.json()
  const a = answers || {}

  const applicantName = `${a.primaryFirstName || ''} ${a.primaryLastName || ''}`.trim() || 'Unknown'
  const hasPartner = a.hasPartner === true

  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'Resend not configured' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  const htmlBody = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="text-align: center; padding: 24px 24px 12px;">
        <img src="https://app.abcsurrogacy.com/abc-logo.png" alt="ABC Surrogacy" style="max-width: 160px;" />
      </div>
      <div style="padding: 0 32px 32px;">
        <h1 style="color: #283693; font-size: 20px; margin: 0 0 20px; text-align: center;">
          New Intended Parent Application
        </h1>

        <!-- Primary Parent -->
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; color: #283693; text-transform: uppercase; letter-spacing: 0.05em;">Primary Parent</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          ${row('Name', applicantName)}
          ${row('Date of Birth', a.primaryDob)}
          ${row('Email', a.email ? `<a href="mailto:${a.email}" style="color: #283693;">${a.email}</a>` : null)}
          ${row('Phone', a.phone ? `${a.phoneCountry || '+1'} ${a.phone}` : null)}
        </table>

        ${hasPartner ? `
        <!-- Partner -->
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; color: #ed148c; text-transform: uppercase; letter-spacing: 0.05em;">Partner</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          ${row('Name', `${a.ip2FirstName || ''} ${a.ip2LastName || ''}`.trim())}
          ${row('Date of Birth', a.ip2Dob)}
          ${row('Email', a.ip2Email ? `<a href="mailto:${a.ip2Email}" style="color: #283693;">${a.ip2Email}</a>` : null)}
          ${row('Phone', a.ip2Phone ? `${a.ip2PhoneCountry || '+1'} ${a.ip2Phone}` : null)}
        </table>
        ` : `
        <p style="margin: 0 0 20px; font-size: 13px; color: #78716c; font-style: italic;">Single parent (no partner)</p>
        `}

        <!-- Location -->
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; color: #283693; text-transform: uppercase; letter-spacing: 0.05em;">Location</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          ${row('Country', a.country)}
          ${row('Address', [a.street, a.street2].filter(Boolean).join(', '))}
          ${row('City', a.city)}
          ${row('State / Province', a.stateProv)}
          ${row('Zip / Postal Code', a.zipCode)}
        </table>

        <!-- Fertility -->
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; color: #283693; text-transform: uppercase; letter-spacing: 0.05em;">Fertility Information</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          ${row('Working with an RE?', a.hasRE)}
          ${a.hasRE ? row('RE Doctor Name', a.reDoctorName) : ''}
          ${row('Has Frozen Embryos?', a.hasFrozenEmbryos)}
          ${a.hasFrozenEmbryos ? row('Embryo Details', a.frozenEmbryoDetails) : ''}
          ${row('Using Egg Donor?', a.usingEggDonor)}
          ${row('Using Sperm Donor?', a.usingSpermDonor)}
        </table>

        <!-- Other -->
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; color: #283693; text-transform: uppercase; letter-spacing: 0.05em;">Other</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          ${row('Wants Consultation?', a.wantsConsultation)}
          ${row('How They Heard About Us', a.hearAboutUs)}
          ${a.referralName ? row('Referred By', a.referralName) : ''}
        </table>

        <div style="text-align: center; margin: 20px 0;">
          <a href="https://app.abcsurrogacy.com/intended-parents" style="display: inline-block; background: linear-gradient(135deg, #ed148c, #283693); color: white; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
            View in Dashboard
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 20px 0;" />
        <p style="color: #a8a29e; font-size: 10px; text-align: center;">
          Abundant Beginnings Company, LLC &middot; abcsurrogacy.com
        </p>
      </div>
    </div>
  `

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `ABC Surrogacy <${fromEmail}>`,
        to: notifyEmails,
        subject: `New Intended Parent Application — ${applicantName}`,
        html: htmlBody,
      }),
    })
  } catch (err) {
    console.error('IP notify email failed:', err)
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

import { Resend } from 'resend'

// Initialize Resend if API key is provided
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const emailTemplate = (teamName: string, inviterName: string, role: string, inviteUrl: string) => `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invitation to join ${teamName}</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                  You've been invited to join ${teamName}
                </h1>
                <p style="margin: 0 0 16px 0; font-size: 16px; color: #4a4a4a; line-height: 1.5;">
                  ${inviterName} has invited you to join the <strong>${teamName}</strong> team as a <strong>${role}</strong> on Doable.
                </p>
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #4a4a4a; line-height: 1.5;">
                  Click the button below to accept the invitation:
                </p>
                <a href="${inviteUrl}" style="display: inline-block; background-color: #0066cc; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: 500; margin-bottom: 24px;">
                  Accept Invitation
                </a>
                <p style="margin: 0; font-size: 14px; color: #888; line-height: 1.5;">
                  Or copy and paste this URL into your browser:<br>
                  <a href="${inviteUrl}" style="color: #0066cc; word-break: break-all;">${inviteUrl}</a>
                </p>
                <hr style="margin: 32px 0; border: none; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0; font-size: 14px; color: #888;">
                  If you didn't expect this invitation, you can safely ignore this email.
                </p>
              </div>
            </div>
          </body>
        </html>
      `

export async function sendInvitationEmail(params: {
  email: string
  teamName: string
  inviterName: string
  role: string
  inviteUrl: string
}) {
  const { email, teamName, inviterName, role, inviteUrl } = params

  try {
    // Check if Resend is configured
    if (!resend || !process.env.RESEND_API_KEY) {
      console.log('📧 EMAIL DISABLED - Resend API key not configured')
      console.log('📧 Copy this invitation URL to manually invite users:')
      console.log('   Invitation URL:', inviteUrl)
      console.log('   For email:', email)
      console.log('   💡 Tip: Add RESEND_API_KEY to .env')
      return { success: true, skipped: true }
    }

    // Send email via Resend
    // Use verified domain: doable.kartiklabhshetwar.me
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'demo@siu.in'
    
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `You've been invited to join ${teamName} on Doable`,
      html: emailTemplate(teamName, inviterName, role, inviteUrl),
    })

    if (error) {
      console.error('Resend error:', error)
      throw error
    }

    console.log('✅ Email sent via Resend:', data)
    return { success: true }
  } catch (error: any) {
    console.error('Error sending invitation email:', error)
    console.log('📧 Invitation created in database, but email failed.')
    console.log('📧 Copy this invitation URL to manually invite:')
    console.log('   URL:', inviteUrl)
    return { success: false, error }
  }
}

export async function sendVerificationEmail(params: {
  email: string
  url: string
  token: string
}) {
  const { email, url } = params

  try {
    if (!resend || !process.env.RESEND_API_KEY) {
      console.log('📧 EMAIL DISABLED - Resend API key not configured')
      console.log('   Verification URL:', url)
      return { success: true, skipped: true }
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'demo@siu.in'
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Verify your email address - SIU-ERPOS',
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><title>Verify your email</title></head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                  Verify your email address
                </h1>
                <p style="margin: 0 0 24px 0; font-size: 16px; color: #4a4a4a; line-height: 1.5;">
                  Please confirm your email address by clicking the button below. This link expires in 1 hour.
                </p>
                <a href="${url}" style="display: inline-block; background-color: #0066cc; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: 500; margin-bottom: 24px;">
                  Verify Email
                </a>
                <p style="margin: 0; font-size: 14px; color: #888;">
                  Or copy and paste this link in your browser:<br>
                  <a href="${url}" style="color: #0066cc; word-break: break-all;">${url}</a>
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    })

    if (error) {
      console.error('Resend verification error:', error)
      throw error
    }

    return { success: true, data }
  } catch (error: any) {
    console.error('Error sending verification email:', error)
    return { success: false, error }
  }
}

export async function sendResetPasswordEmail(params: {
  email: string
  url: string
  token: string
}) {
  const { email, url } = params

  try {
    if (!resend || !process.env.RESEND_API_KEY) {
      console.log('📧 EMAIL DISABLED - Resend API key not configured')
      console.log('   Password Reset URL:', url)
      return { success: true, skipped: true }
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'demo@siu.in'
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Reset your password - SIU-ERPOS',
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><title>Reset your password</title></head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background-color: white; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
                  Reset your password
                </h1>
                <p style="margin: 0 0 24px 0; font-size: 16px; color: #4a4a4a; line-height: 1.5;">
                  We received a request to reset your password for your SIU-ERPOS account. Click the button below to set a new password. This link expires in 1 hour.
                </p>
                <a href="${url}" style="display: inline-block; background-color: #0066cc; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: 500; margin-bottom: 24px;">
                  Reset Password
                </a>
                <p style="margin: 0 0 24px 0; font-size: 14px; color: #888;">
                  Or copy and paste this link in your browser:<br>
                  <a href="${url}" style="color: #0066cc; word-break: break-all;">${url}</a>
                </p>
                <p style="margin: 0; font-size: 14px; color: #888;">
                  If you did not request a password reset, you can safely ignore this email.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    })

    if (error) {
      console.error('Resend reset password error:', error)
      throw error
    }

    return { success: true, data }
  } catch (error: any) {
    console.error('Error sending reset password email:', error)
    return { success: false, error }
  }
}

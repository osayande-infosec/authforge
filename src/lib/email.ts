// Email Service using Resend
// https://resend.com/docs/send-with-cloudflare-workers

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface ResendResponse {
  id?: string;
  error?: {
    message: string;
    name: string;
  };
}

export class EmailService {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;

  constructor(apiKey: string, fromEmail: string = 'AuthForge <noreply@authforge.dev>') {
    this.apiKey = apiKey;
    const [name, email] = fromEmail.includes('<') 
      ? fromEmail.match(/(.+)\s*<(.+)>/)?.slice(1) || ['AuthForge', fromEmail]
      : ['AuthForge', fromEmail];
    this.fromName = name.trim();
    this.fromEmail = email.replace(/[<>]/g, '').trim();
  }

  async send(options: EmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });

      const data = await response.json() as ResendResponse;

      if (!response.ok) {
        console.error('Resend API error:', data);
        return { 
          success: false, 
          error: data.error?.message || 'Failed to send email' 
        };
      }

      return { success: true, id: data.id };
    } catch (error) {
      console.error('Email send error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Email verification template
  async sendVerificationEmail(to: string, verifyUrl: string): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - AuthForge</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                🔐 AuthForge
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; color: #f1f5f9; font-size: 24px; font-weight: 600;">
                Verify Your Email Address
              </h2>
              <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 16px; line-height: 1.6;">
                Thanks for signing up! Please click the button below to verify your email address and activate your account.
              </p>
              
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 8px;">
                    <a href="${verifyUrl}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      ✓ Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0 0; word-break: break-all;">
                <a href="${verifyUrl}" style="color: #60a5fa; font-size: 14px; text-decoration: none;">
                  ${verifyUrl}
                </a>
              </p>
              
              <!-- Security Notice -->
              <div style="margin-top: 32px; padding: 16px; background-color: #0f172a; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #fbbf24; font-size: 14px; font-weight: 600;">
                  ⚠️ Security Notice
                </p>
                <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                  This link expires in 24 hours. If you didn't create an account with AuthForge, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #334155;">
              <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} AuthForge • Self-Hosted Authentication Platform
              </p>
              <p style="margin: 8px 0 0 0; color: #475569; font-size: 11px; text-align: center;">
                Built with Cloudflare Workers • Passkeys • OAuth • 2FA
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const text = `
Verify Your Email Address - AuthForge

Thanks for signing up! Please click the link below to verify your email address:

${verifyUrl}

This link expires in 24 hours.

If you didn't create an account with AuthForge, you can safely ignore this email.

---
AuthForge • Self-Hosted Authentication Platform
    `.trim();

    return this.send({
      to,
      subject: '🔐 Verify Your Email - AuthForge',
      html,
      text,
    });
  }

  // Password reset template
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - AuthForge</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                🔐 AuthForge
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; color: #f1f5f9; font-size: 24px; font-weight: 600;">
                Reset Your Password
              </h2>
              <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to choose a new password.
              </p>
              
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); border-radius: 8px;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      🔑 Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0 0; word-break: break-all;">
                <a href="${resetUrl}" style="color: #60a5fa; font-size: 14px; text-decoration: none;">
                  ${resetUrl}
                </a>
              </p>
              
              <!-- Security Notice -->
              <div style="margin-top: 32px; padding: 16px; background-color: #0f172a; border-radius: 8px; border-left: 4px solid #ef4444;">
                <p style="margin: 0; color: #f87171; font-size: 14px; font-weight: 600;">
                  🚨 Didn't request this?
                </p>
                <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                  If you didn't request a password reset, someone may be trying to access your account. You can safely ignore this email, and your password will remain unchanged.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #334155;">
              <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                This link expires in 1 hour for security reasons.
              </p>
              <p style="margin: 8px 0 0 0; color: #475569; font-size: 11px; text-align: center;">
                © ${new Date().getFullYear()} AuthForge • Self-Hosted Authentication Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const text = `
Reset Your Password - AuthForge

We received a request to reset your password. Click the link below to choose a new password:

${resetUrl}

This link expires in 1 hour.

If you didn't request this, someone may be trying to access your account. You can safely ignore this email, and your password will remain unchanged.

---
AuthForge • Self-Hosted Authentication Platform
    `.trim();

    return this.send({
      to,
      subject: '🔑 Reset Your Password - AuthForge',
      html,
      text,
    });
  }

  // Magic link login template
  async sendMagicLinkEmail(to: string, magicUrl: string): Promise<{ success: boolean; error?: string }> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In to AuthForge</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                🔐 AuthForge
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; color: #f1f5f9; font-size: 24px; font-weight: 600;">
                Sign In with Magic Link
              </h2>
              <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 16px; line-height: 1.6;">
                Click the button below to securely sign in to your AuthForge account. No password needed!
              </p>
              
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); border-radius: 8px;">
                    <a href="${magicUrl}" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                      ✨ Sign In Now
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0 0; word-break: break-all;">
                <a href="${magicUrl}" style="color: #60a5fa; font-size: 14px; text-decoration: none;">
                  ${magicUrl}
                </a>
              </p>
              
              <!-- Security Notice -->
              <div style="margin-top: 32px; padding: 16px; background-color: #0f172a; border-radius: 8px; border-left: 4px solid #10b981;">
                <p style="margin: 0; color: #34d399; font-size: 14px; font-weight: 600;">
                  🔒 Secure & Passwordless
                </p>
                <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                  This link expires in 15 minutes and can only be used once. If you didn't request this link, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #0f172a; border-top: 1px solid #334155;">
              <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                © ${new Date().getFullYear()} AuthForge • Self-Hosted Authentication Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const text = `
Sign In to AuthForge

Click the link below to securely sign in to your account:

${magicUrl}

This link expires in 15 minutes and can only be used once.

If you didn't request this link, you can safely ignore this email.

---
AuthForge • Self-Hosted Authentication Platform
    `.trim();

    return this.send({
      to,
      subject: '✨ Sign In to AuthForge',
      html,
      text,
    });
  }
}

// Factory function for creating email service
export function createEmailService(env: { RESEND_API_KEY?: string; EMAIL_FROM?: string }): EmailService | null {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - email sending disabled');
    return null;
  }
  
  return new EmailService(
    env.RESEND_API_KEY,
    env.EMAIL_FROM || 'AuthForge <noreply@authforge.dev>'
  );
}

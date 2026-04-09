import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM_EMAIL || 'Tracktio <noreply@tracktio.app>'

interface SendEmailParams {
  to: string
  subject: string
  html: string
  workspaceId?: string
  contactId?: string
}

function getServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
  )
}

/**
 * Inject a tracking pixel into HTML email body and record tracking entry.
 */
async function injectTrackingPixel(
  html: string,
  params: { to: string; subject: string; workspaceId?: string; contactId?: string },
): Promise<{ html: string; trackingId: string | null }> {
  const supabase = getServiceSupabase()
  if (!supabase || !params.workspaceId) {
    return { html, trackingId: null }
  }

  const trackingId = crypto.randomUUID()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tracktio.app'
  const pixel = `<img src="${baseUrl}/api/email/track?id=${trackingId}" width="1" height="1" style="display:none" />`

  // Store tracking record
  await supabase.from('email_tracking').insert({
    id: trackingId,
    workspace_id: params.workspaceId,
    contact_id: params.contactId || null,
    email_to: params.to,
    subject: params.subject,
    metadata: {},
  })

  // Inject pixel before closing </body> tag, or append at end
  const injectedHtml = html.includes('</body>')
    ? html.replace('</body>', `${pixel}</body>`)
    : html + pixel

  return { html: injectedHtml, trackingId }
}

export async function sendTransactionalEmail({ to, subject, html, workspaceId, contactId }: SendEmailParams) {
  if (!resend) {
    return { success: false, reason: 'not_configured' }
  }

  // Inject tracking pixel
  const { html: trackedHtml, trackingId } = await injectTrackingPixel(html, {
    to,
    subject,
    workspaceId,
    contactId,
  })

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html: trackedHtml,
    })
    if (error) {
      return { success: false, reason: error.message }
    }
    return { success: true, id: data?.id, trackingId }
  } catch {
    return { success: false, reason: 'unknown_error' }
  }
}

// ── EMAIL TEMPLATES ──

export function welcomeEmail(userName: string) {
  const name = userName.split(' ')[0] || 'there'
  return {
    subject: 'Welcome to Tracktio — your workspace is ready',
    html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#6172f3,#3b3fce);border-radius:14px;line-height:48px;color:white;font-size:20px;">⚡</div>
  </div>
  <div style="background:white;border-radius:16px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 8px;font-size:22px;color:#151b3a;">Welcome to Tracktio, ${name}!</h1>
    <p style="margin:0 0 24px;color:#6b75a0;font-size:15px;line-height:1.6;">Your workspace is ready. Here's how to get the most out of it:</p>

    <div style="margin-bottom:20px;padding:16px;background:#f8f9fc;border-radius:12px;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#151b3a;">1. Add your first contact</p>
      <p style="margin:0;font-size:13px;color:#6b75a0;">Import a CSV or create contacts manually.</p>
    </div>
    <div style="margin-bottom:20px;padding:16px;background:#f8f9fc;border-radius:12px;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#151b3a;">2. Create your first deal</p>
      <p style="margin:0;font-size:13px;color:#6b75a0;">Start tracking opportunities in your pipeline.</p>
    </div>
    <div style="margin-bottom:24px;padding:16px;background:#f8f9fc;border-radius:12px;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#151b3a;">3. Connect your email</p>
      <p style="margin:0;font-size:13px;color:#6b75a0;">Sync Gmail or Outlook for zero data entry.</p>
    </div>

    <div style="text-align:center;">
      <a href="https://tracktio.app/dashboard" style="display:inline-block;padding:12px 32px;background:#6172f3;color:white;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Go to Dashboard</a>
    </div>
  </div>
  <p style="text-align:center;margin-top:24px;color:#9ba3c0;font-size:12px;">
    Tracktio — Run your business, not your software.
  </p>
</div>
</body></html>`,
  }
}

export function invoiceEmail(clientName: string, invoiceNumber: string, total: string, dueDate: string, paymentUrl?: string) {
  return {
    subject: `Invoice ${invoiceNumber} from Tracktio`,
    html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#6172f3,#3b3fce);border-radius:14px;line-height:48px;color:white;font-size:20px;">⚡</div>
  </div>
  <div style="background:white;border-radius:16px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 8px;font-size:22px;color:#151b3a;">Invoice ${invoiceNumber}</h1>
    <p style="margin:0 0 24px;color:#6b75a0;font-size:15px;">Hi ${clientName}, here's your invoice summary:</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr style="border-bottom:1px solid #e4e7f0;">
        <td style="padding:12px 0;color:#6b75a0;font-size:14px;">Invoice Number</td>
        <td style="padding:12px 0;text-align:right;font-weight:600;color:#151b3a;font-size:14px;">${invoiceNumber}</td>
      </tr>
      <tr style="border-bottom:1px solid #e4e7f0;">
        <td style="padding:12px 0;color:#6b75a0;font-size:14px;">Amount Due</td>
        <td style="padding:12px 0;text-align:right;font-weight:700;color:#151b3a;font-size:18px;">${total}</td>
      </tr>
      <tr>
        <td style="padding:12px 0;color:#6b75a0;font-size:14px;">Due Date</td>
        <td style="padding:12px 0;text-align:right;font-weight:600;color:#151b3a;font-size:14px;">${dueDate}</td>
      </tr>
    </table>

    ${paymentUrl ? `
    <div style="text-align:center;">
      <a href="${paymentUrl}" style="display:inline-block;padding:12px 32px;background:#10b981;color:white;text-decoration:none;border-radius:12px;font-size:14px;font-weight:600;">Pay Now</a>
    </div>
    ` : ''}
  </div>
  <p style="text-align:center;margin-top:24px;color:#9ba3c0;font-size:12px;">
    Sent via Tracktio — Run your business, not your software.
  </p>
</div>
</body></html>`,
  }
}

import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_USER || !env.SMTP_PASS || !env.MAIL_FROM) return null;
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return cachedTransporter;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter || !env.MAIL_FROM) {
    // eslint-disable-next-line no-console
    console.warn('[email] SMTP not configured; skipping send to', input.to, '-', input.subject);
    return false;
  }
  try {
    await transporter.sendMail({
      from: env.MAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] send failed to', input.to, err instanceof Error ? err.message : err);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendPasswordResetEmail(
  to: string,
  recipientName: string,
  resetUrl: string,
  expiresInMinutes: number,
): Promise<boolean> {
  const safeName = escapeHtml(recipientName || 'there');
  const safeUrl = escapeHtml(resetUrl);
  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reset your password</title></head>
<body style="margin:0;padding:0;background:#f6f4f1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f1b16;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 6px 24px rgba(198,103,38,0.08);overflow:hidden;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #f0e8df;">
          <div style="font-size:18px;font-weight:600;color:#1f1b16;">WAPCPharm Classroom</div>
          <div style="font-size:12px;color:#6b6359;">West African Postgraduate College of Pharmacists</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#1f1b16;">Reset your password</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#3a342d;">Hi ${safeName}, we received a request to reset the password for your WAPCPharm Classroom account.</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.55;color:#3a342d;">Click the button below to choose a new password. This link expires in ${expiresInMinutes} minutes.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>
            <a href="${safeUrl}" style="display:inline-block;background:#C66726;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;font-size:14px;">Reset password</a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#6b6359;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="margin:6px 0 0;font-size:12px;word-break:break-all;color:#3a342d;"><a href="${safeUrl}" style="color:#C66726;">${safeUrl}</a></p>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#6b6359;">If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#faf6f1;font-size:11px;color:#6b6359;">
          © ${new Date().getFullYear()} West African Postgraduate College of Pharmacists.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim();

  const text = [
    `Hi ${recipientName || 'there'},`,
    '',
    'We received a request to reset the password for your WAPCPharm Classroom account.',
    `Open the link below to choose a new password (expires in ${expiresInMinutes} minutes):`,
    '',
    resetUrl,
    '',
    'If you did not request a password reset, you can ignore this email.',
    '',
    '— WAPCPharm Classroom',
  ].join('\n');

  return sendEmail({ to, subject: 'Reset your WAPCPharm Classroom password', html, text });
}

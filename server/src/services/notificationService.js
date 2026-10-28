/**
 * Notification Service
 *
 * Sends transactional emails via Resend.
 * If RESEND_API_KEY is not configured, falls back to console logging so
 * the application remains functional during local development.
 *
 * NEVER log OTP values, decryption keys, or vault content here.
 */

import { ENV } from '../config/env.js';

let resendInstance = null;

// Lazy initialization of Resend client if installed and configured
async function getResendClient() {
  if (resendInstance !== null) return resendInstance;
  if (!ENV.RESEND_API_KEY) {
    resendInstance = false;
    return false;
  }
  try {
    const { Resend } = await import('resend');
    resendInstance = new Resend(ENV.RESEND_API_KEY);
  } catch (err) {
    console.warn('[NotificationService] resend package not found or failed to load. Falling back to console logging.');
    resendInstance = false;
  }
  return resendInstance;
}

const FROM_ADDRESS = ENV.EMAIL_FROM || 'Digital Legacy Vault <noreply@digital-legacy-vault.app>';

/**
 * Internal send helper — uses Resend or falls back to console.
 */
async function sendEmail({ to, subject, html }) {
  const client = await getResendClient();
  if (!client) {
    console.log(`[NotificationService] EMAIL FALLBACK — would send to ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  (HTML body omitted for security)`);
    return { fallback: true };
  }

  try {
    const result = await client.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });
    return result;
  } catch (err) {
    // Log the error but do NOT throw — a failed email must not crash the release workflow
    console.error(`[NotificationService] Failed to send email to ${to}:`, err.message);
    return { error: err.message };
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

/**
 * Sends the OTP verification email to the trustee after they initiate a release.
 */
export async function sendTrusteeOtpEmail({ trusteeEmail, trusteeName, otp, ownerName, expiresAt }) {
  const expiryStr = new Date(expiresAt).toUTCString();
  return sendEmail({
    to: trusteeEmail,
    subject: '🔐 Your Release Verification Code — Digital Legacy Vault',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
        <h2 style="color:#6366f1">Digital Legacy Vault</h2>
        <p>Hello <strong>${trusteeName || trusteeEmail}</strong>,</p>
        <p>You have requested to initiate a legacy release for vault owner <strong>${ownerName}</strong>.</p>
        <p>Your one-time verification code is:</p>
        <div style="background:#1e1e2e;border-radius:8px;padding:20px;text-align:center;margin:16px 0">
          <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#a5b4fc">${otp}</span>
        </div>
        <p style="color:#888;font-size:13px">This code expires at: ${expiryStr}</p>
        <p style="color:#888;font-size:13px">
          If you did not request this, please ignore this message. 
          Do <strong>not</strong> share this code with anyone.
        </p>
        <hr style="border:none;border-top:1px solid #333;margin:24px 0"/>
        <p style="color:#555;font-size:12px">Digital Legacy Vault — Secure legacy planning</p>
      </div>
    `
  });
}

/**
 * Notifies the vault owner that a trustee has initiated a release request
 * and that the grace period has started.
 */
export async function sendOwnerReleaseNotification({ ownerEmail, ownerName, trusteeName, trusteeEmail, gracePeriodExpiresAt, cancelUrl }) {
  const expiryStr = new Date(gracePeriodExpiresAt).toUTCString();
  return sendEmail({
    to: ownerEmail,
    subject: '⚠️ Release Request Initiated for Your Vault — Digital Legacy Vault',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
        <h2 style="color:#f97316">Digital Legacy Vault — Action Required</h2>
        <p>Hello <strong>${ownerName}</strong>,</p>
        <p>
          Your designated trustee <strong>${trusteeName || trusteeEmail}</strong> 
          (<code>${trusteeEmail}</code>) has submitted a release request for your vault.
        </p>
        <p>
          A <strong>grace period</strong> has been started. Your vault contents 
          <strong>will NOT be released</strong> until the grace period expires.
        </p>
        <table style="width:100%;background:#1e1e2e;border-radius:8px;padding:16px;margin:16px 0">
          <tr>
            <td style="color:#888;padding:4px 0">Grace period expires:</td>
            <td style="color:#fbbf24;font-weight:bold;padding:4px 0">${expiryStr}</td>
          </tr>
        </table>
        <p>
          <strong>If this request is not authorized</strong>, log in to your vault immediately 
          and cancel the request before the grace period expires.
        </p>
        ${cancelUrl ? `<p><a href="${cancelUrl}" style="background:#ef4444;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block">Cancel This Release Request</a></p>` : ''}
        <hr style="border:none;border-top:1px solid #333;margin:24px 0"/>
        <p style="color:#555;font-size:12px">
          If you authorized this release, no action is required. 
          The release will proceed automatically after the grace period.
        </p>
      </div>
    `
  });
}

/**
 * Notifies the owner that they successfully cancelled the release.
 */
export async function sendOwnerCancellationConfirmation({ ownerEmail, ownerName, trusteeEmail }) {
  return sendEmail({
    to: ownerEmail,
    subject: '✅ Release Request Cancelled — Digital Legacy Vault',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
        <h2 style="color:#22c55e">Digital Legacy Vault</h2>
        <p>Hello <strong>${ownerName}</strong>,</p>
        <p>
          The release request initiated by <code>${trusteeEmail}</code> has been 
          <strong>successfully cancelled</strong>. Your vault remains secure.
        </p>
        <p style="color:#888;font-size:13px">
          If you did not cancel this request yourself, your account may be compromised. 
          Please change your password immediately.
        </p>
        <hr style="border:none;border-top:1px solid #333;margin:24px 0"/>
        <p style="color:#555;font-size:12px">Digital Legacy Vault — Secure legacy planning</p>
      </div>
    `
  });
}

/**
 * Notifies the trustee and owner that an automatic release has been executed.
 */
export async function sendReleaseExecutedNotifications({ ownerEmail, ownerName, trusteeEmail, trusteeName, releasedAt }) {
  const releasedStr = new Date(releasedAt).toUTCString();
  await sendEmail({
    to: trusteeEmail,
    subject: '🔓 Vault Release Completed — Digital Legacy Vault',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
        <h2 style="color:#6366f1">Digital Legacy Vault</h2>
        <p>Hello <strong>${trusteeName || trusteeEmail}</strong>,</p>
        <p>The legacy release has been completed. The vault contents assigned to you are now accessible.</p>
        <p style="color:#888;font-size:13px">Completed at: ${releasedStr}</p>
        <p>Log in to Digital Legacy Vault to access your designated items.</p>
        <hr style="border:none;border-top:1px solid #333;margin:24px 0"/>
        <p style="color:#555;font-size:12px">Digital Legacy Vault — Secure legacy planning</p>
      </div>
    `
  });

  // Also notify the owner (may be irrelevant if they are deceased, but good for audit trail)
  await sendEmail({
    to: ownerEmail,
    subject: '🔓 Your Vault Has Been Released — Digital Legacy Vault',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px">
        <h2 style="color:#f97316">Digital Legacy Vault</h2>
        <p>Hello <strong>${ownerName}</strong>,</p>
        <p>
          The grace period for the release request by trustee 
          <code>${trusteeEmail}</code> has expired without cancellation. 
          The release has been executed.
        </p>
        <p style="color:#888;font-size:13px">Released at: ${releasedStr}</p>
        <hr style="border:none;border-top:1px solid #333;margin:24px 0"/>
        <p style="color:#555;font-size:12px">Digital Legacy Vault — Secure legacy planning</p>
      </div>
    `
  });
}

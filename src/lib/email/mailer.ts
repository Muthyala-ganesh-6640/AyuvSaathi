import nodemailer from "nodemailer";
import { getEnv, isSmtpConfigured } from "@/lib/env";

export interface SendResetEmailParams {
  to: string;
  recipientName: string;
  resetUrl: string;
  resetToken: string;
}

export async function sendPasswordResetEmail({
  to,
  recipientName,
  resetUrl,
  resetToken,
}: SendResetEmailParams): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      error: "SMTP email delivery is not configured in environment variables.",
    };
  }

  const env = getEnv();
  const host = env.SMTP_HOST!;
  const port = env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 587;
  const user = env.SMTP_USER!;
  const pass = env.SMTP_PASSWORD!;
  const from = env.SMTP_FROM || `"AyuvSaathi Support" <${user}>`;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject: "AyuvSaathi - Password Reset Request",
      text: `Hello ${recipientName},\n\nYou requested to reset your password for AyuvSaathi.\n\nClick the link below to set a new password:\n${resetUrl}\n\nOr use this reset code directly on the recovery page:\n${resetToken}\n\nThis code and link will expire in 60 minutes.\nIf you did not request this, please ignore this email.\n\n— AyuvSaathi Lifelong Health Companion`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #E1EBF0; border-radius: 16px; background-color: #FFFFFF;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #087F8C; margin: 0; font-size: 24px; font-weight: 700;">AyuvSaathi</h2>
            <p style="color: #64748B; font-size: 13px; margin: 4px 0 0;">Your Lifelong Health Companion</p>
          </div>
          <div style="color: #1E293B; font-size: 15px; line-height: 1.6;">
            <p>Hello <strong>${recipientName}</strong>,</p>
            <p>We received a request to reset your AyuvSaathi password. Click the button below to choose a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #087F8C; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; display: inline-block;">Reset My Password</a>
            </div>
            <p style="font-size: 13px; color: #64748B;">Alternatively, enter this recovery token manually on the reset page:</p>
            <div style="background-color: #F8FAFC; border: 1px dashed #CBD5E1; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 13px; word-break: break-all; color: #0F172A; text-align: center;">
              ${resetToken}
            </div>
            <p style="font-size: 12px; color: #94A3B8; margin-top: 24px;">
              ⏱ This reset link and token are valid for 60 minutes. If you did not request this, your account is safe and no changes have been made.
            </p>
          </div>
          <hr style="border: none; border-top: 1px solid #F1F5F9; margin: 24px 0;" />
          <p style="text-align: center; font-size: 11px; color: #94A3B8; margin: 0;">
            AyuvSaathi Healthcare Informatics Engine • Secure Patient Portal
          </p>
        </div>
      `,
    });

    return { sent: true, messageId: info.messageId };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Failed to send password reset email via SMTP:", errorMsg);
    return { sent: false, error: errorMsg };
  }
}

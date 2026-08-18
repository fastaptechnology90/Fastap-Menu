/**
 * Outgoing email.
 *
 * The Super Admin panel has had SendGrid and SMTP forms since before this change,
 * and the settings they write were being stored correctly — but nothing ever read
 * them, so no email was ever sent. This module is the missing half.
 *
 * It follows the same shape as `payment-gateway.ts`: read the credentials the admin
 * saved, fall back to environment variables, and if neither is present run in a
 * clearly-labelled demo mode instead of failing. That matters here — a platform with
 * no mail provider configured must keep working exactly as it did before, otherwise
 * turning this on would lock every existing user out.
 *
 * SendGrid is reached over its SMTP relay rather than the HTTP API so that both
 * providers share one transport and one code path.
 */
import nodemailer from "nodemailer";
import { getPlatformSettingsRaw } from "./platform-admin.js";
import { resolveIntegrationValue, type IntegrationsConfig } from "./platform-integrations.js";
import { logger } from "./logger.js";

export type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  provider: "sendgrid" | "smtp";
};

/**
 * Reads whichever mail provider the admin enabled. Returns null when none is
 * usable, which every caller treats as "demo mode", never as an error.
 */
export function readEmailConfig(integrations: IntegrationsConfig | undefined): EmailConfig | null {
  const services = integrations?.services ?? {};

  const sendgridKey = resolveIntegrationValue(integrations, "sendgrid", "apiKey", process.env.SENDGRID_API_KEY);
  if (services.sendgrid?.enabled === true && sendgridKey) {
    return {
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      user: "apikey", // SendGrid's SMTP relay expects this literal username
      pass: sendgridKey,
      fromEmail: resolveIntegrationValue(integrations, "sendgrid", "fromEmail", process.env.MAIL_FROM),
      fromName: resolveIntegrationValue(integrations, "sendgrid", "fromName", process.env.MAIL_FROM_NAME) || "Fastap",
      provider: "sendgrid",
    };
  }

  const smtpHost = resolveIntegrationValue(integrations, "smtp", "host", process.env.SMTP_HOST);
  const smtpPass = resolveIntegrationValue(integrations, "smtp", "password", process.env.SMTP_PASSWORD);
  if (services.smtp?.enabled === true && smtpHost) {
    const port = Number(resolveIntegrationValue(integrations, "smtp", "port", process.env.SMTP_PORT)) || 587;
    return {
      host: smtpHost,
      port,
      // The admin form has its own TLS switch; port 465 is implicitly secure.
      secure: services.smtp?.secure === true || port === 465,
      user: resolveIntegrationValue(integrations, "smtp", "username", process.env.SMTP_USERNAME),
      pass: smtpPass,
      fromEmail: resolveIntegrationValue(integrations, "smtp", "fromEmail", process.env.MAIL_FROM),
      fromName: process.env.MAIL_FROM_NAME || "Fastap",
      provider: "smtp",
    };
  }

  return null;
}

/** True when a provider is configured well enough to actually deliver mail. */
export async function isEmailConfigured(): Promise<boolean> {
  try {
    const settings = await getPlatformSettingsRaw();
    const cfg = readEmailConfig(settings.integrations as IntegrationsConfig);
    return Boolean(cfg?.fromEmail);
  } catch (err) {
    // Settings unreadable (database hiccup) — report "not configured" so the caller
    // stays permissive rather than locking people out over an unrelated failure.
    logger.error({ err }, "could not read email settings");
    return false;
  }
}

export type SendResult = { sent: boolean; mode: "live" | "demo"; error?: string };

/**
 * Sends one message. Never throws — callers are sign-up and login paths, and a mail
 * outage must not take those down with it. The boolean says what happened.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  let cfg: EmailConfig | null = null;
  try {
    const settings = await getPlatformSettingsRaw();
    cfg = readEmailConfig(settings.integrations as IntegrationsConfig);
  } catch (err) {
    logger.error({ err }, "could not read email settings");
  }

  if (!cfg || !cfg.fromEmail) {
    // No provider yet. Log the message so the flow is fully testable — and so an
    // administrator can still complete a sign-up by hand — but say plainly that
    // nothing left the server.
    logger.warn(
      { to: opts.to, subject: opts.subject, body: opts.text ?? opts.html },
      "EMAIL NOT SENT — no mail provider configured (Super Admin → Settings → Integrations)",
    );
    return { sent: false, mode: "demo" };
  }

  try {
    const transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
    await transport.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    logger.info({ to: opts.to, subject: opts.subject, provider: cfg.provider }, "email sent");
    return { sent: true, mode: "live" };
  } catch (err) {
    logger.error({ err, to: opts.to, provider: cfg.provider }, "email send failed");
    return { sent: false, mode: "live", error: err instanceof Error ? err.message : "send failed" };
  }
}

/** Where the verification link should point. Falls back to the request's own origin. */
export function publicBaseUrl(fallbackOrigin?: string): string {
  const configured = process.env.PUBLIC_URL || process.env.APP_URL;
  return (configured || fallbackOrigin || "").replace(/\/$/, "");
}

export function verificationEmail(name: string, link: string): { subject: string; html: string; text: string } {
  return {
    subject: "Confirm your email address",
    text:
      `Hi ${name},\n\n`
      + `Confirm your email address to activate your Fastap account:\n${link}\n\n`
      + `This link is valid for 24 hours.\n\n`
      + `If you did not create this account, you can ignore this message.`,
    html:
      `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">`
      + `<h2 style="margin:0 0 16px">Confirm your email address</h2>`
      + `<p style="margin:0 0 16px">Hi ${escapeHtml(name)},</p>`
      + `<p style="margin:0 0 24px">Confirm your email address to activate your Fastap account.</p>`
      + `<p style="margin:0 0 24px">`
      + `<a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;`
      + `padding:12px 20px;border-radius:8px;text-decoration:none">Confirm email</a></p>`
      + `<p style="margin:0 0 8px;color:#555;font-size:13px">This link is valid for 24 hours.</p>`
      + `<p style="margin:0;color:#555;font-size:13px">`
      + `If you did not create this account, you can ignore this message.</p></div>`,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c
  ));
}

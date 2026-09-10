import type { IntegrationsConfig } from "./platform-integrations.js";
import { resolveIntegrationValue } from "./platform-integrations.js";
import { logger } from "./logger.js";

export type SmsSendResult =
  | { ok: true; provider: "twilio" | "msg91" }
  | { ok: false; error: string };

function twilioCreds(integrations?: IntegrationsConfig) {
  const accountSid = resolveIntegrationValue(
    integrations,
    "twilio",
    "accountSid",
    process.env.TWILIO_ACCOUNT_SID,
  );
  const authToken = resolveIntegrationValue(
    integrations,
    "twilio",
    "authToken",
    process.env.TWILIO_AUTH_TOKEN,
  );
  const fromNumber = resolveIntegrationValue(
    integrations,
    "twilio",
    "fromNumber",
    process.env.TWILIO_FROM_NUMBER,
  );
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

function msg91Creds(integrations?: IntegrationsConfig) {
  const authKey = resolveIntegrationValue(
    integrations,
    "msg91",
    "authKey",
    process.env.MSG91_AUTH_KEY,
  );
  const senderId = resolveIntegrationValue(
    integrations,
    "msg91",
    "senderId",
    process.env.MSG91_SENDER_ID,
  ) || "FSTMNU";
  const templateId = resolveIntegrationValue(
    integrations,
    "msg91",
    "templateId",
    process.env.MSG91_TEMPLATE_ID,
  );
  if (!authKey) return null;
  return { authKey, senderId, templateId };
}

/** True only when at least one SMS provider has credentials that could deliver a text. */
export function smsCredentialsPresent(integrations?: IntegrationsConfig): boolean {
  return Boolean(twilioCreds(integrations) || msg91Creds(integrations));
}

function e164IndiaFriendly(phoneDigits: string): string {
  const d = phoneDigits.replace(/\D/g, "");
  if (d.startsWith("91") && d.length === 12) return `+${d}`;
  if (d.length === 10) return `+91${d}`;
  if (d.startsWith("+")) return d;
  return `+${d}`;
}

async function sendViaTwilio(
  phone: string,
  body: string,
  integrations?: IntegrationsConfig,
): Promise<SmsSendResult> {
  const creds = twilioCreds(integrations);
  if (!creds) return { ok: false, error: "Twilio credentials missing" };

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`;
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");
  const form = new URLSearchParams({
    To: e164IndiaFriendly(phone),
    From: creds.fromNumber,
    Body: body,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.warn({ status: res.status, errText: errText.slice(0, 300) }, "Twilio SMS failed");
      return { ok: false, error: `Twilio rejected the message (${res.status})` };
    }
    return { ok: true, provider: "twilio" };
  } catch (e) {
    logger.error({ err: e }, "Twilio SMS network error");
    return { ok: false, error: "Could not reach Twilio" };
  }
}

/**
 * MSG91 Flow / OTP API. Requires auth key; templateId is strongly recommended for India DLT.
 * Without a template we refuse rather than invent a "sent" success on a generic endpoint.
 */
async function sendViaMsg91(
  phone: string,
  otp: string,
  integrations?: IntegrationsConfig,
): Promise<SmsSendResult> {
  const creds = msg91Creds(integrations);
  if (!creds) return { ok: false, error: "MSG91 credentials missing" };
  if (!creds.templateId) {
    return {
      ok: false,
      error: "MSG91_TEMPLATE_ID (or platform templateId) is required to send OTPs",
    };
  }

  const mobile = phone.replace(/\D/g, "");
  const url = "https://control.msg91.com/api/v5/flow/";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authkey: creds.authKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: creds.templateId,
        short_url: "0",
        recipients: [
          {
            mobiles: mobile.length === 10 ? `91${mobile}` : mobile,
            // Common MSG91 template vars — map your DLT template to VAR1/otp as needed.
            var: otp,
            otp,
          },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.warn({ status: res.status, errText: errText.slice(0, 300) }, "MSG91 SMS failed");
      return { ok: false, error: `MSG91 rejected the message (${res.status})` };
    }
    return { ok: true, provider: "msg91" };
  } catch (e) {
    logger.error({ err: e }, "MSG91 SMS network error");
    return { ok: false, error: "Could not reach MSG91" };
  }
}

/**
 * Deliver a one-time code. Never returns ok without a provider acknowledging the request.
 * Prefer Twilio when both are configured (simpler plain-text OTP body).
 */
export async function sendOtpSms(
  phone: string,
  otp: string,
  integrations?: IntegrationsConfig,
): Promise<SmsSendResult> {
  const body = `Your Fastap verification code is ${otp}. It expires in 10 minutes.`;
  if (twilioCreds(integrations)) {
    return sendViaTwilio(phone, body, integrations);
  }
  if (msg91Creds(integrations)) {
    return sendViaMsg91(phone, otp, integrations);
  }
  return { ok: false, error: "No SMS provider configured" };
}

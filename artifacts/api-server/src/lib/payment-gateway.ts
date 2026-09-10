import type { IntegrationsConfig } from "./platform-integrations.js";
import {
  getEnabledPaymentGateways,
  normalizePaymentIntegrations,
  resolveIntegrationValue,
} from "./platform-integrations.js";

export const ONLINE_PAYMENT_METHODS = new Set([
  "upi", "card", "wallet", "netbanking", "nfc", "qr", "online", "razorpay", "gateway",
]);

export function isOnlinePaymentMethod(method: string): boolean {
  return ONLINE_PAYMENT_METHODS.has(String(method ?? "").toLowerCase());
}

export function isCashPaymentMethod(method: string): boolean {
  return String(method ?? "").toLowerCase() === "cash";
}

export function resolveActiveGateway(integrations: IntegrationsConfig): string | null {
  const normalized = normalizePaymentIntegrations(integrations);
  const enabled = getEnabledPaymentGateways(normalized);
  if (!enabled.length) return null;
  if (enabled.includes(normalized.defaultPaymentGateway)) return normalized.defaultPaymentGateway;
  return enabled[0] ?? null;
}

/**
 * True only when a gateway is both switched on *and* holds real credentials.
 *
 * "Enabled" alone is not enough: a gateway can be ticked in settings with no keys, and
 * every call then falls through to `demoResult()`, which reports success without any
 * money moving. Anything that takes or creates money — settling an order, crediting a
 * wallet, holding a deposit — must gate on this, not on `resolveActiveGateway`.
 */
export function hasLivePaymentGateway(integrations: IntegrationsConfig): boolean {
  const gatewayId = resolveActiveGateway(integrations);
  return gatewayId !== null && gatewayHasCredentials(integrations, gatewayId);
}

/**
 * `intent` = create a charge the client still has to complete (order / PaymentIntent).
 * `capture` = confirm money actually moved. Callers that mark an order paid must use capture.
 */
export type GatewayPhase = "intent" | "capture";

export type GatewayProcessInput = {
  gatewayId: string;
  integrations: IntegrationsConfig;
  orderId: number;
  amount: number;
  currency?: string;
  paymentMethod: string;
  /** Defaults to capture — safer than inventing a paid bill from an intent create. */
  phase?: GatewayPhase;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  stripePaymentIntentId?: string;
};

export type GatewayProcessResult = {
  success: boolean;
  mode: "live" | "demo";
  gatewayId: string;
  gatewayTxnId: string;
  gatewayOrderId?: string;
  utr?: string;
  error?: string;
  clientConfig?: Record<string, unknown>;
};

export function gatewayHasCredentials(integrations: IntegrationsConfig, gatewayId: string): boolean {
  switch (gatewayId) {
    case "razorpay":
      return Boolean(
        resolveIntegrationValue(integrations, "razorpay", "keyId", process.env.RAZORPAY_KEY_ID)
        && resolveIntegrationValue(integrations, "razorpay", "keySecret", process.env.RAZORPAY_KEY_SECRET),
      );
    case "stripe":
      return Boolean(
        resolveIntegrationValue(integrations, "stripe", "publishableKey", process.env.STRIPE_PUBLISHABLE_KEY)
        && resolveIntegrationValue(integrations, "stripe", "secretKey", process.env.STRIPE_SECRET_KEY),
      );
    case "paytm":
      return Boolean(
        resolveIntegrationValue(integrations, "paytm", "merchantId")
        && resolveIntegrationValue(integrations, "paytm", "merchantKey"),
      );
    case "phonepe":
      return Boolean(
        resolveIntegrationValue(integrations, "phonepe", "merchantId")
        && resolveIntegrationValue(integrations, "phonepe", "saltKey"),
      );
    case "cashfree":
      return Boolean(
        resolveIntegrationValue(integrations, "cashfree", "appId")
        && resolveIntegrationValue(integrations, "cashfree", "secretKey"),
      );
    default:
      return false;
  }
}

/**
 * A gateway with no credentials cannot take money, so it must not claim to have.
 *
 * This used to return `success: true` with an invented transaction id and UTR. The
 * order was then marked paid, the guest saw "Payment Successful", and nothing had been
 * charged — the single most damaging behaviour in the product. It now fails, clearly,
 * and the caller falls back to collecting at the counter.
 */
function unconfiguredGateway(gatewayId: string): GatewayProcessResult {
  return {
    success: false,
    mode: "demo",
    gatewayId,
    gatewayTxnId: "",
    error: "Online payment is not set up yet. Please pay at the counter.",
  };
}

async function createRazorpayOrder(input: GatewayProcessInput): Promise<GatewayProcessResult> {
  const { integrations, orderId, amount, customerName } = input;
  const keyId = resolveIntegrationValue(integrations, "razorpay", "keyId", process.env.RAZORPAY_KEY_ID);
  const keySecret = resolveIntegrationValue(integrations, "razorpay", "keySecret", process.env.RAZORPAY_KEY_SECRET);

  if (!keyId || !keySecret) return unconfiguredGateway("razorpay");

  const amountPaise = Math.max(100, Math.round(amount * 100));
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  try {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: input.currency ?? "INR",
        receipt: `fm_${orderId}`,
        notes: { orderId: String(orderId), customer: customerName ?? "" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, mode: "live", gatewayId: "razorpay", gatewayTxnId: "", error: `Razorpay: ${err}` };
    }

    const order = await res.json() as { id: string };
    return {
      success: true,
      mode: "live",
      gatewayId: "razorpay",
      gatewayTxnId: order.id,
      gatewayOrderId: order.id,
      utr: `RZP${order.id.slice(-10)}`,
      clientConfig: { keyId, orderId: order.id, amount: amountPaise, currency: input.currency ?? "INR" },
    };
  } catch (e) {
    return { success: false, mode: "live", gatewayId: "razorpay", gatewayTxnId: "", error: String(e) };
  }
}

async function captureRazorpayPayment(input: GatewayProcessInput): Promise<GatewayProcessResult> {
  const { integrations, orderId, amount } = input;
  const keyId = resolveIntegrationValue(integrations, "razorpay", "keyId", process.env.RAZORPAY_KEY_ID);
  const keySecret = resolveIntegrationValue(integrations, "razorpay", "keySecret", process.env.RAZORPAY_KEY_SECRET);

  if (!keyId || !keySecret) return unconfiguredGateway("razorpay");

  if (input.razorpayPaymentId && input.razorpayOrderId && input.razorpaySignature) {
    const crypto = await import("node:crypto");
    const body = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
    const expected = crypto.createHmac("sha256", keySecret).update(body).digest("hex");
    if (expected !== input.razorpaySignature) {
      return { success: false, mode: "live", gatewayId: "razorpay", gatewayTxnId: "", error: "Invalid Razorpay signature" };
    }
    return {
      success: true,
      mode: "live",
      gatewayId: "razorpay",
      gatewayTxnId: input.razorpayPaymentId,
      gatewayOrderId: input.razorpayOrderId,
      utr: `RZP${input.razorpayPaymentId.slice(-10)}`,
    };
  }

  // Without a signed result from Razorpay there is nothing to capture. This used to
  // fall through to createRazorpayOrder, whose success means "an order was created" —
  // not "the customer paid" — and the caller then marked the bill settled.
  return {
    success: false,
    mode: "live",
    gatewayId: "razorpay",
    gatewayTxnId: "",
    error: "Payment was not confirmed by the gateway.",
  };
}

async function createStripePaymentIntent(input: GatewayProcessInput): Promise<GatewayProcessResult> {
  const { integrations, orderId, amount } = input;
  const secretKey = resolveIntegrationValue(integrations, "stripe", "secretKey", process.env.STRIPE_SECRET_KEY);
  const publishableKey = resolveIntegrationValue(integrations, "stripe", "publishableKey", process.env.STRIPE_PUBLISHABLE_KEY);

  if (!secretKey) return unconfiguredGateway("stripe");

  const amountMinor = Math.max(50, Math.round(amount * 100));

  try {
    const params = new URLSearchParams({
      amount: String(amountMinor),
      currency: (input.currency ?? "inr").toLowerCase(),
      "metadata[orderId]": String(orderId),
      "automatic_payment_methods[enabled]": "true",
    });

    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, mode: "live", gatewayId: "stripe", gatewayTxnId: "", error: `Stripe: ${err}` };
    }

    const intent = await res.json() as { id: string; client_secret: string };
    return {
      success: true,
      mode: "live",
      gatewayId: "stripe",
      gatewayTxnId: intent.id,
      gatewayOrderId: intent.id,
      utr: `STR${intent.id.slice(-10)}`,
      clientConfig: { publishableKey, clientSecret: intent.client_secret, paymentIntentId: intent.id },
    };
  } catch (e) {
    return { success: false, mode: "live", gatewayId: "stripe", gatewayTxnId: "", error: String(e) };
  }
}

/**
 * Paytm / PhonePe / Cashfree are listed in settings but this server has no real capture
 * path for them. Credentials alone used to invent a txn id and UTR, and the order was
 * marked paid — the same class of lie as the old demo gateway. Fail clearly instead.
 */
async function processRegionalGateway(input: GatewayProcessInput): Promise<GatewayProcessResult> {
  const { gatewayId } = input;
  if (!gatewayHasCredentials(input.integrations, gatewayId)) {
    return unconfiguredGateway(gatewayId);
  }
  return {
    success: false,
    mode: "live",
    gatewayId,
    gatewayTxnId: "",
    error: `${gatewayId} online checkout is not connected yet. Please pay at the counter.`,
  };
}

/**
 * Confirm a Stripe PaymentIntent actually succeeded. Creating an intent is not payment —
 * that used to mark the bill settled the moment the intent was opened.
 */
async function captureStripePayment(input: GatewayProcessInput): Promise<GatewayProcessResult> {
  const secretKey = resolveIntegrationValue(input.integrations, "stripe", "secretKey", process.env.STRIPE_SECRET_KEY);
  if (!secretKey) return unconfiguredGateway("stripe");

  const intentId = input.stripePaymentIntentId?.trim();
  if (!intentId) {
    return {
      success: false,
      mode: "live",
      gatewayId: "stripe",
      gatewayTxnId: "",
      error: "Payment was not confirmed by the gateway.",
    };
  }

  try {
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(intentId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, mode: "live", gatewayId: "stripe", gatewayTxnId: "", error: `Stripe: ${err}` };
    }
    const intent = await res.json() as { id: string; status: string; amount_received?: number };
    if (intent.status !== "succeeded") {
      return {
        success: false,
        mode: "live",
        gatewayId: "stripe",
        gatewayTxnId: intent.id,
        error: `Stripe payment is ${intent.status}, not succeeded.`,
      };
    }
    return {
      success: true,
      mode: "live",
      gatewayId: "stripe",
      gatewayTxnId: intent.id,
      gatewayOrderId: intent.id,
      utr: `STR${intent.id.slice(-10)}`,
    };
  } catch (e) {
    return { success: false, mode: "live", gatewayId: "stripe", gatewayTxnId: "", error: String(e) };
  }
}

export async function processGatewayPayment(
  integrations: IntegrationsConfig,
  input: Omit<GatewayProcessInput, "gatewayId"> & { gatewayId?: string },
): Promise<GatewayProcessResult> {
  const gatewayId = input.gatewayId ?? resolveActiveGateway(integrations);
  if (!gatewayId) {
    return { success: false, mode: "demo", gatewayId: "", gatewayTxnId: "", error: "No payment gateway enabled in Super Admin" };
  }

  const phase: GatewayPhase = input.phase ?? "capture";
  const fullInput = { ...input, gatewayId, phase };

  switch (gatewayId) {
    case "razorpay":
      return phase === "intent" ? createRazorpayOrder(fullInput) : captureRazorpayPayment(fullInput);
    case "stripe":
      return phase === "intent" ? createStripePaymentIntent(fullInput) : captureStripePayment(fullInput);
    case "paytm":
    case "phonepe":
    case "cashfree":
      return processRegionalGateway(fullInput);
    default:
      return { success: false, mode: "demo", gatewayId, gatewayTxnId: "", error: `Unsupported gateway: ${gatewayId}` };
  }
}

export function getGatewayClientConfig(integrations: IntegrationsConfig) {
  const gatewayId = resolveActiveGateway(integrations);
  if (!gatewayId) return null;

  const hasCredentials = gatewayHasCredentials(integrations, gatewayId);
  const cfg: Record<string, unknown> = {
    gatewayId,
    demoMode: !hasCredentials,
  };

  if (gatewayId === "razorpay") {
    const keyId = resolveIntegrationValue(integrations, "razorpay", "keyId", process.env.RAZORPAY_KEY_ID);
    if (keyId) cfg.keyId = keyId;
  }
  if (gatewayId === "stripe") {
    const publishableKey = resolveIntegrationValue(integrations, "stripe", "publishableKey", process.env.STRIPE_PUBLISHABLE_KEY);
    if (publishableKey) cfg.publishableKey = publishableKey;
  }

  return cfg;
}

export function getPaymentsPublicConfig(integrations: IntegrationsConfig) {
  const normalized = normalizePaymentIntegrations(integrations);
  const enabledGateways = getEnabledPaymentGateways(normalized);
  const activeGateway = resolveActiveGateway(normalized);
  const liveReady = hasLivePaymentGateway(normalized);
  return {
    paymentGateways: enabledGateways,
    defaultPaymentGateway: normalized.defaultPaymentGateway,
    activeGateway,
    /** True only when a gateway is on *and* has credentials that can take money. */
    onlineCheckoutReady: liveReady,
    clientConfig: activeGateway ? getGatewayClientConfig(normalized) : null,
  };
}

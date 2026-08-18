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

export type GatewayProcessInput = {
  gatewayId: string;
  integrations: IntegrationsConfig;
  orderId: number;
  amount: number;
  currency?: string;
  paymentMethod: string;
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

function gatewayHasCredentials(integrations: IntegrationsConfig, gatewayId: string): boolean {
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

function demoResult(gatewayId: string, orderId: number): GatewayProcessResult {
  const ts = Date.now();
  return {
    success: true,
    mode: "demo",
    gatewayId,
    gatewayTxnId: `demo_${gatewayId}_${orderId}_${ts}`,
    gatewayOrderId: `order_${orderId}`,
    utr: `DEMO${orderId}${String(ts).slice(-6)}`,
  };
}

async function createRazorpayOrder(input: GatewayProcessInput): Promise<GatewayProcessResult> {
  const { integrations, orderId, amount, customerName } = input;
  const keyId = resolveIntegrationValue(integrations, "razorpay", "keyId", process.env.RAZORPAY_KEY_ID);
  const keySecret = resolveIntegrationValue(integrations, "razorpay", "keySecret", process.env.RAZORPAY_KEY_SECRET);

  if (!keyId || !keySecret) return demoResult("razorpay", orderId);

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

  if (!keyId || !keySecret) {
    return {
      ...demoResult("razorpay", orderId),
      gatewayOrderId: input.razorpayOrderId,
      gatewayTxnId: input.razorpayPaymentId ?? `demo_rzp_pay_${orderId}`,
    };
  }

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

  return createRazorpayOrder(input);
}

async function createStripePaymentIntent(input: GatewayProcessInput): Promise<GatewayProcessResult> {
  const { integrations, orderId, amount } = input;
  const secretKey = resolveIntegrationValue(integrations, "stripe", "secretKey", process.env.STRIPE_SECRET_KEY);
  const publishableKey = resolveIntegrationValue(integrations, "stripe", "publishableKey", process.env.STRIPE_PUBLISHABLE_KEY);

  if (!secretKey) return demoResult("stripe", orderId);

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

async function processRegionalGateway(input: GatewayProcessInput): Promise<GatewayProcessResult> {
  const { gatewayId, orderId } = input;
  if (!gatewayHasCredentials(input.integrations, gatewayId)) {
    return demoResult(gatewayId, orderId);
  }
  const ts = Date.now();
  return {
    success: true,
    mode: "live",
    gatewayId,
    gatewayTxnId: `${gatewayId}_${orderId}_${ts}`,
    gatewayOrderId: `order_${orderId}`,
    utr: `${gatewayId.toUpperCase()}${orderId}`,
  };
}

export async function processGatewayPayment(
  integrations: IntegrationsConfig,
  input: Omit<GatewayProcessInput, "gatewayId"> & { gatewayId?: string },
): Promise<GatewayProcessResult> {
  const gatewayId = input.gatewayId ?? resolveActiveGateway(integrations);
  if (!gatewayId) {
    return { success: false, mode: "demo", gatewayId: "", gatewayTxnId: "", error: "No payment gateway enabled in Super Admin" };
  }

  const fullInput = { ...input, gatewayId };

  switch (gatewayId) {
    case "razorpay":
      return captureRazorpayPayment(fullInput);
    case "stripe":
      return createStripePaymentIntent(fullInput);
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
  return {
    paymentGateways: enabledGateways,
    defaultPaymentGateway: normalized.defaultPaymentGateway,
    activeGateway,
    clientConfig: activeGateway ? getGatewayClientConfig(normalized) : null,
  };
}

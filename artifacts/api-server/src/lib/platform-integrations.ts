export type IntegrationFieldType = "text" | "password" | "textarea" | "switch" | "select";

export type IntegrationFieldDef = {
  key: string;
  label: string;
  type: IntegrationFieldType;
  secret?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
};

export type IntegrationServiceDef = {
  id: string;
  name: string;
  category: "payments" | "firebase" | "auth" | "messaging" | "email" | "storage" | "maps" | "webhooks";
  description: string;
  icon?: string;
  fields: IntegrationFieldDef[];
};

export const INTEGRATION_SERVICES: IntegrationServiceDef[] = [
  {
    id: "razorpay",
    name: "Razorpay",
    category: "payments",
    description: "UPI, cards, net banking, and wallets for India.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "keyId", label: "Key ID", type: "text", placeholder: "rzp_live_..." },
      { key: "keySecret", label: "Key Secret", type: "password", secret: true },
      { key: "webhookSecret", label: "Webhook Secret", type: "password", secret: true },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    description: "Global card and wallet payments.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "publishableKey", label: "Publishable Key", type: "text", placeholder: "pk_live_..." },
      { key: "secretKey", label: "Secret Key", type: "password", secret: true },
      { key: "webhookSecret", label: "Webhook Secret", type: "password", secret: true },
    ],
  },
  {
    id: "paytm",
    name: "Paytm",
    category: "payments",
    description: "Paytm payment gateway for India.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "merchantId", label: "Merchant ID", type: "text" },
      { key: "merchantKey", label: "Merchant Key", type: "password", secret: true },
    ],
  },
  {
    id: "phonepe",
    name: "PhonePe",
    category: "payments",
    description: "PhonePe UPI and payment gateway.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "merchantId", label: "Merchant ID", type: "text" },
      { key: "saltKey", label: "Salt Key", type: "password", secret: true },
      { key: "saltIndex", label: "Salt Index", type: "text", placeholder: "1" },
    ],
  },
  {
    id: "cashfree",
    name: "Cashfree",
    category: "payments",
    description: "Cashfree payments and payouts.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "appId", label: "App ID", type: "text" },
      { key: "secretKey", label: "Secret Key", type: "password", secret: true },
    ],
  },
  {
    id: "firebase",
    name: "Firebase",
    category: "firebase",
    description: "Push notifications, auth, and Firebase client config.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "apiKey", label: "API Key", type: "text" },
      { key: "authDomain", label: "Auth Domain", type: "text", placeholder: "your-app.firebaseapp.com" },
      { key: "projectId", label: "Project ID", type: "text" },
      { key: "storageBucket", label: "Storage Bucket", type: "text", placeholder: "your-app.appspot.com" },
      { key: "messagingSenderId", label: "Messaging Sender ID", type: "text" },
      { key: "appId", label: "App ID", type: "text" },
      { key: "measurementId", label: "Measurement ID (Analytics)", type: "text", placeholder: "G-XXXXXXXX" },
      {
        key: "serviceAccountJson",
        label: "Service Account JSON",
        type: "textarea",
        secret: true,
        helpText: "Paste the full Firebase Admin SDK service account JSON file contents.",
      },
    ],
  },
  {
    id: "google_oauth",
    name: "Google OAuth",
    category: "auth",
    description: "Sign in with Google for guest and admin users.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password", secret: true },
    ],
  },
  {
    id: "apple_oauth",
    name: "Apple Sign In",
    category: "auth",
    description: "Sign in with Apple for iOS and web.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "clientId", label: "Services ID", type: "text" },
      { key: "teamId", label: "Team ID", type: "text" },
      { key: "keyId", label: "Key ID", type: "text" },
      { key: "privateKey", label: "Private Key (.p8 contents)", type: "textarea", secret: true },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "messaging",
    description: "SMS and WhatsApp via Twilio.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "accountSid", label: "Account SID", type: "text" },
      { key: "authToken", label: "Auth Token", type: "password", secret: true },
      { key: "fromNumber", label: "From Phone Number", type: "text", placeholder: "+1234567890" },
      { key: "whatsappFrom", label: "WhatsApp From", type: "text", placeholder: "whatsapp:+14155238886" },
    ],
  },
  {
    id: "msg91",
    name: "MSG91",
    category: "messaging",
    description: "SMS OTP and transactional SMS for India.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "authKey", label: "Auth Key", type: "password", secret: true },
      { key: "senderId", label: "Sender ID", type: "text", placeholder: "FSTMNU" },
      { key: "templateId", label: "Default Template ID", type: "text" },
    ],
  },
  {
    id: "whatsapp_meta",
    name: "WhatsApp Business (Meta)",
    category: "messaging",
    description: "Official WhatsApp Cloud API.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "phoneNumberId", label: "Phone Number ID", type: "text" },
      { key: "businessAccountId", label: "Business Account ID", type: "text" },
      { key: "accessToken", label: "Permanent Access Token", type: "password", secret: true },
      { key: "verifyToken", label: "Webhook Verify Token", type: "password", secret: true },
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    category: "email",
    description: "Transactional email delivery.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "apiKey", label: "API Key", type: "password", secret: true },
      { key: "fromEmail", label: "From Email", type: "text", placeholder: "noreply@yourdomain.com" },
      { key: "fromName", label: "From Name", type: "text", placeholder: "Fastap OS" },
    ],
  },
  {
    id: "smtp",
    name: "SMTP",
    category: "email",
    description: "Custom SMTP server for email.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "host", label: "SMTP Host", type: "text", placeholder: "smtp.gmail.com" },
      { key: "port", label: "Port", type: "text", placeholder: "587" },
      { key: "username", label: "Username", type: "text" },
      { key: "password", label: "Password", type: "password", secret: true },
      { key: "secure", label: "Use TLS/SSL", type: "switch" },
      { key: "fromEmail", label: "From Email", type: "text" },
    ],
  },
  {
    id: "aws_s3",
    name: "AWS S3",
    category: "storage",
    description: "File and document storage on Amazon S3.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "region", label: "Region", type: "text", placeholder: "ap-south-1" },
      { key: "bucket", label: "Bucket Name", type: "text" },
      { key: "accessKeyId", label: "Access Key ID", type: "text" },
      { key: "secretAccessKey", label: "Secret Access Key", type: "password", secret: true },
      { key: "publicBaseUrl", label: "Public CDN/Base URL", type: "text", placeholder: "https://cdn.yourdomain.com" },
    ],
  },
  {
    id: "cloudinary",
    name: "Cloudinary",
    category: "storage",
    description: "Image upload, transform, and CDN.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "cloudName", label: "Cloud Name", type: "text" },
      { key: "apiKey", label: "API Key", type: "text" },
      { key: "apiSecret", label: "API Secret", type: "password", secret: true },
    ],
  },
  {
    id: "google_maps",
    name: "Google Maps",
    category: "maps",
    description: "Maps, geocoding, and place autocomplete.",
    fields: [
      { key: "enabled", label: "Enabled", type: "switch" },
      { key: "apiKey", label: "API Key", type: "password", secret: true },
    ],
  },
];

export const SECRET_MASK = "••••••••";

export type IntegrationsConfig = {
  defaultPaymentGateway: string;
  services: Record<string, Record<string, string | boolean>>;
};

function defaultServiceConfig(service: IntegrationServiceDef): Record<string, string | boolean> {
  const cfg: Record<string, string | boolean> = {};
  for (const f of service.fields) {
    cfg[f.key] = f.type === "switch" ? false : "";
  }
  return cfg;
}

export function buildDefaultIntegrations(): IntegrationsConfig {
  const services: Record<string, Record<string, string | boolean>> = {};
  for (const s of INTEGRATION_SERVICES) {
    services[s.id] = defaultServiceConfig(s);
  }
  // Razorpay enabled by default so guest checkout works out of the box (demo mode until keys are set).
  if (services.razorpay) services.razorpay.enabled = true;
  return { defaultPaymentGateway: "razorpay", services };
}

export const DEFAULT_INTEGRATIONS = buildDefaultIntegrations();

function isSecretField(serviceId: string, fieldKey: string): boolean {
  const svc = INTEGRATION_SERVICES.find(s => s.id === serviceId);
  return Boolean(svc?.fields.find(f => f.key === fieldKey && f.secret));
}

function shouldPreserveSecret(incoming: unknown): boolean {
  if (incoming == null) return true;
  const s = String(incoming);
  return s === "" || s === SECRET_MASK || s.startsWith("••••");
}

export function mergeIntegrations(
  current: IntegrationsConfig,
  patch: Partial<IntegrationsConfig>,
): IntegrationsConfig {
  const base = { ...DEFAULT_INTEGRATIONS, ...current, services: { ...DEFAULT_INTEGRATIONS.services, ...current.services } };
  const next: IntegrationsConfig = {
    defaultPaymentGateway: patch.defaultPaymentGateway ?? base.defaultPaymentGateway,
    services: { ...base.services },
  };

  const patchServices = patch.services ?? {};
  for (const [serviceId, servicePatch] of Object.entries(patchServices)) {
    const existing = base.services[serviceId] ?? defaultServiceConfig(
      INTEGRATION_SERVICES.find(s => s.id === serviceId) ?? INTEGRATION_SERVICES[0],
    );
    const merged = { ...existing, ...servicePatch };
    for (const [key, val] of Object.entries(servicePatch)) {
      if (isSecretField(serviceId, key) && shouldPreserveSecret(val)) {
        merged[key] = existing[key] ?? "";
      }
    }
    next.services[serviceId] = merged;
  }
  return normalizePaymentIntegrations(next);
}

export function maskIntegrations(integrations: IntegrationsConfig): IntegrationsConfig {
  const masked: IntegrationsConfig = {
    defaultPaymentGateway: integrations.defaultPaymentGateway,
    services: {},
  };
  for (const [serviceId, cfg] of Object.entries(integrations.services ?? {})) {
    masked.services[serviceId] = { ...cfg };
    for (const f of INTEGRATION_SERVICES.find(s => s.id === serviceId)?.fields ?? []) {
      if (f.secret && cfg[f.key] && String(cfg[f.key]).length > 0) {
        masked.services[serviceId][f.key] = SECRET_MASK;
      }
    }
  }
  return masked;
}

export function getIntegrationService(id: string) {
  return INTEGRATION_SERVICES.find(s => s.id === id);
}

export function getEnabledPaymentGateways(integrations: IntegrationsConfig) {
  const paymentIds = INTEGRATION_SERVICES.filter(s => s.category === "payments").map(s => s.id);
  return paymentIds.filter(id => integrations.services[id]?.enabled === true);
}

/** Ensure default gateway is enabled; enable Razorpay when none are active. */
export function normalizePaymentIntegrations(integrations: IntegrationsConfig): IntegrationsConfig {
  const enabled = getEnabledPaymentGateways(integrations);
  const services = { ...integrations.services };

  if (!enabled.length) {
    services.razorpay = { ...(services.razorpay ?? {}), enabled: true };
  }

  const enabledAfter = getEnabledPaymentGateways({ ...integrations, services });
  let defaultPaymentGateway = integrations.defaultPaymentGateway || "razorpay";
  if (!enabledAfter.includes(defaultPaymentGateway)) {
    defaultPaymentGateway = enabledAfter[0] ?? "razorpay";
  }

  return { defaultPaymentGateway, services };
}

export function getPublicIntegrationsConfig(integrations: IntegrationsConfig) {
  const firebase = integrations.services.firebase ?? {};
  const googleOAuth = integrations.services.google_oauth ?? {};
  const appleOAuth = integrations.services.apple_oauth ?? {};
  const googleMaps = integrations.services.google_maps ?? {};
  const paymentGateways = getEnabledPaymentGateways(integrations);

  return {
    paymentGateways,
    defaultPaymentGateway: integrations.defaultPaymentGateway,
    firebase: firebase.enabled ? {
      apiKey: String(firebase.apiKey ?? ""),
      authDomain: String(firebase.authDomain ?? ""),
      projectId: String(firebase.projectId ?? ""),
      storageBucket: String(firebase.storageBucket ?? ""),
      messagingSenderId: String(firebase.messagingSenderId ?? ""),
      appId: String(firebase.appId ?? ""),
      measurementId: String(firebase.measurementId ?? ""),
    } : null,
    oauth: {
      google: googleOAuth.enabled === true && Boolean(googleOAuth.clientId),
      apple: appleOAuth.enabled === true && Boolean(appleOAuth.clientId),
      googleClientId: googleOAuth.enabled ? String(googleOAuth.clientId ?? "") : "",
    },
    maps: googleMaps.enabled === true && Boolean(googleMaps.apiKey)
      ? { enabled: true }
      : { enabled: false },
    messaging: {
      sms: integrations.services.twilio?.enabled === true || integrations.services.msg91?.enabled === true,
      whatsapp: integrations.services.whatsapp_meta?.enabled === true || integrations.services.twilio?.enabled === true,
      email: integrations.services.sendgrid?.enabled === true || integrations.services.smtp?.enabled === true,
    },
    storage: {
      provider: integrations.services.cloudinary?.enabled ? "cloudinary"
        : integrations.services.aws_s3?.enabled ? "aws_s3" : null,
    },
  };
}

export function resolveIntegrationValue(
  integrations: IntegrationsConfig | undefined,
  serviceId: string,
  fieldKey: string,
  envFallback?: string,
): string {
  // `integrations` is absent on a fresh install / newly onboarded restaurant —
  // fall back to env instead of throwing (see BUG.md #4).
  const val = integrations?.services?.[serviceId]?.[fieldKey];
  if (val != null && String(val).length > 0) return String(val);
  return envFallback ?? "";
}

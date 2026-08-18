import { randomBytes } from "node:crypto";

export type GuestType = "regular" | "vip" | "corporate" | "hotel" | "membership" | "event";

export type DeviceRecord = {
  id: string;
  name: string;
  userAgent: string;
  lastSeen: string;
  trusted: boolean;
  ip?: string;
  loginCount: number;
};

export type LoginAlert = {
  id: string;
  at: string;
  deviceName: string;
  ip?: string;
  suspicious: boolean;
  message: string;
  read: boolean;
};

export type DeviceInfoShape = {
  devices?: DeviceRecord[];
  loginAlerts?: LoginAlert[];
  guestType?: GuestType;
  security?: {
    sessionTimeoutMinutes: number;
    fraudProtection: boolean;
    loginAlertsEnabled: boolean;
  };
  digitalExperience?: {
    claimedOffers?: string[];
    spinHistory?: { prize: string; at: string }[];
    prefs?: { festivalTheme?: string; seasonalAnimation?: string };
  };
};

export const GUEST_TYPES: { id: GuestType; label: string; desc: string }[] = [
  { id: "regular", label: "Regular Guest", desc: "Standard dining experience" },
  { id: "vip", label: "VIP Guest", desc: "Priority service & lounge access" },
  { id: "corporate", label: "Corporate Guest", desc: "Business dining & billing" },
  { id: "hotel", label: "Hotel Guest", desc: "In-room & resort services" },
  { id: "membership", label: "Membership Guest", desc: "Loyalty member benefits" },
  { id: "event", label: "Event Guest", desc: "Banquet & celebration access" },
];

const DEFAULT_SECURITY = {
  sessionTimeoutMinutes: 30,
  fraudProtection: true,
  loginAlertsEnabled: true,
};

export function parseDeviceInfo(raw: unknown): DeviceInfoShape {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DeviceInfoShape;
}

export function deviceNameFromUA(ua: string): string {
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android Phone";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown Device";
}

export function detectSuspiciousLogin(
  devices: DeviceRecord[],
  deviceId: string,
  ip?: string,
): boolean {
  if (!devices.length) return false;
  const known = devices.find(d => d.id === deviceId);
  if (known?.trusted) return false;
  const knownIps = new Set(devices.filter(d => d.ip).map(d => d.ip));
  if (ip && knownIps.size > 0 && !knownIps.has(ip)) return true;
  return !known;
}

export function recordDeviceLogin(
  raw: unknown,
  deviceId: string,
  userAgent: string,
  ip?: string,
): { deviceInfo: DeviceInfoShape; alert?: LoginAlert; suspicious: boolean } {
  const deviceInfo = parseDeviceInfo(raw);
  const devices = [...(deviceInfo.devices ?? [])];
  const security = { ...DEFAULT_SECURITY, ...deviceInfo.security };
  const suspicious = security.fraudProtection && detectSuspiciousLogin(devices, deviceId, ip);
  const now = new Date().toISOString();
  const name = deviceNameFromUA(userAgent);
  const idx = devices.findIndex(d => d.id === deviceId);
  if (idx >= 0) {
    devices[idx] = {
      ...devices[idx],
      lastSeen: now,
      userAgent,
      ip,
      loginCount: (devices[idx].loginCount ?? 0) + 1,
    };
  } else {
    devices.unshift({
      id: deviceId,
      name,
      userAgent,
      lastSeen: now,
      trusted: devices.length === 0,
      ip,
      loginCount: 1,
    });
  }

  let alert: LoginAlert | undefined;
  if (security.loginAlertsEnabled) {
    alert = {
      id: randomBytes(8).toString("hex"),
      at: now,
      deviceName: name,
      ip,
      suspicious,
      message: suspicious
        ? `New login from ${name}${ip ? ` (${ip})` : ""} — please verify`
        : `Signed in on ${name}`,
      read: false,
    };
    const alerts = [alert, ...(deviceInfo.loginAlerts ?? [])].slice(0, 50);
    return {
      deviceInfo: { ...deviceInfo, devices, loginAlerts: alerts, security },
      alert,
      suspicious,
    };
  }

  return { deviceInfo: { ...deviceInfo, devices, security }, suspicious };
}

export function removeDevice(raw: unknown, deviceId: string): DeviceInfoShape {
  const deviceInfo = parseDeviceInfo(raw);
  return {
    ...deviceInfo,
    devices: (deviceInfo.devices ?? []).filter(d => d.id !== deviceId),
  };
}

export function trustDevice(raw: unknown, deviceId: string): DeviceInfoShape {
  const deviceInfo = parseDeviceInfo(raw);
  return {
    ...deviceInfo,
    devices: (deviceInfo.devices ?? []).map(d =>
      d.id === deviceId ? { ...d, trusted: true } : d,
    ),
  };
}

export function markAlertsRead(raw: unknown): DeviceInfoShape {
  const deviceInfo = parseDeviceInfo(raw);
  return {
    ...deviceInfo,
    loginAlerts: (deviceInfo.loginAlerts ?? []).map(a => ({ ...a, read: true })),
  };
}

export function socialEmailForProvider(provider: string, profileEmail?: string, profileId?: string): string {
  if (profileEmail) return profileEmail.toLowerCase();
  return `${provider}_${profileId ?? randomBytes(4).toString("hex")}@social.fastap.local`;
}

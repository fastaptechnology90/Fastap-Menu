export const ACCESS_METHODS = [
  { id: "qr", label: "QR Scan", icon: "📱", desc: "Scan table or venue QR code" },
  { id: "nfc", label: "NFC Tap", icon: "📡", desc: "Tap NFC tag at table or counter" },
  { id: "browser", label: "Browser", icon: "🌐", desc: "Open in mobile or desktop browser" },
  { id: "direct_url", label: "Direct URL", icon: "🔗", desc: "Direct link access" },
  { id: "pwa", label: "PWA App", icon: "📲", desc: "Install as progressive web app" },
  { id: "room_qr", label: "Hotel Room QR", icon: "🏨", desc: "In-room QR for room service" },
  { id: "poolside_qr", label: "Poolside QR", icon: "🏊", desc: "Order from poolside loungers" },
  { id: "spa_qr", label: "Spa QR", icon: "💆", desc: "Spa menu and booking access" },
  { id: "event_qr", label: "Event QR", icon: "🎉", desc: "Banquet and event guest access" },
  { id: "parking_qr", label: "Parking QR", icon: "🅿️", desc: "Valet and parking services" },
] as const;

export type AccessMethodId = (typeof ACCESS_METHODS)[number]["id"];

export const ZONE_CATALOG = {
  indoor_dining: {
    label: "Indoor Dining Area",
    zones: ["AC Section", "Premium Indoor", "Family Section", "Fine Dine Section", "Fast Dining Section", "Silent Dining Zone", "Kids Friendly Zone"],
  },
  outdoor_dining: {
    label: "Outdoor Dining Area",
    zones: ["Garden Seating", "Rooftop Seating", "Balcony Seating", "Poolside Seating", "Beachside Seating", "Open Terrace Seating", "Smoking Zone", "Sunset Lounge"],
  },
  special_experience: {
    label: "Special Experience Zones",
    zones: ["VIP Lounge", "Private Cabin", "Couple Cabin", "Corporate Dining Area", "Banquet Section", "Conference Dining Area", "Party Zone", "Live Music Zone"],
  },
} as const;

export const SESSION_FEATURES = [
  { id: "autoReconnect", label: "Auto Reconnect", icon: "🔄" },
  { id: "sessionRestore", label: "Session Restore", icon: "💾" },
  { id: "multiDevice", label: "Multi-Device Session", icon: "📱" },
  { id: "familyShared", label: "Family Shared Session", icon: "👨‍👩‍👧‍👦" },
  { id: "sharedTable", label: "Shared Table Session", icon: "🪑" },
] as const;

export interface SmartEntryParams {
  slug: string;
  table?: string;
  room?: string;
  section?: string;
  branch?: string;
  lang?: string;
  entry?: string;
  zone?: string;
  pool?: string;
  spa?: string;
  event?: string;
  parking?: string;
  nfc?: string;
  session?: string;
  share?: string;
}

export interface SmartDetection {
  entryMethod: AccessMethodId;
  serviceMode: string;
  language: string;
  timezone: string;
  branchId?: number | null;
  branchName?: string | null;
  autoDetection?: Record<string, boolean>;
}

export interface GuestSessionInfo {
  token: string;
  shareCode?: string;
  sessionType: string;
  memberCount: number;
  features?: Record<string, boolean>;
}

export interface SmartEntryState {
  params: SmartEntryParams;
  detection: SmartDetection;
  session: GuestSessionInfo | null;
  areaGroups?: { category: string; label: string; areas: { id: number; name: string; areaType: string }[] }[];
}

const SESSION_KEY = "fastap_guest_session";
const DEVICE_KEY = "fastap_device_id";
const ENTRY_KEY = "fastap_entry_context";

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function parseEntryFromUrl(search = window.location.search, pathname = window.location.pathname): SmartEntryParams {
  const qs = new URLSearchParams(search);
  const slugFromPath = pathname.match(/\/(?:e|scan|menu|user\/menu)\/([^/?]+)/)?.[1];
  return {
    slug: qs.get("slug") || slugFromPath || "",
    table: qs.get("table") || undefined,
    room: qs.get("room") || undefined,
    section: qs.get("section") || undefined,
    branch: qs.get("branch") || undefined,
    lang: qs.get("lang") || undefined,
    entry: qs.get("entry") || qs.get("via") || qs.get("access") || undefined,
    zone: qs.get("zone") || undefined,
    pool: qs.get("pool") || undefined,
    spa: qs.get("spa") || undefined,
    event: qs.get("event") || undefined,
    parking: qs.get("parking") || undefined,
    nfc: qs.get("nfc") || undefined,
    session: qs.get("session") || localStorage.getItem(SESSION_KEY) || undefined,
    share: qs.get("share") || undefined,
  };
}

export function detectAccessMethodClient(params: SmartEntryParams): AccessMethodId {
  const entry = (params.entry || "").toLowerCase();
  if (entry === "nfc" || params.nfc === "1") return "nfc";
  if (entry === "pwa" || window.matchMedia("(display-mode: standalone)").matches) return "pwa";
  if (params.room) return "room_qr";
  if (params.pool === "1" || params.zone === "poolside" || entry === "poolside") return "poolside_qr";
  if (params.spa === "1" || entry === "spa") return "spa_qr";
  if (params.event === "1" || entry === "event") return "event_qr";
  if (params.parking === "1" || entry === "parking") return "parking_qr";
  if (params.table) return "qr";
  if (entry === "browser") return "browser";
  return "direct_url";
}

export function detectServiceModeClient(params: SmartEntryParams, access: AccessMethodId): string {
  if (params.room) return "room_service";
  if (access === "poolside_qr" || params.zone === "poolside") return "poolside";
  if (access === "spa_qr") return "spa";
  if (access === "event_qr") return "event";
  if (access === "parking_qr") return "parking_valet";
  const entry = (params.entry || "").toLowerCase();
  if (entry === "drive-through" || params.zone === "drive_through") return "drive_through";
  if (entry === "drive-in" || params.zone === "drive_in") return "drive_in";
  if (entry === "bar" || params.zone === "bar") return "bar";
  if (entry === "lounge" || params.zone === "lounge") return "lounge";
  if (entry === "cabana" || params.zone === "cabana") return "cabana";
  if (entry === "takeaway") return "takeaway";
  if (params.table) return "dine_in";
  return "browse";
}

export function persistEntryContext(state: Partial<SmartEntryState>) {
  localStorage.setItem(ENTRY_KEY, JSON.stringify(state));
  if (state.session?.token) localStorage.setItem(SESSION_KEY, state.session.token);
}

export function loadEntryContext(): Partial<SmartEntryState> | null {
  try {
    const raw = localStorage.getItem(ENTRY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearEntryContext() {
  localStorage.removeItem(ENTRY_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function buildScanUrl(slug: string, opts: Partial<SmartEntryParams> = {}): string {
  const qs = new URLSearchParams();
  if (opts.table) qs.set("table", opts.table);
  if (opts.room) qs.set("room", opts.room);
  if (opts.entry) qs.set("entry", opts.entry);
  else if (opts.room) qs.set("entry", "room_qr");
  else if (opts.table) qs.set("entry", "qr");
  const q = qs.toString();
  return `/scan/${slug}${q ? `?${q}` : ""}`;
}

export function buildEntryUrl(slug: string, opts: Partial<SmartEntryParams> = {}): string {
  if (opts.table || opts.room) return buildScanUrl(slug, opts);
  const qs = new URLSearchParams();
  if (opts.table) qs.set("table", opts.table);
  if (opts.room) qs.set("room", opts.room);
  if (opts.section) qs.set("section", opts.section);
  if (opts.entry) qs.set("entry", opts.entry);
  if (opts.zone) qs.set("zone", opts.zone);
  if (opts.pool) qs.set("pool", "1");
  if (opts.spa) qs.set("spa", "1");
  if (opts.event) qs.set("event", "1");
  if (opts.parking) qs.set("parking", "1");
  if (opts.nfc) qs.set("nfc", "1");
  const q = qs.toString();
  return `/e/${slug}${q ? `?${q}` : ""}`;
}

export function accessMethodLabel(id: string): string {
  return ACCESS_METHODS.find(a => a.id === id)?.label ?? id.replace(/_/g, " ");
}

export function serviceModeLabel(mode: string): string {
  const map: Record<string, string> = {
    dine_in: "Dine In",
    room_service: "Room Service",
    poolside: "Poolside",
    spa: "Spa & Wellness",
    event: "Event / Banquet",
    parking_valet: "Parking / Valet",
    browse: "Browse Menu",
  };
  return map[mode] ?? mode.replace(/_/g, " ");
}

export function isPwaInstalled(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

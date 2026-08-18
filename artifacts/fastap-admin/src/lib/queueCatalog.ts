/** Waitlist & Queue System — guest catalog */
export const QUEUE_TYPES = [
  { id: "dining", label: "Dine-In Table", icon: "🍽️", desc: "Standard dining queue" },
  { id: "takeaway", label: "Takeaway Counter", icon: "🛍️", desc: "Pickup queue" },
  { id: "vip", label: "VIP Priority", icon: "👑", desc: "Skip ahead — VIP guests", priority: "vip" },
  { id: "membership", label: "Membership Priority", icon: "⭐", desc: "Gold+ loyalty members", priority: "membership" },
  { id: "family", label: "Family Priority", icon: "👨‍👩‍👧", desc: "Large parties (5+ guests)", priority: "family" },
  { id: "corporate", label: "Corporate Priority", icon: "🏢", desc: "Business account queue", priority: "corporate" },
] as const;

export const NOTIFY_CHANNELS = [
  { id: "app", label: "In-App", icon: "📱", desc: "Live updates in browser" },
  { id: "sms", label: "SMS", icon: "📲", desc: "Text message alerts" },
  { id: "whatsapp", label: "WhatsApp", icon: "💬", desc: "WhatsApp notifications" },
  { id: "both", label: "SMS + WhatsApp", icon: "🔔", desc: "Both channels" },
] as const;

export type NotifyChannelId = (typeof NOTIFY_CHANNELS)[number]["id"];

export const PRIORITY_LABELS: Record<string, string> = {
  vip: "VIP Priority",
  corporate: "Corporate Priority",
  membership_vip_elite: "Elite Member",
  membership_diamond: "Diamond Member",
  membership_platinum: "Platinum Member",
  membership_gold: "Gold Member",
  membership_silver: "Silver Member",
  membership: "Member Priority",
  family: "Family Priority",
  normal: "Standard",
};

export const DEMO_CORPORATE_HINT = "Try CORP2024, FASTMENU, or GRANDSPICE";

export interface QueueStats {
  queueLength: number;
  freeTables: number;
  freeTablesSoon: number;
  estimatedWait: number;
  groupsAhead: number;
  predictionLabel: string;
  liveWaitTime: number;
}

export interface QueueStatusResponse {
  token: string;
  tokenNumber: number;
  displayToken: string;
  position: number;
  estimatedWait: number;
  liveWaitTime: number;
  groupsAhead: number;
  freeTablesSoon: number;
  predictionLabel: string;
  status: string;
  priority?: string;
  notifyVia?: string;
  restaurantName?: string;
  queueLength?: number;
  digitalWaitlist?: { displayToken: string; partySize: number; priority: string; position: number }[];
  alerts?: { sms: boolean; whatsapp: boolean; app: boolean };
}

export const DEMO_QUEUE_STATS: QueueStats = {
  queueLength: 8,
  freeTables: 2,
  freeTablesSoon: 3,
  estimatedWait: 22,
  groupsAhead: 7,
  predictionLabel: "Moderate wait",
  liveWaitTime: 22,
};

export type SupportChannelId = "live_chat" | "whatsapp" | "voice" | "ticket" | "emergency";

export type SupportConfig = {
  restaurantName: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  voiceHelpline: string;
  voiceHelplineDisplay: string;
  emergencyHotline: string;
  emergencyDisplay: string;
  securityLine: string;
  managerLine: string;
  supportEmail: string;
  hours: string;
  agentsOnline: number;
};

const DEFAULT_CONFIG: SupportConfig = {
  restaurantName: "Restaurant",
  whatsappNumber: "919876543210",
  whatsappDisplay: "+91 98765 43210",
  voiceHelpline: "+9118001234567",
  voiceHelplineDisplay: "1800-123-4567",
  emergencyHotline: "+919876599999",
  emergencyDisplay: "+91 98765 99999",
  securityLine: "+919876588888",
  managerLine: "+919876577777",
  supportEmail: "support@fastapmenu.com",
  hours: "24/7 emergency · Chat 9 AM – 11 PM",
  agentsOnline: 2,
};

const AGENT_NAMES = ["Priya", "Arjun", "Meera", "Rahul"];

const CHAT_RESPONSES: { match: RegExp; reply: string }[] = [
  { match: /order|where|status|track/i, reply: "I can help track your order. Please share your order ID or table number and I'll check the kitchen status right away." },
  { match: /refund|payment|bill|charge/i, reply: "For billing issues, I'll connect you with our accounts team. Refunds typically process within 24–48 hours to your original payment method or wallet." },
  { match: /reserv|book|table/i, reply: "For reservations, please share your booking date, time, and party size. I can also redirect you to our reservations page." },
  { match: /allerg|diet|vegan|jain/i, reply: "Your safety matters. Please tell us your allergy or dietary requirement and the dish in question — our kitchen manager will review immediately." },
  { match: /manager|complaint|unhappy|bad/i, reply: "I'm escalating this to the duty manager. They'll reach out within 5 minutes. Can you briefly describe what happened?" },
  { match: /wait|slow|delay/i, reply: "Sorry for the wait! Let me check with the kitchen on your order status. What's your table number?" },
  { match: /wifi|app|login|technical/i, reply: "For technical issues, try refreshing the menu page or clearing browser cache. If the problem persists, I'll log a tech ticket for you." },
];

export function getSupportCatalog() {
  return {
    channels: ["live_chat", "whatsapp", "voice", "ticket", "emergency"] as SupportChannelId[],
    ticketCategories: ["order", "payment", "reservation", "food_quality", "staff", "technical", "other"],
    emergencyTypes: ["medical", "security", "fire", "food_safety", "other"],
    voiceCallbackSlots: ["ASAP (within 15 min)", "Within 30 minutes", "Within 1 hour", "Today — afternoon", "Today — evening"],
  };
}

export function resolveSupportConfig(
  restaurant?: { name?: string; phone?: string | null; email?: string | null; settings?: unknown } | null,
): SupportConfig {
  const settings = (typeof restaurant?.settings === "object" && restaurant.settings !== null
    ? restaurant.settings as Record<string, unknown>
    : {}) as Record<string, unknown>;
  const support = (typeof settings.support === "object" && settings.support !== null
    ? settings.support as Record<string, unknown>
    : {}) as Record<string, unknown>;

  const phone = String(restaurant?.phone ?? support.whatsappNumber ?? DEFAULT_CONFIG.whatsappNumber).replace(/\D/g, "");
  const wa = String((support.whatsappNumber ?? phone) || DEFAULT_CONFIG.whatsappNumber).replace(/\D/g, "");

  return {
    restaurantName: restaurant?.name ?? DEFAULT_CONFIG.restaurantName,
    whatsappNumber: wa || DEFAULT_CONFIG.whatsappNumber,
    whatsappDisplay: String(support.whatsappDisplay ?? restaurant?.phone ?? DEFAULT_CONFIG.whatsappDisplay),
    voiceHelpline: String(support.voiceHelpline ?? restaurant?.phone ?? DEFAULT_CONFIG.voiceHelpline),
    voiceHelplineDisplay: String(support.voiceHelplineDisplay ?? DEFAULT_CONFIG.voiceHelplineDisplay),
    emergencyHotline: String(support.emergencyHotline ?? DEFAULT_CONFIG.emergencyHotline),
    emergencyDisplay: String(support.emergencyDisplay ?? DEFAULT_CONFIG.emergencyDisplay),
    securityLine: String(support.securityLine ?? DEFAULT_CONFIG.securityLine),
    managerLine: String(support.managerLine ?? DEFAULT_CONFIG.managerLine),
    supportEmail: String(restaurant?.email ?? support.supportEmail ?? DEFAULT_CONFIG.supportEmail),
    hours: String(support.hours ?? DEFAULT_CONFIG.hours),
    agentsOnline: Number(support.agentsOnline ?? DEFAULT_CONFIG.agentsOnline),
  };
}

export function createChatSession(restaurantId: number, guestName?: string) {
  const sessionId = `gs-${restaurantId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const agent = AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
  const welcome = `Hi${guestName ? ` ${guestName.split(" ")[0]}` : ""}! I'm ${agent} from support. How can I help you today?`;
  return { sessionId, agentName: agent, welcome, agentsOnline: DEFAULT_CONFIG.agentsOnline };
}

export function generateChatReply(message: string, agentName: string): string {
  for (const rule of CHAT_RESPONSES) {
    if (rule.match.test(message)) return rule.reply;
  }
  return `Thanks for your message. ${agentName} is reviewing this and will respond shortly. For faster help, you can also reach us on WhatsApp or request a voice callback.`;
}

export function buildWhatsAppLink(config: SupportConfig, message: string, guestName?: string) {
  const text = encodeURIComponent(
    `Hi ${config.restaurantName} Support${guestName ? ` — ${guestName}` : ""}:\n${message}`,
  );
  const url = `https://wa.me/${config.whatsappNumber.replace(/\D/g, "")}?text=${text}`;
  return { url, number: config.whatsappDisplay, message: message.trim() };
}

export function buildVoiceRequest(opts: {
  guestName?: string;
  guestPhone?: string;
  preferredSlot?: string;
  reason?: string;
}) {
  return {
    channel: "voice" as const,
    subject: `Voice callback — ${opts.preferredSlot ?? "ASAP"}`,
    message: [
      `Callback requested for ${opts.guestPhone ?? "guest"}`,
      opts.guestName ? `Name: ${opts.guestName}` : null,
      opts.preferredSlot ? `Preferred time: ${opts.preferredSlot}` : null,
      opts.reason ? `Reason: ${opts.reason}` : null,
    ].filter(Boolean).join("\n"),
    priority: "high" as const,
  };
}

export function buildEmergencyAlert(opts: {
  emergencyType: string;
  location?: string;
  guestName?: string;
  guestPhone?: string;
  message?: string;
  tableName?: string;
}) {
  const typeLabel = opts.emergencyType.replace(/_/g, " ");
  return {
    channel: "emergency" as const,
    subject: `EMERGENCY: ${typeLabel}${opts.tableName ? ` — ${opts.tableName}` : ""}`,
    message: [
      `🚨 EMERGENCY — ${typeLabel.toUpperCase()}`,
      opts.guestName ? `Guest: ${opts.guestName}` : null,
      opts.guestPhone ? `Phone: ${opts.guestPhone}` : null,
      opts.tableName ? `Table/Room: ${opts.tableName}` : null,
      opts.location ? `Location: ${opts.location}` : null,
      opts.message ? `Details: ${opts.message}` : null,
    ].filter(Boolean).join("\n"),
    priority: "urgent" as const,
  };
}

export function formatTicketNumber(id: number) {
  return `TKT-${String(id).padStart(5, "0")}`;
}

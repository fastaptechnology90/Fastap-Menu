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

/**
 * Every number here used to be a placeholder that shipped as if it were real: a
 * WhatsApp line, a 1800 helpline, a security line, a manager's line, and — worst of the
 * set — an emergency hotline. A guest at a venue that had configured none of them was
 * shown all six and could have dialled an invented number during a medical emergency.
 *
 * Nothing is invented now. A channel the venue has not set up comes back empty, and the
 * screen shows it as unavailable rather than printing a number that reaches nobody.
 */
const DEFAULT_CONFIG: SupportConfig = {
  restaurantName: "Restaurant",
  whatsappNumber: "",
  whatsappDisplay: "",
  voiceHelpline: "",
  voiceHelplineDisplay: "",
  emergencyHotline: "",
  emergencyDisplay: "",
  securityLine: "",
  managerLine: "",
  supportEmail: "",
  hours: "",
  agentsOnline: 0,
};

/**
 * Canned answers, written as an automated assistant would answer them. The previous set
 * promised things nothing does: "I'll check the kitchen status right away", "our kitchen
 * manager will review immediately", "I'm escalating this to the duty manager, they'll
 * reach out within 5 minutes". No message reached anyone. Each reply now either points
 * at a screen that genuinely does the thing, or at a person on the floor.
 */
const CHAT_RESPONSES: { match: RegExp; reply: string }[] = [
  { match: /order|where|status|track/i, reply: "You can follow your order live on the order tracking screen — it updates as the kitchen moves it along. If it looks stuck, please speak to a member of staff." },
  { match: /refund|payment|bill|charge/i, reply: "Raise a request about the bill here and the restaurant's team will see it. For anything urgent about a payment, please ask at the counter — they can look at the bill with you now." },
  { match: /reserv|book|table/i, reply: "Reservations are handled on the reservations screen, where you can pick a date, time and party size." },
  { match: /allerg|diet|vegan|jain/i, reply: "Please tell a member of staff about any allergy directly, before you order. This is an automated assistant, so nothing typed here reaches the kitchen in time to matter." },
  { match: /manager|complaint|unhappy|bad/i, reply: "Raise a request here and it goes to the restaurant's team. If you would like to speak to the duty manager now, please ask any member of staff." },
  { match: /wait|slow|delay/i, reply: "The order tracking screen shows where your food has got to. If it has been longer than that suggests, please flag a member of staff." },
  { match: /wifi|app|login|technical/i, reply: "Try reloading the page first. If it still will not work, raise a request here with what you were doing and the restaurant's team will see it." },
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

/**
 * The chat introduced itself with a person's name drawn at random — "I'm Priya from
 * support" — and then answered from a fixed list of replies. Nobody read the messages
 * and nobody was ever going to reply. A guest with a real problem sat waiting on a
 * person who does not exist.
 *
 * It is an automated assistant, so it says so, and it points at the channels that do
 * reach a human.
 */
export const CHAT_ASSISTANT_NAME = "Support assistant";

export function createChatSession(restaurantId: number, guestName?: string) {
  const sessionId = `gs-${restaurantId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const welcome = `Hi${guestName ? ` ${guestName.split(" ")[0]}` : ""} — this is an automated assistant. `
    + `I can answer common questions straight away. For anything else, raise a request and a member of staff will see it.`;
  return { sessionId, agentName: CHAT_ASSISTANT_NAME, automated: true, welcome, agentsOnline: 0 };
}

export function generateChatReply(message: string, _agentName?: string): string {
  for (const rule of CHAT_RESPONSES) {
    if (rule.match.test(message)) return rule.reply;
  }
  // No promise that a person is reviewing it, because none is.
  return "I could not answer that one automatically. Raise a request here and a member of "
    + "staff at the restaurant will see it, or speak to someone on the floor if it is urgent.";
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

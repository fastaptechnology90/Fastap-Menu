/** Live Support System — catalog & demo data */
export type SupportChannelId =
  | "live_chat"
  | "whatsapp"
  | "voice"
  | "ticket"
  | "emergency";

export const SUPPORT_CHANNELS = [
  { id: "live_chat" as const, label: "Live Chat", icon: "💬", desc: "Instant chat with support agent · avg 2 min response", avgWait: "2 min" },
  { id: "whatsapp" as const, label: "WhatsApp Support", icon: "📱", desc: "Message us on WhatsApp · share photos & receipts", avgWait: "5 min" },
  { id: "voice" as const, label: "Voice Support", icon: "📞", desc: "Request a callback or call our helpline directly", avgWait: "10 min" },
  { id: "ticket" as const, label: "Ticket Support", icon: "🎫", desc: "Submit a ticket · track status until resolved", avgWait: "24 hrs" },
  { id: "emergency" as const, label: "Emergency Support", icon: "🚨", desc: "Urgent safety, medical or security issues · 24/7", avgWait: "Immediate" },
];

export const TICKET_CATEGORIES = [
  { id: "order", label: "Order Issue", icon: "🍽️" },
  { id: "payment", label: "Payment / Billing", icon: "💳" },
  { id: "reservation", label: "Reservation", icon: "📅" },
  { id: "food_quality", label: "Food Quality", icon: "⭐" },
  { id: "staff", label: "Staff / Service", icon: "👤" },
  { id: "technical", label: "App / Technical", icon: "📱" },
  { id: "other", label: "Other", icon: "❓" },
];

export const VOICE_CALLBACK_SLOTS = [
  "ASAP (within 15 min)",
  "Within 30 minutes",
  "Within 1 hour",
  "Today — afternoon",
  "Today — evening",
];

export const DEMO_SUPPORT_CONFIG = {
  restaurantName: "Spice Garden",
  whatsappNumber: "919876543210",
  whatsappDisplay: "+91 98765 43210",
  voiceHelpline: "+91 1800-123-4567",
  voiceHelplineDisplay: "1800-123-4567",
  emergencyHotline: "+91 98765 99999",
  emergencyDisplay: "+91 98765 99999",
  securityLine: "+91 98765 88888",
  managerLine: "+91 98765 77777",
  supportEmail: "support@spicegarden.com",
  hours: "24/7 for emergencies · Chat & tickets 9 AM – 11 PM",
  agentsOnline: 3,
};

export const DEMO_CHAT_MESSAGES = [
  { id: 1, role: "agent" as const, name: "Priya (Support)", message: "Hi! Welcome to Spice Garden support. How can I help you today?", at: new Date(Date.now() - 60000).toISOString() },
];

export const DEMO_TICKETS = [
  { id: 101, ticketNumber: "TKT-101", channel: "ticket", subject: "Wrong item delivered", category: "order", status: "open", priority: "normal", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 102, ticketNumber: "TKT-102", channel: "whatsapp", subject: "Refund request", category: "payment", status: "in_progress", priority: "high", createdAt: new Date(Date.now() - 172800000).toISOString() },
];

export const CHAT_QUICK_REPLIES = [
  "Where is my order?",
  "I need a refund",
  "Table reservation help",
  "Allergy concern",
  "Speak to manager",
];

export const EMERGENCY_TYPES = [
  { id: "medical", label: "Medical Emergency", icon: "🏥", desc: "Guest illness or injury on premises" },
  { id: "security", label: "Security Issue", icon: "🛡️", desc: "Theft, harassment, or safety threat" },
  { id: "fire", label: "Fire / Evacuation", icon: "🔥", desc: "Fire alarm, smoke, or evacuation needed" },
  { id: "food_safety", label: "Food Safety", icon: "⚠️", desc: "Allergic reaction or contaminated food" },
  { id: "other", label: "Other Emergency", icon: "🚨", desc: "Any urgent situation requiring immediate help" },
];

/** Live Support System — catalog & demo data */
export type SupportChannelId =
  | "live_chat"
  | "whatsapp"
  | "voice"
  | "ticket"
  | "emergency";

/**
 * Every response time here was a promise nothing keeps — no queue is measured and no
 * agent is staffed, so "avg 2 min response" and "Immediate" were decoration on a
 * safety screen. What each channel actually is, is described instead.
 */
export const SUPPORT_CHANNELS = [
  { id: "live_chat" as const, label: "Quick answers", icon: "💬", desc: "Automated assistant · answers common questions straight away", avgWait: "" },
  { id: "whatsapp" as const, label: "WhatsApp", icon: "📱", desc: "Message the restaurant on WhatsApp · share photos & receipts", avgWait: "" },
  { id: "voice" as const, label: "Phone", icon: "📞", desc: "Call the restaurant, or ask them to call you back", avgWait: "" },
  { id: "ticket" as const, label: "Raise a request", icon: "🎫", desc: "Goes to the restaurant's team · track it here until it is closed", avgWait: "" },
  { id: "emergency" as const, label: "Emergency", icon: "🚨", desc: "Urgent safety, medical or security issues — also tell a member of staff", avgWait: "" },
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

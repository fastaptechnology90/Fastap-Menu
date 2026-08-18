import { Router, type IRouter, type Request } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db, restaurantsTable, guestUsersTable, supportTicketsTable, chatMessagesTable,
} from "@workspace/db";
import {
  getSupportCatalog, resolveSupportConfig, createChatSession, generateChatReply,
  buildWhatsAppLink, buildVoiceRequest, buildEmergencyAlert, formatTicketNumber,
} from "../lib/liveSupportLogic.js";

const router: IRouter = Router();

async function getGuestUser(req: Request) {
  const guestUserId = req.session.guestUserId;
  if (!guestUserId) return null;
  const [user] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestUserId));
  return user ?? null;
}

async function loadRestaurant(restaurantId: number) {
  const [r] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  return r ?? null;
}

async function createSupportTicket(values: {
  restaurantId?: number | null;
  guestUserId?: number | null;
  guestName?: string | null;
  guestPhone?: string | null;
  channel: string;
  subject?: string | null;
  message: string;
  priority?: string;
}) {
  const [ticket] = await db.insert(supportTicketsTable).values({
    restaurantId: values.restaurantId ?? null,
    guestUserId: values.guestUserId ?? null,
    guestName: values.guestName,
    guestPhone: values.guestPhone,
    channel: values.channel,
    subject: values.subject,
    message: values.message,
    priority: values.priority ?? "normal",
    status: "open",
  }).returning();
  return { ...ticket, ticketNumber: formatTicketNumber(ticket.id) };
}

router.get("/public/support/catalog", (_req, res) => {
  res.json(getSupportCatalog());
});

router.get("/public/support/config/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const restaurant = await loadRestaurant(restaurantId);
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }
  res.json(resolveSupportConfig(restaurant));
});

router.post("/public/support/chat/start", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  if (!restaurantId) { res.status(400).json({ error: "restaurantId required" }); return; }

  const guest = await getGuestUser(req);
  const guestName = req.body.guestName ?? guest?.name;
  const session = createChatSession(restaurantId, guestName);

  await db.insert(chatMessagesTable).values({
    restaurantId,
    senderId: session.sessionId,
    senderName: session.agentName,
    senderRole: "agent",
    message: session.welcome,
    messageType: "text",
    channel: "guest_support",
  });

  res.json({ ...session, live: true });
});

router.get("/public/support/chat/:sessionId/messages", async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const restaurantId = parseInt(String(req.query.restaurantId ?? 0), 10);
  if (!restaurantId) { res.status(400).json({ error: "restaurantId required" }); return; }

  const rows = await db.select().from(chatMessagesTable).where(
    and(
      eq(chatMessagesTable.restaurantId, restaurantId),
      eq(chatMessagesTable.channel, "guest_support"),
      eq(chatMessagesTable.senderId, sessionId),
    ),
  ).orderBy(chatMessagesTable.createdAt);

  res.json({
    messages: rows.map(m => ({
      id: m.id,
      role: m.senderRole === "guest" ? "guest" : "agent",
      name: m.senderName,
      message: m.message,
      at: m.createdAt,
    })),
  });
});

router.post("/public/support/chat/:sessionId/message", async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  const message = String(req.body.message ?? "").trim();
  const agentName = String(req.body.agentName ?? "Support Agent");
  const guestName = String(req.body.guestName ?? "Guest");

  if (!restaurantId || !message) {
    res.status(400).json({ error: "restaurantId and message required" });
    return;
  }

  const [guestMsg] = await db.insert(chatMessagesTable).values({
    restaurantId,
    senderId: sessionId,
    senderName: guestName,
    senderRole: "guest",
    message,
    messageType: "text",
    channel: "guest_support",
  }).returning();

  const reply = generateChatReply(message, agentName);
  const [agentMsg] = await db.insert(chatMessagesTable).values({
    restaurantId,
    senderId: sessionId,
    senderName: agentName,
    senderRole: "agent",
    message: reply,
    messageType: "text",
    channel: "guest_support",
  }).returning();

  res.json({
    guestMessage: { id: guestMsg.id, role: "guest", name: guestName, message, at: guestMsg.createdAt },
    agentMessage: { id: agentMsg.id, role: "agent", name: agentName, message: reply, at: agentMsg.createdAt },
  });
});

router.post("/public/support/whatsapp", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  const message = String(req.body.message ?? "").trim();
  if (!restaurantId || !message) {
    res.status(400).json({ error: "restaurantId and message required" });
    return;
  }

  const guest = await getGuestUser(req);
  const restaurant = await loadRestaurant(restaurantId);
  const config = resolveSupportConfig(restaurant);
  const link = buildWhatsAppLink(config, message, req.body.guestName ?? guest?.name);

  const ticket = await createSupportTicket({
    restaurantId,
    guestUserId: guest?.id ?? null,
    guestName: req.body.guestName ?? guest?.name,
    guestPhone: req.body.guestPhone ?? guest?.phone,
    channel: "whatsapp",
    subject: req.body.subject ?? "WhatsApp support request",
    message: `WhatsApp initiated: ${message}`,
    priority: "normal",
  });

  res.json({ ...link, ticket, config: { whatsappDisplay: config.whatsappDisplay, hours: config.hours } });
});

router.post("/public/support/voice", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  const guestPhone = String(req.body.guestPhone ?? "").trim();
  if (!restaurantId || !guestPhone) {
    res.status(400).json({ error: "restaurantId and guestPhone required" });
    return;
  }

  const guest = await getGuestUser(req);
  const restaurant = await loadRestaurant(restaurantId);
  const config = resolveSupportConfig(restaurant);
  const voice = buildVoiceRequest({
    guestName: req.body.guestName ?? guest?.name,
    guestPhone,
    preferredSlot: req.body.preferredSlot,
    reason: req.body.reason,
  });

  const ticket = await createSupportTicket({
    restaurantId,
    guestUserId: guest?.id ?? null,
    guestName: req.body.guestName ?? guest?.name,
    guestPhone,
    channel: voice.channel,
    subject: voice.subject,
    message: voice.message,
    priority: voice.priority,
  });

  res.status(201).json({
    ticket,
    helpline: config.voiceHelpline,
    helplineDisplay: config.voiceHelplineDisplay,
    estimatedCallback: req.body.preferredSlot ?? "Within 15 minutes",
  });
});

router.post("/public/support/tickets", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  const { restaurantId, channel, subject, message, guestName, guestPhone, priority, category } = req.body;
  if (!message) { res.status(400).json({ error: "message required" }); return; }

  const fullMessage = category ? `[${category}] ${message}` : message;
  const ticket = await createSupportTicket({
    restaurantId: restaurantId ?? req.session.restaurantId ?? null,
    guestUserId: guest?.id ?? null,
    guestName: guestName || guest?.name,
    guestPhone: guestPhone || guest?.phone,
    channel: channel || "ticket",
    subject: subject || "Guest support request",
    message: fullMessage,
    priority: priority || "normal",
  });

  res.status(201).json(ticket);
});

router.get("/public/support/tickets/mine", async (req, res): Promise<void> => {
  const guest = await getGuestUser(req);
  if (!guest) { res.status(401).json({ error: "Not authenticated" }); return; }

  const rows = await db.select().from(supportTicketsTable)
    .where(eq(supportTicketsTable.guestUserId, guest.id))
    .orderBy(desc(supportTicketsTable.createdAt))
    .limit(20);

  res.json(rows.map(t => ({ ...t, ticketNumber: formatTicketNumber(t.id) })));
});

router.post("/public/support/emergency", async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.body.restaurantId ?? 0), 10);
  const emergencyType = String(req.body.emergencyType ?? "other");
  if (!restaurantId) { res.status(400).json({ error: "restaurantId required" }); return; }

  const guest = await getGuestUser(req);
  const restaurant = await loadRestaurant(restaurantId);
  const config = resolveSupportConfig(restaurant);
  const alert = buildEmergencyAlert({
    emergencyType,
    location: req.body.location,
    guestName: req.body.guestName ?? guest?.name,
    guestPhone: req.body.guestPhone ?? guest?.phone,
    message: req.body.message,
    tableName: req.body.tableName,
  });

  const ticket = await createSupportTicket({
    restaurantId,
    guestUserId: guest?.id ?? null,
    guestName: req.body.guestName ?? guest?.name,
    guestPhone: req.body.guestPhone ?? guest?.phone,
    channel: alert.channel,
    subject: alert.subject,
    message: alert.message,
    priority: alert.priority,
  });

  res.status(201).json({
    ticket,
    escalated: true,
    hotlines: {
      emergency: config.emergencyHotline,
      emergencyDisplay: config.emergencyDisplay,
      security: config.securityLine,
      manager: config.managerLine,
    },
    message: "Emergency alert sent. Staff has been notified. Help is on the way.",
  });
});

export default router;

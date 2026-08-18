import { Router, type IRouter, type Request } from "express";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  db,
  queueEntriesTable,
  restaurantsTable,
  tablesMapTable,
  notificationsLogTable,
  guestUsersTable,
  customersTable,
} from "@workspace/db";
import { isTableAvailable } from "../lib/smart-seating.js";
import {
  resolvePriority,
  sortWaitingQueue,
  computePosition,
  predictWaitTime,
  formatTokenNumber,
  anonymizeWaitlistEntry,
  logQueueAlert,
  buildJoinAlertMessage,
  buildReadyAlertMessage,
} from "../lib/queueLogic.js";
import { getSettingsSection } from "../lib/restaurant-settings.js";

const router: IRouter = Router();

async function getWaiting(restaurantId: number) {
  const rows = await db.select().from(queueEntriesTable).where(
    and(eq(queueEntriesTable.restaurantId, restaurantId), eq(queueEntriesTable.status, "waiting")),
  );
  return sortWaitingQueue(rows);
}

async function getFreeTableCount(restaurantId: number) {
  const tables = await db.select().from(tablesMapTable).where(
    and(eq(tablesMapTable.restaurantId, restaurantId), eq(tablesMapTable.isActive, true)),
  );
  return tables.filter(t => isTableAvailable(t.status)).length;
}

async function resolveMembershipTier(req: Request, restaurantId: number): Promise<string | undefined> {
  const guestUserId = req.session.guestUserId;
  if (!guestUserId) return undefined;
  const [guest] = await db.select().from(guestUsersTable).where(eq(guestUsersTable.id, guestUserId));
  if (!guest) return undefined;
  let points = parseInt(guest.loyaltyPoints || "0", 10);
  if (guest.phone) {
    const [customer] = await db.select().from(customersTable).where(
      and(eq(customersTable.restaurantId, restaurantId), eq(customersTable.phone, guest.phone)),
    );
    if (customer) points = Math.max(points, customer.loyaltyPoints);
  }
  if (points >= 5000) return "vip-elite";
  if (points >= 2500) return "diamond";
  if (points >= 1000) return "platinum";
  if (points >= 500) return "gold";
  return "silver";
}

async function sendJoinAlerts(
  restaurantId: number,
  entry: typeof queueEntriesTable.$inferSelect,
  notifyVia: string,
  position: number,
  estimatedWait: number,
) {
  const msg = buildJoinAlertMessage(entry.tokenNumber, position, estimatedWait);
  if (notifyVia === "sms" || notifyVia === "both") {
    await logQueueAlert(db, notificationsLogTable, restaurantId, "sms", entry.guestPhone, "Queue joined", msg, { event: "joined", tokenNumber: entry.tokenNumber });
  }
  if (notifyVia === "whatsapp" || notifyVia === "both") {
    await logQueueAlert(db, notificationsLogTable, restaurantId, "whatsapp", entry.guestPhone, "Queue joined", msg, { event: "joined", tokenNumber: entry.tokenNumber });
  }
}

export async function sendReadyAlerts(entry: typeof queueEntriesTable.$inferSelect) {
  const msg = buildReadyAlertMessage(entry.tokenNumber);
  const via = entry.notifyVia ?? "app";
  if (via === "sms" || via === "both") {
    await logQueueAlert(db, notificationsLogTable, entry.restaurantId, "sms", entry.guestPhone, "Table ready", msg, { event: "ready", tokenNumber: entry.tokenNumber });
  }
  if (via === "whatsapp" || via === "both") {
    await logQueueAlert(db, notificationsLogTable, entry.restaurantId, "whatsapp", entry.guestPhone, "Table ready", msg, { event: "ready", tokenNumber: entry.tokenNumber });
  }
}

router.get("/public/queue/stats/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const partySize = parseInt(String(req.query.partySize ?? "2"), 10);
  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, restaurantId));
  if (!restaurant) { res.status(404).json({ error: "Restaurant not found" }); return; }

  const waiting = await getWaiting(restaurantId);
  const freeTables = await getFreeTableCount(restaurantId);
  const joinPosition = waiting.length + 1;
  const prediction = predictWaitTime(joinPosition, partySize, freeTables, waiting.length);

  res.json({
    restaurantId,
    restaurantName: restaurant.name,
    queueLength: waiting.length,
    freeTables,
    freeTablesSoon: prediction.freeTablesSoon,
    estimatedWait: prediction.estimatedWait,
    groupsAhead: prediction.groupsAhead,
    predictionLabel: prediction.predictionLabel,
    liveWaitTime: prediction.estimatedWait,
    digitalWaitlistCount: waiting.length,
  });
});

router.get("/public/queue/waitlist/:restaurantId", async (req, res): Promise<void> => {
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const waiting = await getWaiting(restaurantId);
  res.json({
    queueLength: waiting.length,
    entries: waiting.map((e, i) => anonymizeWaitlistEntry(e, i + 1)),
  });
});

router.post("/public/queue", async (req, res): Promise<void> => {
  const {
    restaurantId, guestName, guestPhone, partySize, tablePreference,
    specialRequests, notifyVia, queueType, priority, corporateCode, membershipTier,
  } = req.body;
  if (!restaurantId || !guestName) { res.status(400).json({ error: "restaurantId and guestName required" }); return; }

  // The check above only rejected an empty value, so "a" or "..." made a valid queue
  // entry. Staff then had a token with nothing usable to call out. A name has to be
  // long enough to actually be a name.
  // Counts letters in any script, so Hindi, Tamil and Latin names are all accepted
  // while "a", "..." and "12" are not. Listing character ranges by hand would have
  // meant quietly rejecting every guest who does not write in English.
  const name = String(guestName).trim();
  if ((name.match(/\p{L}/gu) ?? []).length < 2) {
    res.status(400).json({ error: "Please enter the guest's name" });
    return;
  }

  // The phone stays optional — walk-ins without one are a real case, so this only
  // checks the shape when something was actually entered, rather than storing a
  // number that can never be dialled.
  const phone = guestPhone == null ? "" : String(guestPhone).trim();
  if (phone && phone.replace(/\D/g, "").length < 10) {
    res.status(400).json({ error: "Enter a valid phone number, or leave it blank" });
    return;
  }

  const rid = parseInt(restaurantId, 10);
  const size = parseInt(partySize) || 1;
  const tier = membershipTier ?? await resolveMembershipTier(req, rid);
  const queueSettings = await getSettingsSection<{ corporateCodes?: string[] }>(rid, "queue", {});
  const resolvedPriority = resolvePriority({
    priority,
    queueType,
    membershipTier: tier,
    corporateCode,
    partySize: size,
    validCorporateCodes: queueSettings.corporateCodes ?? [],
  });

  const waiting = await db.select().from(queueEntriesTable).where(
    and(eq(queueEntriesTable.restaurantId, rid), eq(queueEntriesTable.status, "waiting")),
  );
  const nextToken = waiting.length > 0 ? Math.max(...waiting.map(w => w.tokenNumber)) + 1 : 1;
  const publicToken = randomBytes(16).toString("hex");
  const freeTables = await getFreeTableCount(rid);

  const [entry] = await db.insert(queueEntriesTable).values({
    restaurantId: rid,
    tokenNumber: nextToken,
    // Store what was validated, so a trailing space cannot slip past the check above.
    guestName: name,
    guestPhone: phone || null,
    partySize: size,
    tablePreference,
    specialRequests: corporateCode ? `Corporate: ${corporateCode}${specialRequests ? ` | ${specialRequests}` : ""}` : specialRequests,
    notifyVia: notifyVia || "app",
    queueType: queueType || "dining",
    priority: resolvedPriority,
    publicToken,
    estimatedWait: 15,
    status: "waiting",
  }).returning();

  const sorted = sortWaitingQueue([...waiting, entry]);
  const position = computePosition(sorted, entry.id);
  const prediction = predictWaitTime(position, size, freeTables, sorted.length);

  await db.update(queueEntriesTable).set({ estimatedWait: prediction.estimatedWait }).where(eq(queueEntriesTable.id, entry.id));

  await sendJoinAlerts(rid, entry, notifyVia || "app", position, prediction.estimatedWait);

  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, rid));

  res.status(201).json({
    token: publicToken,
    tokenNumber: entry.tokenNumber,
    displayToken: formatTokenNumber(entry.tokenNumber),
    position,
    estimatedWait: prediction.estimatedWait,
    groupsAhead: prediction.groupsAhead,
    freeTablesSoon: prediction.freeTablesSoon,
    predictionLabel: prediction.predictionLabel,
    priority: resolvedPriority,
    restaurantName: restaurant?.name || "Restaurant",
    alerts: {
      sms: notifyVia === "sms" || notifyVia === "both",
      whatsapp: notifyVia === "whatsapp" || notifyVia === "both",
      app: true,
    },
    entry: { ...entry, estimatedWait: prediction.estimatedWait, priority: resolvedPriority },
  });
});

router.get("/public/queue/:token", async (req, res): Promise<void> => {
  const [entry] = await db.select().from(queueEntriesTable).where(eq(queueEntriesTable.publicToken, req.params.token));
  if (!entry) { res.status(404).json({ error: "Queue entry not found" }); return; }

  const waiting = await getWaiting(entry.restaurantId);
  const freeTables = await getFreeTableCount(entry.restaurantId);
  const position = entry.status === "waiting" ? computePosition(waiting, entry.id) : 0;
  const prediction = predictWaitTime(position || 1, entry.partySize, freeTables, waiting.length);

  if (entry.status === "waiting" && entry.estimatedWait !== prediction.estimatedWait) {
    await db.update(queueEntriesTable).set({ estimatedWait: prediction.estimatedWait }).where(eq(queueEntriesTable.id, entry.id));
  }

  const [restaurant] = await db.select().from(restaurantsTable).where(eq(restaurantsTable.id, entry.restaurantId));

  res.json({
    token: entry.publicToken,
    tokenNumber: entry.tokenNumber,
    displayToken: formatTokenNumber(entry.tokenNumber),
    position: position || 1,
    estimatedWait: prediction.estimatedWait,
    liveWaitTime: prediction.estimatedWait,
    groupsAhead: prediction.groupsAhead,
    freeTablesSoon: prediction.freeTablesSoon,
    predictionLabel: prediction.predictionLabel,
    status: entry.status,
    priority: entry.priority,
    notifyVia: entry.notifyVia,
    restaurantName: restaurant?.name,
    queueLength: waiting.length,
    digitalWaitlist: waiting.slice(0, 8).map((e, i) => anonymizeWaitlistEntry(e, i + 1)),
    entry,
  });
});

router.delete("/public/queue/:token", async (req, res): Promise<void> => {
  const [entry] = await db.update(queueEntriesTable).set({ status: "cancelled" }).where(
    and(eq(queueEntriesTable.publicToken, req.params.token), eq(queueEntriesTable.status, "waiting")),
  ).returning();
  if (!entry) { res.status(404).json({ error: "Queue entry not found" }); return; }
  res.json({ success: true });
});

export default router;

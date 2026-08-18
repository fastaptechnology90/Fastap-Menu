import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, feedbackTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings";

const router: IRouter = Router();

type ReviewReply = { reply: string; repliedAt: string };

function sentimentFromRating(r: number): "positive" | "negative" | "neutral" {
  if (r >= 4) return "positive";
  if (r <= 2) return "negative";
  return "neutral";
}

router.get("/restaurants/:restaurantId/reviews", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const { source, sentiment, replied } = req.query;

  const rows = await db.select().from(feedbackTable)
    .where(eq(feedbackTable.restaurantId, rid))
    .orderBy(desc(feedbackTable.createdAt));

  const replyStore = await getSettingsSection<Record<string, ReviewReply>>(rid, "reviewReplies", {});

  let reviews = rows.map(f => {
    const replyData = replyStore[String(f.id)];
    return {
      id: f.id,
      source: "internal",
      reviewer: f.customerName || "Guest",
      rating: f.rating,
      text: f.comment || "",
      date: f.createdAt.toISOString(),
      replied: Boolean(replyData?.reply),
      reply: replyData?.reply || "",
      repliedAt: replyData?.repliedAt,
      sentiment: sentimentFromRating(f.rating),
      status: "published",
    };
  });

  if (source && source !== "all") reviews = reviews.filter(r => r.source === source);
  if (sentiment && sentiment !== "all") reviews = reviews.filter(r => r.sentiment === sentiment);
  if (replied === "true") reviews = reviews.filter(r => r.replied);
  if (replied === "false") reviews = reviews.filter(r => !r.replied);

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "0";
  res.json({
    reviews,
    stats: {
      total: reviews.length,
      averageRating: avg,
      positive: reviews.filter(r => r.sentiment === "positive").length,
      negative: reviews.filter(r => r.sentiment === "negative").length,
      neutral: reviews.filter(r => r.sentiment === "neutral").length,
      replied: reviews.filter(r => r.replied).length,
    },
  });
});

router.post("/restaurants/:restaurantId/reviews/:id/reply", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const id = parseInt(req.params.id, 10);
  const { reply } = req.body;

  const [feedback] = await db.select().from(feedbackTable)
    .where(and(eq(feedbackTable.id, id), eq(feedbackTable.restaurantId, rid)));
  if (!feedback) { res.status(404).json({ error: "Review not found" }); return; }

  const replyStore = await getSettingsSection<Record<string, ReviewReply>>(rid, "reviewReplies", {});
  const updated: ReviewReply = { reply: String(reply || ""), repliedAt: new Date().toISOString() };
  replyStore[String(id)] = updated;
  await setSettingsSection(rid, "reviewReplies", replyStore);

  res.json({
    id,
    source: "internal",
    reviewer: feedback.customerName || "Guest",
    rating: feedback.rating,
    text: feedback.comment || "",
    date: feedback.createdAt.toISOString(),
    replied: true,
    reply: updated.reply,
    repliedAt: updated.repliedAt,
    sentiment: sentimentFromRating(feedback.rating),
    status: "published",
  });
});

router.post("/restaurants/:restaurantId/reviews", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const { reviewer, rating, text, source } = req.body;
  const parsedRating = parseInt(String(rating), 10);
  if (!parsedRating || parsedRating < 1 || parsedRating > 5) {
    res.status(400).json({ error: "rating (1-5) required" });
    return;
  }

  const [feedback] = await db.insert(feedbackTable).values({
    restaurantId: rid,
    customerName: reviewer || "Guest",
    rating: parsedRating,
    comment: text || "",
  }).returning();

  res.status(201).json({
    id: feedback.id,
    source: source || "internal",
    reviewer: feedback.customerName || "Guest",
    rating: feedback.rating,
    text: feedback.comment || "",
    date: feedback.createdAt.toISOString(),
    replied: false,
    reply: "",
    sentiment: sentimentFromRating(feedback.rating),
    status: "published",
  });
});

router.delete("/restaurants/:restaurantId/reviews/:id", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(req.params.restaurantId, 10);
  const id = parseInt(req.params.id, 10);

  const [deleted] = await db.delete(feedbackTable)
    .where(and(eq(feedbackTable.id, id), eq(feedbackTable.restaurantId, rid)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Review not found" }); return; }

  const replyStore = await getSettingsSection<Record<string, ReviewReply>>(rid, "reviewReplies", {});
  delete replyStore[String(id)];
  await setSettingsSection(rid, "reviewReplies", replyStore);

  res.json({ success: true });
});

export default router;

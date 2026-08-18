import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, documentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/documents", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const docs = await db.select().from(documentsTable).where(eq(documentsTable.restaurantId, id)).orderBy(desc(documentsTable.createdAt));
  res.json(docs);
});

router.post("/restaurants/:restaurantId/documents", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { name, category, description, fileUrl, fileType, fileSize, expiryDate, uploadedBy } = req.body;
  const expiryStatus = expiryDate && new Date(expiryDate) < new Date() ? "expired" : expiryDate && new Date(expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? "pending_renewal" : "active";
  const [doc] = await db.insert(documentsTable).values({ restaurantId: id, name, category, description, fileUrl, fileType, fileSize: fileSize ? parseInt(fileSize) : null, expiryDate: expiryDate ? new Date(expiryDate) : undefined, status: expiryStatus, uploadedBy }).returning();
  res.status(201).json(doc);
});

router.put("/restaurants/:restaurantId/documents/:docId", requireAuth, async (req, res): Promise<void> => {
  const docId = parseInt(req.params.docId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { name, category, description, expiryDate } = req.body;
  const [doc] = await db.update(documentsTable).set({ name, category, description, expiryDate: expiryDate ? new Date(expiryDate) : undefined }).where(and(eq(documentsTable.id, docId), eq(documentsTable.restaurantId, restaurantId))).returning();
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
  res.json(doc);
});

router.delete("/restaurants/:restaurantId/documents/:docId", requireAuth, async (req, res): Promise<void> => {
  const docId = parseInt(req.params.docId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  await db.delete(documentsTable).where(and(eq(documentsTable.id, docId), eq(documentsTable.restaurantId, restaurantId)));
  res.json({ message: "Document deleted" });
});

export default router;

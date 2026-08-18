import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, feedbackTable } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/feedback", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const feedback = await db.select().from(feedbackTable).where(eq(feedbackTable.restaurantId, id));
  res.json(feedback);
});

export default router;

import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, housekeepingTasksTable, maintenanceRequestsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { autoAssignHousekeepingTask } from "../lib/staff-auto-assignment.js";

const router: IRouter = Router();

router.get("/restaurants/:restaurantId/housekeeping", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const tasks = await db.select().from(housekeepingTasksTable).where(eq(housekeepingTasksTable.restaurantId, id)).orderBy(desc(housekeepingTasksTable.createdAt));
  res.json(tasks);
});

router.post("/restaurants/:restaurantId/housekeeping", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { type, title, description, location, roomNumber, priority, assignedTo, scheduledAt, isRecurring, recurringInterval } = req.body;
  const [task] = await db.insert(housekeepingTasksTable).values({ restaurantId: id, type, title, description, location, roomNumber, priority, assignedTo, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined, isRecurring: Boolean(isRecurring), recurringInterval }).returning();
  const result = assignedTo ? task : await autoAssignHousekeepingTask(id, task.id);
  res.status(201).json(result ?? task);
});

router.put("/restaurants/:restaurantId/housekeeping/:taskId", requireAuth, async (req, res): Promise<void> => {
  const taskId = parseInt(req.params.taskId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status, assignedTo, notes, title, priority } = req.body;
  const [task] = await db.update(housekeepingTasksTable).set({
    status, assignedTo, notes, title, priority,
    completedAt: status === "completed" ? new Date() : undefined,
  }).where(and(eq(housekeepingTasksTable.id, taskId), eq(housekeepingTasksTable.restaurantId, restaurantId))).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(task);
});

router.delete("/restaurants/:restaurantId/housekeeping/:taskId", requireAuth, async (req, res): Promise<void> => {
  const taskId = parseInt(req.params.taskId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  await db.delete(housekeepingTasksTable).where(and(eq(housekeepingTasksTable.id, taskId), eq(housekeepingTasksTable.restaurantId, restaurantId)));
  res.json({ message: "Task deleted" });
});

router.get("/restaurants/:restaurantId/maintenance", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const requests = await db.select().from(maintenanceRequestsTable).where(eq(maintenanceRequestsTable.restaurantId, id)).orderBy(desc(maintenanceRequestsTable.createdAt));
  res.json(requests);
});

router.post("/restaurants/:restaurantId/maintenance", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { title, description, location, category, priority, reportedBy, estimatedCost } = req.body;
  const [req2] = await db.insert(maintenanceRequestsTable).values({ restaurantId: id, title, description, location, category, priority, reportedBy, estimatedCost }).returning();
  res.status(201).json(req2);
});

router.put("/restaurants/:restaurantId/maintenance/:reqId", requireAuth, async (req, res): Promise<void> => {
  const reqId = parseInt(req.params.reqId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status, assignedTo, actualCost } = req.body;
  const [updated] = await db.update(maintenanceRequestsTable).set({ status, assignedTo, actualCost, resolvedAt: status === "resolved" ? new Date() : undefined }).where(and(eq(maintenanceRequestsTable.id, reqId), eq(maintenanceRequestsTable.restaurantId, restaurantId))).returning();
  if (!updated) { res.status(404).json({ error: "Request not found" }); return; }
  res.json(updated);
});

export default router;

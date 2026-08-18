import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, tasksTable, sopItemsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings";

const router: IRouter = Router();

const DEFAULT_TRAINING_VIDEOS = [
  { id: "V01", title: "POS System Training — Complete Guide", duration: "18 min", category: "operations", views: 12, completions: 8, level: "required", thumbnail: "POS", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id: "V02", title: "Food Safety: Handling Raw & Cooked Items", duration: "12 min", category: "safety", views: 16, completions: 15, level: "required", thumbnail: "FOOD", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id: "V03", title: "Customer Greeting & Table Etiquette", duration: "8 min", category: "service", views: 14, completions: 11, level: "required", thumbnail: "SVC", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id: "V04", title: "How to Handle Customer Complaints", duration: "10 min", category: "service", views: 10, completions: 7, level: "recommended", thumbnail: "CHAT", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id: "V05", title: "Fire Extinguisher & Emergency Procedures", duration: "6 min", category: "safety", views: 18, completions: 18, level: "required", thumbnail: "SAFE", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id: "V06", title: "Upselling & Revenue-Building Techniques", duration: "15 min", category: "sales", views: 8, completions: 4, level: "recommended", thumbnail: "SALE", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
];

const DEFAULT_CHECKLISTS = {
  opening: [
    { id: "O1", task: "Unlock all doors and deactivate alarm", mandatory: true, role: "manager" },
    { id: "O2", task: "Switch on all lights and air conditioning", mandatory: true, role: "manager" },
    { id: "O3", task: "Power on POS terminals and kitchen displays", mandatory: true, role: "cashier" },
    { id: "O4", task: "Check cash float in POS drawer (₹5,000)", mandatory: true, role: "cashier" },
    { id: "O5", task: "Check refrigerator temperatures (< 4°C)", mandatory: true, role: "kitchen" },
    { id: "O6", task: "Check daily specials and 86 items with chef", mandatory: true, role: "manager" },
    { id: "O7", task: "Staff briefing — confirm all present and assigned", mandatory: true, role: "manager" },
    { id: "O8", task: "Inspect table settings and cleanliness", mandatory: true, role: "manager" },
    { id: "O9", task: "Review today's reservations", mandatory: false, role: "manager" },
    { id: "O10", task: "Check inventory for low-stock items", mandatory: true, role: "kitchen" },
    { id: "O11", task: "Test WiFi and internet connectivity", mandatory: false, role: "cashier" },
    { id: "O12", task: "Activate online menu on delivery platforms", mandatory: true, role: "manager" },
  ],
  closing: [
    { id: "C1", task: "Process final end-of-day cash count and reconcile", mandatory: true, role: "cashier" },
    { id: "C2", task: "Run Z-report from POS", mandatory: true, role: "cashier" },
    { id: "C3", task: "Deposit excess cash in safe", mandatory: true, role: "manager" },
    { id: "C4", task: "Shut down kitchen equipment properly", mandatory: true, role: "kitchen" },
    { id: "C5", task: "Clean and sanitize all cooking surfaces", mandatory: true, role: "kitchen" },
    { id: "C6", task: "Secure all perishables in refrigerator", mandatory: true, role: "kitchen" },
    { id: "C7", task: "Wipe all tables and reset settings", mandatory: true, role: "waiter" },
    { id: "C8", task: "Mop floors and clean entrance", mandatory: true, role: "housekeeping" },
    { id: "C9", task: "Turn off all lights except security lights", mandatory: true, role: "manager" },
    { id: "C10", task: "Activate alarm and lock all doors", mandatory: true, role: "manager" },
    { id: "C11", task: "Record closing sales total in log book", mandatory: true, role: "manager" },
    { id: "C12", task: "Send daily summary to owner", mandatory: false, role: "manager" },
  ],
};

async function getTrainingVideos(rid: number) {
  return getSettingsSection(rid, "trainingVideos", DEFAULT_TRAINING_VIDEOS);
}

async function getChecklists(rid: number) {
  return getSettingsSection(rid, "checklists", DEFAULT_CHECKLISTS);
}

async function getChecklistProgress(rid: number) {
  return getSettingsSection<{ opening: string[]; closing: string[] }>(rid, "checklistProgress", { opening: [], closing: [] });
}

router.get("/restaurants/:restaurantId/tasks", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.restaurantId, id)).orderBy(desc(tasksTable.createdAt));
  res.json(tasks);
});

router.post("/restaurants/:restaurantId/tasks", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { title, description, category, priority, assignedTo, assignedRole, dueDate, isRecurring, recurringSchedule } = req.body;
  const [task] = await db.insert(tasksTable).values({ restaurantId: id, title, description, category, priority, assignedTo, assignedRole, dueDate: dueDate ? new Date(dueDate) : undefined, isRecurring: Boolean(isRecurring), recurringSchedule }).returning();
  res.status(201).json(task);
});

router.put("/restaurants/:restaurantId/tasks/:taskId", requireAuth, async (req, res): Promise<void> => {
  const taskId = parseInt(req.params.taskId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { status, assignedTo, priority, title, description } = req.body;
  const [task] = await db.update(tasksTable).set({ status, assignedTo, priority, title, description, completedAt: status === "completed" ? new Date() : undefined }).where(and(eq(tasksTable.id, taskId), eq(tasksTable.restaurantId, restaurantId))).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(task);
});

router.delete("/restaurants/:restaurantId/tasks/:taskId", requireAuth, async (req, res): Promise<void> => {
  const taskId = parseInt(req.params.taskId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  await db.delete(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.restaurantId, restaurantId)));
  res.json({ message: "Task deleted" });
});

router.get("/restaurants/:restaurantId/sop", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const items = await db.select().from(sopItemsTable).where(eq(sopItemsTable.restaurantId, id));
  res.json(items.map(i => ({ ...i, steps: Array.isArray(i.steps) ? i.steps : [], assignedRoles: Array.isArray(i.assignedRoles) ? i.assignedRoles : [] })));
});

router.post("/restaurants/:restaurantId/sop", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.restaurantId, 10);
  const { title, category, content, steps, videoUrl, assignedRoles } = req.body;
  const [item] = await db.insert(sopItemsTable).values({ restaurantId: id, title, category, content, steps: steps ?? [], videoUrl, assignedRoles: assignedRoles ?? [] }).returning();
  res.status(201).json(item);
});

router.put("/restaurants/:restaurantId/sop/:sopId", requireAuth, async (req, res): Promise<void> => {
  const sopId = parseInt(req.params.sopId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const { title, category, content, steps, videoUrl, assignedRoles, isActive } = req.body;
  const [item] = await db.update(sopItemsTable).set({ title, category, content, steps: steps ?? undefined, videoUrl, assignedRoles: assignedRoles ?? undefined, isActive }).where(and(eq(sopItemsTable.id, sopId), eq(sopItemsTable.restaurantId, restaurantId))).returning();
  if (!item) { res.status(404).json({ error: "SOP not found" }); return; }
  res.json(item);
});

router.get("/restaurants/:restaurantId/sop/:sopId/download", requireAuth, async (req, res): Promise<void> => {
  const sopId = parseInt(req.params.sopId, 10);
  const restaurantId = parseInt(req.params.restaurantId, 10);
  const [item] = await db.select().from(sopItemsTable).where(and(eq(sopItemsTable.id, sopId), eq(sopItemsTable.restaurantId, restaurantId)));
  if (!item) { res.status(404).json({ error: "SOP not found" }); return; }
  const steps = Array.isArray(item.steps) ? item.steps : [];
  const body = [
    item.title,
    `Category: ${item.category || "general"}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    item.content || "",
    "",
    "Steps:",
    ...steps.map((s: unknown, i: number) => `${i + 1}. ${String(s)}`),
  ].join("\n");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${item.title.replace(/[^a-z0-9-_]+/gi, "-")}.txt"`);
  res.send(body);
});

router.get("/restaurants/:restaurantId/training-videos", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  res.json(await getTrainingVideos(rid));
});

router.post("/restaurants/:restaurantId/training-videos/:videoId/view", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const videoId = req.params.videoId;
  const videos = await getTrainingVideos(rid);
  const idx = videos.findIndex((v: { id: string }) => v.id === videoId);
  if (idx === -1) { res.status(404).json({ error: "Video not found" }); return; }
  videos[idx] = { ...videos[idx], views: (videos[idx].views ?? 0) + 1 };
  await setSettingsSection(rid, "trainingVideos", videos);
  res.json(videos[idx]);
});

router.post("/restaurants/:restaurantId/training-videos/:videoId/complete", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const videoId = req.params.videoId;
  const videos = await getTrainingVideos(rid);
  const idx = videos.findIndex((v: { id: string }) => v.id === videoId);
  if (idx === -1) { res.status(404).json({ error: "Video not found" }); return; }
  videos[idx] = {
    ...videos[idx],
    views: (videos[idx].views ?? 0) + 1,
    completions: (videos[idx].completions ?? 0) + 1,
  };
  await setSettingsSection(rid, "trainingVideos", videos);
  res.json(videos[idx]);
});

router.get("/restaurants/:restaurantId/checklists", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const [templates, progress] = await Promise.all([getChecklists(rid), getChecklistProgress(rid)]);
  res.json({ templates, progress });
});

router.put("/restaurants/:restaurantId/checklists/progress", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const { type, checkedIds } = req.body as { type: "opening" | "closing"; checkedIds: string[] };
  if (type !== "opening" && type !== "closing") { res.status(400).json({ error: "Invalid checklist type" }); return; }
  const progress = await getChecklistProgress(rid);
  progress[type] = Array.isArray(checkedIds) ? checkedIds : [];
  await setSettingsSection(rid, "checklistProgress", progress);
  res.json(progress);
});

export default router;

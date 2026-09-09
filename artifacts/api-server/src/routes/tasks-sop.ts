import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, tasksTable, sopItemsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings";

const router: IRouter = Router();

/**
 * The training curriculum a venue starts with — titles only.
 *
 * Every one of these shipped with a videoUrl pointing at the same YouTube joke video,
 * including the one titled "Fire Extinguisher & Emergency Procedures", and each carried
 * invented view and completion counts ("18 views, 18 completions") so a manager checking
 * whether their staff had done the mandatory safety training was reading a number nobody
 * had measured, against a link that was a prank.
 *
 * A platform cannot supply a restaurant's safety training. What it can do is offer the
 * list of subjects worth covering and let the venue attach its own video to each. Until
 * it does, the row says so and nothing pretends anyone has watched it.
 */
const DEFAULT_TRAINING_VIDEOS = [
  { id: "V01", title: "POS System Training — Complete Guide", category: "operations", level: "required", thumbnail: "POS" },
  { id: "V02", title: "Food Safety: Handling Raw & Cooked Items", category: "safety", level: "required", thumbnail: "FOOD" },
  { id: "V03", title: "Customer Greeting & Table Etiquette", category: "service", level: "required", thumbnail: "SVC" },
  { id: "V04", title: "How to Handle Customer Complaints", category: "service", level: "recommended", thumbnail: "CHAT" },
  { id: "V05", title: "Fire Extinguisher & Emergency Procedures", category: "safety", level: "required", thumbnail: "SAFE" },
  { id: "V06", title: "Upselling & Revenue-Building Techniques", category: "sales", level: "recommended", thumbnail: "SALE" },
].map(v => ({
  ...v,
  // Null, not a placeholder: the screen shows "no video attached yet" and an upload,
  // rather than sending staff to somebody else's video.
  videoUrl: null as string | null,
  duration: null as string | null,
  views: 0,
  completions: 0,
  needsUpload: true,
}));

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
  const id = parseInt(String(req.params.restaurantId), 10);
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.restaurantId, id)).orderBy(desc(tasksTable.createdAt));
  res.json(tasks);
});

router.post("/restaurants/:restaurantId/tasks", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const { title, description, category, priority, assignedTo, assignedRole, dueDate, isRecurring, recurringSchedule } = req.body;
  const [task] = await db.insert(tasksTable).values({ restaurantId: id, title, description, category, priority, assignedTo, assignedRole, dueDate: dueDate ? new Date(dueDate) : undefined, isRecurring: Boolean(isRecurring), recurringSchedule }).returning();
  res.status(201).json(task);
});

router.put("/restaurants/:restaurantId/tasks/:taskId", requireAuth, async (req, res): Promise<void> => {
  const taskId = parseInt(String(req.params.taskId), 10);
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const { status, assignedTo, priority, title, description } = req.body;
  const [task] = await db.update(tasksTable).set({ status, assignedTo, priority, title, description, completedAt: status === "completed" ? new Date() : undefined }).where(and(eq(tasksTable.id, taskId), eq(tasksTable.restaurantId, restaurantId))).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(task);
});

router.delete("/restaurants/:restaurantId/tasks/:taskId", requireAuth, async (req, res): Promise<void> => {
  const taskId = parseInt(String(req.params.taskId), 10);
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  await db.delete(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.restaurantId, restaurantId)));
  res.json({ message: "Task deleted" });
});

router.get("/restaurants/:restaurantId/sop", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const items = await db.select().from(sopItemsTable).where(eq(sopItemsTable.restaurantId, id));
  res.json(items.map(i => ({ ...i, steps: Array.isArray(i.steps) ? i.steps : [], assignedRoles: Array.isArray(i.assignedRoles) ? i.assignedRoles : [] })));
});

router.post("/restaurants/:restaurantId/sop", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.restaurantId), 10);
  const { title, category, content, steps, videoUrl, assignedRoles } = req.body;
  const [item] = await db.insert(sopItemsTable).values({ restaurantId: id, title, category, content, steps: steps ?? [], videoUrl, assignedRoles: assignedRoles ?? [] }).returning();
  res.status(201).json(item);
});

router.put("/restaurants/:restaurantId/sop/:sopId", requireAuth, async (req, res): Promise<void> => {
  const sopId = parseInt(String(req.params.sopId), 10);
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const { title, category, content, steps, videoUrl, assignedRoles, isActive } = req.body;
  const [item] = await db.update(sopItemsTable).set({ title, category, content, steps: steps ?? undefined, videoUrl, assignedRoles: assignedRoles ?? undefined, isActive }).where(and(eq(sopItemsTable.id, sopId), eq(sopItemsTable.restaurantId, restaurantId))).returning();
  if (!item) { res.status(404).json({ error: "SOP not found" }); return; }
  res.json(item);
});

router.get("/restaurants/:restaurantId/sop/:sopId/download", requireAuth, async (req, res): Promise<void> => {
  const sopId = parseInt(String(req.params.sopId), 10);
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
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
  const rid = parseInt(String(req.params.restaurantId), 10);
  res.json(await getTrainingVideos(rid));
});

router.post("/restaurants/:restaurantId/training-videos/:videoId/view", requireAuth, async (req, res) => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const videoId = String(req.params.videoId);
  const videos = await getTrainingVideos(rid);
  const idx = videos.findIndex((v: { id: string }) => v.id === videoId);
  if (idx === -1) { res.status(404).json({ error: "Video not found" }); return; }
  videos[idx] = { ...videos[idx], views: (videos[idx].views ?? 0) + 1 };
  await setSettingsSection(rid, "trainingVideos", videos);
  res.json(videos[idx]);
});

router.post("/restaurants/:restaurantId/training-videos/:videoId/complete", requireAuth, async (req, res) => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const videoId = String(req.params.videoId);
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

/**
 * Training videos could be watched and marked complete, but never added, edited or
 * removed — so the list a restaurant saw was whatever shipped as the default, forever.
 * They live in the restaurant's settings rather than their own table, which is why these
 * read-modify-write the whole array.
 */
router.post("/restaurants/:restaurantId/training-videos", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const { title, url, description, duration, category, assignedRoles } = req.body;
  if (!title || !url) { res.status(400).json({ error: "title and url are required" }); return; }

  const videos = await getTrainingVideos(rid);
  const video = {
    id: `vid-${Date.now()}`,
    title: String(title),
    url: String(url),
    description: description ? String(description) : "",
    duration: duration ? String(duration) : "",
    category: category ? String(category) : "general",
    assignedRoles: Array.isArray(assignedRoles) ? assignedRoles : [],
    views: 0,
    completions: 0,
    addedAt: new Date().toISOString(),
  };
  await setSettingsSection(rid, "trainingVideos", [...videos, video]);
  res.status(201).json(video);
});

router.put("/restaurants/:restaurantId/training-videos/:videoId", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const videoId = String(req.params.videoId);
  const videos = await getTrainingVideos(rid);
  const idx = videos.findIndex((v: { id: string }) => v.id === videoId);
  if (idx === -1) { res.status(404).json({ error: "Video not found" }); return; }

  const { title, url, description, duration, category, assignedRoles } = req.body;
  videos[idx] = {
    ...videos[idx],
    ...(title !== undefined && { title: String(title) }),
    ...(url !== undefined && { url: String(url) }),
    ...(description !== undefined && { description: String(description) }),
    ...(duration !== undefined && { duration: String(duration) }),
    ...(category !== undefined && { category: String(category) }),
    ...(assignedRoles !== undefined && { assignedRoles: Array.isArray(assignedRoles) ? assignedRoles : [] }),
  };
  await setSettingsSection(rid, "trainingVideos", videos);
  res.json(videos[idx]);
});

router.delete("/restaurants/:restaurantId/training-videos/:videoId", requireAuth, async (req, res): Promise<void> => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const videoId = String(req.params.videoId);
  const videos = await getTrainingVideos(rid);
  const remaining = videos.filter((v: { id: string }) => v.id !== videoId);
  if (remaining.length === videos.length) { res.status(404).json({ error: "Video not found" }); return; }
  await setSettingsSection(rid, "trainingVideos", remaining);
  res.json({ success: true });
});

router.get("/restaurants/:restaurantId/checklists", requireAuth, async (req, res) => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const [templates, progress] = await Promise.all([getChecklists(rid), getChecklistProgress(rid)]);
  res.json({ templates, progress });
});

router.put("/restaurants/:restaurantId/checklists/progress", requireAuth, async (req, res) => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const { type, checkedIds } = req.body as { type: "opening" | "closing"; checkedIds: string[] };
  if (type !== "opening" && type !== "closing") { res.status(400).json({ error: "Invalid checklist type" }); return; }
  const progress = await getChecklistProgress(rid);
  progress[type] = Array.isArray(checkedIds) ? checkedIds : [];
  await setSettingsSection(rid, "checklistProgress", progress);
  res.json(progress);
});

/**
 * An SOP could be written and edited but never removed, so a procedure that no longer
 * applied stayed on the staff's checklist for good.
 */
router.delete("/restaurants/:restaurantId/sop/:sopId", requireAuth, async (req, res): Promise<void> => {
  const restaurantId = parseInt(String(req.params.restaurantId), 10);
  const sopId = parseInt(String(req.params.sopId), 10);
  const [row] = await db.delete(sopItemsTable)
    .where(and(eq(sopItemsTable.id, sopId), eq(sopItemsTable.restaurantId, restaurantId)))
    .returning();
  if (!row) { res.status(404).json({ error: "SOP not found" }); return; }
  res.json({ success: true });
});

export default router;

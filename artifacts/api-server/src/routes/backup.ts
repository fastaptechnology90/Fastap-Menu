import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const backups: Record<number, any[]> = {};
const settings: Record<number, any> = {};

function getBackups(rid: number) {
  if (!backups[rid]) {
    backups[rid] = [
      { id: 1, name: "Auto Backup - Full", type: "auto", status: "completed", size: "24.5 MB", tables: ["orders", "customers", "menu_items", "staff", "inventory", "finance", "reservations"], created_at: new Date(Date.now() - 86400000).toISOString(), duration: "12s", checksum: "sha256:a1b2c3d4" },
      { id: 2, name: "Manual Backup", type: "manual", status: "completed", size: "23.1 MB", tables: ["all"], created_at: new Date(Date.now() - 3 * 86400000).toISOString(), duration: "11s", checksum: "sha256:e5f6a7b8" },
      { id: 3, name: "Auto Backup - Full", type: "auto", status: "completed", size: "22.8 MB", tables: ["orders", "customers", "menu_items", "staff", "inventory", "finance", "reservations"], created_at: new Date(Date.now() - 7 * 86400000).toISOString(), duration: "10s", checksum: "sha256:c9d0e1f2" },
      { id: 4, name: "Pre-Update Backup", type: "manual", status: "completed", size: "21.5 MB", tables: ["all"], created_at: new Date(Date.now() - 14 * 86400000).toISOString(), duration: "10s", checksum: "sha256:b3c4d5e6" },
    ];
  }
  return backups[rid];
}

function getSettings(rid: number) {
  if (!settings[rid]) {
    settings[rid] = { auto_backup: true, frequency: "daily", time: "02:00", retention_days: 30, include_media: false, compress: true, encrypt: false, last_backup: new Date(Date.now() - 86400000).toISOString(), next_backup: new Date(Date.now() + 86400000).toISOString() };
  }
  return settings[rid];
}

router.get("/restaurants/:restaurantId/backup", requireAuth, (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  res.json({ backups: getBackups(rid), settings: getSettings(rid) });
});

router.post("/restaurants/:restaurantId/backup/create", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const { name, tables } = req.body;
  const backup = {
    id: Date.now(),
    name: name || `Manual Backup - ${new Date().toLocaleDateString()}`,
    type: "manual",
    status: "in_progress",
    size: "0 MB",
    tables: tables || ["all"],
    created_at: new Date().toISOString(),
    duration: null,
    checksum: null
  };
  getBackups(rid).unshift(backup);
  setTimeout(() => {
    const idx = getBackups(rid).findIndex(b => b.id === backup.id);
    if (idx !== -1) {
      getBackups(rid)[idx] = { ...backup, status: "completed", size: `${(20 + Math.random() * 10).toFixed(1)} MB`, duration: `${Math.floor(8 + Math.random() * 10)}s`, checksum: `sha256:${Math.random().toString(36).slice(2, 10)}` };
    }
  }, 3000);
  res.status(201).json(backup);
});

router.put("/restaurants/:restaurantId/backup/settings", requireAuth, (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  settings[rid] = { ...getSettings(rid), ...req.body };
  res.json(settings[rid]);
});

router.delete("/restaurants/:restaurantId/backup/:id", requireAuth, (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  backups[rid] = getBackups(rid).filter(b => b.id !== parseInt(req.params.id, 10));
  res.json({ success: true });
});

router.post("/restaurants/:restaurantId/backup/:id/restore", requireAuth, (req, res) => {
  res.json({ success: true, message: "Restore initiated. System will restart in 30 seconds.", backup_id: req.params.id });
});

router.get("/restaurants/:restaurantId/backup/:id/download", requireAuth, (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const id = parseInt(req.params.id, 10);
  const backup = getBackups(rid).find(b => b.id === id);
  if (!backup) { res.status(404).json({ error: "Backup not found" }); return; }
  const manifest = [
    "FastMenu Backup Manifest",
    `Backup ID,${backup.id}`,
    `Name,${backup.name}`,
    `Type,${backup.type}`,
    `Status,${backup.status}`,
    `Size,${backup.size}`,
    `Created,${backup.created_at}`,
    `Checksum,${backup.checksum || "—"}`,
    `Tables,${Array.isArray(backup.tables) ? backup.tables.join(";") : backup.tables}`,
  ].join("\n");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="backup-${backup.id}-manifest.txt"`);
  res.send(manifest);
});

export default router;

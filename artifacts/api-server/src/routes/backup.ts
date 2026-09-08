import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const backups: Record<number, any[]> = {};
const settings: Record<number, any> = {};

/**
 * No backup history is invented here.
 *
 * The list used to open with four completed backups, each with a size and a sha256
 * checksum — an owner reading it would believe their data had been copied nightly and
 * verified. None of those runs happened and none of those checksums covered anything.
 */
function getBackups(rid: number) {
  if (!backups[rid]) backups[rid] = [];
  return backups[rid];
}

function getSettings(rid: number) {
  if (!settings[rid]) {
      // Nothing schedules a backup, so no last/next run is claimed and auto-backup is off
    // rather than reported as on.
    settings[rid] = { auto_backup: false, frequency: "daily", time: "02:00", retention_days: 30, include_media: false, compress: true, encrypt: false, last_backup: null, next_backup: null };
  }
  return settings[rid];
}

router.get("/restaurants/:restaurantId/backup", requireAuth, (req, res) => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  res.json({ backups: getBackups(rid), settings: getSettings(rid) });
});

router.post("/restaurants/:restaurantId/backup/create", requireAuth, async (req, res) => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const { name, tables } = req.body;
  const backup = {
    id: Date.now(),
    name: name || `Manual Backup - ${new Date().toLocaleDateString()}`,
    type: "manual",
    status: "in_progress",
    size: null,
    tables: tables || ["all"],
    created_at: new Date().toISOString(),
    duration: null,
    checksum: null,
    // The request is recorded; nothing here copies a database. A size, a duration and a
    // sha256 were previously made up three seconds later, which made an unperformed
    // backup look like a verified one.
    performed: false,
  };
  getBackups(rid).unshift(backup);
  res.status(201).json(backup);
});

router.put("/restaurants/:restaurantId/backup/settings", requireAuth, (req, res) => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  settings[rid] = { ...getSettings(rid), ...req.body };
  res.json(settings[rid]);
});

router.delete("/restaurants/:restaurantId/backup/:id", requireAuth, (req, res) => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  backups[rid] = getBackups(rid).filter(b => b.id !== parseInt(String(req.params.id), 10));
  res.json({ success: true });
});

router.post("/restaurants/:restaurantId/backup/:id/restore", requireAuth, (req, res) => {
  res.json({ success: true, message: "Restore initiated. System will restart in 30 seconds.", backup_id: req.params.id });
});

router.get("/restaurants/:restaurantId/backup/:id/download", requireAuth, (req, res) => {
  const rid = parseInt(String(req.params.restaurantId), 10);
  const id = parseInt(String(req.params.id), 10);
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

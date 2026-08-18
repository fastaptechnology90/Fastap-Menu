import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { getSettingsSection, setSettingsSection } from "../lib/restaurant-settings";

const router: IRouter = Router();

const DEFAULT_DEVICES = [
  { id: 1, type: "pos", name: "Main POS Terminal", model: "Sunmi T2", serial: "SN-POS-001", location: "Counter", status: "online", last_ping: new Date().toISOString(), ip: "192.168.1.10", firmware: "v2.3.1", notes: "" },
  { id: 2, type: "printer", name: "Kitchen Thermal Printer", model: "Epson TM-T88", serial: "SN-PRT-001", location: "Kitchen", status: "online", last_ping: new Date().toISOString(), ip: "192.168.1.11", firmware: "v1.8.0", notes: "" },
];

async function getDevices(rid: number) {
  return getSettingsSection(rid, "hardware", DEFAULT_DEVICES);
}

router.get("/restaurants/:restaurantId/hardware", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const devices = await getDevices(rid);
  const stats = {
    total: devices.length,
    online: devices.filter((d: any) => d.status === "online").length,
    offline: devices.filter((d: any) => d.status === "offline").length,
    types: {
      pos: devices.filter((d: any) => d.type === "pos").length,
      printer: devices.filter((d: any) => d.type === "printer").length,
      tablet: devices.filter((d: any) => d.type === "tablet").length,
      nfc: devices.filter((d: any) => d.type === "nfc").length,
      kiosk: devices.filter((d: any) => d.type === "kiosk").length,
      display: devices.filter((d: any) => d.type === "display").length,
    },
  };
  res.json({ devices, stats });
});

router.post("/restaurants/:restaurantId/hardware", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const devices = await getDevices(rid);
  const device = { id: Date.now(), status: "online", last_ping: new Date().toISOString(), ...req.body };
  devices.push(device);
  await setSettingsSection(rid, "hardware", devices);
  res.status(201).json(device);
});

router.put("/restaurants/:restaurantId/hardware/:id", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const id = parseInt(req.params.id, 10);
  const devices = await getDevices(rid);
  const idx = devices.findIndex((d: any) => d.id === id);
  if (idx === -1) { res.status(404).json({ error: "Device not found" }); return; }
  devices[idx] = { ...devices[idx], ...req.body, last_ping: new Date().toISOString() };
  await setSettingsSection(rid, "hardware", devices);
  res.json(devices[idx]);
});

router.delete("/restaurants/:restaurantId/hardware/:id", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const id = parseInt(req.params.id, 10);
  const devices = (await getDevices(rid)).filter((d: any) => d.id !== id);
  await setSettingsSection(rid, "hardware", devices);
  res.json({ success: true });
});

router.post("/restaurants/:restaurantId/hardware/:id/ping", requireAuth, async (req, res) => {
  const rid = parseInt(req.params.restaurantId, 10);
  const id = parseInt(req.params.id, 10);
  const devices = await getDevices(rid);
  const idx = devices.findIndex((d: any) => d.id === id);
  if (idx === -1) { res.status(404).json({ error: "Device not found" }); return; }
  devices[idx].last_ping = new Date().toISOString();
  devices[idx].status = "online";
  await setSettingsSection(rid, "hardware", devices);
  res.json({ success: true, last_ping: devices[idx].last_ping });
});

export default router;

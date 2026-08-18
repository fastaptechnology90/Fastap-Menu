import { useState, useEffect } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { buildScanUrl } from "@/lib/smartEntry";
import { QrCode, Plus, Download, RefreshCw, Eye, Copy, Smartphone, Wifi, Trash2, Edit2, Check, Table2, BedDouble } from "lucide-react";
import QRCode from "qrcode";

const API_BASE = "/api";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function QRCodeSVG({ value, size = 120 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: size,
      color: { dark: "#1e1b4b", light: "#ffffff" },
    }).then(url => {
      if (!cancelled) setDataUrl(url);
    }).catch(() => {
      if (!cancelled) setDataUrl("");
    });
    return () => { cancelled = true; };
  }, [value, size]);

  if (!dataUrl) {
    return <div style={{ width: size, height: size }} className="bg-white rounded animate-pulse" />;
  }

  return <img src={dataUrl} width={size} height={size} alt="Scannable QR code" className="block" />;
}

export default function QRManagement() {
  const { restaurantId, restaurant } = useRestaurant();
  const [qrcodes, setQrcodes] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [rooms, setRooms] = useState<{ number: string }[]>([]);
  const [venueSlug, setVenueSlug] = useState("spice-garden");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"table" | "room" | "general">("table");
  const [copied, setCopied] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("table");

  const origin = typeof window !== "undefined" ? window.location.origin : "https://digitalrestuarants.thefingo.com";
  const scanUrl = (opts: { table?: string; room?: string }) => `${origin}${buildScanUrl(venueSlug, opts)}`;
  const baseUrl = scanUrl({});

  useEffect(() => {
    if (restaurant.slug) setVenueSlug(restaurant.slug);
  }, [restaurant.slug]);

  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      apiFetch(`/restaurants/${restaurantId}/qrcodes`),
      apiFetch(`/restaurants/${restaurantId}/tables`),
      apiFetch(`/restaurants/${restaurantId}/rooms`).catch(() => []),
      apiFetch(`/restaurants/${restaurantId}`).catch(() => null),
    ]).then(([qr, tbl, rms, meta]) => {
      setQrcodes(Array.isArray(qr) ? qr : []);
      setTables(Array.isArray(tbl) ? tbl : []);
      setRooms(Array.isArray(rms) ? rms.map((r: any) => ({ number: r.number })) : []);
      if (meta?.slug) setVenueSlug(meta.slug);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [restaurantId]);

  async function handleGenerate(tableId?: number, tableName?: string, roomNumber?: string) {
    if (!restaurantId) return;
    const normalizedRoom = roomNumber?.trim();
    if ((newType === "room" || roomNumber !== undefined) && !normalizedRoom) {
      window.alert("Please enter a room number before generating a room QR.");
      return;
    }
    const name = tableName || normalizedRoom || newName || "General QR";
    await apiFetch(`/restaurants/${restaurantId}/qrcodes`, {
      method: "POST",
      body: JSON.stringify({ tableId, label: name, type: normalizedRoom ? "room" : newType, roomNumber: normalizedRoom }),
    });
    const updated = await apiFetch(`/restaurants/${restaurantId}/qrcodes`);
    setQrcodes(Array.isArray(updated) ? updated : []);
    setShowAdd(false); setNewName("");
  }

  async function handleDelete(id: number) {
    if (!restaurantId) return;
    await apiFetch(`/restaurants/${restaurantId}/qrcodes/${id}`, { method: "DELETE" });
    setQrcodes(prev => prev.filter(q => q.id !== id));
  }

  function handleCopy(url: string, id: number) {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  }

  const tableQRs = qrcodes.filter(q => q.tableId || q.type === "table");
  const roomQRs = qrcodes.filter(q => q.type === "room");
  const generalQRs = qrcodes.filter(q => !q.tableId && q.type !== "room");

  const stats = [
    { label: "Total QR Codes", value: qrcodes.length, icon: QrCode, color: "text-violet-400" },
    { label: "Total Scans", value: qrcodes.reduce((s, q) => s + (q.scans || 0), 0), icon: Eye, color: "text-blue-400" },
    { label: "Active Tables", value: tables.length, icon: Table2, color: "text-green-400" },
    { label: "Rooms", value: rooms.length || roomQRs.length, icon: BedDouble, color: "text-orange-400" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/10 rounded-lg"><QrCode className="h-6 w-6 text-violet-400" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">QR / NFC Management</h1>
            <p className="text-slate-400 text-sm">Manage QR codes for tables, rooms, and general ordering</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="h-4 w-4" /> Generate QR
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <div className="flex items-start gap-4">
          <div className="bg-white p-2 rounded-lg"><QRCodeSVG value={baseUrl} size={100} /></div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1"><Wifi className="h-4 w-4 text-violet-400" /><span className="text-sm font-semibold text-white">Restaurant Menu URL</span></div>
            <p className="text-xs text-slate-400 break-all mb-3">{baseUrl}</p>
            <div className="flex gap-2">
              <button onClick={() => handleCopy(baseUrl, 0)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition-colors">
                {copied === 0 ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied === 0 ? "Copied!" : "Copy URL"}
              </button>
              <button onClick={() => handleGenerate()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-xs text-violet-300 transition-colors">
                <Download className="h-3 w-3" /> Download
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg w-fit border border-slate-700/50">
        {(["table", "room", "general"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}>
            {t === "table" ? `Tables (${tableQRs.length})` : t === "room" ? `Rooms (${roomQRs.length})` : `General (${generalQRs.length})`}
          </button>
        ))}
      </div>

      {tab === "table" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tables.map(table => {
              const qr = tableQRs.find(q => q.tableId === table.id);
              const url = scanUrl({ table: table.name });
              return (
                <div key={table.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 flex flex-col items-center gap-3">
                  <div className="bg-white p-2 rounded-lg shadow-lg"><QRCodeSVG value={url} size={100} /></div>
                  <div className="text-center">
                    <div className="font-semibold text-white text-sm">{table.name}</div>
                    <div className="text-xs text-slate-400">Cap: {table.capacity} • {qr ? `${qr.scans || 0} scans` : "No QR yet"}</div>
                  </div>
                  <div className="flex gap-2 w-full">
                    <button onClick={() => handleCopy(url, table.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition-colors">
                      {copied === table.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                    <button onClick={() => handleGenerate(table.id, table.name)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-xs text-violet-300 transition-colors">
                      <QrCode className="h-3 w-3" /> {qr ? "Regen" : "Create"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {tables.length === 0 && <div className="text-center text-slate-400 py-12">No tables found. Add tables first in Table Management.</div>}
        </div>
      )}

      {tab === "room" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => { setNewType("room"); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
              <Plus className="h-4 w-4" /> Add Room QR
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(rooms.length ? rooms : roomQRs.map(q => ({ number: q.label || q.name }))).filter(room => room.number).map(room => {
              const roomNum = room.number;
              const qr = roomQRs.find(q => q.label === roomNum || q.name === roomNum || (q.url && q.url.includes(`room=${encodeURIComponent(roomNum)}`)));
              const url = scanUrl({ room: roomNum });
              const key = roomNum;
              return (
                <div key={key} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 flex flex-col items-center gap-3">
                  <div className="bg-white p-2 rounded-lg shadow-lg"><QRCodeSVG value={qr?.url || url} size={100} /></div>
                  <div className="text-center">
                    <div className="font-semibold text-white text-sm">Room {roomNum}</div>
                    <div className="text-xs text-slate-400">{qr ? `${qr.scans || 0} scans` : "No QR yet"}</div>
                  </div>
                  <div className="flex gap-2 w-full">
                    <button onClick={() => handleCopy(qr?.url || url, qr?.id ?? roomNum.charCodeAt(0))} className="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition-colors">
                      {copied === (qr?.id ?? roomNum.charCodeAt(0)) ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={() => handleGenerate(undefined, undefined, roomNum)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-xs text-violet-300 transition-colors">
                      <QrCode className="h-3 w-3" /> {qr ? "Regen" : "Create"}
                    </button>
                  </div>
                </div>
              );
            })}
            {rooms.length === 0 && roomQRs.length === 0 && (
              <div className="col-span-3 text-center text-slate-400 py-12">No rooms found. Add rooms in Hotel Management or generate a room QR above.</div>
            )}
          </div>
        </div>
      )}

      {tab === "general" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {generalQRs.map(qr => (
            <div key={qr.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 flex flex-col items-center gap-3">
              <div className="bg-white p-2 rounded-lg shadow-lg"><QRCodeSVG value={qr.url || baseUrl} size={100} /></div>
              <div className="text-center">
                <div className="font-semibold text-white text-sm">{qr.label || qr.name}</div>
                <div className="text-xs text-slate-400">{qr.scans || 0} scans</div>
              </div>
              <div className="flex gap-2 w-full">
                <button onClick={() => handleCopy(qr.url || baseUrl, qr.id)} className="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition-colors text-sm">
                  {copied === qr.id ? "Copied!" : "Copy Link"}
                </button>
                <button onClick={() => handleDelete(qr.id)} className="py-1.5 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {generalQRs.length === 0 && <div className="col-span-3 text-center text-slate-400 py-12">No general QR codes.</div>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Generate New QR Code</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Name / Label</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:border-violet-500 outline-none" placeholder="e.g. Takeaway Counter, Room 201..." />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Type</label>
                <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:border-violet-500 outline-none">
                  <option value="table">Table</option>
                  <option value="room">Hotel Room</option>
                  <option value="takeaway">Takeaway</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAdd(false); setNewName(""); }} className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors">Cancel</button>
              <button onClick={() => handleGenerate(undefined, undefined, newType === "room" ? newName : undefined)} className="flex-1 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">Generate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

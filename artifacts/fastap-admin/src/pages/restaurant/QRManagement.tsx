import { useState, useEffect, useCallback } from "react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { buildScanUrl } from "@/lib/smartEntry";
import { QrCode, Plus, Download, RefreshCw, Eye, Copy, Smartphone, Wifi, Trash2, Edit2, Check, Table2, BedDouble, Hotel } from "lucide-react";
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
  const { toast } = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const [qrcodes, setQrcodes] = useState<any[]>([]);
  const [totalScans, setTotalScans] = useState(0);
  const [tables, setTables] = useState<any[]>([]);
  const [rooms, setRooms] = useState<{ number: string }[]>([]);
  const [venueSlug, setVenueSlug] = useState("spice-garden");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<"table" | "room" | "general">("table");
  const [copied, setCopied] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("table");

  // The fallback used to be a domain that no longer resolves. There is no server render
  // here, so the browser's own origin is always the right answer.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const scanUrl = (opts: { table?: string; room?: string }) => `${origin}${buildScanUrl(venueSlug, opts)}`;
  const baseUrl = scanUrl({});

  useEffect(() => {
    if (restaurant.slug) setVenueSlug(restaurant.slug);
  }, [restaurant.slug]);

  const loadAll = useCallback(() => {
    if (!restaurantId) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/restaurants/${restaurantId}/qrcodes`),
      apiFetch(`/restaurants/${restaurantId}/tables`),
      apiFetch(`/restaurants/${restaurantId}/rooms`).catch(() => []),
      apiFetch(`/restaurants/${restaurantId}`).catch(() => null),
    ]).then(([qr, tbl, rms, meta]) => {
      // Endpoint returns { codes, totalScans }; tolerate the old array shape too.
      const codes = Array.isArray(qr) ? qr : (qr?.codes ?? []);
      setQrcodes(codes);
      setTotalScans(Array.isArray(qr) ? 0 : Number(qr?.totalScans ?? 0));
      setTables(Array.isArray(tbl) ? tbl : []);
      setRooms(Array.isArray(rms) ? rms.map((r: any) => ({ number: r.number })) : []);
      if (meta?.slug) setVenueSlug(meta.slug);
      setLoadError(null);
      // A failed fetch used to render as "no QR codes", which reads as data loss.
    }).catch(e => setLoadError(e instanceof Error ? e.message : "Could not reach the server."))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(loadAll, [loadAll]);

  // Render the QR for a URL to a high-res PNG and trigger a real file download.
  async function handleDownload(value: string, filename: string) {
    try {
      const url = await QRCode.toDataURL(value, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 512,
        color: { dark: "#1e1b4b", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: "QR downloaded", description: filename });
    } catch (e) {
      console.error(e);
      toast({ title: "Download failed", description: e instanceof Error ? e.message : "Could not render the QR image.", variant: "destructive" });
    }
  }

  async function handleGenerate(tableId?: number, tableName?: string, roomNumber?: string) {
    if (!restaurantId) return;
    const normalizedRoom = roomNumber?.trim();
    if ((newType === "room" || roomNumber !== undefined) && !normalizedRoom) {
      toast({ title: "Room number required", description: "Enter a room number before generating a room QR.", variant: "destructive" });
      return;
    }
    const name = tableName || normalizedRoom || newName || "General QR";
    try {
      await apiFetch(`/restaurants/${restaurantId}/qrcodes`, {
        method: "POST",
        body: JSON.stringify({ tableId, label: name, type: normalizedRoom ? "room" : newType, roomNumber: normalizedRoom }),
      });
      const updated = await apiFetch(`/restaurants/${restaurantId}/qrcodes`);
      setQrcodes(Array.isArray(updated) ? updated : (updated?.codes ?? []));
      if (!Array.isArray(updated)) setTotalScans(Number(updated?.totalScans ?? 0));
      setShowAdd(false); setNewName("");
      // Jump to the tab where this QR will actually appear so the user sees it right away.
      // Table-linked QRs -> Tables; room QRs -> Rooms; everything else (takeaway/general/
      // an unlinked "table") lands under General.
      const destTab = normalizedRoom ? "room" : (tableId ? "table" : "general");
      setTab(destTab);
      toast({
        title: "QR code saved",
        description: `“${name}” is ready — shown in the ${destTab === "room" ? "Rooms" : destTab === "table" ? "Tables" : "General"} tab.`,
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to generate QR", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function handleDelete(id: number, label: string) {
    if (!restaurantId) return;
    // Printed codes are already on tables; deleting one takes a guest's menu offline.
    const ok = await confirm({
      title: `Delete the QR code for ${label}?`,
      description: "Anyone scanning the printed code will no longer reach your menu. You will need to print a replacement.",
      destructive: true,
      confirmLabel: "Delete QR code",
    });
    if (!ok) return;
    try {
      await apiFetch(`/restaurants/${restaurantId}/qrcodes/${id}`, { method: "DELETE" });
      setQrcodes(prev => prev.filter(q => q.id !== id));
      toast({ title: "QR code deleted" });
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to delete QR", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  async function handleCopy(url: string, id: number) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access is blocked outside a secure context and in some browsers.
      toast({ title: "Could not copy the link", description: url, variant: "destructive" });
    }
  }

  const tableQRs = qrcodes.filter(q => q.tableId || q.type === "table");
  const roomQRs = qrcodes.filter(q => q.type === "room");
  const generalQRs = qrcodes.filter(q => !q.tableId && q.type !== "room");

  // Every table and room has a scannable QR (from its scan URL), plus any general
  // QR records — so the total must match what the tabs show, not just the raw
  // qrcodes records (which can be empty even when tables/rooms exist).
  const totalQrCount =
    (tables.length || tableQRs.length) +
    (rooms.length || roomQRs.length) +
    generalQRs.length +
    // The venue's own menu code, shown at the top of this page — it is a real,
    // scannable code and was missing from its own count.
    (venueSlug ? 1 : 0);

  const stats = [
    { label: "Total QR Codes", value: totalQrCount, icon: QrCode, color: "text-muted-foreground" },
    { label: "Total Scans", value: totalScans, icon: Eye, color: "text-info" },
    { label: "Active Tables", value: tables.length, icon: Table2, color: "text-success" },
    { label: "Rooms", value: rooms.length || roomQRs.length, icon: BedDouble, color: "text-warning" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border" /></div>;

  if (loadError) {
    return (
      <div className="p-6">
        <div role="alert" className="rounded-lg border border-danger-border bg-danger-subtle p-5 text-center">
          <p className="text-sm font-semibold text-danger">We could not load your QR codes.</p>
          <p className="mt-1 text-xs text-danger">{loadError}</p>
          <button onClick={loadAll} className="mt-4 px-4 py-2 rounded-lg bg-danger-subtle text-danger text-xs font-semibold">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg"><QrCode className="h-6 w-6 text-muted-foreground" /></div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">QR / NFC Management</h1>
            <p className="text-muted-foreground text-sm">Manage QR codes for tables, rooms, and general ordering</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-muted hover-elevate text-foreground rounded-lg text-sm font-medium transition-colors">
          <Plus className="h-4 w-4" /> Generate QR
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-muted rounded-lg p-4 border border-border">
            <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
            <div className="text-2xl font-semibold text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-muted rounded-lg p-4 border border-border">
        <div className="flex items-start gap-4">
          <div className="bg-white p-2 rounded-lg"><QRCodeSVG value={baseUrl} size={100} /></div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1"><Wifi className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-semibold text-foreground">Restaurant Menu URL</span></div>
            <p className="text-xs text-muted-foreground break-all mb-3">{baseUrl}</p>
            <div className="flex gap-2">
              <button onClick={() => handleCopy(baseUrl, 0)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover-elevate text-xs text-muted-foreground transition-colors">
                {copied === 0 ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied === 0 ? "Copied!" : "Copy URL"}
              </button>
              <button onClick={() => handleDownload(baseUrl, `${venueSlug || "restaurant"}-menu-qr.png`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover-elevate text-xs text-muted-foreground transition-colors">
                <Download className="h-3 w-3" /> Download
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit border border-border">
        {(["table", "room", "general"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "table" ? `Tables (${tables.length || tableQRs.length})` : t === "room" ? `Rooms (${rooms.length || roomQRs.length})` : `General (${generalQRs.length})`}
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
                <div key={table.id} className="bg-muted rounded-lg border border-border p-4 flex flex-col items-center gap-3">
                  <div className="bg-white p-2 rounded-lg shadow-sm"><QRCodeSVG value={url} size={100} /></div>
                  <div className="text-center">
                    <div className="font-semibold text-foreground text-sm">{table.name}</div>
                    {/* The code above is built from the table's scan URL, so it is
                        printable and scannable right now. "No QR yet" said the opposite
                        of the truth; what is actually missing is scan counting. */}
                    <div className="text-xs text-muted-foreground">Cap: {table.capacity} • {qr ? `${qr.scans || 0} scans` : "Ready to print · scans not counted"}</div>
                  </div>
                  <div className="flex gap-2 w-full">
                    <button onClick={() => handleCopy(url, table.id)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-muted hover-elevate text-xs text-muted-foreground transition-colors">
                      {copied === table.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                    <button onClick={() => handleGenerate(table.id, table.name)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-muted hover-elevate text-xs text-muted-foreground transition-colors">
                      <QrCode className="h-3 w-3" /> {qr ? "Regen" : "Track"}
                    </button>
                    <button title="Download QR" onClick={() => handleDownload(url, `${venueSlug || "restaurant"}-table-${table.name}-qr.png`)} className="py-1.5 px-3 flex items-center justify-center rounded-lg bg-success-subtle hover-elevate text-success transition-colors">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {tables.length === 0 && <div className="text-center text-muted-foreground py-12">No tables found. Add tables first in Table Management.</div>}
        </div>
      )}

      {tab === "room" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => { setNewType("room"); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 bg-muted hover-elevate text-foreground rounded-lg text-sm font-medium transition-colors">
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
                <div key={key} className="bg-muted rounded-lg border border-border p-4 flex flex-col items-center gap-3">
                  <div className="bg-white p-2 rounded-lg shadow-sm"><QRCodeSVG value={qr?.url || url} size={100} /></div>
                  <div className="text-center">
                    <div className="font-semibold text-foreground text-sm">Room {roomNum}</div>
                    <div className="text-xs text-muted-foreground">{qr ? `${qr.scans || 0} scans` : "Ready to print · scans not counted"}</div>
                  </div>
                  <div className="flex gap-2 w-full">
                    <button onClick={() => handleCopy(qr?.url || url, qr?.id ?? roomNum.charCodeAt(0))} className="flex-1 py-1.5 rounded-lg bg-muted hover-elevate text-xs text-muted-foreground transition-colors">
                      {copied === (qr?.id ?? roomNum.charCodeAt(0)) ? "Copied!" : "Copy"}
                    </button>
                    <button onClick={() => handleGenerate(undefined, undefined, roomNum)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-muted hover-elevate text-xs text-muted-foreground transition-colors">
                      <QrCode className="h-3 w-3" /> {qr ? "Regen" : "Track"}
                    </button>
                    <button title="Download QR" onClick={() => handleDownload(qr?.url || url, `${venueSlug || "restaurant"}-room-${roomNum}-qr.png`)} className="py-1.5 px-3 flex items-center justify-center rounded-lg bg-success-subtle hover-elevate text-success transition-colors">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {rooms.length === 0 && roomQRs.length === 0 && (
              <div className="col-span-3 text-center text-muted-foreground py-12">No rooms found. Add rooms in Hotel Management or generate a room QR above.</div>
            )}
          </div>
        </div>
      )}

      {tab === "general" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {generalQRs.map(qr => (
            <div key={qr.id} className="bg-muted rounded-lg border border-border p-4 flex flex-col items-center gap-3">
              <div className="bg-white p-2 rounded-lg shadow-sm"><QRCodeSVG value={qr.url || baseUrl} size={100} /></div>
              <div className="text-center">
                <div className="font-semibold text-foreground text-sm">{qr.label || qr.name}</div>
                <div className="text-xs text-muted-foreground">{qr.scans || 0} scans</div>
              </div>
              <div className="flex gap-2 w-full">
                <button onClick={() => handleCopy(qr.url || baseUrl, qr.id)} className="flex-1 py-1.5 rounded-lg bg-muted hover-elevate text-xs text-muted-foreground transition-colors text-sm">
                  {copied === qr.id ? "Copied!" : "Copy Link"}
                </button>
                <button title="Download QR" onClick={() => handleDownload(qr.url || baseUrl, `${venueSlug || "restaurant"}-${(qr.label || qr.name || "qr").toString().replace(/\s+/g, "-")}-qr.png`)} className="py-1.5 px-3 rounded-lg bg-success-subtle hover-elevate text-success transition-colors">
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(qr.id, qr.label || qr.name || "this code")} className="py-1.5 px-3 rounded-lg bg-danger-subtle hover-elevate text-danger transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {generalQRs.length === 0 && <div className="col-span-3 text-center text-muted-foreground py-12">No general QR codes.</div>}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-foreground/40 z-50 flex items-center justify-center p-4">
          <div className="bg-muted rounded-lg p-6 w-full max-w-md border border-border max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <h3 className="text-lg font-semibold text-foreground mb-4">Generate New QR Code</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Name / Label</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border border-border focus:border-border outline-none" placeholder="e.g. Takeaway Counter, Room 201..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm border border-border focus:border-border outline-none">
                  <option value="table">Table</option>
                  <option value="room">Hotel Room</option>
                  <option value="takeaway">Takeaway</option>
                  <option value="general">General</option>
                </select>
                <p className="text-2xs text-muted-foreground mt-1">Tip: a table's own QR is created from its card in the Tables tab. QRs made here (Takeaway / General / an unlinked Table) appear under the <b>General</b> tab.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAdd(false); setNewName(""); }} className="flex-1 py-2 rounded-lg bg-muted hover-elevate text-muted-foreground text-sm transition-colors">Cancel</button>
              <button onClick={() => handleGenerate(undefined, undefined, newType === "room" ? newName : undefined)} className="flex-1 py-2 rounded-lg bg-muted hover-elevate text-foreground text-sm font-medium transition-colors">Generate</button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

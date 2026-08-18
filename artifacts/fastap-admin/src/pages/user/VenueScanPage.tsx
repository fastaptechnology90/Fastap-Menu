import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import { QrCameraScanner } from "@/components/user/QrCameraScanner";
import {
  QrCode, BedDouble, UtensilsCrossed, Calendar, MapPin, Users,
  CheckCircle2, Loader2, ArrowRight, Camera,
} from "lucide-react";

type ScanPayload = {
  type: "table" | "room";
  scannedAt: string;
  restaurant: { id: number; name: string; slug: string; address?: string };
  table?: {
    id: number;
    name: string;
    status: string;
    statusLabel: string;
    zone?: string;
    areaName?: string;
    capacity: number;
    tableType: string;
    isVip: boolean;
    bookable: boolean;
    canOrder: boolean;
  } | null;
  room?: {
    id: number;
    number: string;
    type: string;
    floor: number;
    status: string;
    statusLabel: string;
    guestName?: string;
    bookable: boolean;
    canOrder: boolean;
  } | null;
  actions: Record<string, string>;
};

const STATUS_COLOR: Record<string, string> = {
  Available: "text-emerald-400 bg-emerald-500/15",
  free: "text-emerald-400 bg-emerald-500/15",
  vacant: "text-emerald-400 bg-emerald-500/15",
  Occupied: "text-orange-400 bg-orange-500/15",
  occupied: "text-orange-400 bg-orange-500/15",
  Reserved: "text-blue-400 bg-blue-500/15",
  reserved: "text-blue-400 bg-blue-500/15",
};

export default function VenueScanPage() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useAppLocation();
  const { loadVenue } = useUser();
  const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const slug = params.slug || qs.get("slug") || "spice-garden";
  const table = qs.get("table") || undefined;
  const room = qs.get("room") || undefined;

  const [data, setData] = useState<ScanPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!table && !room) {
      setError("Scan link is missing table or room. Use your camera on the venue QR code.");
      setLoading(false);
      return;
    }
    setLoading(true);
    publicApi.scan(slug, { table, room })
      .then(setData)
      .catch(() => setError("Could not load table or room details."))
      .finally(() => setLoading(false));
  }, [slug, table, room]);

  async function go(path: string) {
    await loadVenue(slug, { table, room }).catch(() => {});
    navigate(path);
  }

  function handleScannedUrl(url: string) {
    try {
      const u = new URL(url, window.location.origin);
      if (u.origin === window.location.origin) {
        navigate(`${u.pathname}${u.search}`);
        setShowScanner(false);
      }
    } catch { /* ignore invalid */ }
  }

  if (showScanner) {
    return <QrCameraScanner onScan={handleScannedUrl} onClose={() => setShowScanner(false)} />;
  }

  if (loading) {
    return (
      <div className="guest-page min-h-screen text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
        <p className="text-sm text-white/50">Loading scan details…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="guest-page min-h-screen text-white px-6 py-12 text-center space-y-4">
        <p className="text-red-400">{error ?? "Scan failed"}</p>
        <button onClick={() => setShowScanner(true)} className="guest-btn-primary px-6 py-3 text-sm">
          <Camera className="h-4 w-4" /> Scan QR with camera
        </button>
        <button onClick={() => navigate("/")} className="text-sm text-white/40 block mx-auto">Back home</button>
      </div>
    );
  }

  const isTable = data.type === "table" && data.table;
  const isRoom = data.type === "room" && data.room;
  const statusLabel = isTable ? data.table!.statusLabel : isRoom ? data.room!.statusLabel : "—";
  const statusClass = STATUS_COLOR[statusLabel] ?? STATUS_COLOR[data.table?.status ?? data.room?.status ?? ""] ?? "text-white/60 bg-white/10";

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-10">
      <div className="guest-header px-4 py-4 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/20 border border-orange-500/30 mb-3">
          {isTable ? <QrCode className="h-7 w-7 text-orange-400" /> : <BedDouble className="h-7 w-7 text-blue-400" />}
        </div>
        <p className="text-xs text-white/40 uppercase tracking-widest">QR Scan detected</p>
        <h1 className="text-2xl font-bold mt-1">{data.restaurant.name}</h1>
        <p className="text-sm text-white/50 mt-1">
          {isTable ? `Table ${data.table!.name}` : isRoom ? `Room ${data.room!.number}` : "Venue"}
        </p>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">
        <div className="guest-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
            {isTable?.bookable || isRoom?.bookable ? (
              <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Bookable</span>
            ) : (
              <span className="text-xs text-white/40">View & order available</span>
            )}
          </div>

          {isTable && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white/5 rounded-xl p-3"><p className="text-[10px] text-white/40 uppercase">Zone</p><p className="font-semibold flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-orange-400" />{data.table!.areaName || data.table!.zone || "Main"}</p></div>
              <div className="bg-white/5 rounded-xl p-3"><p className="text-[10px] text-white/40 uppercase">Capacity</p><p className="font-semibold flex items-center gap-1"><Users className="h-3.5 w-3.5 text-orange-400" />{data.table!.capacity} guests</p></div>
              <div className="bg-white/5 rounded-xl p-3 col-span-2"><p className="text-[10px] text-white/40 uppercase">Table type</p><p className="font-semibold">{data.table!.tableType.replace(/_/g, " ")}{data.table!.isVip ? " · VIP" : ""}</p></div>
            </div>
          )}

          {isRoom && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white/5 rounded-xl p-3"><p className="text-[10px] text-white/40 uppercase">Room type</p><p className="font-semibold capitalize">{data.room!.type}</p></div>
              <div className="bg-white/5 rounded-xl p-3"><p className="text-[10px] text-white/40 uppercase">Floor</p><p className="font-semibold">{data.room!.floor}</p></div>
              {data.room!.guestName && (
                <div className="bg-white/5 rounded-xl p-3 col-span-2"><p className="text-[10px] text-white/40 uppercase">Guest</p><p className="font-semibold">{data.room!.guestName}</p></div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {(isTable?.bookable || isRoom?.bookable) && (
            <button onClick={() => go(data.actions.reserve)} className="w-full guest-btn-primary py-3.5 text-sm font-bold flex items-center justify-center gap-2">
              <Calendar className="h-5 w-5" /> Book {isTable ? "this table" : "this room"}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {(isTable?.canOrder || isRoom?.canOrder) && (
            <button onClick={() => go(isRoom ? data.actions.hotel : data.actions.menu)} className="w-full py-3.5 rounded-xl bg-blue-500 hover:bg-blue-400 font-bold text-sm flex items-center justify-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              {isRoom ? "Room service & hotel menu" : "Order from menu"}
            </button>
          )}
          {isTable && (
            <button onClick={() => go(data.actions.seating)} className="w-full guest-btn-secondary py-3 text-sm">
              View live seating map
            </button>
          )}
        </div>

        <button onClick={() => setShowScanner(true)} className="w-full py-3 rounded-xl border border-dashed border-white/20 text-sm text-white/60 flex items-center justify-center gap-2">
          <Camera className="h-4 w-4" /> Scan another table or room
        </button>
      </div>
    </div>
  );
}

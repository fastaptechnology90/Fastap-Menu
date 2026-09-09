import { useEffect, useState } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
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
  type: "table" | "room" | "venue";
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
  Available: "text-success bg-success-subtle",
  free: "text-success bg-success-subtle",
  vacant: "text-success bg-success-subtle",
  Occupied: "text-primary bg-muted",
  occupied: "text-primary bg-muted",
  Reserved: "text-info bg-info-subtle",
  reserved: "text-info bg-info-subtle",
};

export default function VenueScanPage() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useAppLocation();
  const { loadVenue } = useUser();
  const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  // The neutral demo alias, not a real venue's slug: hardcoding "spice-garden" here
  // pinned every unresolved page to one live restaurant and put its slug in the URL.
  const slug = params.slug || qs.get("slug") || DEMO_SLUG;
  const table = qs.get("table") || undefined;
  const room = qs.get("room") || undefined;

  const [data, setData] = useState<ScanPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // A link with no table and no room is the venue's own QR — the one printed for the
  // counter, the door or a takeaway bag. This used to refuse it outright, so the code
  // the restaurant had printed from its own panel showed the guest an error.
  useEffect(() => {
    setLoading(true);
    publicApi.scan(slug, { table, room })
      .then(setData)
      .catch(() => setError(
        table || room
          ? "Could not load table or room details."
          : "We could not find that restaurant.",
      ))
      .finally(() => setLoading(false));
  }, [slug, table, room]);

  async function go(path: string) {
    // Navigation must not be blocked by a metadata refresh; the destination
    // page loads its own data and reports its own failure.
    await loadVenue(slug, { table, room }).catch(() => undefined);
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
      <div className="guest-page min-h-screen text-foreground flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading scan details…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="guest-page min-h-screen text-foreground px-6 py-12 text-center space-y-4">
        <p className="text-danger">{error ?? "Scan failed"}</p>
        <button onClick={() => setShowScanner(true)} className="guest-btn-primary px-6 py-3 text-sm">
          <Camera className="h-4 w-4" /> Scan QR with camera
        </button>
        <button onClick={() => navigate("/")} className="text-sm text-muted-foreground block mx-auto">Back home</button>
      </div>
    );
  }

  // undefined rather than false when absent: the scanned table/room is read through `?.`
  // further down, and optional chaining does not narrow a `false` out of the union — so
  // `isTable?.bookable` failed to compile and the Book / Order buttons were unreachable.
  const isTable = data.type === "table" ? data.table : undefined;
  const isRoom = data.type === "room" ? data.room : undefined;
  const isVenue = data.type === "venue";
  const statusLabel = isTable ? data.table!.statusLabel : isRoom ? data.room!.statusLabel : "Open to browse";
  const statusClass = STATUS_COLOR[statusLabel] ?? STATUS_COLOR[data.table?.status ?? data.room?.status ?? ""] ?? "text-muted-foreground bg-muted";

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-10">
      <div className="guest-header px-4 py-4 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-primary mb-3">
          {isRoom ? <BedDouble className="h-7 w-7 text-info" /> : <QrCode className="h-7 w-7 text-primary" />}
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest">QR Scan detected</p>
        <h1 className="text-2xl font-semibold mt-1">{data.restaurant.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isTable ? `Table ${data.table!.name}`
            : isRoom ? `Room ${data.room!.number}`
            : data.restaurant.address || "Browse the menu or order takeaway"}
        </p>
      </div>

      <div className="px-4 max-w-lg mx-auto space-y-4">
        <div className="guest-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
            {isTable?.bookable || isRoom?.bookable ? (
              <span className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Bookable</span>
            ) : (
              <span className="text-xs text-muted-foreground">View &amp; order available</span>
            )}
          </div>

          {isTable && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted rounded-xl p-3"><p className="text-2xs text-muted-foreground uppercase">Zone</p><p className="font-semibold flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" />{data.table!.areaName || data.table!.zone || "Main"}</p></div>
              <div className="bg-muted rounded-xl p-3"><p className="text-2xs text-muted-foreground uppercase">Capacity</p><p className="font-semibold flex items-center gap-1"><Users className="h-3.5 w-3.5 text-primary" />{data.table!.capacity} guests</p></div>
              <div className="bg-muted rounded-xl p-3 col-span-2"><p className="text-2xs text-muted-foreground uppercase">Table type</p><p className="font-semibold">{data.table!.tableType.replace(/_/g, " ")}{data.table!.isVip ? " · VIP" : ""}</p></div>
            </div>
          )}

          {isRoom && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted rounded-xl p-3"><p className="text-2xs text-muted-foreground uppercase">Room type</p><p className="font-semibold capitalize">{data.room!.type}</p></div>
              <div className="bg-muted rounded-xl p-3"><p className="text-2xs text-muted-foreground uppercase">Floor</p><p className="font-semibold">{data.room!.floor}</p></div>
              {data.room!.guestName && (
                <div className="bg-muted rounded-xl p-3 col-span-2"><p className="text-2xs text-muted-foreground uppercase">Guest</p><p className="font-semibold">{data.room!.guestName}</p></div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {(isTable?.bookable || isRoom?.bookable) && (
            <button onClick={() => go(data.actions.reserve)} className="w-full guest-btn-primary py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
              <Calendar className="h-5 w-5" /> Book {isTable ? "this table" : "this room"}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {isVenue && (
            <>
              <button onClick={() => go(data.actions.menu)} className="w-full guest-btn-primary py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
                <UtensilsCrossed className="h-5 w-5" /> See the menu
                <ArrowRight className="h-4 w-4" />
              </button>
              {data.actions.reserve && (
                <button onClick={() => go(data.actions.reserve)} className="w-full guest-btn-secondary py-3 text-sm flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4" /> Book a table
                </button>
              )}
              {/* Said plainly, because ordering to a table needs the table's own code. */}
              <p className="text-center text-xs text-muted-foreground pt-1">
                Sitting at a table? Scan the code on the table itself so your order reaches it.
              </p>
            </>
          )}
          {(isTable?.canOrder || isRoom?.canOrder) && (
            <button onClick={() => go(isRoom ? data.actions.hotel : data.actions.menu)} className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-sm flex items-center justify-center gap-2">
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

        <button onClick={() => setShowScanner(true)} className="w-full py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Camera className="h-4 w-4" /> Scan another table or room
        </button>
      </div>
    </div>
  );
}

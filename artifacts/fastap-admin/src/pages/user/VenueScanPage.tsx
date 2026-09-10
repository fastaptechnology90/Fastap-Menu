/**
 * The first screen after the QR.
 *
 * A guest has just pointed a camera at the code on their table. Two questions matter:
 * am I in the right place, and how do I see the menu. So the screen answers the first in
 * the app bar and the card under it, and parks the second on a full-width button in the
 * thumb zone — one tap from scan to menu.
 *
 * What it replaces: a centred 56px badge, an all-caps eyebrow ("QR SCAN DETECTED"), a
 * display heading and a subtitle, stacked inside a translucent bar. Half the first screen
 * was gone before any content began, and in daylight the top of it could not be read.
 */
import { useEffect, useState } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { useParams } from "wouter";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import { QrCameraScanner } from "@/components/user/QrCameraScanner";
import {
  GuestAppScreen, GuestAppBar, GuestAppBarButton, GuestBody, GuestSection,
  GuestList, GuestRow, GuestTableChip, GuestActionBar, GuestPrimaryButton,
} from "@/components/user/GuestShell";
import {
  BedDouble, UtensilsCrossed, CalendarDays, Users, Armchair, Info,
  Loader2, Camera, LayoutGrid, ArrowRight, UserRound,
} from "lucide-react";

type ScanPayload = {
  type: "table" | "room" | "venue";
  scannedAt: string;
  restaurant: { id: number; name: string; slug: string; address?: string };
  hours?: {
    isOpen: boolean;
    hoursPublished: boolean;
    openTime: string | null;
    closeTime: string | null;
    message: string;
    timezone?: string;
    localTime?: string;
    ordersAllowed?: boolean;
    demoOpenMessage?: string;
  };
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

/* Literal classes only — Tailwind cannot emit an interpolated `bg-${x}-subtle`. */
const STATUS_CLASS: Record<string, string> = {
  Available: "border-success-border bg-success-subtle text-success",
  free: "border-success-border bg-success-subtle text-success",
  vacant: "border-success-border bg-success-subtle text-success",
  Occupied: "border-border bg-muted text-foreground",
  occupied: "border-border bg-muted text-foreground",
  Reserved: "border-info-border bg-info-subtle text-info",
  reserved: "border-info-border bg-info-subtle text-info",
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
      <GuestAppScreen>
        <GuestAppBar title="Opening…" showBack={false} />
        <GuestBody className="flex flex-col items-center justify-center gap-3 py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Reading the code…</p>
        </GuestBody>
      </GuestAppScreen>
    );
  }

  if (error || !data) {
    return (
      <GuestAppScreen withCartBar>
        <GuestAppBar title="That code did not open" showBack={false} />
        <GuestBody>
          <GuestSection>
            <div className="rounded-md border border-danger-border bg-danger-subtle p-4">
              <p className="text-sm text-foreground">{error ?? "Scan failed"}</p>
            </div>
          </GuestSection>
          <GuestSection>
            <GuestList>
              <GuestRow
                icon={<Camera className="h-4 w-4" />}
                title="Scan the code again"
                detail="Point the camera at the code on your table"
                onClick={() => setShowScanner(true)}
              />
            </GuestList>
          </GuestSection>
        </GuestBody>
        <GuestActionBar>
          <GuestPrimaryButton onClick={() => setShowScanner(true)}>
            <Camera className="h-4 w-4" />
            Scan QR with camera
          </GuestPrimaryButton>
        </GuestActionBar>
      </GuestAppScreen>
    );
  }

  // undefined rather than false when absent: the scanned table/room is read through `?.`
  // further down, and optional chaining does not narrow a `false` out of the union — so
  // `isTable?.bookable` failed to compile and the Book / Order buttons were unreachable.
  const isTable = data.type === "table" ? data.table : undefined;
  const isRoom = data.type === "room" ? data.room : undefined;
  const isVenue = data.type === "venue";
  const statusLabel = isTable ? data.table!.statusLabel : isRoom ? data.room!.statusLabel : "Open to browse";
  const statusClass =
    STATUS_CLASS[statusLabel]
    ?? STATUS_CLASS[data.table?.status ?? data.room?.status ?? ""]
    ?? "border-border bg-muted text-muted-foreground";

  // The venue's own opening hours, said here rather than discovered at checkout. A guest
  // who scans at 4 a.m. should be told before they build a basket, not after.
  const hours = data.hours;
  const closed = Boolean(hours?.hoursPublished && !hours.isOpen);
  const orderingAllowed = !closed || hours?.ordersAllowed === true;

  const canOrder = Boolean(isTable?.canOrder || isRoom?.canOrder || isVenue);
  const orderPath = isRoom ? (data.actions.hotel || data.actions.menu) : data.actions.menu;
  const orderLabel = isRoom ? "Room service & hotel menu" : isTable ? "Order to this table" : "See the menu";

  const facts: { label: string; value: string; Icon: typeof Users }[] = [];
  if (isTable) {
    facts.push({ label: "Area", value: data.table!.areaName || data.table!.zone || "Main", Icon: LayoutGrid });
    facts.push({ label: "Seats", value: `${data.table!.capacity}`, Icon: Users });
    facts.push({
      label: "Type",
      value: `${data.table!.tableType.replace(/_/g, " ")}${data.table!.isVip ? " · VIP" : ""}`,
      Icon: Armchair,
    });
  }
  if (isRoom) {
    facts.push({ label: "Room type", value: data.room!.type, Icon: BedDouble });
    facts.push({ label: "Floor", value: `${data.room!.floor}`, Icon: LayoutGrid });
  }

  return (
    <GuestAppScreen withCartBar>
      <GuestAppBar
        title={data.restaurant.name}
        subtitle={data.restaurant.address || (isVenue ? "Browse the menu or order takeaway" : undefined)}
        showBack={false}
        right={
          // The tab bar carries Home / Menu / Cart / Bookings, so the account is the one
          // destination with nowhere else to live. Without this a diner could reach their
          // profile, their past orders and support only by typing the URL.
          <GuestAppBarButton label="Your account" onClick={() => navigate("/user/profile")}>
            <UserRound className="h-4 w-4" />
          </GuestAppBarButton>
        }
      />

      <GuestBody>
        {/* Where the guest is sitting, said once, at the top, in plain type. */}
        <GuestSection>
          <div className="rounded-md border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <GuestTableChip table={isTable ? data.table!.name : undefined} room={isRoom ? data.room!.number : null} />
              <span className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}>
                {statusLabel}
              </span>
              {hours?.hoursPublished && !closed && hours.closeTime && (
                <span className="inline-flex items-center rounded-pill border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Open until {hours.closeTime}
                </span>
              )}
            </div>

            {facts.length > 0 && (
              <dl className={`mt-3 grid gap-2 ${facts.length === 1 ? "grid-cols-1" : facts.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                {facts.map(f => (
                  <div key={f.label} className="min-w-0 rounded-sm bg-muted px-2.5 py-2">
                    <dt className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <f.Icon className="h-3 w-3 shrink-0" />
                      {f.label}
                    </dt>
                    <dd className="mt-0.5 truncate text-xs font-semibold capitalize">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </GuestSection>

        {/* Trading hours, refused up front rather than at checkout. */}
        {closed && (
          <GuestSection>
            <div className="flex items-start gap-2 rounded-md border border-warning-border bg-warning-subtle p-3" role="status">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-warning">
                  {orderingAllowed ? "Outside kitchen hours" : "Kitchen closed"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {hours?.demoOpenMessage ?? hours?.message}
                </p>
                {hours?.openTime && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {orderingAllowed
                      ? "You can still place a demo order — the kitchen may not be staffed."
                      : `You can browse the menu — ordering opens at ${hours.openTime}.`}
                  </p>
                )}
              </div>
            </div>
          </GuestSection>
        )}

        <GuestSection title="At this venue">
          <GuestList>
            {(isTable?.bookable || isRoom?.bookable) && data.actions.reserve && (
              <GuestRow
                icon={<CalendarDays className="h-4 w-4" />}
                title={isTable ? "Book this table" : "Book this room"}
                detail="Hold it for a date and time"
                onClick={() => go(data.actions.reserve)}
              />
            )}
            {isVenue && data.actions.reserve && (
              <GuestRow
                icon={<CalendarDays className="h-4 w-4" />}
                title="Book a table"
                detail="Reserve for later today or another day"
                onClick={() => go(data.actions.reserve)}
              />
            )}
            {isRoom && data.actions.menu && (
              <GuestRow
                icon={<UtensilsCrossed className="h-4 w-4" />}
                title="Restaurant menu"
                detail="Everything the kitchen serves"
                onClick={() => go(data.actions.menu)}
              />
            )}
            {isTable && data.actions.seating && (
              <GuestRow
                icon={<LayoutGrid className="h-4 w-4" />}
                title="Live seating map"
                detail="See which tables are free right now"
                onClick={() => go(data.actions.seating)}
              />
            )}
            <GuestRow
              icon={<Camera className="h-4 w-4" />}
              title="Scan another table or room"
              onClick={() => setShowScanner(true)}
            />
          </GuestList>
        </GuestSection>

        {/* Said plainly, because ordering to a table needs the table's own code. */}
        {isVenue && (
          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            Sitting at a table? Scan the code on the table itself so your order reaches it.
          </p>
        )}
      </GuestBody>

      {/* The whole point of the screen: one tap into the menu, in the thumb zone. */}
      {canOrder && orderPath && (
        <GuestActionBar>
          <GuestPrimaryButton onClick={() => go(orderPath)}>
            <UtensilsCrossed className="h-4 w-4" />
            {orderLabel}
            <ArrowRight className="h-4 w-4" />
          </GuestPrimaryButton>
        </GuestActionBar>
      )}
    </GuestAppScreen>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError, GuestEmpty } from "@/components/user/GuestApiState";
import { withGuestQuery, DEMO_SLUG } from "@/lib/guestDemo";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import { TABLE_STATUSES, typeLabel } from "@/lib/smartSeating";
import {
  Users, Clock, MapPin, Sparkles, GitMerge, ArrowRightLeft,
  UserPlus, RefreshCw, CheckCircle2, LayoutGrid, Armchair,
} from "lucide-react";

/**
 * Status colours, written out.
 *
 * These were built as `bg-${s.color}-400` from the status catalog. Tailwind scans source
 * for whole class names, so not one of those ten dots was ever emitted into the CSS and
 * the legend rendered with invisible markers. Semantic tokens, spelled in full.
 */
const STATUS_DOT: Record<string, string> = {
  free: "bg-success",
  occupied: "bg-primary",
  reserved: "bg-info",
  cleaning: "bg-warning",
  billing: "bg-info",
  waiting_food: "bg-warning",
  maintenance: "bg-muted-foreground",
  vip_occupied: "bg-primary",
  blocked: "bg-danger",
  under_service: "bg-info",
};

/** Human label for a table category the venue actually uses. */
const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "Restaurant",
  outdoor: "Outdoor",
  hotel_resort: "Hotel & resort",
  bar_lounge: "Bar & lounge",
  event: "Event",
};

type Tab = "live" | "suggest" | "requests";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SeatingTableRow = Record<string, any>;

export default function TableSeating() {
  const [, navigate] = useAppLocation();
  const { venue, user, activeTable } = useUser();
  // The neutral demo alias, not a real venue's slug: hardcoding "spice-garden" here
  // pinned every unresolved page to one live restaurant and put its slug in the URL.

  const slug = venue.restaurantSlug || DEMO_SLUG;

  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("live");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  /** One table as the venue reports it. Named so the lists below are not untyped. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<{ tables?: SeatingTableRow[] } & Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [suggestions, setSuggestions] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [waitEstimate, setWaitEstimate] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [transferTo, setTransferTo] = useState<number | null>(null);
  const [requestMsg, setRequestMsg] = useState("");
  const [requestToken, setRequestToken] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    setLoading(true);
    setApiError(null);
    try {
      const [avail, suggest, wait] = await Promise.all([
        publicApi.seating.availability(slug, categoryFilter !== "all" ? { category: categoryFilter } : undefined),
        publicApi.seating.suggestions(slug, partySize, categoryFilter !== "all" ? { category: categoryFilter } : undefined),
        publicApi.seating.waitEstimate(slug, partySize),
      ]);
      setData(avail);
      setSuggestions(suggest.suggestions ?? []);
      setWaitEstimate(wait);
    } catch {
      setApiError("Could not load seating data.");
      setData(null);
      setSuggestions([]);
      setWaitEstimate(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [slug, partySize, categoryFilter]);

  useEffect(() => {
    if (!requestToken) return;
    const poll = async () => {
      try {
        const res = await publicApi.seating.requestStatus(requestToken);
        const status = res.request?.status ?? "pending";
        setRequestStatus(status);
        if (status === "approved") {
          setRequestMsg("Request approved — please proceed to your table.");
        } else if (status === "rejected") {
          setRequestMsg("Request could not be fulfilled. Please speak with staff.");
        }
      } catch { /* polling optional */ }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [requestToken]);

  const allTables: SeatingTableRow[] = data?.tables ?? [];

  /**
   * Categories and table types this venue actually has.
   *
   * This block used to render TABLE_TYPE_CATALOG — a fixed list of 21 types across four
   * categories ("Cabana Table", "Conference Dining Table", "Poolside Table") — under the
   * heading "Table Types", on every venue. A cafe with eight two-tops was shown as
   * offering cabanas and a banquet hall. The venue's own tables carry `tableCategory`
   * and `tableType`, so the filter and the list are built from those and nothing else.
   */
  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const t of allTables) {
      const c = String(t.tableCategory ?? "").trim();
      if (c) seen.set(c, (seen.get(c) ?? 0) + 1);
    }
    return [...seen.entries()].map(([id, count]) => ({ id, count, label: CATEGORY_LABEL[id] ?? id.replace(/_/g, " ") }));
  }, [allTables]);

  const typesByCategory = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const t of allTables) {
      const c = String(t.tableCategory ?? "").trim();
      const ty = String(t.tableType ?? "").trim();
      if (!c || !ty) continue;
      if (!map.has(c)) map.set(c, new Map());
      const inner = map.get(c)!;
      inner.set(ty, (inner.get(ty) ?? 0) + 1);
    }
    return map;
  }, [allTables]);

  const statusesInUse = useMemo(
    () => TABLE_STATUSES.filter(s => (data?.byStatus?.[s.id] ?? 0) > 0 || statusFilter === s.id),
    [data, statusFilter],
  );

  const filteredTables = allTables.filter(t =>
    (statusFilter === "all" || t.status === statusFilter) &&
    (categoryFilter === "all" || t.tableCategory === categoryFilter),
  );

  async function submitRequest(type: "join" | "split" | "transfer") {
    if (!selectedTable && type !== "join") return;
    setSubmitting(true);
    setRequestMsg("");
    const body = {
      fromTableId: selectedTable,
      toTableId: transferTo,
      partySize,
      guestName: user?.name,
      guestPhone: user?.mobile,
    };
    try {
      const fn = type === "join"
        ? publicApi.seating.joinRequest
        : type === "split"
          ? publicApi.seating.splitRequest
          : publicApi.seating.transferRequest;
      const res = await fn(slug, body);
      setRequestToken(res.request?.token ?? null);
      setRequestMsg(res.message || "Request submitted.");
    } catch {
      toast({ title: "Could not send", description: `Your ${type} request did not go through.`, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="guest-page thin-scroll min-h-screen pb-24">
      <div className="guest-header px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <GuestBackButton />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">Tables &amp; seating</h1>
            <p className="text-xs text-muted-foreground truncate">{venue.restaurantName}{activeTable ? ` · ${activeTable}` : ""}</p>
          </div>
          <button onClick={loadAll} aria-label="Refresh" className="guest-btn-secondary h-11 w-11 p-0">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { id: "live", label: "Availability", icon: LayoutGrid },
            { id: "suggest", label: "Suggestions", icon: Sparkles },
            { id: "requests", label: "Requests", icon: GitMerge },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`guest-pill ${tab === t.id ? "guest-pill-active" : ""}`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Party size + wait estimate */}
        <div className="guest-section-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Party size</span>
            <div className="flex items-center gap-2">
              <button aria-label="Smaller party" onClick={() => setPartySize(Math.max(1, partySize - 1))} className="guest-btn-secondary h-11 w-11 p-0">−</button>
              <span className="w-8 text-center font-semibold tabular-nums">{partySize}</span>
              <button aria-label="Larger party" onClick={() => setPartySize(Math.min(12, partySize + 1))} className="guest-btn-secondary h-11 w-11 p-0">+</button>
            </div>
          </div>
          {waitEstimate && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-muted p-2">
                <div className="text-lg font-semibold tabular-nums text-success">{data?.freeCount ?? 0}</div>
                <div className="text-2xs text-muted-foreground">Free now</div>
              </div>
              <div className="rounded-md bg-muted p-2">
                <div className="text-lg font-semibold tabular-nums">{waitEstimate.estimatedWaitMinutes ?? 0}m</div>
                <div className="text-2xs text-muted-foreground">Est. wait</div>
              </div>
              <div className="rounded-md bg-muted p-2">
                <div className="text-lg font-semibold tabular-nums">#{waitEstimate.estimatedQueuePosition ?? 1}</div>
                <div className="text-2xs text-muted-foreground">In queue</div>
              </div>
            </div>
          )}
        </div>

        {loading && <GuestLoading label="Loading seating…" />}

        {!loading && apiError && !data && (
          <GuestError message={apiError} onRetry={loadAll} />
        )}

        {!loading && tab === "live" && data && (
          <>
            {/* Status legend — only the statuses this venue's tables are actually in */}
            {statusesInUse.length > 0 && (
              <div className="guest-section-card">
                <h2 className="guest-section-label mb-3">Table status</h2>
                <div className="flex flex-wrap gap-1.5">
                  {statusesInUse.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setStatusFilter(statusFilter === s.id ? "all" : s.id)}
                      aria-pressed={statusFilter === s.id}
                      className={`guest-pill ${statusFilter === s.id ? "guest-pill-active" : ""}`}
                    >
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[s.id] ?? "bg-muted-foreground"}`} />
                      {s.label} ({data.byStatus?.[s.id] ?? 0})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Table types — derived from this venue's own tables */}
            {categories.length > 0 && (
              <div className="guest-section-card space-y-3">
                <h2 className="guest-section-label flex items-center gap-1.5">
                  <Armchair className="h-3.5 w-3.5" /> Table types here
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setCategoryFilter("all")} aria-pressed={categoryFilter === "all"} className={`guest-pill ${categoryFilter === "all" ? "guest-pill-active" : ""}`}>
                    All ({allTables.length})
                  </button>
                  {categories.map(c => (
                    <button key={c.id} onClick={() => setCategoryFilter(c.id)} aria-pressed={categoryFilter === c.id} className={`guest-pill ${categoryFilter === c.id ? "guest-pill-active" : ""}`}>
                      {c.label} ({c.count})
                    </button>
                  ))}
                </div>
                {categories
                  .filter(c => categoryFilter === "all" || categoryFilter === c.id)
                  .map(c => (
                    <div key={c.id}>
                      <h3 className="text-xs font-medium mb-1">{c.label}</h3>
                      <div className="flex flex-wrap gap-1">
                        {[...(typesByCategory.get(c.id) ?? new Map()).entries()].map(([ty, count]) => (
                          <span key={ty} className="px-2 py-0.5 rounded-md bg-muted text-2xs text-muted-foreground">
                            {typeLabel(c.id, ty)} ×{count}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Live table grid */}
            {filteredTables.length === 0 ? (
              <GuestEmpty
                icon={Armchair}
                title="No tables match"
                message="Nothing here fits that filter right now. Clear the filters or join the waitlist."
                actionLabel="Clear filters"
                onAction={() => { setStatusFilter("all"); setCategoryFilter("all"); }}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredTables.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTable(t.id)}
                    aria-pressed={selectedTable === t.id}
                    className={`guest-card guest-card-interactive text-left p-3 ${selectedTable === t.id ? "ring-1 ring-primary" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">{t.name}</span>
                      <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[t.status] ?? "bg-muted-foreground"}`} />
                    </div>
                    <div className="text-2xs text-muted-foreground space-y-0.5">
                      <div className="flex items-center gap-1 truncate"><MapPin className="h-2.5 w-2.5 shrink-0" />{t.zone}</div>
                      <div className="truncate">{typeLabel(t.tableCategory, t.tableType)} · {t.capacity} seats</div>
                      <div>{TABLE_STATUSES.find(s => s.id === t.status)?.label ?? t.status}</div>
                      {t.currentGuestCount > 0 && <div>{t.currentGuestCount}/{t.capacity} seated</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && !apiError && tab === "suggest" && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Tables for {partySize} guests</h2>
            {suggestions.length === 0 ? (
              <GuestEmpty
                icon={Clock}
                title="Nothing free right now"
                message={`No free table fits a party of ${partySize} at the moment. Join the waitlist and we will call you.`}
                actionLabel="Join waitlist"
                onAction={() => navigate(withGuestQuery("/user/queue", venue, activeTable))}
              />
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ) : suggestions.map((s: any) => (
              <div key={s.id} className="guest-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {s.name} <span className="text-xs text-success ml-1">{s.fit === "perfect" ? "Perfect fit" : "Good fit"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{typeLabel(s.tableCategory, s.tableType)} · {s.zone} · {s.capacity} seats</div>
                  </div>
                  <button onClick={() => { setSelectedTable(s.id); setTab("requests"); }} className="guest-btn-secondary px-3 text-xs shrink-0">Select</button>
                </div>
              </div>
            ))}
            {suggestions.length > 0 && (
              <button onClick={() => navigate(withGuestQuery("/user/queue", venue, activeTable))} className="guest-btn-secondary w-full py-3 text-sm">
                <Clock className="h-4 w-4" /> Join waitlist instead
              </button>
            )}
          </div>
        )}

        {!loading && !apiError && tab === "requests" && (
          <div className="space-y-4">
            <div className="guest-section-card space-y-3">
              <h2 className="text-sm font-medium">Seating requests</h2>
              <p className="text-xs text-muted-foreground">
                Selected table: {selectedTable ? allTables.find(t => t.id === selectedTable)?.name ?? `#${selectedTable}` : "none — pick one under Availability"}
              </p>

              <button
                onClick={() => submitRequest("join")}
                disabled={submitting}
                className="guest-card guest-card-interactive w-full flex items-center gap-3 p-3 text-left"
              >
                <UserPlus className="h-5 w-5 text-primary shrink-0" />
                <div><div className="text-sm font-medium">Join a table</div><div className="text-xs text-muted-foreground">Sit with another party</div></div>
              </button>

              <button
                onClick={() => submitRequest("split")}
                disabled={submitting || !selectedTable}
                className="guest-card guest-card-interactive w-full flex items-center gap-3 p-3 text-left disabled:opacity-40"
              >
                <GitMerge className="h-5 w-5 text-primary shrink-0" />
                <div><div className="text-sm font-medium">Split the table</div><div className="text-xs text-muted-foreground">Separate seating or separate bills</div></div>
              </button>

              <div className="guest-card p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <ArrowRightLeft className="h-5 w-5 text-primary shrink-0" />
                  <div><div className="text-sm font-medium">Move table</div><div className="text-xs text-muted-foreground">Ask to be seated somewhere else</div></div>
                </div>
                <label htmlFor="transfer-to" className="sr-only">Transfer to table</label>
                <select
                  id="transfer-to"
                  value={transferTo ?? ""}
                  onChange={e => setTransferTo(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="guest-input"
                >
                  <option value="">Move to…</option>
                  {allTables.filter(t => t.available && t.id !== selectedTable).map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.zone} ({t.capacity} seats)</option>
                  ))}
                </select>
                <button
                  onClick={() => submitRequest("transfer")}
                  disabled={submitting || !selectedTable || !transferTo}
                  className="guest-btn-primary w-full py-2.5 text-sm disabled:opacity-40"
                >
                  Request move
                </button>
              </div>
            </div>

            {requestMsg && (
              <div
                role="status"
                className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                  requestStatus === "rejected"
                    ? "border-danger-border bg-danger-subtle text-danger"
                    : requestStatus === "approved"
                      ? "border-success-border bg-success-subtle text-success"
                      : "border-border bg-muted text-muted-foreground"
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p>{requestMsg}</p>
                  {requestStatus && (
                    <p className="text-2xs uppercase tracking-wide mt-0.5 opacity-70">Status: {requestStatus}</p>
                  )}
                </div>
                {requestToken && <span className="text-xs font-mono shrink-0 opacity-60">{requestToken.slice(0, 10)}…</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

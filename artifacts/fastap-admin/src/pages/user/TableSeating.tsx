import { useState, useEffect } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError } from "@/components/user/GuestApiState";
import { withGuestQuery } from "@/lib/guestDemo";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  TABLE_STATUSES, TABLE_TYPE_CATALOG, typeLabel,
} from "@/lib/smartSeating";
import {
  Users, Clock, MapPin, Sparkles, GitMerge, ArrowRightLeft,
  UserPlus, RefreshCw, CheckCircle2, Filter, LayoutGrid,
} from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  free: "bg-emerald-500/20 text-emerald-300",
  occupied: "bg-orange-500/20 text-orange-300",
  reserved: "bg-blue-500/20 text-blue-300",
  cleaning: "bg-yellow-500/20 text-yellow-300",
  billing: "bg-violet-500/20 text-violet-300",
  waiting_food: "bg-amber-500/20 text-amber-300",
  maintenance: "bg-gray-500/20 text-gray-300",
  vip_occupied: "bg-purple-500/20 text-purple-300",
  blocked: "bg-red-500/20 text-red-300",
  under_service: "bg-cyan-500/20 text-cyan-300",
};

type Tab = "live" | "suggest" | "requests";

export default function TableSeating() {
  const [, navigate] = useAppLocation();
  const { venue, user, activeTable } = useUser();
  const slug = venue.restaurantSlug || "spice-garden";

  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("live");
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [data, setData] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
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

  const filteredTables = (data?.tables ?? []).filter(t =>
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
      setRequestMsg(res.message || "Request submitted!");
    } catch {
      toast({ title: "Error", description: `Could not submit ${type} request.`, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-24">
      <div className="guest-header px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <GuestBackButton />
          <div className="flex-1">
            <h1 className="text-base font-bold">Smart Table & Seating</h1>
            <p className="text-xs text-white/40">{venue.restaurantName}{activeTable ? ` · ${activeTable}` : ""}</p>
          </div>
          <button onClick={loadAll} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { id: "live", label: "Live Availability", icon: LayoutGrid },
            { id: "suggest", label: "Smart Suggestions", icon: Sparkles },
            { id: "requests", label: "Table Requests", icon: GitMerge },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${tab === t.id ? "bg-orange-500/20 border-orange-500/50 text-orange-300" : "bg-white/5 border-white/10 text-white/50"}`}
            >
              <t.icon className="h-3 w-3" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Party size + wait estimate */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-orange-400" /> Party Size</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPartySize(Math.max(1, partySize - 1))} className="h-7 w-7 rounded-lg bg-white/10 text-sm">−</button>
              <span className="w-8 text-center font-bold">{partySize}</span>
              <button onClick={() => setPartySize(Math.min(12, partySize + 1))} className="h-7 w-7 rounded-lg bg-white/10 text-sm">+</button>
            </div>
          </div>
          {waitEstimate && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/5 p-2">
                <div className="text-lg font-bold text-emerald-400">{data?.freeCount ?? 0}</div>
                <div className="text-[10px] text-white/40">Free Tables</div>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <div className="text-lg font-bold text-amber-400">{waitEstimate.estimatedWaitMinutes ?? 0}m</div>
                <div className="text-[10px] text-white/40">Wait Prediction</div>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <div className="text-lg font-bold text-blue-400">#{waitEstimate.estimatedQueuePosition ?? 1}</div>
                <div className="text-[10px] text-white/40">Queue Est.</div>
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
            {/* Status legend — all 10 statuses */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">Table Status System</h2>
              <div className="flex flex-wrap gap-1.5">
                {TABLE_STATUSES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setStatusFilter(statusFilter === s.id ? "all" : s.id)}
                    className={`px-2 py-1 rounded-full text-[10px] border transition-all ${statusFilter === s.id ? "border-orange-500/50 bg-orange-500/10" : "border-white/10 bg-white/5"}`}
                  >
                    <span className={`inline-block h-1.5 w-1.5 rounded-full bg-${s.color}-400 mr-1`} />
                    {s.label} ({data.byStatus[s.id] ?? 0})
                  </button>
                ))}
              </div>
            </div>

            {/* Table type catalog */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Table Types</h2>
                <Filter className="h-3.5 w-3.5 text-white/30" />
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <button onClick={() => setCategoryFilter("all")} className={`px-2 py-1 rounded-full text-[10px] border ${categoryFilter === "all" ? "border-orange-500/50 bg-orange-500/10" : "border-white/10"}`}>All</button>
                {Object.entries(TABLE_TYPE_CATALOG).map(([key, cat]) => (
                  <button key={key} onClick={() => setCategoryFilter(key)} className={`px-2 py-1 rounded-full text-[10px] border ${categoryFilter === key ? "border-orange-500/50 bg-orange-500/10" : "border-white/10"}`}>
                    {cat.label}
                  </button>
                ))}
              </div>
              {Object.entries(TABLE_TYPE_CATALOG).map(([key, cat]) => (
                (categoryFilter === "all" || categoryFilter === key) && (
                  <div key={key}>
                    <h3 className="text-xs font-medium text-orange-300 mb-1">{cat.label}</h3>
                    <div className="flex flex-wrap gap-1">
                      {cat.types.map(t => (
                        <span key={t.id} className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/50">{t.label}</span>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>

            {/* Live table grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredTables.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTable(t.id)}
                  className={`text-left rounded-xl border p-3 transition-all ${selectedTable === t.id ? "border-orange-500/60 bg-orange-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">{t.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_BADGE[t.status] ?? "bg-white/10 text-white/50"}`}>
                      {TABLE_STATUSES.find(s => s.id === t.status)?.label ?? t.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/40 space-y-0.5">
                    <div className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{t.zone}</div>
                    <div>{typeLabel(t.tableCategory, t.tableType)} · {t.capacity} seats</div>
                    {t.currentGuestCount > 0 && <div>{t.currentGuestCount}/{t.capacity} seated</div>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {!loading && !apiError && tab === "suggest" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-orange-400" /> Smart Table Suggestions for {partySize} guests</h2>
            {suggestions.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-8">No free tables match your party size. Try waitlist or join request.</p>
            ) : suggestions.map((s: any) => (
              <div key={s.id} className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{s.name} <span className="text-xs text-emerald-400 ml-1">{s.fit === "perfect" ? "Perfect fit" : "Good fit"}</span></div>
                    <div className="text-xs text-white/40 mt-0.5">{typeLabel(s.tableCategory, s.tableType)} · {s.zone} · {s.capacity} seats</div>
                  </div>
                  <button onClick={() => { setSelectedTable(s.id); setTab("requests"); }} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-xs font-medium text-emerald-300">Select</button>
                </div>
                <div className="mt-2 text-[10px] text-white/30">Seat capacity: {partySize} guests · Score {s.score}</div>
              </div>
            ))}
            <button onClick={() => navigate(withGuestQuery("/user/queue", venue, activeTable))} className="w-full py-3 rounded-xl border border-white/10 text-sm hover:bg-white/5 flex items-center justify-center gap-2">
              <Clock className="h-4 w-4" /> Join Waitlist Instead
            </button>
          </div>
        )}

        {!loading && !apiError && tab === "requests" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <h2 className="text-sm font-semibold">Smart Seating Requests</h2>
              <p className="text-xs text-white/40">Selected table: {selectedTable ? filteredTables.find(t => t.id === selectedTable)?.name ?? `#${selectedTable}` : "None — select from Live tab"}</p>

              <button
                onClick={() => submitRequest("join")}
                disabled={submitting}
                className="w-full flex items-center gap-3 rounded-xl border border-white/10 p-3 hover:bg-white/5 text-left"
              >
                <UserPlus className="h-5 w-5 text-blue-400" />
                <div><div className="text-sm font-medium">Table Join Request</div><div className="text-xs text-white/40">Join another party at a table</div></div>
              </button>

              <button
                onClick={() => submitRequest("split")}
                disabled={submitting || !selectedTable}
                className="w-full flex items-center gap-3 rounded-xl border border-white/10 p-3 hover:bg-white/5 text-left disabled:opacity-40"
              >
                <GitMerge className="h-5 w-5 text-violet-400" />
                <div><div className="text-sm font-medium">Table Split Request</div><div className="text-xs text-white/40">Split bill / separate seating</div></div>
              </button>

              <div className="rounded-xl border border-white/10 p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <ArrowRightLeft className="h-5 w-5 text-amber-400" />
                  <div><div className="text-sm font-medium">Table Transfer Request</div><div className="text-xs text-white/40">Move to a different table</div></div>
                </div>
                <select
                  value={transferTo ?? ""}
                  onChange={e => setTransferTo(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Transfer to table…</option>
                  {(data?.tables ?? []).filter(t => t.available && t.id !== selectedTable).map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.zone} ({t.capacity} seats)</option>
                  ))}
                </select>
                <button
                  onClick={() => submitRequest("transfer")}
                  disabled={submitting || !selectedTable || !transferTo}
                  className="w-full py-2 rounded-lg bg-amber-500/20 text-amber-300 text-sm font-medium disabled:opacity-40"
                >
                  Request Transfer
                </button>
              </div>
            </div>

            {requestMsg && (
              <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
                requestStatus === "rejected"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : requestStatus === "approved"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              }`}>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p>{requestMsg}</p>
                  {requestStatus && (
                    <p className="text-[10px] uppercase tracking-wide mt-0.5 opacity-70">Status: {requestStatus}</p>
                  )}
                </div>
                {requestToken && <span className="text-xs text-white/40 font-mono shrink-0">{requestToken.slice(0, 10)}…</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

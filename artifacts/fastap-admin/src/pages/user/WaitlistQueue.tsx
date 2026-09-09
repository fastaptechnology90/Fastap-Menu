import { useState, useEffect, useCallback } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { GuestLoading, GuestError } from "@/components/user/GuestApiState";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  QUEUE_TYPES, NOTIFY_CHANNELS, PRIORITY_LABELS,
  type QueueStats, type NotifyChannelId,
} from "@/lib/queueCatalog";
import {
  Clock, Bell, CheckCircle, Ticket, Phone, MessageSquare,
  X as XIcon, Users, TrendingUp, Crown, RefreshCw, ListOrdered,
} from "lucide-react";
import { GuestIcon } from "@/components/user/GuestIcon";

export default function WaitlistQueue() {
  const [, navigate] = useAppLocation();
  const { toast } = useToast();
  const { waitlist, setWaitlist, activeRestaurant, venue, user } = useUser();

  const [joined, setJoined] = useState(!!waitlist);
  const [queueType, setQueueType] = useState("dining");
  const [guests, setGuests] = useState(2);
  const [guestName, setGuestName] = useState(user?.name || "");
  const [guestPhone, setGuestPhone] = useState(user?.mobile || "");
  const [corporateCode, setCorporateCode] = useState("");
  const [position, setPosition] = useState(waitlist?.position || 1);
  const [eta, setEta] = useState(waitlist?.estimatedWait || 0);
  const [displayToken, setDisplayToken] = useState(
    waitlist?.tokenNumber ? `#${String(waitlist.tokenNumber).padStart(2, "0")}` : "#--",
  );
  const [notifyMethod, setNotifyMethod] = useState<NotifyChannelId>("app");
  const [notified, setNotified] = useState(false);
  const [priority, setPriority] = useState<string>("normal");
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [digitalList, setDigitalList] = useState<{ displayToken: string; partySize: number; priority: string; position: number }[]>([]);
  const [alertSent, setAlertSent] = useState<{ sms?: boolean; whatsapp?: boolean }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!venue.restaurantId) {
      setApiError("Restaurant not loaded.");
      setLoadingStats(false);
      return;
    }
    setLoadingStats(true);
    setApiError(null);
    try {
      const data = await publicApi.queueStats(venue.restaurantId, guests);
      setStats({
        queueLength: data.queueLength,
        freeTables: data.freeTables,
        freeTablesSoon: data.freeTablesSoon,
        estimatedWait: data.estimatedWait,
        groupsAhead: data.groupsAhead ?? data.queueLength,
        predictionLabel: data.predictionLabel,
        liveWaitTime: data.liveWaitTime ?? data.estimatedWait,
      });
      const wl = await publicApi.queueWaitlist(venue.restaurantId);
      setDigitalList(wl.entries?.slice(0, 8) ?? []);
    } catch {
      setApiError("Could not load queue data.");
      setStats(null);
      setDigitalList([]);
    } finally {
      setLoadingStats(false);
    }
  }, [venue.restaurantId, guests]);

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 12000);
    return () => clearInterval(t);
  }, [fetchStats]);

  useEffect(() => {
    if (!waitlist?.token || !joined || waitlist.token.startsWith("local")) return;
    const poll = async () => {
      try {
        const data = await publicApi.queueStatus(waitlist.token);
        setPosition(data.position);
        setEta(data.estimatedWait ?? data.liveWaitTime);
        setDisplayToken(data.displayToken ?? `#${String(data.tokenNumber).padStart(2, "0")}`);
        setPriority(data.priority ?? "normal");
        setDigitalList(data.digitalWaitlist ?? []);
        if (data.status === "called") {
          setNotified(true);
        }
        setWaitlist({
          token: data.token,
          tokenNumber: data.tokenNumber,
          position: data.position,
          estimatedWait: data.estimatedWait,
          restaurantName: data.restaurantName || activeRestaurant,
          status: data.status,
        });
      } catch { /* polling optional */ }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [waitlist?.token, joined, activeRestaurant, setWaitlist]);

  async function joinQueue() {
    if (!venue.restaurantId) {
      toast({ title: "Error", description: "Restaurant not available.", variant: "destructive" });
      return;
    }

    const selected = QUEUE_TYPES.find(q => q.id === queueType);
    const body = {
      restaurantId: venue.restaurantId,
      guestName: guestName || user?.name || "Guest",
      guestPhone: guestPhone || user?.mobile,
      partySize: guests,
      queueType,
      notifyVia: notifyMethod,
      priority: "priority" in (selected ?? {}) ? (selected as { priority?: string }).priority : undefined,
      corporateCode: queueType === "corporate" ? corporateCode : undefined,
      membershipTier: queueType === "membership" ? user?.tier : undefined,
    };

    try {
      const data = await publicApi.joinQueue(body);
      setJoined(true);
      setPosition(data.position);
      setEta(data.estimatedWait);
      setDisplayToken(data.displayToken);
      setPriority(data.priority ?? "normal");
      setAlertSent({ sms: data.alerts?.sms, whatsapp: data.alerts?.whatsapp });
      setWaitlist({
        token: data.token,
        tokenNumber: data.tokenNumber,
        position: data.position,
        estimatedWait: data.estimatedWait,
        restaurantName: data.restaurantName || activeRestaurant,
      });
      fetchStats();
    } catch {
      toast({ title: "Error", description: "Could not join queue. Please try again.", variant: "destructive" });
    }
  }

  async function leaveQueue() {
    if (waitlist?.token && !waitlist.token.startsWith("local")) {
      try {
        await publicApi.leaveQueue(waitlist.token);
      } catch {
        // Clearing the screen while the host still holds their place would send
        // the guest away from a table that is about to be called.
        toast({ title: "Could not leave the queue", description: "You are still in line. Please try again or tell the host.", variant: "destructive" });
        return;
      }
    }
    setJoined(false);
    setWaitlist(null);
    setPosition(1);
    setEta(stats?.estimatedWait ?? 0);
    setNotified(false);
    setAlertSent({});
    fetchStats();
  }

  const membershipEligible = user?.tier && user.tier !== "silver";

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-10">
      <div className="guest-header px-4 py-3">
        <div className="flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">Waitlist & Queue</h1>
            <p className="text-xs text-muted-foreground truncate">{activeRestaurant}</p>
          </div>
          <button onClick={fetchStats} className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <RefreshCw className={`h-4 w-4 ${loadingStats ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {!joined ? (
          <>
            {loadingStats && !stats ? (
              <GuestLoading label="Loading queue stats…" />
            ) : apiError && !stats ? (
              <GuestError message={apiError} onRetry={fetchStats} />
            ) : (
              <>
            {/* Live wait + prediction */}
            <div className="rounded-2xl border border-warning-border p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Live wait time
                </p>
                <span className="text-2xs px-2 py-0.5 rounded-full bg-warning-subtle text-warning">{stats?.predictionLabel ?? "—"}</span>
              </div>
              <div className="text-5xl font-semibold text-warning mb-1">
                ~{stats?.estimatedWait ?? 0} <span className="text-xl text-muted-foreground font-semibold">min</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 text-center text-sm">
                <div>
                  <p className="font-semibold text-foreground">{stats?.queueLength ?? 0}</p>
                  <p className="text-xs text-muted-foreground">In queue</p>
                </div>
                <div>
                  <p className="font-semibold text-success">{stats?.freeTables ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Free now</p>
                </div>
                <div>
                  <p className="font-semibold text-info">{stats?.freeTablesSoon ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Free soon</p>
                </div>
              </div>
            </div>

            {/* Digital waiting list preview */}
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-warning" /> Digital waiting list
              </p>
              {digitalList.length > 0 ? (
                <div className="space-y-2">
                  {digitalList.map(entry => (
                    <div key={entry.displayToken} className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted text-sm">
                      <span className="font-mono text-warning">{entry.displayToken}</span>
                      <span className="text-muted-foreground">{entry.partySize} guests</span>
                      <span className="text-xs text-muted-foreground">{PRIORITY_LABELS[entry.priority] ?? entry.priority}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No one waiting — join now for instant seating</p>
              )}
            </div>

            {/* Queue type + smart priority */}
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Crown className="h-4 w-4 text-warning" /> Queue type & priority</p>
              <div className="grid grid-cols-2 gap-2">
                {QUEUE_TYPES.map(q => {
                  const disabled = q.id === "membership" && !membershipEligible && !!user;
                  return (
                    <button
                      key={q.id}
                      disabled={disabled}
                      onClick={() => setQueueType(q.id)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-xl text-left border transition-all ${queueType === q.id ? "bg-warning-subtle border-warning-border text-warning" : "bg-muted border-border text-muted-foreground hover:border-border"} ${disabled ? "opacity-40" : ""}`}
                    >
                      <GuestIcon id={q.id} className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold">{q.label}</span>
                      <span className="text-2xs text-muted-foreground leading-tight">{q.desc}</span>
                    </button>
                  );
                })}
              </div>
              {queueType === "corporate" && (
                <div className="mt-3 space-y-1.5">
                  <input
                    className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm"
                    placeholder="Corporate code"
                    value={corporateCode}
                    onChange={e => setCorporateCode(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Enter your corporate access code if you have one.</p>
                </div>
              )}
              {queueType === "membership" && user?.tier && (
                <p className="mt-2 text-xs text-success">Your tier: {user.tier} — priority queue applied</p>
              )}
            </div>

            {/* Guest details */}
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <input className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm" placeholder="Your name" value={guestName} onChange={e => setGuestName(e.target.value)} />
              <input className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm" placeholder="Mobile (for SMS/WhatsApp)" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} />
            </div>

            {/* Party size */}
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> Party size</p>
              <div className="flex items-center gap-4 justify-center">
                <button onClick={() => setGuests(g => Math.max(1, g - 1))} className="h-10 w-10 rounded-xl bg-muted hover:bg-muted text-lg">−</button>
                <span className="text-2xl font-semibold">{guests} <span className="text-sm text-muted-foreground">guests</span></span>
                <button onClick={() => setGuests(g => Math.min(12, g + 1))} className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 text-lg">+</button>
              </div>
              {/* This claimed "Family priority auto-applied for 5+ guests" while the join
                  request sent no priority at all — the "dining" queue type carries none.
                  Larger parties wait longer for a table, they do not jump the line. */}
              {guests >= 5 && queueType === "dining" && (
                <p className="text-xs text-muted-foreground text-center mt-2">Larger parties may wait longer while a big enough table frees up.</p>
              )}
            </div>

            {/* Alerts */}
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Bell className="h-4 w-4 text-warning" /> Alert me via</p>
              <div className="grid grid-cols-2 gap-2">
                {NOTIFY_CHANNELS.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setNotifyMethod(ch.id)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border text-left transition-all ${notifyMethod === ch.id ? "bg-warning-subtle border-warning-border text-warning" : "border-border bg-muted text-muted-foreground"}`}
                  >
                    <GuestIcon id={ch.id} className="h-4 w-4 mx-auto mb-1" />
                    {ch.label}
                  </button>
                ))}
              </div>
              {(notifyMethod === "sms" || notifyMethod === "whatsapp" || notifyMethod === "both") && !guestPhone && (
                <p className="text-xs text-warning mt-2">Add mobile number above for {notifyMethod === "both" ? "SMS & WhatsApp" : notifyMethod} alerts</p>
              )}
            </div>

            <button onClick={joinQueue} className="w-full py-4 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-base shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2">
              <Ticket className="h-5 w-5" />
              Join Queue — est. #{(stats?.queueLength ?? 0) + 1} · ~{stats?.estimatedWait ?? 0} min
            </button>
              </>
            )}
          </>
        ) : (
          <>
            {notified && (
              <div className="rounded-2xl bg-success-subtle border border-success-border p-4 text-center animate-pulse">
                <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="font-semibold text-success">Your table is ready!</p>
                <p className="text-sm text-muted-foreground mt-1">Please proceed to the host desk</p>
                {(alertSent.sms || alertSent.whatsapp) && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {alertSent.sms && "SMS sent"}{alertSent.sms && alertSent.whatsapp && " · "}{alertSent.whatsapp && "WhatsApp sent"}
                  </p>
                )}
              </div>
            )}

            {/* Token */}
            <div className="rounded-2xl border border-warning-border p-6 text-center">
              <p className="text-xs text-muted-foreground mb-1">Your queue token</p>
              <div className="text-6xl font-semibold text-warning mb-1 font-mono">{displayToken}</div>
              {priority !== "normal" && (
                <span className="inline-block text-xs px-2 py-1 rounded-full bg-muted text-primary mb-3">
                  {PRIORITY_LABELS[priority] ?? priority}
                </span>
              )}
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <p className="text-3xl font-semibold text-foreground">{position}</p>
                  <p className="text-xs text-muted-foreground">Position in line</p>
                </div>
                <div>
                  <p className="text-3xl font-semibold text-foreground">{eta}</p>
                  <p className="text-xs text-muted-foreground">Est. minutes</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-1.5 mt-4">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-success font-medium">Live tracking · updates every 5s</span>
              </div>
            </div>

            {/* Queue prediction */}
            {stats && (
              <div className="rounded-2xl bg-card border border-border p-4">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-warning" /> Queue prediction</p>
                <p className="text-sm text-muted-foreground">{stats.predictionLabel}</p>
                <p className="text-xs text-muted-foreground mt-1">{Math.max(0, position - 1)} groups ahead · {stats.freeTablesSoon} tables clearing soon</p>
              </div>
            )}

            {/* Position visualization */}
            <div className="rounded-2xl bg-card border border-border p-4">
              <p className="text-sm font-semibold mb-3">Your position</p>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: Math.min(position + 2, 12) }).map((_, i) => (
                  <div key={i} className={`h-9 min-w-[2.25rem] px-1 rounded-full flex items-center justify-center text-xs font-semibold ${i < position - 1 ? "bg-muted text-muted-foreground" : i === position - 1 ? "bg-primary text-primary-foreground ring-2 ring-primary" : "bg-muted text-muted-foreground"}`}>
                    {i === position - 1 ? "You" : i + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Live digital waitlist */}
            {digitalList.length > 0 && (
              <div className="rounded-2xl bg-card border border-border p-4">
                <p className="text-sm font-semibold mb-2">Live waiting list</p>
                <div className="space-y-1">
                  {digitalList.map(e => (
                    <div key={e.displayToken} className={`flex justify-between text-xs py-1.5 px-2 rounded-lg ${e.displayToken === displayToken ? "bg-warning-subtle text-warning" : "text-muted-foreground"}`}>
                      <span className="font-mono">{e.displayToken}</span>
                      <span>{e.partySize}p · {PRIORITY_LABELS[e.priority] ?? e.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-card border border-border p-4 flex gap-3">
              <button onClick={() => navigate("/user/support")} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-info-subtle border border-info-border text-info text-sm font-semibold hover:bg-info-subtle">
                <MessageSquare className="h-4 w-4" /> Message Host
              </button>
              {/* This used to navigate to /user/support, exactly like the button beside
                  it — two differently-labelled buttons going to the same form, and no
                  way to actually reach the host desk. */}
              <a
                href={stats?.restaurantPhone ? `tel:${String(stats.restaurantPhone).replace(/[^\d+]/g, "")}` : undefined}
                aria-disabled={!stats?.restaurantPhone}
                onClick={e => { if (!stats?.restaurantPhone) { e.preventDefault(); navigate("/user/support"); } }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-success-subtle border border-success-border text-success text-sm font-semibold hover:bg-success-subtle"
              >
                <Phone className="h-4 w-4" /> Call Reception
              </a>
            </div>

            <button onClick={leaveQueue} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-danger-border text-danger text-sm font-semibold hover:bg-danger-subtle">
              <XIcon className="h-4 w-4" /> Leave Queue
            </button>
          </>
        )}
      </div>
    </div>
  );
}

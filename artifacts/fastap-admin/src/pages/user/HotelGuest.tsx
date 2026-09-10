import { useState, useEffect, useCallback } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { useUser } from "@/contexts/UserContext";
import { publicApi } from "@/lib/api";
import {
  DEFAULT_ROOM_CONTROLS,
  CLEANING_STATUS_LABELS,
  type RoomControls,
} from "@/lib/hotelGuestCatalog";
import {
  ChevronLeft, CheckCircle, Moon, Sun, Tv, Wind, Blinds,
  Lightbulb, BellOff, Sparkles, UtensilsCrossed, RefreshCw,
} from "lucide-react";
import { GuestIcon } from "@/components/user/GuestIcon";

type Tab = "services" | "controls";

function controlsStorageKey(room: string) {
  return `fastap_room_controls_${room || "default"}`;
}

function loadLocalControls(room: string): RoomControls {
  try {
    const raw = localStorage.getItem(controlsStorageKey(room));
    return raw ? { ...DEFAULT_ROOM_CONTROLS, ...JSON.parse(raw) } : { ...DEFAULT_ROOM_CONTROLS };
  } catch {
    return { ...DEFAULT_ROOM_CONTROLS };
  }
}

function saveLocalControls(room: string, controls: RoomControls) {
  localStorage.setItem(controlsStorageKey(room), JSON.stringify(controls));
}

export default function HotelGuest() {
  const [, navigate] = useAppLocation();
  const { venue, user, activeRestaurant } = useUser();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const [roomNumber, setRoomNumber] = useState(venue.roomNumber || params.get("room") || "");
  const [tab, setTab] = useState<Tab>("services");
  const [selectedService, setSelectedService] = useState<string>("food");
  const [notes, setNotes] = useState("");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sent, setSent] = useState<string | null>(null);
  const [sentAssignee, setSentAssignee] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [controls, setControls] = useState<RoomControls>(() => loadLocalControls(roomNumber));
  const [loadingControls, setLoadingControls] = useState(false);
  const [controlsError, setControlsError] = useState<string | null>(null);
  const [serviceCatalog, setServiceCatalog] = useState<{ id: string; label: string; icon: string; desc: string; api: string; type: string }[]>([]);
  const [tvChannels, setTvChannels] = useState<{ id: number; name: string }[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submittingService, setSubmittingService] = useState(false);
  // The neutral demo alias, not a real venue's slug: hardcoding "spice-garden" here
  // pinned every unresolved page to one live restaurant and put its slug in the URL.
  const slug = venue.restaurantSlug || params.get("slug") || DEMO_SLUG;

  const loadCatalog = useCallback(async () => {
    if (!venue.restaurantId) return;
    try {
      const catalog = await publicApi.hotel.catalog(venue.restaurantId);
      setServiceCatalog(Array.isArray(catalog.services) ? catalog.services : []);
      setTvChannels(Array.isArray(catalog.tvChannels) ? catalog.tvChannels : []);
      setCatalogError(null);
    } catch {
      setServiceCatalog([]);
      setTvChannels([]);
      setCatalogError("Could not load hotel services.");
    }
  }, [venue.restaurantId]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const fetchControls = useCallback(async () => {
    if (!venue.restaurantId || !roomNumber) return;
    setLoadingControls(true);
    try {
      const data = await publicApi.hotel.room(venue.restaurantId, roomNumber);
      const rc = { ...DEFAULT_ROOM_CONTROLS, ...(data.roomControls ?? {}) };
      setControls(rc);
      saveLocalControls(roomNumber, rc);
      setControlsError(null);
    } catch {
      setControlsError("Could not sync room controls from server.");
      setControls(loadLocalControls(roomNumber));
    } finally {
      setLoadingControls(false);
    }
  }, [venue.restaurantId, roomNumber]);

  useEffect(() => {
    if (roomNumber) fetchControls();
  }, [roomNumber, fetchControls]);

  async function patchControls(patch: Partial<RoomControls>) {
    const merged = { ...controls, ...patch };
    if (patch.ac) merged.ac = { ...controls.ac, ...patch.ac };
    if (patch.lights) merged.lights = { ...controls.lights, ...patch.lights };
    if (patch.curtains) merged.curtains = { ...controls.curtains, ...patch.curtains };
    if (patch.tv) merged.tv = { ...controls.tv, ...patch.tv };
    setControls(merged);
    saveLocalControls(roomNumber, merged);
    if (!venue.restaurantId || !roomNumber) {
      setControls(controls);
      saveLocalControls(roomNumber, controls);
      setToast("Scan the QR code in your room to change controls. Nothing was sent to the room.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    try {
      const res = await publicApi.hotel.updateControls(venue.restaurantId, roomNumber, merged);
      if (res.roomControls) setControls({ ...DEFAULT_ROOM_CONTROLS, ...res.roomControls });
    } catch (e) {
      // "Room updated" was shown whether or not anything reached the room. A guest who
      // turned the lights off and walked away had no idea nothing had happened.
      setControls(controls);
      saveLocalControls(roomNumber, controls);
      setToast(e instanceof Error ? e.message : "The room did not respond — please use the panel by the door.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setToast("Preferences saved for this room — not a live hardware control.");
    setTimeout(() => setToast(null), 2500);
  }

  async function submitService() {
    setRequestError(null);
    if (!roomNumber) {
      setRequestError("We do not know which room you are in. Scan the QR code in your room and try again.");
      return;
    }
    const svc = serviceCatalog.find(r => r.id === selectedService);
    if (!svc) {
      setRequestError("Pick a service first.");
      return;
    }
    if (submittingService) return;
    setSubmittingService(true);

    if (svc.id === "food") {
      setSubmittingService(false);
      navigate(`/user/menu?slug=${slug}&room=${encodeURIComponent(roomNumber)}`);
      return;
    }

    if (!venue.restaurantId) {
      setSubmittingService(false);
      setRequestError("We do not know which venue you are in. Scan the QR code in your room and try again.");
      return;
    }

    const payload = {
      restaurantId: venue.restaurantId,
      roomNumber,
      guestName: user?.name,
      guestPhone: user?.mobile,
      notes,
      type: svc.type,
    };

    try {
      let assignee: string | null = null;
      if (svc.api === "wakeUp") {
        const today = new Date();
        const [h, m] = wakeTime.split(":").map(Number);
        const scheduled = new Date(today);
        scheduled.setHours(h, m, 0, 0);
        if (scheduled <= new Date()) scheduled.setDate(scheduled.getDate() + 1);
        const res = await publicApi.hotel.wakeUpCall({
          restaurantId: payload.restaurantId,
          roomNumber,
          guestName: user?.name,
          scheduledAt: scheduled.toISOString(),
          notes: notes || `Wake-up call at ${wakeTime}`,
        });
        assignee = res?.assignedTo ?? null;
      } else if (svc.api === "housekeeping") {
        const res = await publicApi.housekeeping({
          ...payload,
          title: svc.label,
          description: notes || svc.desc,
          type: svc.type,
        });
        assignee = res?.assignedTo ?? null;
      } else if (svc.api === "maintenance") {
        const res = await publicApi.maintenance({
          ...payload,
          title: svc.label,
          description: notes || svc.desc,
          category: svc.type,
        });
        assignee = res?.assignedTo ?? null;
      } else {
        const res = await publicApi.roomService({ ...payload, items: [], total: 0 });
        assignee = res?.assignedTo ?? null;
      }
      setSentAssignee(assignee);
      setSent(svc.label);
    } catch (e) {
      // The success screen used to be shown here too, telling a guest whose request
      // never left the phone that "our team has been notified". Nobody was.
      setRequestError(
        e instanceof Error
          ? `${e.message} Please try again, or call reception.`
          : "We could not send your request. Please try again, or call reception.",
      );
    } finally {
      setSubmittingService(false);
    }
  }

  if (sent) {
    return (
      <div className="guest-page thin-scroll min-h-screen text-foreground flex flex-col items-center justify-center gap-4 px-8 text-center relative">
        <GuestBackButton className="absolute top-4 left-4" />
        <CheckCircle className="h-14 w-14 text-success" />
        <h2 className="text-xl font-semibold">{sent} Requested</h2>
        <p className="text-muted-foreground">Room {roomNumber} — our team has been notified.</p>
        {sentAssignee && (
          <p className="text-sm text-success">Assigned to {sentAssignee} automatically</p>
        )}
        <button onClick={() => { setSent(null); setSentAssignee(null); setNotes(""); }} className="mt-2 px-6 py-3 rounded-xl bg-muted font-semibold text-sm">
          New Request
        </button>
        <button onClick={() => navigate(`/user/menu?slug=${slug}&room=${roomNumber}`)} className="px-6 py-3 rounded-xl bg-primary font-semibold text-sm">
          Back to Menu
        </button>
      </div>
    );
  }

  const selected = serviceCatalog.find(r => r.id === selectedService);

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-10">
      <div className="guest-header px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <GuestBackButton />
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">Hotel Guest Services</h1>
            <p className="text-xs text-muted-foreground truncate">{activeRestaurant}</p>
          </div>
          {controlsError && (
            <span className="text-2xs px-2 py-1 rounded-full bg-warning-subtle text-warning">Offline controls</span>
          )}
        </div>
        <div className="flex gap-2">
          {(["services", "controls"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {t === "services" ? "Room Services" : "Smart Controls"}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-primary text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        <div className="flex gap-2 items-center">
          <input
            className="flex-1 bg-muted border border-border rounded-xl px-4 py-3 text-sm"
            placeholder="Room number"
            value={roomNumber}
            onChange={e => setRoomNumber(e.target.value)}
          />
          {tab === "controls" && (
            <button onClick={fetchControls} disabled={loadingControls} className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center">
              <RefreshCw className={`h-4 w-4 ${loadingControls ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>

        {tab === "services" ? (
          <>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Request a service</p>
            <div className="grid grid-cols-3 gap-2">
              {serviceCatalog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{catalogError ?? "No hotel services configured."}</p>
              ) : serviceCatalog.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedService(r.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center text-xs ${selectedService === r.id ? "bg-info-subtle border-info-border" : "bg-muted border-border"}`}
                >
                  <GuestIcon id={r.id} className="h-5 w-5 text-primary" />
                  <span className="font-medium leading-tight">{r.label.replace(" Request", "")}</span>
                </button>
              ))}
            </div>

            {selected && (
              <div className="rounded-xl bg-muted border border-border p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <GuestIcon id={selected.id} className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">{selected.label}</h3>
                    <p className="text-sm text-muted-foreground">{selected.desc}</p>
                  </div>
                </div>

                {selected.id === "food" ? (
                  <button
                    onClick={() => navigate(`/user/menu?slug=${slug}&room=${encodeURIComponent(roomNumber)}`)}
                    disabled={!roomNumber}
                    className="w-full py-3 rounded-xl bg-primary font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <UtensilsCrossed className="h-4 w-4" />
                    Browse Room Service Menu
                  </button>
                ) : (
                  <>
                    {selected.id === "wake_up" && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Wake-up time</label>
                        <input
                          type="time"
                          value={wakeTime}
                          onChange={e => setWakeTime(e.target.value)}
                          className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm"
                        />
                      </div>
                    )}
                    <textarea
                      className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm min-h-[80px]"
                      placeholder="Special instructions (optional)..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                    {requestError && (
                      <p role="alert" className="text-xs text-danger bg-danger-subtle border border-danger-border rounded-xl px-3 py-2">
                        {requestError}
                      </p>
                    )}
                    <button
                      onClick={submitService}
                      disabled={!roomNumber || submittingService}
                      className="w-full py-3 rounded-xl bg-primary font-semibold text-sm disabled:opacity-40"
                    >
                      {submittingService ? "Sending…" : `Submit ${selected.label}`}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="rounded-xl border border-warning-border bg-warning-subtle p-3 text-xs text-muted-foreground">
              Smart controls save preferences for staff and the room record. They do not switch physical AC, lights or TV unless your hotel has wired that hardware.
            </div>
            {/* Cleaning status */}
            <div className={`rounded-xl border p-4 flex items-center gap-3 ${
              controls.cleaningStatus === "clean" ? "bg-success-subtle border-success-border" :
              controls.cleaningStatus === "in_progress" ? "bg-info-subtle border-info-border" :
              controls.cleaningStatus === "scheduled" ? "bg-warning-subtle border-warning-border" :
              "bg-danger-subtle border-danger-border"
            }`}>
              <Sparkles className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase">Room cleaning status</p>
                <p className="font-semibold">{CLEANING_STATUS_LABELS[controls.cleaningStatus]}</p>
              </div>
            </div>

            {/* DND */}
            <div className="rounded-xl bg-muted border border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BellOff className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">Do Not Disturb</p>
                  <p className="text-xs text-muted-foreground">{controls.dnd ? "Staff will not knock" : "Normal service mode"}</p>
                </div>
              </div>
              <button
                onClick={() => patchControls({ dnd: !controls.dnd })}
                className={`w-14 h-8 rounded-full transition-colors ${controls.dnd ? "bg-primary" : "bg-muted"}`}
              >
                <div className={`h-6 w-6 rounded-full bg-card shadow transition-transform mx-1 ${controls.dnd ? "translate-x-6" : ""}`} />
              </button>
            </div>

            {/* AC */}
            <div className="rounded-xl bg-muted border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wind className="h-5 w-5 text-info" />
                  <span className="font-semibold">Air Conditioning</span>
                </div>
                <button
                  onClick={() => patchControls({ ac: { ...controls.ac, on: !controls.ac.on } })}
                  className={`w-14 h-8 rounded-full transition-colors ${controls.ac.on ? "bg-primary" : "bg-muted"}`}
                >
                  <div className={`h-6 w-6 rounded-full bg-card shadow transition-transform mx-1 ${controls.ac.on ? "translate-x-6" : ""}`} />
                </button>
              </div>
              {controls.ac.on && (
                <>
                  <div className="flex items-center justify-between">
                    <button onClick={() => patchControls({ ac: { ...controls.ac, temp: Math.max(16, controls.ac.temp - 1) } })} className="h-10 w-10 rounded-xl bg-muted text-lg font-semibold">−</button>
                    <span className="text-3xl font-semibold">{controls.ac.temp}°C</span>
                    <button onClick={() => patchControls({ ac: { ...controls.ac, temp: Math.min(30, controls.ac.temp + 1) } })} className="h-10 w-10 rounded-xl bg-muted text-lg font-semibold">+</button>
                  </div>
                  <div className="flex gap-2">
                    {(["cool", "heat", "fan"] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => patchControls({ ac: { ...controls.ac, mode } })}
                        className={`flex-1 py-2 rounded-lg text-xs capitalize ${controls.ac.mode === mode ? "bg-info-subtle border border-info-border" : "bg-muted"}`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Lights */}
            <div className="rounded-xl bg-muted border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-warning" />
                  <span className="font-semibold">Smart Lights</span>
                </div>
                <button
                  onClick={() => patchControls({ lights: { ...controls.lights, on: !controls.lights.on } })}
                  className={`w-14 h-8 rounded-full transition-colors ${controls.lights.on ? "bg-primary" : "bg-muted"}`}
                >
                  <div className={`h-6 w-6 rounded-full bg-card shadow transition-transform mx-1 ${controls.lights.on ? "translate-x-6" : ""}`} />
                </button>
              </div>
              {controls.lights.on && (
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <Sun className="h-3 w-3" />
                    <span>{controls.lights.brightness}%</span>
                    <Moon className="h-3 w-3" />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={controls.lights.brightness}
                    onChange={e => patchControls({ lights: { ...controls.lights, brightness: parseInt(e.target.value, 10) } })}
                    className="w-full accent-yellow-400"
                  />
                </div>
              )}
            </div>

            {/* Curtains */}
            <div className="rounded-xl bg-muted border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Blinds className="h-5 w-5 text-info" />
                <span className="font-semibold">Curtains</span>
                <span className="ml-auto text-sm text-muted-foreground">{controls.curtains.open}% open</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={controls.curtains.open}
                onChange={e => patchControls({ curtains: { open: parseInt(e.target.value, 10) } })}
                className="w-full accent-indigo-400"
              />
              <div className="flex gap-2">
                <button onClick={() => patchControls({ curtains: { open: 0 } })} className="flex-1 py-2 rounded-lg bg-muted text-xs">Close</button>
                <button onClick={() => patchControls({ curtains: { open: 50 } })} className="flex-1 py-2 rounded-lg bg-muted text-xs">Half</button>
                <button onClick={() => patchControls({ curtains: { open: 100 } })} className="flex-1 py-2 rounded-lg bg-muted text-xs">Open</button>
              </div>
            </div>

            {/* TV */}
            <div className="rounded-xl bg-muted border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tv className="h-5 w-5 text-primary" />
                  <span className="font-semibold">TV Control</span>
                </div>
                <button
                  onClick={() => patchControls({ tv: { ...controls.tv, on: !controls.tv.on } })}
                  className={`w-14 h-8 rounded-full transition-colors ${controls.tv.on ? "bg-primary" : "bg-muted"}`}
                >
                  <div className={`h-6 w-6 rounded-full bg-card shadow transition-transform mx-1 ${controls.tv.on ? "translate-x-6" : ""}`} />
                </button>
              </div>
              {controls.tv.on && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {tvChannels.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No TV channels configured.</p>
                    ) : tvChannels.map(ch => (
                      <button
                        key={ch.id}
                        onClick={() => patchControls({ tv: { ...controls.tv, channel: ch.id } })}
                        className={`py-2 px-3 rounded-lg text-xs text-left ${controls.tv.channel === ch.id ? "bg-muted border border-primary" : "bg-muted"}`}
                      >
                        CH {ch.id}: {ch.name}
                      </button>
                    ))}
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Volume</span>
                      <span>{controls.tv.volume}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={controls.tv.volume}
                      onChange={e => patchControls({ tv: { ...controls.tv, volume: parseInt(e.target.value, 10) } })}
                      className="w-full accent-pink-400"
                    />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

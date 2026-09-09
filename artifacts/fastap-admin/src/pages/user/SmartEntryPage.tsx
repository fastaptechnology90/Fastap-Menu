import { useEffect, useState } from "react";
import { DEMO_SLUG } from "@/lib/guestDemo";
import { useParams } from "wouter";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useSmartEntry } from "@/hooks/useSmartEntry";
import {
  ACCESS_METHODS, SESSION_FEATURES,
  accessMethodLabel, serviceModeLabel, buildEntryUrl, isPwaInstalled,
} from "@/lib/smartEntry";
import {
  QrCode, Nfc, Globe, Link2, Smartphone, Hotel, Waves, Sparkles,
  PartyPopper, ParkingCircle, Loader2, CheckCircle2, ArrowRight,
  MapPin, Clock, Languages, Users, RefreshCw,
  RotateCw, Save, Tablet, UsersRound, Armchair, LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GuestBackButton } from "@/components/user/GuestUI";

const ENTRY_ICONS: Record<string, LucideIcon> = {
  qr: QrCode, nfc: Nfc, browser: Globe, direct_url: Link2, pwa: Smartphone,
  room_qr: Hotel, poolside_qr: Waves, spa_qr: Sparkles, event_qr: PartyPopper, parking_qr: ParkingCircle,
};

const SESSION_ICONS: Record<string, LucideIcon> = {
  autoReconnect: RotateCw, sessionRestore: Save, multiDevice: Tablet,
  familyShared: UsersRound, sharedTable: Armchair,
};

export default function SmartEntryPage() {
  const params = useParams<{ slug: string }>();
  // The neutral demo alias, not a real venue's slug: hardcoding "spice-garden" here
  // pinned every unresolved page to one live restaurant and put its slug in the URL.

  const slug = params.slug || DEMO_SLUG;
  const [, navigate] = useAppLocation();
  const { loading, offline, entry, joinShareCode, createFamilySession } = useSmartEntry(slug);
  const [redirecting, setRedirecting] = useState(false);
  const [shareInput, setShareInput] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [nfcMsg, setNfcMsg] = useState("");
  const [nfcSupported, setNfcSupported] = useState(false);

  useEffect(() => {
    setNfcSupported(typeof window !== "undefined" && "NDEFReader" in window);
  }, []);

  async function scanNfc() {
    if (!nfcSupported) {
      setNfcMsg("NFC not supported — use NFC tap link instead");
      return;
    }
    try {
      const NDEFReader = (window as unknown as { NDEFReader: new () => { scan: () => Promise<void>; onreading: ((e: { message: { records: { recordType: string; data: ArrayBuffer }[] } }) => void) | null } }).NDEFReader;
      const reader = new NDEFReader();
      setNfcMsg("Hold phone near NFC tag…");
      await reader.scan();
      reader.onreading = (event) => {
        const record = event.message.records[0];
        const text = record?.recordType === "text"
          ? new TextDecoder().decode(record.data)
          : "";
        setNfcMsg(`NFC detected: ${text || "tag read"}`);
        const qs = new URLSearchParams(window.location.search);
        qs.set("nfc", "1");
        qs.set("entry", "nfc");
        navigate(`/user/menu?slug=${slug}&${qs.toString()}`);
      };
    } catch {
      setNfcMsg("NFC scan cancelled or failed");
    }
  }

  useEffect(() => {
    if (loading || !entry || redirecting) return;
    const t = setTimeout(() => {
      setRedirecting(true);
      const qs = new URLSearchParams(window.location.search);
      if (!qs.has("slug")) qs.set("slug", slug);
      navigate(`/user/menu?${qs.toString()}`);
    }, 2800);
    return () => clearTimeout(t);
  }, [loading, entry, redirecting, navigate, slug]);

  async function handleJoinShare() {
    if (!shareInput.trim()) return;
    try {
      await joinShareCode(shareInput.trim());
      setShareMsg("Joined shared session");
    } catch {
      setShareMsg("Could not join that code");
    }
  }

  async function handleFamilySession() {
    try {
      await createFamilySession();
      setShareMsg("Family session created");
    } catch {
      setShareMsg("Could not create family session");
    }
  }

  if (loading) {
    return (
      <div className="guest-page thin-scroll min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Detecting venue context…</p>
      </div>
    );
  }

  const det = entry?.detection;
  const EntryIcon = det ? (ENTRY_ICONS[det.entryMethod] ?? QrCode) : QrCode;

  /**
   * The venue's own areas, as the server reports them.
   *
   * This block used to render ZONE_CATALOG — 23 fixed chips ("Sunset Lounge", "Couple
   * Cabin", "Live Music Zone") — under the heading "Operational Zones" on every venue's
   * entry screen, so a 20-cover cafe appeared to have a banquet section and a pool deck.
   * `GET /public/venue/:slug` already returns the areas the venue actually created,
   * grouped the same way, so the guest now sees only rooms that exist.
   */
  const areaGroups = (entry?.areaGroups ?? []).filter(g => g.areas.length > 0);

  return (
    <div className="guest-page thin-scroll min-h-screen">
      <div className="guest-header px-4 py-3">
        <GuestBackButton fallback="/" />
      </div>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-md bg-muted border border-border">
            <EntryIcon className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Smart Entry</h1>
          <p className="text-muted-foreground text-sm">
            {offline ? "Offline cached venue — " : ""}
            {det ? `${accessMethodLabel(det.entryMethod)} · ${serviceModeLabel(det.serviceMode)}` : "Connecting…"}
          </p>
          {redirecting && (
            <div className="flex items-center justify-center gap-2 text-success text-sm">
              <CheckCircle2 className="h-4 w-4" /> Opening menu…
            </div>
          )}
        </div>

        {/* Auto Detection */}
        {det && (
          <div className="guest-section-card space-y-3">
            <h2 className="guest-section-label">Auto detection</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { icon: MapPin, label: "Branch", value: det.branchName || "Auto-detected" },
                { icon: MapPin, label: "Table", value: entry?.params.table || "—" },
                { icon: Hotel, label: "Room", value: entry?.params.room || "—" },
                { icon: MapPin, label: "Section", value: entry?.params.section || "Auto" },
                { icon: Languages, label: "Language", value: det.language },
                { icon: Clock, label: "Timezone", value: det.timezone },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-2 bg-muted rounded-md px-3 py-2 min-w-0">
                  <row.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="text-2xs text-muted-foreground">{row.label}</div>
                    <div className="text-xs font-medium truncate">{row.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {nfcSupported && (
          <button onClick={scanNfc} className="guest-btn-secondary w-full py-3 text-sm">
            <Nfc className="h-5 w-5" /> Tap NFC tag to enter
          </button>
        )}
        {nfcMsg && <p className="text-xs text-center text-muted-foreground">{nfcMsg}</p>}

        {/* Access Methods */}
        <div className="guest-section-card">
          <h2 className="guest-section-label mb-3">Access methods</h2>
          <div className="grid grid-cols-2 gap-2">
            {ACCESS_METHODS.map(m => {
              const MethodIcon = ENTRY_ICONS[m.id] ?? QrCode;
              const active = det?.entryMethod === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(buildEntryUrl(slug, { entry: m.id, table: entry?.params.table }))}
                  className={`guest-card guest-card-interactive text-left p-3 text-xs min-h-[88px] ${active ? "ring-1 ring-primary" : ""}`}
                >
                  <MethodIcon className="h-4 w-4 text-primary" />
                  <div className="font-medium mt-1.5">{m.label}</div>
                  <div className="text-muted-foreground mt-0.5 leading-tight">{m.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* The venue's own areas */}
        {areaGroups.length > 0 && (
          <div className="guest-section-card space-y-4">
            <h2 className="guest-section-label flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5" /> Areas at this venue
            </h2>
            {areaGroups.map(group => (
              <div key={group.category}>
                <h3 className="text-sm font-medium mb-2">{group.label}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {group.areas.map(area => (
                    <span key={area.id} className="guest-pill text-2xs px-2 py-1">{area.name}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Session Features */}
        <div className="guest-section-card space-y-3">
          <h2 className="guest-section-label">Smart session</h2>
          <div className="flex flex-wrap gap-2">
            {SESSION_FEATURES.map(f => {
              const FeatureIcon = SESSION_ICONS[f.id] ?? Users;
              const on = entry?.session?.features?.[f.id];
              return (
                <span key={f.id} className={`guest-pill ${on ? "guest-pill-active" : ""}`}>
                  <FeatureIcon className="h-3.5 w-3.5" /> {f.label}
                </span>
              );
            })}
          </div>
          {entry?.session?.shareCode && (
            <div className="flex items-center justify-between bg-muted rounded-md px-4 py-3">
              <div>
                <div className="text-xs text-muted-foreground">Share code</div>
                <div className="font-mono font-semibold text-primary">{entry.session.shareCode}</div>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex gap-2">
            <label htmlFor="share-code" className="sr-only">Share code</label>
            <input
              id="share-code"
              value={shareInput}
              onChange={e => setShareInput(e.target.value.toUpperCase())}
              placeholder="Enter share code"
              className="guest-input flex-1"
            />
            <button onClick={handleJoinShare} className="guest-btn-primary px-5">Join</button>
          </div>
          <button onClick={handleFamilySession} className="guest-btn-secondary w-full py-2.5 text-sm">
            <Users className="h-4 w-4" /> Create family shared session
          </button>
          {shareMsg && <p className="text-xs text-center text-muted-foreground">{shareMsg}</p>}
        </div>

        {/* Quick links */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate(`/user/menu?slug=${slug}${entry?.params.table ? `&table=${entry.params.table}` : ""}`)}
            className="guest-btn-primary w-full py-3.5"
          >
            Continue to menu <ArrowRight className="h-4 w-4" />
          </button>
          {!isPwaInstalled() && (
            <p className="text-center text-2xs text-muted-foreground flex items-center justify-center gap-1">
              <Smartphone className="h-3 w-3" /> Add to home screen for app access
            </p>
          )}
          <button onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:text-foreground text-center flex items-center justify-center gap-1 min-h-11">
            <RefreshCw className="h-3 w-3" /> Back to home
          </button>
        </div>
      </div>
    </div>
  );
}

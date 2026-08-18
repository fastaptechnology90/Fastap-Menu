import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useSmartEntry } from "@/hooks/useSmartEntry";
import {
  ACCESS_METHODS, ZONE_CATALOG, SESSION_FEATURES,
  accessMethodLabel, serviceModeLabel, buildEntryUrl, isPwaInstalled,
} from "@/lib/smartEntry";
import {
  QrCode, Nfc, Globe, Link2, Smartphone, Hotel, Waves, Sparkles,
  PartyPopper, ParkingCircle, Loader2, CheckCircle2, ArrowRight,
  MapPin, Clock, Languages, Users, RefreshCw,
} from "lucide-react";
import { GuestBackButton } from "@/components/user/GuestUI";

const ENTRY_ICONS: Record<string, typeof QrCode> = {
  qr: QrCode, nfc: Nfc, browser: Globe, direct_url: Link2, pwa: Smartphone,
  room_qr: Hotel, poolside_qr: Waves, spa_qr: Sparkles, event_qr: PartyPopper, parking_qr: ParkingCircle,
};

export default function SmartEntryPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "spice-garden";
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
      setShareMsg("Joined shared session!");
    } catch {
      setShareMsg("Invalid share code");
    }
  }

  async function handleFamilySession() {
    try {
      const r = await createFamilySession(undefined, entry?.params.table);
      setShareMsg(`Family session created — code: ${r.shareCode}`);
    } catch {
      setShareMsg("Could not create family session");
    }
  }

  if (loading) {
    return (
      <div className="guest-page thin-scroll min-h-screen text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
        <p className="text-white/50 text-sm">Detecting venue context…</p>
      </div>
    );
  }

  const det = entry?.detection;
  const Icon = det ? (ENTRY_ICONS[det.entryMethod] ?? QrCode) : QrCode;

  return (
    <div className="guest-page thin-scroll min-h-screen text-white">
      <div className="guest-header px-4 py-3">
        <GuestBackButton fallback="/" />
      </div>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/20 border border-orange-500/30">
            <Icon className="h-8 w-8 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold">Smart Entry</h1>
          <p className="text-white/50 text-sm">
            {offline ? "Offline cached venue — " : ""}
            {det ? `${accessMethodLabel(det.entryMethod)} · ${serviceModeLabel(det.serviceMode)}` : "Connecting…"}
          </p>
          {redirecting && (
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
              <CheckCircle2 className="h-4 w-4" /> Opening menu…
            </div>
          )}
        </div>

        {/* Auto Detection */}
        {det && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Auto Detection</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { icon: MapPin, label: "Branch", value: det.branchName || "Auto-detected" },
                { icon: MapPin, label: "Table", value: entry?.params.table || "—" },
                { icon: Hotel, label: "Room", value: entry?.params.room || "—" },
                { icon: MapPin, label: "Section", value: entry?.params.section || "Auto" },
                { icon: Languages, label: "Language", value: det.language },
                { icon: Clock, label: "Timezone", value: det.timezone },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                  <row.icon className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-white/35">{row.label}</div>
                    <div className="text-xs font-medium truncate">{row.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {nfcSupported && (
          <button
            onClick={scanNfc}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/10 text-sm font-semibold text-emerald-300"
          >
            <Nfc className="h-5 w-5" /> Tap NFC Tag to Enter
          </button>
        )}
        {nfcMsg && <p className="text-xs text-center text-white/50">{nfcMsg}</p>}

        {/* Access Methods */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">Access Methods</h2>
          <div className="grid grid-cols-2 gap-2">
            {ACCESS_METHODS.map(m => (
              <button
                key={m.id}
                onClick={() => navigate(buildEntryUrl(slug, { entry: m.id, table: entry?.params.table }))}
                className={`text-left rounded-xl border p-3 transition-all text-xs ${det?.entryMethod === m.id ? "border-orange-500/50 bg-orange-500/10" : "border-white/8 hover:border-white/20"}`}
              >
                <span className="text-base">{m.icon}</span>
                <div className="font-semibold mt-1">{m.label}</div>
                <div className="text-white/40 mt-0.5 leading-tight">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Operational Zones */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Operational Zones</h2>
          {Object.entries(ZONE_CATALOG).map(([key, cat]) => (
            <div key={key}>
              <h3 className="text-sm font-semibold text-orange-300 mb-2">{cat.label}</h3>
              <div className="flex flex-wrap gap-1.5">
                {cat.zones.map(zone => (
                  <span key={zone} className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/60">
                    {zone}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Session Features */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Smart Session</h2>
          <div className="flex flex-wrap gap-2">
            {SESSION_FEATURES.map(f => (
              <span key={f.id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${entry?.session?.features?.[f.id] ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-white/40"}`}>
                {f.icon} {f.label}
              </span>
            ))}
          </div>
          {entry?.session?.shareCode && (
            <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
              <div>
                <div className="text-xs text-white/40">Share Code</div>
                <div className="font-mono font-bold text-orange-400">{entry.session.shareCode}</div>
              </div>
              <Users className="h-5 w-5 text-white/30" />
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={shareInput}
              onChange={e => setShareInput(e.target.value.toUpperCase())}
              placeholder="Enter share code"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={handleJoinShare} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-sm font-semibold">Join</button>
          </div>
          <button onClick={handleFamilySession} className="w-full py-2.5 rounded-xl border border-white/10 text-sm hover:bg-white/5 flex items-center justify-center gap-2">
            <Users className="h-4 w-4" /> Create Family Shared Session
          </button>
          {shareMsg && <p className="text-xs text-center text-orange-300">{shareMsg}</p>}
        </div>

        {/* Quick links */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate(`/user/menu?slug=${slug}${entry?.params.table ? `&table=${entry.params.table}` : ""}`)}
            className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 font-bold flex items-center justify-center gap-2"
          >
            Continue to Menu <ArrowRight className="h-4 w-4" />
          </button>
          {!isPwaInstalled() && (
            <p className="text-center text-[10px] text-white/30 flex items-center justify-center gap-1">
              <Smartphone className="h-3 w-3" /> Add to Home Screen for PWA access
            </p>
          )}
          <button onClick={() => navigate("/")} className="text-xs text-white/30 hover:text-white/60 text-center flex items-center justify-center gap-1">
            <RefreshCw className="h-3 w-3" /> Back to home
          </button>
        </div>
      </div>
    </div>
  );
}

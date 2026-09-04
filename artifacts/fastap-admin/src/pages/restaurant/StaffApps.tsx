import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Smartphone, Download, ChefHat, ConciergeBell, BedDouble, Copy, Check,
  ShieldCheck, RefreshCw, Info, PackageOpen,
} from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { staffAppsApi, type StaffAppEntry } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const APP_ICON: Record<string, typeof ChefHat> = {
  kitchen: ChefHat,
  waiter: ConciergeBell,
  housekeeping: BedDouble,
};

// Each app gets its own colour so staff can tell the three cards apart at a glance.
const APP_STYLE: Record<string, { ring: string; chip: string; glow: string; btn: string }> = {
  kitchen: {
    ring: "border-orange-500/30",
    chip: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    glow: "from-orange-500/20",
    btn: "bg-orange-500 hover:bg-orange-600 text-white",
  },
  waiter: {
    ring: "border-blue-500/30",
    chip: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    glow: "from-blue-500/20",
    btn: "bg-blue-500 hover:bg-blue-600 text-white",
  },
  housekeeping: {
    ring: "border-emerald-500/30",
    chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    glow: "from-emerald-500/20",
    btn: "bg-emerald-500 hover:bg-emerald-600 text-white",
  },
};

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const INSTALL_STEPS = [
  "Phone se neeche wala QR code scan kijiye (ya link bhej dijiye).",
  "APK file download hone dijiye — Chrome \"file harmful ho sakti hai\" pooche to Download anyway dabaiye.",
  "Download par tap kijiye. Android \"unknown apps install\" ki permission maange to Settings me jaakar Allow kar dijiye.",
  "Install ke baad app khol kar staff ke email aur password se login kijiye.",
];

export default function StaffApps() {
  const { restaurantId } = useRestaurant();
  const [apps, setApps] = useState<StaffAppEntry[]>([]);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!restaurantId) return;
    if (!silent) setLoading(true);
    try {
      const res = await staffAppsApi.list(restaurantId);
      setApps(res.apps ?? []);
    } catch {
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  // The QR has to carry the full public URL — a staff phone is not on this page's origin.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const app of apps) {
        if (!app.available || !app.downloadPath) continue;
        try {
          next[app.appKey] = await QRCode.toDataURL(window.location.origin + app.downloadPath, {
            width: 320, margin: 1, color: { dark: "#0f172a", light: "#ffffff" },
          });
        } catch { /* a missing QR just hides the image, the button still works */ }
      }
      if (!cancelled) setQr(next);
    })();
    return () => { cancelled = true; };
  }, [apps]);

  async function copyLink(app: StaffAppEntry) {
    const url = window.location.origin + (app.downloadPath ?? "");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(app.appKey);
      setTimeout(() => setCopied(c => (c === app.appKey ? null : c)), 1800);
      toast({ title: "Link copy ho gaya", description: "Staff ko WhatsApp par bhej dijiye" });
    } catch {
      toast({ title: "Copy nahi hua", description: url, variant: "destructive" });
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">Staff Apps</h1>
            <p className="text-sm text-white/50 mt-0.5 max-w-xl">
              Apne staff ke phone me ye apps install karwaiye. QR scan kijiye ya link bhej dijiye — Play Store ki zaroorat nahi.
            </p>
          </div>
        </div>
        <button onClick={() => load()} className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map(i => <div key={i} className="h-72 rounded-2xl border border-white/10 bg-white/[0.02] animate-pulse" />)}
        </div>
      ) : apps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
          <PackageOpen className="mx-auto h-10 w-10 text-white/25" />
          <h3 className="mt-3 font-bold">Abhi koi app available nahi hai</h3>
          <p className="text-sm text-white/45 mt-1">
            Fastap team ne aapke restaurant ke liye abhi koi staff app enable nahi ki. Support se baat kijiye.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {apps.map(app => {
            const Icon = APP_ICON[app.appKey] ?? Smartphone;
            const style = APP_STYLE[app.appKey] ?? APP_STYLE.kitchen!;
            const url = window.location.origin + (app.downloadPath ?? "");
            return (
              <div key={app.appKey} className={`relative overflow-hidden rounded-2xl border ${style.ring} bg-white/[0.02]`}>
                <div className={`absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${style.glow} to-transparent blur-2xl pointer-events-none`} />

                <div className="relative p-5">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${style.chip}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold truncate">{app.name}</h3>
                      <p className="text-xs text-white/45 mt-0.5">{app.role}</p>
                    </div>
                  </div>

                  <p className="text-sm text-white/60 mt-3">{app.tagline}</p>

                  {app.available ? (
                    <>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${style.chip}`}>v{app.version}</span>
                        {app.fileSize ? <span className="text-[11px] text-white/40">{formatSize(app.fileSize)}</span> : null}
                        {app.publishedAt ? (
                          <span className="text-[11px] text-white/40">· {new Date(app.publishedAt).toLocaleDateString()}</span>
                        ) : null}
                      </div>

                      {app.changelog ? (
                        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide">Kya naya hai</p>
                          <p className="text-xs text-white/70 mt-1 whitespace-pre-line">{app.changelog}</p>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        {qr[app.appKey] ? (
                          <img src={qr[app.appKey]} alt={`${app.name} download QR`} className="h-36 w-36 rounded-lg" />
                        ) : (
                          <div className="h-36 w-36 rounded-lg bg-white/5 animate-pulse" />
                        )}
                        <p className="text-[11px] text-white/45 text-center">Staff ke phone se scan kijiye</p>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <a href={url} download
                          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${style.btn}`}>
                          <Download className="h-4 w-4" /> Download APK
                        </a>
                        <button onClick={() => copyLink(app)} title="Link copy karein"
                          className="rounded-xl border border-white/10 p-2.5 hover:bg-white/5">
                          {copied === app.appKey ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-white/15 p-6 text-center">
                      <p className="text-sm font-semibold text-white/60">Jaldi aa rahi hai</p>
                      <p className="text-xs text-white/40 mt-1">Is app ki koi version abhi publish nahi hui.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-sm">Install kaise karein</h3>
          </div>
          <ol className="mt-3 space-y-2">
            {INSTALL_STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-white/65">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[11px] font-bold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h3 className="font-bold text-sm">Dhyan dene wali baatein</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-white/65">
            <li>• Ye apps sirf Android par chalti hain. iPhone ke liye staff browser me panel khol sakta hai.</li>
            <li>• Har staff apne hi email-password se login karega — ek hi account sab ke saath share mat kijiye.</li>
            <li>• Nayi version aane par yahi page apne aap update ho jayega; staff ko sirf dobara download karna hoga.</li>
            <li>• Download link kisi bahar wale ko mat bhejiye — app aapke restaurant ke live orders dikhati hai.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Smartphone, Download, ChefHat, ConciergeBell, BedDouble, Copy, Check,
  ShieldCheck, RefreshCw, Info, PackageOpen, History, Store } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { staffAppsApi, type StaffAppEntry, type StaffAppDownload } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const APP_ICON: Record<string, typeof ChefHat> = {
  kitchen: ChefHat,
  waiter: ConciergeBell,
  housekeeping: BedDouble,
};

// Each app gets its own colour so staff can tell the three cards apart at a glance.
const APP_STYLE: Record<string, { ring: string; chip: string; btn: string }> = {
  kitchen: {
    ring: "border-warning-border",
    chip: "bg-warning-subtle text-warning border-warning-border",
    btn: "bg-warning hover:bg-warning/90 text-background",
  },
  waiter: {
    ring: "border-info-border",
    chip: "bg-info-subtle text-info border-info-border",
    btn: "bg-info hover:bg-info/90 text-background",
  },
  housekeeping: {
    ring: "border-success-border",
    chip: "bg-success-subtle text-success border-success-border",
    btn: "bg-success hover:bg-success/90 text-background",
  },
};

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const INSTALL_STEPS = [
  "Scan the QR code below with the staff member's phone, or send them the link.",
  "Let the APK finish downloading. If Chrome warns that the file may be harmful, choose Download anyway.",
  "Tap the download. If Android asks for permission to install unknown apps, open Settings and allow it.",
  "Open the app and sign in with that staff member's email and password.",
];

export default function StaffApps() {
  const { restaurantId } = useRestaurant();
  const [apps, setApps] = useState<StaffAppEntry[]>([]);
  const [qr, setQr] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloads, setDownloads] = useState<StaffAppDownload[]>([]);
  const [downloadsError, setDownloadsError] = useState<string | null>(null);

  const loadDownloads = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await staffAppsApi.downloads(restaurantId);
      setDownloads(res.downloads ?? []);
      setDownloadsError(null);
    } catch (e) {
      // Nobody having installed anything and the log being unreachable are different
      // answers, and only one of them means "chase your team".
      setDownloadsError(e instanceof Error ? e.message : "Could not reach the server.");
    }
  }, [restaurantId]);

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
    loadDownloads();
  }, [restaurantId, loadDownloads]);

  useEffect(() => { load(); }, [load]);

  /** Which build each app is on here, so an owner can see who is still behind. */
  const latestPerApp = downloads.reduce<Record<string, StaffAppDownload>>((acc, d) => {
    if (!acc[d.appKey]) acc[d.appKey] = d;
    return acc;
  }, {});

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
      toast({ title: "Link copied", description: "Send it to your staff on WhatsApp" });
    } catch {
      toast({ title: "Could not copy", description: url, variant: "destructive" });
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Staff Apps</h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
              Install these apps on your staff phones. Scan the QR code or send the link — no Play Store needed.
            </p>
          </div>
        </div>
        <button onClick={() => load()} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map(i => <div key={i} className="h-72 rounded-lg border border-border bg-card animate-pulse" />)}
        </div>
      ) : apps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <PackageOpen className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 font-semibold">No apps available yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The Fastap team has not enabled any staff app for your restaurant yet. Please contact support.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {apps.map(app => {
            const Icon = APP_ICON[app.appKey] ?? Smartphone;
            const style = APP_STYLE[app.appKey] ?? APP_STYLE.kitchen!;
            const url = window.location.origin + (app.downloadPath ?? "");
            return (
              <div key={app.appKey} className={`relative overflow-hidden rounded-lg border ${style.ring} bg-card`}>
                <div className="relative p-5">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${style.chip}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{app.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{app.role}</p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mt-3">{app.tagline}</p>

                  {app.available ? (
                    <>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className={`text-2xs font-semibold px-2 py-1 rounded-lg border ${style.chip}`}>v{app.version}</span>
                        {app.fileSize ? <span className="text-2xs text-muted-foreground">{formatSize(app.fileSize)}</span> : null}
                        {app.publishedAt ? (
                          <span className="text-2xs text-muted-foreground">· {new Date(app.publishedAt).toLocaleDateString()}</span>
                        ) : null}
                      </div>

                      {app.changelog ? (
                        <div className="mt-3 rounded-lg border border-border bg-card p-3">
                          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wide">What's new</p>
                          <p className="text-xs text-foreground mt-1 whitespace-pre-line">{app.changelog}</p>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-4">
                        {qr[app.appKey] ? (
                          <img src={qr[app.appKey]} alt={`${app.name} download QR`} className="h-36 w-36 rounded-lg" />
                        ) : (
                          <div className="h-36 w-36 rounded-lg bg-muted animate-pulse" />
                        )}
                        <p className="text-2xs text-muted-foreground text-center">Scan with the staff phone</p>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <a href={url} download
                          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${style.btn}`}>
                          <Download className="h-4 w-4" /> Download APK
                        </a>
                        <button onClick={() => copyLink(app)} title="Copy download link"
                          className="rounded-lg border border-border p-2.5 hover:bg-muted">
                          {copied === app.appKey ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center">
                      <p className="text-sm font-semibold text-muted-foreground">Coming soon</p>
                      <p className="text-xs text-muted-foreground mt-1">No version of this app has been published yet.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Who on this team is actually running the apps ── */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Installed by your team</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(latestPerApp).map(([appKey, d]) => (
              <span key={appKey} className="rounded-lg border border-border bg-muted px-2 py-1 text-2xs text-muted-foreground">
                <span className="capitalize">{appKey}</span> on <span className="font-semibold text-foreground">v{d.version ?? "?"}</span>
              </span>
            ))}
            <button onClick={loadDownloads} className="rounded-lg border border-border px-2.5 py-1 text-2xs font-semibold hover:bg-muted">
              Refresh
            </button>
          </div>
        </div>

        {downloadsError ? (
          <div role="alert" className="flex items-center justify-between gap-3 p-5">
            <p className="text-sm text-danger">
              We could not read the install history. <span className="text-danger">{downloadsError}</span>
            </p>
            <button onClick={loadDownloads} className="shrink-0 rounded-lg bg-danger-subtle px-3 py-1.5 text-xs font-semibold text-danger">
              Try again
            </button>
          </div>
        ) : downloads.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            Nobody has installed an app yet. Send a staff member the link or QR above and this fills in.
          </p>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-xs text-muted-foreground">
                  {["App", "Version", "Staff member", "When"].map(h => (
                    <th key={h} className="px-5 py-2.5 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {downloads.map(d => (
                  <tr key={d.id} className="hover:bg-card">
                    <td className="px-5 py-2.5 capitalize">{d.appKey}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-foreground">{d.version ? `v${d.version}` : "—"}</td>
                    <td className="px-5 py-2.5">{d.staffName ?? <span className="text-muted-foreground">Shared link</span>}</td>
                    <td className="px-5 py-2.5 text-xs text-muted-foreground">{new Date(d.downloadedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">How to install</h3>
          </div>
          <ol className="mt-3 space-y-2">
            {INSTALL_STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-foreground">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-2xs font-semibold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <h3 className="font-semibold text-sm">Good to know</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            <li>• These apps run on Android only. On iPhone, staff can open the panel in a browser instead.</li>
            <li>• Each staff member signs in with their own email and password — never share one account.</li>
            <li>• When a new version is released this page updates on its own — staff just download it again.</li>
            <li>• Do not share the download link outside your team — the app shows your live orders.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

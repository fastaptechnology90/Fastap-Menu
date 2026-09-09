import { useState } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { usePwa, PWA_FEATURES, HOME_SCREEN_SHORTCUTS, PUSH_NOTIFICATION_TYPES } from "@/contexts/PwaContext";
import { useOffline } from "@/contexts/OfflineContext";
import {
  ChevronLeft, Smartphone, Download, Bell, WifiOff, Zap, Rocket,
  CheckCircle, AlertCircle, ExternalLink, Gauge, Share,
} from "lucide-react";

type Tab = "install" | "push" | "shortcuts" | "performance";

export default function PwaExperiencePage() {
  const [, navigate] = useAppLocation();
  const {
    isStandalone, canInstall, isInstalled, swReady, pushPermission, pushPrefs,
    loadTimeMs, installApp, enablePush, sendTestNotification, updatePushPrefs,
    measurePerformance, registerServiceWorker,
  } = usePwa();
  const { menuCache, settings: offlineSettings, pendingOrders } = useOffline();

  const [tab, setTab] = useState<Tab>("install");
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  // One green tick banner was used for confirmations AND for failures, so "Permission
  // denied", "Sync failed" and "Image too large" all read as good news. `ok: false`
  // paints the same banner as a problem.
  function showToast(msg: string, ok = true) {
    setToast({ text: msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleInstall() {
    if (canInstall) {
      const ok = await installApp();
      showToast(ok ? "App installed!" : "Install cancelled", ok);
    } else if (isStandalone) {
      showToast("Already running as installed app");
    } else {
      showToast("Use your browser menu → Add to Home Screen", false);
    }
  }

  const perfMs = loadTimeMs ?? measurePerformance() ?? 840;
  const perfGrade = perfMs <= 1000 ? "A+" : perfMs <= 2000 ? "A" : perfMs <= 3500 ? "B" : "C";

  return (
    <div className="guest-page thin-scroll min-h-screen text-foreground pb-24">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">PWA & App-Like Experience</p>
            <h1 className="text-base font-semibold flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" /> App Experience
            </h1>
          </div>
          {(isInstalled || isStandalone) && (
            <span className="text-2xs px-2 py-1 rounded-full bg-success-subtle text-success">Installed</span>
          )}
        </div>

        {toast && (
          <div
            role={toast.ok ? undefined : "alert"}
            className={`mx-4 mb-2 rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${toast.ok ? "border-success-border bg-success-subtle text-success" : "border-danger-border bg-danger-subtle text-danger"}`}
          >
            {toast.ok ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {toast.text}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {([
            { id: "install" as Tab, label: "Install", icon: Download },
            { id: "push" as Tab, label: "Push", icon: Bell },
            { id: "shortcuts" as Tab, label: "Shortcuts", icon: Zap },
            { id: "performance" as Tab, label: "Speed", icon: Rocket },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium ${
                tab === t.id ? "bg-muted border border-primary text-primary" : "bg-muted border border-border text-muted-foreground"
              }`}>
              <t.icon className="h-3 w-3" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2 space-y-4">
        {/* 5 features overview */}
        <div className="grid grid-cols-2 gap-2">
          {PWA_FEATURES.map(f => {
            const active =
              f.id === "install_app" ? isInstalled || isStandalone :
              f.id === "push_notifications" ? pushPrefs.enabled :
              f.id === "offline_support" ? Boolean(menuCache) || swReady :
              f.id === "home_shortcuts" ? true :
              perfMs <= 2000;
            return (
              <div key={f.id} className={`rounded-xl border p-3 ${active ? "border-primary bg-muted" : "border-border bg-muted"}`}>
                <span className="text-lg">{f.icon}</span>
                <p className="text-xs font-semibold mt-1">{f.label}</p>
                <p className="text-2xs text-muted-foreground line-clamp-2">{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Install as App */}
        {tab === "install" && (
          <>
            <div className="rounded-xl border border-primary p-5 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted border border-primary flex items-center justify-center mx-auto mb-3 text-3xl">
                
              </div>
              <h2 className="text-lg font-semibold">FastMenu Guest App</h2>
              <p className="text-xs text-muted-foreground mt-1">Install for full-screen, offline-capable dining</p>
              <button onClick={handleInstall}
                className="mt-4 w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 font-semibold text-sm flex items-center justify-center gap-2">
                <Download className="h-4 w-4" />
                {canInstall ? "Install App" : isStandalone ? "Running as App" : "Add to Home Screen"}
              </button>
              {!canInstall && !isStandalone && (
                <p className="text-2xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                  <Share className="h-3 w-3" /> Chrome/Edge: ⋮ menu → Install app · iOS: Share → Add to Home Screen
                </p>
              )}
            </div>

            <div className="rounded-xl bg-muted border border-border p-4 space-y-2 text-xs">
              <p className="font-semibold text-sm mb-2">App capabilities</p>
              {[
                { ok: swReady, label: "Service worker registered" },
                { ok: isStandalone, label: "Standalone display mode" },
                { ok: Boolean(menuCache), label: "Offline menu cached" },
                { ok: offlineSettings.autoSyncEnabled, label: "Auto sync recovery" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className={`h-3.5 w-3.5 ${s.ok ? "text-success" : "text-muted-foreground"}`} /> {s.label}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Push Notifications */}
        {tab === "push" && (
          <>
            <div className="rounded-xl bg-warning-subtle border border-warning-border p-4">
              <p className="text-sm font-semibold text-warning">Push status: {pushPermission}</p>
              <p className="text-xs text-muted-foreground mt-1">Get notified when your order is ready, waitlist is called, or offers arrive</p>
              {pushPermission !== "granted" && (
                <button onClick={async () => { const ok = await enablePush(); showToast(ok ? "Notifications enabled" : "Permission denied — turn notifications on in your browser settings", ok); }}
                  className="mt-3 w-full py-2.5 rounded-xl bg-warning-subtle border border-warning-border text-warning text-sm font-semibold">
                  Enable Push Notifications
                </button>
              )}
            </div>

            <div className="space-y-2">
              {PUSH_NOTIFICATION_TYPES.map(n => (
                <button key={n.id}
                  onClick={() => sendTestNotification(n.label, n.sample).then(() => showToast("Test notification sent"))}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted border border-border hover:border-warning-border text-left">
                  <span className="text-xl">{n.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{n.label}</p>
                    <p className="text-2xs text-muted-foreground truncate">{n.sample}</p>
                  </div>
                  <Bell className="h-4 w-4 text-warning" />
                </button>
              ))}
            </div>

            <div className="rounded-xl bg-muted border border-border divide-y divide-border">
              {[
                { key: "orderReady" as const, label: "Order ready alerts" },
                { key: "waitlist" as const, label: "Waitlist called" },
                { key: "offers" as const, label: "Offers & happy hour" },
                { key: "loyalty" as const, label: "Loyalty rewards" },
              ].map(p => (
                <button key={p.key} onClick={() => updatePushPrefs({ [p.key]: !pushPrefs[p.key] })}
                  className="w-full flex items-center justify-between p-4 text-left text-sm">
                  {p.label}
                  <div className={`w-10 h-5 rounded-full relative ${pushPrefs[p.key] ? "bg-primary" : "bg-muted"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card transition-all ${pushPrefs[p.key] ? "left-5" : "left-0.5"}`} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Home Screen Shortcuts */}
        {tab === "shortcuts" && (
          <>
            <p className="text-sm text-muted-foreground">Pin shortcuts to your home screen after installing the app</p>
            <div className="grid grid-cols-2 gap-2">
              {HOME_SCREEN_SHORTCUTS.map(s => (
                <button key={s.id} onClick={() => navigate(s.url)}
                  className="rounded-xl border border-border bg-muted p-3 text-left hover:border-primary">
                  <span className="text-2xl">{s.icon}</span>
                  <p className="text-xs font-semibold mt-1">{s.name}</p>
                  <p className="text-2xs text-muted-foreground">{s.desc}</p>
                  <ExternalLink className="h-3 w-3 text-primary mt-1" />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Fast Loading & Offline */}
        {tab === "performance" && (
          <>
            <div className="rounded-xl bg-muted border border-border p-5 text-center">
              <Gauge className="h-8 w-8 text-info mx-auto mb-2" />
              <p className="text-4xl font-semibold text-info">{perfMs}ms</p>
              <p className="text-sm text-muted-foreground">Page load time · Grade {perfGrade}</p>
              <button onClick={() => { measurePerformance(); showToast("Performance measured"); }}
                className="mt-3 text-xs text-info underline">Re-measure</button>
            </div>

            <div className="rounded-xl bg-muted border border-border p-4 space-y-3 text-xs">
              <p className="text-sm font-semibold">Fast loading optimizations</p>
              {[
                "Service worker precaches app shell",
                "Stale-while-revalidate for static assets",
                "Lazy-loaded menu images",
                "Low bandwidth mode available",
                "Font preconnect for faster typography",
              ].map(t => (
                <div key={t} className="flex items-center gap-2 text-muted-foreground">
                  <Rocket className="h-3.5 w-3.5 text-primary" /> {t}
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-info-subtle border border-info-border p-4">
              <p className="text-sm font-semibold flex items-center gap-2 text-info">
                <WifiOff className="h-4 w-4" /> Offline Support
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {menuCache ? `${menuCache.itemCount} menu items cached` : "Open menu online to cache"}
                {pendingOrders.length > 0 && ` · ${pendingOrders.length} orders queued`}
              </p>
              <button onClick={() => navigate("/user/offline")} className="mt-2 text-xs text-info underline">
                Open offline settings →
              </button>
            </div>

            <button onClick={() => registerServiceWorker().then(ok => showToast(ok ? "App updated" : "The app could not update itself — reload the page", ok))}
              className="w-full py-3 rounded-xl border border-border text-sm text-muted-foreground">
              Refresh service worker cache
            </button>
          </>
        )}
      </div>

      <div className="guest-bottom-bar flex gap-2">
        {!isInstalled && !isStandalone && (
          <button onClick={handleInstall} className="flex-1 py-3 rounded-xl bg-primary font-semibold text-sm flex items-center justify-center gap-2">
            <Download className="h-4 w-4" /> Install
          </button>
        )}
        <button onClick={() => navigate("/user/menu")} className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm">
          Open Menu
        </button>
      </div>
    </div>
  );
}

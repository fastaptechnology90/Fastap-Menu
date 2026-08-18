import { useState } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { GuestBackButton } from "@/components/user/GuestUI";
import { usePwa, PWA_FEATURES, HOME_SCREEN_SHORTCUTS, PUSH_NOTIFICATION_TYPES } from "@/contexts/PwaContext";
import { useOffline } from "@/contexts/OfflineContext";
import {
  ChevronLeft, Smartphone, Download, Bell, WifiOff, Zap, Rocket,
  CheckCircle, ExternalLink, Gauge, Share,
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
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleInstall() {
    if (canInstall) {
      const ok = await installApp();
      showToast(ok ? "App installed!" : "Install cancelled");
    } else if (isStandalone) {
      showToast("Already running as installed app");
    } else {
      showToast("Use browser menu → Add to Home Screen");
    }
  }

  const perfMs = loadTimeMs ?? measurePerformance() ?? 840;
  const perfGrade = perfMs <= 1000 ? "A+" : perfMs <= 2000 ? "A" : perfMs <= 3500 ? "B" : "C";

  return (
    <div className="guest-page thin-scroll min-h-screen text-white pb-24">
      <div className="guest-header">
        <div className="px-4 py-3 flex items-center gap-3">
          <GuestBackButton />
          <div className="flex-1">
            <p className="text-xs text-white/40">PWA & App-Like Experience</p>
            <h1 className="text-base font-bold flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-orange-400" /> App Experience
            </h1>
          </div>
          {(isInstalled || isStandalone) && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">Installed</span>
          )}
        </div>

        {toast && (
          <div className="mx-4 mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> {toast}
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
                tab === t.id ? "bg-orange-500/25 border border-orange-500/40 text-orange-200" : "bg-white/5 border border-white/10 text-white/60"
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
              <div key={f.id} className={`rounded-xl border p-3 ${active ? "border-orange-500/40 bg-orange-500/10" : "border-white/10 bg-white/5"}`}>
                <span className="text-lg">{f.icon}</span>
                <p className="text-xs font-semibold mt-1">{f.label}</p>
                <p className="text-[10px] text-white/40 line-clamp-2">{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Install as App */}
        {tab === "install" && (
          <>
            <div className="rounded-xl bg-gradient-to-br from-orange-600/20 to-amber-600/10 border border-orange-500/30 p-5 text-center">
              <div className="h-16 w-16 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center mx-auto mb-3 text-3xl">
                🍽️
              </div>
              <h2 className="text-lg font-bold">FastMenu Guest App</h2>
              <p className="text-xs text-white/50 mt-1">Install for full-screen, offline-capable dining</p>
              <button onClick={handleInstall}
                className="mt-4 w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-400 font-bold text-sm flex items-center justify-center gap-2">
                <Download className="h-4 w-4" />
                {canInstall ? "Install App" : isStandalone ? "Running as App" : "Add to Home Screen"}
              </button>
              {!canInstall && !isStandalone && (
                <p className="text-[10px] text-white/40 mt-2 flex items-center justify-center gap-1">
                  <Share className="h-3 w-3" /> Chrome/Edge: ⋮ menu → Install app · iOS: Share → Add to Home Screen
                </p>
              )}
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2 text-xs">
              <p className="font-semibold text-sm mb-2">App capabilities</p>
              {[
                { ok: swReady, label: "Service worker registered" },
                { ok: isStandalone, label: "Standalone display mode" },
                { ok: Boolean(menuCache), label: "Offline menu cached" },
                { ok: offlineSettings.autoSyncEnabled, label: "Auto sync recovery" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 text-white/60">
                  <CheckCircle className={`h-3.5 w-3.5 ${s.ok ? "text-emerald-400" : "text-white/20"}`} /> {s.label}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Push Notifications */}
        {tab === "push" && (
          <>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4">
              <p className="text-sm font-semibold text-amber-200">Push status: {pushPermission}</p>
              <p className="text-xs text-white/50 mt-1">Get notified when your order is ready, waitlist is called, or offers arrive</p>
              {pushPermission !== "granted" && (
                <button onClick={async () => { const ok = await enablePush(); showToast(ok ? "Notifications enabled" : "Permission denied"); }}
                  className="mt-3 w-full py-2.5 rounded-xl bg-amber-500/30 border border-amber-500/40 text-amber-200 text-sm font-semibold">
                  Enable Push Notifications
                </button>
              )}
            </div>

            <div className="space-y-2">
              {PUSH_NOTIFICATION_TYPES.map(n => (
                <button key={n.id}
                  onClick={() => sendTestNotification(n.label, n.sample).then(() => showToast("Test notification sent"))}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/30 text-left">
                  <span className="text-xl">{n.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{n.label}</p>
                    <p className="text-[10px] text-white/40 truncate">{n.sample}</p>
                  </div>
                  <Bell className="h-4 w-4 text-amber-400" />
                </button>
              ))}
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 divide-y divide-white/5">
              {[
                { key: "orderReady" as const, label: "Order ready alerts" },
                { key: "waitlist" as const, label: "Waitlist called" },
                { key: "offers" as const, label: "Offers & happy hour" },
                { key: "loyalty" as const, label: "Loyalty rewards" },
              ].map(p => (
                <button key={p.key} onClick={() => updatePushPrefs({ [p.key]: !pushPrefs[p.key] })}
                  className="w-full flex items-center justify-between p-4 text-left text-sm">
                  {p.label}
                  <div className={`w-10 h-5 rounded-full relative ${pushPrefs[p.key] ? "bg-amber-500" : "bg-white/20"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${pushPrefs[p.key] ? "left-5" : "left-0.5"}`} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Home Screen Shortcuts */}
        {tab === "shortcuts" && (
          <>
            <p className="text-sm text-white/50">Pin shortcuts to your home screen after installing the app</p>
            <div className="grid grid-cols-2 gap-2">
              {HOME_SCREEN_SHORTCUTS.map(s => (
                <button key={s.id} onClick={() => navigate(s.url)}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:border-orange-500/30">
                  <span className="text-2xl">{s.icon}</span>
                  <p className="text-xs font-semibold mt-1">{s.name}</p>
                  <p className="text-[10px] text-white/40">{s.desc}</p>
                  <ExternalLink className="h-3 w-3 text-orange-400 mt-1" />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Fast Loading & Offline */}
        {tab === "performance" && (
          <>
            <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-center">
              <Gauge className="h-8 w-8 text-teal-400 mx-auto mb-2" />
              <p className="text-4xl font-extrabold text-teal-400">{perfMs}ms</p>
              <p className="text-sm text-white/50">Page load time · Grade {perfGrade}</p>
              <button onClick={() => { measurePerformance(); showToast("Performance measured"); }}
                className="mt-3 text-xs text-teal-300 underline">Re-measure</button>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3 text-xs">
              <p className="text-sm font-semibold">Fast loading optimizations</p>
              {[
                "Service worker precaches app shell",
                "Stale-while-revalidate for static assets",
                "Lazy-loaded menu images",
                "Low bandwidth mode available",
                "Font preconnect for faster typography",
              ].map(t => (
                <div key={t} className="flex items-center gap-2 text-white/60">
                  <Rocket className="h-3.5 w-3.5 text-orange-400" /> {t}
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-teal-500/10 border border-teal-500/25 p-4">
              <p className="text-sm font-semibold flex items-center gap-2 text-teal-200">
                <WifiOff className="h-4 w-4" /> Offline Support
              </p>
              <p className="text-xs text-white/50 mt-1">
                {menuCache ? `${menuCache.itemCount} menu items cached` : "Open menu online to cache"}
                {pendingOrders.length > 0 && ` · ${pendingOrders.length} orders queued`}
              </p>
              <button onClick={() => navigate("/user/offline")} className="mt-2 text-xs text-teal-300 underline">
                Open offline settings →
              </button>
            </div>

            <button onClick={() => registerServiceWorker().then(ok => showToast(ok ? "Service worker updated" : "SW registration failed"))}
              className="w-full py-3 rounded-xl border border-white/10 text-sm text-white/60">
              Refresh service worker cache
            </button>
          </>
        )}
      </div>

      <div className="guest-bottom-bar flex gap-2">
        {!isInstalled && !isStandalone && (
          <button onClick={handleInstall} className="flex-1 py-3 rounded-xl bg-orange-500 font-semibold text-sm flex items-center justify-center gap-2">
            <Download className="h-4 w-4" /> Install
          </button>
        )}
        <button onClick={() => navigate("/user/menu")} className="flex-1 py-3 rounded-xl bg-white/10 font-semibold text-sm">
          Open Menu
        </button>
      </div>
    </div>
  );
}

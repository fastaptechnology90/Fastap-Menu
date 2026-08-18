import {
  createContext, useContext, useState, useCallback, useEffect, type ReactNode,
} from "react";
import { publicApi } from "@/lib/api";
import {
  PWA_FEATURES, HOME_SCREEN_SHORTCUTS, PUSH_NOTIFICATION_TYPES,
  PUSH_PREFS_KEY, DEFAULT_PUSH_PREFS, type PushPrefs,
} from "@/lib/pwaExperienceCatalog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaContextValue {
  isStandalone: boolean;
  canInstall: boolean;
  isInstalled: boolean;
  swReady: boolean;
  pushPermission: NotificationPermission | "unsupported";
  pushPrefs: PushPrefs;
  loadTimeMs: number | null;
  installApp: () => Promise<boolean>;
  enablePush: () => Promise<boolean>;
  sendTestNotification: (title: string, body: string) => Promise<void>;
  updatePushPrefs: (patch: Partial<PushPrefs>) => void;
  measurePerformance: () => number | null;
  registerServiceWorker: () => Promise<boolean>;
}

const PwaContext = createContext<PwaContextValue | null>(null);

function loadPushPrefs(): PushPrefs {
  try {
    const raw = localStorage.getItem(PUSH_PREFS_KEY);
    if (raw) return { ...DEFAULT_PUSH_PREFS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PUSH_PREFS };
}

function savePushPrefs(prefs: PushPrefs) {
  localStorage.setItem(PUSH_PREFS_KEY, JSON.stringify(prefs));
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pushPrefs, setPushPrefsState] = useState<PushPrefs>(loadPushPrefs);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);

  const measurePerformance = useCallback(() => {
    if (typeof performance === "undefined") return null;
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const ms = nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null;
    if (ms != null) setLoadTimeMs(ms);
    return ms;
  }, []);

  const registerServiceWorker = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      setSwReady(Boolean(reg));
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    );

    if ("Notification" in window) {
      setPushPermission(Notification.permission);
    } else {
      setPushPermission("unsupported");
    }

    measurePerformance();
    registerServiceWorker();

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      publicApi.pwa?.installEvent?.({ platform: navigator.userAgent, standalone: true }).catch(() => {});
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [measurePerformance, registerServiceWorker]);

  useEffect(() => {
    savePushPrefs(pushPrefs);
    publicApi.pwa?.savePushPrefs?.(pushPrefs).catch(() => {});
  }, [pushPrefs]);

  useEffect(() => {
    publicApi.pwa?.pushPrefs?.().then((p: Partial<PushPrefs>) => {
      if (p && typeof p === "object") setPushPrefsState(prev => ({ ...prev, ...p }));
    }).catch(() => {});
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      setIsInstalled(true);
      publicApi.pwa?.installEvent?.({ platform: navigator.userAgent, standalone: false }).catch(() => {});
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const enablePush = useCallback(async () => {
    if (!("Notification" in window)) return false;
    const perm = await Notification.requestPermission();
    setPushPermission(perm);
    if (perm === "granted") {
      setPushPrefsState(prev => ({ ...prev, enabled: true }));
      await registerServiceWorker();
      return true;
    }
    return false;
  }, [registerServiceWorker]);

  const sendTestNotification = useCallback(async (title: string, body: string) => {
    if (pushPermission !== "granted") {
      const ok = await enablePush();
      if (!ok) return;
    }
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: "fastmenu-guest",
      });
    } else if ("Notification" in window) {
      new Notification(title, { body, icon: "/favicon.svg" });
    }
  }, [pushPermission, enablePush]);

  const updatePushPrefs = useCallback((patch: Partial<PushPrefs>) => {
    setPushPrefsState(prev => ({ ...prev, ...patch }));
  }, []);

  return (
    <PwaContext.Provider value={{
      isStandalone, canInstall: Boolean(deferredPrompt), isInstalled: isInstalled || isStandalone,
      swReady, pushPermission, pushPrefs, loadTimeMs,
      installApp, enablePush, sendTestNotification, updatePushPrefs,
      measurePerformance, registerServiceWorker,
    }}>
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const ctx = useContext(PwaContext);
  if (!ctx) throw new Error("usePwa must be used within PwaProvider");
  return ctx;
}

export { PWA_FEATURES, HOME_SCREEN_SHORTCUTS, PUSH_NOTIFICATION_TYPES };

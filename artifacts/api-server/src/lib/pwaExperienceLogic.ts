export function getPwaCatalog() {
  return {
    features: ["install_app", "push_notifications", "offline_support", "home_shortcuts", "fast_loading"],
    displayModes: ["standalone", "fullscreen", "minimal-ui", "browser"],
    pushTypes: ["order_ready", "order_preparing", "waitlist_called", "offer", "loyalty"],
    shortcutCount: 8,
    targetLoadMs: 2000,
  };
}

export function mergePushPrefs(deviceInfo: unknown, prefs: Record<string, unknown>) {
  const base = (typeof deviceInfo === "object" && deviceInfo !== null ? deviceInfo : {}) as Record<string, unknown>;
  return {
    ...base,
    pushPrefs: { ...(base.pushPrefs as object ?? {}), ...prefs, updatedAt: new Date().toISOString() },
  };
}

export function getPerformanceGrade(loadMs: number) {
  if (loadMs <= 1000) return { grade: "A+", label: "Excellent", color: "emerald" };
  if (loadMs <= 2000) return { grade: "A", label: "Fast", color: "teal" };
  if (loadMs <= 3500) return { grade: "B", label: "Good", color: "amber" };
  return { grade: "C", label: "Needs optimization", color: "orange" };
}

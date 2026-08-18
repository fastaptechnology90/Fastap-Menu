/** Per-route scroll positions for guest navigation. */
const scrollPositions = new Map<string, number>();

let pendingRestoreKey: string | null = null;
let isPopNavigation = false;
let trackedRouteKey = "/";

const SCROLL_PARAMS = ["slug", "table", "room"] as const;

if (typeof window !== "undefined") {
  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  } catch { /* ignore */ }

  window.addEventListener("popstate", () => {
    isPopNavigation = true;
  });

  const onScroll = () => {
    scrollPositions.set(trackedRouteKey, window.scrollY);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  trackedRouteKey = routeScrollKey();
}

/** Stable key: pathname + venue query (ignores `from`, tab state, etc.). */
export function routeScrollKey(path = window.location.pathname, search = window.location.search) {
  const params = new URLSearchParams(search);
  const normalized = new URLSearchParams();
  for (const k of SCROLL_PARAMS) {
    const v = params.get(k);
    if (v) normalized.set(k, v);
  }
  const q = normalized.toString();
  return path + (q ? `?${q}` : "");
}

export function resolveRouteKey(dest: string) {
  if (dest.startsWith("http")) {
    const u = new URL(dest);
    return routeScrollKey(u.pathname, u.search);
  }
  const q = dest.indexOf("?");
  if (q === -1) return dest;
  return routeScrollKey(dest.slice(0, q), dest.slice(q));
}

export function setTrackedRouteKey(key: string) {
  trackedRouteKey = key;
  scrollPositions.set(key, window.scrollY);
}

export function saveGuestScroll(key = routeScrollKey()) {
  scrollPositions.set(key, window.scrollY);
}

export function scrollGuestToTop() {
  window.scrollTo({ top: 0, left: 0 });
}

export function restoreGuestScroll(key: string) {
  const target = scrollPositions.get(key) ?? 0;
  if (target <= 0) return;

  let attempts = 0;
  const maxAttempts = 24;

  const apply = () => {
    window.scrollTo({ top: target, left: 0 });
    attempts += 1;
    if (attempts < maxAttempts && Math.abs(window.scrollY - target) > 4) {
      requestAnimationFrame(apply);
    }
  };

  requestAnimationFrame(apply);
  window.setTimeout(apply, 50);
  window.setTimeout(apply, 150);
  window.setTimeout(apply, 350);
}

export function markGuestScrollRestore(dest: string) {
  saveGuestScroll();
  pendingRestoreKey = resolveRouteKey(dest);
}

export function consumeGuestScrollRestore(key: string): boolean {
  if (pendingRestoreKey === key) {
    pendingRestoreKey = null;
    return true;
  }
  return false;
}

export function consumePopNavigation(): boolean {
  if (!isPopNavigation) return false;
  isPopNavigation = false;
  return true;
}

export function shouldManageGuestScroll(pathname: string) {
  return pathname === "/" || pathname.startsWith("/user");
}

/** Call before programmatic navigation (forward). */
export function prepareGuestForwardNavigation() {
  saveGuestScroll();
  pendingRestoreKey = null;
}

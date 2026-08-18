import { useCallback, useSyncExternalStore } from "react";
import { navigate as wouterNavigate } from "wouter/use-browser-location";
import { prepareGuestForwardNavigation } from "@/lib/guestScrollRestore";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("pushState", onStoreChange);
  window.addEventListener("replaceState", onStoreChange);
  window.addEventListener("hashchange", onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("pushState", onStoreChange);
    window.removeEventListener("replaceState", onStoreChange);
    window.removeEventListener("hashchange", onStoreChange);
  };
}

function getPathname() {
  return window.location.pathname;
}

/** Location hook that reads the browser URL directly (avoids wouter context issues in dev). */
export type AppNavigateOptions = { replace?: boolean; restoreScroll?: boolean };

export function useAppLocation(): [string, (to: string, opts?: AppNavigateOptions) => void] {
  const pathname = useSyncExternalStore(subscribe, getPathname, () => "/");
  const navigate = useCallback((to: string, opts?: AppNavigateOptions) => {
    if (!opts?.restoreScroll && !opts?.replace) prepareGuestForwardNavigation();
    wouterNavigate(to, opts);
  }, []);
  return [pathname, navigate];
}

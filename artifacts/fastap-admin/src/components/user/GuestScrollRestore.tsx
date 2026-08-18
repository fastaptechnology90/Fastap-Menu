import { useEffect, useRef } from "react";
import { useSyncExternalStore } from "react";
import {
  consumeGuestScrollRestore,
  consumePopNavigation,
  restoreGuestScroll,
  routeScrollKey,
  scrollGuestToTop,
  setTrackedRouteKey,
  shouldManageGuestScroll,
} from "@/lib/guestScrollRestore";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("pushState", onStoreChange);
  window.addEventListener("replaceState", onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("pushState", onStoreChange);
    window.removeEventListener("replaceState", onStoreChange);
  };
}

function getRouteKey() {
  return routeScrollKey();
}

export function GuestScrollRestore() {
  const routeKey = useSyncExternalStore(subscribe, getRouteKey, () => "/");
  const prevKeyRef = useRef(routeKey);
  const isFirstRef = useRef(true);

  useEffect(() => {
    const pathname = window.location.pathname;
    if (!shouldManageGuestScroll(pathname)) {
      prevKeyRef.current = routeKey;
      setTrackedRouteKey(routeKey);
      return;
    }

    setTrackedRouteKey(routeKey);

    const isRouteChange = prevKeyRef.current !== routeKey;
    const shouldRestore = isRouteChange && (
      consumeGuestScrollRestore(routeKey) || consumePopNavigation()
    );

    if (!isFirstRef.current && isRouteChange) {
      if (shouldRestore) {
        restoreGuestScroll(routeKey);
      } else {
        scrollGuestToTop();
      }
    }

    isFirstRef.current = false;
    prevKeyRef.current = routeKey;
  }, [routeKey]);

  return null;
}

import { useCallback } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { isFromLanding } from "@/lib/guestDemo";
import { markGuestScrollRestore } from "@/lib/guestScrollRestore";

/** Build menu URL preserving slug / table from URL or venue context. */
export function guestMenuUrl(
  venue?: { restaurantSlug?: string },
  activeTable?: string,
) {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const slug = params.get("slug") || venue?.restaurantSlug || "spice-garden";
  const table = params.get("table") || activeTable;
  const qs = new URLSearchParams({ slug });
  if (table) qs.set("table", table);
  const room = params.get("room");
  if (room) qs.set("room", room);
  return `/user/menu?${qs.toString()}`;
}

/** Navigate back to menu (or custom fallback) with venue query preserved. */
export function useGuestBack(fallbackPath = "/user/menu") {
  const [, navigate] = useAppLocation();
  const { venue, activeTable } = useUser();

  return useCallback(() => {
    let dest: string;
    if (isFromLanding()) {
      dest = "/";
    } else if (fallbackPath === "/user/menu") {
      dest = guestMenuUrl(venue, activeTable);
    } else {
      const params = new URLSearchParams(window.location.search);
      const slug = params.get("slug") || venue?.restaurantSlug;
      dest = fallbackPath;
      if (slug && !fallbackPath.includes("slug=")) {
        const sep = fallbackPath.includes("?") ? "&" : "?";
        dest = `${fallbackPath}${sep}slug=${encodeURIComponent(slug)}`;
      }
    }
    markGuestScrollRestore(dest);
    navigate(dest, { restoreScroll: true });
  }, [navigate, fallbackPath, venue, activeTable]);
}

import { useEffect } from "react";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useUser } from "@/contexts/UserContext";
import { DEMO_SLUG } from "@/lib/guestDemo";

/** Load restaurant context from URL query on any /user/* route. */
export function useGuestVenue() {
  const [location] = useAppLocation();
  const { loadVenue } = useUser();

  useEffect(() => {
    if (!location.startsWith("/user")) return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug") || DEMO_SLUG;
    loadVenue(slug, {
      table: params.get("table") || undefined,
      room: params.get("room") || undefined,
      section: params.get("section") || undefined,
    }).catch(() => {});
  }, [location, loadVenue]);
}
